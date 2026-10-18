package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.ALWAYS)
public class PracticeFeedbackResponse {
    public record GroupAnswer(String questionId, Object userAnswer, GradingVerdict verdict,
            BigDecimal score, Object correctAnswer, String explanation,
            @JsonInclude(JsonInclude.Include.NON_NULL) Object listeningDetail) {
        public GroupAnswer(String questionId, Object userAnswer, GradingVerdict verdict,
                BigDecimal score, Object correctAnswer, String explanation) {
            this(questionId, userAnswer, verdict, score, correctAnswer, explanation, null);
        }
    }

    private Integer attemptId;
    private Integer partId;
    private String questionId;
    private String type;
    private Object userAnswer;
    private GradingVerdict verdict;
    private BigDecimal score;
    private Object correctAnswer;
    private String explanation;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Object listeningDetail;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<GroupAnswer> groupResults;
}
