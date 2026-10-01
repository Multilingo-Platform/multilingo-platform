package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Data;
import java.util.Map;

/**
 * Tập hợp answer key của một Part.
 * Key: questionId (ví dụ: "q_1"), Value: GradingKey tương ứng.
 */
@Data
public class PartGradingKey {
    private Integer partId;
    /** Map<questionId, GradingKey> */
    private Map<String, GradingKey> answers;
}
