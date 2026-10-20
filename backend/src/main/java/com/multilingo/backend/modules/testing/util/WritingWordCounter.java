package com.multilingo.backend.modules.testing.util;

import java.util.regex.Pattern;

/**
 * Tiện ích đếm từ chuẩn hóa cho các bài thi Writing.
 * Sử dụng biểu thức chính quy \\S+ với cờ UNICODE_CHARACTER_CLASS,
 * đồng nhất với quy tắc tính toán của AttemptResultSummaryMapper.
 */
public final class WritingWordCounter {

    public static final Pattern UNICODE_WORD_PATTERN = Pattern.compile("\\S+", Pattern.UNICODE_CHARACTER_CLASS);

    private WritingWordCounter() {
    }

    /**
     * Đếm số từ trong đoạn văn bản.
     *
     * @param text Đoạn văn bản đầu vào
     * @return Số lượng từ tìm thấy, hoặc 0 nếu chuỗi null/rỗng
     */
    public static int count(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return (int) UNICODE_WORD_PATTERN.matcher(text).results().count();
    }
}
