package com.multilingo.backend.modules.vocab.service.quiz;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class QuizScoringResult {
    private final int totalQuestions;
    private final int correctAnswers;
    private final BigDecimal accuracyPercent;
    private final int maxCorrectStreak;
    private final int baseXp;
    private final int accuracyBonusXp;
    private final int streakBonusXp;
    private final int totalXp;
}
