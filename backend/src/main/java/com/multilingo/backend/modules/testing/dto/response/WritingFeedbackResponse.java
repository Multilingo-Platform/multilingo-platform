package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;

import java.math.BigDecimal;
import java.util.List;

/**
 * Public response DTO for Writing Feedback API (GET /api/v1/attempts/{attemptId}/writing-feedback?partId={partId}).
 * Strictly excludes internal fields such as runId, quotaId, jobId, tokens, and inputHash.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WritingFeedbackResponse(
        @JsonProperty("attemptId") Integer attemptId,
        @JsonProperty("partId") Integer partId,
        @JsonProperty("attemptStatus") String attemptStatus,
        @JsonProperty("partStatus") String partStatus,
        @JsonProperty("tasks") List<TaskFeedback> tasks
) {
    public WritingFeedbackResponse {
        tasks = (tasks == null) ? List.of() : List.copyOf(tasks);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TaskFeedback(
            @JsonProperty("questionId") String questionId,
            @JsonProperty("label") String label,
            @JsonProperty("status") String status,
            @JsonProperty("wordCount") int wordCount,
            @JsonProperty("language") String language,
            @JsonProperty("source") String source,
            @JsonProperty("scoreUnit") String scoreUnit,
            @JsonProperty("overall") BigDecimal overall,
            @JsonProperty("maxScore") BigDecimal maxScore,
            @JsonProperty("criteria") List<WritingGrade.CriterionGrade> criteria,
            @JsonProperty("originalText") String originalText,
            @JsonProperty("overallFeedback") String overallFeedback,
            @JsonProperty("correctedEssay") String correctedEssay,
            @JsonProperty("corrections") List<WritingGrade.Correction> corrections,
            @JsonProperty("diff") List<WritingGrade.DiffSegment> diff,
            @JsonProperty("reasonCode") String reasonCode,
            @JsonProperty("displayMessage") String displayMessage,
            @JsonProperty("hasVisualContext") boolean hasVisualContext,
            @JsonProperty("visualObservations") String visualObservations
    ) {
        public TaskFeedback {
            criteria = (criteria == null) ? List.of() : List.copyOf(criteria);
            corrections = (corrections == null) ? List.of() : List.copyOf(corrections);
            diff = (diff == null) ? List.of() : List.copyOf(diff);
        }

        @Override
        public String toString() {
            return "TaskFeedback[questionId=" + questionId + ", status=" + status + ", overall=" + overall + "]";
        }
    }

    @Override
    public String toString() {
        return "WritingFeedbackResponse[attemptId=" + attemptId + ", partId=" + partId
                + ", partStatus=" + partStatus + ", tasksCount=" + tasks.size() + "]";
    }
}
