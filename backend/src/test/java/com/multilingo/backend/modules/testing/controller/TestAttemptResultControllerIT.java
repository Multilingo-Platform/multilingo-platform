package com.multilingo.backend.modules.testing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
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
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@WithMockUser(username = "1", roles = "USER")
class TestAttemptResultControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestAttemptRepository testAttemptRepository;

    @Autowired
    private AttemptAnswerRepository attemptAnswerRepository;

    @SpyBean
    private ExamAdapter examAdapter;

    @SpyBean
    private GradingAdapter gradingAdapter;

    @SpyBean
    private ObjectiveGradingService gradingService;

    private final List<Integer> createdAttemptIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        reset(examAdapter, gradingAdapter, gradingService);
    }

    @AfterEach
    void tearDown() {
        for (Integer attemptId : createdAttemptIds) {
            attemptAnswerRepository.deleteAll(attemptAnswerRepository.findByAttemptId(attemptId));
            testAttemptRepository.deleteById(attemptId);
        }
        createdAttemptIds.clear();
    }

    private Map<String, Object> createStandardSnapshot() {
        return Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Passage 1",
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE"),
                                                        Map.of("id", "q2", "type", "TRUE_FALSE_NOT_GIVEN")
                                                )
                                        ),
                                        Map.of(
                                                "id", 2,
                                                "title", "Passage 2",
                                                "questions", List.of(
                                                        Map.of("id", "q3", "type", "FILL_IN_THE_BLANK")
                                                )
                                        )
                                )
                        ),
                        Map.of(
                                "name", "Listening",
                                "parts", List.of(
                                        Map.of(
                                                "id", 3,
                                                "title", "Audio 1",
                                                "questions", List.of(
                                                        Map.of("id", "q4", "type", "SINGLE_CHOICE"),
                                                        Map.of("id", "q5", "type", "MULTIPLE_CHOICE")
                                                )
                                        )
                                )
                        )
                )
        );
    }

    private String createStandardGradingJson() {
        return """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "sectionScores": {
                    "READING": 2.0,
                    "LISTENING": 1.0
                  },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "WRONG", "score": 0.0 }
                    },
                    "2": {
                      "q3": { "questionId": "q3", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "3": {
                      "q4": { "questionId": "q4", "verdict": "CORRECT", "score": 1.0 },
                      "q5": { "questionId": "q5", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;
    }

    @Test
    @WithAnonymousUser
    @DisplayName("TC-13: Unauthenticated request to result endpoint returns HTTP 401")
    void getResult_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/99999/result"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("TC-13: Attempt owned by another user returns HTTP 403")
    void getResult_wrongOwner_returns403() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(999) // not user 1
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(10, ChronoUnit.MINUTES))
                .endTime(Instant.now())
                .examSnapshot(createStandardSnapshot())
                .resultSummary(createStandardGradingJson())
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("TC-13: In-progress attempt not eligible for lazy finalize returns HTTP 400")
    void getResult_inProgress_returns400() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testMode(TestMode.PRACTICE) // practice never expires
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(Instant.now())
                .examSnapshot(createStandardSnapshot())
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Attempt is not submitted yet"));
    }

    @Test
    @DisplayName("TC-01 / AC-01: Finalized attempt returns 200 with complete structured summary and preserves legacy shape without calling adapters")
    void getResult_completed_validSummary_returns200() throws Exception {
        Instant start = Instant.now().minus(120, ChronoUnit.SECONDS);
        Instant end = Instant.now();

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .testScope(TestScope.FULL_EXAM)
                .testMode(TestMode.MOCK_TEST)
                .status(AttemptStatus.COMPLETED)
                .startTime(start)
                .endTime(end)
                .timeSpentSeconds(120)
                .overallScore(new BigDecimal("3.00"))
                .examSnapshot(createStandardSnapshot())
                .resultSummary(createStandardGradingJson())
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attemptId").value(attempt.getId()))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.timeSpentSeconds").value(120))
                .andExpect(jsonPath("$.data.overallScore").value(3.0))
                // Legacy fields in resultSummary
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(5))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(3))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(3.0))
                .andExpect(jsonPath("$.data.resultSummary.sectionScores.READING").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.sectionScores.LISTENING").value(1.0))
                .andExpect(jsonPath("$.data.resultSummary.partResults['1']['q1'].verdict").value("CORRECT"))
                .andExpect(jsonPath("$.data.resultSummary.partResults['1']['q1'].score").value(1.0))
                // Structured summary
                .andExpect(jsonPath("$.data.resultSummary.objective.scoreUnit").value("RAW_OBJECTIVE"))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(5))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(3))
                .andExpect(jsonPath("$.data.resultSummary.objective.incorrect").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.unanswered").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.accuracy").value(60.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].skill").value("READING"))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[0].accuracy").value(66.67))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].skill").value("LISTENING"))
                .andExpect(jsonPath("$.data.resultSummary.objective.bySkill[1].accuracy").value(50.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart[0].partId").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart[0].label").value("Passage 1"))
                .andExpect(jsonPath("$.data.resultSummary.writing").doesNotExist());

        // Verify no engine / adapter re-evaluation for finalized attempt
        verify(examAdapter, never()).findById(any());
        verify(gradingAdapter, never()).loadPartKeys(any());
        verify(gradingService, never()).gradeAttempt(any(), any());
    }

    @Test
    @DisplayName("TC-08 / TC-09 / AC-05: Objective score visible during AI_GRADING with pending Writing tasks and null scores")
    void getResult_aiGrading_withWriting_returnsObjectiveAndPendingWriting() throws Exception {
        Map<String, Object> snapshotWithWriting = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Reading Part 1",
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE")
                                                )
                                        )
                                )
                        ),
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of(
                                                "id", 10,
                                                "title", "Writing Task 1",
                                                "questions", List.of(
                                                        Map.of("id", "essay_1", "type", "ESSAY")
                                                )
                                        )
                                )
                        )
                )
        );

        String json = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 1.0,
                  "sectionScores": { "READING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    }
                  }
                }
                """;

        Instant start = Instant.now().minus(60, ChronoUnit.SECONDS);
        Instant end = Instant.now();

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.AI_GRADING)
                .startTime(start)
                .endTime(end)
                .overallScore(new BigDecimal("1.00"))
                .examSnapshot(snapshotWithWriting)
                .resultSummary(json)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        AttemptAnswer essayAnswer = AttemptAnswer.builder()
                .attempt(attempt)
                .partId(10)
                .userAnswers(Map.of("essay_1", "This is an essay with seven words."))
                .build();
        attemptAnswerRepository.save(essayAnswer);

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("AI_GRADING"))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(1.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(1))
                .andExpect(jsonPath("$.data.resultSummary.objective.correct").value(1))
                .andExpect(jsonPath("$.data.resultSummary.writing.status").value("PENDING"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].partId").value(10))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].questionId").value("essay_1"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].status").value("PENDING"))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].wordCount").value(7))
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].score").isEmpty())
                .andExpect(jsonPath("$.data.resultSummary.writing.tasks[0].maxScore").isEmpty());
    }

    @Test
    @DisplayName("TC-10 / AC-06: Corrupted or incomplete JSON returns HTTP 200 with summaryAvailable=false and resultSummary=null without failing")
    void getResult_corruptedJson_returns200WithUnavailableSummary() throws Exception {
        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .timeSpentSeconds(60)
                .overallScore(new BigDecimal("5.00"))
                .examSnapshot(createStandardSnapshot())
                .resultSummary("{\"corrupted_summary\": true}")
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.attemptId").value(attempt.getId()))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.overallScore").value(5.0))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").doesNotExist());
    }

    @Test
    @DisplayName("TC-14 / AC-07: Injected secret tokens in database JSON do not leak into HTTP response")
    void getResult_secretFieldsInDbJson_doNotLeak() throws Exception {
        String jsonWithSecrets = """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "secret_token": "SECRET_LEAK_TOKEN_999",
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": {
                        "questionId": "q1",
                        "verdict": "CORRECT",
                        "score": 1.0,
                        "secret_answer_key": "KEY_AAA",
                        "explanation": "SECRET_EXPLANATION_TEXT"
                      },
                      "q2": { "questionId": "q2", "verdict": "WRONG", "score": 0.0 }
                    },
                    "2": {
                      "q3": { "questionId": "q3", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "3": {
                      "q4": { "questionId": "q4", "verdict": "CORRECT", "score": 1.0 },
                      "q5": { "questionId": "q5", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("3.00"))
                .examSnapshot(createStandardSnapshot())
                .resultSummary(jsonWithSecrets)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body)
                .doesNotContain("SECRET_LEAK_TOKEN_999")
                .doesNotContain("secret_token")
                .doesNotContain("KEY_AAA")
                .doesNotContain("secret_answer_key")
                .doesNotContain("SECRET_EXPLANATION_TEXT")
                .doesNotContain("explanation");
    }

    @Test
    @DisplayName("P1 Regression: Legacy attempt with duplicate part aliases returns HTTP 200 summaryAvailable=false")
    void getResult_withDuplicatePartAliases_returns200SummaryUnavailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"), Map.of("id", "q2", "type", "SINGLE_CHOICE"))),
                                        Map.of("id", 2, "questions", List.of(Map.of("id", "q3", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        String jsonAliases = """
                {
                  "totalObjectiveCount": 3,
                  "correctCount": 2,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "01": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("2.00"))
                .examSnapshot(snapshot)
                .resultSummary(jsonAliases)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").isEmpty());
    }

    @Test
    @DisplayName("P1 Regression: Legacy attempt with incomplete part questions returns HTTP 200 summaryAvailable=false")
    void getResult_withIncompletePartQuestions_returns200SummaryUnavailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"), Map.of("id", "q2", "type", "SINGLE_CHOICE"))),
                                        Map.of("id", 2, "questions", List.of(Map.of("id", "q3", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        String jsonMissingQ2 = """
                {
                  "totalObjectiveCount": 2,
                  "correctCount": 2,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "2": {
                      "q3": { "questionId": "q3", "verdict": "CORRECT", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("2.00"))
                .examSnapshot(snapshot)
                .resultSummary(jsonMissingQ2)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").isEmpty());
    }

    @Test
    @DisplayName("P1 Regression: Legacy attempt with 1e400 totalScore returns HTTP 200 summaryAvailable=false (no HTTP 500)")
    void getResult_withOverflowScore_returns200SummaryUnavailable() throws Exception {
        String json1e400 = """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 3,
                  "totalScore": 1e400,
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "WRONG", "score": 0.0 }
                    },
                    "2": {
                      "q3": { "questionId": "q3", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "3": {
                      "q4": { "questionId": "q4", "verdict": "CORRECT", "score": 1.0 },
                      "q5": { "questionId": "q5", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(BigDecimal.ONE)
                .examSnapshot(createStandardSnapshot())
                .resultSummary(json1e400)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").isEmpty());
    }

    @Test
    @DisplayName("P1 Regression: Exam with same question ID across different parts returns HTTP 200 with complete summary")
    void getResult_withSameQuestionIdAcrossDifferentParts_returns200SummaryAvailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE"))),
                                        Map.of("id", 2, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        String json = """
                {
                  "totalObjectiveCount": 2,
                  "correctCount": 2,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "2": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("2.00"))
                .examSnapshot(snapshot)
                .resultSummary(json)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.resultSummary.totalObjectiveCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.correctCount").value(2))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(2.0))
                .andExpect(jsonPath("$.data.resultSummary.objective.total").value(2))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart.length()").value(2));
    }

    @Test
    @DisplayName("P2 Regression: Attempt with verdict BLANK but score > 0 returns HTTP 200 summaryAvailable=false")
    void getResult_withBlankVerdictAndPositiveScore_returns200SummaryUnavailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        String jsonBlankPositive = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 0,
                  "totalScore": 1.0,
                  "sectionScores": { "READING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "BLANK", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(BigDecimal.ONE)
                .examSnapshot(snapshot)
                .resultSummary(jsonBlankPositive)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").isEmpty());
    }

    @Test
    @DisplayName("P2 Regression: Attempt with score 1,000,001 within column limit returns HTTP 200 summaryAvailable=true")
    void getResult_withScoreOverOneMillionWithinColumnLimit_returns200SummaryAvailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "MATCHING")))
                                )
                        )
                )
        );

        String json1M = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 1000001.0,
                  "sectionScores": { "READING": 1000001.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1000001.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("1000001.00"))
                .examSnapshot(snapshot)
                .resultSummary(json1M)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.overallScore").value(1000001.0))
                .andExpect(jsonPath("$.data.resultSummary.totalScore").value(1000001.0));
    }

    @Test
    @DisplayName("P2 Regression: Attempt with CORRECT score != 1 on non-MATCHING returns HTTP 200 summaryAvailable=false")
    void getResult_withCorrectScoreNotOneOnNonMatching_returns200SummaryUnavailable() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "questions", List.of(Map.of("id", "q1", "type", "SINGLE_CHOICE")))
                                )
                        )
                )
        );

        String jsonScore2 = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 2.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(new BigDecimal("2.00"))
                .examSnapshot(snapshot)
                .resultSummary(jsonScore2)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(false))
                .andExpect(jsonPath("$.data.resultSummary").isEmpty());
    }

    @Test
    @DisplayName("P1 Regression: Snapshot with metadata object does not leak nested secret into HTTP response")
    void getResult_withNestedMetadataObject_doesNotLeakIntoResponse() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", Map.of("secret_key", "SECRET_SKILL_HTTP"),
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", Map.of("correct_answer", "SECRET_ANSWER_KEY_HTTP"),
                                                "questions", List.of(
                                                        Map.of(
                                                                "id", "q1",
                                                                "type", "SINGLE_CHOICE",
                                                                "title", Map.of("prompt", "SECRET_PROMPT_HTTP")
                                                        )
                                                )
                                        )
                                )
                        )
                )
        );

        String json = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 1.0,
                  "sectionScores": { "UNKNOWN": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = TestAttempt.builder()
                .userId(1)
                .examId(1)
                .status(AttemptStatus.COMPLETED)
                .startTime(Instant.now().minus(60, ChronoUnit.SECONDS))
                .endTime(Instant.now())
                .overallScore(BigDecimal.ONE)
                .examSnapshot(snapshot)
                .resultSummary(json)
                .build();
        attempt = testAttemptRepository.save(attempt);
        createdAttemptIds.add(attempt.getId());

        MvcResult result = mockMvc.perform(get("/api/v1/attempts/" + attempt.getId() + "/result"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.summaryAvailable").value(true))
                .andExpect(jsonPath("$.data.resultSummary.objective.byPart[0].label").value("Part 1"))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body)
                .doesNotContain("SECRET_ANSWER_KEY_HTTP")
                .doesNotContain("SECRET_SKILL_HTTP")
                .doesNotContain("SECRET_PROMPT_HTTP");
    }
}

