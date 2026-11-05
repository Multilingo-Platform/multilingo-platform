# Báo cáo Rà soát Toàn diện & Đề xuất Đơn giản hóa Tính năng Học Flashcard (Flashcard Study Audit & Refactor Progress)

> **Mã Module:** `VOCAB_FLASHCARD_STUDY`  
> **Ngày lập:** 05/11/2026  
> **Trạng thái:** Bản đề xuất tái cấu trúc nghiệp vụ tinh gọn (Simplified Refactor Proposal)

---

## 1. Tóm tắt Vấn đề & Yêu cầu Cải tiến từ Người dùng

Qua rà soát thực tế mã nguồn phân hệ Học & Ôn tập Flashcard (`FlashcardStudyServiceImpl.java`), chúng tôi ghi nhận các vấn đề chính:

1. **Thuật toán bị phức tạp hóa quá mức (Over-engineering / Code rác):**
   - Hiện tại đang áp dụng công thức SuperMemo SM-2 với số thực `BigDecimal`, trừ trừ nhân chia hệ số dễ (`easeFactor = easeFactor - 0.20`, sàn `1.30`, công thức làm tròn `intervalDays * easeFactor`).
   - Người dùng mong muốn: **Đơn giản hóa triệt để**, chỉ cần quy tắc trực quan (ví dụ: **thuộc 3 lần liên tiếp là xong/thành thạo - Mastered**), không cần tính toán hệ số phức tạp.

2. **Lỗi nghiêm trọng: Điểm kinh nghiệm (XP) tính xong nhưng KHÔNG LƯU VÀO DATABASE:**
   - Trong `finishSession()`, hệ thống tính `earnedXp = 10 + remembered * 2` và trả về DTO cho màn hình hiển thị, nhưng **hoàn toàn quên gọi lệnh lưu `totalXp`** vào bảng `user_study_stats`!
   - Trong khi đó, hệ thống đã có sẵn `StudyActivityService.recordActivity(...)` (hỗ trợ khóa chống đua luồng Pessimistic Lock, tự động cộng dồn `totalXp`, cập nhật `DailyStudyLog` và chuỗi Streak) nhưng lại không được tái sử dụng, dẫn đến code bị lặp lại và phát sinh bug mất XP của học viên.

3. **Cơ chế lặp lại ngắt quãng & Quản lý lịch ôn quá cồng kềnh:**
   - Cần đưa về lịch ôn cố định, dễ hiểu theo từng nấc ôn tập.

---

## 2. Bảng Đối chiếu Nghiệp vụ: Hiện tại vs Đề xuất Tinh gọn

| Tiêu chí | Cơ chế Hiện tại (SM-2 phức tạp) | Đề xuất Mới (Đơn giản - Trực quan) | Lợi ích |
| :--- | :--- | :--- | :--- |
| **Công thức Đánh giá** | Nhân chia số thực `BigDecimal`, giảm `easeFactor` mỗi lần quên, tính toán làm tròn floating-point. | **Quy tắc đếm lần thuộc (`reviewCount`):**<br>• Lần 1 thuộc: `reviewCount = 1`<br>• Lần 2 thuộc: `reviewCount = 2`<br>• Lần 3 thuộc: `reviewCount = 3` ➔ **ĐẠT THÀNH THẠO (MASTERED)** | Cực kỳ dễ hiểu, code sạch không còn công thức toán cồng kềnh. |
| **Lịch ôn tiếp theo (`intervalDays`)** | Tính theo công thức nhân hệ số $Interval \times EaseFactor$. | **Mốc ngày cố định trực quan:**<br>• Thuộc lần 1: Ôn lại sau **1 ngày**<br>• Thuộc lần 2: Ôn lại sau **3 ngày**<br>• Thuộc lần 3 (Mastered): Ôn lại sau **7 ngày** (hoặc 14 ngày) | Đơn giản, học viên dễ hình dung chu kỳ ôn tập. |
| **Khi bấm "Quên" (`FORGOTTEN`)** | Giảm `easeFactor` đi 0.20, chặn sàn 1.30, lùi về 1 ngày. | Reset `reviewCount = 0`, trạng thái về `LEARNING`, lịch ôn về **1 ngày** (ôn lại vào ngày mai). | Logic dứt khoát, dễ kiểm soát trạng thái từ vựng. |
| **Lưu điểm thưởng XP** | ❌ **Bug:** Tính XP trong RAM, trả về DTO nhưng **không lưu vào DB**. | ✅ **Fix:** Sử dụng `StudyActivityService.recordActivity(...)`, cộng dồn an toàn vào `user_study_stats.total_xp`. | Điểm XP được lưu vĩnh viễn, đồng bộ chuẩn xác với bảng xếp hạng và profile. |
| **Quản lý Streak & Daily Log** | Tự viết tay ~40 dòng lặp lại code kiểm tra ngày tháng trong `FlashcardStudyServiceImpl`. | Ủy quyền cho `StudyActivityService` xử lý tập trung (Single Source of Truth). | Loại bỏ duplicate code, chống xung đột đa luồng nhờ Pessimistic Lock. |
| **Cơ sở dữ liệu (Database)** | Cột `ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50`. | **Giữ nguyên 100% DB schema**: Giữ nguyên giá trị mặc định 2.50 cho cột này, không thay đổi hay viết thêm migration DB nào. | Tuân thủ tuyệt đối chỉ đạo "không chỉnh db". |

---

## 3. Thiết kế Kỹ thuật Chi tiết cho từng Tầng

