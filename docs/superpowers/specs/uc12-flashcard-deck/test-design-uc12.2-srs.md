# Kế Hoạch & Thiết Kế Kiểm Thử - UC012.2: Ôn Tập Flashcard (SRS)

- **Mã Tài Liệu:** TD-UC012.2-SRS
- **Tên Phân Hệ:** Vocabulary & Flashcards Spaced Repetition System (`com.multilingo.backend.modules.vocab`)
- **Tác Nhân (Actor):** Học viên / Người dùng đã đăng nhập (`ROLE_USER`)
- **Tài liệu đặc tả nguồn:** [uc12.2-on-tap-flashcard.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.2-on-tap-flashcard.md)

---

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Tác nhân (Actor Persona)
- **Học viên (`ROLE_USER`):** Học viên sở hữu bộ thẻ ghi nhớ, muốn ôn luyện các từ vựng đến hạn lặp lại để ghi nhớ dài hạn vào vỏ não theo thuật toán Spaced Repetition (SRS).

### 1.2. Ranh giới triển khai (Scope Boundaries)
- **In-Scope (Phạm vi Backend UC012.2):**
  1. API `GET /api/v1/vocab/decks/{deckId}/study-session`:
     - Kiểm tra quyền sở hữu bộ thẻ (`userId`).
     - Tải danh sách thẻ ưu tiên tới hạn (`next_review_date <= CURRENT_TIMESTAMP`), nếu không có thẻ tới hạn sẽ lấy danh sách thẻ trong bộ để người dùng chủ động ôn tập.
     - Tự động sinh `maskedSentence`: thay thế từ vựng xuất hiện trong `example_sentence` thành chuỗi gạch dưới `_______` (case-insensitive) để học viên tự suy nghĩ.
  2. API `POST /api/v1/vocab/cards/{cardId}/review`:
     - Đánh giá `REMEMBERED`: tăng `review_count`, tính `interval_days` mới dựa trên `ease_factor`, cập nhật `next_review_date = now + interval_days`. Khi `interval_days >= 21` chuyển trạng thái sang `MASTERED`.
     - Đánh giá `FORGOTTEN`: đặt `interval_days = 1` ngày (ôn lại ngày mai), giảm `ease_factor = MAX(1.30, ease_factor - 0.20)`, trạng thái `LEARNING`.
  3. API `POST /api/v1/vocab/decks/{deckId}/finish-session`:
     - Ghi nhận `daily_study_logs`: cộng dồn `flashcards_reviewed` và thời gian học trong ngày.
     - Cập nhật `user_study_stats`: cập nhật chuỗi ngày học liên tục (streak) và kỷ lục streak cao nhất (`highest_streak`).
     - Tính điểm thưởng kinh nghiệm (+10 XP cơ bản + 2 XP/thẻ nhớ).
- **Out-of-Scope (Thực hiện ở các UC khác):**
  - Chế độ Quiz trắc nghiệm 4 đáp án (thuộc `UC012.3`).
  - Chế độ Thi thử tính giờ (thuộc `UC012.4`).
  - Trò chơi ghép thẻ tốc độ (thuộc `UC012.5`).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1. Tiêu chí Gherkin (Behavioral AC)

