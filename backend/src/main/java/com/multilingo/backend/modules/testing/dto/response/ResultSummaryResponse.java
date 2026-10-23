package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResultSummaryResponse {

    // Legacy grading shape (preserved for backward compatibility)
    private Map<String, Map<String, QuestionResultDto>> partResults;
    private BigDecimal totalScore;
    private int correctCount;
    private int totalObjectiveCount;
    private Map<String, BigDecimal> sectionScores;

    // Structured summary
    private ObjectiveSummary objective;
    private WritingSummary writing;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuestionResultDto {
        private String questionId;
        private String verdict;
        private BigDecimal score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ObjectiveStats {
        private BigDecimal rawScore;
        private int correct;
        private int incorrect;
        private int unanswered;
        private int total;
        private BigDecimal accuracy;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ObjectiveSummary {
        private BigDecimal rawScore;
        private int correct;
        private int incorrect;
        private int unanswered;
        private int total;
        private BigDecimal accuracy;

        @Builder.Default
        @JsonProperty("scoreUnit")
        private String scoreUnit = "RAW_OBJECTIVE";

        private List<SkillObjectiveStats> bySkill;
        private List<PartObjectiveStats> byPart;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillObjectiveStats {
        private BigDecimal rawScore;
        private int correct;
        private int incorrect;
        private int unanswered;
        private int total;
        private BigDecimal accuracy;
        private String skill;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PartObjectiveStats {
        private BigDecimal rawScore;
        private int correct;
        private int incorrect;
        private int unanswered;
        private int total;
        private BigDecimal accuracy;
        private Integer partId;
        private String label;
        private String skill;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WritingSummary {
        private String status;
        private List<WritingTaskSummary> tasks;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WritingTaskSummary {
        private Integer partId;
        private String questionId;
        private String label;
        private String status;
        private int wordCount;
        @JsonProperty("lengthMetric")
        private com.multilingo.backend.modules.testing.util.WritingLengthCounter.WritingLengthMetric lengthMetric;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @JsonProperty("score")
        private BigDecimal score;

        @JsonInclude(JsonInclude.Include.ALWAYS)
        @JsonProperty("maxScore")
        private BigDecimal maxScore;
    }
}
