package com.multilingo.backend.modules.vocab.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.VocabTestProperties;
import com.multilingo.backend.modules.gamification.dto.StudyActivityRecord;
import com.multilingo.backend.modules.gamification.dto.StudyActivitySummary;
import com.multilingo.backend.modules.gamification.service.StudyActivityService;
import com.multilingo.backend.modules.vocab.dto.request.AutoSaveProgressRequest;
import com.multilingo.backend.modules.vocab.dto.request.GenerateVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.SubmitVocabTestRequest;
import com.multilingo.backend.modules.vocab.dto.request.VocabTestAnswerItemDto;
import com.multilingo.backend.modules.vocab.dto.response.*;
import com.multilingo.backend.modules.vocab.entity.FlashcardDeck;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import com.multilingo.backend.modules.vocab.entity.VocabTestAttempt;
import com.multilingo.backend.modules.vocab.repository.FlashcardDeckRepository;
import com.multilingo.backend.modules.vocab.repository.UserFlashcardRepository;
import com.multilingo.backend.modules.vocab.repository.VocabTestAttemptRepository;
import com.multilingo.backend.modules.vocab.service.VocabTestService;
import com.multilingo.backend.modules.vocab.service.quiz.QuizQuestionGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Cài đặt Dịch vụ Quản lý Thi thử Từ vựng (Vocabulary CBT Mock Test Service).
 *
 * NGHIỆP VỤ TINH GỌN (REFACTORED):
 * 1. Sinh đề thi: Sử dụng QuizQuestionGenerator để tạo câu hỏi trắc nghiệm 4 đáp án.
 * 2. Khôi phục bài thi (Resume): Tải lại đề thi và tiến độ câu trả lời đã lưu.
 * 3. Tự động lưu tiến độ (Autosave): Cập nhật trực tiếp answersProgress vào DB, không băm SHA-256 gây 409 conflict.
 * 4. Nộp bài & Chấm điểm: Chấm điểm thang 100, cộng 20 XP và lưu vĩnh viễn qua StudyActivityService.
 * 5. Xem lại bài làm: Trả về câu hỏi, đáp án đã chọn, đáp án đúng và lời giải thích chi tiết.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VocabTestServiceImpl implements VocabTestService {

    private final VocabTestAttemptRepository vocabTestAttemptRepository;
    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final QuizQuestionGenerator quizQuestionGenerator;
    private final VocabTestProperties vocabTestProperties;
    private final StudyActivityService studyActivityService;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public VocabTestExamDto generateTest(Integer deckId, Integer userId, GenerateVocabTestRequest request) {
        FlashcardDeck deck = flashcardDeckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        List<UserFlashcard> allCards = userFlashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(deckId, userId);
        int limit = (request != null && request.getLimit() != null)
                ? Math.clamp(request.getLimit(), 4, 20)
                : 10;

        // Sinh danh sách câu hỏi trắc nghiệm nội bộ dùng chung generator
        List<VocabTestInternalQuestionDto> internalQuestions = quizQuestionGenerator.generateTestQuestions(
                allCards, limit, new Random());

        // DTO gửi cho thí sinh: KHÔNG chứa correctKey và explanation
        List<VocabTestQuestionDto> publicQuestions = internalQuestions.stream()
                .map(q -> VocabTestQuestionDto.builder()
                        .questionNumber(q.getQuestionNumber())
                        .cardId(q.getCardId())
                        .word(q.getWord())
                        .phonetic(q.getPhonetic())
                        .pos(q.getPos())
                        .sentence(q.getSentence())
                        .options(q.getOptions())
                        .build())
                .toList();

        Instant now = Instant.now();
        int secondsPerQuestion = vocabTestProperties != null && vocabTestProperties.getSecondsPerQuestion() > 0
                ? vocabTestProperties.getSecondsPerQuestion()
                : 30;
        int timeLimitSeconds = internalQuestions.size() * secondsPerQuestion;
        Instant expiresAt = now.plusSeconds(timeLimitSeconds);
        String testToken = "test-" + UUID.randomUUID();

        try {
            VocabTestAttempt attempt = VocabTestAttempt.builder()
                    .userId(userId)
                    .deckId(deckId)
                    .deckNameSnapshot(deck.getName())
                    .testToken(testToken)
                    .status("IN_PROGRESS")
                    .progressVersion(0)
                    .totalQuestions(internalQuestions.size())
                    .timeLimitSeconds(timeLimitSeconds)
                    .startedAt(now)
                    .expiresAt(expiresAt)
                    .questionsSnapshot(objectMapper.writeValueAsString(internalQuestions))
                    .answersProgress("[]")
                    .build();

            vocabTestAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.error("Lỗi khi lưu đề thi thử: {}", e.getMessage());
            throw new IllegalStateException("Không thể lưu cấu trúc đề thi thử", e);
        }

        return VocabTestExamDto.builder()
                .testToken(testToken)
                .deckId(deckId)
                .deckName(deck.getName())
                .timeLimitSeconds(timeLimitSeconds)
                .totalQuestions(internalQuestions.size())
                .startedAt(now)
                .expiresAt(expiresAt)
                .serverTime(now)
                .questions(publicQuestions)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public VocabTestResumeResponse resumeTest(String testToken, Integer userId) {
        VocabTestAttempt attempt = findOwnedAttempt(testToken, userId);

        Instant now = Instant.now();
        int graceSeconds = vocabTestProperties != null ? vocabTestProperties.getSubmissionGraceSeconds() : 15;
        boolean deadlinePassed = now.isAfter(attempt.getExpiresAt().plusSeconds(graceSeconds));

        List<VocabTestInternalQuestionDto> internalQuestions = parseInternalQuestions(attempt.getQuestionsSnapshot());
        List<VocabTestQuestionDto> publicQuestions = internalQuestions.stream()
                .map(q -> VocabTestQuestionDto.builder()
                        .questionNumber(q.getQuestionNumber())
                        .cardId(q.getCardId())
                        .word(q.getWord())
                        .phonetic(q.getPhonetic())
                        .pos(q.getPos())
                        .sentence(q.getSentence())
                        .options(q.getOptions())
                        .build())
                .toList();

        List<VocabTestAnswerItemDto> savedAnswers = parseSavedAnswers(attempt.getAnswersProgress());
        VocabTestResultResponse resultResponse = parseResultSummary(attempt.getResultSummary());

        return VocabTestResumeResponse.builder()
                .testToken(attempt.getTestToken())
                .deckId(attempt.getDeckId())
                .deckName(attempt.getDeckNameSnapshot())
                .status(attempt.getStatus())
                .progressVersion(attempt.getProgressVersion() != null ? attempt.getProgressVersion() : 0)
                .timeLimitSeconds(attempt.getTimeLimitSeconds())
                .totalQuestions(attempt.getTotalQuestions())
                .startedAt(attempt.getStartedAt())
                .expiresAt(attempt.getExpiresAt())
                .serverTime(now)
                .deadlinePassed(deadlinePassed)
                .questions(publicQuestions)
                .savedAnswers(savedAnswers)
                .resultSummary(resultResponse)
                .build();
    }

    @Override
    @Transactional
    public AutoSaveProgressResponse saveProgress(String testToken, Integer userId, AutoSaveProgressRequest request) {
        VocabTestAttempt attempt = findOwnedAttempt(testToken, userId);

        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new AppException(ErrorCode.VOCAB_TEST_ALREADY_FINISHED);
        }

        Instant now = Instant.now();
        int graceSeconds = vocabTestProperties != null ? vocabTestProperties.getSubmissionGraceSeconds() : 15;
        if (now.isAfter(attempt.getExpiresAt().plusSeconds(graceSeconds))) {
            throw new AppException(ErrorCode.VOCAB_TEST_DEADLINE_PASSED);
        }

        int nextVersion = (attempt.getProgressVersion() != null ? attempt.getProgressVersion() : 0) + 1;
        try {
            List<VocabTestAnswerItemDto> answers = request != null && request.getAnswers() != null
                    ? request.getAnswers()
                    : List.of();
            attempt.setAnswersProgress(objectMapper.writeValueAsString(answers));
            attempt.setProgressVersion(nextVersion);
            attempt.setUpdatedAt(now);
            vocabTestAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.error("Lỗi khi lưu tiến độ bài thi: {}", e.getMessage());
            throw new AppException(ErrorCode.UNCATEGORIZED_EXCEPTION);
        }

        return AutoSaveProgressResponse.builder()
                .progressVersion(nextVersion)
                .build();
    }

    @Override
    @Transactional
    public VocabTestResultResponse submitTest(String testToken, Integer userId, SubmitVocabTestRequest request) {
        VocabTestAttempt attempt = vocabTestAttemptRepository.findForUpdateByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));

        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }

        // Idempotency: Nếu bài thi đã kết thúc -> trả về kết quả đã lưu
        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            return parseResultSummary(attempt.getResultSummary());
        }

        Instant now = Instant.now();
        int graceSeconds = vocabTestProperties != null ? vocabTestProperties.getSubmissionGraceSeconds() : 15;
        boolean isExpired = now.isAfter(attempt.getExpiresAt().plusSeconds(graceSeconds));

        List<VocabTestAnswerItemDto> answersToGrade;
        if (!isExpired) {
            answersToGrade = request != null && request.getAnswers() != null && !request.getAnswers().isEmpty()
                    ? request.getAnswers()
                    : parseSavedAnswers(attempt.getAnswersProgress());
        } else {
            // Quá hạn: chấm theo tiến độ đã lưu trước đó
            answersToGrade = parseSavedAnswers(attempt.getAnswersProgress());
        }

        return finalizeAttempt(attempt, answersToGrade, isExpired ? "TIMED_OUT" : "COMPLETED", now);
    }

    @Override
    @Transactional
    public void handleTimeout(String testToken) {
        VocabTestAttempt attempt = vocabTestAttemptRepository.findForUpdateByTestToken(testToken).orElse(null);
        if (attempt == null || !"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            return;
        }

        Instant now = Instant.now();
        int graceSeconds = vocabTestProperties != null ? vocabTestProperties.getSubmissionGraceSeconds() : 15;
        if (now.isBefore(attempt.getExpiresAt().plusSeconds(graceSeconds))) {
            return;
        }

        List<VocabTestAnswerItemDto> savedAnswers = parseSavedAnswers(attempt.getAnswersProgress());
        finalizeAttempt(attempt, savedAnswers, "TIMED_OUT", now);
        log.info("Thu bài quá hạn thành công cho testToken={}", testToken);
    }

    @Override
    @Transactional(readOnly = true)
    public VocabTestReviewDetailDto reviewAnswers(String testToken, Integer userId) {
        VocabTestAttempt attempt = findOwnedAttempt(testToken, userId);

        if ("IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new AppException(ErrorCode.VOCAB_TEST_STILL_IN_PROGRESS);
        }

        List<VocabTestInternalQuestionDto> questions = parseInternalQuestions(attempt.getQuestionsSnapshot());
        List<VocabTestAnswerItemDto> answers = parseSavedAnswers(attempt.getAnswersProgress());

        Map<Integer, String> selectedMap = answers.stream()
                .filter(a -> a.getQuestionNumber() != null && a.getSelectedKey() != null)
                .collect(Collectors.toMap(
                        VocabTestAnswerItemDto::getQuestionNumber,
                        VocabTestAnswerItemDto::getSelectedKey,
                        (f, s) -> f
                ));

        List<VocabTestReviewItemDto> reviewItems = new ArrayList<>();
        for (VocabTestInternalQuestionDto q : questions) {
            String selected = selectedMap.get(q.getQuestionNumber());
            boolean isCorrect = selected != null && selected.equalsIgnoreCase(q.getCorrectKey());

            reviewItems.add(VocabTestReviewItemDto.builder()
                    .questionNumber(q.getQuestionNumber())
                    .cardId(q.getCardId())
                    .word(q.getWord())
                    .phonetic(q.getPhonetic())
                    .pos(q.getPos())
                    .sentence(q.getSentence())
                    .options(q.getOptions())
                    .selectedKey(selected)
                    .correctKey(q.getCorrectKey())
                    .correct(isCorrect)
                    .explanation(q.getExplanation())
                    .build());
        }

        return VocabTestReviewDetailDto.builder()
                .testToken(attempt.getTestToken())
                .deckId(attempt.getDeckId())
                .deckName(attempt.getDeckNameSnapshot())
                .status(attempt.getStatus())
                .score(attempt.getScore())
                .correctCount(attempt.getCorrectCount())
                .totalQuestions(attempt.getTotalQuestions())
                .xpEarned(attempt.getXpEarned())
                .timeSpentSeconds(attempt.getTimeSpentSeconds())
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .reviewItems(reviewItems)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<VocabTestHistoryDto> getDeckTestHistory(Integer deckId, Integer userId, Pageable pageable) {
        Page<VocabTestAttempt> attempts = vocabTestAttemptRepository
                .findByDeckIdAndUserIdOrderByCreatedAtDesc(deckId, userId, pageable);

        return attempts.map(a -> VocabTestHistoryDto.builder()
                .id(a.getId())
                .testToken(a.getTestToken())
                .deckId(a.getDeckId())
                .deckName(a.getDeckNameSnapshot())
                .status(a.getStatus())
                .score(a.getScore())
                .correctCount(a.getCorrectCount())
                .totalQuestions(a.getTotalQuestions())
                .xpEarned(a.getXpEarned())
                .timeSpentSeconds(a.getTimeSpentSeconds())
                .startedAt(a.getStartedAt())
                .submittedAt(a.getSubmittedAt())
                .createdAt(a.getCreatedAt())
                .build());
    }

    private VocabTestResultResponse finalizeAttempt(VocabTestAttempt attempt,
                                                    List<VocabTestAnswerItemDto> answers,
                                                    String targetStatus,
                                                    Instant now) {
        List<VocabTestInternalQuestionDto> questions = parseInternalQuestions(attempt.getQuestionsSnapshot());
        Map<Integer, String> answerMap = answers.stream()
                .filter(a -> a.getQuestionNumber() != null && a.getSelectedKey() != null)
                .collect(Collectors.toMap(
                        VocabTestAnswerItemDto::getQuestionNumber,
                        a -> a.getSelectedKey().trim(),
                        (first, second) -> first
                ));

        int correctCount = 0;
        int answeredCount = 0;

        for (VocabTestInternalQuestionDto q : questions) {
            String selected = answerMap.get(q.getQuestionNumber());
            if (selected != null && !selected.isBlank()) {
                answeredCount++;
                if (selected.equalsIgnoreCase(q.getCorrectKey())) {
                    correctCount++;
                }
            }
        }

        int totalQuestions = attempt.getTotalQuestions() != null && attempt.getTotalQuestions() > 0
                ? attempt.getTotalQuestions()
                : questions.size();
        int score = totalQuestions > 0 ? (int) Math.round(((double) correctCount / totalQuestions) * 100) : 0;

        int timeSpent = (int) Math.min(
                attempt.getTimeLimitSeconds() != null ? attempt.getTimeLimitSeconds() : 0,
                Math.max(0, Duration.between(attempt.getStartedAt(), now).toSeconds())
        );

        // Quy tắc thưởng XP & Streak: +20 XP khi có >= 1 câu trả lời
        int xpEarned = answeredCount > 0 ? 20 : 0;
        boolean qualifiesForStreak = answeredCount > 0;

        StudyActivityRecord activity = StudyActivityRecord.builder()
                .userId(attempt.getUserId())
                .studyMinutes(Math.max(1, timeSpent / 60))
                .cardsReviewed(0)
                .xpEarned(xpEarned)
                .activityType("VOCAB_TEST")
                .questionsAnswered(totalQuestions)
                .correctAnswers(correctCount)
                .qualifiesForStreak(qualifiesForStreak)
                .build();

        StudyActivitySummary studySummary = studyActivityService.recordActivity(activity);

        VocabTestResultResponse resultResponse = VocabTestResultResponse.builder()
                .testToken(attempt.getTestToken())
                .status(targetStatus)
                .score(score)
                .correctCount(correctCount)
                .totalQuestions(totalQuestions)
                .xpEarned(xpEarned)
                .timeSpentSeconds(timeSpent)
                .currentStreak(studySummary != null ? studySummary.getCurrentStreak() : 0)
                .streakIncremented(studySummary != null && studySummary.getStreakIncrement() > 0)
                .submittedAt(now)
                .build();

        try {
            attempt.setStatus(targetStatus);
            attempt.setScore(score);
            attempt.setCorrectCount(correctCount);
            attempt.setXpEarned(xpEarned);
            attempt.setTimeSpentSeconds(timeSpent);
            attempt.setSubmittedAt(now);
            attempt.setAnswersProgress(objectMapper.writeValueAsString(answers));
            attempt.setResultSummary(objectMapper.writeValueAsString(resultResponse));

            vocabTestAttemptRepository.save(attempt);
        } catch (Exception e) {
            log.error("Lỗi khi lưu kết quả bài thi: {}", e.getMessage());
            throw new IllegalStateException("Không thể lưu kết quả bài thi", e);
        }

        return resultResponse;
    }

    private VocabTestAttempt findOwnedAttempt(String testToken, Integer userId) {
        VocabTestAttempt attempt = vocabTestAttemptRepository.findByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));
        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }
        return attempt;
    }

    private List<VocabTestInternalQuestionDto> parseInternalQuestions(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Lỗi khi parse snapshot câu hỏi: {}", e.getMessage());
            return List.of();
        }
    }

    private List<VocabTestAnswerItemDto> parseSavedAnswers(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Lỗi khi parse snapshot tiến độ: {}", e.getMessage());
            return List.of();
        }
    }

    private VocabTestResultResponse parseResultSummary(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, VocabTestResultResponse.class);
        } catch (Exception e) {
            log.error("Lỗi khi parse result_summary: {}", e.getMessage());
            return null;
        }
    }
}
