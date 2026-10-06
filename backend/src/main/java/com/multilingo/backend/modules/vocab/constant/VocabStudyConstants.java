package com.multilingo.backend.modules.vocab.constant;

import java.math.BigDecimal;

/**
 * Các hằng số quy chuẩn áp dụng cho phân hệ Ôn tập Flashcard và Thuật toán Spaced Repetition (SRS).
 *
 * MỤC ĐÍCH:
 * - Loại bỏ hoàn toàn hardcode trong mã nguồn nghiệp vụ.
 * - Chuẩn hóa các mốc thời gian ôn tập theo thuật toán SuperMemo SM-2.
 * - Quy định khung điểm thưởng Gamification và ngưỡng thành thạo từ vựng.
 */
public final class VocabStudyConstants {

    private VocabStudyConstants() {
        // Private constructor để ngăn việc khởi tạo đối tượng hằng số
    }

    // ==========================================
    // 1. MỨC ĐỘ ĐÁNH GIÁ SRS (USER RATINGS)
    // ==========================================
    /** Đánh giá người dùng đã ghi nhớ từ vựng ("Đã thuộc") */
    public static final String RATING_REMEMBERED = "REMEMBERED";

    /** Đánh giá người dùng không nhớ từ vựng ("Quên") */
    public static final String RATING_FORGOTTEN = "FORGOTTEN";

    // ==========================================
    // 2. TRẠNG THÁI TIẾN ĐỘ THẺ (FLASHCARD STATUS)
    // ==========================================
    /** Thẻ mới được tạo, chưa qua phiên học nào */
    public static final String STATUS_NEW = "NEW";

    /** Thẻ đang trong quá trình học và lặp lại ngắt quãng */
    public static final String STATUS_LEARNING = "LEARNING";

    /** Thẻ đã thành thạo (đạt ngưỡng interval >= 21 ngày) */
    public static final String STATUS_MASTERED = "MASTERED";

    // ==========================================
    // 3. THÔNG SỐ THUẬT TOÁN SM-2 (SPACED REPETITION)
    // ==========================================
    /** Khoảng thời gian ôn lại lần đầu tiên sau khi thuộc (1 ngày) */
    public static final int INITIAL_INTERVAL_DAYS = 1;

    /** Khoảng thời gian ôn lại lần thứ hai sau khi thuộc liên tiếp (3 ngày) */
    public static final int SECOND_INTERVAL_DAYS = 3;

    /** Ngưỡng ngày ôn tập để được công nhận từ vựng đã thành thạo (21 ngày) */
    public static final int MASTERED_INTERVAL_THRESHOLD_DAYS = 21;

    /** Hệ số dễ mặc định khi khởi tạo thẻ từ vựng (Ease Factor = 2.50) */
    public static final BigDecimal DEFAULT_EASE_FACTOR = new BigDecimal("2.50");

    /** Sàn tối thiểu của Hệ số dễ (không bao giờ giảm xuống dưới 1.30) */
    public static final BigDecimal MIN_EASE_FACTOR = new BigDecimal("1.30");

    /** Mức phạt trừ vào Hệ số dễ mỗi khi đánh giá "Quên" (-0.20) */
    public static final BigDecimal EASE_FACTOR_PENALTY = new BigDecimal("0.20");

    // ==========================================
    // 4. GAMIFICATION & THƯỞNG KINH NGHIỆM (XP)
    // ==========================================
    /** Điểm kinh nghiệm cơ bản nhận được khi hoàn tất một phiên học */
    public static final int XP_BASE_PER_SESSION = 10;

    /** Điểm kinh nghiệm thưởng cho mỗi thẻ đánh giá "Đã thuộc" */
    public static final int XP_PER_REMEMBERED_CARD = 2;

    /** Số giây trong một phút dùng để quy đổi thời lượng học tập */
    public static final int SECONDS_PER_MINUTE = 60;

    // ==========================================
    // 5. HIỂN THỊ & CHE TỪ TRONG CÂU VÍ DỤ
    // ==========================================
    /** Ký tự gạch dưới dùng để che từ vựng đích trong câu ví dụ mặt trước */
    public static final String MASK_WORD_REPLACEMENT = "_______";
}
