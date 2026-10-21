package com.multilingo.backend.modules.testing.grading.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.IeltsAnswerGroupEvaluator;
import com.multilingo.backend.modules.testing.grading.AnswerTextNormalizer;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

/**
 * Engine chấm điểm khách quan — pure domain logic.
 * KHÔNG inject Repository hoặc gọi API bên ngoài.
 */
@Service
public class ObjectiveGradingServiceImpl implements ObjectiveGradingService {

    private final IeltsAnswerGroupEvaluator answerGroupEvaluator = new IeltsAnswerGroupEvaluator();

    private static final Set<String> OBJECTIVE_TYPES = Set.of(
        "SINGLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN",
        "FILL_IN_THE_BLANK", "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_MULTI", "MATCHING",
        "MATCHING_FEATURES", "MATCHING_HEADINGS", "MATCHING_SENTENCE_ENDINGS", "MATCHING_INFORMATION",
        "DIAGRAM_LABELING", "MAP_LABELING"
    );

    private static final Set<String> SKIP_TYPES = Set.of("ESSAY");

    @Override
    public GradingResult gradeAttempt(
            List<AttemptAnswer> answers,
            Map<Integer, PartGradingKey> partKeys) {

        Map<Integer, Map<String, QuestionGradingResult>> partResults = new HashMap<>();
        Map<String, BigDecimal> sectionScores = new HashMap<>();
        BigDecimal totalScore = BigDecimal.ZERO;
        int correctCount = 0;
        int totalObjectiveCount = 0;

        for (AttemptAnswer aa : answers) {
            Integer partId = aa.getPartId();
            PartGradingKey pgk = partKeys.get(partId);
            if (pgk == null) {
                // Không có key cho Part → bỏ qua (câu không được đếm)
                continue;
            }

            Map<String, Object> userAnswers =
                aa.getUserAnswers() != null ? aa.getUserAnswers() : Collections.emptyMap();

            Map<String, QuestionGradingResult> partResult = new HashMap<>();
            Map<String, GradingKey.AnswerGroup> evaluatedAnswerGroups = new HashMap<>();

            for (Map.Entry<String, GradingKey> keyEntry : pgk.getAnswers().entrySet()) {
                String questionId = keyEntry.getKey();
                GradingKey key = keyEntry.getValue();
                String type = key.getType();

                if (type == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "GRADING_DATA_ERROR: GradingKey type is null for questionId: " + questionId);
                }

                // ESSAY và type không xác định → bỏ qua hoàn toàn
                if (SKIP_TYPES.contains(type)) {
                    continue;
                }
                if (!OBJECTIVE_TYPES.contains(type)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "GRADING_DATA_ERROR: Unknown question type in grading fixture: " + type
                        + " for questionId: " + questionId);
                }

                if (key.getAnswerGroup() != null) {
                    String answerGroupId = key.getAnswerGroup().id();
                    if (answerGroupId == null || answerGroupId.isBlank()) {
                        throw new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group is invalid.");
                    }
                    GradingKey.AnswerGroup previousGroup = evaluatedAnswerGroups.putIfAbsent(
                            answerGroupId, key.getAnswerGroup());
                    if (previousGroup != null && !previousGroup.equals(key.getAnswerGroup())) {
                        throw new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group ID is reused.");
                    }
                    if (previousGroup == null) {
                        Map<String, QuestionGradingResult> groupResults = answerGroupEvaluator.evaluate(
                                pgk.getAnswers(), userAnswers, key);
                        partResult.putAll(groupResults);
                        for (QuestionGradingResult groupResult : groupResults.values()) {
                            totalObjectiveCount++;
                            if (groupResult.getVerdict() == GradingVerdict.CORRECT) correctCount++;
                            totalScore = totalScore.add(groupResult.getScore());
                        }
                    }
                    continue;
                }

                if (key.getCorrect() == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "GRADING_DATA_ERROR: correct is null for questionId: " + questionId);
                }

                Object rawAnswer = userAnswers.get(questionId);
                QuestionGradingResult qResult = gradeQuestion(questionId, type, key, rawAnswer);
                partResult.put(questionId, qResult);

