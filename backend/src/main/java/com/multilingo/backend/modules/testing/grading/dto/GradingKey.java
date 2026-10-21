package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Answer key cho một câu hỏi trong fixture chấm điểm.
 * Không bao giờ được serialize ra API response.
 */
@Data
public class GradingKey {
    public record AnswerGroup(String id, String mode, List<String> questionIds) {
        public AnswerGroup {
            questionIds = questionIds == null ? List.of() : List.copyOf(questionIds);
        }

        public static AnswerGroup parse(Object raw, String expectedQuestionId) {
            if (raw == null) return null;
            if (!(raw instanceof Map<?, ?> map)
                    || !(map.get("id") instanceof String id) || id.isBlank()
                    || !(map.get("mode") instanceof String mode) || !"DISTINCT_UNORDERED".equals(mode)
                    || !(map.get("question_ids") instanceof List<?> rawIds) || rawIds.size() != 2) {
                throw new IllegalArgumentException("Invalid IELTS answer group metadata.");
            }
            List<String> ids = new ArrayList<>(2);
            for (Object value : rawIds) {
                if (!(value instanceof String questionId) || questionId.isBlank())
                    throw new IllegalArgumentException("Invalid IELTS answer group member.");
                ids.add(questionId);
            }
            if (ids.get(0).equals(ids.get(1)) || !ids.contains(expectedQuestionId))
                throw new IllegalArgumentException("IELTS answer group member IDs are inconsistent.");
            return new AnswerGroup(id, mode, ids);
        }
    }

    /** Khớp với questionId trong userAnswers (ví dụ: "q_1") */
    private String questionId;

    /**
     * Loại câu: SINGLE_CHOICE, TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN,
     * FILL_IN_THE_BLANK, MULTIPLE_CHOICE, MATCHING, DIAGRAM_LABELING,
     * MAP_LABELING, ESSAY.
     */
    private String type;

    /**
     * Đáp án đúng. Tuỳ loại câu:
     * - SINGLE_CHOICE: String (ví dụ: "A")
     * - TRUE_FALSE_NOT_GIVEN: String (ví dụ: "TRUE")
     * - FILL_IN_THE_BLANK: String (ví dụ: "plasticity")
     * - MULTIPLE_CHOICE: List<String> (ví dụ: ["A","C"])
     * - MATCHING: Map<String,String> (questionId -> answerId)
     */
    private Object correct;

    /**
     * Đáp án thay thế được chấp nhận.
     * Chỉ dùng cho FILL_IN_THE_BLANK và DIAGRAM/MAP_LABELING.
     * Null hoặc rỗng = không có alternate.
     */
    private List<String> alternates;

    /** Present only for canonical two-slot IELTS questions. */
    private AnswerGroup answerGroup;

    /** Enables NFC on a comparison copy for attempts created under TV3_LANG_V1. */
    private boolean normalizeNfc;
}
