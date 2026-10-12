package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class TestAttemptReviewControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @SpyBean
    private GradingAdapter gradingAdapter;

    private final List<Integer> createdAttemptIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        reset(gradingAdapter);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
            testAttemptRepository.deleteById(attemptId);
        }
        createdAttemptIds.clear();
    }

    @Test
    @WithAnonymousUser
    @DisplayName("TC-REVIEW-01: Unauthenticated request to review endpoint returns HTTP 401")
    void getReview_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/99999/review/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("TC-REVIEW-02: Attempt owned by another user returns HTTP 403")
    void getReview_wrongOwner_returns403() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(999) // not current user 1
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(10, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(createStandardReviewSnapshot(1))
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("TC-REVIEW-03: In-progress attempt returns HTTP 400")
    void getReview_inProgress_returns400() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testMode(TestMode.PRACTICE)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now())
                .examSnapshot(createStandardReviewSnapshot(1))
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("Attempt is not submitted yet"));
    }

    @Test
    @DisplayName("TC-REVIEW-04: Part not in attempt scope returns HTTP 404 (Fail-closed)")
    void getReview_partNotInScope_returns404() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(10, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(createStandardReviewSnapshot(1)) // only part 1
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("TC-REVIEW-05: Finalized attempt returns 200 with complete typed review contract")
    void getReview_completed_returns200_withCompleteTypedContract() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(15, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(createStandardReviewSnapshot(1))
                .resultSummary("{\"partResults\":{\"1\":{\"q1\":{\"questionId\":\"q1\",\"verdict\":\"CORRECT\",\"score\":1.00},\"q2\":{\"questionId\":\"q2\",\"verdict\":\"WRONG\",\"score\":0.00}}}}")
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(1)
                .userAnswers(Map.of("q1", "A", "q2", "C"))
                .build();
        attemptAnswerRepository.save(answer);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attemptId").value(attempt.getId()))
                .andExpect(jsonPath("$.data.partId").value(1))
                .andExpect(jsonPath("$.data.partTitle").value("Part 1 - Passage 1"))
                .andExpect(jsonPath("$.data.skill").value("READING"))
                // Structured part stats
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(2))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(1))
                .andExpect(jsonPath("$.data.partStats.incorrectCount").value(1))
                .andExpect(jsonPath("$.data.partStats.score").value(1.00))
                .andExpect(jsonPath("$.data.partStats.accuracy").value(50.00))
                // Questions
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q1"))
                .andExpect(jsonPath("$.data.questions[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("A"))
                .andExpect(jsonPath("$.data.questions[0].explanation").value("Explanation Q1"))
                .andExpect(jsonPath("$.data.questions[0].options[0].id").value("A"))
                .andExpect(jsonPath("$.data.questions[0].options[0].isCorrect").value(true))
                .andExpect(jsonPath("$.data.questions[0].options[1].id").value("B"))
                .andExpect(jsonPath("$.data.questions[0].options[1].isCorrect").value(false))
                .andExpect(jsonPath("$.data.questions[1].questionId").value("q2"))
                .andExpect(jsonPath("$.data.questions[1].verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.questions[1].correctAnswer").value("B"))
                // Legacy fields
                .andExpect(jsonPath("$.data.userAnswers.q1").value("A"))
                .andExpect(jsonPath("$.data.userAnswers.q2").value("C"))
                .andExpect(jsonPath("$.data.isCorrectFlags.q1").value(true))
                .andExpect(jsonPath("$.data.isCorrectFlags.q2").value(false))
                .andExpect(jsonPath("$.data.examData").isNotEmpty());
    }

    @Test
    @DisplayName("TC-REVIEW-06: Zero internal secret leakage regression")
    void getReview_securityRegression_neverLeaksInternalSecrets() throws Exception {
        Map<String, Object> secretSnapshot = createStandardReviewSnapshot(1);

        // Inject critical secret keys into snapshot
        Map<String, Object> part = ((List<Map<String, Object>>) ((Map<String, Object>) ((List<Map<String, Object>>) secretSnapshot.get("sections")).get(0)).get("parts")).get(0);
        part.put("ai_prompt_context", "CRITICAL_SECRET_PROMPT");
        part.put("grading_key", "CRITICAL_SECRET_GRADING_KEY");
        part.put("ai_feedback", "CRITICAL_SECRET_FEEDBACK");
        part.put("grading_keys", "CRITICAL_SECRET_KEYS");
        part.put("is_correct_flags", Map.of("q1", true));
        part.put("earned_score", 1.0);
        part.put("skill_stats", Map.of("READING", 1.0));

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(10, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(secretSnapshot)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();

        assertThat(responseBody).doesNotContain("CRITICAL_SECRET_PROMPT");
        assertThat(responseBody).doesNotContain("CRITICAL_SECRET_GRADING_KEY");
        assertThat(responseBody).doesNotContain("CRITICAL_SECRET_FEEDBACK");
        assertThat(responseBody).doesNotContain("CRITICAL_SECRET_KEYS");
        assertThat(responseBody).doesNotContain("\"ai_prompt_context\"");
        assertThat(responseBody).doesNotContain("\"ai_feedback\"");
        assertThat(responseBody).doesNotContain("\"grading_key\"");
        assertThat(responseBody).doesNotContain("\"grading_keys\"");
    }

    @Test
    @DisplayName("TC-REVIEW-07: Legacy attempt without snapshot keys falls back gracefully to GradingAdapter")
    void getReview_legacyAttemptWithoutKeys_fallsBackGracefullyToGradingAdapter() throws Exception {
        // Snapshot without correct_answer and without explanation
        Map<String, Object> legacySnapshot = new LinkedHashMap<>();
        legacySnapshot.put("sections", List.of(
                Map.of(
                        "name", "Reading",
                        "parts", List.of(
                                Map.of(
                                        "id", 1,
                                        "title", "Legacy Part 1",
                                        "questions", List.of(
                                                Map.of(
                                                        "question_id", "q_legacy",
                                                        "type", "SINGLE_CHOICE",
                                                        "options", List.of(
                                                                Map.of("id", "A", "text", "Apple"),
                                                                Map.of("id", "B", "text", "Banana")
                                                        )
                                                )
                                        )
                                )
                        )
                )
        ));

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(999)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(10, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(legacySnapshot)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        PartGradingKey fallbackKey = new PartGradingKey();
        fallbackKey.setPartId(1);
        GradingKey gk = new GradingKey();
        gk.setQuestionId("q_legacy");
        gk.setCorrect("B");
        fallbackKey.setAnswers(Map.of("q_legacy", gk));

        when(gradingAdapter.loadPartKeys(999))
                .thenReturn(Map.of(1, fallbackKey));

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q_legacy"))
                .andExpect(jsonPath("$.data.questions[0].correctAnswer").value("B"))
                .andExpect(jsonPath("$.data.questions[0].explanation").doesNotExist())
                .andExpect(jsonPath("$.data.questions[0].options[0].isCorrect").value(false))
                .andExpect(jsonPath("$.data.questions[0].options[1].isCorrect").value(true));

        verify(gradingAdapter).loadPartKeys(999);
    }

    @Test
    @DisplayName("TC-REVIEW-08: Historical attempt with string isCorrectFlags and null resultSummary returns accurate stats")
    void getReview_historicalAttempt_withStringIsCorrectFlags_returnsAccurateStats() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(888)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(20, ChronoUnit.MINUTES))
                .endTime(Instant.now().minus(5, ChronoUnit.MINUTES))
                .examSnapshot(createStandardReviewSnapshot(1))
                .resultSummary(null) // Historical attempt missing resultSummary JSON
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        // AttemptAnswer saved with String verdicts ("CORRECT", "WRONG") from TestAttemptServiceImpl
        Map<String, Object> stringFlags = new LinkedHashMap<>();
        stringFlags.put("q1", "CORRECT");
        stringFlags.put("q2", "WRONG");

        AttemptAnswer answer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(1)
                .userAnswers(Map.of("q1", "A", "q2", "A"))
                .isCorrectFlags(stringFlags)
                .earnedScore(new java.math.BigDecimal("1.00"))
                .build();
        attemptAnswerRepository.save(answer);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/review/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.partStats.totalQuestions").value(2))
                .andExpect(jsonPath("$.data.partStats.correctCount").value(1))
                .andExpect(jsonPath("$.data.partStats.incorrectCount").value(1))
                .andExpect(jsonPath("$.data.partStats.unansweredCount").value(0))
                .andExpect(jsonPath("$.data.partStats.score").value(1.00))
                .andExpect(jsonPath("$.data.partStats.accuracy").value(50.00))
                .andExpect(jsonPath("$.data.partStats.isCorrectFlags.q1").value(true))
                .andExpect(jsonPath("$.data.partStats.isCorrectFlags.q2").value(false))
                .andExpect(jsonPath("$.data.questions[0].questionId").value("q1"))
                .andExpect(jsonPath("$.data.questions[0].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.questions[0].score").doesNotExist())
                .andExpect(jsonPath("$.data.questions[1].questionId").value("q2"))
                .andExpect(jsonPath("$.data.questions[1].verdict").value("WRONG"))
                .andExpect(jsonPath("$.data.questions[1].score").doesNotExist());
    }

    private Map<String, Object> createStandardReviewSnapshot(Integer partId) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        Map<String, Object> part = new LinkedHashMap<>();
        part.put("id", partId);
        part.put("title", "Part " + partId + " - Passage 1");

        Map<String, Object> q1 = new LinkedHashMap<>();
        q1.put("question_id", "q1");
        q1.put("type", "SINGLE_CHOICE");
        q1.put("correct_answer", "A");
        q1.put("explanation", "Explanation Q1");
        q1.put("options", List.of(
                Map.of("id", "A", "text", "Alpha"),
                Map.of("id", "B", "text", "Beta")
        ));

        Map<String, Object> q2 = new LinkedHashMap<>();
        q2.put("question_id", "q2");
        q2.put("type", "SINGLE_CHOICE");
        q2.put("correct_answer", "B");
        q2.put("explanation", "Explanation Q2");
        q2.put("options", List.of(
                Map.of("id", "A", "text", "Alpha"),
                Map.of("id", "B", "text", "Beta")
        ));

        part.put("questions", List.of(q1, q2));

        snapshot.put("sections", List.of(
                Map.of(
                        "name", "Reading",
                        "parts", List.of(part)
                )
        ));
        return snapshot;
    }
}
