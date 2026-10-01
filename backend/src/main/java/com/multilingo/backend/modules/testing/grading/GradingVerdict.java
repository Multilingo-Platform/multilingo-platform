package com.multilingo.backend.modules.testing.grading;

/**
 * Kết quả chấm điểm của một câu hỏi khách quan.
 * CORRECT: câu trả lời đúng.
 * WRONG: câu trả lời sai (có đáp án nhưng không khớp key).
 * BLANK: bỏ trống (null, rỗng, hoặc chỉ có whitespace).
 * BLANK và WRONG đều cho score = 0.0, nhưng khác nhau để Sprint 06 hiển thị.
 */
public enum GradingVerdict {
    CORRECT,
    WRONG,
    BLANK
}
