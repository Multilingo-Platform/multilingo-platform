package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewPartStatsDto {
    private BigDecimal score;
    private Integer correctCount;
    private Integer incorrectCount;
    private Integer unansweredCount;
    private Integer totalQuestions;
    private BigDecimal accuracy;
    private Map<String, Boolean> isCorrectFlags;
}
