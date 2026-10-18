package com.multilingo.backend.modules.exam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.dto.response.StudentExamSummaryResponse;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.exam.service.impl.StudentExamServiceImpl;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class OfficialExamsContractIT {
    private static final String TOEIC_RESOURCE = "/datasets/official-source/ets-2024-test-1-completed.xlsx";

    @Autowired private ExamParserService parser;
    @Autowired private DefaultExamDatasetService datasets;
    @Autowired private AdminExamService admin;
    @Autowired private StudentExamServiceImpl studentExams;
    @Autowired private ExamRepository exams;
    @Autowired private ExamSectionRepository sections;
    @Autowired private ExamPartRepository parts;
    @Autowired private TestAttemptService attempts;
    @Autowired private TestAttemptRepository attemptRepository;
    @Autowired private AttemptAnswerRepository answerRepository;
    @Autowired private ObjectMapper mapper;

    private final List<Integer> createdAttemptIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (Integer attemptId : createdAttemptIds) {
            answerRepository.deleteAll(answerRepository.findByAttemptId(attemptId));
            attemptRepository.deleteById(attemptId);
        }
        createdAttemptIds.clear();
        exams.findByCode("TOEIC-ETS-2024-T1-V2").ifPresent(exam -> admin.deleteExam(exam.getId()));
    }

    @Test
    void officialToeicCandidateFlowsFromCatalogThroughSnapshotGradingAndHistoricalReview() throws Exception {
        var bundle = parseToeicBundle();
        assertThat(datasets.seed(List.of(bundle), true)).isEqualTo(1);

        PageResponse<StudentExamSummaryResponse> library = studentExams.searchExams(
                "ETS 2024 Test 1", List.of("TOEIC_LR"), 0, 20, "createdAt");
        StudentExamSummaryResponse catalogEntry = library.getItems().stream()
                .filter(item -> bundle.examCode().equals(item.getCode())).findFirst().orElseThrow();
        var exam = exams.findByCode(bundle.examCode()).orElseThrow();
        var readingSection = sections.findByExam_Id(exam.getId()).stream()
                .filter(section -> "READING".equals(section.getSkillType())).findFirst().orElseThrow();
        var partFive = parts.findBySection_Id(readingSection.getId()).stream()
                .filter(part -> part.getPartNumber() == 5).findFirst().orElseThrow();

        CreateAttemptRequest create = new CreateAttemptRequest();
        create.setExamId(catalogEntry.getId());
        create.setTestScope(TestScope.SINGLE_PART);
        create.setTestMode(TestMode.PRACTICE);
        create.setTargetPartId(partFive.getId());
        var workspace = attempts.createAttempt(create);
        createdAttemptIds.add(workspace.getAttemptId());
        String workspaceJson = mapper.writeValueAsString(workspace);
        assertThat(workspaceJson).doesNotContain("correct_answer", "explanation", "correct_option_index",
                "ANSWER-KEY-DERIVED CLUES");
        assertThat(questions(workspace.getExamSnapshot())).hasSize(30);

        var requestSnapshot = ExamDatasetBundle.canonical(bundle.request());
        Map<String, Object> originalQuestion = question(requestSnapshot, "q_101");
        String originalAnswer = (String) originalQuestion.get("correct_answer");
        String originalExplanation = String.valueOf(originalQuestion.get("explanation"));
        String changedAnswer = options(originalQuestion).stream().map(option -> (String) option.get("id"))
                .filter(optionId -> !optionId.equals(originalAnswer)).findFirst().orElseThrow();
        var changedExam = ExamDatasetBundle.canonical(admin.getExamDetail(catalogEntry.getId()));
        question(changedExam, "q_101").put("correct_answer", changedAnswer);
        question(changedExam, "q_101").put("explanation", "edited after attempt creation");
        changedExam.setPublished(false);
        admin.updateExam(catalogEntry.getId(), changedExam);

        List<AutosaveAnswersRequest.QuestionAnswerDto> correctAnswers = partQuestions(requestSnapshot, 5)
                .stream().map(question -> new AutosaveAnswersRequest.QuestionAnswerDto(
                        (String) question.get("question_id"), question.get("correct_answer"))).toList();
        var submission = SubmitAttemptRequest.builder().reason(SubmitReason.MANUAL)
                .baseVersion(workspace.getVersion())
                .finalAnswers(List.of(new AutosaveAnswersRequest.PartAnswerDto(partFive.getId(), correctAnswers)))
                .build();
        attempts.submitAttempt(workspace.getAttemptId(), submission);

        var result = attempts.getAttemptResult(workspace.getAttemptId());
        assertThat(result.isSummaryAvailable()).isTrue();
        assertThat(result.getResultSummary().getObjective().getRawScore()).isEqualByComparingTo("30");
        assertThat(exams.findByCode(bundle.examCode()).orElseThrow().getIsPublished()).isFalse();
        assertThatThrownBy(() -> attempts.createAttempt(create)).isInstanceOf(AppException.class);

        var review = attempts.getAttemptReview(workspace.getAttemptId(), partFive.getId());
        var reviewedQuestion = review.getQuestions().stream().filter(item -> "q_101".equals(item.getQuestionId()))
                .findFirst().orElseThrow();
        assertThat(reviewedQuestion.getCorrectAnswer()).isEqualTo(originalAnswer);
        assertThat(reviewedQuestion.getExplanation()).isEqualTo(originalExplanation);
        assertThat(reviewedQuestion.getVerdict()).isEqualTo("CORRECT");
    }

    private ExamDatasetBundle parseToeicBundle() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(TOEIC_RESOURCE)) {
            assertThat(input).isNotNull();
            byte[] bytes = input.readAllBytes();
            try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                var preview = new ExcelV2ExamParser().parse(workbook,
                        OfficialExamSourceProfile.ETS_2024_COMPLETED_SHA256);
                return ExamDatasetBundle.exportOfficial(preview.request(),
                        OfficialExamDatasetRegistry.ETS_TOEIC_KEY, "TEST-ONLY; no release approval");
            }
        }
    }

    private List<Map<String, Object>> questions(Object value) {
        List<Map<String, Object>> result = new ArrayList<>();
        collectQuestions(value, result);
        Map<String, Map<String, Object>> uniqueById = new java.util.LinkedHashMap<>();
        for (Map<String, Object> question : result) {
            if (question.get("question_id") instanceof String id) uniqueById.putIfAbsent(id, question);
        }
        return new ArrayList<>(uniqueById.values());
    }

    private void collectQuestions(Object value, List<Map<String, Object>> result) {
        if (value instanceof Map<?, ?> map) {
            if (map.get("question_id") instanceof String) {
                @SuppressWarnings("unchecked") Map<String, Object> question = (Map<String, Object>) map;
                result.add(question);
                return;
            }
            map.values().forEach(child -> collectQuestions(child, result));
        } else if (value instanceof Iterable<?> iterable) {
            iterable.forEach(child -> collectQuestions(child, result));
        }
    }

    private List<Map<String, Object>> partQuestions(
            com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest request, int partNumber) {
        var part = request.getSections().stream().flatMap(section -> section.getParts().stream())
                .filter(candidate -> candidate.getPartNumber() == partNumber).findFirst().orElseThrow();
        return questions(part.getContentData());
    }

    private Map<String, Object> question(com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest request,
            String questionId) {
        return request.getSections().stream().flatMap(section -> section.getParts().stream())
                .flatMap(part -> questions(part.getContentData()).stream())
                .filter(candidate -> questionId.equals(candidate.get("question_id"))).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> options(Map<String, Object> question) {
        return (List<Map<String, Object>>) question.get("options");
    }
}
