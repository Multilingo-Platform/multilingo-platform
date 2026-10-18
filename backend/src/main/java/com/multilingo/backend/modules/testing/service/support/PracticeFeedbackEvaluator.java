package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.response.PracticeFeedbackResponse;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.dto.QuestionGradingResult;
import com.multilingo.backend.modules.testing.service.support.PracticeFeedbackRequestValidator.ValidatedFeedbackInput;
import com.multilingo.backend.modules.testing.util.AttemptResultScope;
import com.multilingo.backend.modules.testing.util.AttemptResultScope.ScopedPart;
import com.multilingo.backend.modules.testing.util.AttemptResultScope.ScopedQuestion;
import com.multilingo.backend.modules.testing.util.SnapshotGradingKeyExtractor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Pure evaluator evaluating a single practice question using attempt snapshot and grading engine.
 * Read-only: does not persist, mutate snapshot, or perform external lookups.
 */
@Component
@RequiredArgsConstructor
public class PracticeFeedbackEvaluator {

    private final ObjectiveGradingService objectiveGradingService;

    private record RawQuestionResult(Map<String, Object> questionMap, Object inheritedGroupOptions) {}

    /**
     * Evaluates a single question answer against attempt snapshot and returns instant feedback.
     *
     * @param attemptId ID of the attempt
     * @param snapshot  Exam snapshot Map from TestAttempt
     * @param input     Validated request input
     * @return PracticeFeedbackResponse with evaluation details
     */
    public PracticeFeedbackResponse evaluate(
            Integer attemptId,
            Map<String, Object> snapshot,
            ValidatedFeedbackInput input) {

        if (snapshot == null || snapshot.isEmpty()) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Snapshot is null or empty");
        }

        // 1. Read scope from snapshot and validate requested Part / Question
        List<ScopedPart> scopedParts;
        try {
            scopedParts = AttemptResultScope.read(snapshot);
        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Snapshot scope read failed");
        }

