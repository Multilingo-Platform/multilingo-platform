package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingResultCodec;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingOutputParser;
import com.multilingo.backend.modules.testing.ai.grading.WritingRubricPolicy;
import com.multilingo.backend.modules.testing.dto.response.WritingFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WritingFeedbackMultilingualMapperTest {
    @ParameterizedTest
    @CsvSource({"ja, 猫が好きです。, 6", "zh, 我喜欢猫。, 4"})
    void keepsGenericVisualFeedbackForCjkEssaysWithOneLegacyWord(String language, String essay, int characters) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        WritingRubricPolicy policy = new WritingRubricPolicy("TV3_WRITING_POLICY_V1", "WRITING_GENERIC_V1",
                "PRACTICE_0_10", BigDecimal.TEN, new BigDecimal("0.5"), language,
                List.of("TR", "CC", "LR", "GRA"), "writing-grading-generic-v1");
        String observations = "Một con mèo trong ảnh.";
        String output = mapper.writeValueAsString(Map.of("feedbackLanguage", "vi", "visualObservations", observations,
                "criteria", List.of("TR", "CC", "LR", "GRA").stream()
                        .map(code -> Map.of("code", code, "score", 10, "feedback", "Diễn đạt rõ ràng.")).toList(),
                "overallFeedback", "Bài viết tốt.", "correctedEssay", essay, "corrections", List.of()));
        WritingGrade grade = new WritingGradingOutputParser().parse(output, essay, true, policy, "vi");
        @SuppressWarnings("unchecked") Map<String, Object> gradeMap = mapper.convertValue(grade, Map.class);
        Map<String, Object> result = new WritingGradingResultCodec().encode(gradeMap, policy, "vi",
                new WritingLengthCounter().count(essay, language));
        Map<String, Object> snapshot = Map.of("examLanguage", language, "sections", List.of(Map.of("name", "Writing",
                "parts", List.of(Map.of("id", 77, "title", "Writing", "questions", List.of(Map.of(
                        "id", "essay-cjk", "type", "ESSAY", "title", "作文")))))));
        TestAttempt attempt = TestAttempt.builder().status(AttemptStatus.COMPLETED).examSnapshot(snapshot).build();
        attempt.setId(709);
        AttemptAnswer answer = AttemptAnswer.builder().partId(77).userAnswers(Map.of("essay-cjk", essay)).build();
        WritingGradingJob job = WritingGradingJob.builder().attemptId(709).partId(77).questionId("essay-cjk")
                .status(WritingGradingJobStatus.SUCCEEDED).resultJson(result)
                .contextJson(Map.of("images", List.of(Map.of("url", "https://example.test/frozen-cat.png")))).build();

        WritingFeedbackResponse feedback = new WritingFeedbackMapper(mapper).mapFeedback(attempt, 77,
                AttemptResultScope.read(snapshot).getFirst(), answer, List.of(job));

        assertThat(feedback.partStatus()).isEqualTo("DONE");
        var task = feedback.tasks().getFirst();
        assertThat(task.status()).isEqualTo("DONE");
        assertThat(task.reasonCode()).isNull();
        assertThat(task.wordCount()).isEqualTo(1);
        assertThat(task.lengthMetric().value()).isEqualTo(characters);
        assertThat(task.lengthMetric().unit().name()).isEqualTo("CHARACTERS");
        assertThat(task.overall()).isEqualByComparingTo("10");
        assertThat(task.scoreUnit()).isEqualTo("PRACTICE_0_10");
        assertThat(task.rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        assertThat(task.feedbackLanguage()).isEqualTo("vi");
        assertThat(task.hasVisualContext()).isTrue();
        assertThat(task.visualObservations()).isEqualTo(observations);
        assertThat(task.originalText()).isEqualTo(essay);
        assertThat(task.correctedEssay()).isEqualTo(essay);
    }

    @Test
    void onlyShowsEmptyEssaySystemResultForAnActuallyEmptySubmission() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        WritingRubricPolicy policy = new WritingRubricPolicy("TV3_WRITING_POLICY_V1", "WRITING_GENERIC_V1",
                "PRACTICE_0_10", BigDecimal.TEN, new BigDecimal("0.5"), "ja",
                List.of("TR", "CC", "LR", "GRA"), "writing-grading-generic-v1");
        String whitespaceEssay = "\u3000\u00a0";
        WritingGrade empty = WritingGrade.emptyEssay(whitespaceEssay, policy, "vi");
        @SuppressWarnings("unchecked") Map<String, Object> grade = objectMapper.convertValue(empty, Map.class);
        Map<String, Object> result = new java.util.LinkedHashMap<>(new WritingGradingResultCodec().encode(
                grade, policy, "vi", new WritingLengthCounter().count(whitespaceEssay, "ja")));
        result.put("status", "SYSTEM"); result.put("reasonCode", "EMPTY_ESSAY"); result.put("score", 0);

        assertThat(mapResult(objectMapper, whitespaceEssay, result).status()).isEqualTo("DONE");
        assertThat(mapResult(objectMapper, "猫が好きです。", result).status()).isEqualTo("FAILED");
    }

    @Test
    void mapsGenericVersionedResultWithoutEnglishShortEssayRule() throws Exception {
        String essay = "猫が好きです。";
        ObjectMapper objectMapper = new ObjectMapper();
        WritingGrade grade = new WritingGrade("WRITING_GENERIC_V1", "ja", BigDecimal.TEN,
                List.of("TR", "CC", "LR", "GRA").stream()
                        .map(code -> new WritingGrade.CriterionGrade(code, BigDecimal.TEN, "評価"))
                        .toList(), "よく書けています。", essay, List.of(),
                List.of(new WritingGrade.DiffSegment(WritingGrade.DiffType.EQUAL, essay)), null, List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> gradeMap = objectMapper.convertValue(grade, Map.class);
        WritingRubricPolicy policy = new WritingRubricPolicy("TV3_WRITING_POLICY_V1", "WRITING_GENERIC_V1",
                "PRACTICE_0_10", BigDecimal.TEN, new BigDecimal("0.5"), "ja",
                List.of("TR", "CC", "LR", "GRA"), "writing-grading-generic-v1");
        Map<String, Object> result = new WritingGradingResultCodec().encode(gradeMap, policy, "ja",
                new WritingLengthCounter().count(essay, "ja"));
        assertThat(new WritingGradingResultCodec().decode(result).legacy()).isFalse();
        assertThat(new WritingGradingResultCodec().decode(result).policy().rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        String output = objectMapper.writeValueAsString(Map.of("feedbackLanguage", "ja", "criteria", grade.criteria(),
                "overallFeedback", grade.overallFeedback(), "correctedEssay", essay, "corrections", List.of()));
        assertThat(new WritingGradingOutputParser().parse(output, essay, false, policy, "ja").overallScore())
                .isEqualByComparingTo("10.0");
        Map<String, Object> snapshot = Map.of("examLanguage", "ja", "sections", List.of(Map.of("name", "Writing",
                "parts", List.of(Map.of("id", 77, "title", "Writing", "questions", List.of(Map.of(
                        "id", "essay-ja", "type", "ESSAY", "title", "作文")))))));
        TestAttempt attempt = TestAttempt.builder().status(AttemptStatus.COMPLETED).examSnapshot(snapshot).build();
        attempt.setId(707);
        AttemptAnswer answer = AttemptAnswer.builder().partId(77).userAnswers(Map.of("essay-ja", essay)).build();
        WritingGradingJob job = WritingGradingJob.builder().attemptId(707).partId(77).questionId("essay-ja")
                .status(WritingGradingJobStatus.SUCCEEDED).resultJson(result).build();

        var part = AttemptResultScope.read(snapshot).getFirst();
        WritingFeedbackResponse.TaskFeedback task = new WritingFeedbackMapper(objectMapper)
                .mapFeedback(attempt, 77, part, answer, List.of(job)).tasks().getFirst();

        assertThat(task.status()).isEqualTo("DONE");
        assertThat(task.wordCount()).isEqualTo(1);
        assertThat(task.lengthMetric().unit().name()).isEqualTo("CHARACTERS");
        assertThat(task.lengthMetric().value()).isEqualTo(6);
        assertThat(task.overall()).isEqualByComparingTo("10");
        assertThat(task.scoreUnit()).isEqualTo("PRACTICE_0_10");
        assertThat(task.rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        assertThat(task.feedbackLanguage()).isEqualTo("ja");
        assertThat(task.correctedEssay()).isEqualTo(essay);
    }

    private WritingFeedbackResponse.TaskFeedback mapResult(ObjectMapper mapper, String essay, Map<String, Object> result) {
        Map<String, Object> snapshot = Map.of("examLanguage", "ja", "sections", List.of(Map.of("name", "Writing",
                "parts", List.of(Map.of("id", 77, "title", "Writing", "questions", List.of(Map.of(
                        "id", "essay-ja", "type", "ESSAY", "title", "作文")))))));
        TestAttempt attempt = TestAttempt.builder().status(AttemptStatus.COMPLETED).examSnapshot(snapshot).build();
        attempt.setId(708);
        AttemptAnswer answer = AttemptAnswer.builder().partId(77).userAnswers(Map.of("essay-ja", essay)).build();
        WritingGradingJob job = WritingGradingJob.builder().attemptId(708).partId(77).questionId("essay-ja")
                .status(WritingGradingJobStatus.SUCCEEDED).resultJson(result).build();
        var part = AttemptResultScope.read(snapshot).getFirst();
        return new WritingFeedbackMapper(mapper).mapFeedback(attempt, 77, part, answer, List.of(job)).tasks().getFirst();
    }
}
