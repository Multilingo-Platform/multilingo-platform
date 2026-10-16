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
import com.multilingo.backend.modules.vocab.service.quiz.TestProgressHasher;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VocabTestServiceImpl implements VocabTestService {

    private final VocabTestAttemptRepository vocabTestAttemptRepository;
    private final FlashcardDeckRepository flashcardDeckRepository;
    private final UserFlashcardRepository userFlashcardRepository;
    private final VocabTestProperties vocabTestProperties;
    private final TestProgressHasher testProgressHasher;
    private final StudyActivityService studyActivityService;
    private final ObjectMapper objectMapper;

    private static final List<String> OPTION_KEYS = List.of("A", "B", "C", "D");

    @Override
    @Transactional
    public VocabTestExamDto generateTest(Integer deckId, Integer userId, GenerateVocabTestRequest request) {
        FlashcardDeck deck = flashcardDeckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new AppException(ErrorCode.FLASHCARD_DECK_NOT_FOUND));

        List<UserFlashcard> allCards = userFlashcardRepository.findAllByDeckIdAndUserIdOrderByCreatedAtDesc(deckId, userId);
        if (allCards == null || allCards.size() < 4) {
            throw new AppException(ErrorCode.VOCAB_TEST_INSUFFICIENT_CARDS);
        }

        long distinctMeanings = allCards.stream()
                .map(UserFlashcard::getCustomMeaning)
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toLowerCase)
                .distinct()
                .count();

        if (distinctMeanings < 4) {
            log.warn("Bộ thẻ #{} không đủ 4 nghĩa phân biệt (hiện có {})", deckId, distinctMeanings);
            throw new AppException(ErrorCode.VOCAB_TEST_INSUFFICIENT_CARDS);
        }

        int limit = (request != null && request.getLimit() != null)
                ? Math.clamp(request.getLimit(), 4, 20)
                : 10;

        List<UserFlashcard> pool = new ArrayList<>(allCards);
        Collections.shuffle(pool, new Random());
        List<UserFlashcard> selectedCards = pool.subList(0, Math.min(limit, pool.size()));

        List<InternalQuestionSnapshot> internalQuestions = new ArrayList<>();
        List<VocabTestQuestionDto> publicQuestions = new ArrayList<>();

        Random random = new Random();
        int questionNumber = 1;

        for (UserFlashcard card : selectedCards) {
            String correctMeaning = card.getCustomMeaning() != null ? card.getCustomMeaning().trim() : "";
            String word = card.getCustomWord() != null ? card.getCustomWord().trim() : "";

            // Chọn 3 phương án nhiễu có nghĩa khác nghĩa đúng
            List<String> distractorMeanings = allCards.stream()
                    .map(UserFlashcard::getCustomMeaning)
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(m -> !m.equalsIgnoreCase(correctMeaning))
                    .distinct()
                    .collect(Collectors.toList());

            Collections.shuffle(distractorMeanings, random);
            List<String> pickedDistractors = distractorMeanings.subList(0, Math.min(3, distractorMeanings.size()));

            List<String> fourMeanings = new ArrayList<>(pickedDistractors);
            fourMeanings.add(correctMeaning);
            Collections.shuffle(fourMeanings, random);

            List<VocabTestOptionDto> options = new ArrayList<>();
            String correctKey = "A";

            for (int i = 0; i < fourMeanings.size(); i++) {
                String key = OPTION_KEYS.get(i);
                String text = fourMeanings.get(i);
                options.add(VocabTestOptionDto.builder().key(key).text(text).build());
                if (text.equalsIgnoreCase(correctMeaning)) {
                    correctKey = key;
                }
            }

            String phonetic = (card.getWord() != null) ? card.getWord().getPhonetic() : null;
            String pos = (card.getWord() != null) ? card.getWord().getPos() : null;
            String sentence = card.getExampleSentence();

            String explanation = word + (pos != null ? " (" + pos + ")" : "") + ": " + correctMeaning
                    + (sentence != null ? ". Ví dụ: " + sentence : "");

            InternalQuestionSnapshot internalQ = InternalQuestionSnapshot.builder()
                    .questionNumber(questionNumber)
                    .cardId(card.getId())
                    .word(word)
                    .phonetic(phonetic)
                    .pos(pos)
                    .sentence(sentence)
                    .options(options)
                    .correctKey(correctKey)
                    .explanation(explanation)
                    .build();

            internalQuestions.add(internalQ);

            // DTO gửi cho thí sinh: KHÔNG có correctKey và KHÔNG có explanation
            publicQuestions.add(VocabTestQuestionDto.builder()
                    .questionNumber(questionNumber)
                    .cardId(card.getId())
                    .word(word)
                    .phonetic(phonetic)
                    .pos(pos)
                    .sentence(sentence)
                    .options(options)
                    .build());

            questionNumber++;
        }

        Instant now = Instant.now();
        int timeLimitSeconds = internalQuestions.size() * vocabTestProperties.getSecondsPerQuestion();
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
            log.error("Lỗi khi serialize câu hỏi bài thi thử:", e);
            throw new IllegalStateException("Không thể lưu cấu trúc bài thi thử", e);
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
        VocabTestAttempt attempt = vocabTestAttemptRepository.findByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));

        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }

        Instant now = Instant.now();
        boolean deadlinePassed = now.isAfter(attempt.getExpiresAt().plusSeconds(vocabTestProperties.getSubmissionGraceSeconds()));

        List<InternalQuestionSnapshot> internalQuestions = parseInternalQuestions(attempt.getQuestionsSnapshot());
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
                .progressVersion(attempt.getProgressVersion())
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
        if (request == null || request.getExpectedVersion() == null) {
            throw new AppException(ErrorCode.VOCAB_TEST_VERSION_CONFLICT);
        }

        String canonicalHash = testProgressHasher.computeCanonicalHash(request.getExpectedVersion(), request.getAnswers());
        Instant now = Instant.now();
        Instant validUntil = now.minusSeconds(vocabTestProperties.getSubmissionGraceSeconds());

        String answersJson;
        try {
            answersJson = objectMapper.writeValueAsString(request.getAnswers() != null ? request.getAnswers() : List.of());
        } catch (Exception e) {
            throw new IllegalArgumentException("Payload answers không hợp lệ", e);
        }

        int rows = vocabTestAttemptRepository.updateAnswersProgressCas(
                testToken,
                userId,
                request.getExpectedVersion(),
                answersJson,
                canonicalHash,
                now,
                validUntil
        );

        if (rows == 1) {
            return AutoSaveProgressResponse.builder()
                    .progressVersion(request.getExpectedVersion() + 1)
                    .build();
        }

        // Không cập nhật được dòng nào -> Phân tích nguyên nhân xung đột
        VocabTestAttempt attempt = vocabTestAttemptRepository.findByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));

        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }

        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new AppException(ErrorCode.VOCAB_TEST_ALREADY_FINISHED);
        }

        if (now.isAfter(attempt.getExpiresAt().plusSeconds(vocabTestProperties.getSubmissionGraceSeconds()))) {
            throw new AppException(ErrorCode.VOCAB_TEST_DEADLINE_PASSED);
        }

        // Kiểm tra Replay khi mạng lag: cùng expectedVersion và hash trùng khớp
        if (attempt.getProgressVersion() == request.getExpectedVersion() + 1
                && canonicalHash.equals(attempt.getProgressHash())) {
            log.info("Replay idempotency autosave cho testToken={}", testToken);
            return AutoSaveProgressResponse.builder()
                    .progressVersion(attempt.getProgressVersion())
                    .build();
        }

        throw new AppException(ErrorCode.VOCAB_TEST_VERSION_CONFLICT);
    }

    @Override
    @Transactional
    public VocabTestResultResponse submitTest(String testToken, Integer userId, SubmitVocabTestRequest request) {
        VocabTestAttempt attempt = vocabTestAttemptRepository.findForUpdateByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));

        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }

        // Nếu bài thi đã ở trạng thái kết thúc -> Trả về kết quả đã lưu (Idempotency)
        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            return parseResultSummary(attempt.getResultSummary());
        }

        Instant now = Instant.now();
        boolean isExpired = now.isAfter(attempt.getExpiresAt().plusSeconds(vocabTestProperties.getSubmissionGraceSeconds()));

        List<VocabTestAnswerItemDto> answersToGrade;
        if (!isExpired) {
            if (request != null && !attempt.getProgressVersion().equals(request.getExpectedVersion())) {
                throw new AppException(ErrorCode.VOCAB_TEST_VERSION_CONFLICT);
            }
            answersToGrade = request != null && request.getAnswers() != null ? request.getAnswers() : List.of();
        } else {
            // Quá hạn: Bỏ qua payload request, chỉ chấm các câu đã lưu trong tiến độ
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
        if (now.isBefore(attempt.getExpiresAt().plusSeconds(vocabTestProperties.getSubmissionGraceSeconds()))) {
            return;
        }

        List<VocabTestAnswerItemDto> savedAnswers = parseSavedAnswers(attempt.getAnswersProgress());
        finalizeAttempt(attempt, savedAnswers, "TIMED_OUT", now);
        log.info("Scheduler tự động thu bài quá hạn thành công cho testToken={}", testToken);
    }

    private VocabTestResultResponse finalizeAttempt(VocabTestAttempt attempt,
                                                    List<VocabTestAnswerItemDto> answers,
                                                    String targetStatus,
                                                    Instant now) {
        List<InternalQuestionSnapshot> questions = parseInternalQuestions(attempt.getQuestionsSnapshot());
        Map<Integer, String> answerMap = answers.stream()
                .filter(a -> a.getQuestionNumber() != null && a.getSelectedKey() != null)
                .collect(Collectors.toMap(
                        VocabTestAnswerItemDto::getQuestionNumber,
                        a -> a.getSelectedKey().trim(),
                        (first, second) -> first
                ));

        int correctCount = 0;
        int answeredCount = 0;

        for (InternalQuestionSnapshot q : questions) {
            String selected = answerMap.get(q.getQuestionNumber());
            if (selected != null && !selected.isBlank()) {
                answeredCount++;
                if (selected.equalsIgnoreCase(q.getCorrectKey())) {
                    correctCount++;
                }
            }
        }

        int totalQuestions = attempt.getTotalQuestions() > 0 ? attempt.getTotalQuestions() : questions.size();
        int score = (int) Math.round(((double) correctCount / totalQuestions) * 100);

        int timeSpent = (int) Math.min(
                attempt.getTimeLimitSeconds(),
                Math.max(0, Duration.between(attempt.getStartedAt(), now).toSeconds())
        );

        // Quy tắc thưởng XP & Streak: Chỉ nhận khi có >= 1 lựa chọn hợp lệ
        int xpEarned = answeredCount > 0 ? 20 : 0;
        boolean qualifiesForStreak = answeredCount > 0;

        StudyActivityRecord activity = StudyActivityRecord.builder()
                .userId(attempt.getUserId())
                .studyMinutes(timeSpent / 60)
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
            log.error("Lỗi khi lưu kết quả bài thi thử:", e);
            throw new IllegalStateException("Không thể lưu kết quả bài thi", e);
        }

        return resultResponse;
    }

    @Override
    @Transactional(readOnly = true)
    public VocabTestReviewDetailDto reviewAnswers(String testToken, Integer userId) {
        VocabTestAttempt attempt = vocabTestAttemptRepository.findByTestToken(testToken)
                .orElseThrow(() -> new AppException(ErrorCode.VOCAB_TEST_NOT_FOUND));

        if (!attempt.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
        }

        if ("IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new AppException(ErrorCode.VOCAB_TEST_STILL_IN_PROGRESS);
        }

        List<InternalQuestionSnapshot> questions = parseInternalQuestions(attempt.getQuestionsSnapshot());
        List<VocabTestAnswerItemDto> answers = parseSavedAnswers(attempt.getAnswersProgress());

        Map<Integer, String> selectedMap = answers.stream()
                .filter(a -> a.getQuestionNumber() != null && a.getSelectedKey() != null)
                .collect(Collectors.toMap(
                        VocabTestAnswerItemDto::getQuestionNumber,
                        VocabTestAnswerItemDto::getSelectedKey,
                        (f, s) -> f
                ));

        List<VocabTestReviewItemDto> reviewItems = new ArrayList<>();
        for (InternalQuestionSnapshot q : questions) {
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

    private List<InternalQuestionSnapshot> parseInternalQuestions(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Lỗi khi parse snapshot câu hỏi bài thi:", e);
            return List.of();
        }
    }

    private List<VocabTestAnswerItemDto> parseSavedAnswers(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Lỗi khi parse snapshot tiến độ trả lời:", e);
            return List.of();
        }
    }

    private VocabTestResultResponse parseResultSummary(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, VocabTestResultResponse.class);
        } catch (Exception e) {
            log.error("Lỗi khi parse result_summary JSON:", e);
            return null;
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InternalQuestionSnapshot {
        private Integer questionNumber;
        private Integer cardId;
        private String word;
        private String phonetic;
        private String pos;
        private String sentence;
        private List<VocabTestOptionDto> options;
        private String correctKey;
        private String explanation;
    }
}