        ScopedPart targetPart = scopedParts.stream()
                .filter(p -> Objects.equals(p.getPartId(), input.partId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Part not found in attempt scope: " + input.partId()));

        ScopedQuestion targetQuestion = targetPart.getQuestions().stream()
                .filter(q -> Objects.equals(q.getQuestionId(), input.questionId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Question not found in part scope: " + input.questionId()));

        // 2. Question type validation
        String canonicalType = targetQuestion.getType();
        if (AttemptResultScope.WRITING_TYPES.contains(canonicalType) || "ESSAY".equalsIgnoreCase(canonicalType)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Dạng câu hỏi ESSAY không hỗ trợ phản hồi tức thì");
        }
        if (!AttemptResultScope.OBJECTIVE_TYPES.contains(canonicalType)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Unsupported question type: " + canonicalType);
        }

        // Validate answer shape compatibility with question type
        PracticeFeedbackRequestValidator.validateAnswerForType(canonicalType, input.answer());

        // 3. Extract raw question and explanation following parser precedence
        Map<String, Object> rawPart = findRawPart(snapshot, targetPart.getPartId());
        if (rawPart == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Part data not found in snapshot: " + targetPart.getPartId());
        }

        RawQuestionResult rawResult = findRawQuestion(rawPart, targetQuestion.getQuestionId());
        if (rawResult == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Question data not found in part: " + targetQuestion.getQuestionId());
        }

        Map<String, Object> rawQuestionMap = rawResult.questionMap();
        Object groupOptions = rawResult.inheritedGroupOptions();

        GradingKey.AnswerGroup answerGroup;
        try {
            answerGroup = GradingKey.AnswerGroup.parse(rawQuestionMap.get("answer_group"),
                    targetQuestion.getQuestionId());
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group is invalid.");
        }
        if (answerGroup == null && input.groupAnswers() != null
                || answerGroup != null && input.groupAnswers() == null) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Cần gửi đủ đáp án cho nhóm câu hỏi hai ô.");
        }

        List<Map<String, Object>> copiedQuestions = new ArrayList<>();
        Map<String, RawQuestionResult> rawQuestionsById = new LinkedHashMap<>();
        List<String> questionIds = answerGroup == null
                ? List.of(targetQuestion.getQuestionId())
                : answerGroup.questionIds();
        if (answerGroup != null) {
            if (!new HashSet<>(input.groupAnswers().keySet()).equals(new HashSet<>(questionIds))
                    || !Objects.equals(input.answer(), input.groupAnswers().get(targetQuestion.getQuestionId()))) {
                throw new AppException(ErrorCode.VALIDATION_FAILED, "Đáp án nhóm không khớp câu hỏi được yêu cầu.");
            }
        }

        for (String questionId : questionIds) {
            ScopedQuestion scopedQuestion = targetPart.getQuestions().stream()
                    .filter(question -> Objects.equals(question.getQuestionId(), questionId))
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "IELTS answer group is outside the requested part."));
            if (answerGroup != null && !"SINGLE_CHOICE".equals(scopedQuestion.getType()))
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group question type is invalid.");
            RawQuestionResult rawMember = questionId.equals(targetQuestion.getQuestionId())
                    ? rawResult : findRawQuestion(rawPart, questionId);
            if (rawMember == null) throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "IELTS answer group member is missing from the snapshot.");
            try {
                GradingKey.AnswerGroup memberGroup = GradingKey.AnswerGroup.parse(
                        rawMember.questionMap().get("answer_group"), questionId);
                if (!Objects.equals(answerGroup, memberGroup))
                    throw new IllegalArgumentException("Mismatched IELTS answer group.");
            } catch (IllegalArgumentException exception) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "IELTS answer group is invalid.");
            }
            rawQuestionsById.put(questionId, rawMember);
            copiedQuestions.add(copyQuestion(rawMember.questionMap(), questionId, scopedQuestion.getType(),
                    rawMember.inheritedGroupOptions()));
        }

        // 5. Create transient single-question snapshot and extract key
        Map<String, Object> miniPart = new LinkedHashMap<>();
        miniPart.put("id", input.partId());
        miniPart.put("questions", copiedQuestions);

        Map<String, Object> miniSection = new LinkedHashMap<>();
        miniSection.put("name", targetPart.getSkill() != null ? targetPart.getSkill() : "READING");
        miniSection.put("parts", List.of(miniPart));

        Map<String, Object> miniSnapshot = new LinkedHashMap<>();
        miniSnapshot.put("sections", List.of(miniSection));

        Map<Integer, PartGradingKey> partKeys;
        try {
            partKeys = SnapshotGradingKeyExtractor.extractFromSnapshot(miniSnapshot);
        } catch (Exception e) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Snapshot grading key extraction failed");
        }

        PartGradingKey pgk = partKeys != null ? partKeys.get(input.partId()) : null;
        GradingKey key = (pgk != null && pgk.getAnswers() != null)
                ? pgk.getAnswers().get(targetQuestion.getQuestionId())
                : null;

        if (key == null || key.getCorrect() == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Missing or invalid grading key for question: " + input.questionId());
        }

        // Validate and project correct answer BEFORE calling ObjectiveGradingService (AC-07)
        Map<String, Object> validatedCorrectAnswers = new LinkedHashMap<>();
        for (String questionId : questionIds) {
            GradingKey memberKey = pgk.getAnswers().get(questionId);
            if (memberKey == null || memberKey.getCorrect() == null)
                throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Missing or invalid grading key.");
            Object validatedCorrect = validateAndProjectCorrectAnswer(memberKey.getType(), memberKey.getCorrect(), questionId);
            memberKey.setCorrect(validatedCorrect);
            validatedCorrectAnswers.put(questionId, validatedCorrect);
        }

        // 6. Build transient AttemptAnswer and grade with ObjectiveGradingService
        Map<String, Object> singleAnswer = input.groupAnswers() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(input.groupAnswers());
        if (input.groupAnswers() == null) singleAnswer.put(targetQuestion.getQuestionId(), input.answer());

        AttemptAnswer transientAnswer = AttemptAnswer.builder()
                .partId(input.partId())
                .userAnswers(singleAnswer)
                .build();

        GradingResult gradingResult = objectiveGradingService.gradeAttempt(
                List.of(transientAnswer),
                Map.of(input.partId(), pgk)
        );

        Map<String, QuestionGradingResult> partResults = gradingResult.getPartResults() != null
                ? gradingResult.getPartResults().get(input.partId())
                : null;
        QuestionGradingResult qResult = partResults != null ? partResults.get(targetQuestion.getQuestionId()) : null;
        if (qResult == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Grading engine did not produce result for question: " + input.questionId());
        }

        // 7. Project response
        List<PracticeFeedbackResponse.GroupAnswer> groupResults = answerGroup == null ? null : questionIds.stream()
                .map(questionId -> {
                    QuestionGradingResult memberResult = partResults.get(questionId);
                    if (memberResult == null) throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading engine did not produce answer-group feedback.");
                    Object memberAnswer = input.groupAnswers().get(questionId);
                    String memberExplanation = readExplanation(rawQuestionsById.get(questionId).questionMap(), questionId);
                    Object memberListeningDetail = readListeningDetail(rawQuestionsById.get(questionId).questionMap(), questionId);
                    return new PracticeFeedbackResponse.GroupAnswer(questionId, memberAnswer,
                            memberResult.getVerdict(), memberResult.getScore(),
                            validatedCorrectAnswers.get(questionId), memberExplanation, memberListeningDetail);
                }).toList();

        return PracticeFeedbackResponse.builder()
                .attemptId(attemptId)
                .partId(input.partId())
                .questionId(targetQuestion.getQuestionId())
                .type(canonicalType)
                .userAnswer(input.answer())
                .verdict(qResult.getVerdict())
                .score(qResult.getScore())
                .correctAnswer(validatedCorrectAnswers.get(targetQuestion.getQuestionId()))
                .explanation(readExplanation(rawQuestionMap, targetQuestion.getQuestionId()))
                .listeningDetail(readListeningDetail(rawQuestionMap, targetQuestion.getQuestionId()))
                .groupResults(groupResults)
                .build();
    }

    private static Object readListeningDetail(Map<String, Object> question, String questionId) {
        if (question == null) return null;
        Object detail = question.get("listening_detail");
        if (detail == null) detail = question.get("listeningDetail");
        if (detail == null) {
            Object transcript = question.get("transcript");
            if (transcript == null) transcript = question.get("listening_transcript");
            if (transcript == null) transcript = question.get("listeningTranscript");
            if (transcript != null) {
                if (transcript instanceof String s) {
                    if (!s.isBlank()) {
                        detail = Map.of("transcript", s);
                    }
                } else if (transcript instanceof Map<?, ?> m) {
                    detail = m;
                }
            }
        }
        return detail;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> copyQuestion(Map<String, Object> source, String questionId,
            String type, Object inheritedOptions) {
        Map<String, Object> copied = (Map<String, Object>) deepCopyValue(source);
        copied.put("question_id", questionId);
        copied.put("type", type);
        if ((!copied.containsKey("options") || copied.get("options") == null) && inheritedOptions != null)
            copied.put("options", deepCopyValue(inheritedOptions));
        return copied;
    }

    private static String readExplanation(Map<String, Object> question, String questionId) {
        Object explanation = question.get("explanation");
        if (explanation == null) return null;
        if (explanation instanceof String text) return text;
        throw new AppException(ErrorCode.GRADING_DATA_ERROR, "Invalid explanation type for question: " + questionId);
    }

    /**
     * Validates and projects the grading key correct answer according to question type.
     * Rejects invalid structures, empty keys, nested collections/objects, or arbitrary payloads.
     * Ensures fail-closed with GRADING_DATA_ERROR before calling ObjectiveGradingService.
     */
    private Object validateAndProjectCorrectAnswer(String type, Object correct, String questionId) {
        if (correct == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Missing or invalid grading key for question: " + questionId);
        }

        if ("MATCHING".equalsIgnoreCase(type)) {
            if (!(correct instanceof Map<?, ?> correctMap)) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Grading key for MATCHING must be a Map for question: " + questionId);
            }
            if (correctMap.isEmpty()) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Grading key for MATCHING cannot be empty for question: " + questionId);
            }
            Map<String, Object> cleanMap = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : correctMap.entrySet()) {
                Object k = entry.getKey();
                Object v = entry.getValue();
                if (k == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading key entry key cannot be null for question: " + questionId);
                }
                String keyStr = String.valueOf(k);
                if (keyStr.isBlank()) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading key entry key cannot be blank for question: " + questionId);
                }
                if (cleanMap.containsKey(keyStr)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Duplicate key in MATCHING grading key for question: " + questionId);
                }
                if (v == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading key entry value cannot be null for question: " + questionId);
                }
                if (v instanceof Map || v instanceof Collection || v.getClass().isArray()) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Invalid nested structure in MATCHING grading key for question: " + questionId);
                }
                if (!isAllowedScalar(v)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Invalid non-scalar value in MATCHING grading key for question: " + questionId);
                }
                if (v instanceof String s && s.trim().isEmpty()) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading key entry value cannot be blank string for question: " + questionId);
                }
                cleanMap.put(keyStr, v);
            }
            return Collections.unmodifiableMap(cleanMap);
        }

        if ("MULTIPLE_CHOICE".equalsIgnoreCase(type)) {
            if (correct instanceof Map || correct.getClass().isArray()) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Invalid nested structure in MULTIPLE_CHOICE grading key for question: " + questionId);
            }
            if (correct instanceof Collection<?> coll) {
                if (coll.isEmpty()) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Grading key for MULTIPLE_CHOICE cannot be empty for question: " + questionId);
                }
                List<Object> cleanList = new ArrayList<>(coll.size());
                for (Object item : coll) {
                    validateScalarItem(item, questionId);
                    cleanList.add(item);
                }
                return Collections.unmodifiableList(cleanList);
            }
            if (isAllowedScalar(correct)) {
                if (correct instanceof String s && s.trim().isEmpty()) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                            "Grading key cannot be blank string for question: " + questionId);
                }
                return correct;
            }
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Invalid grading key structure for MULTIPLE_CHOICE question: " + questionId);
        }

        // All other objective types: SINGLE_CHOICE, TFNG, YNNG, FILL_IN_THE_BLANK,
        // MATCHING_FEATURES, MATCHING_HEADINGS, DIAGRAM_LABELING, MAP_LABELING
        if (correct instanceof Map || correct.getClass().isArray()) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Invalid nested structure in grading key for question: " + questionId);
        }
        if (correct instanceof Collection<?> coll) {
            if (coll.isEmpty()) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Grading key list cannot be empty for question: " + questionId);
            }
            List<Object> cleanList = new ArrayList<>(coll.size());
            for (Object item : coll) {
                validateScalarItem(item, questionId);
                cleanList.add(item);
            }
            return Collections.unmodifiableList(cleanList);
        }
        if (isAllowedScalar(correct)) {
            if (correct instanceof String s && s.trim().isEmpty()) {
                throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Grading key cannot be blank string for question: " + questionId);
            }
            return correct;
        }

        throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                "Invalid grading key structure for question: " + questionId);
    }

    private static boolean isAllowedScalar(Object obj) {
        return obj instanceof String || obj instanceof Number || obj instanceof Boolean;
    }

    private static void validateScalarItem(Object item, String questionId) {
        if (item == null) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Grading key element cannot be null for question: " + questionId);
        }
        if (item instanceof Map || item instanceof Collection || item.getClass().isArray()) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Invalid nested structure in grading key element for question: " + questionId);
        }
        if (!isAllowedScalar(item)) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Invalid non-scalar element in grading key for question: " + questionId);
        }
        if (item instanceof String s && s.trim().isEmpty()) {
            throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                    "Grading key element cannot be blank string for question: " + questionId);
        }
    }

    private static Object deepCopyValue(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                copy.put(String.valueOf(entry.getKey()), deepCopyValue(entry.getValue()));
            }
            return copy;
        }
        if (value instanceof List<?> list) {
            List<Object> copy = new ArrayList<>(list.size());
            for (Object item : list) {
                copy.add(deepCopyValue(item));
            }
            return copy;
        }
        return value;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findRawPart(Map<String, Object> snapshot, Integer targetPartId) {
        Object sectionsObj = snapshot.get("sections");
        if (!(sectionsObj instanceof List<?> sectionList)) {
            return null;
        }
        for (Object sObj : sectionList) {
            if (!(sObj instanceof Map<?, ?> sectionMap)) continue;
            Object partsObj = sectionMap.get("parts");
            if (!(partsObj instanceof List<?> partList)) continue;
            for (Object pObj : partList) {
                if (!(pObj instanceof Map<?, ?> partMap)) continue;
                Object idObj = partMap.get("id");
                if (idObj == null) idObj = partMap.get("part_id");
                if (idObj == null) idObj = partMap.get("partId");
                Integer partId = parsePartId(idObj);
                if (Objects.equals(partId, targetPartId)) {
                    return (Map<String, Object>) partMap;
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private RawQuestionResult findRawQuestion(Map<String, Object> partMap, String targetQuestionId) {
        Object groupsObj = partMap.get("questionGroups");
        if (groupsObj == null) {
            groupsObj = partMap.get("question_groups");
        }
        if (groupsObj instanceof List<?> groupList && !groupList.isEmpty()) {
            for (Object g : groupList) {
                if (!(g instanceof Map<?, ?> gMap)) continue;
                Object groupOptions = gMap.get("options");
                Object qListObj = gMap.get("questions");
                if (qListObj instanceof List<?> qList) {
                    for (Object q : qList) {
                        if (!(q instanceof Map<?, ?> qm)) continue;
                        String qId = parseQuestionId(qm);
                        if (Objects.equals(qId, targetQuestionId)) {
                            return new RawQuestionResult((Map<String, Object>) qm, groupOptions);
                        }
                    }
                }
            }
            return null;
        }

        Object qListObj = partMap.get("questions");
        if (qListObj instanceof List<?> qList) {
            for (Object q : qList) {
                if (!(q instanceof Map<?, ?> qm)) continue;
                String qId = parseQuestionId(qm);
                if (Objects.equals(qId, targetQuestionId)) {
                    return new RawQuestionResult((Map<String, Object>) qm, null);
                }
            }
        }
        return null;
    }

    private static Integer parsePartId(Object idObj) {
        if (idObj == null) return null;
        if (idObj instanceof Integer i) return i > 0 ? i : null;
        if (idObj instanceof Number num) {
            long val = num.longValue();
            return (val > 0 && val <= Integer.MAX_VALUE) ? (int) val : null;
        }
        try {
            long val = Long.parseLong(idObj.toString().trim());
            return (val > 0 && val <= Integer.MAX_VALUE) ? (int) val : null;
        } catch (NumberFormatException ignored) {}
        return null;
    }

    private static String parseQuestionId(Map<?, ?> qMap) {
        Object idObj = qMap.get("question_id");
        if (idObj == null) idObj = qMap.get("questionId");
        if (idObj == null) idObj = qMap.get("id");
        if (idObj instanceof String s && !s.isBlank()) {
            return s.trim();
        }
        if (idObj instanceof Number n) {
            return String.valueOf(n);
        }
        return null;
    }
}
