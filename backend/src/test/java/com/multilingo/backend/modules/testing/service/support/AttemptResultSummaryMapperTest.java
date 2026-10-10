package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.*;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class AttemptResultSummaryMapperTest {

    private AttemptResultSummaryMapper mapper;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        mapper = new AttemptResultSummaryMapper(objectMapper);
    }

    private TestAttempt buildAttempt(Integer id, AttemptStatus status, BigDecimal overallScore, Map<String, Object> snapshot, String json) {
        TestAttempt attempt = TestAttempt.builder()
                .status(status)
                .overallScore(overallScore)
                .examSnapshot(snapshot)
                .resultSummary(json)
                .build();
        attempt.setId(id);
        return attempt;
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
    @DisplayName("TC-01: Valid objective grading produces correct aggregations by whole exam, skill, and part")
    void map_validObjective_returnsCorrectAggregations() {
        TestAttempt attempt = buildAttempt(100, AttemptStatus.COMPLETED, new BigDecimal("3.0"),
                createStandardSnapshot(), createStandardGradingJson());

        ResultSummaryResponse summary = mapper.map(attempt, List.of());

        assertThat(summary).isNotNull();
        assertThat(summary.getTotalObjectiveCount()).isEqualTo(5);
        assertThat(summary.getCorrectCount()).isEqualTo(3);
        assertThat(summary.getTotalScore()).isEqualByComparingTo(new BigDecimal("3.0"));

        // Objective summary
        ObjectiveSummary obj = summary.getObjective();
        assertThat(obj.getScoreUnit()).isEqualTo("RAW_OBJECTIVE");
        assertThat(obj.getTotal()).isEqualTo(5);
        assertThat(obj.getCorrect()).isEqualTo(3);
        assertThat(obj.getIncorrect()).isEqualTo(1);
        assertThat(obj.getUnanswered()).isEqualTo(1);
        assertThat(obj.getRawScore()).isEqualByComparingTo(new BigDecimal("3.0"));
        assertThat(obj.getAccuracy()).isEqualByComparingTo(new BigDecimal("60.00")); // 3/5 = 60.00%

        // bySkill
        assertThat(obj.getBySkill()).hasSize(2);
        SkillObjectiveStats reading = obj.getBySkill().get(0);
        assertThat(reading.getSkill()).isEqualTo("READING");
        assertThat(reading.getTotal()).isEqualTo(3);
        assertThat(reading.getCorrect()).isEqualTo(2);
        assertThat(reading.getIncorrect()).isEqualTo(1);
        assertThat(reading.getUnanswered()).isEqualTo(0);
        assertThat(reading.getRawScore()).isEqualByComparingTo(new BigDecimal("2.0"));
        assertThat(reading.getAccuracy()).isEqualByComparingTo(new BigDecimal("66.67")); // 2/3 = 66.67%

        SkillObjectiveStats listening = obj.getBySkill().get(1);
        assertThat(listening.getSkill()).isEqualTo("LISTENING");
        assertThat(listening.getTotal()).isEqualTo(2);
        assertThat(listening.getCorrect()).isEqualTo(1);
        assertThat(listening.getIncorrect()).isEqualTo(0);
        assertThat(listening.getUnanswered()).isEqualTo(1);
        assertThat(listening.getRawScore()).isEqualByComparingTo(new BigDecimal("1.0"));
        assertThat(listening.getAccuracy()).isEqualByComparingTo(new BigDecimal("50.00")); // 1/2 = 50.00%

        // byPart
        assertThat(obj.getByPart()).hasSize(3);
        PartObjectiveStats p1 = obj.getByPart().get(0);
        assertThat(p1.getPartId()).isEqualTo(1);
        assertThat(p1.getLabel()).isEqualTo("Passage 1");
        assertThat(p1.getSkill()).isEqualTo("READING");
        assertThat(p1.getTotal()).isEqualTo(2);
        assertThat(p1.getCorrect()).isEqualTo(1);
        assertThat(p1.getIncorrect()).isEqualTo(1);
        assertThat(p1.getUnanswered()).isEqualTo(0);

        PartObjectiveStats p2 = obj.getByPart().get(1);
        assertThat(p2.getPartId()).isEqualTo(2);
        assertThat(p2.getLabel()).isEqualTo("Passage 2");
        assertThat(p2.getTotal()).isEqualTo(1);
        assertThat(p2.getCorrect()).isEqualTo(1);

        PartObjectiveStats p3 = obj.getByPart().get(2);
        assertThat(p3.getPartId()).isEqualTo(3);
        assertThat(p3.getLabel()).isEqualTo("Audio 1");
        assertThat(p3.getTotal()).isEqualTo(2);
        assertThat(p3.getCorrect()).isEqualTo(1);
        assertThat(p3.getUnanswered()).isEqualTo(1);

        // Section scores
        assertThat(summary.getSectionScores()).containsEntry("READING", new BigDecimal("2.0"));
        assertThat(summary.getSectionScores()).containsEntry("LISTENING", new BigDecimal("1.0"));

        // No writing in this exam
        assertThat(summary.getWriting()).isNull();
    }

    @Test
    @DisplayName("TC-06: Accuracy rounds 2/3 to 66.67, blank reduces accuracy, and 0 total yields 0.00 without divide-by-zero")
    void map_accuracyRoundingAndZeroTotal() {
        // 1. Accuracy 2/3 with WRONG
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Part 1",
                                                "questions", List.of(
                                                        Map.of("id", "q1", "type", "SINGLE_CHOICE"),
                                                        Map.of("id", "q2", "type", "SINGLE_CHOICE"),
                                                        Map.of("id", "q3", "type", "SINGLE_CHOICE")
                                                )
                                        )
                                )
                        )
                )
        );

        String jsonWrong = """
                {
                  "totalObjectiveCount": 3,
                  "correctCount": 2,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "CORRECT", "score": 1.0 },
                      "q3": { "questionId": "q3", "verdict": "WRONG", "score": 0.0 }
                    }
                  }
                }
                """;

        TestAttempt attemptWrong = buildAttempt(1, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonWrong);

        ResultSummaryResponse resWrong = mapper.map(attemptWrong, List.of());
        assertThat(resWrong.getObjective().getAccuracy()).isEqualByComparingTo(new BigDecimal("66.67"));
        assertThat(resWrong.getObjective().getIncorrect()).isEqualTo(1);
        assertThat(resWrong.getObjective().getUnanswered()).isEqualTo(0);

        // 2. Accuracy 2/3 with BLANK (blank reduces accuracy, incorrect remains 0)
        String jsonBlank = """
                {
                  "totalObjectiveCount": 3,
                  "correctCount": 2,
                  "totalScore": 2.0,
                  "sectionScores": { "READING": 2.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "CORRECT", "score": 1.0 },
                      "q3": { "questionId": "q3", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;

        TestAttempt attemptBlank = buildAttempt(2, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonBlank);

        ResultSummaryResponse resBlank = mapper.map(attemptBlank, List.of());
        assertThat(resBlank.getObjective().getAccuracy()).isEqualByComparingTo(new BigDecimal("66.67"));
        assertThat(resBlank.getObjective().getIncorrect()).isEqualTo(0);
        assertThat(resBlank.getObjective().getUnanswered()).isEqualTo(1);
    }

    @Test
    @DisplayName("TC-08: Writing-only exam produces 0 counts and empty objective lists, but summary is available")
    void map_zeroObjective_writingOnly_returnsAvailableWithZeroCounts() {
        Map<String, Object> writingSnapshot = Map.of(
                "sections", List.of(
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

        String jsonWritingOnly = """
                {
                  "totalObjectiveCount": 0,
                  "correctCount": 0,
                  "totalScore": 0.0,
                  "sectionScores": {},
                  "partResults": {}
                }
                """;

        TestAttempt attempt = buildAttempt(3, AttemptStatus.AI_GRADING, BigDecimal.ZERO, writingSnapshot, jsonWritingOnly);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(10)
                .userAnswers(Map.of("essay_1", "The chart shows trends in education over twenty years."))
                .build();

        ResultSummaryResponse res = mapper.map(attempt, List.of(answer));

        assertThat(res).isNotNull();
        assertThat(res.getTotalObjectiveCount()).isEqualTo(0);
        assertThat(res.getCorrectCount()).isEqualTo(0);
        assertThat(res.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);

        ObjectiveSummary obj = res.getObjective();
        assertThat(obj.getTotal()).isEqualTo(0);
        assertThat(obj.getCorrect()).isEqualTo(0);
        assertThat(obj.getAccuracy()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(obj.getBySkill()).isEmpty();
        assertThat(obj.getByPart()).isEmpty();

        // Writing summary
        WritingSummary writing = res.getWriting();
        assertThat(writing).isNotNull();
        assertThat(writing.getStatus()).isEqualTo("PENDING");
        assertThat(writing.getTasks()).hasSize(1);
        WritingTaskSummary task = writing.getTasks().get(0);
        assertThat(task.getPartId()).isEqualTo(10);
        assertThat(task.getQuestionId()).isEqualTo("essay_1");
        assertThat(task.getLabel()).isEqualTo("Writing Task 1");
        assertThat(task.getStatus()).isEqualTo("PENDING");
        assertThat(task.getWordCount()).isEqualTo(9);
        assertThat(task.getScore()).isNull();
        assertThat(task.getMaxScore()).isNull();
    }

    @Test
    @DisplayName("TC-08 / TC-09: Writing task word count and status mapping with multiple essays, Unicode and bad types")
    void map_writingTasks_wordCountAndStatusMapping() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of(
                                                "id", 20,
                                                "title", "Writing Tasks",
                                                "questions", List.of(
                                                        Map.of("id", "essay_1", "type", "ESSAY", "title", "Task 1: Chart"),
                                                        Map.of("id", "essay_2", "type", "ESSAY", "title", "Task 2: Essay"),
                                                        Map.of("id", "essay_3", "type", "ESSAY") // fallback to part title
                                                )
                                        )
                                )
                        )
                )
        );

        String json = """
                {
                  "totalObjectiveCount": 0,
                  "correctCount": 0,
                  "totalScore": 0.0,
                  "sectionScores": {},
                  "partResults": {}
                }
                """;

        // Test AI_GRADING_QUEUED -> "QUEUED"
        TestAttempt attemptQueued = buildAttempt(4, AttemptStatus.AI_GRADING_QUEUED, BigDecimal.ZERO, snapshot, json);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(20)
                .userAnswers(Map.of(
                        "essay_1", "   Xin chào   các bạn   học viên   ", // Unicode + extra whitespace: 6 words
                        "essay_2", "", // empty string: 0 words
                        "essay_3", 12345 // non-string type: 0 words
                ))
                .build();

        ResultSummaryResponse resQueued = mapper.map(attemptQueued, List.of(answer));
        assertThat(resQueued.getWriting().getStatus()).isEqualTo("QUEUED");
        List<WritingTaskSummary> tasks = resQueued.getWriting().getTasks();
        assertThat(tasks).hasSize(3);

        assertThat(tasks.get(0).getQuestionId()).isEqualTo("essay_1");
        assertThat(tasks.get(0).getLabel()).isEqualTo("Task 1: Chart");
        assertThat(tasks.get(0).getStatus()).isEqualTo("QUEUED");
        assertThat(tasks.get(0).getWordCount()).isEqualTo(6);

        assertThat(tasks.get(1).getQuestionId()).isEqualTo("essay_2");
        assertThat(tasks.get(1).getLabel()).isEqualTo("Task 2: Essay");
        assertThat(tasks.get(1).getWordCount()).isEqualTo(0);

        assertThat(tasks.get(2).getQuestionId()).isEqualTo("essay_3");
        assertThat(tasks.get(2).getLabel()).isEqualTo("Writing Tasks");
        assertThat(tasks.get(2).getWordCount()).isEqualTo(0);

        // Test GRADING_FAILED -> "FAILED"
        TestAttempt attemptFailed = buildAttempt(5, AttemptStatus.GRADING_FAILED, BigDecimal.ZERO, snapshot, json);
        ResultSummaryResponse resFailed = mapper.map(attemptFailed, List.of(answer));
        assertThat(resFailed.getWriting().getStatus()).isEqualTo("FAILED");
        assertThat(resFailed.getWriting().getTasks().get(0).getStatus()).isEqualTo("FAILED");
    }

    @Test
    @DisplayName("TC-05: Legacy MATCHING partial score is preserved without being constrained by correct count")
    void map_matchingPartialScore_preserved() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", "Matching Part",
                                                "questions", List.of(
                                                        Map.of("id", "m1", "type", "MATCHING")
                                                )
                                        )
                                )
                        )
                )
        );

        String json = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 0,
                  "totalScore": 0.5,
                  "sectionScores": { "READING": 0.5 },
                  "partResults": {
                    "1": {
                      "m1": { "questionId": "m1", "verdict": "WRONG", "score": 0.5 }
                    }
                  }
                }
                """;

        TestAttempt attempt = buildAttempt(6, AttemptStatus.COMPLETED, new BigDecimal("0.5"), snapshot, json);

        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();
        assertThat(res.getTotalScore()).isEqualByComparingTo(new BigDecimal("0.5"));
        assertThat(res.getCorrectCount()).isEqualTo(0);
        assertThat(res.getObjective().getRawScore()).isEqualByComparingTo(new BigDecimal("0.5"));
        assertThat(res.getObjective().getByPart().get(0).getRawScore()).isEqualByComparingTo(new BigDecimal("0.5"));
    }

    @Test
    @DisplayName("TC-10: Incomplete, corrupted, or inconsistent grading data returns null (summary unavailable)")
    void map_corruptedOrInconsistentData_returnsNull() {
        Map<String, Object> validSnapshot = createStandardSnapshot();
        String validJson = createStandardGradingJson();

        // 1. null attempt
        assertThat(mapper.map(null, List.of())).isNull();

        // 2. null or blank resultSummary
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary(null).build(), List.of())).isNull();
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary("").build(), List.of())).isNull();

        // 3. null or invalid snapshot
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(null).resultSummary(validJson).build(), List.of())).isNull();
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(Map.of()).resultSummary(validJson).build(), List.of())).isNull();

        // 4. Malformed JSON syntax
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary("{not-json").build(), List.of())).isNull();

        // 5. Missing question from partResults (q3 missing)
        String jsonMissingQ = """
                {
                  "totalObjectiveCount": 4,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "WRONG", "score": 0.0 }
                    },
                    "3": {
                      "q4": { "questionId": "q4", "verdict": "CORRECT", "score": 1.0 },
                      "q5": { "questionId": "q5", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary(jsonMissingQ).build(), List.of())).isNull();

        // 6. Extra question outside scope
        String jsonExtraQ = """
                {
                  "totalObjectiveCount": 6,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 1.0 },
                      "q2": { "questionId": "q2", "verdict": "WRONG", "score": 0.0 }
                    },
                    "2": {
                      "q3": { "questionId": "q3", "verdict": "CORRECT", "score": 1.0 },
                      "q_extra": { "questionId": "q_extra", "verdict": "CORRECT", "score": 1.0 }
                    },
                    "3": {
                      "q4": { "questionId": "q4", "verdict": "CORRECT", "score": 1.0 },
                      "q5": { "questionId": "q5", "verdict": "BLANK", "score": 0.0 }
                    }
                  }
                }
                """;
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary(jsonExtraQ).build(), List.of())).isNull();

        // 7. Invalid verdict
        String jsonBadVerdict = """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "PARTIALLY_CORRECT", "score": 1.0 },
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
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary(jsonBadVerdict).build(), List.of())).isNull();

        // 8. Counter mismatch: correctCount in JSON says 4, but only 3 are CORRECT
        String jsonCounterMismatch = """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 4,
                  "totalScore": 3.0,
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
        assertThat(mapper.map(TestAttempt.builder().examSnapshot(validSnapshot).resultSummary(jsonCounterMismatch).build(), List.of())).isNull();

        // 9. Score mismatch: overallScore in DB does not match verified total score
        TestAttempt attemptScoreMismatch = buildAttempt(7, AttemptStatus.COMPLETED, new BigDecimal("9.99"), validSnapshot, validJson);
        assertThat(mapper.map(attemptScoreMismatch, List.of())).isNull();
    }

    @Test
    @DisplayName("TC-14: Allowlist rebuild ensures secret fields in JSON do not leak into response")
    void map_allowlistRebuild_noArbitraryFieldsLeak() throws Exception {
        Map<String, Object> snapshot = createStandardSnapshot();
        String jsonWithSecrets = """
                {
                  "totalObjectiveCount": 5,
                  "correctCount": 3,
                  "totalScore": 3.0,
                  "secret_token": "LEAK_ROOT_TOKEN",
                  "sectionScores": { "READING": 2.0, "LISTENING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": {
                        "questionId": "q1",
                        "verdict": "CORRECT",
                        "score": 1.0,
                        "secret_answer_key": "CHOICE_A",
                        "explanation": "Do not leak explanation"
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

        TestAttempt attempt = buildAttempt(8, AttemptStatus.COMPLETED, new BigDecimal("3.0"), snapshot, jsonWithSecrets);

        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();

        String serialized = objectMapper.writeValueAsString(res);
        assertThat(serialized)
                .doesNotContain("secret_token")
                .doesNotContain("LEAK_ROOT_TOKEN")
                .doesNotContain("secret_answer_key")
                .doesNotContain("CHOICE_A")
                .doesNotContain("explanation");
    }

    @Test
    @DisplayName("P1 Regression: Reject duplicate part ID aliases and return null")
    void map_rejectDuplicatePartAliases_returnsNull() {
        // Snapshot has part 1 (q1, q2) and part 2 (q3)
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

        // JSON has keys "1" and "01", both containing q1, missing q2
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

        TestAttempt attempt = buildAttempt(20, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonAliases);
        assertThat(mapper.map(attempt, List.of())).isNull();
    }

    @Test
    @DisplayName("P1 Regression: Reject incomplete part questions and return null")
    void map_rejectIncompletePartQuestions_returnsNull() {
        // Snapshot has part 1 (q1, q2) and part 2 (q3)
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

        // JSON has part 1 with only q1 (missing q2) and part 2 with q3
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

        TestAttempt attempt = buildAttempt(21, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonMissingQ2);
        assertThat(mapper.map(attempt, List.of())).isNull();
    }

    @Test
    @DisplayName("P1 Regression: Non-finite score or overflow numbers return null instead of throwing exception")
    void map_rejectNonFiniteOrOverflowScore_returnsNull() {
        Map<String, Object> snapshot = createStandardSnapshot();

        // 1. totalScore 1e400
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
        TestAttempt attempt1e400 = buildAttempt(30, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, json1e400);
        assertThat(mapper.map(attempt1e400, List.of())).isNull();

        // 2. totalObjectiveCount overflowing 32-bit int
        String jsonOverflowCounter = """
                {
                  "totalObjectiveCount": 3000000000,
                  "correctCount": 3,
                  "totalScore": 3.0,
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
        TestAttempt attemptOverflow = buildAttempt(31, AttemptStatus.COMPLETED, new BigDecimal("3.0"), snapshot, jsonOverflowCounter);
        assertThat(mapper.map(attemptOverflow, List.of())).isNull();
    }

    @Test
    @DisplayName("P2 Regression: Writing word count counts Unicode whitespace properly")
    void map_writingWordCount_unicodeWhitespace() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
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
                  "totalObjectiveCount": 0,
                  "correctCount": 0,
                  "totalScore": 0.0,
                  "sectionScores": {},
                  "partResults": {}
                }
                """;

        // Case A: NBSP and EM SPACE between words
        AttemptAnswer ans1 = AttemptAnswer.builder()
                .partId(1)
                .userAnswers(Map.of("essay_1", "one\u00A0two\u2003three"))
                .build();
        TestAttempt attempt1 = buildAttempt(40, AttemptStatus.AI_GRADING, BigDecimal.ZERO, snapshot, json);
        ResultSummaryResponse res1 = mapper.map(attempt1, List.of(ans1));
        assertThat(res1).isNotNull();
        assertThat(res1.getWriting().getTasks().get(0).getWordCount()).isEqualTo(3);

        // Case B: Only Unicode whitespace (NBSP, EM SPACE, tabs, newlines) -> 0 words
        AttemptAnswer ans2 = AttemptAnswer.builder()
                .partId(1)
                .userAnswers(Map.of("essay_1", "\u00A0\u2003  \t\n  \r\n"))
                .build();
        TestAttempt attempt2 = buildAttempt(41, AttemptStatus.AI_GRADING, BigDecimal.ZERO, snapshot, json);
        ResultSummaryResponse res2 = mapper.map(attempt2, List.of(ans2));
        assertThat(res2).isNotNull();
        assertThat(res2.getWriting().getTasks().get(0).getWordCount()).isEqualTo(0);

        // Case C: Vietnamese words with mixed Unicode and standard spaces
        AttemptAnswer ans3 = AttemptAnswer.builder()
                .partId(1)
                .userAnswers(Map.of("essay_1", "Một\u00A0hai  ba\n\tbốn"))
                .build();
        TestAttempt attempt3 = buildAttempt(42, AttemptStatus.AI_GRADING, BigDecimal.ZERO, snapshot, json);
        ResultSummaryResponse res3 = mapper.map(attempt3, List.of(ans3));
        assertThat(res3).isNotNull();
        assertThat(res3.getWriting().getTasks().get(0).getWordCount()).isEqualTo(4);

        // Case D: Non-string user answer -> 0 words
        AttemptAnswer ans4 = AttemptAnswer.builder()
                .partId(1)
                .userAnswers(Map.of("essay_1", 12345))
                .build();
        TestAttempt attempt4 = buildAttempt(43, AttemptStatus.AI_GRADING, BigDecimal.ZERO, snapshot, json);
        ResultSummaryResponse res4 = mapper.map(attempt4, List.of(ans4));
        assertThat(res4).isNotNull();
        assertThat(res4.getWriting().getTasks().get(0).getWordCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("P2 Regression: Sanitized logging does not leak corrupted raw payload token into logs")
    void map_sanitizedLogging_doesNotLeakRawPayloadToken(CapturedOutput output) {
        Map<String, Object> snapshot = createStandardSnapshot();
        String corruptedJson = "{ \"invalid\": SECRET_ESSAY_MARKER }";

        TestAttempt attempt = buildAttempt(50, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, corruptedJson);
        ResultSummaryResponse res = mapper.map(attempt, List.of());

        assertThat(res).isNull();
        assertThat(output.getAll()).doesNotContain("SECRET_ESSAY_MARKER");
    }

    @Test
    @DisplayName("P2 Regression: Score greater than 1 million within NUMERIC(10,2) column bound is accepted")
    void map_acceptsScoreGreaterThanOneMillion_withinColumnLimit() {
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

        TestAttempt attempt = buildAttempt(60, AttemptStatus.COMPLETED, new BigDecimal("1000001.0"), snapshot, json1M);
        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();
        assertThat(res.getTotalScore()).isEqualByComparingTo(new BigDecimal("1000001.0"));
    }

    @Test
    @DisplayName("P2 Regression: Score exceeding NUMERIC(10,2) max column limit (99999999.99) is rejected")
    void map_rejectsScoreExceedingMaxColumnLimit() {
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

        String jsonExceeding = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 100000000.0,
                  "sectionScores": { "READING": 100000000.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 100000000.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = buildAttempt(61, AttemptStatus.COMPLETED, new BigDecimal("100000000.0"), snapshot, jsonExceeding);
        assertThat(mapper.map(attempt, List.of())).isNull();
    }

    @Test
    @DisplayName("P2 Regression: Question with verdict BLANK but score > 0 is rejected")
    void map_rejectBlankWithPositiveScore_returnsNull() {
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

        String jsonBlankScore1 = """
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

        TestAttempt attempt = buildAttempt(62, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, jsonBlankScore1);
        assertThat(mapper.map(attempt, List.of())).isNull();
    }

    @Test
    @DisplayName("P2 Regression: Non-MATCHING question with verdict WRONG but score > 0 is rejected")
    void map_rejectWrongWithPositiveScoreOnNonMatching_returnsNull() {
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

        String jsonWrongScore1 = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 0,
                  "totalScore": 1.0,
                  "sectionScores": { "READING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "WRONG", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = buildAttempt(63, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, jsonWrongScore1);
        assertThat(mapper.map(attempt, List.of())).isNull();
    }

    @Test
    @DisplayName("P2 Regression: MATCHING question with verdict WRONG and partial score > 0 is accepted")
    void map_acceptsWrongWithPositiveScoreOnMatching_partialCredit() {
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

        String jsonMatchingPartial = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 0,
                  "totalScore": 1.0,
                  "sectionScores": { "READING": 1.0 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "WRONG", "score": 1.0 }
                    }
                  }
                }
                """;

        TestAttempt attempt = buildAttempt(64, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, jsonMatchingPartial);
        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();
        assertThat(res.getTotalScore()).isEqualByComparingTo(BigDecimal.ONE);
        assertThat(res.getObjective().getIncorrect()).isEqualTo(1);
    }

    @Test
    @DisplayName("P2 Regression: Non-MATCHING question with verdict CORRECT and score != 1 is rejected")
    void map_rejectCorrectScoreNotOneOnNonMatching_returnsNull() {
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

        // Case A: score 2.0
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
        TestAttempt attemptScore2 = buildAttempt(65, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonScore2);
        assertThat(mapper.map(attemptScore2, List.of())).isNull();

        // Case B: score 0.5
        String jsonScoreHalf = """
                {
                  "totalObjectiveCount": 1,
                  "correctCount": 1,
                  "totalScore": 0.5,
                  "sectionScores": { "READING": 0.5 },
                  "partResults": {
                    "1": {
                      "q1": { "questionId": "q1", "verdict": "CORRECT", "score": 0.5 }
                    }
                  }
                }
                """;
        TestAttempt attemptScoreHalf = buildAttempt(66, AttemptStatus.COMPLETED, new BigDecimal("0.5"), snapshot, jsonScoreHalf);
        assertThat(mapper.map(attemptScoreHalf, List.of())).isNull();
    }

    @Test
    @DisplayName("P2 Regression: MATCHING question with verdict CORRECT and score > 1 (multi-pair) is accepted")
    void map_acceptsCorrectScoreOnMatching_multiPair() {
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

        String jsonMatching2 = """
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
        TestAttempt attempt = buildAttempt(67, AttemptStatus.COMPLETED, new BigDecimal("2.0"), snapshot, jsonMatching2);
        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();
        assertThat(res.getTotalScore()).isEqualByComparingTo(new BigDecimal("2.0"));
        assertThat(res.getCorrectCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("P1 Regression: Metadata object in snapshot does not leak into serialized summary")
    void map_metadataObjectInSnapshot_doesNotLeakIntoResponse() throws Exception {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", Map.of("secret_name", "SECRET_SKILL_OBJ"),
                                "parts", List.of(
                                        Map.of(
                                                "id", 1,
                                                "title", Map.of("correct_answer", "SECRET_ANSWER_KEY_OBJ"),
                                                "questions", List.of(
                                                        Map.of(
                                                                "id", "q1",
                                                                "type", "SINGLE_CHOICE",
                                                                "title", Map.of("prompt", "SECRET_PROMPT_OBJ")
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

        TestAttempt attempt = buildAttempt(68, AttemptStatus.COMPLETED, BigDecimal.ONE, snapshot, json);
        ResultSummaryResponse res = mapper.map(attempt, List.of());
        assertThat(res).isNotNull();
        assertThat(res.getObjective().getByPart().get(0).getLabel()).isEqualTo("Part 1");

        String serialized = objectMapper.writeValueAsString(res);
        assertThat(serialized)
                .doesNotContain("SECRET_ANSWER_KEY_OBJ")
                .doesNotContain("SECRET_SKILL_OBJ")
                .doesNotContain("SECRET_PROMPT_OBJ");
    }
}
