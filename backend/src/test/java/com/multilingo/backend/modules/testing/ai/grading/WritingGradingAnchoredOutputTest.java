package com.multilingo.backend.modules.testing.ai.grading;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.ai.gemini.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class WritingGradingAnchoredOutputTest {
    private final ObjectMapper mapper = new ObjectMapper();

    private String response(List<Map<String, Object>> edits) throws Exception {
        return mapper.writeValueAsString(Map.of("feedbackLanguage", "vi", "criteria", List.of(
                Map.of("code", "TR", "score", 6.5, "feedback", "Task"),
                Map.of("code", "CC", "score", 6.5, "feedback", "Coherence"),
                Map.of("code", "LR", "score", 6.5, "feedback", "Vocabulary"),
                Map.of("code", "GRA", "score", 6.5, "feedback", "Grammar")),
                "overallFeedback", "Feedback", "corrections", edits));
    }

    private WritingGrade generate(String essay, String output) {
        GeminiClient client = mock(GeminiClient.class);
        when(client.generate(any())).thenReturn(new GeminiGenerationResult(output, null));
        return new WritingGradingGenerator(client, new WritingGradingPromptFactory(), new WritingGradingOutputParser())
                .generate(new WritingGradingContext(19, "w_001", "en", "Discuss education.", essay, 20, List.of()));
    }

    @Test
    void serverBuildsOffsetsAndCorrectedEssayFromExactAnchors() throws Exception {
        String essay = "🌱\r\nLearning language is good for career and opens many chance.";
        String output = response(List.of(
                Map.of("original", "career", "replacement", "one's career", "explanation", "Possessive"),
                Map.of("original", "Learning language", "replacement", "Learning a language", "explanation", "Article"),
                Map.of("original", "chance.", "replacement", "opportunities.", "explanation", "Plural")));
        WritingGrade grade = generate(essay, output);
        assertThat(grade.correctedEssay()).isEqualTo("🌱\r\nLearning a language is good for one's career and opens many opportunities.");
        assertThat(grade.corrections().getFirst().start()).isEqualTo(4);
        assertThat(WritingDiffBuilder.joinWithoutInsert(grade.diff())).isEqualTo(essay);
        assertThat(WritingDiffBuilder.joinWithoutDelete(grade.diff())).isEqualTo(grade.correctedEssay());
        assertThat(grade.overallScore()).isEqualByComparingTo("6.5");
    }

    @Test
    void anEssayWithNoEditsStaysByteForByteUnchanged() throws Exception {
        String essay = "  This essay has enough words to pass the short essay cutoff without any changes.\r\n";
        assertThat(generate(essay, response(List.of())).correctedEssay()).isEqualTo(essay);
    }

    @Test
    void missingAmbiguousAndOverlappingAnchorsFailClosed() throws Exception {
        String essay = "The first sentence is here. The second sentence is here and contains more words.";
        for (List<Map<String, Object>> edits : List.of(
                List.of(Map.<String, Object>of("original", "not present", "replacement", "x", "explanation", "x")),
                List.of(Map.<String, Object>of("original", "sentence", "replacement", "x", "explanation", "x")),
                List.of(Map.<String, Object>of("original", "The first sentence", "replacement", "x", "explanation", "x"),
                        Map.<String, Object>of("original", "first sentence", "replacement", "y", "explanation", "y")))) {
            String output = response(edits);
            assertThatThrownBy(() -> generate(essay, output)).isInstanceOf(WritingGradingException.class)
                    .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().validationCode())
                            .isEqualTo(WritingGradingFailure.ValidationCode.CORRECTIONS_INVALID));
        }
    }

    @Test
    void generatedContractRejectsProviderOffsetsAndIndependentCorrectedEssay() throws Exception {
        String essay = "This is a sufficiently long essay with more than ten words for grading.";
        String output = response(List.of());
        String withIndependentEssay = output.replace("\"corrections\":[]", "\"corrections\":[],\"correctedEssay\":\"different\"");
        assertThatThrownBy(() -> generate(essay, withIndependentEssay)).isInstanceOf(WritingGradingException.class);
        String withOffsets = response(List.of(Map.of("original", "essay", "start", 28, "end", 33,
                "replacement", "text", "explanation", "x")));
        assertThatThrownBy(() -> generate(essay, withOffsets)).isInstanceOf(WritingGradingException.class);
    }

    @Test
    void generatedOutputStillEnforcesScoreAndTextLimits() throws Exception {
        String essay = "This is a sufficiently long essay with more than ten words for grading.";
        String badScore = response(List.of()).replace("6.5", "6.25");
        assertThatThrownBy(() -> generate(essay, badScore)).isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().validationCode())
                        .isEqualTo(WritingGradingFailure.ValidationCode.SCORE_INVALID));
        String oversized = response(List.of(Map.of("original", "essay", "replacement", "x".repeat(2001), "explanation", "x")));
        assertThatThrownBy(() -> generate(essay, oversized)).isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().validationCode())
                        .isEqualTo(WritingGradingFailure.ValidationCode.LIMIT_EXCEEDED));
    }

    @Test
    void duplicateJsonKeysAndPartialSurrogateAnchorsRemainInvalid() throws Exception {
        String essay = "🌱 This is a sufficiently long essay with more than ten words for grading.";
        String duplicate = response(List.of()).replace("\"feedbackLanguage\":\"vi\"", "\"feedbackLanguage\":\"vi\",\"feedbackLanguage\":\"vi\"");
        assertThatThrownBy(() -> generate(essay, duplicate)).isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().validationCode())
                        .isEqualTo(WritingGradingFailure.ValidationCode.JSON_INVALID));
        String splitSurrogate = response(List.of(Map.of("original", essay.substring(0, 1), "replacement", "plant", "explanation", "x")));
        assertThatThrownBy(() -> generate(essay, splitSurrogate)).isInstanceOf(WritingGradingException.class)
                .satisfies(ex -> assertThat(((WritingGradingException) ex).getFailure().validationCode())
                        .isEqualTo(WritingGradingFailure.ValidationCode.CORRECTIONS_INVALID));
    }
}
