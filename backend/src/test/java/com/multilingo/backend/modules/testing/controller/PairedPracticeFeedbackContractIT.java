package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.modules.exam.entity.Exam;
import com.multilingo.backend.modules.exam.entity.ExamPart;
import com.multilingo.backend.modules.exam.entity.ExamSection;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.request.AutosaveAnswersRequest;
import com.multilingo.backend.modules.testing.dto.request.SubmitAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.entity.enums.SubmitReason;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class PairedPracticeFeedbackContractIT {
    @Autowired private MockMvc mockMvc;
    @Autowired private ExamRepository examRepository;
    @Autowired private ExamSectionRepository examSectionRepository;
    @Autowired private ExamPartRepository examPartRepository;
    @Autowired private TestAttemptRepository attemptRepository;
    @Autowired private AttemptAnswerRepository answerRepository;
    @Autowired private TestAttemptService attemptService;
    @SpyBean private IdentityAdapter identityAdapter;

    private final List<Integer> attemptIds = new ArrayList<>();
    private final List<Integer> examIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : attemptIds) {
            answerRepository.deleteAll(answerRepository.findByAttemptId(attemptId));
            attemptRepository.deleteById(attemptId);
        }
        for (Integer examId : examIds) {
            List<ExamSection> sections = examSectionRepository.findByExam_Id(examId);
            for (ExamSection section : sections)
                examPartRepository.deleteAll(examPartRepository.findBySection_Id(section.getId()));
            examSectionRepository.deleteAll(sections);
            examRepository.deleteById(examId);
        }
        attemptIds.clear();
        examIds.clear();
    }

    @Test
    void practiceReturnsBothPairedSlotsWithoutPersistingAndMockTestRemainsBlocked() throws Exception {
        ExamPart part = seedPairedExam();
        WorkspaceResponse practice = createAttempt(part, TestMode.PRACTICE);
        TestAttempt before = attemptRepository.findById(practice.getAttemptId()).orElseThrow();
        List<AttemptAnswer> answersBefore = answerRepository.findByAttemptId(practice.getAttemptId());

        mockMvc.perform(post("/api/v1/attempts/" + practice.getAttemptId() + "/practice-feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"partId": %d, "questionId": "l_018", "answer": "E",
                                 "groupAnswers": {"l_018": "E", "l_017": "A"}}
                                """.formatted(part.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.score").value(1))
                .andExpect(jsonPath("$.data.groupResults.length()").value(2))
                .andExpect(jsonPath("$.data.groupResults[0].questionId").value("l_017"))
                .andExpect(jsonPath("$.data.groupResults[0].userAnswer").value("A"))
                .andExpect(jsonPath("$.data.groupResults[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.groupResults[0].correctAnswer[0]").value("A"))
                .andExpect(jsonPath("$.data.groupResults[0].explanation").value("One of the two distinct correct options."))
                .andExpect(jsonPath("$.data.groupResults[1].questionId").value("l_018"))
                .andExpect(jsonPath("$.data.groupResults[1].userAnswer").value("E"))
                .andExpect(jsonPath("$.data.groupResults[1].verdict").value("CORRECT"));

        TestAttempt after = attemptRepository.findById(practice.getAttemptId()).orElseThrow();
        assertThat(after.getVersion()).isEqualTo(before.getVersion());
        assertThat(after.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
        assertThat(answerRepository.findByAttemptId(practice.getAttemptId())).isEqualTo(answersBefore);

        WorkspaceResponse mockTest = createAttempt(part, TestMode.MOCK_TEST);
        mockMvc.perform(post("/api/v1/attempts/" + mockTest.getAttemptId() + "/practice-feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"partId": %d, "questionId": "l_018", "answer": "E",
                                 "groupAnswers": {"l_018": "E", "l_017": "A"}}
                                """.formatted(part.getId())))
                .andExpect(status().isForbidden());
    }

    @Test
    void submitUsesTheSameUnorderedPairRulesAndPersistsBothMemberFlags() {
        ExamPart part = seedPairedExam();
        WorkspaceResponse practice = createAttempt(part, TestMode.PRACTICE);
        var finalAnswers = List.of(AutosaveAnswersRequest.PartAnswerDto.builder().partId(part.getId())
                .answers(List.of(new AutosaveAnswersRequest.QuestionAnswerDto("l_017", "E"),
                        new AutosaveAnswersRequest.QuestionAnswerDto("l_018", "A"))).build());

        var result = attemptService.submitAttempt(practice.getAttemptId(), SubmitAttemptRequest.builder()
                .reason(SubmitReason.MANUAL).baseVersion(practice.getVersion()).finalAnswers(finalAnswers).build());

        assertThat(result.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        AttemptAnswer answer = answerRepository.findByAttemptId(practice.getAttemptId()).getFirst();
        assertThat(answer.getUserAnswers()).containsEntry("l_017", "E").containsEntry("l_018", "A");
        assertThat(answer.getIsCorrectFlags()).containsEntry("l_017", "CORRECT").containsEntry("l_018", "CORRECT");
        assertThat(answer.getEarnedScore()).isEqualByComparingTo("2");
        TestAttempt attempt = attemptRepository.findById(practice.getAttemptId()).orElseThrow();
        assertThat(attempt.getOverallScore()).isEqualByComparingTo("2");
        assertThat(attempt.getResultSummary()).contains("\"correctCount\":2", "\"totalObjectiveCount\":2");
    }

    private WorkspaceResponse createAttempt(ExamPart part, TestMode mode) {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setExamId(part.getSection().getExam().getId());
        request.setTestScope(TestScope.FULL_EXAM);
        request.setTestMode(mode);
        WorkspaceResponse workspace = attemptService.createAttempt(request);
        attemptIds.add(workspace.getAttemptId());
        return workspace;
    }

    private ExamPart seedPairedExam() {
        String code = "IELTS_PAIR_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        Exam exam = examRepository.save(Exam.builder().code(code).title("Paired answer contract")
                .type("IELTS_ACADEMIC").examLanguage("en").durationMinutes(30).isPublished(true).build());
        examIds.add(exam.getId());
        ExamSection section = examSectionRepository.save(ExamSection.builder().exam(exam).skillType("LISTENING")
                .title("Listening").durationMinutes(30).orderIndex(1).build());
        Map<String, Object> pair = Map.of("id", "listening-17-18", "mode", "DISTINCT_UNORDERED",
                "question_ids", List.of("l_017", "l_018"));
        List<Map<String, Object>> questions = List.of(question("l_017", pair), question("l_018", pair));
        Map<String, Object> group = new LinkedHashMap<>();
        group.put("group_id", "g1");
        group.put("questions", questions);
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("part_title", "Part 2");
        content.put("question_groups", List.of(group));
        ExamPart part = ExamPart.builder().section(section).partNumber(2).contentData(content).build();
        return examPartRepository.save(part);
    }

    private static Map<String, Object> question(String id, Map<String, Object> answerGroup) {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("question_id", id);
        question.put("type", "SINGLE_CHOICE");
        question.put("question_text", "Which option?");
        question.put("options", List.of(Map.of("id", "A", "text", "Alpha"),
                Map.of("id", "B", "text", "Beta"), Map.of("id", "E", "text", "Echo")));
        question.put("correct_answer", List.of("A", "E"));
        question.put("answer_group", answerGroup);
        question.put("explanation", "One of the two distinct correct options.");
        return question;
    }
}
