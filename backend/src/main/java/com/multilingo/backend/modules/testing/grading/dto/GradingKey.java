package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Data;
import java.util.List;

/**
 * Answer key cho một câu hỏi trong fixture chấm điểm.
 * Không bao giờ được serialize ra API response.
 */
@Data
public class GradingKey {
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
}
