package com.multilingo.backend.modules.testing.grading.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
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

    private static final Set<String> OBJECTIVE_TYPES = Set.of(
        "SINGLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN",
        "FILL_IN_THE_BLANK", "MULTIPLE_CHOICE", "MATCHING",
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
            case "SINGLE_CHOICE" -> gradeSingleChoice(questionId, key, rawAnswer);
            case "TRUE_FALSE_NOT_GIVEN" -> gradeTFNG(questionId, key, rawAnswer);
            case "YES_NO_NOT_GIVEN" -> gradeYNNG(questionId, key, rawAnswer);
            case "FILL_IN_THE_BLANK", "DIAGRAM_LABELING", "MAP_LABELING" ->
                gradeFillIn(questionId, key, rawAnswer);
            case "MULTIPLE_CHOICE" -> gradeMultipleChoice(questionId, key, rawAnswer);
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
        String userAns = normalize(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);

        String correct = normalize(key.getCorrect().toString());
        if (userAns.equals(correct)) return QuestionGradingResult.correct(questionId);

        List<String> alternates = key.getAlternates();
        if (alternates != null) {
            for (String alt : alternates) {
                if (userAns.equals(normalize(alt))) {
                    return QuestionGradingResult.correct(questionId);
                }
            }
        }
        return QuestionGradingResult.wrong(questionId);
    }

    // ─── MULTIPLE_CHOICE ─────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private QuestionGradingResult gradeMultipleChoice(
            String questionId, GradingKey key, Object rawAnswer) {
        if (rawAnswer == null) return QuestionGradingResult.blank(questionId);

        List<?> userList = rawAnswer instanceof List<?> list ? list : List.of(rawAnswer);
        if (userList.isEmpty()) return QuestionGradingResult.blank(questionId);

        Set<String> userSet = new HashSet<>();
        for (Object item : userList) userSet.add(normalize(item.toString()));

        List<?> correctList = (List<?>) key.getCorrect();
        Set<String> correctSet = new HashSet<>();
        for (Object item : correctList) correctSet.add(normalize(item.toString()));

        return userSet.equals(correctSet)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── MATCHING ────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private QuestionGradingResult gradeMatching(
            String questionId, GradingKey key, Object rawAnswer) {
        // correct: Map<String,String> subQuestionId -> answerId
        Map<String, String> correctMap = (Map<String, String>) key.getCorrect();
        Map<String, Object> userMap = rawAnswer instanceof Map<?, ?>
            ? (Map<String, Object>) rawAnswer : Collections.emptyMap();

        BigDecimal score = BigDecimal.ZERO;
        int totalPairs = correctMap.size();
        int correctPairs = 0;

        for (Map.Entry<String, String> entry : correctMap.entrySet()) {
            String subId = entry.getKey();
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
        if (correctPairs == totalPairs) {
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

    /** Chuẩn hóa chung: trim + toLowerCase(Locale.ROOT). Trả null nếu blank. */
    private String normalize(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim().toLowerCase(Locale.ROOT);
        return s.isEmpty() ? null : s;
    }

    /** Chuẩn hóa TRUE_FALSE_NOT_GIVEN: "not given" → "not_given". */
    private String normalizeTFNG(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim().toLowerCase(Locale.ROOT)
            .replace(" ", "_");  // "not given" → "not_given"
        return s.isEmpty() ? null : s;
    }

    /** Chuẩn hóa YES_NO_NOT_GIVEN: "not given" → "not_given". */
    private String normalizeYNNG(Object raw) {
        return normalizeTFNG(raw);
    }
}
