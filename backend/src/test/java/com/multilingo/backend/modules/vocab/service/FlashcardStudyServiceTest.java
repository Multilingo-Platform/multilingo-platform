package com.multilingo.backend.modules.vocab.service;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.gamification.entity.DailyStudyLog;
import com.multilingo.backend.modules.gamification.entity.UserStudyStat;
import com.multilingo.backend.modules.gamification.repository.DailyStudyLogRepository;
import com.multilingo.backend.modules.gamification.repository.UserStudyStatRepository;
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
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Bộ Unit Test bao phủ 12 kịch bản kiểm thử theo Ma trận 6 khía cạnh cho UC012.2 (SRS Study).
 *
 * TIÊU CHUẨN KIỂM THỬ:
 * - Mockito framework cô lập CSDL.
 * - Tuân thủ định danh mã test case chuẩn hóa TC_VOCAB_SRS_01 đến TC_VOCAB_SRS_12.
 * - Sử dụng VocabStudyConstants để loại bỏ magic numbers.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FlashcardStudyService Unit Tests - UC012.2 SRS")
class FlashcardStudyServiceTest {

    @Mock
    private FlashcardDeckRepository flashcardDeckRepository;

    @Mock
    private UserFlashcardRepository userFlashcardRepository;

    @Mock
    private DailyStudyLogRepository dailyStudyLogRepository;

    @Mock
    private UserStudyStatRepository userStudyStatRepository;

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

