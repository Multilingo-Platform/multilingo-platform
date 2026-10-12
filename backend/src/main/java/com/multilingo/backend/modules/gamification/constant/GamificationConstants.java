package com.multilingo.backend.modules.gamification.constant;

/**
 * Các hằng số quy chuẩn áp dụng cho phân hệ Gamification (Chuỗi ngày học Streak & Nhật ký học tập).
 */
public final class GamificationConstants {

    private GamificationConstants() {
        // Ngăn khởi tạo đối tượng hằng số
    }

    /** Loại hoạt động học Flashcard SRS */
    public static final String ACTIVITY_SRS = "SRS";

    /** Loại hoạt động Luyện tập trắc nghiệm (Practice Quiz) */
    public static final String ACTIVITY_PRACTICE = "PRACTICE";

    /** Giá trị khởi tạo chuỗi ngày học Streak ngày đầu tiên */
    public static final int INITIAL_STREAK_COUNT = 1;

    /** Bước tăng chuỗi ngày học cho mỗi ngày liên tiếp */
    public static final int STREAK_INCREMENT_STEP = 1;

    /** Số giây trong một phút dùng để quy đổi thời lượng học */
    public static final int SECONDS_PER_MINUTE = 60;
}