### 3.1. Backend Service: `FlashcardStudyServiceImpl.java`

#### Luồng 1: Đánh giá Thẻ `reviewCard(cardId, userId, request)`
```java
// 1. Kiểm tra rating hợp lệ ("REMEMBERED" hoặc "FORGOTTEN")
// 2. Chặn IDOR: Đảm bảo thẻ thuộc về userId
// 3. Xử lý nghiệp vụ tinh gọn:
int currentCount = card.getReviewCount() != null ? card.getReviewCount() : 0;

if ("REMEMBERED".equalsIgnoreCase(normalizedRating)) {
    int nextCount = currentCount + 1;
    card.setReviewCount(nextCount);
    
    int nextInterval;
    if (nextCount == 1) {
        nextInterval = 1; // Thuộc lần 1 -> ôn sau 1 ngày
        card.setStatus("LEARNING");
    } else if (nextCount == 2) {
        nextInterval = 3; // Thuộc lần 2 -> ôn sau 3 ngày
        card.setStatus("LEARNING");
    } else {
        nextInterval = 7; // Thuộc lần 3 trở lên -> thành thạo, ôn sau 7 ngày
        card.setStatus("MASTERED");
    }
    
    card.setIntervalDays(nextInterval);
    card.setNextReviewDate(Instant.now().plus(nextInterval, ChronoUnit.DAYS));
} else {
    // Quên: Reset về 0, chuyển sang LEARNING, ôn lại sau 1 ngày
    card.setReviewCount(0);
    card.setStatus("LEARNING");
    card.setIntervalDays(1);
    card.setNextReviewDate(Instant.now().plus(1, ChronoUnit.DAYS));
}

// 4. Lưu UserFlashcard và trả về CardReviewResponse
```

#### Luồng 2: Hoàn tất Phiên học `finishSession(deckId, userId, request)`
```java
// 1. Tính điểm XP phiên học: 10 XP cơ bản + 2 XP cho mỗi từ nhớ
int rememberedCards = request.getCardsRemembered() != null ? request.getCardsRemembered() : 0;
int earnedXp = 10 + (rememberedCards * 2);

int durationSeconds = request.getDurationSeconds() != null ? request.getDurationSeconds() : 0;
int studyMinutes = Math.max(1, durationSeconds / 60);
int reviewedCards = request.getCardsReviewed() != null ? request.getCardsReviewed() : 0;

// 2. GỌI SERVICE CHUẨN ĐỂ LƯU XP VÀ STREAK VÀO DB
StudyActivityRecord activity = StudyActivityRecord.builder()
        .userId(userId)
        .studyMinutes(studyMinutes)
        .cardsReviewed(reviewedCards)
        .xpEarned(earnedXp) // -> ĐƯỢC CỘNG VÀO user_study_stats.total_xp
        .activityType("FLASHCARD_STUDY")
        .qualifiesForStreak(true)
        .build();

StudyActivitySummary studySummary = studyActivityService.recordActivity(activity);

// 3. Đếm số thẻ đạt MASTERED trong deck
long masteredCount = userFlashcardRepository.countByDeckIdAndUserIdAndStatus(
        deckId, userId, "MASTERED");

// 4. Trả về StudySessionSummaryResponse
return flashcardStudyMapper.toSessionSummaryResponse(
        earnedXp,
        studySummary.getCurrentStreak(),
        (int) masteredCount,
        reviewedCards
);
```

---

### 3.2. DTO & Validation Layer
- Trong `ReviewCardRequest.java`:
  - Thay `@NotBlank(message = "Mức độ đánh giá không được để trống")` bằng `@NotBlank(message = "INVALID_SRS_RATING")` để `GlobalExceptionHandler` bắt và trả đúng mã lỗi 1213.

---

### 3.3. Frontend Layer (`SrsStudyView.tsx` & `FlipCard.tsx`)
- Giữ nguyên các tương tác xuất sắc đã có:
  - Thẻ lật 3D Perspective mượt mà.
  - Vuốt kéo thẻ (Swipe Tinder gesture: kéo phải = Đã thuộc, kéo trái = Quên).
  - Phím tắt bàn phím tiện lợi (`Space`, `1`, `2`, `Esc`).
  - Đẩy thẻ quên về cuối hàng đợi để củng cố ngay trong phiên.
- **Điểm đồng bộ giao diện**:
  - Đổi màu nút "Lật thẻ xem đáp án" và viền thẻ từ màu vàng `amber-500` sang tone màu cam `orange-600` chủ đạo để đồng bộ toàn bộ app.

---

## 4. Kế hoạch Triển khai (Execution Steps)

1. **Bước 1 (Backend DTO & Service Clean-up):**
   - Tiêm `StudyActivityService` vào `FlashcardStudyServiceImpl`.
   - Thay thế toàn bộ đoạn code SM-2 cũ bằng logic đếm lần thuộc đơn giản (3 lần = Mastered, lịch 1 - 3 - 7 ngày).
   - Gọi `studyActivityService.recordActivity(...)` trong `finishSession` để lưu vĩnh viễn XP và Streak vào DB.
   - Chuẩn hóa validation message trong `ReviewCardRequest`.
2. **Bước 2 (Frontend Theme Unification):**
   - Cập nhật các class Tailwind của `FlipCard.tsx` và `SrsStudyView.tsx` sang tông cam `orange-600`.
3. **Bước 3 (Kiểm tra & Nghiệm thu):**
   - Chạy `npm --prefix frontend run build` kiểm tra giao diện.
   - Rà soát diff mã nguồn và báo cáo nghiệm thu.