    /**
     * TC_VOCAB_SRS_01: Happy Path - Khởi tạo phiên ôn tập thành công khi có thẻ tới hạn.
     * Kỳ vọng: Thẻ được nạp, từ vựng đích trong câu ví dụ được che bằng "_______".
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_01: Khởi tạo phiên ôn tập thành công với thẻ tới hạn và maskedSentence")
    void testGetStudySession_WithDueCards_Success() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));

        DictionaryWord dictWord = DictionaryWord.builder()
                .word("ubiquitous")
                .phonetic("/juːˈbɪk.wɪ.təs/")
                .pos("adj")
                .build();

        UserFlashcard card1 = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .word(dictWord)
                .customWord("ubiquitous")
                .customMeaning("có mặt ở khắp nơi")
                .exampleSentence("Smartphones have become ubiquitous in daily modern life.")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(2)
                .easeFactor(VocabStudyConstants.DEFAULT_EASE_FACTOR)
                .intervalDays(VocabStudyConstants.SECOND_INTERVAL_DAYS)
                .nextReviewDate(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();
        card1.setId(101);

        when(userFlashcardRepository.findDueCardsForStudy(eq(deckId), eq(userId), any(Instant.class)))
                .thenReturn(List.of(card1));

        StudySessionResponse response = flashcardStudyService.getStudySession(deckId, userId);

        assertNotNull(response);
        assertEquals(deckId, response.getDeckId());
        assertEquals("IELTS Academic Core", response.getDeckName());
        assertEquals(1, response.getTotalSessionCards());
        assertEquals(1, response.getCards().size());

        var studyCard = response.getCards().get(0);
        assertEquals("ubiquitous", studyCard.getCustomWord());
        assertEquals("/juːˈbɪk.wɪ.təs/", studyCard.getPhonetic());
        assertEquals("adj", studyCard.getPos());
        assertEquals("có mặt ở khắp nơi", studyCard.getCustomMeaning());
        assertEquals("Smartphones have become ubiquitous in daily modern life.", studyCard.getFullSentence());
        // Kiểm tra logic che từ vựng đích bằng dấu gạch dưới
        assertEquals("Smartphones have become _______ in daily modern life.", studyCard.getMaskedSentence());
    }

    /**
     * TC_VOCAB_SRS_02: Happy Path - Tự động fallback lấy toàn bộ thẻ khi chưa có thẻ nào tới hạn.
     * Giúp học viên chủ động luyện tập lại bất cứ khi nào có nhu cầu.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_02: Tự động lấy toàn bộ thẻ khi không có thẻ nào tới hạn")
    void testGetStudySession_FallbackToAllCards_WhenNoDueCards() {
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

    /**
     * TC_VOCAB_SRS_03: Negative - Ném mã lỗi DECK_EMPTY khi bộ thẻ hoàn toàn rỗng không có từ vựng.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_03: Ném DECK_EMPTY khi bộ thẻ chưa có từ vựng nào")
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

    /**
     * TC_VOCAB_SRS_04: Security (IDOR) - Thử truy cập bộ thẻ của người dùng khác bị ném lỗi FORBIDDEN.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_04: IDOR - Học bộ thẻ người khác bị từ chối FORBIDDEN")
    void testGetStudySession_IDOR_ThrowsForbidden() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));

        // otherUserId (2) cố truy cập deck của userId (1)
        AppException ex = assertThrows(AppException.class,
                () -> flashcardStudyService.getStudySession(deckId, otherUserId));

        assertEquals(ErrorCode.FORBIDDEN, ex.getErrorCode());
    }

    /**
     * TC_VOCAB_SRS_05: Happy Path - Đánh giá thẻ lần đầu tiên thuộc (reviewCount = 0 -> 1, intervalDays = 1).
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_05: Đánh giá thẻ lần đầu REMEMBERED -> interval = 1, reviewCount = 1")
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
        assertEquals(VocabStudyConstants.INITIAL_INTERVAL_DAYS, response.getIntervalDays());
        assertEquals(VocabStudyConstants.DEFAULT_EASE_FACTOR, response.getEaseFactor());
        assertTrue(response.getNextReviewDate().isAfter(Instant.now()));
    }

    /**
     * TC_VOCAB_SRS_06: Happy Path - Đánh giá thẻ lần thứ hai thuộc (reviewCount = 1 -> 2, intervalDays = 3).
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_06: Đánh giá thẻ lần 2 REMEMBERED -> interval = 3, reviewCount = 2")
    void testReviewCard_SecondTimeRemembered_Success() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("pragmatic")
                .customMeaning("thực dụng")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(1)
                .intervalDays(VocabStudyConstants.INITIAL_INTERVAL_DAYS)
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
        assertEquals(VocabStudyConstants.SECOND_INTERVAL_DAYS, response.getIntervalDays());
        assertEquals(VocabStudyConstants.STATUS_LEARNING, response.getStatus());
    }

    /**
     * TC_VOCAB_SRS_07: Boundary - Đạt mốc thành thạo (interval >= 21) tự động chuyển sang MASTERED.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_07: Đánh giá REMEMBERED đạt interval >= 21 -> chuyển MASTERED")
    void testReviewCard_MasteredTransition_WhenIntervalAtLeast21() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("serendipity")
                .customMeaning("sự may mắn tình cờ")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(3)
                .intervalDays(10)
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
        // 10 * 2.50 = 25 >= 21 => Trạng thái MASTERED
        assertEquals(25, response.getIntervalDays());
        assertEquals(VocabStudyConstants.STATUS_MASTERED, response.getStatus());
        assertEquals(4, response.getReviewCount());
    }

    /**
     * TC_VOCAB_SRS_08: Happy Path - Đánh giá "Quên" reset interval về 1 và giảm easeFactor 0.20.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_08: Đánh giá FORGOTTEN -> interval = 1, easeFactor giảm 0.20, status = LEARNING")
    void testReviewCard_Forgotten_ResetsIntervalAndDecreasesEaseFactor() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("ephemeral")
                .customMeaning("phù du")
                .status(VocabStudyConstants.STATUS_MASTERED)
                .reviewCount(4)
                .intervalDays(14)
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
        assertEquals(VocabStudyConstants.INITIAL_INTERVAL_DAYS, response.getIntervalDays());
        assertEquals(new BigDecimal("2.30"), response.getEaseFactor());
        assertEquals(VocabStudyConstants.STATUS_LEARNING, response.getStatus());
    }

    /**
     * TC_VOCAB_SRS_09: Boundary - Sàn Ease Factor không bao giờ thấp hơn mức tối thiểu 1.30.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_09: Sàn Ease Factor tối thiểu là 1.30")
    void testReviewCard_EaseFactorFloorAt130() {
        UserFlashcard card = UserFlashcard.builder()
                .userId(userId)
                .deck(sampleDeck)
                .customWord("tenacious")
                .customMeaning("kiên trì")
                .status(VocabStudyConstants.STATUS_LEARNING)
                .reviewCount(2)
                .intervalDays(5)
                .easeFactor(new BigDecimal("1.35"))
                .nextReviewDate(Instant.now())
                .build();
        card.setId(205);

        when(userFlashcardRepository.findById(205)).thenReturn(Optional.of(card));
        when(userFlashcardRepository.save(any(UserFlashcard.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ReviewCardRequest request = ReviewCardRequest.builder()
                .rating(VocabStudyConstants.RATING_FORGOTTEN)
                .build();
        CardReviewResponse response = flashcardStudyService.reviewCard(205, userId, request);

        assertNotNull(response);
        // 1.35 - 0.20 = 1.15 < 1.30 => Bắt buộc giữ sàn 1.30
        assertEquals(VocabStudyConstants.MIN_EASE_FACTOR, response.getEaseFactor());
    }

    /**
     * TC_VOCAB_SRS_10: Negative - Gửi rating không hợp lệ ném mã lỗi INVALID_SRS_RATING.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_10: Ném INVALID_SRS_RATING khi rating không hợp lệ")
    void testReviewCard_InvalidRating_ThrowsException() {
        ReviewCardRequest request = ReviewCardRequest.builder().rating("UNKNOWN_RATING").build();

        AppException ex = assertThrows(AppException.class,
                () -> flashcardStudyService.reviewCard(201, userId, request));

        assertEquals(ErrorCode.INVALID_SRS_RATING, ex.getErrorCode());
    }

    /**
     * TC_VOCAB_SRS_11: Happy Path - Hoàn tất phiên học thành công cập nhật streak và lưu nhật ký.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_11: Hoàn tất phiên học thành công cập nhật streak và daily log")
    void testFinishSession_FirstTimeToday_IncrementsStreakAndLogs() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
                deckId, userId, VocabStudyConstants.STATUS_MASTERED)).thenReturn(5L);

        LocalDate today = LocalDate.now();
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(userId, today)).thenReturn(Optional.empty());
        when(dailyStudyLogRepository.save(any(DailyStudyLog.class))).thenAnswer(i -> i.getArgument(0));

        UserStudyStat initialStat = UserStudyStat.builder()
                .userId(userId)
                .currentStreak(3)
                .highestStreak(5)
                .lastStudyDate(today.minusDays(1))
                .build();
        when(userStudyStatRepository.findByUserId(userId)).thenReturn(Optional.of(initialStat));
        when(userStudyStatRepository.save(any(UserStudyStat.class))).thenAnswer(i -> i.getArgument(0));

        FinishStudySessionRequest request = FinishStudySessionRequest.builder()
                .cardsReviewed(10)
                .cardsRemembered(8)
                .cardsForgotten(2)
                .durationSeconds(120)
                .build();

        StudySessionSummaryResponse summary = flashcardStudyService.finishSession(deckId, userId, request);

        assertNotNull(summary);
        // XP = 10 cơ bản + 8 * 2 = 26 XP
        assertEquals(26, summary.getEarnedXp());
        assertEquals(4, summary.getCurrentStreak()); // 3 + 1 = 4
        assertEquals(5, summary.getTotalMasteredCards());
        assertEquals(10, summary.getCardsReviewed());

        // Kiểm tra daily log lưu đúng số thẻ đã ôn
        ArgumentCaptor<DailyStudyLog> logCaptor = ArgumentCaptor.forClass(DailyStudyLog.class);
        verify(dailyStudyLogRepository).save(logCaptor.capture());
        assertEquals(10, logCaptor.getValue().getFlashcardsReviewed());
    }

    /**
     * TC_VOCAB_SRS_12: Edge Case - Hoàn tất phiên học lần 2 trong cùng ngày:
     * Streak giữ nguyên không tăng lặp, số thẻ ôn tập được cộng dồn.
     */
    @Test
    @DisplayName("TC_VOCAB_SRS_12: Hoàn tất phiên học lần 2 trong cùng ngày -> streak giữ nguyên, cardsReviewed cộng dồn")
    void testFinishSession_SecondTimeToday_AccumulatesReviewedCardsWithoutDoubleStreak() {
        when(flashcardDeckRepository.findById(deckId)).thenReturn(Optional.of(sampleDeck));
        when(userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
                deckId, userId, VocabStudyConstants.STATUS_MASTERED)).thenReturn(6L);

