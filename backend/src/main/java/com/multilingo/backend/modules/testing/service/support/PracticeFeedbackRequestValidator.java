package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.dto.request.PracticeFeedbackRequest;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class PracticeFeedbackRequestValidator {

    public record ValidatedFeedbackInput(
        Integer partId,
        String questionId,
        Object answer
    ) {}

    private static final Set<String> STRING_ANSWER_TYPES = Set.of(
        "SINGLE_CHOICE",
        "MCQ",
        "TFNG",
        "TRUE_FALSE_NOT_GIVEN",
        "YNNG",
        "YES_NO_NOT_GIVEN",
        "FILL_IN_THE_BLANK",
        "FILL_IN",
        "MATCHING_FEATURES",
        "MATCHING_HEADINGS",
        "MATCHING_SENTENCE_ENDINGS",
        "MATCHING_INFORMATION",
        "DIAGRAM_LABELING",
        "MAP_LABELING"
    );

    public ValidatedFeedbackInput validate(PracticeFeedbackRequest request) {
        if (request == null) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        JsonNode partIdNode = request.getPartId();
        if (partIdNode == null || !partIdNode.isInt()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
        int partId = partIdNode.intValue();
        if (partId < 1) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        JsonNode questionIdNode = request.getQuestionId();
        if (questionIdNode == null || !questionIdNode.isTextual()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }
        String questionId = questionIdNode.textValue();
        if (questionId == null || questionId.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        JsonNode answerNode = request.getAnswer();
        if (answerNode == null) {
            // Missing answer field in request JSON
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        Object answer;
        if (answerNode.isNull()) {
            answer = null;
        } else if (answerNode.isTextual()) {
            answer = answerNode.textValue();
        } else if (answerNode.isArray()) {
            List<String> list = new ArrayList<>();
            for (JsonNode item : answerNode) {
                if (!item.isTextual()) {
                    throw new AppException(ErrorCode.VALIDATION_FAILED);
                }
                list.add(item.textValue());
            }
            answer = Collections.unmodifiableList(list);
        } else if (answerNode.isObject()) {
            Map<String, String> map = new LinkedHashMap<>();
            Iterator<Map.Entry<String, JsonNode>> fields = answerNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (!entry.getValue().isTextual()) {
                    throw new AppException(ErrorCode.VALIDATION_FAILED);
                }
                map.put(entry.getKey(), entry.getValue().textValue());
            }
            answer = Collections.unmodifiableMap(map);
        } else {
            // Number, boolean, binary, etc.
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        return new ValidatedFeedbackInput(partId, questionId, answer);
    }

    public static void validateAnswerForType(String type, Object answer) {
        if (type == null || type.isBlank()) {
            throw new AppException(ErrorCode.VALIDATION_FAILED);
        }

        String normalizedType = type.trim().toUpperCase(Locale.ROOT);

        if ("ESSAY".equals(normalizedType)) {
            throw new AppException(ErrorCode.VALIDATION_FAILED, "Dạng câu hỏi ESSAY không hỗ trợ phản hồi tức thì");
        }

        if (STRING_ANSWER_TYPES.contains(normalizedType)) {
            if (answer != null && !(answer instanceof String)) {
                throw new AppException(ErrorCode.VALIDATION_FAILED);
            }
            return;
        }

        if ("MULTIPLE_CHOICE".equals(normalizedType) || "MULTIPLE_CHOICE_MULTI".equals(normalizedType)) {
            if (answer != null) {
                if (!(answer instanceof List<?> list)) {
                    throw new AppException(ErrorCode.VALIDATION_FAILED);
                }
                for (Object elem : list) {
                    if (!(elem instanceof String)) {
                        throw new AppException(ErrorCode.VALIDATION_FAILED);
                    }
                }
            }
            return;
        }

        if ("MATCHING".equals(normalizedType)) {
            if (answer != null) {
                if (!(answer instanceof Map<?, ?> map)) {
                    throw new AppException(ErrorCode.VALIDATION_FAILED);
                }
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!(entry.getKey() instanceof String) || !(entry.getValue() instanceof String)) {
                        throw new AppException(ErrorCode.VALIDATION_FAILED);
                    }
                }
            }
            return;
        }

        // Unknown type
        throw new AppException(ErrorCode.VALIDATION_FAILED);
    }
}
