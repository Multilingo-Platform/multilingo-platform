package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("QuizQuestionGenerator Unit Tests - Practice Snapshot")
class QuizQuestionGeneratorTest {

    private QuizQuestionGenerator generator;
    private List<UserFlashcard> dummyCards;

    @BeforeEach
    void setUp() {
        generator = new QuizQuestionGenerator();

        dummyCards = new ArrayList<>();
        String[] words = {"apple", "banana", "cherry", "date", "elderberry", "fig"};
        String[] meanings = {"quả táo", "quả chuối", "quả anh đào", "quả chà là", "quả cơm cháy", "quả sung"};
        String[] statuses = {"NEW", "NEW", "LEARNING", "LEARNING", "MASTERED", "MASTERED"};

        for (int i = 0; i < words.length; i++) {
            UserFlashcard c = UserFlashcard.builder()
                    .userId(1)
                    .customWord(words[i])
                    .customMeaning(meanings[i])
                    .status(statuses[i])
                    .nextReviewDate(Instant.now().minus(i % 2 == 0 ? 1 : -1, ChronoUnit.DAYS))
                    .build();
            c.setId(100 + i);
            dummyCards.add(c);
        }
    }

    @Test
    @DisplayName("TC_GEN_01: Ném QUIZ_INSUFFICIENT_CONTENT nếu số thẻ hợp lệ dưới 4")
    void testInsufficientCards_throwsException() {
        List<UserFlashcard> fewCards = dummyCards.subList(0, 3);
        assertThatThrownBy(() -> generator.generatePracticeQuestions(fewCards, "ALL", 10, new Random(42)))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
    }

    @Test
    @DisplayName("TC_GEN_02: Sinh đủ 4 phương án cho mỗi câu và có correctOptionId chính xác")
    void testGeneratePracticeQuestions_success() {
        List<PracticeQuestionSnapshotDto> questions = generator.generatePracticeQuestions(dummyCards, "ALL", 5, new Random(42));

        assertThat(questions).hasSize(5);
        for (PracticeQuestionSnapshotDto q : questions) {
            assertThat(q.getOptions()).hasSize(4);
            assertThat(q.getCorrectOptionId()).isNotNull();
            boolean correctFound = q.getOptions().stream()
                    .anyMatch(opt -> opt.getOptionId().equalsIgnoreCase(q.getCorrectOptionId()));
            assertThat(correctFound).isTrue();
        }
    }

    @Test
    @DisplayName("TC_GEN_03: Lọc theo status='NEW' khi không đủ 4 thẻ -> Ném QUIZ_INSUFFICIENT_CONTENT")
    void testFilterStatus_insufficientFiltered() {
        assertThatThrownBy(() -> generator.generatePracticeQuestions(dummyCards, "NEW", 10, new Random(42)))
                .isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
    }
}
