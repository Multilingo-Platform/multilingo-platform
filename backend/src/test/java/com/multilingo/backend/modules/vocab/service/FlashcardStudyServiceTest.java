package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.constant.VocabStudyConstants;
import com.multilingo.backend.modules.vocab.dto.request.FinishStudySessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.ReviewCardRequest;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.DictionaryWord;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.impl.FlashcardStudyServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("FlashcardStudyService Unit Tests - Simplified Refactor")
class FlashcardStudyServiceTest {

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Mock
    private StudyActivityService studyActivityService;

    @org.mockito.Spy
    private com.multilingo.backend.modules.vocab.mapper.FlashcardStudyMapper flashcardStudyMapper =
            org.mapstruct.factory.Mappers.getMapper(com.multilingo.backend.modules.vocab.mapper.FlashcardStudyMapper.class);

    @InjectMocks
    private FlashcardStudyServiceImpl flashcardStudyService;

    private final Integer userId = 1;
    private final Integer otherUserId = 2;
    private final Integer deckId = 10;
    private FlashcardDeck sampleDeck;

    @BeforeEach
    void setUp() {
        sampleDeck = FlashcardDeck.builder()
                .userId(userId)
                .name("IELTS Academic Core")
                .targetLanguage("en")
                .sourceLanguage("vi")
                .build();
        sampleDeck.setId(deckId);
    }

