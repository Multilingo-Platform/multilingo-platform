package com.multilingo.backend.modules.vocab.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
import com.multilingo.backend.modules.vocab.dto.request.CreateQuizSessionRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeSessionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.SubmitPracticeResponse;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.service.PracticeCompletionWriter;
import com.multilingo.backend.modules.vocab.service.QuizPracticeService;
import com.multilingo.backend.modules.vocab.service.quiz.PracticePayloadHasher;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuizPracticeServiceImpl implements QuizPracticeService {

    private final FlashcardDeckRepository deckRepository;
    private final UserFlashcardRepository flashcardRepository;
    private final PracticeCompletionReceiptRepository receiptRepository;
    private final PracticeCompletionWriter completionWriter;
    private final QuizQuestionGenerator questionGenerator;
    private final PracticePayloadHasher payloadHasher;
    private final PracticeProperties practiceProperties;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public PracticeSessionSnapshotDto createPracticeSession(Integer deckId, CreateQuizSessionRequest request, Integer userId) {
        FlashcardDeck deck = findOwnedDeck(deckId, userId);
        List<UserFlashcard> cards = flashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(deckId, userId);
        if (cards.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        String filter = request.getFilterStatus() != null && !request.getFilterStatus().isBlank()
                ? request.getFilterStatus().trim().toUpperCase()
                : QuizPracticeConstants.FILTER_STATUS_ALL;
        int limit = request.getLimit() != null && request.getLimit() > 0
                ? request.getLimit() : QuizPracticeConstants.DEFAULT_QUESTION_LIMIT;
        List<PracticeQuestionSnapshotDto> questions = questionGenerator.generatePracticeQuestions(cards, filter, limit, new Random());
        if (questions == null || questions.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        Instant now = Instant.now();
        PracticeSessionSnapshotDto snapshot = PracticeSessionSnapshotDto.builder()
                .sessionId(UUID.randomUUID().toString())
                .deckId(deckId).deckName(deck.getName()).userId(userId)
                .filterStatus(filter).totalQuestions(questions.size())
                .createdAt(now).expiresAt(now.plus(practiceProperties.getSessionValidity()))
                .questions(questions)
                .build();
        saveSession(snapshot);
        return snapshot;
    }

    @Override
    public SubmitPracticeResponse submitPracticeSession(String sessionId, SubmitPracticeRequest request, Integer userId) {
        int durationSeconds = validateRequest(request);
        String requestHash = payloadHasher.computeCanonicalHash(sessionId, durationSeconds, request.getAnswers());

        Optional<SubmitPracticeResponse> completed = findCompletedResult(userId, sessionId, requestHash);
        if (completed.isPresent()) {
            return completed.get();
        }

        String snapshotJson = readSessionJson(sessionId);
        if (snapshotJson == null) {
            // Một request khác có thể vừa commit và xóa Redis sau lần đọc receipt đầu tiên.
            return findCompletedResult(userId, sessionId, requestHash)
                    .orElseThrow(() -> new AppException(ErrorCode.QUIZ_SESSION_EXPIRED));
        }

        PracticeSessionSnapshotDto snapshot = parseSession(snapshotJson);
        checkOwnerAndExpiry(snapshot, userId);
        validateAnswers(snapshot, request.getAnswers());
        return completionWriter.record(userId, snapshot, request, requestHash);
    }

    private FlashcardDeck findOwnedDeck(Integer deckId, Integer userId) {
        FlashcardDeck deck = deckRepository.findById(deckId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));
        if (!deck.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        return deck;
    }

    private void saveSession(PracticeSessionSnapshotDto snapshot) {
        String key = QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + snapshot.getSessionId();
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(snapshot), practiceProperties.getSessionValidity());
        } catch (Exception e) {
            log.error("Không thể lưu phiên luyện tập {}: {}", snapshot.getSessionId(), e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private String readSessionJson(String sessionId) {
        try {
            return redisTemplate.opsForValue().get(QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId);
        } catch (Exception e) {
            log.error("Không thể đọc phiên luyện tập {}: {}", sessionId, e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private PracticeSessionSnapshotDto parseSession(String json) {
        try {
            return objectMapper.readValue(json, PracticeSessionSnapshotDto.class);
        } catch (JsonProcessingException e) {
            log.error("Không thể giải mã snapshot luyện tập: {}", e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private Optional<SubmitPracticeResponse> findCompletedResult(Integer userId, String sessionId, String requestHash) {
        return receiptRepository.findByUserIdAndSessionId(userId, sessionId)
                .map(receipt -> readCompletedResult(receipt, requestHash));
    }

    private SubmitPracticeResponse readCompletedResult(PracticeCompletionReceipt receipt, String requestHash) {
        if (!requestHash.equals(receipt.getRequestHash())) {
            throw new AppException(ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT);
        }
        try {
            return objectMapper.readValue(receipt.getResultJson(), SubmitPracticeResponse.class);
        } catch (JsonProcessingException e) {
            log.error("Không thể giải mã kết quả phiên {}: {}", receipt.getSessionId(), e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private int validateRequest(SubmitPracticeRequest request) {
        int duration = request.getDurationSeconds() != null ? request.getDurationSeconds() : 0;
        if (duration < 0 || duration > QuizPracticeConstants.MAX_DURATION_SECONDS
                || request.getAnswers() == null || request.getAnswers().isEmpty()) {
            throw new AppException(ErrorCode.QUIZ_INVALID_REQUEST);
        }
        return duration;
    }

    private void checkOwnerAndExpiry(PracticeSessionSnapshotDto snapshot, Integer userId) {
        if (!snapshot.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        if (snapshot.getExpiresAt().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.QUIZ_SESSION_EXPIRED);
        }
    }

    private void validateAnswers(PracticeSessionSnapshotDto snapshot, List<SubmitPracticeAnswerDto> answers) {
        if (answers.size() != snapshot.getTotalQuestions()) {
            throw new AppException(ErrorCode.QUIZ_INVALID_REQUEST);
        }
        Map<Integer, PracticeQuestionSnapshotDto> questions = snapshot.getQuestions().stream()
                .collect(Collectors.toMap(PracticeQuestionSnapshotDto::getQuestionId, question -> question));
        Set<Integer> seenIds = new HashSet<>();
        for (SubmitPracticeAnswerDto answer : answers) {
            if (!seenIds.add(answer.getQuestionId())) {
                throw new AppException(ErrorCode.QUIZ_INVALID_REQUEST);
            }
            PracticeQuestionSnapshotDto question = questions.get(answer.getQuestionId());
            if (question == null) {
                throw new AppException(ErrorCode.QUIZ_INVALID_REQUEST);
            }
            String selected = answer.getSelectedOptionId();
            if (selected == null || selected.isBlank()
                    || question.getOptions().stream().noneMatch(option -> option.getOptionId().equalsIgnoreCase(selected.trim()))) {
                throw new AppException(ErrorCode.QUIZ_INVALID_REQUEST);
            }
        }
    }
}
