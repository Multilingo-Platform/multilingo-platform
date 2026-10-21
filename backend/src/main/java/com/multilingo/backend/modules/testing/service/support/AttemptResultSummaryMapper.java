package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse;
import com.multilingo.backend.modules.testing.dto.response.ResultSummaryResponse.*;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import com.multilingo.backend.modules.testing.util.AttemptResultScope.ScopedPart;
import com.multilingo.backend.modules.testing.util.AttemptResultScope.ScopedQuestion;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class AttemptResultSummaryMapper {

    private static final Pattern UNICODE_WORD_PATTERN = Pattern.compile("\\S+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final BigDecimal MAX_COLUMN_SCORE = new BigDecimal("99999999.99");

    private final ObjectMapper objectMapper;

    public ResultSummaryResponse map(TestAttempt attempt, List<AttemptAnswer> savedAnswers) {
        if (attempt == null || attempt.getResultSummary() == null || attempt.getResultSummary().isBlank()) {
            return null;
        }
        if (attempt.getExamSnapshot() == null) {
            return null;
        }

        List<ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(attempt.getExamSnapshot());
        } catch (Exception e) {
            log.warn("Snapshot scope parse failed for attempt {}: {}", attempt.getId(), e.getClass().getSimpleName());
            return null;
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(attempt.getResultSummary());
        } catch (Exception e) {
            log.warn("Result summary JSON parse failed for attempt {}: {}", attempt.getId(), e.getClass().getSimpleName());
            return null;
        }
        if (root == null || !root.isObject()) {
            return null;
        }

        try {
            JsonNode totalObjectiveCountNode = root.get("totalObjectiveCount");
            JsonNode correctCountNode = root.get("correctCount");
            JsonNode totalScoreNode = root.get("totalScore");
            JsonNode partResultsNode = root.get("partResults");

            if (totalObjectiveCountNode == null || !totalObjectiveCountNode.isIntegralNumber() || !totalObjectiveCountNode.canConvertToInt() ||
                    correctCountNode == null || !correctCountNode.isIntegralNumber() || !correctCountNode.canConvertToInt() ||
                    totalScoreNode == null || !totalScoreNode.isNumber() ||
                    partResultsNode == null || !partResultsNode.isObject()) {
                return null;
            }

            int jsonTotalObjectiveCount = totalObjectiveCountNode.asInt();
            int jsonCorrectCount = correctCountNode.asInt();
            BigDecimal jsonTotalScore = parseSafeScore(totalScoreNode);

            if (jsonTotalScore == null || jsonTotalObjectiveCount < 0 || jsonCorrectCount < 0) {
                return null;
            }

            // Expected objective questions by part
            Map<Integer, Map<String, ScopedQuestion>> expectedObjByPart = new LinkedHashMap<>();
            int expectedTotalObjectiveCount = 0;

            for (ScopedPart part : scopedParts) {
                Map<String, ScopedQuestion> partObj = new LinkedHashMap<>();
                for (ScopedQuestion q : part.getQuestions()) {
                    if (q.isObjective()) {
                        partObj.put(q.getQuestionId(), q);
                        expectedTotalObjectiveCount++;
                    }
                }
                if (!partObj.isEmpty()) {
                    expectedObjByPart.put(part.getPartId(), partObj);
                }
            }

            Map<Integer, Map<String, QuestionResultDto>> parsedQuestionResults = new LinkedHashMap<>();
            Set<Integer> seenPartIds = new HashSet<>();
            int verifiedTotalCount = 0;
            int verifiedCorrectCount = 0;
            int verifiedIncorrectCount = 0;
            int verifiedUnansweredCount = 0;
            BigDecimal verifiedTotalScore = BigDecimal.ZERO;

            Iterator<Map.Entry<String, JsonNode>> partFields = partResultsNode.fields();
            while (partFields.hasNext()) {
                Map.Entry<String, JsonNode> partEntry = partFields.next();
                Integer partId = parsePartIdKey(partEntry.getKey());
                if (partId == null) {
                    return null;
                }
                if (!seenPartIds.add(partId)) {
                    return null; // Reject duplicate normalized part IDs / aliases
                }

                JsonNode partObjNode = partEntry.getValue();
                if (partObjNode == null || !partObjNode.isObject()) {
                    return null;
                }

                Map<String, ScopedQuestion> expectedInThisPart = expectedObjByPart.get(partId);
                if (expectedInThisPart == null) {
                    if (partObjNode.size() > 0) {
                        return null; // Verdict for part with no objective questions in snapshot
                    }
                    continue;
                }

                Map<String, QuestionResultDto> partQuestionsMap = new LinkedHashMap<>();
                Iterator<Map.Entry<String, JsonNode>> qFields = partObjNode.fields();
                while (qFields.hasNext()) {
                    Map.Entry<String, JsonNode> qEntry = qFields.next();
                    String qId = qEntry.getKey();
                    JsonNode qNode = qEntry.getValue();

                    if (qNode == null || !qNode.isObject()) {
                        return null;
                    }

                    ScopedQuestion scopedQ = expectedInThisPart.get(qId);
                    if (scopedQ == null) {
                        return null; // Question out of scope
                    }

                    JsonNode qIdNode = qNode.get("questionId");
                    if (qIdNode == null || !qId.equals(qIdNode.asText().trim())) {
                        return null;
                    }

                    JsonNode verdictNode = qNode.get("verdict");
                    if (verdictNode == null || verdictNode.asText().trim().isEmpty()) {
                        return null;
                    }
                    String verdictStr = verdictNode.asText().trim().toUpperCase(Locale.ROOT);
                    if (!"CORRECT".equals(verdictStr) && !"WRONG".equals(verdictStr) && !"BLANK".equals(verdictStr)) {
                        return null;
                    }

                    JsonNode scoreNode = qNode.get("score");
                    BigDecimal score = parseSafeScore(scoreNode);
                    if (score == null) {
                        return null;
                    }

                    // Validate verdict / score consistency with engine semantics
                    if ("BLANK".equals(verdictStr)) {
                        if (score.compareTo(BigDecimal.ZERO) != 0) {
                            return null;
                        }
                    } else if ("WRONG".equals(verdictStr)) {
                        if (!"MATCHING".equals(scopedQ.getType()) && score.compareTo(BigDecimal.ZERO) != 0) {
                            return null;
                        }
                    } else if ("CORRECT".equals(verdictStr)) {
                        if ("MATCHING".equals(scopedQ.getType())) {
                            if (score.compareTo(BigDecimal.ZERO) <= 0) {
                                return null;
                            }
                        } else {
                            if (score.compareTo(BigDecimal.ONE) != 0) {
                                return null;
                            }
                        }
                    }

                    if ("CORRECT".equals(verdictStr)) {
                        verifiedCorrectCount++;
                    } else if ("WRONG".equals(verdictStr)) {
                        verifiedIncorrectCount++;
                    } else {
                        verifiedUnansweredCount++;
                    }
                    verifiedTotalCount++;
                    verifiedTotalScore = verifiedTotalScore.add(score);

                    partQuestionsMap.put(qId, QuestionResultDto.builder()
                            .questionId(qId)
                            .verdict(verdictStr)
                            .score(score)
                            .build());
                }

                parsedQuestionResults.put(partId, partQuestionsMap);
            }

            // Completeness check per part: all expected objective parts and their questions must be present
            for (Map.Entry<Integer, Map<String, ScopedQuestion>> expectedEntry : expectedObjByPart.entrySet()) {
                Integer expectedPartId = expectedEntry.getKey();
                Map<String, ScopedQuestion> expectedQuestions = expectedEntry.getValue();
                Map<String, QuestionResultDto> actualQuestions = parsedQuestionResults.get(expectedPartId);
                if (actualQuestions == null) {
                    return null;
                }
                if (actualQuestions.size() != expectedQuestions.size()) {
                    return null;
                }
                for (String expectedQId : expectedQuestions.keySet()) {
                    if (!actualQuestions.containsKey(expectedQId)) {
                        return null;
                    }
                }
            }
            if (parsedQuestionResults.size() != expectedObjByPart.size()) {
                return null;
            }

            // Completeness check: all expected objective questions must have a result
            if (verifiedTotalCount != expectedTotalObjectiveCount) {
                return null;
            }

            // Consistency check against root JSON counters
            if (verifiedTotalCount != jsonTotalObjectiveCount) {
                return null;
            }
            if (verifiedCorrectCount != jsonCorrectCount) {
                return null;
            }
            if (verifiedTotalScore.compareTo(jsonTotalScore) != 0) {
                return null;
            }

            // Consistency check against attempt overallScore if present
            if (attempt.getOverallScore() != null && attempt.getOverallScore().compareTo(verifiedTotalScore) != 0) {
                return null;
            }

            // Build Objective summary
            BigDecimal overallAccuracy = calculateAccuracy(verifiedCorrectCount, verifiedTotalCount);

            List<PartObjectiveStats> byPart = new ArrayList<>();
            LinkedHashMap<String, SkillAccumulator> skillMap = new LinkedHashMap<>();

            for (ScopedPart sp : scopedParts) {
                Map<String, QuestionResultDto> partQMap = parsedQuestionResults.get(sp.getPartId());
                if (partQMap == null || partQMap.isEmpty()) {
                    // Skip parts without objective questions (e.g. only ESSAY)
                    continue;
                }

                SkillAccumulator skillAcc = skillMap.computeIfAbsent(sp.getSkill(), SkillAccumulator::new);

                int pCorrect = 0;
                int pIncorrect = 0;
                int pUnanswered = 0;
                int pTotal = 0;
                BigDecimal pRawScore = BigDecimal.ZERO;

                for (ScopedQuestion sq : sp.getQuestions()) {
                    if (!sq.isObjective()) continue;
                    QuestionResultDto qDto = partQMap.get(sq.getQuestionId());
                    if ("CORRECT".equals(qDto.getVerdict())) {
                        pCorrect++;
                        skillAcc.correct++;
                    } else if ("WRONG".equals(qDto.getVerdict())) {
                        pIncorrect++;
                        skillAcc.incorrect++;
                    } else {
                        pUnanswered++;
                        skillAcc.unanswered++;
                    }
                    pTotal++;
                    skillAcc.total++;
                    pRawScore = pRawScore.add(qDto.getScore());
                    skillAcc.rawScore = skillAcc.rawScore.add(qDto.getScore());
                }

                byPart.add(PartObjectiveStats.builder()
                        .partId(sp.getPartId())
                        .label(sp.getLabel())
                        .skill(sp.getSkill())
                        .rawScore(pRawScore)
                        .correct(pCorrect)
                        .incorrect(pIncorrect)
                        .unanswered(pUnanswered)
                        .total(pTotal)
                        .accuracy(calculateAccuracy(pCorrect, pTotal))
                        .build());
            }

            List<SkillObjectiveStats> bySkill = new ArrayList<>();
            Map<String, BigDecimal> sectionScores = new LinkedHashMap<>();

            for (SkillAccumulator acc : skillMap.values()) {
                bySkill.add(SkillObjectiveStats.builder()
                        .skill(acc.skill)
                        .rawScore(acc.rawScore)
                        .correct(acc.correct)
                        .incorrect(acc.incorrect)
                        .unanswered(acc.unanswered)
                        .total(acc.total)
                        .accuracy(calculateAccuracy(acc.correct, acc.total))
                        .build());
                sectionScores.put(acc.skill, acc.rawScore);
            }

            ObjectiveSummary objective = ObjectiveSummary.builder()
                    .rawScore(verifiedTotalScore)
                    .correct(verifiedCorrectCount)
                    .incorrect(verifiedIncorrectCount)
                    .unanswered(verifiedUnansweredCount)
                    .total(verifiedTotalCount)
                    .accuracy(overallAccuracy)
                    .scoreUnit("RAW_OBJECTIVE")
                    .bySkill(bySkill)
                    .byPart(byPart)
                    .build();

            // Build Writing summary
            List<WritingTaskSummary> writingTasks = new ArrayList<>();
            String writingStatus = resolveWritingStatus(attempt.getStatus());
            String examLanguage = extractExamLanguage(attempt.getExamSnapshot());
            com.multilingo.backend.modules.testing.util.WritingLengthCounter lengthCounter = new com.multilingo.backend.modules.testing.util.WritingLengthCounter();

            for (ScopedPart sp : scopedParts) {
                for (ScopedQuestion sq : sp.getQuestions()) {
                    if ("ESSAY".equals(sq.getType())) {
                        String rawText = extractRawAnswer(savedAnswers, sp.getPartId(), sq.getQuestionId());
                        com.multilingo.backend.modules.testing.util.WritingLengthCounter.WritingLengthMetric lengthMetric = lengthCounter.count(rawText, examLanguage);
                        String taskLabel = (sq.getLabel() != null && !sq.getLabel().isBlank())
                                ? sq.getLabel()
                                : sp.getLabel();

                        writingTasks.add(WritingTaskSummary.builder()
                                .partId(sp.getPartId())
                                .questionId(sq.getQuestionId())
                                .label(taskLabel)
                                .status(writingStatus)
                                .wordCount(lengthMetric.value())
                                .lengthMetric(lengthMetric)
                                .score(null)
                                .maxScore(null)
                                .build());
                    }
                }
            }

            WritingSummary writing = null;
            if (!writingTasks.isEmpty()) {
                writing = WritingSummary.builder()
                        .status(writingStatus)
                        .tasks(writingTasks)
                        .build();
            }

            // Build sanitized partResults for legacy shape
            Map<String, Map<String, QuestionResultDto>> allowlistPartResults = new LinkedHashMap<>();
            for (ScopedPart sp : scopedParts) {
                Map<String, QuestionResultDto> pMap = parsedQuestionResults.get(sp.getPartId());
                if (pMap != null && !pMap.isEmpty()) {
                    allowlistPartResults.put(String.valueOf(sp.getPartId()), pMap);
                }
            }

            return ResultSummaryResponse.builder()
                    .partResults(allowlistPartResults)
                    .totalScore(verifiedTotalScore)
                    .correctCount(verifiedCorrectCount)
                    .totalObjectiveCount(verifiedTotalCount)
                    .sectionScores(sectionScores)
                    .objective(objective)
                    .writing(writing)
                    .build();
        } catch (Exception e) {
            log.warn("Result summary mapping failed for attempt {}: {}", attempt.getId(), e.getClass().getSimpleName());
            return null;
        }
    }

    private static BigDecimal parseSafeScore(JsonNode scoreNode) {
        if (scoreNode == null || !scoreNode.isNumber()) {
            return null;
        }
        if (scoreNode.isDouble() || scoreNode.isFloat()) {
            double d = scoreNode.asDouble();
            if (Double.isNaN(d) || Double.isInfinite(d)) {
                return null;
            }
        }
        try {
            BigDecimal score = new BigDecimal(scoreNode.asText().trim());
            if (score.compareTo(BigDecimal.ZERO) < 0 || score.compareTo(MAX_COLUMN_SCORE) > 0) {
                return null;
            }
            return score;
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer parsePartIdKey(String key) {
        if (key == null) return null;
        String trimmed = key.trim();
        try {
            long val = Long.parseLong(trimmed);
            if (val > 0 && val <= Integer.MAX_VALUE) {
                return (int) val;
            }
        } catch (NumberFormatException ignored) {}
        return null;
    }

    private BigDecimal calculateAccuracy(int correct, int total) {
        if (total == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(correct)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

    private String resolveWritingStatus(AttemptStatus status) {
        if (status == null) return "UNAVAILABLE";
        return switch (status) {
            case SUBMITTED, AI_GRADING -> "PENDING";
            case AI_GRADING_QUEUED -> "QUEUED";
            case GRADING_FAILED -> "FAILED";
            default -> "UNAVAILABLE";
        };
    }

    private String extractRawAnswer(List<AttemptAnswer> savedAnswers, Integer partId, String questionId) {
        if (savedAnswers == null || partId == null || questionId == null) {
            return "";
        }
        for (AttemptAnswer ans : savedAnswers) {
            if (partId.equals(ans.getPartId()) && ans.getUserAnswers() != null) {
                Object raw = ans.getUserAnswers().get(questionId);
                if (raw instanceof String text) {
                    return text;
                }
            }
        }
        return "";
    }

    private String extractExamLanguage(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        Object lang = snapshot.get("examLanguage");
        if (lang == null) lang = snapshot.get("exam_language");
        if (lang instanceof String s && !s.isBlank()) {
            return s.trim().toLowerCase(Locale.ROOT);
        }
        return null;
    }

    private int calculateWordCount(List<AttemptAnswer> savedAnswers, Integer partId, String questionId) {
        if (savedAnswers == null || partId == null || questionId == null) {
            return 0;
        }
        for (AttemptAnswer ans : savedAnswers) {
            if (partId.equals(ans.getPartId()) && ans.getUserAnswers() != null) {
                Object raw = ans.getUserAnswers().get(questionId);
                if (raw instanceof String text) {
                    return com.multilingo.backend.modules.testing.util.WritingWordCounter.count(text);
                }
            }
        }
        return 0;
    }

    private static class SkillAccumulator {
        final String skill;
        int correct = 0;
        int incorrect = 0;
        int unanswered = 0;
        int total = 0;
        BigDecimal rawScore = BigDecimal.ZERO;

        SkillAccumulator(String skill) {
            this.skill = skill;
        }
    }
}
