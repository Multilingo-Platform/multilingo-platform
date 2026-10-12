package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.dto.response.*;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class AttemptReviewMapperTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private AttemptReviewMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AttemptReviewMapper(objectMapper);
    }

    @Test
    void findPartInSnapshot_whenPartFound_returnsPartScopeWithTitleAndSkill() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of(
                                                "id", 101,
                                                "title", "Part 1 - General Reading",
                                                "questions", List.of()
                                        )
                                )
                        ),
                        Map.of(
                                "name", "Listening",
                                "parts", List.of(
                                        Map.of(
                                                "part_id", 102,
                                                "part_title", "Part 2 - Conversation",
                                                "questions", List.of()
                                        )
                                )
                        )
                )
        );

        AttemptReviewMapper.PartScope scope1 = mapper.findPartInSnapshot(snapshot, 101);
        assertThat(scope1).isNotNull();
        assertThat(scope1.getPartId()).isEqualTo(101);
        assertThat(scope1.getPartTitle()).isEqualTo("Part 1 - General Reading");
        assertThat(scope1.getSkill()).isEqualTo("READING");

        AttemptReviewMapper.PartScope scope2 = mapper.findPartInSnapshot(snapshot, 102);
        assertThat(scope2).isNotNull();
        assertThat(scope2.getPartId()).isEqualTo(102);
        assertThat(scope2.getPartTitle()).isEqualTo("Part 2 - Conversation");
        assertThat(scope2.getSkill()).isEqualTo("LISTENING");
    }

    @Test
    void findPartInSnapshot_whenPartNotFoundOrSnapshotEmpty_returnsNull() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of("name", "Reading", "parts", List.of(Map.of("id", 1)))
                )
        );

        assertThat(mapper.findPartInSnapshot(snapshot, 999)).isNull();
        assertThat(mapper.findPartInSnapshot(null, 1)).isNull();
        assertThat(mapper.findPartInSnapshot(Map.of(), 1)).isNull();
    }

    @Test
    void mapReview_fullExamWithQuestionGroups_computesAccurateStatsAndInheritsOptions() {
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 1);
        partData.put("title", "Part 1");

        List<Map<String, Object>> groupOptions = List.of(
                Map.of("id", "A", "text", "Option A"),
                Map.of("id", "B", "text", "Option B"),
                Map.of("id", "C", "text", "Option C")
        );

        Map<String, Object> group1 = new LinkedHashMap<>();
        group1.put("group_id", "g1");
        group1.put("instruction", "Choose correct letter");
        group1.put("content_html", "<p>Passage text</p>");
        group1.put("options", groupOptions);
        group1.put("questions", List.of(
                Map.of(
                        "question_id", "q1",
                        "type", "SINGLE_CHOICE",
                        "correct_answer", "B",
                        "explanation", "Because B is mentioned"
                ),
                Map.of(
                        "question_id", "q2",
                        "type", "SINGLE_CHOICE",
                        "correct_answer", "A",
                        "explanation", "Because A is correct"
                )
        ));

        partData.put("question_groups", List.of(group1));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(1)
                .partTitle("Part 1")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder()
                .status(AttemptStatus.COMPLETED)
                .resultSummary("{\"partResults\":{\"1\":{\"q1\":{\"questionId\":\"q1\",\"verdict\":\"CORRECT\",\"score\":1.00},\"q2\":{\"questionId\":\"q2\",\"verdict\":\"WRONG\",\"score\":0.00}}}}")
                .build();
        attempt.setId(10);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(1)
                .userAnswers(Map.of("q1", "B", "q2", "C"))
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        assertThat(response.getAttemptId()).isEqualTo(10);
        assertThat(response.getPartId()).isEqualTo(1);
        assertThat(response.getPartTitle()).isEqualTo("Part 1");
        assertThat(response.getSkill()).isEqualTo("READING");

        // Verify PartStats
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(2);
        assertThat(stats.getCorrectCount()).isEqualTo(1);
        assertThat(stats.getIncorrectCount()).isEqualTo(1);
        assertThat(stats.getUnansweredCount()).isEqualTo(0);
        assertThat(stats.getScore()).isEqualByComparingTo("1.00");
        assertThat(stats.getAccuracy()).isEqualByComparingTo("50.00");

        // Verify question groups and inherited options
        assertThat(response.getQuestionGroups()).hasSize(1);
        ReviewQuestionGroupDto groupDto = response.getQuestionGroups().get(0);
        assertThat(groupDto.getGroupId()).isEqualTo("g1");
        assertThat(groupDto.getInstruction()).isEqualTo("Choose correct letter");
        assertThat(groupDto.getContentHtml()).isEqualTo("<p>Passage text</p>");

        // Verify questions
        assertThat(response.getQuestions()).hasSize(2);
        ReviewQuestionDto q1 = response.getQuestions().get(0);
        assertThat(q1.getQuestionId()).isEqualTo("q1");
        assertThat(q1.getVerdict()).isEqualTo("CORRECT");
        assertThat(q1.getUserAnswer()).isEqualTo("B");
        assertThat(q1.getCorrectAnswer()).isEqualTo("B");
        assertThat(q1.getExplanation()).isEqualTo("Because B is mentioned");
        assertThat(q1.getOptions()).hasSize(3);
        assertThat(q1.getOptions().get(0).getId()).isEqualTo("A");
        assertThat(q1.getOptions().get(0).getIsCorrect()).isFalse();
        assertThat(q1.getOptions().get(1).getId()).isEqualTo("B");
        assertThat(q1.getOptions().get(1).getIsCorrect()).isTrue();

        ReviewQuestionDto q2 = response.getQuestions().get(1);
        assertThat(q2.getQuestionId()).isEqualTo("q2");
        assertThat(q2.getVerdict()).isEqualTo("WRONG");
        assertThat(q2.getUserAnswer()).isEqualTo("C");
        assertThat(q2.getCorrectAnswer()).isEqualTo("A");

        // Verify backward compatibility legacy flags
        assertThat(response.getIsCorrectFlags()).containsEntry("q1", true);
        assertThat(response.getIsCorrectFlags()).containsEntry("q2", false);
    }

    @Test
    void mapReview_withEssayQuestion_setsPendingAndExcludesFromObjectiveStats() {
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 2);
        partData.put("title", "Writing Task 1");
        partData.put("questions", List.of(
                Map.of(
                        "question_id", "w1",
                        "type", "ESSAY",
                        "prompt", "Write at least 150 words"
                )
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(2)
                .partTitle("Writing Task 1")
                .skill("WRITING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder()
                .status(AttemptStatus.AI_GRADING)
                .build();
        attempt.setId(20);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(2)
                .userAnswers(Map.of("w1", "This is an essay written by user..."))
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(0);
        assertThat(stats.getCorrectCount()).isEqualTo(0);
        assertThat(stats.getAccuracy()).isEqualByComparingTo("0.00");

        assertThat(response.getQuestions()).hasSize(1);
        ReviewQuestionDto w1 = response.getQuestions().get(0);
        assertThat(w1.getQuestionId()).isEqualTo("w1");
        assertThat(w1.getType()).isEqualTo("ESSAY");
        assertThat(w1.getVerdict()).isEqualTo("PENDING");
        assertThat(w1.getScore()).isNull();
        assertThat(w1.getUserAnswer()).isEqualTo("This is an essay written by user...");
    }

    @Test
    void mapReview_stripsInternalSecretsRecursively() {
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 1);
        partData.put("title", "Part 1");
        partData.put("ai_prompt_context", "SECRET_PROMPT");
        partData.put("grading_key", "SECRET_KEY");

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("question_id", "q1");
        q.put("type", "SINGLE_CHOICE");
        q.put("correct_answer", "A");
        q.put("ai_feedback", "INTERNAL_FEEDBACK");
        q.put("is_correct_flags", Map.of("q1", true));
        q.put("media", Map.of("url", "https://media.com/audio.mp3", "ai_prompt_context", "SECRET"));

        partData.put("questions", List.of(q));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(1)
                .partTitle("Part 1")
                .skill("LISTENING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(30);

        ExamReviewResponse response = mapper.mapReview(attempt, scope, null);

        // Verify examData has no secrets
        Map<String, Object> sanitizedExamData = (Map<String, Object>) response.getExamData();
        assertThat(sanitizedExamData).doesNotContainKey("ai_prompt_context");
        assertThat(sanitizedExamData).doesNotContainKey("grading_key");

        // Verify question media has no secrets
        ReviewQuestionDto qDto = response.getQuestions().get(0);
        assertThat(qDto.getMedia()).containsEntry("url", "https://media.com/audio.mp3");
        assertThat(qDto.getMedia()).doesNotContainKey("ai_prompt_context");
    }

    @Test
    void mapReview_legacyAttemptMissingCorrectAnswer_usesFallbackKeyGracefully() {
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 1);
        partData.put("title", "Part 1");
        partData.put("questions", List.of(
                Map.of(
                        "question_id", "q1",
                        "type", "SINGLE_CHOICE",
                        // Note: no correct_answer or explanation
                        "options", List.of(
                                Map.of("id", "A", "text", "Apple"),
                                Map.of("id", "B", "text", "Banana")
                        )
                )
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(1)
                .partTitle("Part 1")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(40);

        PartGradingKey fallbackKey = new PartGradingKey();
        fallbackKey.setPartId(1);
        GradingKey gk = new GradingKey();
        gk.setQuestionId("q1");
        gk.setCorrect("B");
        fallbackKey.setAnswers(Map.of("q1", gk));

        ExamReviewResponse response = mapper.mapReview(attempt, scope, null, fallbackKey);

        ReviewQuestionDto qDto = response.getQuestions().get(0);
        assertThat(qDto.getCorrectAnswer()).isEqualTo("B");
        assertThat(qDto.getExplanation()).isNull(); // No explanation in legacy
        assertThat(qDto.getOptions().get(0).getIsCorrect()).isFalse();
        assertThat(qDto.getOptions().get(1).getIsCorrect()).isTrue();
    }

    @Test
    void mapReview_historicalAttemptWithoutResultSummary_correctlyReadsPersistedStringVerdicts() {
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 1);
        partData.put("title", "Part 1");
        partData.put("questions", List.of(
                Map.of("question_id", "q1", "type", "SINGLE_CHOICE", "options", List.of(Map.of("id", "A", "text", "Option A"))),
                Map.of("question_id", "q2", "type", "SINGLE_CHOICE", "options", List.of(Map.of("id", "B", "text", "Option B"))),
                Map.of("question_id", "q3", "type", "SINGLE_CHOICE", "options", List.of(Map.of("id", "C", "text", "Option C"))),
                Map.of("question_id", "q4_bool", "type", "SINGLE_CHOICE", "options", List.of(Map.of("id", "D", "text", "Option D")))
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(1)
                .partTitle("Part 1")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(50);
        attempt.setResultSummary(null); // No resultSummary available

        Map<String, Object> isCorrectFlags = new LinkedHashMap<>();
        isCorrectFlags.put("q1", "CORRECT"); // String verdict from TestAttemptServiceImpl
        isCorrectFlags.put("q2", "WRONG");
        isCorrectFlags.put("q3", "BLANK");
        isCorrectFlags.put("q4_bool", true); // Legacy boolean flag

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(1)
                .earnedScore(new BigDecimal("2.00"))
                .userAnswers(Map.of("q1", "A", "q2", "X", "q3", "", "q4_bool", "D"))
                .isCorrectFlags(isCorrectFlags)
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        // Verify per-question verdicts and scores (multi-question historical leaves question scores null/unavailable)
        List<ReviewQuestionDto> questions = response.getQuestions();
        assertThat(questions).hasSize(4);

        assertThat(questions.get(0).getQuestionId()).isEqualTo("q1");
        assertThat(questions.get(0).getVerdict()).isEqualTo("CORRECT");
        assertThat(questions.get(0).getScore()).isNull();

        assertThat(questions.get(1).getQuestionId()).isEqualTo("q2");
        assertThat(questions.get(1).getVerdict()).isEqualTo("WRONG");
        assertThat(questions.get(1).getScore()).isNull();

        assertThat(questions.get(2).getQuestionId()).isEqualTo("q3");
        assertThat(questions.get(2).getVerdict()).isEqualTo("BLANK");
        assertThat(questions.get(2).getScore()).isNull();

        assertThat(questions.get(3).getQuestionId()).isEqualTo("q4_bool");
        assertThat(questions.get(3).getVerdict()).isEqualTo("CORRECT");
        assertThat(questions.get(3).getScore()).isNull();

        // Verify aggregate part stats preserves persisted earnedScore
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(4);
        assertThat(stats.getCorrectCount()).isEqualTo(2);
        assertThat(stats.getIncorrectCount()).isEqualTo(1);
        assertThat(stats.getUnansweredCount()).isEqualTo(1);
        assertThat(stats.getScore()).isEqualByComparingTo("2.00");
        assertThat(stats.getAccuracy()).isEqualByComparingTo("50.00");
        assertThat(stats.getIsCorrectFlags()).containsEntry("q1", true);
        assertThat(stats.getIsCorrectFlags()).containsEntry("q2", false);
        assertThat(stats.getIsCorrectFlags()).containsEntry("q3", false);
        assertThat(stats.getIsCorrectFlags()).containsEntry("q4_bool", true);
    }

    @Test
    void mapReview_historicalSingleMatchingFullCredit_preservesEarnedScoreAndVerdict() {
        // MATCHING question where full credit was 2.00 points (2 pairs correct)
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 10);
        partData.put("title", "Matching Part");
        partData.put("questions", List.of(
                Map.of("question_id", "q_match_full", "type", "MATCHING", "options", List.of())
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(10)
                .partTitle("Matching Part")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(60);
        attempt.setResultSummary(null); // Missing resultSummary

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(10)
                .earnedScore(new BigDecimal("2.00")) // Persisted earned score: 2.00
                .isCorrectFlags(Map.of("q_match_full", "CORRECT"))
                .userAnswers(Map.of("q_match_full", Map.of("1", "A", "2", "B")))
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        // Single objective question inherits the persisted earned score (2.00), not fabricated 1.00
        List<ReviewQuestionDto> questions = response.getQuestions();
        assertThat(questions).hasSize(1);
        ReviewQuestionDto q = questions.get(0);
        assertThat(q.getQuestionId()).isEqualTo("q_match_full");
        assertThat(q.getVerdict()).isEqualTo("CORRECT");
        assertThat(q.getScore()).isEqualByComparingTo("2.00");

        // Part stats matches persisted earnedScore (2.00)
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(1);
        assertThat(stats.getCorrectCount()).isEqualTo(1);
        assertThat(stats.getIncorrectCount()).isEqualTo(0);
        assertThat(stats.getScore()).isEqualByComparingTo("2.00");
    }

    @Test
    void mapReview_historicalSingleMatchingPartialCreditWrong_preservesEarnedScoreAndVerdict() {
        // MATCHING question where partial credit earned 1.00 point, but overall verdict is WRONG
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 11);
        partData.put("title", "Matching Part Partial");
        partData.put("questions", List.of(
                Map.of("question_id", "q_match_partial", "type", "MATCHING", "options", List.of())
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(11)
                .partTitle("Matching Part Partial")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(61);
        attempt.setResultSummary(null);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(11)
                .earnedScore(new BigDecimal("1.00")) // Persisted partial credit: 1.00
                .isCorrectFlags(Map.of("q_match_partial", "WRONG"))
                .userAnswers(Map.of("q_match_partial", Map.of("1", "A", "2", "WRONG_VAL")))
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        // Single objective question inherits persisted partial credit (1.00), not fabricated 0.00
        List<ReviewQuestionDto> questions = response.getQuestions();
        assertThat(questions).hasSize(1);
        ReviewQuestionDto q = questions.get(0);
        assertThat(q.getQuestionId()).isEqualTo("q_match_partial");
        assertThat(q.getVerdict()).isEqualTo("WRONG");
        assertThat(q.getScore()).isEqualByComparingTo("1.00");

        // Part stats matches persisted earnedScore (1.00)
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(1);
        assertThat(stats.getCorrectCount()).isEqualTo(0);
        assertThat(stats.getIncorrectCount()).isEqualTo(1);
        assertThat(stats.getScore()).isEqualByComparingTo("1.00");
    }

    @Test
    void mapReview_historicalMultiQuestionWithMatching_doesNotAssignPartScoreToIndividualQuestions() {
        // Multi-question part: 1 MATCHING question + 1 SINGLE_CHOICE question, total earnedScore = 3.00
        Map<String, Object> partData = new LinkedHashMap<>();
        partData.put("id", 12);
        partData.put("title", "Multi Question Part");
        partData.put("questions", List.of(
                Map.of("question_id", "q_match", "type", "MATCHING", "options", List.of()),
                Map.of("question_id", "q_choice", "type", "SINGLE_CHOICE", "options", List.of())
        ));

        AttemptReviewMapper.PartScope scope = AttemptReviewMapper.PartScope.builder()
                .partId(12)
                .partTitle("Multi Question Part")
                .skill("READING")
                .partData(partData)
                .build();

        TestAttempt attempt = TestAttempt.builder().build();
        attempt.setId(62);
        attempt.setResultSummary(null);

        AttemptAnswer answer = AttemptAnswer.builder()
                .partId(12)
                .earnedScore(new BigDecimal("3.00")) // Persisted total earned score: 3.00
                .isCorrectFlags(Map.of("q_match", "CORRECT", "q_choice", "CORRECT"))
                .build();

        ExamReviewResponse response = mapper.mapReview(attempt, scope, answer);

        // Since there are multiple questions and no resultSummary, question scores must NOT be fabricated
        // and must NOT duplicate the entire 3.00 part score onto each question
        List<ReviewQuestionDto> questions = response.getQuestions();
        assertThat(questions).hasSize(2);
        assertThat(questions.get(0).getScore()).isNull();
        assertThat(questions.get(1).getScore()).isNull();

        // But partStats.score preserves the authoritative persisted earnedScore (3.00)
        ReviewPartStatsDto stats = response.getPartStats();
        assertThat(stats.getTotalQuestions()).isEqualTo(2);
        assertThat(stats.getCorrectCount()).isEqualTo(2);
        assertThat(stats.getScore()).isEqualByComparingTo("3.00");
    }

    @Test
    void extractReviewParts_fullExamSnapshot_preservesOrderAndLabels() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Reading",
                                "parts", List.of(
                                        Map.of("id", 1, "title", "Reading Passage 1"),
                                        Map.of("id", 2, "title", "Reading Passage 2")
                                )
                        ),
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of("id", 3, "title", "Writing Task 1")
                                )
                        )
                )
        );

        List<ReviewPartNavigationDto> reviewParts = mapper.extractReviewParts(snapshot);

        assertThat(reviewParts).hasSize(3);
        assertThat(reviewParts.get(0).getId()).isEqualTo(1);
        assertThat(reviewParts.get(0).getLabel()).isEqualTo("Reading Passage 1");
        assertThat(reviewParts.get(1).getId()).isEqualTo(2);
        assertThat(reviewParts.get(1).getLabel()).isEqualTo("Reading Passage 2");
        assertThat(reviewParts.get(2).getId()).isEqualTo(3);
        assertThat(reviewParts.get(2).getLabel()).isEqualTo("Writing Task 1");
    }

    @Test
    void extractReviewParts_writingOnlySnapshot_extractsWritingPart() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "name", "Writing",
                                "parts", List.of(
                                        Map.of("id", 10, "part_title", "Writing Task 2 Essay")
                                )
                        )
                )
        );

        List<ReviewPartNavigationDto> reviewParts = mapper.extractReviewParts(snapshot);

        assertThat(reviewParts).hasSize(1);
        assertThat(reviewParts.get(0).getId()).isEqualTo(10);
        assertThat(reviewParts.get(0).getLabel()).isEqualTo("Writing Task 2 Essay");
    }

    @Test
    void extractReviewParts_nullOrEmptySnapshot_returnsEmptyList() {
        assertThat(mapper.extractReviewParts(null)).isEmpty();
        assertThat(mapper.extractReviewParts(Map.of())).isEmpty();
        assertThat(mapper.extractReviewParts(Map.of("sections", List.of()))).isEmpty();
    }

    @Test
    void extractReviewParts_duplicatePartIds_deduplicatesPreservingFirst() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("id", 1, "title", "First Part 1"),
                                        Map.of("id", 1, "title", "Duplicate Part 1"),
                                        Map.of("id", 2, "title", "Part 2")
                                )
                        )
                )
        );

        List<ReviewPartNavigationDto> reviewParts = mapper.extractReviewParts(snapshot);

        assertThat(reviewParts).hasSize(2);
        assertThat(reviewParts.get(0).getId()).isEqualTo(1);
        assertThat(reviewParts.get(0).getLabel()).isEqualTo("First Part 1");
        assertThat(reviewParts.get(1).getId()).isEqualTo(2);
        assertThat(reviewParts.get(1).getLabel()).isEqualTo("Part 2");
    }

    @Test
    void extractReviewParts_nestedObjectTitle_fallsBackToDefaultPartLabel() {
        Map<String, Object> snapshot = Map.of(
                "sections", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("id", 1, "title", Map.of("secret_key", "SECRET_ANSWER_KEY_HTTP")),
                                        Map.of("id", 2, "part_title", List.of("malicious_item"))
                                )
                        )
                )
        );

        List<ReviewPartNavigationDto> reviewParts = mapper.extractReviewParts(snapshot);

        assertThat(reviewParts).hasSize(2);
        assertThat(reviewParts.get(0).getId()).isEqualTo(1);
        assertThat(reviewParts.get(0).getLabel()).isEqualTo("Part 1");
        assertThat(reviewParts.get(1).getId()).isEqualTo(2);
        assertThat(reviewParts.get(1).getLabel()).isEqualTo("Part 2");
    }
}
