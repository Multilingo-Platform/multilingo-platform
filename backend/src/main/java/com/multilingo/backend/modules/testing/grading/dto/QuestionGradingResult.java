package com.multilingo.backend.modules.testing.grading.dto;

import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Kết quả chấm điểm của một câu hỏi khách quan.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionGradingResult {
    private String questionId;
    private GradingVerdict verdict; // CORRECT, WRONG, BLANK
    /** 1.0 nếu CORRECT, 0.0 nếu WRONG hoặc BLANK */
    private BigDecimal score;

    public static QuestionGradingResult correct(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.CORRECT)
                .score(BigDecimal.ONE)
                .build();
    }

    public static QuestionGradingResult wrong(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.WRONG)
                .score(BigDecimal.ZERO)
                .build();
    }

    public static QuestionGradingResult blank(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.BLANK)
                .score(BigDecimal.ZERO)
                .build();
    }
}
