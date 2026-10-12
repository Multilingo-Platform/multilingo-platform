package com.multilingo.backend.modules.vocab.constant;

/**
 * Các hằng số quy chuẩn áp dụng cho phân hệ Luyện tập trắc nghiệm từ vựng (Quiz Practice).
 * <p>
 * Mục đích:
 * - Loại bỏ hoàn toàn các giá trị hardcode trong Service, Generator và Writer.
 * - Quy chuẩn hóa tiền tố Redis key, giới hạn câu hỏi, điểm thưởng và thời gian nộp bài.
 * </p>
 */
public final class QuizPracticeConstants {

    private QuizPracticeConstants() {
        // Ngăn khởi tạo đối tượng hằng số
    }

    // ==========================================
    // 1. TIỀN TỐ KHÓA REDIS (CACHE KEY PREFIX)
    // ==========================================
    /** Tiền tố key lưu snapshot phiên trắc nghiệm trên Redis */
    public static final String REDIS_SESSION_KEY_PREFIX = "practice:session:";

    // ==========================================
    // 2. BỘ LỌC VÀ GIỚI HẠN CÂU HỎI (FILTERS & LIMITS)
    // ==========================================
    /** Bộ lọc lấy tất cả từ vựng */
    public static final String FILTER_STATUS_ALL = "ALL";

    /** Bộ lọc chỉ lấy từ vựng tới hạn ôn tập (DUE) */
    public static final String FILTER_STATUS_DUE = "DUE";

    /** Số lượng thẻ từ vựng tối thiểu cần thiết để tạo bài trắc nghiệm 4 lựa chọn */
    public static final int MIN_REQUIRED_CARDS = 4;

    /** Giới hạn số lượng câu hỏi mặc định cho mỗi bài luyện tập */
    public static final int DEFAULT_QUESTION_LIMIT = 15;

    /** Số lượng lựa chọn cho mỗi câu hỏi trắc nghiệm (1 đúng + 3 nhiễu) */
    public static final int OPTIONS_PER_QUESTION = 4;

    /** Nhãn định danh cho 4 lựa chọn trả lời */
    public static final String[] OPTION_KEYS = {"A", "B", "C", "D"};

    /** Nhãn phương án đúng mặc định ban đầu */
    public static final String DEFAULT_CORRECT_OPTION = "A";

    // ==========================================
    // 3. THỜI GIAN VÀ ĐIỂM THƯỞNG (TIME & GAMIFICATION)
    // ==========================================
    /** Thời lượng làm bài tối đa cho phép (24 giờ = 86400 giây) */
    public static final int MAX_DURATION_SECONDS = 86400;

    /** Số giây trong một phút dùng để quy đổi thời lượng học */
    public static final int SECONDS_PER_MINUTE = 60;

    /** Điểm kinh nghiệm (XP) cố định thưởng cho mỗi phiên hoàn thành */
    public static final int PRACTICE_COMPLETION_XP = 10;

    /** Loại hoạt động học tập ghi nhận trong Gamification */
    public static final String ACTIVITY_TYPE_PRACTICE = "PRACTICE";

    /** JSON rỗng mặc định khi đặt chỗ receipt */
    public static final String EMPTY_RESULT_JSON = "{}";

    /** Bản mẫu giải thích đáp án trắc nghiệm */
    public static final String EXPLANATION_TEMPLATE = "Từ '%s' có nghĩa là '%s'.";
}
