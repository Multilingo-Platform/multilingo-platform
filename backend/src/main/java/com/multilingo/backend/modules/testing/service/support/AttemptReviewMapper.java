package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.dto.response.*;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Component
@RequiredArgsConstructor
public class AttemptReviewMapper {

    private final ObjectMapper objectMapper;

    private static final Set<String> INTERNAL_SECRETS = Set.of(
            "ai_prompt_context",
            "ai_feedback",
            "grading_key",
            "grading_keys",
            "is_correct_flags",
            "earned_score",
            "skill_stats"
    );

    @Value
    @Builder
    public static class PartScope {
        Integer partId;
        String partTitle;
        String skill;
        Map<String, Object> partData;
    }

    @SuppressWarnings("unchecked")
    public PartScope findPartInSnapshot(Map<String, Object> snapshot, Integer partId) {
        if (snapshot == null || partId == null) {
            return null;
        }
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sections)) {
            return null;
        }

        for (Object sObj : sections) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) {
                continue;
            }
            String sectionName = null;
            if (sectionMap.get("name") instanceof String s && !s.isBlank()) {
                sectionName = s;
            } else if (sectionMap.get("skillType") instanceof String s && !s.isBlank()) {
                sectionName = s;
            } else if (sectionMap.get("skill") instanceof String s && !s.isBlank()) {
                sectionName = s;
            }

            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> parts)) {
                continue;
            }

            for (Object pObj : parts) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    continue;
                }
                Object pIdObj = partMap.get("id");
                if (pIdObj == null) pIdObj = partMap.get("part_id");
                if (pIdObj == null) pIdObj = partMap.get("partId");
                if (pIdObj != null && matchesId(pIdObj, partId)) {
                    String partTitle = parsePartLabel(partMap, partId);

                    return PartScope.builder()
                            .partId(partId)
                            .partTitle(partTitle)
                            .skill(sectionName != null ? sectionName.trim().toUpperCase(Locale.ROOT) : "UNKNOWN")
                            .partData((Map<String, Object>) partMap)
                            .build();
                }
            }
        }
        return null;
    }

    private boolean matchesId(Object idObj, Integer targetId) {
        if (idObj instanceof Number num) {
            return num.intValue() == targetId;
        }
        try {
            return Integer.parseInt(idObj.toString()) == targetId;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public List<ReviewPartNavigationDto> extractReviewParts(Map<String, Object> snapshot) {
        if (snapshot == null) {
            return Collections.emptyList();
        }
        List<ReviewPartNavigationDto> result = new ArrayList<>();
        Set<Integer> seenPartIds = new HashSet<>();

        Object sectionsObj = snapshot.get("sections");
        if (sectionsObj instanceof List<?> sections) {
            for (Object sObj : sections) {
                if (!(sObj instanceof Map<?, ?> sectionMap)) {
                    continue;
                }
                Object partsObj = sectionMap.get("parts");
                if (!(partsObj instanceof List<?> parts)) {
                    continue;
                }
                for (Object pObj : parts) {
                    if (!(pObj instanceof Map<?, ?> partMap)) {
                        continue;
                    }
                    Integer pId = parsePartId(partMap);
                    if (pId != null && !seenPartIds.contains(pId)) {
                        seenPartIds.add(pId);
                        String label = parsePartLabel(partMap, pId);
                        result.add(ReviewPartNavigationDto.builder()
                                .id(pId)
                                .label(label)
                                .build());
                    }
                }
            }
        }

        Object rootPartsObj = snapshot.get("parts");
        if (rootPartsObj instanceof List<?> rootParts) {
            for (Object pObj : rootParts) {
                if (!(pObj instanceof Map<?, ?> partMap)) {
                    continue;
                }
                Integer pId = parsePartId(partMap);
                if (pId != null && !seenPartIds.contains(pId)) {
                    seenPartIds.add(pId);
                    String label = parsePartLabel(partMap, pId);
                    result.add(ReviewPartNavigationDto.builder()
                            .id(pId)
                            .label(label)
                            .build());
                }
            }
        }

        return result;
    }

    private Integer parsePartId(Map<?, ?> partMap) {
        Object pIdObj = partMap.get("id");
        if (pIdObj == null) pIdObj = partMap.get("part_id");
        if (pIdObj == null) pIdObj = partMap.get("partId");
        if (pIdObj instanceof Number n) {
            return n.intValue();
        }
        if (pIdObj instanceof String s && !s.isBlank()) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private String parsePartLabel(Map<?, ?> partMap, Integer pId) {
        Object titleObj = partMap.get("title");
        if (titleObj == null) titleObj = partMap.get("part_title");
        if (titleObj == null) titleObj = partMap.get("partTitle");
        if (titleObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        return "Part " + pId;
    }

    public ExamReviewResponse mapReview(TestAttempt attempt, PartScope scope, AttemptAnswer answer) {
        return mapReview(attempt, scope, answer, null);
    }

    @SuppressWarnings("unchecked")
    public ExamReviewResponse mapReview(TestAttempt attempt, PartScope scope, AttemptAnswer answer, PartGradingKey fallbackKey) {
        Map<String, Object> userAnswers = (answer != null && answer.getUserAnswers() != null)
                ? new LinkedHashMap<>(answer.getUserAnswers())
                : Collections.emptyMap();

        Map<String, Object> partGradingResults = extractPartGradingResults(
                attempt != null ? attempt.getResultSummary() : null, scope.getPartId());

        Map<String, Object> partData = scope.getPartData();

        List<ReviewQuestionDto> allQuestions = new ArrayList<>();
        List<ReviewQuestionGroupDto> questionGroups = new ArrayList<>();
        Set<String> seenQuestionIds = new HashSet<>();

        Object groupsObj = partData.get("question_groups");
        if (groupsObj == null) {
            groupsObj = partData.get("questionGroups");
        }

        if (groupsObj instanceof List<?> rawGroups) {
            for (Object gObj : rawGroups) {
                if (gObj instanceof Map<?, ?> gMapRaw) {
                    Map<String, Object> gMap = (Map<String, Object>) gMapRaw;
                    String groupId = getString(gMap, "group_id", "groupId", "id");
                    String instruction = getString(gMap, "instruction");
                    String contentHtml = getString(gMap, "content_html", "contentHtml", "passage_html", "passageHtml");
                    Map<String, Object> sharedAudio = asMap(gMap.get("shared_audio") != null ? gMap.get("shared_audio") : gMap.get("sharedAudio"));
                    Map<String, Object> sharedMedia = asMap(gMap.get("shared_media") != null ? gMap.get("shared_media") : gMap.get("sharedMedia"));
                    Object groupOptions = gMap.get("options");

                    List<ReviewQuestionDto> groupQuestions = new ArrayList<>();
                    if (gMap.get("questions") instanceof List<?> rawQuestions) {
                        for (Object qObj : rawQuestions) {
                            if (qObj instanceof Map<?, ?> qMapRaw) {
                                ReviewQuestionDto qDto = mapQuestion(
                                        (Map<String, Object>) qMapRaw,
                                        userAnswers,
                                        partGradingResults,
                                        answer,
                                        groupOptions,
                                        fallbackKey
                                );
                                groupQuestions.add(qDto);
                                allQuestions.add(qDto);
                                if (qDto.getQuestionId() != null) {
                                    seenQuestionIds.add(qDto.getQuestionId());
                                }
                            }
                        }
                    }

                    questionGroups.add(ReviewQuestionGroupDto.builder()
                            .groupId(groupId)
                            .instruction(instruction)
                            .contentHtml(contentHtml)
                            .sharedAudio(sharedAudio)
                            .sharedMedia(sharedMedia)
                            .questions(groupQuestions)
                            .build());
                }
            }
        }

        // Map root-level questions not already included in question groups
        if (partData.get("questions") instanceof List<?> rawQuestions) {
            for (Object qObj : rawQuestions) {
                if (qObj instanceof Map<?, ?> qMapRaw) {
                    Map<String, Object> qMap = (Map<String, Object>) qMapRaw;
                    String qId = getString(qMap, "question_id", "questionId", "id");
                    if (qId == null || !seenQuestionIds.contains(qId)) {
                        ReviewQuestionDto qDto = mapQuestion(
                                qMap,
                                userAnswers,
                                partGradingResults,
                                answer,
                                null,
                                fallbackKey
                        );
                        allQuestions.add(qDto);
                        if (qId != null) {
                            seenQuestionIds.add(qId);
                        }
                    }
                }
            }
        }

        List<ReviewQuestionDto> objectiveQuestions = allQuestions.stream()
                .filter(q -> !"ESSAY".equalsIgnoreCase(q.getType()))
                .toList();

        if (objectiveQuestions.size() == 1 && answer != null && answer.getEarnedScore() != null) {
            ReviewQuestionDto singleQ = objectiveQuestions.get(0);
            if (singleQ.getScore() == null) {
                singleQ.setScore(answer.getEarnedScore().setScale(2, RoundingMode.HALF_UP));
            }
        }

        ReviewPartStatsDto partStats = computePartStats(allQuestions, answer);
        Object sanitizedExamData = sanitizeSecrets(partData);

        return ExamReviewResponse.builder()
                .attemptId(attempt != null ? attempt.getId() : null)
                .partId(scope.getPartId())
                .partTitle(scope.getPartTitle())
                .skill(scope.getSkill())
                .partStats(partStats)
                .userAnswers(userAnswers)
                .questions(allQuestions)
                .questionGroups(questionGroups.isEmpty() ? null : questionGroups)
                .examData(sanitizedExamData)
                .partResult(partGradingResults.isEmpty() ? null : partGradingResults)
                .isCorrectFlags(partStats.getIsCorrectFlags())
                .build();
    }

    private ReviewQuestionDto mapQuestion(
            Map<String, Object> qMap,
            Map<String, Object> userAnswers,
            Map<String, Object> partGradingResults,
            AttemptAnswer answerRecord,
            Object inheritedGroupOptions,
            PartGradingKey fallbackKey) {

        String questionId = getString(qMap, "question_id", "questionId", "id");
        String type = getString(qMap, "type");
        String questionText = getString(qMap, "question_text", "content", "title", "text");
        String prompt = getString(qMap, "prompt");
        String label = getString(qMap, "label");
        String explanation = getString(qMap, "explanation");

        Object correctAnswer = qMap.containsKey("correct_answer") ? qMap.get("correct_answer") : qMap.get("correctAnswer");
        if (correctAnswer == null && fallbackKey != null && fallbackKey.getAnswers() != null && questionId != null) {
            GradingKey gk = fallbackKey.getAnswers().get(questionId);
            if (gk != null) {
                correctAnswer = gk.getCorrect();
            }
        }

        Object userAnswer = userAnswers != null && questionId != null ? userAnswers.get(questionId) : null;

        String verdict = null;
        BigDecimal score = null;

        if (partGradingResults != null && questionId != null && partGradingResults.containsKey(questionId)) {
            Object resObj = partGradingResults.get(questionId);
            if (resObj instanceof Map<?, ?> resMap) {
                if (resMap.get("verdict") != null) {
                    verdict = resMap.get("verdict").toString();
                }
                if (resMap.get("score") instanceof Number num) {
                    score = new BigDecimal(num.toString()).setScale(2, RoundingMode.HALF_UP);
                }
            }
        } else if (answerRecord != null && answerRecord.getIsCorrectFlags() != null && questionId != null && answerRecord.getIsCorrectFlags().containsKey(questionId)) {
            Object flagObj = answerRecord.getIsCorrectFlags().get(questionId);
            String flagStr = flagObj != null ? String.valueOf(flagObj).trim() : "";
            if (Boolean.TRUE.equals(flagObj) || "true".equalsIgnoreCase(flagStr) || "CORRECT".equalsIgnoreCase(flagStr)) {
                verdict = "CORRECT";
            } else if ("BLANK".equalsIgnoreCase(flagStr)) {
                verdict = "BLANK";
            } else if ("WRONG".equalsIgnoreCase(flagStr)) {
                verdict = "WRONG";
            } else {
                if (userAnswer == null || (userAnswer instanceof String s && s.trim().isEmpty())) {
                    verdict = "BLANK";
                } else {
                    verdict = "WRONG";
                }
            }
            score = null;
        } else if ("ESSAY".equalsIgnoreCase(type)) {
            verdict = "PENDING";
            score = null;
        } else {
            if (userAnswer == null || (userAnswer instanceof String s && s.trim().isEmpty())) {
                verdict = "BLANK";
            } else {
                verdict = "WRONG";
            }
            score = null;
        }

        Object rawOptions = qMap.get("options");
        if (rawOptions == null) {
            rawOptions = inheritedGroupOptions;
        }
        List<ReviewOptionDto> options = null;
        if (rawOptions instanceof List<?> optList) {
            options = new ArrayList<>();
            for (Object optObj : optList) {
                if (optObj instanceof Map<?, ?> optMap) {
                    Map<String, Object> opt = (Map<String, Object>) optMap;
                    String optId = getString(opt, "id", "key");
                    String optText = getString(opt, "text", "content", "label");
                    boolean isCorrectOpt = isOptionCorrect(optId, optText, correctAnswer);
                    options.add(ReviewOptionDto.builder()
                            .id(optId)
                            .text(optText)
                            .content(optText)
                            .isCorrect(isCorrectOpt)
                            .build());
                }
            }
        }

        Map<String, Object> media = null;
        if (qMap.get("media") instanceof Map<?, ?> mMap) {
            media = (Map<String, Object>) sanitizeSecrets(mMap);
        }

        return ReviewQuestionDto.builder()
                .questionId(questionId)
                .type(type)
                .questionText(questionText)
                .prompt(prompt)
                .label(label)
                .explanation(explanation)
                .correctAnswer(correctAnswer)
                .userAnswer(userAnswer)
                .verdict(verdict)
                .score(score)
                .options(options)
                .media(media)
                .build();
    }

    private boolean isOptionCorrect(String optId, String optText, Object correctAnswer) {
        if (correctAnswer == null) {
            return false;
        }
        if (correctAnswer instanceof String s) {
            String trimmed = s.trim();
            return (optId != null && optId.equalsIgnoreCase(trimmed))
                    || (optText != null && optText.equalsIgnoreCase(trimmed));
        }
        if (correctAnswer instanceof Number n) {
            String numStr = n.toString();
            return (optId != null && optId.equalsIgnoreCase(numStr))
                    || (optText != null && optText.equalsIgnoreCase(numStr));
        }
        if (correctAnswer instanceof Collection<?> coll) {
            for (Object item : coll) {
                if (item != null) {
                    String s = item.toString().trim();
                    if ((optId != null && optId.equalsIgnoreCase(s))
                            || (optText != null && optText.equalsIgnoreCase(s))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private ReviewPartStatsDto computePartStats(List<ReviewQuestionDto> questions, AttemptAnswer answer) {
        int correctCount = 0;
        int incorrectCount = 0;
        int unansweredCount = 0;
        int totalQuestions = 0;
        BigDecimal questionScoreSum = BigDecimal.ZERO;
        boolean hasAnyQuestionScore = false;
        Map<String, Boolean> isCorrectFlags = new LinkedHashMap<>();

        if (questions != null) {
            for (ReviewQuestionDto q : questions) {
                if ("ESSAY".equalsIgnoreCase(q.getType())) {
                    continue; // Skip essay from objective statistics
                }
                totalQuestions++;
                String v = q.getVerdict();
                if ("CORRECT".equalsIgnoreCase(v)) {
                    correctCount++;
                    isCorrectFlags.put(q.getQuestionId(), true);
                } else if ("BLANK".equalsIgnoreCase(v)) {
                    unansweredCount++;
                    isCorrectFlags.put(q.getQuestionId(), false);
                } else {
                    incorrectCount++;
                    isCorrectFlags.put(q.getQuestionId(), false);
                }
                if (q.getScore() != null) {
                    questionScoreSum = questionScoreSum.add(q.getScore());
                    hasAnyQuestionScore = true;
                }
            }
        }

        BigDecimal accuracy = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (totalQuestions > 0) {
            accuracy = BigDecimal.valueOf(correctCount * 100L)
                    .divide(BigDecimal.valueOf(totalQuestions), 2, RoundingMode.HALF_UP);
        }

        BigDecimal finalPartScore;
        if (totalQuestions == 0) {
            finalPartScore = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        } else if (answer != null && answer.getEarnedScore() != null) {
            finalPartScore = answer.getEarnedScore().setScale(2, RoundingMode.HALF_UP);
        } else if (hasAnyQuestionScore) {
            finalPartScore = questionScoreSum.setScale(2, RoundingMode.HALF_UP);
        } else {
            finalPartScore = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        return ReviewPartStatsDto.builder()
                .score(finalPartScore)
                .correctCount(correctCount)
                .incorrectCount(incorrectCount)
                .unansweredCount(unansweredCount)
                .totalQuestions(totalQuestions)
                .accuracy(accuracy)
                .isCorrectFlags(isCorrectFlags)
                .build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractPartGradingResults(String resultSummaryJson, Integer partId) {
        if (resultSummaryJson == null || resultSummaryJson.isBlank() || partId == null) {
            return Collections.emptyMap();
        }
        try {
            Map<String, Object> summary = objectMapper.readValue(resultSummaryJson, new TypeReference<>() {});
            if (summary.get("partResults") instanceof Map<?, ?> prMap) {
                Object partRes = prMap.get(String.valueOf(partId));
                if (partRes instanceof Map<?, ?> pResMap) {
                    return (Map<String, Object>) pResMap;
                }
            }
        } catch (Exception ignored) {}
        return Collections.emptyMap();
    }

    @SuppressWarnings("unchecked")
    private Object sanitizeSecrets(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> clean = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                String keyStr = String.valueOf(k);
                if (!INTERNAL_SECRETS.contains(keyStr)) {
                    clean.put(keyStr, sanitizeSecrets(v));
                }
            });
            return clean;
        }
        if (value instanceof List<?> list) {
            return list.stream()
                    .map(this::sanitizeSecrets)
                    .toList();
        }
        return value;
    }

    private String getString(Map<String, Object> map, String... keys) {
        if (map == null) return null;
        for (String k : keys) {
            Object val = map.get(k);
            if (val != null && !val.toString().isBlank()) {
                return val.toString();
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object obj) {
        return obj instanceof Map<?, ?> m ? (Map<String, Object>) sanitizeSecrets(m) : null;
    }
}
