package com.multilingo.backend.modules.vocab.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.constant.VocabStudyConstants;
import com.multilingo.backend.modules.vocab.dto.request.FinishStudySessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.ReviewCardRequest;
import com.multilingo.backend.modules.vocab.dto.response.CardReviewResponse;
import com.multilingo.backend.modules.vocab.dto.response.FlashcardStudyCardDto;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.mapper.FlashcardStudyMapper;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.FlashcardStudyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Cài đặt Dịch vụ Quản lý Phiên ôn tập Flashcard (SRS Flashcard Study Service).
 *
 * ĐẶC TẢ NGHIỆP VỤ TINH GỌN (SIMPLIFIED REFACTOR):
 * 1. Khởi tạo phiên: Lấy các thẻ tới hạn ôn tập (nextReviewDate <= now). Nếu không có, lấy toàn bộ thẻ để ôn luyện.
 * 2. Đánh giá Đã thuộc (REMEMBERED):
 *    - Lần 1: Ôn lại sau 1 ngày (status = LEARNING)
 *    - Lần 2: Ôn lại sau 3 ngày (status = LEARNING)
 *    - Lần 3+: Ôn lại sau 7 ngày -> ĐẠT THÀNH THẠO (status = MASTERED)
 * 3. Đánh giá Quên (FORGOTTEN):
 *    - Reset reviewCount = 0, status = LEARNING, ôn lại sau 1 ngày.
 * 4. Hoàn tất phiên học & Gamification:
 *    - Cộng cố định 10 XP cho mỗi phiên học hoàn thành.
 *    - Sử dụng StudyActivityService để cập nhật chuỗi Streak, DailyStudyLog và LƯU VĨNH VIỄN totalXp vào DB.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FlashcardStudyServiceImpl implements FlashcardStudyService {

    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final StudyActivityService studyActivityService;
    private final FlashcardStudyMapper flashcardStudyMapper;

    /**
     * Khởi tạo một phiên ôn tập Flashcard cho bộ thẻ.
     */
    @Override
    public StudySessionResponse getStudySession(Integer deckId, Integer userId) {
        log.info("Khởi tạo phiên ôn tập Flashcard: deckId={}, userId={}", deckId, userId);

        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        if (!deck.getUserId().equals(userId)) {
            log.warn("Truy cập trái phép phiên học (IDOR): deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        Instant now = Instant.now();
        List<UserFlashcard> studyCards = userFlashcardRepository.findDueCardsForStudy(deckId, userId, now);

        if (studyCards.isEmpty()) {
            studyCards = userFlashcardRepository.findAllForStudy(deckId, userId);
            if (studyCards.isEmpty()) {
                throw new AppException(ErrorCode.DECK_EMPTY);
            }
        }

        List<FlashcardStudyCardDto> cardDtos = studyCards.stream()
                .map(flashcardStudyMapper::toStudyCardDto)
                .toList();

        return flashcardStudyMapper.toStudySessionResponse(deck, cardDtos);
    }

    /**
     * Ghi nhận đánh giá mức độ nhớ của thẻ từ vựng theo quy tắc tinh gọn.
     */
    @Override
    @Transactional
    public CardReviewResponse reviewCard(Integer cardId, Integer userId, ReviewCardRequest request) {
        log.info("Đánh giá thẻ: cardId={}, userId={}, rating={}", cardId, userId, request != null ? request.getRating() : null);

        if (request == null || request.getRating() == null) {
            throw new AppException(ErrorCode.INVALID_SRS_RATING);
        }

        String rating = request.getRating().trim().toUpperCase();
        if (!VocabStudyConstants.RATING_REMEMBERED.equals(rating)
                && !VocabStudyConstants.RATING_FORGOTTEN.equals(rating)) {
            throw new AppException(ErrorCode.INVALID_SRS_RATING);
        }

        UserFlashcard card = userFlashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_NOT_FOUND));

        if (!card.getUserId().equals(userId)) {
            log.warn("Truy cập trái phép thẻ từ vựng (IDOR): cardId={}, requesterId={}, ownerId={}", cardId, userId, card.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        if (VocabStudyConstants.RATING_REMEMBERED.equals(rating)) {
            int nextCount = (card.getReviewCount() != null ? card.getReviewCount() : 0) + 1;
            card.setReviewCount(nextCount);

            int intervalDays;
            if (nextCount == 1) {
                intervalDays = VocabStudyConstants.INITIAL_INTERVAL_DAYS; // 1 ngày
                card.setStatus(VocabStudyConstants.STATUS_LEARNING);
            } else if (nextCount == 2) {
                intervalDays = VocabStudyConstants.SECOND_INTERVAL_DAYS; // 3 ngày
                card.setStatus(VocabStudyConstants.STATUS_LEARNING);
            } else {
                intervalDays = VocabStudyConstants.MASTERED_INTERVAL_DAYS; // 7 ngày
                card.setStatus(VocabStudyConstants.STATUS_MASTERED);
            }

            card.setIntervalDays(intervalDays);
            card.setNextReviewDate(Instant.now().plus(intervalDays, ChronoUnit.DAYS));
        } else {
            card.setReviewCount(0);
            card.setStatus(VocabStudyConstants.STATUS_LEARNING);
            card.setIntervalDays(VocabStudyConstants.INITIAL_INTERVAL_DAYS); // 1 ngày
            card.setNextReviewDate(Instant.now().plus(VocabStudyConstants.INITIAL_INTERVAL_DAYS, ChronoUnit.DAYS));
        }

        UserFlashcard savedCard = userFlashcardRepository.save(card);
        return flashcardStudyMapper.toCardReviewResponse(savedCard);
    }

    /**
     * Hoàn tất phiên ôn tập: Cộng cố định 10 XP và lưu vĩnh viễn XP, Streak vào DB.
     */
    @Override
    @Transactional
    public StudySessionSummaryResponse finishSession(Integer deckId, Integer userId, FinishStudySessionRequest request) {
        log.info("Hoàn tất phiên học Flashcard: deckId={}, userId={}, cardsReviewed={}",
                deckId, userId, request != null ? request.getCardsReviewed() : null);

        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        if (!deck.getUserId().equals(userId)) {
            log.warn("Truy cập trái phép hoàn tất phiên học (IDOR): deckId={}, requesterId={}, ownerId={}", deckId, userId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // Nghiệp vụ tinh gọn: Cứ học xong một phiên là cộng cố định 10 XP
        int earnedXp = VocabStudyConstants.XP_BASE_PER_SESSION; // 10 XP
        int durationSeconds = request != null && request.getDurationSeconds() != null ? request.getDurationSeconds() : 0;
        int studyMinutes = Math.max(1, durationSeconds / VocabStudyConstants.SECONDS_PER_MINUTE);
        int reviewedCards = request != null && request.getCardsReviewed() != null ? request.getCardsReviewed() : 0;

        // Lưu hoạt động học tập, cập nhật chuỗi Streak và LƯU VĨNH VIỄN XP VÀO DB qua StudyActivityService
        StudyActivityRecord activity = StudyActivityRecord.builder()
                .userId(userId)
                .studyMinutes(studyMinutes)
                .cardsReviewed(reviewedCards)
                .xpEarned(earnedXp)
                .activityType("FLASHCARD_STUDY")
                .qualifiesForStreak(true)
                .build();

        StudyActivitySummary studySummary = studyActivityService.recordActivity(activity);

        // Đếm số từ đạt thành thạo (MASTERED) trong bộ thẻ
        long masteredCount = userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
                deckId, userId, VocabStudyConstants.STATUS_MASTERED);

        return flashcardStudyMapper.toSessionSummaryResponse(
                earnedXp,
                studySummary != null ? studySummary.getCurrentStreak() : 1,
                (int) masteredCount,
                reviewedCards
        );
    }
}
