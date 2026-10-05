package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Kết quả chấm điểm tổng hợp toàn attempt.
 */
@Data
@Builder
public class GradingResult {
    /**
     * Kết quả từng câu, nhóm theo Part.
     * Key: partId, Value: Map<questionId, QuestionGradingResult>
     */
    private Map<Integer, Map<String, QuestionGradingResult>> partResults;

    /** Tổng điểm raw của toàn attempt (chỉ tính câu khách quan). */
    private BigDecimal totalScore;

    /** Số câu trả lời đúng. */
    private int correctCount;

    /** Tổng số câu khách quan (không đếm ESSAY). */
    private int totalObjectiveCount;

    /**
     * Điểm theo tên section.
     * Key: section name (ví dụ: "Reading"), Value: tổng điểm section đó.
     */
    private Map<String, BigDecimal> sectionScores;
}