                totalObjectiveCount++;
                if (qResult.getVerdict() == GradingVerdict.CORRECT) {
                    correctCount++;
                }
                totalScore = totalScore.add(qResult.getScore());
            }

            partResults.put(partId, partResult);

            // Accumulate sectionScores from PartGradingKey.sectionName
            String sectionName = pgk.getSectionName();
            if (sectionName != null && !sectionName.isBlank()) {
                BigDecimal partScore = partResult.values().stream()
                    .map(QuestionGradingResult::getScore)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                sectionScores.merge(sectionName, partScore, BigDecimal::add);
            }
        }

        return GradingResult.builder()
            .partResults(partResults)
            .totalScore(totalScore)
            .correctCount(correctCount)
            .totalObjectiveCount(totalObjectiveCount)
            .sectionScores(sectionScores)
            .build();
    }

    // ─── Private: dispatch theo type ────────────────────────────────────────────

    private QuestionGradingResult gradeQuestion(
            String questionId, String type, GradingKey key, Object rawAnswer) {
        return switch (type) {
            case "SINGLE_CHOICE", "MATCHING_FEATURES", "MATCHING_HEADINGS", "MATCHING_SENTENCE_ENDINGS", "MATCHING_INFORMATION",
                 "MAP_LABELING", "FILL_IN_THE_BLANK", "DIAGRAM_LABELING" ->
                gradeFillIn(questionId, key, rawAnswer);
            case "TRUE_FALSE_NOT_GIVEN" -> gradeTFNG(questionId, key, rawAnswer);
            case "YES_NO_NOT_GIVEN" -> gradeYNNG(questionId, key, rawAnswer);
            case "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_MULTI" -> gradeMultipleChoice(questionId, type, key, rawAnswer);
            case "MATCHING" -> gradeMatching(questionId, key, rawAnswer);
            default -> throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                "GRADING_DATA_ERROR: Unhandled type: " + type);
        };
    }

    // ─── SINGLE_CHOICE ───────────────────────────────────────────────────────────

    private QuestionGradingResult gradeSingleChoice(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalize(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalize(key.getCorrect().toString());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── TRUE_FALSE_NOT_GIVEN ────────────────────────────────────────────────────

    private QuestionGradingResult gradeTFNG(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalizeTFNG(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalizeTFNG(key.getCorrect());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── YES_NO_NOT_GIVEN ────────────────────────────────────────────────────────

    private QuestionGradingResult gradeYNNG(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalizeYNNG(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalizeYNNG(key.getCorrect());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── FILL_IN_THE_BLANK / DIAGRAM_LABELING / MAP_LABELING ────────────────────

    private QuestionGradingResult gradeFillIn(
            String questionId, GradingKey key, Object rawAnswer) {
        boolean nfc = key.isNormalizeNfc();
        String userAns = normalize(rawAnswer, nfc);
        if (userAns == null) return QuestionGradingResult.blank(questionId);

        Object correctObj = key.getCorrect();
        if (correctObj instanceof Collection<?> coll) {
            for (Object opt : coll) {
                if (userAns.equals(normalize(opt, nfc))) {
                    return QuestionGradingResult.correct(questionId);
                }
            }
        } else if (correctObj != null) {
            if (userAns.equals(normalize(correctObj, nfc))) {
                return QuestionGradingResult.correct(questionId);
            }
        }

        List<String> alternates = key.getAlternates();
        if (alternates != null) {
            for (String alt : alternates) {
                if (userAns.equals(normalize(alt, nfc))) {
                    return QuestionGradingResult.correct(questionId);
                }
            }
        }
        return QuestionGradingResult.wrong(questionId);
    }

    // ─── MULTIPLE_CHOICE ─────────────────────────────────────────────────────────

    private QuestionGradingResult gradeMultipleChoice(
            String questionId, String type, GradingKey key, Object rawAnswer) {
        if (rawAnswer == null) return QuestionGradingResult.blank(questionId);

        List<?> userList = rawAnswer instanceof List<?> list ? list : List.of(rawAnswer);
        if (userList.isEmpty()) return QuestionGradingResult.blank(questionId);

        Set<String> userSet = new HashSet<>();
        for (Object item : userList) {
            String norm = normalize(item);
            if (norm != null) {
                userSet.add(norm);
            }
        }
        if (userSet.isEmpty()) return QuestionGradingResult.blank(questionId);

        Set<String> correctSet = new HashSet<>();
        Object correctObj = key.getCorrect();
        if (correctObj instanceof Collection<?> coll) {
            for (Object item : coll) {
                String norm = normalize(item);
                if (norm != null) {
                    correctSet.add(norm);
                }
            }
        } else if (correctObj != null) {
            String norm = normalize(correctObj);
            if (norm != null) {
                correctSet.add(norm);
            }
        }

        if (userSet.equals(correctSet)) {
            return QuestionGradingResult.correct(questionId);
        }

        if ("MULTIPLE_CHOICE_MULTI".equalsIgnoreCase(type) && correctSet.size() > 1 && userSet.size() == 1) {
            String single = userSet.iterator().next();
            if (correctSet.contains(single)) {
                return QuestionGradingResult.correct(questionId);
            }
        }

        if (key.getAlternates() != null && !key.getAlternates().isEmpty()) {
            if (userSet.size() == 1) {
                String userSingle = userSet.iterator().next();
                for (String alt : key.getAlternates()) {
                    if (userSingle.equals(normalize(alt))) {
                        return QuestionGradingResult.correct(questionId);
                    }
                }
            } else {
                Set<String> altSet = new HashSet<>();
                for (String alt : key.getAlternates()) {
                    String norm = normalize(alt);
                    if (norm != null) {
                        altSet.add(norm);
                    }
                }
                if (userSet.equals(altSet)) {
                    return QuestionGradingResult.correct(questionId);
                }
            }
        }

        return QuestionGradingResult.wrong(questionId);
    }

    // ─── MATCHING ────────────────────────────────────────────────────────────────

    private QuestionGradingResult gradeMatching(
            String questionId, GradingKey key, Object rawAnswer) {
        if (!(key.getCorrect() instanceof Map<?, ?>)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                "GRADING_DATA_ERROR: correct is not a Map for MATCHING questionId: " + questionId);
        }

        Map<?, ?> correctMap = (Map<?, ?>) key.getCorrect();
        Map<?, ?> userMap = rawAnswer instanceof Map<?, ?> map ? map : Collections.emptyMap();

        BigDecimal score = BigDecimal.ZERO;
        int totalPairs = correctMap.size();
        int correctPairs = 0;

        for (Map.Entry<?, ?> entry : correctMap.entrySet()) {
            String subId = String.valueOf(entry.getKey());
            String correctAns = normalize(entry.getValue());
            Object userRaw = userMap.get(subId);
            String userAns = normalize(userRaw);
            if (correctAns != null && correctAns.equals(userAns)) {
                score = score.add(BigDecimal.ONE);
                correctPairs++;
            }
        }

        // MATCHING partial credit: score = số cặp đúng, nhưng verdict CORRECT chỉ khi
        // tất cả cặp đều đúng. Nếu không có cặp nào đúng và user không gửi map → BLANK.
        GradingVerdict verdict;
        if (correctPairs == totalPairs && totalPairs > 0) {
            verdict = GradingVerdict.CORRECT;
        } else if (userMap.isEmpty()) {
            verdict = GradingVerdict.BLANK;
        } else {
            verdict = GradingVerdict.WRONG;
        }

        return QuestionGradingResult.builder()
            .questionId(questionId)
            .verdict(verdict)
            .score(score)
            .build();
    }

    // ─── Normalize helpers ───────────────────────────────────────────────────────

    /** Chuẩn hóa chung: trim + toLowerCase(Locale.ROOT) + collapse spaces. Trả null nếu blank. */
    private String normalize(Object raw) {
        return normalize(raw, false);
    }

    private String normalize(Object raw, boolean nfc) {
        return AnswerTextNormalizer.normalize(raw == null ? null : raw.toString(), nfc);
    }

    /** Chuẩn hóa TRUE_FALSE_NOT_GIVEN: "not given" → "not_given", hỗ trợ viết tắt t, f, ng. */
    private String normalizeTFNG(Object raw) {
        String s = normalize(raw);
        if (s == null) return null;
        s = s.replace(" ", "_");
        return switch (s) {
            case "t", "true" -> "true";
            case "f", "false" -> "false";
            case "ng", "not_given" -> "not_given";
            default -> s;
        };
    }

    /** Chuẩn hóa YES_NO_NOT_GIVEN: "not given" → "not_given", hỗ trợ viết tắt y, n, ng. */
    private String normalizeYNNG(Object raw) {
        String s = normalize(raw);
        if (s == null) return null;
        s = s.replace(" ", "_");
        return switch (s) {
            case "y", "yes" -> "yes";
            case "n", "no" -> "no";
            case "ng", "not_given" -> "not_given";
            default -> s;
        };
    }
}