        LocalDate today = LocalDate.now();
        DailyStudyLog existingLog = DailyStudyLog.builder()
                .userId(userId)
                .studyDate(today)
                .flashcardsReviewed(10)
                .learningMinutes(5)
                .build();
        when(dailyStudyLogRepository.findByUserIdAndStudyDate(userId, today)).thenReturn(Optional.of(existingLog));
        when(dailyStudyLogRepository.save(any(DailyStudyLog.class))).thenAnswer(i -> i.getArgument(0));

        UserStudyStat existingStat = UserStudyStat.builder()
                .userId(userId)
                .currentStreak(4)
                .highestStreak(4)
                .lastStudyDate(today) // Đã học một phiên sáng nay
                .build();
        when(userStudyStatRepository.findByUserId(userId)).thenReturn(Optional.of(existingStat));
        when(userStudyStatRepository.save(any(UserStudyStat.class))).thenAnswer(i -> i.getArgument(0));

        FinishStudySessionRequest request = FinishStudySessionRequest.builder()
                .cardsReviewed(5)
                .cardsRemembered(5)
                .cardsForgotten(0)
                .durationSeconds(60)
                .build();

        StudySessionSummaryResponse summary = flashcardStudyService.finishSession(deckId, userId, request);

        assertNotNull(summary);
        assertEquals(4, summary.getCurrentStreak()); // Giữ nguyên streak 4
        assertEquals(5, summary.getCardsReviewed());

        // Kiểm tra log cộng dồn: 10 + 5 = 15 thẻ
        ArgumentCaptor<DailyStudyLog> logCaptor = ArgumentCaptor.forClass(DailyStudyLog.class);
        verify(dailyStudyLogRepository).save(logCaptor.capture());
        assertEquals(15, logCaptor.getValue().getFlashcardsReviewed());
    }
}
