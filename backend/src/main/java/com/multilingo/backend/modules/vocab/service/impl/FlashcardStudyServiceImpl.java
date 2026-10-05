package com.multilingo.backend.modules.vocab.service.impl;

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
import com.multilingo.backend.modules.vocab.dto.response.FlashcardStudyCardDto;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionResponse;
import com.multilingo.backend.modules.vocab.dto.response.StudySessionSummaryResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.FlashcardStudyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Cài đặt Dịch vụ Quản lý Phiên ôn tập Flashcard (SRS Service Implementation).
 *
 * TRÁCH NHIỆM CHÍNH:
 * 1. Khởi tạo phiên ôn tập: Tải các thẻ từ vựng ưu tiên tới hạn ôn tập (nextReviewDate <= now),
 *    nếu không có thẻ nào tới hạn sẽ lấy toàn bộ thẻ trong bộ thẻ để học viên tự do ôn luyện.
 *    Tự động che từ vựng đích trong câu ví dụ (maskedSentence) để học viên tự tư duy trước khi lật thẻ.
 * 2. Đánh giá lặp lại ngắt quãng (SM-2 Spaced Repetition):
 *    - Đánh giá "Đã thuộc": Tăng reviewCount, tính khoảng cách ngày tiếp theo (intervalDays),
 *      khi đạt ngưỡng 21 ngày tự động nâng cấp trạng thái thành MASTERED.
 *    - Đánh giá "Quên": Reset khoảng cách về 1 ngày, giảm độ dễ (easeFactor) nhưng không dưới sàn 1.30.
 * 3. Hoàn tất phiên học & Gamification:
 *    - Cộng điểm kinh nghiệm (XP) tích lũy (+10 XP cơ bản + 2 XP/thẻ nhớ).
 *    - Cập nhật nhật ký học tập ngày hôm nay (DailyStudyLog).
 *    - Quản lý chuỗi ngày học liên tục (Streak), chống tăng lặp streak nếu đã học trong ngày.
 *
 * BẢO MẬT & IDOR:
 * - Kiểm tra quyền sở hữu bộ thẻ và thẻ từ vựng của người dùng trước mọi thao tác ghi/đọc.
 * - Ném mã lỗi FORBIDDEN nếu phát hiện người dùng thao tác trên tài nguyên của người khác.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FlashcardStudyServiceImpl implements FlashcardStudyService {

    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final DailyStudyLogRepository dailyStudyLogRepository;
    private final UserStudyStatRepository userStudyStatRepository;

    /**
     * Khởi tạo phiên ôn tập Flashcard cho một bộ thẻ.
     *
     * CÁC BƯỚC XỬ LÝ:
     * 1. Kiểm tra sự tồn tại của bộ thẻ trong CSDL.
     * 2. Kiểm tra phân quyền IDOR: Chỉ chủ sở hữu bộ thẻ mới được tạo phiên học.
     * 3. Lấy danh sách thẻ tới hạn ôn tập (nextReviewDate <= thời điểm hiện tại).
     * 4. Nếu không có thẻ nào tới hạn, lấy toàn bộ danh sách thẻ trong bộ để người dùng chủ động ôn luyện.
     * 5. Nếu bộ thẻ hoàn toàn rỗng không có từ vựng nào -> ném lỗi DECK_EMPTY.
     * 6. Chuyển đổi thực thể thẻ sang DTO kèm sinh câu ví dụ ẩn từ vựng đích (maskedSentence).
     *
     * @param deckId ID bộ thẻ cần ôn tập
     * @param userId ID người dùng đang đăng nhập
     * @return DTO StudySessionResponse chứa thông tin bộ thẻ và danh sách thẻ học
     */
    @Override
    public StudySessionResponse getStudySession(Integer deckId, Integer userId) {
        log.info("Bắt đầu khởi tạo phiên ôn tập: deckId={}, userId={}", deckId, userId);

        // 1. Kiểm tra bộ thẻ có tồn tại không
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR: Kiểm tra quyền sở hữu bộ thẻ
        if (!deck.getUserId().equals(userId)) {
            log.warn("Cảnh báo IDOR: Người dùng userId={} cố tình học bộ thẻ deckId={} thuộc sở hữu của userId={}",
                    userId, deckId, deck.getUserId());
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Tìm các thẻ tới hạn ôn tập theo mốc thời gian hiện tại
        Instant now = Instant.now();
        List<UserFlashcard> studyCards = userFlashcardRepository.findDueCardsForStudy(deckId, userId, now);

        // 4. Nếu không có thẻ nào tới hạn, hỗ trợ ôn luyện lại toàn bộ thẻ trong bộ
        if (studyCards.isEmpty()) {
            log.info("Không có thẻ tới hạn ôn tập, chuyển sang lấy toàn bộ thẻ trong bộ: deckId={}", deckId);
            studyCards = userFlashcardRepository.findAllForStudy(deckId, userId);

            // 5. Nếu bộ thẻ rỗng không có thẻ nào -> ném lỗi DECK_EMPTY
            if (studyCards.isEmpty()) {
                log.warn("Bộ thẻ chưa có từ vựng nào: deckId={}", deckId);
                throw new AppException(ErrorCode.DECK_EMPTY);
            }
        }

        // 6. Chuyển đổi sang danh sách StudyCard DTO kèm maskedSentence
        List<FlashcardStudyCardDto> cardDtos = studyCards.stream()
                .map(this::toStudyCardDto)
                .toList();

        log.info("Khởi tạo phiên học thành công: deckId={}, tổng số thẻ={}", deckId, cardDtos.size());

        return StudySessionResponse.builder()
                .deckId(deck.getId())
                .deckName(deck.getName())
                .targetLanguage(deck.getTargetLanguage())
                .sourceLanguage(deck.getSourceLanguage())
                .totalSessionCards(cardDtos.size())
                .cards(cardDtos)
                .build();
    }

    /**
     * Ghi nhận và tính toán thuật toán Spaced Repetition (SM-2) cho một thẻ từ vựng.
     *
     * QUY TẮC THUẬT TOÁN SRS:
     * - Trường hợp "Đã thuộc" (REMEMBERED):
     *   + Lần đầu tiên thuộc (reviewCount = 0): Khoảng cách ôn tiếp theo là 1 ngày.
     *   + Lần thứ hai thuộc (reviewCount = 1): Khoảng cách ôn tiếp theo là 3 ngày.
     *   + Từ lần 3 trở đi: Khoảng cách mới = ROUND(intervalDays * easeFactor).
     *   + Nếu khoảng cách mới >= 21 ngày: Chuyển thẻ sang trạng thái MASTERED.
     *   + Tăng reviewCount lên 1.
     * - Trường hợp "Quên" (FORGOTTEN):
     *   + Đặt lại khoảng cách ôn về 1 ngày (lặp lại vào ngày mai).
     *   + Giảm độ dễ (easeFactor) đi 0.20, nhưng không được phép thấp hơn mức sàn 1.30.
     *   + Đặt trạng thái về LEARNING.
     *
     * @param cardId ID thẻ từ vựng cần đánh giá
     * @param userId ID người dùng đang đăng nhập
     * @param request DTO chứa mức độ đánh giá (REMEMBERED / FORGOTTEN)
     * @return DTO CardReviewResponse chứa các chỉ số SRS đã được cập nhật
     */
    @Override
    @Transactional
    public CardReviewResponse reviewCard(Integer cardId, Integer userId, ReviewCardRequest request) {
        log.info("Ghi nhận đánh giá SRS: cardId={}, userId={}, rating={}", cardId, userId, request.getRating());

        // 1. Kiểm tra tính hợp lệ của tham số rating đầu vào
        if (request == null || request.getRating() == null) {
            throw new AppException(ErrorCode.INVALID_SRS_RATING);
        }

        String normalizedRating = request.getRating().trim().toUpperCase();
        if (!VocabStudyConstants.RATING_REMEMBERED.equals(normalizedRating)
                && !VocabStudyConstants.RATING_FORGOTTEN.equals(normalizedRating)) {
            log.warn("Mức độ đánh giá không hợp lệ: '{}'", request.getRating());
            throw new AppException(ErrorCode.INVALID_SRS_RATING);
        }

        // 2. Kiểm tra sự tồn tại của thẻ từ vựng
        UserFlashcard card = userFlashcardRepository.findById(cardId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_NOT_FOUND));

        // 3. Chặn IDOR: Đảm bảo thẻ thuộc về người dùng đang thực hiện
        if (!card.getUserId().equals(userId)) {
            log.warn("Cảnh báo IDOR: Người dùng userId={} cố tình đánh giá thẻ cardId={} của người khác", userId, cardId);
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 4. Trích xuất các chỉ số SRS hiện tại (sử dụng hằng số mặc định nếu null)
        BigDecimal currentEaseFactor = card.getEaseFactor() != null
                ? card.getEaseFactor()
                : VocabStudyConstants.DEFAULT_EASE_FACTOR;
        int currentReviewCount = card.getReviewCount() != null ? card.getReviewCount() : 0;
        int currentIntervalDays = card.getIntervalDays() != null ? card.getIntervalDays() : 0;

        // 5. Áp dụng công thức SuperMemo SM-2 dựa trên mức độ đánh giá
        if (VocabStudyConstants.RATING_REMEMBERED.equals(normalizedRating)) {
            int nextIntervalDays;
            if (currentReviewCount == 0) {
                nextIntervalDays = VocabStudyConstants.INITIAL_INTERVAL_DAYS;
            } else if (currentReviewCount == 1) {
                nextIntervalDays = VocabStudyConstants.SECOND_INTERVAL_DAYS;
            } else {
                double calculatedInterval = Math.round(currentIntervalDays * currentEaseFactor.doubleValue());
                nextIntervalDays = Math.max(currentIntervalDays + 1, (int) calculatedInterval);
            }

            card.setReviewCount(currentReviewCount + 1);
            card.setIntervalDays(nextIntervalDays);

            // Kiểm tra mốc thành thạo từ vựng
            if (nextIntervalDays >= VocabStudyConstants.MASTERED_INTERVAL_THRESHOLD_DAYS) {
                card.setStatus(VocabStudyConstants.STATUS_MASTERED);
            } else {
                card.setStatus(VocabStudyConstants.STATUS_LEARNING);
            }

            card.setNextReviewDate(Instant.now().plus(nextIntervalDays, ChronoUnit.DAYS));
        } else {
            // Khi quên từ vựng: xếp lịch ôn lại vào ngày mai và phạt trừ độ dễ
            card.setIntervalDays(VocabStudyConstants.INITIAL_INTERVAL_DAYS);

            BigDecimal adjustedEaseFactor = currentEaseFactor
                    .subtract(VocabStudyConstants.EASE_FACTOR_PENALTY)
                    .setScale(2, RoundingMode.HALF_UP);

            // Ràng buộc sàn tối thiểu không thấp hơn 1.30
            if (adjustedEaseFactor.compareTo(VocabStudyConstants.MIN_EASE_FACTOR) < 0) {
                adjustedEaseFactor = VocabStudyConstants.MIN_EASE_FACTOR;
            }

            card.setEaseFactor(adjustedEaseFactor);
            card.setStatus(VocabStudyConstants.STATUS_LEARNING);
            card.setNextReviewDate(Instant.now().plus(VocabStudyConstants.INITIAL_INTERVAL_DAYS, ChronoUnit.DAYS));
        }

        // 6. Lưu vào cơ sở dữ liệu
        UserFlashcard updatedCard = userFlashcardRepository.save(card);

        log.info("Cập nhật chỉ số SRS thành công: cardId={}, status={}, reviewCount={}, intervalDays={}, easeFactor={}",
                updatedCard.getId(), updatedCard.getStatus(), updatedCard.getReviewCount(),
                updatedCard.getIntervalDays(), updatedCard.getEaseFactor());

        return CardReviewResponse.builder()
                .cardId(updatedCard.getId())
                .status(updatedCard.getStatus())
                .reviewCount(updatedCard.getReviewCount())
                .intervalDays(updatedCard.getIntervalDays())
                .easeFactor(updatedCard.getEaseFactor())
                .nextReviewDate(updatedCard.getNextReviewDate())
                .build();
    }

    /**
     * Hoàn tất phiên ôn tập: Tính điểm thưởng kinh nghiệm (XP), ghi nhận nhật ký học tập (Daily Log),
     * và cập nhật chuỗi ngày học liên tục (Streak).
     *
     * QUY TẮC GAMIFICATION:
     * 1. Điểm XP = 10 XP (hoàn tất phiên) + (số thẻ thuộc * 2 XP).
     * 2. Ghi nhận số phút học và cộng dồn số thẻ đã ôn vào DailyStudyLog của ngày hôm nay.
     * 3. Chuỗi Streak:
     *    - Nếu ngày học gần nhất là hôm qua: Tăng streak lên 1.
     *    - Nếu hôm nay đã học rồi: Giữ nguyên streak (tránh tăng lặp vô lý).
     *    - Nếu ngày học gần nhất trước hôm qua (bị ngắt quãng): Reset streak về 1.
     *    - Cập nhật kỷ lục streak cao nhất (highestStreak).
     *
     * @param deckId ID bộ thẻ vừa hoàn tất
     * @param userId ID người dùng đang đăng nhập
     * @param request Thống kê kết quả phiên học
     * @return DTO StudySessionSummaryResponse hiển thị màn hình vinh danh
     */
    @Override
    @Transactional
    public StudySessionSummaryResponse finishSession(Integer deckId, Integer userId, FinishStudySessionRequest request) {
        log.info("Bắt đầu xử lý hoàn tất phiên học: deckId={}, userId={}, cardsReviewed={}",
                deckId, userId, request.getCardsReviewed());

        // 1. Kiểm tra bộ thẻ tồn tại
        FlashcardDeck deck = flashcardDeckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        // 2. Chặn IDOR: Đảm bảo bộ thẻ thuộc về người dùng
        if (!deck.getUserId().equals(userId)) {
            log.warn("Cảnh báo IDOR: Người dùng userId={} cố hoàn tất phiên học deckId={} của người khác", userId, deckId);
            throw new AppException(ErrorCode.FORBIDDEN);
        }

        // 3. Tính điểm kinh nghiệm tích lũy (XP)
        int rememberedCards = request.getCardsRemembered() != null ? request.getCardsRemembered() : 0;
        int earnedXp = VocabStudyConstants.XP_BASE_PER_SESSION
                + (rememberedCards * VocabStudyConstants.XP_PER_REMEMBERED_CARD);

        // 4. Cập nhật nhật ký học tập hàng ngày (DailyStudyLog)
        LocalDate today = LocalDate.now();
        DailyStudyLog dailyLog = dailyStudyLogRepository.findByUserIdAndStudyDate(userId, today)
                .orElseGet(() -> DailyStudyLog.builder()
                        .userId(userId)
                        .studyDate(today)
                        .learningMinutes(0)
                        .flashcardsDue(0)
                        .flashcardsReviewed(0)
                        .build());

        int reviewedCards = request.getCardsReviewed() != null ? request.getCardsReviewed() : 0;
        dailyLog.setFlashcardsReviewed(dailyLog.getFlashcardsReviewed() + reviewedCards);

        int durationSeconds = request.getDurationSeconds() != null ? request.getDurationSeconds() : 0;
        int learningMinutes = Math.max(1, durationSeconds / VocabStudyConstants.SECONDS_PER_MINUTE);
        dailyLog.setLearningMinutes(dailyLog.getLearningMinutes() + learningMinutes);
        dailyStudyLogRepository.save(dailyLog);

        // 5. Cập nhật thống kê học tập và chuỗi ngày học (UserStudyStat)
        UserStudyStat studyStat = userStudyStatRepository.findByUserId(userId)
                .orElseGet(() -> UserStudyStat.builder()
                        .userId(userId)
                        .currentStreak(0)
                        .highestStreak(0)
                        .totalLearningMinutes(0)
                        .build());

        LocalDate lastStudyDate = studyStat.getLastStudyDate();
        if (lastStudyDate == null) {
            // Học ngày đầu tiên
            studyStat.setCurrentStreak(1);
            studyStat.setLastStudyDate(today);
        } else if (!lastStudyDate.equals(today)) {
            if (lastStudyDate.equals(today.minusDays(1))) {
                // Học liên tiếp ngày tiếp theo
                studyStat.setCurrentStreak(studyStat.getCurrentStreak() + 1);
            } else {
                // Đứt chuỗi streak, bắt đầu lại từ 1
                studyStat.setCurrentStreak(1);
            }
            studyStat.setLastStudyDate(today);
        }
        // Trường hợp lastStudyDate.equals(today): Đã học hôm nay rồi -> giữ nguyên streak

        // Cập nhật kỷ lục streak cao nhất
        if (studyStat.getCurrentStreak() > studyStat.getHighestStreak()) {
            studyStat.setHighestStreak(studyStat.getCurrentStreak());
        }
        studyStat.setTotalLearningMinutes(studyStat.getTotalLearningMinutes() + learningMinutes);
        userStudyStatRepository.save(studyStat);

        // 6. Đếm tổng số từ vựng đã đạt mốc thành thạo (MASTERED) trong bộ thẻ này
        long masteredCount = userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
                deckId, userId, VocabStudyConstants.STATUS_MASTERED);

        log.info("Hoàn tất phiên học thành công: userId={}, earnedXp={}, currentStreak={}, masteredCount={}",
                userId, earnedXp, studyStat.getCurrentStreak(), masteredCount);

        return StudySessionSummaryResponse.builder()
                .earnedXp(earnedXp)
                .currentStreak(studyStat.getCurrentStreak())
                .totalMasteredCards((int) masteredCount)
                .cardsReviewed(reviewedCards)
                .build();
    }

    /**
     * Chuyển đổi thực thể UserFlashcard sang DTO FlashcardStudyCardDto,
     * đồng thời thực hiện logic che từ vựng đích trong câu ví dụ (maskedSentence).
     */
    private FlashcardStudyCardDto toStudyCardDto(UserFlashcard card) {
        // Ưu tiên câu ví dụ tùy chỉnh của thẻ, nếu không có thì fallback sang từ điển gốc
        String fullSentence = card.getExampleSentence();
        if ((fullSentence == null || fullSentence.isBlank()) && card.getWord() != null) {
            fullSentence = card.getWord().getExampleSentence();
        }

        // Tự động che từ vựng đích
        String maskedSentence = maskWordInSentence(fullSentence, card.getCustomWord());

        // Lấy thông tin ngữ âm và từ loại từ từ điển liên kết (nếu có)
        String phonetic = card.getWord() != null ? card.getWord().getPhonetic() : null;
        String pos = card.getWord() != null ? card.getWord().getPos() : null;

        return FlashcardStudyCardDto.builder()
                .id(card.getId())
                .customWord(card.getCustomWord())
                .phonetic(phonetic)
                .pos(pos)
                .maskedSentence(maskedSentence)
                .customMeaning(card.getCustomMeaning())
                .fullSentence(fullSentence)
                .customImageUrl(card.getCustomImageUrl())
                .reviewCount(card.getReviewCount())
                .status(card.getStatus())
                .build();
    }

    /**
     * Thuật toán ẩn từ vựng đích trong câu ví dụ bằng ký tự gạch dưới "_______".
     *
     * ĐẶC TÍNH THUẬT TOÁN:
     * 1. Xử lý an toàn: Kiểm tra null, chuỗi rỗng để tránh NullPointerException.
     * 2. Không phân biệt chữ hoa, chữ thường (Case-insensitive) bằng cờ (?i).
     * 3. Sử dụng Pattern.quote để bảo vệ ký tự đặc biệt (regex injection).
     * 4. Ưu tiên match theo ranh giới từ vựng (\b) để tránh che nhầm các từ con.
     * 5. Fallback tự động che theo chuỗi thô nếu ranh giới từ không match (hỗ trợ tiếng Việt hoặc từ ghép).
     */
    private String maskWordInSentence(String sentence, String word) {
        if (sentence == null || sentence.isBlank() || word == null || word.isBlank()) {
            return sentence;
        }

        String trimmedWord = word.trim();
        // Bước 1: Thử che có ràng buộc ranh giới từ (\b)
        String boundaryRegex = "(?i)\\b" + Pattern.quote(trimmedWord) + "\\b";
        String masked = sentence.replaceAll(boundaryRegex, VocabStudyConstants.MASK_WORD_REPLACEMENT);

        // Bước 2: Nếu chưa che được từ nào (ví dụ có dấu câu liền kề hoặc tiếng Việt có dấu), fallback che không ranh giới
        if (masked.equals(sentence)) {
            masked = sentence.replaceAll("(?i)" + Pattern.quote(trimmedWord), VocabStudyConstants.MASK_WORD_REPLACEMENT);
        }

        return masked;
    }
}
