package com.multilingo.backend.modules.vocab.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.PracticeOptionDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeSessionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeWrongAnswerDto;
import com.multilingo.backend.modules.vocab.dto.response.SubmitPracticeResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.QuizPracticeService;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Cài đặt Dịch vụ Quản lý Phiên Luyện tập Từ vựng (Quiz Practice Service).
 *
 * NGHIỆP VỤ TINH GỌN (REFACTORED):
 * 1. Khởi tạo phiên luyện tập: Sinh câu hỏi từ bộ thẻ và lưu tạm trên Redis (TTL 30 phút).
 * 2. Nộp bài luyện tập:
 *    - Đọc session snapshot từ Redis (hỗ trợ đọc lại kết quả đã nộp nếu retry).
 *    - Chấm điểm từng câu hỏi trực tiếp (đếm câu đúng / tổng câu).
 *    - Tổng hợp danh sách câu trả lời chưa đúng (wrongAnswers) để học viên xem lại.
 *    - Ghi nhận hoạt động Gamification (+10 XP cố định, chuỗi streak) qua StudyActivityService và lưu DB.
 *    - Lưu receipt kết quả đơn giản và dọn dẹp Redis session.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuizPracticeServiceImpl implements QuizPracticeService {

    private final FlashcardDeckRepository deckRepository;
    private final UserFlashcardRepository flashcardRepository;
    private final PracticeCompletionReceiptRepository receiptRepository;
    private final QuizQuestionGenerator questionGenerator;
    private final StudyActivityService studyActivityService;
    private final PracticeProperties practiceProperties;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public PracticeSessionSnapshotDto createPracticeSession(Integer deckId, CreateQuizSessionRequest request, Integer userId) {
        FlashcardDeck deck = findOwnedDeck(deckId, userId);
        List<UserFlashcard> cards = flashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(deckId, userId);
        if (cards == null || cards.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        String filter = request != null && request.getFilterStatus() != null && !request.getFilterStatus().isBlank()
                ? request.getFilterStatus().trim().toUpperCase()
                : QuizPracticeConstants.FILTER_STATUS_ALL;
        int limit = request != null && request.getLimit() != null && request.getLimit() > 0
                ? request.getLimit()
                : QuizPracticeConstants.DEFAULT_QUESTION_LIMIT;

        List<PracticeQuestionSnapshotDto> questions = questionGenerator.generatePracticeQuestions(cards, filter, limit, new Random());
        if (questions == null || questions.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        Instant now = Instant.now();
        Duration validity = practiceProperties != null && practiceProperties.getSessionValidity() != null
                ? practiceProperties.getSessionValidity()
                : Duration.ofMinutes(30);

        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(UUID.randomUUID().toString())
                .deckId(deckId)
                .deckName(deck.getName())
                .userId(userId)
                .filterStatus(filter)
                .totalQuestions(questions.size())
                .createdAt(now)
                .expiresAt(now.plus(validity))
                .questions(questions)
                .build();

        saveSessionToRedis(snapshot, validity);
        return snapshot;
    }

    @Override
    @Transactional
    public SubmitPracticeResponse submitPracticeSession(String sessionId, SubmitPracticeRequest request, Integer userId) {
        // 1. Kiểm tra nếu phiên đã từng được nộp trước đó -> trả về kết quả đã lưu (Idempotency)
        Optional<PracticeCompletionReceipt> existingReceipt = receiptRepository.findByUserIdAndSessionId(userId, sessionId);
        if (existingReceipt.isPresent()) {
            return parseResultJson(existingReceipt.get().getResultJson());
        }

        // 2. Đọc session snapshot từ Redis
        String redisKey = QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId;
        String snapshotJson = readSessionJson(redisKey);
        if (snapshotJson == null) {
            // Kiểm tra lần nữa phòng trường hợp race condition vừa ghi receipt
            return receiptRepository.findByUserIdAndSessionId(userId, sessionId)
                    .map(r -> parseResultJson(r.getResultJson()))
                    .orElseThrow(() -> new AppException(ErrorCode.QUIZ_SESSION_EXPIRED));
        }

        PracticeSessionSnapshotDto snapshot = parseSessionSnapshot(snapshotJson);
        if (!snapshot.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (snapshot.getExpiresAt().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.QUIZ_SESSION_EXPIRED);
        }

        // 3. Chấm điểm câu trả lời
        List<SubmitPracticeAnswerDto> answers = request != null && request.getAnswers() != null
                ? request.getAnswers()
                : List.of();

        Map<Integer, String> answerMap = answers.stream()
                .filter(a -> a.getQuestionId() != null)
                .collect(Collectors.toMap(
                        SubmitPracticeAnswerDto::getQuestionId,
                        a -> a.getSelectedOptionId() != null ? a.getSelectedOptionId().trim() : "",
                        (first, second) -> first
                ));

        int correctCount = 0;
        List<PracticeWrongAnswerDto> wrongAnswers = new ArrayList<>();

        for (PracticeQuestionSnapshotDto q : snapshot.getQuestions()) {
            String selected = answerMap.get(q.getQuestionId());
            boolean isCorrect = selected != null && selected.equalsIgnoreCase(q.getCorrectOptionId().trim());

            if (isCorrect) {
                correctCount++;
            } else {
                String correctMeaning = "";
                if (q.getOptions() != null) {
                    correctMeaning = q.getOptions().stream()
                            .filter(opt -> opt.getOptionId().equalsIgnoreCase(q.getCorrectOptionId()))
                            .map(PracticeOptionDto::getText)
                            .findFirst()
                            .orElse("");
                }

                wrongAnswers.add(PracticeWrongAnswerDto.builder()
                        .questionId(q.getQuestionId())
                        .cardId(q.getCardId())
                        .word(q.getTargetWord())
                        .selectedOptionId(selected)
                        .correctOptionId(q.getCorrectOptionId())
                        .correctMeaning(correctMeaning)
                        .build());
            }
        }

        int totalQuestions = snapshot.getTotalQuestions() != null && snapshot.getTotalQuestions() > 0
                ? snapshot.getTotalQuestions()
                : snapshot.getQuestions().size();

        BigDecimal accuracyPercent = totalQuestions > 0
                ? BigDecimal.valueOf(correctCount)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(totalQuestions), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        int durationSeconds = request != null && request.getDurationSeconds() != null
                ? request.getDurationSeconds()
                : 0;
        int studyMinutes = Math.max(1, durationSeconds / QuizPracticeConstants.SECONDS_PER_MINUTE);

        // 4. Cộng điểm kinh nghiệm (+10 XP) và cập nhật streak qua StudyActivityService
        int xpEarned = QuizPracticeConstants.PRACTICE_COMPLETION_XP; // 10 XP
        StudyActivityRecord activity = StudyActivityRecord.builder()
                .userId(userId)
                .studyMinutes(studyMinutes)
                .cardsReviewed(0)
                .xpEarned(xpEarned)
                .activityType(QuizPracticeConstants.ACTIVITY_TYPE_PRACTICE)
                .questionsAnswered(totalQuestions)
                .correctAnswers(correctCount)
                .qualifiesForStreak(true)
                .build();

        StudyActivitySummary studySummary = studyActivityService.recordActivity(activity);

        SubmitPracticeResponse response = SubmitPracticeResponse.builder()
                .sessionId(sessionId)
                .totalQuestions(totalQuestions)
                .correctAnswers(correctCount)
                .accuracyPercent(accuracyPercent)
                .xpEarned(xpEarned)
                .currentStreak(studySummary != null ? studySummary.getCurrentStreak() : 1)
                .streakIncremented(studySummary != null && studySummary.getStreakIncrement() > 0)
                .timeSpentSeconds(durationSeconds)
                .wrongAnswers(wrongAnswers)
                .build();

        // 5. Lưu receipt để hỗ trợ truy vấn lại & xóa Redis session
        try {
            Instant now = Instant.now();
            PracticeCompletionReceipt receipt = PracticeCompletionReceipt.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .requestHash("COMPLETED")
                    .resultJson(objectMapper.writeValueAsString(response))
                    .processedAt(now)
                    .sessionExpiresAt(snapshot.getExpiresAt())
                    .retainUntil(now.plus(Duration.ofDays(7)))
                    .build();
            receiptRepository.save(receipt);
        } catch (Exception e) {
            log.error("Không thể lưu receipt cho session {}: {}", sessionId, e.getMessage());
        }

        try {
            redisTemplate.delete(redisKey);
        } catch (Exception e) {
            log.warn("Không thể xóa session key trên Redis {}: {}", redisKey, e.getMessage());
        }

        return response;
    }

    private FlashcardDeck findOwnedDeck(Integer deckId, Integer userId) {
        FlashcardDeck deck = deckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));
        if (!deck.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        return deck;
    }

    private void saveSessionToRedis(PracticeSessionSnapshotDto snapshot, Duration ttl) {
        String key = QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + snapshot.getSessionId();
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(snapshot), ttl);
        } catch (Exception e) {
            log.error("Không thể lưu phiên luyện tập vào Redis {}: {}", snapshot.getSessionId(), e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private String readSessionJson(String key) {
        try {
            return redisTemplate.opsForValue().get(key);
        } catch (Exception e) {
            log.error("Không thể đọc phiên luyện tập từ Redis {}: {}", key, e.getMessage());
            return null;
        }
    }

    private PracticeSessionSnapshotDto parseSessionSnapshot(String json) {
        try {
            return objectMapper.readValue(json, PracticeSessionSnapshotDto.class);
        } catch (JsonProcessingException e) {
            log.error("Lỗi parse snapshot luyện tập: {}", e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private SubmitPracticeResponse parseResultJson(String json) {
        try {
            return objectMapper.readValue(json, SubmitPracticeResponse.class);
        } catch (JsonProcessingException e) {
            log.error("Lỗi parse kết quả đã lưu: {}", e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}
