package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.repository.*;
import com.multilingo.backend.config.DefaultExamDatasetRunner;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class ExamDatasetIntegrationTest {
    @Autowired DefaultExamDatasetService datasets;
    @Autowired AdminExamService admin;
    @Autowired ExamParserService parser;
    @Autowired ExamRepository exams;
    @Autowired ExamSectionRepository sections;
    @Autowired ExamPartRepository parts;
    @Autowired ObjectMapper mapper;
    @Autowired ApplicationContext context;
    @Autowired com.multilingo.backend.modules.testing.service.TestAttemptService attempts;
    @Autowired com.multilingo.backend.modules.testing.repository.TestAttemptRepository attemptRepository;
    @Autowired com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository answers;
    private final List<Integer> createdAttempts = new ArrayList<>();

    @AfterEach void cleanup() {
        for (Integer id : createdAttempts) {
            answers.deleteAll(answers.findByAttemptId(id));
            attemptRepository.deleteById(id);
        }
        createdAttempts.clear();
        for (Exam exam : exams.findAll()) if (exam.getCode().startsWith("TOEIC-ETS-2024-T1-V")) {
            admin.deleteExam(exam.getId());
        }
    }

    private ExamDatasetBundle bundle(int version) throws Exception {
        try (var workbook = ExcelV2Fixture.workbook()) {
            var export = ExamDatasetBundle.export(parser.parseExamFile(ExcelV2Fixture.file(workbook)));
            return new ExamDatasetBundle(1, export.datasetKey(), version, "TOEIC-ETS-2024-T1-V" + version,
                new ExamDatasetBundle.Source("synthetic.xlsx", "a".repeat(64), "TEST ONLY"),
                export.checksum(), export.request());
        }
    }

    @Test void disabledByDefaultAndWireBundleRoundTripIsIdempotent() throws Exception {
        assertThat(context.getBeansOfType(DefaultExamDatasetRunner.class)).isEmpty();
        var bundle = mapper.readValue(mapper.writeValueAsBytes(bundle(1)), ExamDatasetBundle.class);
        assertThat(datasets.seed(List.of(bundle))).isEqualTo(1);
        var exam = exams.findByCode(bundle.examCode()).orElseThrow();
        assertThat(exam.getIsPublished()).isFalse();
        assertThat(exam.getDurationMinutes()).isEqualTo(120);
        assertThat(datasets.seed(List.of(bundle))).isZero();
        var export = admin.exportDataset(exam.getId());
        assertThat(export.checksum()).isEqualTo(bundle.checksum());
        assertThat(export.source().approvalReference()).isNull();
        assertThat(mapper.writeValueAsString(export)).doesNotContain("sectionId", "attemptId", "token");
    }

    @Test void laterConflictRollsBackEarlierCreateInSameTransaction() throws Exception {
        var first = bundle(1); var second = bundle(2);
        datasets.seed(List.of(second));
        var existing = exams.findByCode(second.examCode()).orElseThrow(); existing.setTitle("Changed by editor"); exams.saveAndFlush(existing);
        assertThatThrownBy(() -> datasets.seed(List.of(first, second))).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        assertThat(exams.findByCode(first.examCode())).isEmpty();
        assertThat(exams.findByCode(second.examCode()).orElseThrow().getTitle()).isEqualTo("Changed by editor");
    }

    @Test void publishingRequiresExplicitFlagAndCanPublishAnIdenticalSeededDraft() throws Exception {
        var optInLater = bundle(5);
        assertThat(datasets.seed(List.of(optInLater), false)).isEqualTo(1);
        var firstExam = exams.findByCode(optInLater.examCode()).orElseThrow();
        assertThat(firstExam.getIsPublished()).isFalse();

        assertThat(datasets.seed(List.of(optInLater), true)).isZero();
        assertThat(exams.findByCode(optInLater.examCode()).orElseThrow().getIsPublished()).isTrue();

        var publishOnCreate = bundle(6);
        assertThat(datasets.seed(List.of(publishOnCreate), true)).isEqualTo(1);
        assertThat(exams.findByCode(publishOnCreate.examCode()).orElseThrow().getIsPublished()).isTrue();
    }

    @Test void concurrentSeedNeverCreatesDuplicateOrPartiallyWrittenExam() throws Exception {
        var bundle = bundle(3);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> work = () -> {
                start.await();
                try { datasets.seed(List.of(bundle)); return true; }
                catch (org.springframework.dao.DataIntegrityViolationException | com.multilingo.backend.common.exception.AppException e) { return false; }
            };
            var one = executor.submit(work); var two = executor.submit(work); start.countDown();
            assertThat(one.get(30, TimeUnit.SECONDS) || two.get(30, TimeUnit.SECONDS)).isTrue();
            // Always join both tasks before inspecting or cleaning up their data.
            two.get(30, TimeUnit.SECONDS);
        }
        var exam = exams.findByCode(bundle.examCode()).orElseThrow();
        assertThat(admin.exportDataset(exam.getId()).checksum()).isEqualTo(bundle.checksum());
        assertThat(exams.findAll().stream().filter(e -> bundle.examCode().equals(e.getCode())).count()).isEqualTo(1);
    }

    @Test @org.springframework.security.test.context.support.WithMockUser(username = "1", roles = "USER")
    void importedCanonicalKeysGradeAndReviewHistoricallyAfterEditAndUnpublish() throws Exception {
        var bundle = bundle(4); datasets.seed(List.of(bundle));
        var exam = exams.findByCode(bundle.examCode()).orElseThrow();
        admin.updateExamStatus(exam.getId(), true);
        var reading = sections.findByExam_Id(exam.getId()).stream().filter(section -> "READING".equals(section.getSkillType())).findFirst().orElseThrow();
        var selectedPart = parts.findBySection_Id(reading.getId()).stream().filter(part -> part.getPartNumber() == 5).findFirst().orElseThrow();
        var request = new com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest();
        request.setExamId(exam.getId());
        request.setTestScope(com.multilingo.backend.modules.testing.entity.enums.TestScope.SINGLE_PART);
        request.setTestMode(com.multilingo.backend.modules.testing.entity.enums.TestMode.PRACTICE);
        request.setTargetPartId(selectedPart.getId());
        var workspace = attempts.createAttempt(request);
        createdAttempts.add(workspace.getAttemptId());
        assertThat(mapper.writeValueAsString(workspace)).doesNotContain("correct_answer", "explanation", "correct_option_index");
        // Change DB question after snapshot capture, then unpublish current exam.
        var edit = admin.getExamDetail(exam.getId());
        edit.setPublished(false);
        var content = edit.getSections().get(1).getParts().getFirst().getContentData();
        var group = (Map<String,Object>) ((List<?>) content.get("question_groups")).getFirst();
        var question = (Map<String,Object>) ((List<?>) group.get("questions")).getFirst();
        question.put("correct_answer", "A"); question.put("explanation", "New explanation");
        admin.updateExam(exam.getId(), edit);
        assertThat(attempts.getAttemptWorkspace(workspace.getAttemptId()).getAttemptId()).isEqualTo(workspace.getAttemptId());
        assertThatThrownBy(() -> attempts.createAttempt(request)).isInstanceOf(com.multilingo.backend.common.exception.AppException.class);
        var finalAnswers = List.of(new com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest.PartAnswerDto(
            selectedPart.getId(), List.of(new com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest.QuestionAnswerDto("q_101", "B"))));
        attempts.submitAttempt(workspace.getAttemptId(), com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest.builder()
            .reason(com.multilingo.backend.modules.testing.entity.enums.SubmitReason.MANUAL).baseVersion(workspace.getVersion()).finalAnswers(finalAnswers).build());
        var review = attempts.getAttemptReview(workspace.getAttemptId(), selectedPart.getId());
        var reviewed = review.getQuestions().stream().filter(q -> "q_101".equals(q.getQuestionId())).findFirst().orElseThrow();
        assertThat(reviewed.getCorrectAnswer()).isEqualTo("B");
        assertThat(reviewed.getVerdict()).isEqualTo("CORRECT");
        assertThat(reviewed.getExplanation()).isEqualTo("Giải thích đã kiểm tra.");
    }
}
