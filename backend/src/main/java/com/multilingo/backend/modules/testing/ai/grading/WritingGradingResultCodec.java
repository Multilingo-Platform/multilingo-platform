package com.multilingo.backend.modules.testing.ai.grading;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import com.multilingo.backend.modules.testing.util.WritingLengthCounter;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/** Validates persisted public grading metadata without interpreting or rewriting legacy results. */
public final class WritingGradingResultCodec {
    private final LearningLanguageCatalog languages = new LearningLanguageCatalog();

    public Map<String, Object> encode(Map<String, Object> grade, WritingRubricPolicy policy, String feedbackLanguage,
                                      WritingLengthCounter.WritingLengthMetric lengthMetric) {
        if (grade == null || policy == null || lengthMetric == null) throw new IllegalArgumentException("Writing grading result is required");
        WritingGradingContextCodec.validatePolicy(policy.rubricCode(), policy.scoreUnit(), policy.maxScore(), policy.sourceLanguage());
        String feedback = languages.findNormalized(feedbackLanguage).orElseThrow(() -> new IllegalArgumentException("Writing feedback language is invalid"));
        if ((grade.get("rubricCode") instanceof String actualRubric && !actualRubric.equals(policy.rubricCode())) ||
                (grade.get("feedbackLanguage") instanceof String actualFeedback && !actualFeedback.equals(feedback))) {
            throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
        BigDecimal score = decimal(grade.get("overallScore"));
        if (score == null || score.signum() < 0 || score.compareTo(policy.maxScore()) > 0) {
            throw new IllegalArgumentException("Writing grading score is outside its rubric");
        }
        Map<String, Object> result = new LinkedHashMap<>(grade);
        result.put("schemaVersion", 2);
        result.put("rubricCode", policy.rubricCode());
        result.put("feedbackLanguage", feedback);
        result.put("scoreUnit", policy.scoreUnit());
        result.put("maxScore", policy.maxScore());
        result.put("sourceLanguage", policy.sourceLanguage());
        result.put("lengthMetric", Map.of("value", lengthMetric.value(), "unit", lengthMetric.unit().name(), "policyVersion", lengthMetric.policyVersion()));
        return result;
    }

    public Decoded decode(Map<String, Object> result) {
        if (result == null || result.get("schemaVersion") == null) return new Decoded(true, Map.of(), null);
        Object version = result.get("schemaVersion");
        if (!(version instanceof Number n) || new BigDecimal(n.toString()).compareTo(BigDecimal.valueOf(2)) != 0) throw new IllegalArgumentException("Writing grading result version is unsupported");
        String rubric = string(result, "rubricCode");
        String unit = string(result, "scoreUnit");
        String source = string(result, "sourceLanguage");
        String feedback = languages.findNormalized(string(result, "feedbackLanguage")).orElse(null);
        BigDecimal max = decimal(result.get("maxScore"));
        BigDecimal score = decimal(result.get("overallScore"));
        try { WritingGradingContextCodec.validatePolicy(rubric, unit, max, source); }
        catch (RuntimeException exception) { throw new IllegalArgumentException("Writing grading result policy is invalid"); }
        if (feedback == null || !feedback.equals(result.get("feedbackLanguage"))
                || !source.equals(languages.findNormalized(source).orElse(null))
                || score == null || score.signum() < 0 || score.compareTo(max) > 0 || !(result.get("criteria") instanceof List<?> criteria)) {
            throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
        validateLengthMetric(result.get("lengthMetric"), source, result.get("diff"));
        validateCriteria(criteria, score, max, "SYSTEM".equals(result.get("status")) && "EMPTY_ESSAY".equals(result.get("reasonCode")));
        return new Decoded(false, Collections.unmodifiableMap(new LinkedHashMap<>(result)), new WritingRubricPolicy("TV3_WRITING_POLICY_V1", rubric, unit, max,
                new BigDecimal("0.5"), source, List.of("TR", "CC", "LR", "GRA"), "persisted"));
    }

    private static void validateLengthMetric(Object raw, String sourceLanguage, Object rawDiff) {
        if (!(raw instanceof Map<?, ?> metric) || !(metric.get("value") instanceof Number value)
                || value.intValue() < 0 || new BigDecimal(value.toString()).compareTo(BigDecimal.valueOf(value.intValue())) != 0
                || !"TV3_LENGTH_V1".equals(metric.get("policyVersion")) || !(metric.get("unit") instanceof String unit)
                || !(unit.equals("WORDS") || unit.equals("CHARACTERS"))) {
            throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
        if (!(rawDiff instanceof List<?> segments)) throw new IllegalArgumentException("Writing grading result policy is invalid");
        StringBuilder original = new StringBuilder();
        for (Object rawSegment : segments) {
            if (!(rawSegment instanceof Map<?, ?> segment) || !(segment.get("type") instanceof String type)
                    || !(segment.get("text") instanceof String text)) {
                throw new IllegalArgumentException("Writing grading result policy is invalid");
            }
            if ("EQUAL".equals(type) || "DELETE".equals(type)) original.append(text);
            else if (!"INSERT".equals(type)) throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
        var expected = new WritingLengthCounter().count(original.toString(), sourceLanguage);
        if (expected.value() != value.intValue() || !expected.unit().name().equals(unit)) {
            throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
    }

    private static void validateCriteria(List<?> criteria, BigDecimal overall, BigDecimal max, boolean emptySystemResult) {
        if (criteria.isEmpty() && emptySystemResult && overall.signum() == 0) return;
        List<String> expected = List.of("TR", "CC", "LR", "GRA");
        if (criteria.size() != expected.size()) throw new IllegalArgumentException("Writing grading result policy is invalid");
        Set<String> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Object raw : criteria) {
            if (!(raw instanceof Map<?, ?> criterion) || !(criterion.get("code") instanceof String code)
                    || !(criterion.get("score") instanceof Number number) || !(criterion.get("feedback") instanceof String feedback)
                    || (feedback.isBlank() && !emptySystemResult) || !seen.add(code) || !expected.contains(code)) {
                throw new IllegalArgumentException("Writing grading result policy is invalid");
            }
            BigDecimal score;
            try { score = new BigDecimal(number.toString()); }
            catch (NumberFormatException exception) { throw new IllegalArgumentException("Writing grading result policy is invalid"); }
            if (score.signum() < 0 || score.compareTo(max) > 0 || score.remainder(new BigDecimal("0.5")).signum() != 0) {
                throw new IllegalArgumentException("Writing grading result policy is invalid");
            }
            total = total.add(score);
        }
        BigDecimal roundedOverall = total.divide(BigDecimal.valueOf(2), 4, java.math.RoundingMode.HALF_UP)
                .setScale(0, java.math.RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(2), 1, java.math.RoundingMode.UNNECESSARY);
        if (!seen.equals(new HashSet<>(expected)) || roundedOverall.compareTo(overall) != 0) {
            throw new IllegalArgumentException("Writing grading result policy is invalid");
        }
    }

    private static String string(Map<String, Object> map, String key) { return map.get(key) instanceof String value && !value.isBlank() ? value : null; }
    private static BigDecimal decimal(Object value) {
        try { return value instanceof Number number ? new BigDecimal(number.toString()) : null; }
        catch (NumberFormatException exception) { return null; }
    }
    public static final class Decoded {
        private final boolean legacy; private final Map<String, Object> result; private final WritingRubricPolicy policy;
        private Decoded(boolean legacy, Map<String, Object> result, WritingRubricPolicy policy) { this.legacy = legacy; this.result = result; this.policy = policy; }
        public boolean legacy() { return legacy; }
        public Map<String, Object> result() { return result; }
        public WritingRubricPolicy policy() { return policy; }
        @Override public String toString() { return "WritingGradingResultDecoded[legacy=" + legacy + ", rubric=" + (policy == null ? null : policy.rubricCode()) + "]"; }
    }
}
