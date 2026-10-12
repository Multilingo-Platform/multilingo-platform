package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.modules.vocab.service.quiz.QuizScorer;
import com.multilingo.backend.modules.vocab.service.quiz.QuizScoringResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("QuizScorer Unit Tests - Task 3 (TDD)")
class QuizScorerTest {

    private QuizScorer scorer;

    @BeforeEach
    void setUp() {
        scorer = new QuizScorer();
    }

    @Test
    @DisplayName("TC_SCORE_01: Tính điểm tuyệt đối 10/10, streak >= 5 -> Đủ điểm thưởng Accuracy và Streak")
    void testPerfectScore() {
        // 10 câu đúng liên tiếp
        List<Boolean> answers = List.of(true, true, true, true, true, true, true, true, true, true);
        QuizScoringResult result = scorer.calculate(answers);

        assertThat(result.getTotalQuestions()).isEqualTo(10);
        assertThat(result.getCorrectAnswers()).isEqualTo(10);
        assertThat(result.getAccuracyPercent()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(result.getMaxCorrectStreak()).isEqualTo(10);
        assertThat(result.getBaseXp()).isEqualTo(10);
        assertThat(result.getTotalXp()).isEqualTo(10);
    }

    @Test
    @DisplayName("TC_SCORE_02: Điểm trung bình 5/10 -> Flat +10 XP cho bài hoàn thành")
    void testPartialScore() {
        // Đúng 3, sai 1, đúng 2, sai 4 -> max streak = 3
        List<Boolean> answers = List.of(true, true, true, false, true, true, false, false, false, false);
        QuizScoringResult result = scorer.calculate(answers);

        assertThat(result.getTotalQuestions()).isEqualTo(10);
        assertThat(result.getCorrectAnswers()).isEqualTo(5);
        assertThat(result.getAccuracyPercent()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(result.getMaxCorrectStreak()).isEqualTo(3);
        assertThat(result.getBaseXp()).isEqualTo(10);
        assertThat(result.getTotalXp()).isEqualTo(10);
    }

    @Test
    @DisplayName("TC_SCORE_03: Làm sai toàn bộ 0/5 câu -> Vẫn nhận cố định +10 XP vì đã hoàn thành phiên")
    void testZeroScore() {
        List<Boolean> answers = List.of(false, false, false, false, false);
        QuizScoringResult result = scorer.calculate(answers);

        assertThat(result.getTotalQuestions()).isEqualTo(5);
        assertThat(result.getCorrectAnswers()).isEqualTo(0);
        assertThat(result.getAccuracyPercent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getMaxCorrectStreak()).isEqualTo(0);
        assertThat(result.getBaseXp()).isEqualTo(10);
        assertThat(result.getTotalXp()).isEqualTo(10);
    }
}

