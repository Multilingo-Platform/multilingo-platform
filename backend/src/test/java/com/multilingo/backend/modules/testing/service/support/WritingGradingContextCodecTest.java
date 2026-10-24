package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContextCodec;
import com.multilingo.backend.modules.testing.ai.grading.WritingRubricRegistry;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WritingGradingContextCodecTest {
    private final WritingGradingContextCodec codec = new WritingGradingContextCodec();
    private final WritingRubricRegistry registry = new WritingRubricRegistry(new LearningLanguageCatalog());

    @Test
    void preservesUnversionedContextAsLegacyAndWritesFrozenV2Metadata() {
        Map<String, Object> legacy = new LinkedHashMap<>(Map.of("partId", 7, "questionId", "w1", "learningLanguage", "ja", "originalText", "水です"));
        var decodedLegacy = codec.decode(legacy);
        assertThat(decodedLegacy.legacy()).isTrue();
        assertThat(decodedLegacy.policy()).isNull();

        var length = new WritingLengthCounter().count("水です", "ja");
        Map<String, Object> encoded = codec.encode(legacy, registry.resolve("IELTS_ACADEMIC", "ja"), "fr", length);
        var decoded = codec.decode(encoded);
        assertThat(decoded.legacy()).isFalse();
        assertThat(decoded.policy().rubricCode()).isEqualTo("WRITING_GENERIC_V1");
        assertThat(decoded.feedbackLanguage()).isEqualTo("fr");
        assertThat(encoded).containsEntry("schemaVersion", 2).containsEntry("sourceLanguage", "ja");
        assertThat(encoded.get("originalText")).isEqualTo("水です");
    }

    @Test
    void rejectsUnknownVersionsAndMismatchedPolicyWithoutExposingEssay() {
        assertThatThrownBy(() -> codec.decode(Map.of("schemaVersion", 99, "originalText", "private essay")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Writing grading context version is unsupported");
        assertThatThrownBy(() -> codec.decode(Map.of("schemaVersion", new java.math.BigDecimal("2.5"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Writing grading context version is unsupported");
        Map<String, Object> malformed = new LinkedHashMap<>(Map.of("schemaVersion", 2, "originalText", "secret essay", "rubricCode", "WRITING_EN_V1", "sourceLanguage", "ja"));
        assertThatThrownBy(() -> codec.decode(malformed)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Writing grading context policy is invalid");
    }

    @Test
    void rejectsLengthMetricThatDoesNotMatchFrozenEssay() {
        Map<String, Object> context = new LinkedHashMap<>(Map.of("partId", 7, "questionId", "w1", "learningLanguage", "ja", "originalText", "水です"));
        var policy = registry.resolve("LANGUAGE_PRACTICE", "ja");
        Map<String, Object> encoded = codec.encode(context, policy, "vi", new WritingLengthCounter().count("水です", "ja"));
        encoded.put("lengthMetric", Map.of("value", 2, "unit", "CHARACTERS", "policyVersion", "TV3_LENGTH_V1"));
        assertThatThrownBy(() -> codec.decode(encoded)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Writing grading context policy is invalid");
    }
}
