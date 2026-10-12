package com.multilingo.backend.modules.vocab.service.quiz;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.vocab.constant.QuizPracticeConstants;
import com.multilingo.backend.modules.vocab.dto.response.PracticeOptionDto;
import com.multilingo.backend.modules.vocab.dto.response.PracticeQuestionSnapshotDto;
import com.multilingo.backend.modules.vocab.entity.UserFlashcard;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

@Slf4j
@Component
public class QuizQuestionGenerator {

    public static final int MIN_REQUIRED_CARDS = QuizPracticeConstants.MIN_REQUIRED_CARDS;
    public static final int DEFAULT_QUESTION_LIMIT = QuizPracticeConstants.DEFAULT_QUESTION_LIMIT;
    public static final int OPTIONS_PER_QUESTION = QuizPracticeConstants.OPTIONS_PER_QUESTION;

    /**
     * Sinh bộ câu hỏi trắc nghiệm Practice snapshot cho Redis và Frontend (gồm options và correctOptionId).
     */
    public List<PracticeQuestionSnapshotDto> generatePracticeQuestions(
            List<UserFlashcard> allDeckCards,
            String filterStatus,
            int limit,
            Random random
    ) {
        if (allDeckCards == null || allDeckCards.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        long distinctMeanings = allDeckCards.stream()
                .map(UserFlashcard::getCustomMeaning)
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toLowerCase)
                .distinct()
                .count();

        if (distinctMeanings < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            log.warn("Không đủ số lượng nghĩa phân biệt trong bộ thẻ: {} nghĩa (yêu cầu tối thiểu {})",
                    distinctMeanings, QuizPracticeConstants.MIN_REQUIRED_CARDS);
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        Instant now = Instant.now();
        String normalizedFilter = (filterStatus != null && !filterStatus.isBlank())
                ? filterStatus.trim().toUpperCase()
                : QuizPracticeConstants.FILTER_STATUS_ALL;

        List<UserFlashcard> eligibleCards = allDeckCards.stream()
                .filter(card -> matchesFilter(card, normalizedFilter, now))
                .toList();

        if (eligibleCards.size() < QuizPracticeConstants.MIN_REQUIRED_CARDS) {
            log.warn("Không đủ từ vựng sau khi lọc theo status='{}': {} thẻ tìm thấy (yêu cầu tối thiểu {})",
                    normalizedFilter, eligibleCards.size(), QuizPracticeConstants.MIN_REQUIRED_CARDS);
            throw new AppException(ErrorCode.QUIZ_INSUFFICIENT_CONTENT);
        }

        int targetCount = (limit > 0)
                ? Math.min(limit, eligibleCards.size())
                : Math.min(QuizPracticeConstants.DEFAULT_QUESTION_LIMIT, eligibleCards.size());

        List<UserFlashcard> shuffledEligible = new ArrayList<>(eligibleCards);
        Collections.shuffle(shuffledEligible, random);
        List<UserFlashcard> selectedCards = shuffledEligible.subList(0, targetCount);

        List<PracticeQuestionSnapshotDto> questions = new ArrayList<>(targetCount);
        String[] optionKeys = QuizPracticeConstants.OPTION_KEYS;

        for (int i = 0; i < selectedCards.size(); i++) {
            UserFlashcard targetCard = selectedCards.get(i);
            String correctMeaning = targetCard.getCustomMeaning();

            List<String> distractorPool = allDeckCards.stream()
                    .map(UserFlashcard::getCustomMeaning)
                    .filter(m -> m != null && !m.trim().equalsIgnoreCase(correctMeaning.trim()))
                    .distinct()
                    .toList();

            List<String> shuffledDistractors = new ArrayList<>(distractorPool);
            Collections.shuffle(shuffledDistractors, random);
            List<String> chosenDistractors = shuffledDistractors.subList(
                    0,
                    Math.min(QuizPracticeConstants.OPTIONS_PER_QUESTION - 1, shuffledDistractors.size())
            );

            List<String> rawOptions = new ArrayList<>();
            rawOptions.add(correctMeaning);
            rawOptions.addAll(chosenDistractors);
            Collections.shuffle(rawOptions, random);

            List<PracticeOptionDto> options = new ArrayList<>();
            String correctOptionId = QuizPracticeConstants.DEFAULT_CORRECT_OPTION;
            for (int k = 0; k < rawOptions.size(); k++) {
                String key = (k < optionKeys.length) ? optionKeys[k] : String.valueOf((char) ('A' + k));
                String text = rawOptions.get(k);
                options.add(new PracticeOptionDto(key, text));
                if (text.trim().equalsIgnoreCase(correctMeaning.trim())) {
                    correctOptionId = key;
                }
            }

            String phonetic = (targetCard.getWord() != null) ? targetCard.getWord().getPhonetic() : null;
            String pos = (targetCard.getWord() != null) ? targetCard.getWord().getPos() : null;
            String explanation = String.format(QuizPracticeConstants.EXPLANATION_TEMPLATE, targetCard.getCustomWord(), correctMeaning);

            PracticeQuestionSnapshotDto qDto = PracticeQuestionSnapshotDto.builder()
                    .questionId(i + 1)
                    .cardId(targetCard.getId())
                    .targetWord(targetCard.getCustomWord())
                    .phonetic(phonetic)
                    .pos(pos)
                    .sentence(targetCard.getExampleSentence())
                    .options(options)
                    .correctOptionId(correctOptionId)
                    .explanation(explanation)
                    .build();

            questions.add(qDto);
        }

        return questions;
    }

    private boolean matchesFilter(UserFlashcard card, String filterStatus, Instant now) {
        if (QuizPracticeConstants.FILTER_STATUS_ALL.equals(filterStatus)) {
            return true;
        }
        if (QuizPracticeConstants.FILTER_STATUS_DUE.equals(filterStatus)) {
            return card.getNextReviewDate() != null
                    && !card.getNextReviewDate().isAfter(now)
                    && (card.getStatus() == null || !com.multilingo.backend.modules.vocab.constant.VocabStudyConstants.STATUS_MASTERED.equalsIgnoreCase(card.getStatus()));
        }
        return card.getStatus() != null && card.getStatus().equalsIgnoreCase(filterStatus);
    }
}
