package com.multilingo.backend.modules.vocab.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmitPracticeResponse {
    private String sessionId;
    private Integer totalQuestions;
    private Integer correctAnswers;
    private BigDecimal accuracyPercent;
    private Integer xpEarned;
    private Integer currentStreak;
    private Boolean streakIncremented;
    private Integer timeSpentSeconds;
    private List<PracticeWrongAnswerDto> wrongAnswers;
}