    @Test
    @DisplayName("Khởi tạo phiên ôn tập thành công với thẻ tới hạn")
    void testGetStudySession_WithDueCards_Success() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));

        DictionaryWord dictWord = DictionaryWord.builder()
                .word("ubiquitous")
                .phonetic("/juːˈbɪk.wɪ.təs/")
                .pos("adj")
                .exampleSentence("Smartphones have become ubiquitous in daily life.")
                .build();

        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .word(dictWord)
                .customWord("ubiquitous")
                .customMeaning("phổ biến khắp nơi")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(1)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .intervalDays(1)
                .nextReviewDate(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();
        card.setId(101);

        when(userFlashcardRepository.findDueCardsForStudy(eq(deckId), eq(userId), any(Instant.class)))
                .thenReturn(List.of(card));

        StudySessionResponse response = flashcardStudyService.getStudySession(deckId, userId);

        assertNotNull(response);
        assertEquals(deckId, response.getDeckId());
        assertEquals("IELTS Academic Core", response.getDeckName());
        assertEquals(1, response.getTotalSessionCards());
        assertEquals("ubiquitous", response.getCards().get(0).getCustomWord());
        assertTrue(response.getCards().get(0).getMaskedSentence().contains(VocabStudyConstants.MASK_WORD_REPLACEMENT));
    }

    @Test
    @DisplayName("Khởi tạo phiên ôn tập tự do khi không có thẻ tới hạn")
    void testGetStudySession_NoDueCards_LoadsAllCards() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.findDueCardsForStudy(eq(deckId), eq(userId), any(Instant.class)))
                .thenReturn(Collections.emptyList());

        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("ephemeral")
                .customMeaning("ngắn ngủi, phù du")
                .status(VocabStudyConstants.STATUS_NEW)
                .reviewCount(0)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .intervalDays(0)
                .nextReviewDate(Instant.now().plus(2, ChronoUnit.DAYS))
                .build();
        card.setId(102);

        when(userFlashcardRepository.findAllForStudy(deckId, userId))
                .thenReturn(List.of(card));

        StudySessionResponse response = flashcardStudyService.getStudySession(deckId, userId);

        assertNotNull(response);
        assertEquals(1, response.getTotalSessionCards());
        assertEquals("ephemeral", response.getCards().get(0).getCustomWord());
    }

    @Test
    @DisplayName("Ném DECK_EMPTY khi bộ thẻ chưa có từ vựng nào")
    void testGetStudySession_EmptyDeck_ThrowsDeckEmptyException() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.findDueCardsForStudy(eq(deckId), eq(userId), any(Instant.class)))
                .thenReturn(Collections.emptyList());
        when(userFlashcardRepository.findAllForStudy(deckId, userId))
                .thenReturn(Collections.emptyList());

        AppException ex = assertThrows(AppException.class,
                () -> flashcardStudyService.getStudySession(deckId, userId));

        assertEquals(ErrorCode.DECK_EMPTY, ex.getErrorCode());
    }

    @Test
    @DisplayName("IDOR - Học bộ thẻ người khác bị từ chối FORBIDDEN")
    void testGetStudySession_IDOR_ThrowsForbidden() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));

        AppException ex = assertThrows(AppException.class,
                () -> flashcardStudyService.getStudySession(deckId, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    @Test
    @DisplayName("Đánh giá thẻ lần đầu REMEMBERED -> interval = 1, reviewCount = 1, status = LEARNING")
    void testReviewCard_FirstTimeRemembered_Success() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("novel")
                .customMeaning("mới lạ, độc đáo")
                .status(VocabStudyConstants.STATUS_NEW)
                .reviewCount(0)
                .intervalDays(0)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .nextReviewDate(Instant.now())
                .build();
        card.setId(201);

        when(userFlashcardRepository.findById(201)).thenReturn(Optional.of(card));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating(VocabStudyConstants.RATING_REMEMBERED)
                .build();
        CardReviewResponse response = flashcardStudyService.reviewCard(201, userId, request);

        assertNotNull(response);
        assertEquals(201, response.getCardId());
        assertEquals(VocabStudyConstants.STATUS_LEARNING, response.getStatus());
        assertEquals(1, response.getReviewCount());
        assertEquals(1, response.getIntervalDays());
        assertTrue(response.getNextReviewDate().isAfter(Instant.now()));
    }

    @Test
    @DisplayName("Đánh giá thẻ lần 2 REMEMBERED -> interval = 3, reviewCount = 2, status = LEARNING")
    void testReviewCard_SecondTimeRemembered_Success() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("pragmatic")
                .customMeaning("thực dụng")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(1)
                .intervalDays(1)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .nextReviewDate(Instant.now())
                .build();
        card.setId(202);

        when(userFlashcardRepository.findById(202)).thenReturn(Optional.of(card));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating(VocabStudyConstants.RATING_REMEMBERED)
                .build();
        CardReviewResponse response = flashcardStudyService.reviewCard(202, userId, request);

        assertNotNull(response);
        assertEquals(2, response.getReviewCount());
        assertEquals(3, response.getIntervalDays());
        assertEquals(VocabStudyConstants.STATUS_LEARNING, response.getStatus());
    }

    @Test
    @DisplayName("Đánh giá REMEMBERED lần 3 trở lên -> interval = 7, chuyển sang MASTERED")
    void testReviewCard_MasteredTransition_WhenCountReaches3() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("serendipity")
                .customMeaning("sự may mắn tình cờ")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(2)
                .intervalDays(3)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .nextReviewDate(Instant.now())
                .build();
        card.setId(203);

        when(userFlashcardRepository.findById(203)).thenReturn(Optional.of(card));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating(VocabStudyConstants.RATING_REMEMBERED)
                .build();
        CardReviewResponse response = flashcardStudyService.reviewCard(203, userId, request);

        assertNotNull(response);
        assertEquals(3, response.getReviewCount());
        assertEquals(7, response.getIntervalDays());
        assertEquals(VocabStudyConstants.STATUS_MASTERED, response.getStatus());
    }

    @Test
    @DisplayName("Đánh giá FORGOTTEN -> reset reviewCount = 0, interval = 1, status = LEARNING")
    void testReviewCard_Forgotten_ResetsCountAndInterval() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("ephemeral")
                .customMeaning("phù du")
                .status(VocabStudyConstants.STATUS_MASTERED)
                .reviewCount(5)
                .intervalDays(7)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .nextReviewDate(Instant.now())
                .build();
        card.setId(204);

        when(userFlashcardRepository.findById(204)).thenReturn(Optional.of(card));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating(VocabStudyConstants.RATING_FORGOTTEN)
                .build();
        CardReviewResponse response = flashcardStudyService.reviewCard(204, userId, request);

        assertNotNull(response);
        assertEquals(0, response.getReviewCount());
        assertEquals(1, response.getIntervalDays());
        assertEquals(VocabStudyConstants.STATUS_LEARNING, response.getStatus());
    }

    @Test
    @DisplayName("Ném INVALID_SRS_RATING khi rating không hợp lệ")
    void testReviewCard_InvalidRating_ThrowsException() {
        ReviewCardRequest request = ReviewCardRequest.builder().rating("UNKNOWN_RATING").build();

        AppException ex = assertThrows(AppException.class,
                () -> flashcardStudyService.reviewCard(201, userId, request));

        assertEquals(ErrorCode.INVALID_SRS_RATING, ex.getErrorCode());
    }

    @Test
    @DisplayName("Hoàn tất phiên học thành công: Cứ học xong là cộng cố định 10 XP và lưu DB")
    void testFinishSession_Fixed10Xp_SavedViaStudyActivityService() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
                deckId, userId, VocabStudyConstants.STATUS_MASTERED)).thenReturn(5L);

        StudyActivitySummary mockSummary = StudyActivitySummary.builder()
                .currentStreak(4)
                .streakIncrement(1)
                .build();
        when(studyActivityService.recordActivity(any(StudyActivityRecord.class))).thenReturn(mockSummary);

        FinishStudySessionRequest request = FinishStudySessionRequest.builder()
                .cardsReviewed(10)
                .cardsRemembered(8)
                .cardsForgotten(2)
                .durationSeconds(120)
                .build();

        StudySessionSummaryResponse summary = flashcardStudyService.finishSession(deckId, userId, request);

        assertNotNull(summary);
        // Nghiệp vụ mới: Cố định 10 XP
        assertEquals(10, summary.getEarnedXp());
        assertEquals(4, summary.getCurrentStreak());
        assertEquals(5, summary.getTotalMasteredCards());
        assertEquals(10, summary.getCardsReviewed());

        // Kiểm tra gọi StudyActivityService với 10 XP
        ArgumentCaptor<StudyActivityRecord> recordCaptor = ArgumentCaptor.forClass(StudyActivityRecord.class);
        verify(studyActivityService).recordActivity(recordCaptor.capture());
        StudyActivityRecord savedRecord = recordCaptor.getValue();
        assertEquals(10, savedRecord.getXpEarned());
        assertEquals(10, savedRecord.getCardsReviewed());
        assertEquals("FLASHCARD_STUDY", savedRecord.getActivityType());
    }
}
