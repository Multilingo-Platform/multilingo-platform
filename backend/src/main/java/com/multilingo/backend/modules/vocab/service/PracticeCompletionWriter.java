package com.multilingo.backend.modules.vocab.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.PracticeProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeAnswerDto;
import com.multilingo.backend.modules.vocab.dto.request.SubmitPracticeRequest;
import com.multilingo.backend.modules.vocab.dto.response.PracticeOptionDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeSessionSnapshotDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeWrongAnswerDto;
import com.multilingo.backend.modules.vocab.dto.response.SubmitPracticeResponse;
import com.multilingo.backend.modules.vocab.entity.PracticeCompletionReceipt;
import com.multilingo.backend.modules.vocab.mapper.QuizPracticeMapper;
import com.multilingo.backend.modules.vocab.repository.PracticeCompletionReceiptRepository;
import com.multilingo.backend.modules.vocab.service.quiz.QuizScorer;
import com.multilingo.backend.modules.vocab.service.quiz.QuizScoringResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Ghi receipt, kết quả và thống kê cùng một transaction; chỉ dọn Redis sau commit. */
@Slf4j
@Service
@RequiredArgsConstructor
public class PracticeCompletionWriter {

    private final PracticeCompletionReceiptRepository receiptRepository;
    private final StudyActivityService studyActivityService;
    private final PracticeProperties practiceProperties;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final QuizPracticeMapper quizPracticeMapper;
    private final QuizScorer quizScorer;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public SubmitPracticeResponse record(Integer userId, PracticeSessionSnapshotDto snapshot,
                                         SubmitPracticeRequest request, String requestHash) {
        Instant now = Instant.now();
        if (!reserveCompletion(userId, snapshot, requestHash, now)) {
            return readCompletedResult(userId, snapshot.getSessionId(), requestHash);
        }
        Instant current = Instant.now();
        if (snapshot.getExpiresAt().isBefore(current)) {
            throw new AppException(ErrorCode.QUIZ_SESSION_EXPIRED);
        }

        Map<Integer, SubmitPracticeAnswerDto> answers = request.getAnswers().stream()
                .collect(Collectors.toMap(SubmitPracticeAnswerDto::getQuestionId, answer -> answer, (first, second) -> first));
        List<Boolean> correctness = new ArrayList<>();
        List<PracticeWrongAnswerDto> wrongAnswers = new ArrayList<>();
        for (PracticeQuestionSnapshotDto question : snapshot.getQuestions()) {
            SubmitPracticeAnswerDto answer = answers.get(question.getQuestionId());
            String selected = answer != null && answer.getSelectedOptionId() != null
                    ? answer.getSelectedOptionId().trim() : null;
            boolean correct = selected != null && selected.equalsIgnoreCase(question.getCorrectOptionId().trim());
            correctness.add(correct);
            if (!correct) {
                wrongAnswers.add(quizPracticeMapper.toWrongAnswerDto(question, selected, correctMeaning(question)));
            }
        }
        QuizScoringResult score = quizScorer.calculate(correctness);
        int durationSeconds = request.getDurationSeconds() != null ? request.getDurationSeconds() : 0;
        StudyActivityRecord activity = StudyActivityRecord.builder()
                .userId(userId)
                .studyMinutes(durationSeconds / QuizPracticeConstants.SECONDS_PER_MINUTE)
                .cardsReviewed(0)
                .xpEarned(QuizPracticeConstants.PRACTICE_COMPLETION_XP)
                .activityType(QuizPracticeConstants.ACTIVITY_TYPE_PRACTICE)
                .questionsAnswered(snapshot.getTotalQuestions())
                .correctAnswers(score.getCorrectAnswers())
                .qualifiesForStreak(true)
                .build();
        StudyActivitySummary study = studyActivityService.recordActivity(activity);
        SubmitPracticeResponse response = SubmitPracticeResponse.builder()
                .sessionId(snapshot.getSessionId())
                .totalQuestions(snapshot.getTotalQuestions())
                .correctAnswers(score.getCorrectAnswers())
                .accuracyPercent(score.getAccuracyPercent())
                .xpEarned(QuizPracticeConstants.PRACTICE_COMPLETION_XP)
                .currentStreak(study.getCurrentStreak())
                .streakIncremented(study.getStreakIncrement() > 0)
                .timeSpentSeconds(durationSeconds)
                .wrongAnswers(wrongAnswers)
                .build();

        saveResult(userId, snapshot.getSessionId(), response);
        cleanupSessionAfterCommit(snapshot.getSessionId());
        return response;
    }

    private boolean reserveCompletion(Integer userId, PracticeSessionSnapshotDto snapshot, String requestHash, Instant now) {
        Instant receiptRetention = now.plus(practiceProperties.getReceiptRetention());
        Instant sessionRetention = snapshot.getExpiresAt()
                .plus(practiceProperties.getCompletionTransactionTimeout())
                .plus(practiceProperties.getCleanupSafetyMargin());
        Instant retainUntil = receiptRetention.isAfter(sessionRetention) ? receiptRetention : sessionRetention;
        return receiptRepository.reserveReceipt(userId, snapshot.getSessionId(), requestHash,
                QuizPracticeConstants.EMPTY_RESULT_JSON, snapshot.getExpiresAt(), now, retainUntil, now) != 0;
    }

    private SubmitPracticeResponse readCompletedResult(Integer userId, String sessionId, String requestHash) {
        PracticeCompletionReceipt receipt = receiptRepository.findByUserIdAndSessionId(userId, sessionId)
                .orElseThrow(() -> new AppException(ErrorCode.CONFLICT));
        if (!requestHash.equals(receipt.getRequestHash())) {
            throw new AppException(ErrorCode.QUIZ_IDEMPOTENCY_CONFLICT);
        }
        try {
            return objectMapper.readValue(receipt.getResultJson(), SubmitPracticeResponse.class);
        } catch (JsonProcessingException e) {
            log.error("Không thể giải mã kết quả phiên {}: {}", sessionId, e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private String correctMeaning(PracticeQuestionSnapshotDto question) {
        if (question.getOptions() != null) {
            for (PracticeOptionDto option : question.getOptions()) {
                if (option.getOptionId().equalsIgnoreCase(question.getCorrectOptionId())) {
                    return option.getText();
                }
            }
        }
        return "";
    }

    private void saveResult(Integer userId, String sessionId, SubmitPracticeResponse response) {
        try {
            receiptRepository.updateResultJson(userId, sessionId, objectMapper.writeValueAsString(response), Instant.now());
        } catch (JsonProcessingException e) {
            log.error("Không thể lưu kết quả phiên {}: {}", sessionId, e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private void cleanupSessionAfterCommit(String sessionId) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    redisTemplate.delete(QuizPracticeConstants.REDIS_SESSION_KEY_PREFIX + sessionId);
                } catch (Exception e) {
                    log.warn("Không thể dọn Redis cho phiên đã commit {}: {}", sessionId, e.getMessage());
                }
            }
        });
    }
}