```gherkin
Feature: Ôn tập Flashcard SRS Backend APIs

  Scenario: Khởi tạo phiên ôn tập thành công trên bộ thẻ hợp lệ
    Given Người dùng "user1" (ID: 1) sở hữu bộ thẻ #1 có 5 thẻ từ vựng
    When Người dùng gọi API GET "/api/v1/vocab/decks/1/study-session" với Header "X-User-Id: 1"
    Then Hệ thống trả về HTTP 200 OK với ApiResponse success
    And Dữ liệu trả về chứa danh sách thẻ có maskedSentence được ẩn từ vựng gốc

  Scenario: Chặn khởi tạo phiên học khi bộ thẻ rỗng
    Given Người dùng "user1" sở hữu bộ thẻ #2 nhưng chưa có thẻ từ vựng nào
    When Người dùng gọi API GET "/api/v1/vocab/decks/2/study-session"
    Then Hệ thống ném lỗi AppException(ErrorCode.DECK_EMPTY) với mã HTTP 400 Bad Request

  Scenario: Đánh giá thẻ "REMEMBERED" làm tăng intervalDays
    Given Thẻ từ vựng #101 có reviewCount = 1, intervalDays = 1, easeFactor = 2.50
    When Người dùng gửi đánh giá POST "/api/v1/vocab/cards/101/review" với rating = "REMEMBERED"
    Then Hệ thống cập nhật reviewCount = 2, intervalDays = 3
    And nextReviewDate được cộng thêm 3 ngày tính từ hiện tại

  Scenario: Đánh giá thẻ "FORGOTTEN" đặt lại intervalDays về 1 và giảm easeFactor
    Given Thẻ từ vựng #101 có reviewCount = 3, intervalDays = 7, easeFactor = 2.50
    When Người dùng gửi đánh giá POST "/api/v1/vocab/cards/101/review" với rating = "FORGOTTEN"
    Then Hệ thống đặt lại intervalDays = 1, giảm easeFactor = 2.30
    And nextReviewDate được đặt là ngày mai

  Scenario: Hoàn thành phiên học cập nhật chuỗi Streak và Daily Log
    Given Người dùng "user1" học lần đầu trong ngày hôm nay (chưa có log ngày hôm nay)
    When Người dùng gửi kết quả POST "/api/v1/vocab/decks/1/finish-session" với 10 thẻ ôn tập
    Then Bản ghi daily_study_logs hôm nay được tạo với flashcards_reviewed = 10
    And user_study_stats được cập nhật current_streak tăng thêm 1
```

### 2.2. Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **Ràng buộc sàn Ease Factor:** `ease_factor` không bao giờ được phép nhỏ hơn `1.30` (SuperMemo SM-2 standard).
- [x] **Ràng buộc phân quyền IDOR:** Người dùng A không thể đánh giá thẻ hoặc lấy phiên ôn tập từ bộ thẻ của người dùng B (HTTP 403 Forbidden hoặc 404 Not Found).
- [x] **Masking thuật toán an toàn:** Khi `example_sentence` rỗng hoặc không chứa từ vựng gốc, `maskedSentence` trả về `null` hoặc nguyên bản câu ví dụ, không bị NullPointerException.
- [x] **Trạng thái MASTERED:** Khi `interval_days >= 21`, thẻ tự động chuyển từ `LEARNING` sang `MASTERED`.

---

## 3. Ma Trận Kiểm Thử 6 Khía Cạnh (6-Aspect Test Matrix)

