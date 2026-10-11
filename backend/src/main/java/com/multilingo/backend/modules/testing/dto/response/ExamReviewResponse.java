package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public class ExamReviewResponse {
    private Integer attemptId;
    private Integer partId;
    private String partTitle;
    private String skill;

    // Structured stats & answers
    private ReviewPartStatsDto partStats;
    private Map<String, Object> userAnswers;
    private List<ReviewQuestionDto> questions;
    private List<ReviewQuestionGroupDto> questionGroups;

    // Full part content & questions
    private Object examData;

    // Legacy fields for backward compatibility with frontend
    private Map<String, Object> partResult;
    private Map<String, Boolean> isCorrectFlags;
}
