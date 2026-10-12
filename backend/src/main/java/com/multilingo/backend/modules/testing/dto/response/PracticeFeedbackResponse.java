package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)
public class PracticeFeedbackResponse {
    private Integer attemptId;
    private Integer partId;
    private String questionId;
    private String type;
    private Object userAnswer;
    private GradingVerdict verdict;
    private BigDecimal score;
    private Object correctAnswer;
    private String explanation;
}