| Khía cạnh | Kịch bản kiểm thử trọng tâm |
| :--- | :--- |
| **1. Happy Path** | Khởi tạo phiên ôn tập ➔ Lần lượt đánh giá thẻ (Remembered/Forgotten) ➔ Hoàn tất phiên học, nhận XP và cập nhật streak. |
| **2. Negative** | - Gọi bộ thẻ không tồn tại (ID 99999).<br>- Bộ thẻ rỗng không có từ vựng.<br>- Đánh giá rating không hợp lệ (ví dụ: rating = "UNKNOWN"). |
| **3. Boundary (BVA)** | - Bộ thẻ có đúng 1 từ vựng (biên tối thiểu để học).<br>- `ease_factor` giảm chạm mức sàn 1.30 (thử giảm tiếp vẫn phải giữ 1.30).<br>- `interval_days` chuyển ngưỡng 20 ngày ➔ 21 ngày (chuyển trạng thái `MASTERED`). |
| **4. Edge Cases** | - Từ vựng có ký tự đặc biệt, hoa thường khác nhau trong câu ví dụ (ví dụ từ "ubiquitous" nhưng câu ví dụ là "Ubiquitous").<br>- Đánh giá hoàn tất phiên học 2 lần trong cùng 1 ngày (streak chỉ tăng 1 lần, nhưng `flashcards_reviewed` được cộng dồn). |
| **5. Security** | - IDOR: Thử dùng Token của User A để đánh giá `cardId` thuộc quyền sở hữu của User B. |
| **6. Performance** | - Query lấy thẻ ôn tập có index `next_review_date`, trả kết quả nhanh chóng < 100ms. |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (`TC_VOCAB_SRS_xx`)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VOCAB_SRS_01** | Happy Path | Khởi tạo phiên ôn tập với danh sách thẻ tới hạn | Deck #1 thuộc user 1 có 3 thẻ tới hạn | 1. Gọi `GET /api/v1/vocab/decks/1/study-session` | `deckId = 1`, `userId = 1` | - HTTP 200 OK<br>- Trả về 3 thẻ<br>- `maskedSentence` che từ đích bằng `_______` |
| **TC_VOCAB_SRS_02** | Happy Path | Tự động lấy toàn bộ thẻ khi không có thẻ nào tới hạn | Deck #1 có 5 thẻ nhưng chưa tới hạn | 1. Gọi `GET /api/v1/vocab/decks/1/study-session` | `deckId = 1` | - HTTP 200 OK<br>- Trả về toàn bộ 5 thẻ để luyện tập tự do |
| **TC_VOCAB_SRS_03** | Negative | Khởi tạo phiên học trên bộ thẻ rỗng | Deck #2 chưa có từ vựng nào (`totalCards = 0`) | 1. Gọi `GET /api/v1/vocab/decks/2/study-session` | `deckId = 2` | - HTTP 400 Bad Request<br>- Message: "Bộ thẻ chưa có từ vựng nào để ôn tập" |
| **TC_VOCAB_SRS_04** | Security | IDOR: Học bộ thẻ của người dùng khác | Deck #3 thuộc user 2 | 1. User 1 gọi `GET /api/v1/vocab/decks/3/study-session` | `deckId = 3`, `userId = 1` | - HTTP 403 Forbidden hoặc 404 Not Found |
| **TC_VOCAB_SRS_05** | Happy Path | Đánh giá thẻ lần đầu "REMEMBERED" | Thẻ mới tạo (`reviewCount = 0`, `interval = 0`) | 1. Gọi `POST /api/v1/vocab/cards/{id}/review` | `rating = "REMEMBERED"` | - HTTP 200 OK<br>- `intervalDays = 1`<br>- `reviewCount = 1`<br>- `status = "LEARNING"` |
| **TC_VOCAB_SRS_06** | Happy Path | Đánh giá thẻ lần 2 "REMEMBERED" | Thẻ có `reviewCount = 1`, `interval = 1` | 1. Gọi `POST /api/v1/vocab/cards/{id}/review` | `rating = "REMEMBERED"` | - HTTP 200 OK<br>- `intervalDays = 3`<br>- `reviewCount = 2` |
| **TC_VOCAB_SRS_07** | Boundary | Đạt mốc thành thạo khi interval >= 21 | Thẻ có `interval = 10`, `easeFactor = 2.50` | 1. Gọi review "REMEMBERED" | `rating = "REMEMBERED"` | - HTTP 200 OK<br>- `intervalDays = 25`<br>- `status = "MASTERED"` |
| **TC_VOCAB_SRS_08** | Happy Path | Đánh giá thẻ "FORGOTTEN" đặt lại lịch ôn ngày mai | Thẻ đang có `interval = 14`, `easeFactor = 2.50` | 1. Gọi review "FORGOTTEN" | `rating = "FORGOTTEN"` | - HTTP 200 OK<br>- `intervalDays = 1`<br>- `easeFactor = 2.30` |
| **TC_VOCAB_SRS_09** | Boundary | Sàn Ease Factor không được dưới 1.30 | Thẻ đang có `easeFactor = 1.35` | 1. Gọi review "FORGOTTEN" | `rating = "FORGOTTEN"` | - HTTP 200 OK<br>- `easeFactor = 1.30` (không về 1.15) |
| **TC_VOCAB_SRS_10** | Negative | Gửi rating không hợp lệ | Thẻ #101 tồn tại | 1. Gọi review với rating sai | `rating = "INVALID"` | - HTTP 400 Bad Request |
| **TC_VOCAB_SRS_11** | Happy Path | Hoàn tất phiên học: cập nhật streak và daily log | User chưa học hôm nay | 1. Gọi `POST /api/v1/vocab/decks/1/finish-session` | `cardsReviewed = 10`, `cardsRemembered = 8` | - HTTP 200 OK<br>- `daily_study_logs` có `flashcardsReviewed = 10`<br>- `currentStreak` tăng 1 |
| **TC_VOCAB_SRS_12** | Edge Case | Hoàn tất phiên học lần 2 trong cùng ngày | User đã học 1 phiên sáng nay | 1. Hoàn tất phiên thứ 2 trong ngày | `cardsReviewed = 5` | - HTTP 200 OK<br>- `flashcardsReviewed` cộng dồn thành 15<br>- `currentStreak` giữ nguyên không tăng lặp |
