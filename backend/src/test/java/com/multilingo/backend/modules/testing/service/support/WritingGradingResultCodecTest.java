package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingResultCodec;
import com.multilingo.backend.modules.testing.ai.grading.WritingRubricRegistry;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingGradingResultCodecTest {
    private final WritingGradingResultCodec codec = new WritingGradingResultCodec();
    private final WritingRubricRegistry registry = new WritingRubricRegistry(new LearningLanguageCatalog());

    @Test
    void preservesLegacyResultsAndAddsValidatedVersionedScoreDiscriminator() {
        assertThat(codec.decode(Map.of("overallScore", 9)).legacy()).isTrue();
        var policy = registry.resolve("NLTV", "vi");
        Map<String, Object> result = new LinkedHashMap<>(Map.of("overallScore", new BigDecimal("10.0"), "criteria", List.of(
                Map.of("code", "TR", "score", BigDecimal.TEN, "feedback", "Đáp ứng tốt"),
                Map.of("code", "CC", "score", BigDecimal.TEN, "feedback", "Bố cục tốt"),
                Map.of("code", "LR", "score", BigDecimal.TEN, "feedback", "Từ vựng tốt"),
                Map.of("code", "GRA", "score", BigDecimal.TEN, "feedback", "Ngữ pháp tốt")),
                "diff", List.of(Map.of("type", "EQUAL", "text", "Bài viết tiếng Việt"))));
        var length = new WritingLengthCounter().count("Bài viết tiếng Việt", "vi");
        Map<String, Object> encoded = codec.encode(result, policy, "vi", length);
        assertThat(codec.decode(encoded).policy()).satisfies(decoded -> {
            assertThat(decoded.rubricCode()).isEqualTo(policy.rubricCode());
            assertThat(decoded.scoreUnit()).isEqualTo(policy.scoreUnit());
            assertThat(decoded.sourceLanguage()).isEqualTo(policy.sourceLanguage());
        });
        assertThat(encoded).containsEntry("schemaVersion", 2).containsEntry("scoreUnit", "PRACTICE_0_10");
    }

    @Test
    void rejectsScoreOutsideItsRubricAndMalformedVersionedMetadata() {
        var english = registry.resolve("IELTS_ACADEMIC", "en");
        assertThatThrownBy(() -> codec.encode(Map.of("overallScore", new BigDecimal("10.0")), english, "vi",
                new WritingLengthCounter().count("long enough essay", "en")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Writing grading score is outside its rubric");
        assertThatThrownBy(() -> codec.decode(Map.of("schemaVersion", 2, "rubricCode", "WRITING_GENERIC_V1", "scoreUnit", "BAND_0_9")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Writing grading result policy is invalid");
    }

    @Test
    void rejectsFractionalVersionMissingLengthMetricAndInconsistentCriteria() {
        var policy = registry.resolve("NLTV", "vi");
        Map<String, Object> grade = new LinkedHashMap<>(Map.of("overallScore", BigDecimal.TEN, "criteria", List.of(
                Map.of("code", "TR", "score", BigDecimal.TEN, "feedback", "đủ"),
                Map.of("code", "CC", "score", BigDecimal.TEN, "feedback", "đủ"),
                Map.of("code", "LR", "score", BigDecimal.TEN, "feedback", "đủ"),
                Map.of("code", "GRA", "score", BigDecimal.TEN, "feedback", "đủ")),
                "diff", List.of(Map.of("type", "EQUAL", "text", "Bài viết"))));
        Map<String, Object> encoded = codec.encode(grade, policy, "vi", new WritingLengthCounter().count("Bài viết", "vi"));

        Map<String, Object> fractional = new LinkedHashMap<>(encoded);
        fractional.put("schemaVersion", new BigDecimal("2.5"));
        assertThatThrownBy(() -> codec.decode(fractional)).isInstanceOf(IllegalArgumentException.class);

        Map<String, Object> withoutLength = new LinkedHashMap<>(encoded);
        withoutLength.remove("lengthMetric");
        assertThatThrownBy(() -> codec.decode(withoutLength)).isInstanceOf(IllegalArgumentException.class);

        Map<String, Object> inconsistent = new LinkedHashMap<>(encoded);
        inconsistent.put("overallScore", BigDecimal.ZERO);
        assertThatThrownBy(() -> codec.decode(inconsistent)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void acceptsServerHalfStepRoundedAverage() {
        var policy = registry.resolve("LANGUAGE_PRACTICE", "ja");
        Map<String, Object> result = new LinkedHashMap<>(Map.of("overallScore", new BigDecimal("10.0"), "criteria", List.of(
                Map.of("code", "TR", "score", BigDecimal.TEN, "feedback", "評価済み"),
                Map.of("code", "CC", "score", BigDecimal.TEN, "feedback", "評価済み"),
                Map.of("code", "LR", "score", BigDecimal.TEN, "feedback", "評価済み"),
                Map.of("code", "GRA", "score", new BigDecimal("9.5"), "feedback", "評価済み")),
                "diff", List.of(Map.of("type", "EQUAL", "text", "猫です"))));
        Map<String, Object> encoded = codec.encode(result, policy, "vi", new WritingLengthCounter().count("猫です", "ja"));
        assertThat(codec.decode(encoded).legacy()).isFalse();
    }
}
