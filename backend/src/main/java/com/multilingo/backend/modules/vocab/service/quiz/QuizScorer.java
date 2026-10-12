package com.multilingo.backend.modules.vocab.service.quiz;

import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class QuizScorer {

    public static final int PRACTICE_COMPLETION_XP = QuizPracticeConstants.PRACTICE_COMPLETION_XP;

    /**
     * Tính toán kết quả chấm điểm cho phiên luyện tập (cố định +10 XP cho bài hoàn thành).
     *
     * @param answerCorrectness Danh sách cờ đúng/sai của từng câu
     * @return QuizScoringResult chi tiết
     */
    public QuizScoringResult calculate(List<Boolean> answerCorrectness) {
        if (answerCorrectness == null || answerCorrectness.isEmpty()) {
            return QuizScoringResult.builder()
                    .totalQuestions(0)
                    .correctAnswers(0)
                    .accuracyPercent(BigDecimal.ZERO)
                    .maxCorrectStreak(0)
                    .baseXp(0)
                    .accuracyBonusXp(0)
                    .streakBonusXp(0)
                    .totalXp(0)
                    .build();
        }

        int totalQuestions = answerCorrectness.size();
        int correctAnswers = 0;
        int currentStreak = 0;
        int maxCorrectStreak = 0;

        for (Boolean correct : answerCorrectness) {
            if (Boolean.TRUE.equals(correct)) {
                correctAnswers++;
                currentStreak++;
                if (currentStreak > maxCorrectStreak) {
                    maxCorrectStreak = currentStreak;
                }
            } else {
                currentStreak = 0;
            }
        }

        BigDecimal accuracyPercent = totalQuestions > 0
                ? BigDecimal.valueOf(correctAnswers)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(totalQuestions), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        int totalXp = PRACTICE_COMPLETION_XP;

        return QuizScoringResult.builder()
                .totalQuestions(totalQuestions)
                .correctAnswers(correctAnswers)
                .accuracyPercent(accuracyPercent)
                .maxCorrectStreak(maxCorrectStreak)
                .baseXp(PRACTICE_COMPLETION_XP)
                .accuracyBonusXp(0)
                .streakBonusXp(0)
                .totalXp(totalXp)
                .build();
    }
}
