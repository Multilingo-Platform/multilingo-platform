package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Collections;

/** Codec for frozen job context metadata; unversioned jobs remain on the legacy decoder. */
public final class WritingGradingContextCodec {
    public static final int CURRENT_SCHEMA_VERSION = 2;
    private static final List<String> CRITERIA = List.of("TR", "CC", "LR", "GRA");
    private final LearningLanguageCatalog languages = new LearningLanguageCatalog();

    public Map<String, Object> encode(Map<String, Object> context, WritingRubricPolicy policy,
                                      String feedbackLanguage, WritingLengthCounter.WritingLengthMetric metric) {
        if (context == null || policy == null || metric == null) throw new IllegalArgumentException("Writing grading context metadata is required");
        String canonicalFeedback = languages.findNormalized(feedbackLanguage)
                .orElseThrow(() -> new IllegalArgumentException("Writing feedback language is invalid"));
        String source = languages.findNormalized(policy.sourceLanguage())
                .orElseThrow(() -> new IllegalArgumentException("Writing source language is invalid"));
        if (!source.equals(policy.sourceLanguage()) || !metric.policyVersion().equals("TV3_LENGTH_V1") || metric.value() < 0) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        validatePolicy(policy.rubricCode(), policy.scoreUnit(), policy.maxScore(), source);
        Map<String, Object> result = new LinkedHashMap<>(context);
        result.put("schemaVersion", CURRENT_SCHEMA_VERSION);
        result.put("sourceLanguage", source);
        result.put("feedbackLanguage", canonicalFeedback);
        result.put("rubricCode", policy.rubricCode());
        result.put("scoreUnit", policy.scoreUnit());
        result.put("maxScore", policy.maxScore());
        result.put("criterionStep", policy.criterionStep());
        result.put("criterionCodes", policy.criterionCodes());
        result.put("policyVersion", policy.policyVersion());
        result.put("promptVersion", policy.promptVersion());
        result.put("lengthMetric", Map.of("value", metric.value(), "unit", metric.unit().name(), "policyVersion", metric.policyVersion()));
        return result;
    }

    public Decoded decode(Map<String, Object> context) {
        if (context == null) return new Decoded(true, Map.of(), null, null);
        Object version = context.get("schemaVersion");
        if (version == null) return new Decoded(true, Collections.unmodifiableMap(new LinkedHashMap<>(context)), null, null);
        if (!(version instanceof Number number) || new BigDecimal(number.toString()).compareTo(BigDecimal.valueOf(CURRENT_SCHEMA_VERSION)) != 0) {
            throw new IllegalArgumentException("Writing grading context version is unsupported");
        }
        String source = string(context, "sourceLanguage");
        String feedback = languages.findNormalized(string(context, "feedbackLanguage")).orElse(null);
        String rubric = string(context, "rubricCode");
        String unit = string(context, "scoreUnit");
        BigDecimal max = decimal(context.get("maxScore"));
        BigDecimal step = decimal(context.get("criterionStep"));
        String policyVersion = string(context, "policyVersion");
        String promptVersion = string(context, "promptVersion");
        Object criteria = context.get("criterionCodes");
        try {
            validatePolicy(rubric, unit, max, source);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        if (feedback == null || step == null || step.compareTo(new BigDecimal("0.5")) != 0 ||
                !"TV3_WRITING_POLICY_V1".equals(policyVersion) || promptVersion == null ||
                !(criteria instanceof List<?> list) || !CRITERIA.equals(list) ||
                !source.equals(languages.findNormalized(string(context, "learningLanguage")).orElse(null))) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        validateLengthMetric(context.get("lengthMetric"), source, context.get("originalText"));
        WritingRubricPolicy policy = new WritingRubricPolicy(policyVersion, rubric, unit, max, step, source, CRITERIA, promptVersion);
        return new Decoded(false, Collections.unmodifiableMap(new LinkedHashMap<>(context)), policy, feedback);
    }

    static void validatePolicy(String rubric, String unit, BigDecimal max, String source) {
        String expectedUnit = "WRITING_EN_V1".equals(rubric) ? "BAND_0_9" : "WRITING_GENERIC_V1".equals(rubric) ? "PRACTICE_0_10" : null;
        BigDecimal expectedMax = "BAND_0_9".equals(expectedUnit) ? new BigDecimal("9.0") : new BigDecimal("10.0");
        if (expectedUnit == null || !expectedUnit.equals(unit) || max == null || max.compareTo(expectedMax) != 0 || source == null) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        boolean sourceEnglish = "en".equalsIgnoreCase(source.split("-", 2)[0]);
        if ("WRITING_EN_V1".equals(rubric) && !sourceEnglish) throw new IllegalArgumentException("Writing grading context policy is invalid");
    }

    private static void validateLengthMetric(Object raw, String sourceLanguage, Object originalText) {
        if (!(raw instanceof Map<?, ?> metric) || !(metric.get("value") instanceof Number number)
                || !(metric.get("unit") instanceof String unit) || !"TV3_LENGTH_V1".equals(metric.get("policyVersion"))) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        int value;
        try {
            BigDecimal decimal = new BigDecimal(number.toString());
            value = decimal.intValueExact();
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        if (value < 0 || !("WORDS".equals(unit) || "CHARACTERS".equals(unit))) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
        if (!(originalText instanceof String essay)) throw new IllegalArgumentException("Writing grading context policy is invalid");
        var expected = new WritingLengthCounter().count(essay, sourceLanguage);
        if (expected.value() != value || !expected.unit().name().equals(unit)) {
            throw new IllegalArgumentException("Writing grading context policy is invalid");
        }
    }

    private static String string(Map<String, Object> map, String key) {
        return map.get(key) instanceof String value && !value.isBlank() ? value : null;
    }
    private static BigDecimal decimal(Object value) {
        try { return value instanceof Number number ? new BigDecimal(number.toString()) : null; }
        catch (NumberFormatException exception) { return null; }
    }

    public static final class Decoded {
        private final boolean legacy;
        private final Map<String, Object> context;
        private final WritingRubricPolicy policy;
        private final String feedbackLanguage;
        private Decoded(boolean legacy, Map<String, Object> context, WritingRubricPolicy policy, String feedbackLanguage) {
            this.legacy = legacy; this.context = context; this.policy = policy; this.feedbackLanguage = feedbackLanguage;
        }
        public boolean legacy() { return legacy; }
        public Map<String, Object> context() { return context; }
        public WritingRubricPolicy policy() { return policy; }
        public String feedbackLanguage() { return feedbackLanguage; }
        @Override public String toString() { return "WritingGradingContextDecoded[legacy=" + legacy + ", policy=" + (policy == null ? null : policy.rubricCode()) + "]"; }
    }
}
