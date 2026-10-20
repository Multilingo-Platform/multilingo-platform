package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.QuestionGradingResult;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Scores the two answer slots in an IELTS distinct, unordered answer group. */
public final class IeltsAnswerGroupEvaluator {

    public Map<String, QuestionGradingResult> evaluate(Map<String, GradingKey> partKeys,
            Map<String, Object> userAnswers, GradingKey member) {
        GradingKey.AnswerGroup group = member == null ? null : member.getAnswerGroup();
        if (group == null || group.id().isBlank() || !"DISTINCT_UNORDERED".equals(group.mode())
                || group.questionIds().size() != 2 || new HashSet<>(group.questionIds()).size() != 2) {
            throw invalidGroup();
        }

        Map<String, Object> answers = userAnswers == null ? Map.of() : userAnswers;
        GradingKey first = partKeys == null ? null : partKeys.get(group.questionIds().get(0));
        GradingKey second = partKeys == null ? null : partKeys.get(group.questionIds().get(1));
        if (first == null || second == null || !sameGroup(group, first.getAnswerGroup())
                || !sameGroup(group, second.getAnswerGroup())
                || !group.questionIds().get(0).equals(first.getQuestionId())
                || !group.questionIds().get(1).equals(second.getQuestionId())
                || !"SINGLE_CHOICE".equals(first.getType()) || !"SINGLE_CHOICE".equals(second.getType())) {
            throw invalidGroup();
        }

        Set<String> correct = correctOptions(first.getCorrect());
        if (!correct.equals(correctOptions(second.getCorrect()))) throw invalidGroup();

        Set<String> alreadyScored = new HashSet<>();
        Map<String, QuestionGradingResult> results = new LinkedHashMap<>();
        for (String questionId : group.questionIds()) {
            String answer = normalize(answers.get(questionId));
            QuestionGradingResult result;
            if (answer == null) result = QuestionGradingResult.blank(questionId);
            else if (correct.contains(answer) && alreadyScored.add(answer))
                result = QuestionGradingResult.correct(questionId);
            else result = QuestionGradingResult.wrong(questionId);
            results.put(questionId, result);
        }
        return Collections.unmodifiableMap(results);
    }

    private static boolean sameGroup(GradingKey.AnswerGroup expected, GradingKey.AnswerGroup actual) {
        return actual != null && expected.id().equals(actual.id()) && expected.mode().equals(actual.mode())
                && expected.questionIds().equals(actual.questionIds());
    }

    private static Set<String> correctOptions(Object value) {
        if (!(value instanceof Collection<?> collection) || collection.size() != 2) throw invalidGroup();
        Set<String> options = new HashSet<>();
        for (Object item : collection) {
            String option = normalize(item);
            if (option == null || !options.add(option)) throw invalidGroup();
        }
        return Set.copyOf(options);
    }

    private static String normalize(Object value) {
        if (!(value instanceof String text)) return null;
        String normalized = text.trim().toUpperCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private static AppException invalidGroup() {
        return new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group is invalid.");
    }
}
