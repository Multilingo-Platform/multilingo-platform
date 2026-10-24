package com.multilingo.backend.modules.testing.ai.grading;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Immutable model representing the validated AI grading output for an English writing task.
 * Sensitive text fields are excluded from {@link #toString()} to prevent leaking learner submissions.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WritingGrade(
        @JsonProperty("rubricCode") String rubricCode,
        @JsonProperty("feedbackLanguage") String feedbackLanguage,
        @JsonProperty("overallScore") BigDecimal overallScore,
        @JsonProperty("criteria") List<CriterionGrade> criteria,
        @JsonProperty("overallFeedback") String overallFeedback,
        @JsonProperty("correctedEssay") String correctedEssay,
        @JsonProperty("corrections") List<Correction> corrections,
        @JsonProperty("diff") List<DiffSegment> diff,
        @JsonProperty("visualObservations") String visualObservations,
        @JsonProperty("imageDigests") List<String> imageDigests
) {
    public static final String RUBRIC_V1 = "WRITING_EN_V1";
    public static final String RUBRIC_V2 = "WRITING_EN_V2";
    public static final String DEFAULT_RUBRIC = RUBRIC_V1;
    public static final String DEFAULT_LANGUAGE = "vi";

    public record CriterionGrade(
            @JsonProperty("code") String code,
            @JsonProperty("score") BigDecimal score,
            @JsonProperty("feedback") String feedback
    ) {
        @Override
        public String toString() {
            return "CriterionGrade[code=" + code + ", score=" + score + "]";
        }
    }

    public record Correction(
            @JsonProperty("start") int start,
            @JsonProperty("end") int end,
            @JsonProperty("replacement") String replacement,
            @JsonProperty("explanation") String explanation
    ) {
        @Override
        public String toString() {
            return "Correction[start=" + start + ", end=" + end + "]";
        }
    }

    public enum DiffType {
        EQUAL,
        DELETE,
        INSERT
    }

    public record DiffSegment(
            @JsonProperty("type") DiffType type,
            @JsonProperty("text") String text
    ) {
        @Override
        public String toString() {
            return "DiffSegment[type=" + type + ", len=" + (text != null ? text.length() : 0) + "]";
        }
    }

    public WritingGrade(
            String rubricCode,
            String feedbackLanguage,
            BigDecimal overallScore,
            List<CriterionGrade> criteria,
            String overallFeedback,
            String correctedEssay,
            List<Correction> corrections,
            List<DiffSegment> diff
    ) {
        this(rubricCode, feedbackLanguage, overallScore, criteria, overallFeedback, correctedEssay, corrections, diff, null, List.of());
    }

    public WritingGrade {
        criteria = (criteria == null) ? List.of() : List.copyOf(criteria);
        corrections = (corrections == null) ? List.of() : List.copyOf(corrections);
        diff = (diff == null) ? List.of() : List.copyOf(diff);
        imageDigests = (imageDigests == null) ? List.of() : List.copyOf(imageDigests);
    }

    public WritingGrade withImageDigests(List<String> digests) {
        return new WritingGrade(
                rubricCode,
                feedbackLanguage,
                overallScore,
                criteria,
                overallFeedback,
                correctedEssay,
                corrections,
                diff,
                visualObservations,
                digests
        );
    }

    /**
     * Factory for short essays (<= 10 words) receiving an automatic 0.0 score without calling provider or quota.
     */
    public static WritingGrade tooShort(String originalEssay) {
        return tooShort(originalEssay, DEFAULT_LANGUAGE);
    }

    public static WritingGrade tooShort(String originalEssay, String feedbackLanguage) {
        String safeEssay = (originalEssay == null) ? "" : originalEssay;
        String canonicalLanguage = feedbackLanguage == null ? "vi" : feedbackLanguage.split("[-_]", 2)[0].toLowerCase(java.util.Locale.ROOT);
        String prefix = switch (canonicalLanguage) {
            case "en" -> "The essay is too short to evaluate this criterion.";
            case "ko" -> "에세이가 너무 짧아 이 기준을 평가하기 어렵습니다.";
            case "zh" -> "文章太短，无法根据此项标准进行评估。";
            case "ja" -> "文章が短すぎるため、この基準を評価できません。";
            case "fr" -> "Le texte est trop court pour évaluer ce critère.";
            case "de" -> "Der Text ist zu kurz, um dieses Kriterium zu bewerten.";
            case "es" -> "El texto es demasiado corto para evaluar este criterio.";
            default -> "Bài viết quá ngắn để đánh giá tiêu chí này.";
        };
        String overall = switch (canonicalLanguage) {
            case "en" -> "The essay is too short to grade reliably (10 words or fewer).";
            case "ko" -> "에세이가 너무 짧아 신뢰성 있게 평가할 수 없습니다(10단어 이하).";
            case "zh" -> "文章太短，无法可靠评分（不超过10个词）。";
            case "ja" -> "文章が短すぎるため、信頼できる採点ができません（10語以下）。";
            case "fr" -> "Le texte est trop court pour être évalué de façon fiable (10 mots ou moins).";
            case "de" -> "Der Text ist zu kurz für eine zuverlässige Bewertung (höchstens 10 Wörter).";
            case "es" -> "El texto es demasiado corto para una evaluación fiable (10 palabras o menos).";
            default -> "Bài viết của bạn quá ngắn (không quá 10 từ), chưa đủ nội dung để chấm đáng tin cậy.";
        };
        List<CriterionGrade> zeroCriteria = List.of(
                new CriterionGrade("TR", BigDecimal.ZERO, prefix),
                new CriterionGrade("CC", BigDecimal.ZERO, prefix),
                new CriterionGrade("LR", BigDecimal.ZERO, prefix),
                new CriterionGrade("GRA", BigDecimal.ZERO, prefix)
        );
        List<DiffSegment> equalDiff = safeEssay.isEmpty()
                ? List.of()
                : List.of(new DiffSegment(DiffType.EQUAL, safeEssay));

        return new WritingGrade(
                DEFAULT_RUBRIC,
                feedbackLanguage == null ? DEFAULT_LANGUAGE : feedbackLanguage,
                BigDecimal.ZERO,
                zeroCriteria,
                overall,
                safeEssay,
                List.of(),
                equalDiff,
                null,
                List.of()
        );
    }

    public static WritingGrade emptyEssay(String originalEssay, WritingRubricPolicy policy, String feedbackLanguage) {
        String safeEssay = originalEssay == null ? "" : originalEssay;
        List<CriterionGrade> emptyCriteria = List.of(
                new CriterionGrade("TR", BigDecimal.ZERO, ""),
                new CriterionGrade("CC", BigDecimal.ZERO, ""),
                new CriterionGrade("LR", BigDecimal.ZERO, ""),
                new CriterionGrade("GRA", BigDecimal.ZERO, "")
        );
        return new WritingGrade(policy.rubricCode(), feedbackLanguage, BigDecimal.ZERO, emptyCriteria,
                "", safeEssay, List.of(), safeEssay.isEmpty() ? List.of() : List.of(new DiffSegment(DiffType.EQUAL, safeEssay)), null, List.of());
    }

    @Override
    public String toString() {
        return "WritingGrade[rubricCode=" + rubricCode
                + ", overallScore=" + overallScore
                + ", criteriaCount=" + criteria.size()
                + ", correctionsCount=" + corrections.size()
                + ", diffSegmentsCount=" + diff.size()
                + ", hasVisualObservations=" + (visualObservations != null && !visualObservations.isBlank())
                + ", imageDigestsCount=" + imageDigests.size() + "]";
    }
}
