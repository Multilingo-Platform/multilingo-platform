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
        String safeEssay = (originalEssay == null) ? "" : originalEssay;
        List<CriterionGrade> zeroCriteria = List.of(
                new CriterionGrade("TR", BigDecimal.ZERO, "Bài viết quá ngắn (≤ 10 từ), không đủ nội dung để đánh giá Task Response."),
                new CriterionGrade("CC", BigDecimal.ZERO, "Bài viết quá ngắn (≤ 10 từ), không thể đánh giá tính mạch lạc và liên kết."),
                new CriterionGrade("LR", BigDecimal.ZERO, "Bài viết quá ngắn (≤ 10 từ), vốn từ vựng chưa đủ để xếp thang điểm."),
                new CriterionGrade("GRA", BigDecimal.ZERO, "Bài viết quá ngắn (≤ 10 từ), chưa đủ cấu trúc câu để đánh giá ngữ pháp.")
        );
        List<DiffSegment> equalDiff = safeEssay.isEmpty()
                ? List.of()
                : List.of(new DiffSegment(DiffType.EQUAL, safeEssay));

        return new WritingGrade(
                DEFAULT_RUBRIC,
                DEFAULT_LANGUAGE,
                BigDecimal.ZERO,
                zeroCriteria,
                "Bài viết của bạn quá ngắn (không quá 10 từ), không đủ dung lượng tối thiểu để tiến hành chấm điểm bài luận.",
                safeEssay,
                List.of(),
                equalDiff,
                null,
                List.of()
        );
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
