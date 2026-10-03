# Đặc Tả Kỹ Thuật (Specification) - UC012: Quản lý Sổ tay & Bộ thẻ từ vựng

- **Mã Use Case:** UC012
- **Tên Use Case:** Quản lý Sổ tay và bộ thẻ từ vựng (Vocab Decks & Flashcards Management)
- **Phân hệ:** Vocab & Flashcards SRS (`com.multilingo.backend.modules.vocab`)
- **Tác nhân (Actor):** Học viên / Người dùng đã đăng nhập (`ROLE_USER`)
- **Trạng thái:** DRAFT -> Chờ phê duyệt

---

## 1. Mục Tiêu & Bối Cảnh Hệ Thống

UC012 đóng vai trò là **Trung tâm điều phối (Launchpad / Navigation Hub)** của toàn bộ phân hệ từ vựng Multilingo. Tính năng cho phép người dùng tổ chức các từ vựng theo từng chủ đề/mục tiêu (IELTS, TOEIC, Giao tiếp hằng ngày...), theo dõi tiến độ ghi nhớ (Thẻ mới, Đang học, Đã thuộc, Cần ôn hôm nay) và làm bàn đạp điều hướng sang 5 chế độ học tập chuyên sâu (UC12.1 - UC12.6).

---

## 2. Phạm Vi & Ranh Giới (Scope Boundaries)

### 2.1. In-Scope (Thuộc phạm vi UC012)
1. **Quản lý Bộ thẻ (Flashcard Decks):**
   - Lấy danh sách bộ thẻ của người dùng kèm thống kê số lượng thẻ theo trạng thái (`totalCards`, `newCards`, `learningCards`, `masteredCards`, `dueReviewCards`).
   - Tạo bộ thẻ mới (+ Tạo bộ thẻ: tên, mô tả, quyền riêng tư `is_public`).
   - Chỉnh sửa thông tin bộ thẻ (tên, mô tả, `is_public`).
   - Xóa bộ thẻ (xóa cascade toàn bộ thẻ từ vựng thuộc bộ thẻ đó).
   - Xử lý trạng thái rỗng (*Empty State*) khi người dùng chưa tạo bộ thẻ nào.
2. **Chi tiết Bộ thẻ (Deck Detail & Card Explorer):**
   - Xem chi tiết bộ thẻ và danh sách thẻ từ vựng (`user_flashcards`) bên trong.
   - Tìm kiếm từ vựng theo từ khóa (`custom_word`, `custom_meaning`).
   - Lọc thẻ từ theo trạng thái: `ALL`, `NEW`, `LEARNING`, `MASTERED`.
3. **Thao tác Thẻ cơ bản (Tích hợp UC12.1 & UC12.6):**
   - Thêm thẻ từ vựng thủ công vào bộ thẻ (Từ, nghĩa, ví dụ, ảnh minh họa).
   - Chỉnh sửa thông tin thẻ từ vựng.
   - Xóa một thẻ từ vựng khỏi bộ thẻ.
4. **Hub điều hướng học tập:**
   - Hiển thị các nút điều hướng chuẩn bị cho các chế độ học:
     - *Thẻ ghi nhớ (Flashcard SRS)* -> route sang UC12.2
     - *Học (Quiz chấm ngay)* -> route sang UC12.3
     - *Kiểm tra (Test nộp bài)* -> route sang UC12.4
     - *Ghép thẻ (Speed Match)* -> route sang UC12.5

### 2.2. Out-of-Scope (Thực hiện ở các UC tiếp theo)
- Thuật toán chấm điểm SRS và lật thẻ 3D (`UC12.2`).
- Logic sinh câu hỏi và chấm thi Quiz (`UC12.3`) và Test Engine (`UC12.4`).
- Cơ chế bàn cờ game ghép thẻ (`UC12.5`).
- Tính năng chia sẻ cộng đồng / Clone bộ thẻ của người khác (sẽ thực hiện ở Phase cộng đồng).

---

## 3. Thiết Kế Cơ Sở Dữ Liệu (Database Mapping)

### 3.1. Bảng `flashcard_decks`
- `id`: `INT` (PK, IDENTITY)
- `user_id`: `INT` (FK trỏ `users(id)`, NOT NULL)
- `name`: `VARCHAR(200)` (NOT NULL)
- `description`: `TEXT` (NULL)
- `is_public`: `BOOLEAN` (DEFAULT `FALSE`)
- `clones_count`: `INT` (DEFAULT `0`)
- `created_at`, `updated_at`: `TIMESTAMP` (Quản lý tự động bởi `BaseEntity`)

### 3.2. Bảng `user_flashcards`
- `id`: `INT` (PK, IDENTITY)
- `user_id`: `INT` (FK trỏ `users(id)`, NOT NULL)
- `deck_id`: `INT` (FK trỏ `flashcard_decks(id)`, ON DELETE CASCADE, NOT NULL)
- `word_id`: `INT` (FK trỏ `dictionary_words(id)`, NULL)
- `custom_word`: `VARCHAR(150)` (NOT NULL)
- `custom_meaning`: `TEXT` (NOT NULL)
- `example_sentence`: `TEXT` (NULL)
- `custom_image_url`: `VARCHAR(500)` (NULL)
- `status`: `VARCHAR(30)` (DEFAULT `'NEW'`, values: `NEW`, `LEARNING`, `MASTERED`)
- `review_count`: `INT` (DEFAULT `0`)
- `ease_factor`: `NUMERIC(4,2)` (DEFAULT `2.50`)
- `interval_days`: `INT` (DEFAULT `0`)
- `next_review_date`: `TIMESTAMP` (DEFAULT `NOW()`)
- `created_at`, `updated_at`: `TIMESTAMP` (Quản lý tự động bởi `BaseEntity`)

---

## 4. Thiết Kế Hợp Đồng API (RESTful API Contract)

Mọi API trả về định dạng chuẩn: `ResponseEntity<ApiResponse<T>>`. Lỗi trả về `AppException(ErrorCode)`.

### 4.1. Quản lý Bộ thẻ (Deck Endpoints)
- `GET /api/v1/vocab/decks`
  - Mô tả: Lấy danh sách bộ thẻ của user đăng nhập kèm thống kê tổng quan.
  - Response: `ApiResponse<List<DeckSummaryResponse>>`
  - DTO: `id`, `name`, `description`, `isPublic`, `totalCards`, `newCards`, `learningCards`, `masteredCards`, `dueReviewCards`, `createdAt`, `updatedAt`.
- `POST /api/v1/vocab/decks`
  - Mô tả: Tạo bộ thẻ mới.
  - Request Body: `CreateDeckRequest` (`@NotBlank name` max 200, `description`, `Boolean isPublic`).
  - Response: `ApiResponse<DeckResponse>` (HTTP 201 Created).
- `GET /api/v1/vocab/decks/{id}`
  - Mô tả: Xem thông tin chi tiết một bộ thẻ.
  - Response: `ApiResponse<DeckDetailResponse>` (Thông tin deck + thống kê).
- `PUT /api/v1/vocab/decks/{id}`
  - Mô tả: Chỉnh sửa tên, mô tả, quyền riêng tư của bộ thẻ.
  - Request Body: `UpdateDeckRequest` (`@NotBlank name`, `description`, `Boolean isPublic`).
  - Response: `ApiResponse<DeckResponse>`.
- `DELETE /api/v1/vocab/decks/{id}`
  - Mô tả: Xóa vĩnh viễn bộ thẻ và các thẻ bên trong.
  - Response: `ApiResponse<Void>`.

### 4.2. Quản lý Thẻ Từ Vựng trong Bộ thẻ (Card Endpoints)
- `GET /api/v1/vocab/decks/{deckId}/cards?keyword=&status=`
  - Mô tả: Lấy danh sách thẻ từ vựng trong bộ thẻ, hỗ trợ tìm kiếm từ khóa và lọc trạng thái.
  - Response: `ApiResponse<List<FlashcardResponse>>`.
  - DTO: `id`, `deckId`, `customWord`, `customMeaning`, `exampleSentence`, `customImageUrl`, `status`, `reviewCount`, `easeFactor`, `intervalDays`, `nextReviewDate`.
- `POST /api/v1/vocab/decks/{deckId}/cards`
  - Mô tả: Thêm thẻ từ vựng mới vào bộ thẻ (UC12.1).
  - Request Body: `CreateFlashcardRequest` (`@NotBlank customWord`, `@NotBlank customMeaning`, `exampleSentence`, `customImageUrl`, `wordId`).
  - Response: `ApiResponse<FlashcardResponse>` (HTTP 201 Created).
- `PUT /api/v1/vocab/cards/{cardId}`
  - Mô tả: Cập nhật thông tin thẻ từ vựng (UC12.1).
  - Request Body: `UpdateFlashcardRequest` (`@NotBlank customWord`, `@NotBlank customMeaning`, `exampleSentence`, `customImageUrl`).
  - Response: `ApiResponse<FlashcardResponse>`.
- `DELETE /api/v1/vocab/cards/{cardId}`
  - Mô tả: Xóa một thẻ từ vựng (UC12.6).
  - Response: `ApiResponse<Void>`.

---

## 5. Quy Tắc Nghiệp Vụ & Mã Lỗi (Business Rules & Error Codes)

| Mã lỗi | HTTP Status | Thông báo lỗi | Điều kiện kích hoạt |
| :--- | :---: | :--- | :--- |
| `RESOURCE_NOT_FOUND` | 404 | "Không tìm thấy bộ thẻ" / "Không tìm thấy thẻ từ vựng" | ID không tồn tại trong DB |
| `FORBIDDEN` | 403 | "Không có quyền thực hiện thao tác" | User cố truy cập/sửa/xóa deck/card của user khác |
| `VALIDATION_FAILED` | 422 | "Dữ liệu đầu vào không hợp lệ" | Tên deck rỗng, từ vựng rỗng, vượt quá độ dài quy định |
| `CONFLICT` | 409 | "Dữ liệu bị trùng lặp hoặc xung đột" | Tạo thẻ từ vựng đã tồn tại chính xác cùng từ trong cùng 1 deck |

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria - Gherkin)

### Kịch bản 1: Lấy danh sách bộ thẻ kèm thống kê (Happy Path)
```gherkin
Given Người dùng "userA" đã đăng nhập và sở hữu 2 bộ thẻ:
  | Name | Total Cards | New | Learning | Mastered | Due Today |
  | IELTS Core | 10 | 2 | 5 | 3 | 4 |
  | TOEIC 600  | 0  | 0 | 0 | 0 | 0 |
When Người dùng gửi request GET "/api/v1/vocab/decks"
Then Hệ thống trả về mã HTTP 200 OK
And Danh sách gồm 2 bộ thẻ với đầy đủ các trường thống kê chính xác
```

### Kịch bản 2: Tạo bộ thẻ mới thành công
```gherkin
Given Người dùng đã đăng nhập tài khoản hợp lệ
When Người dùng gửi request POST "/api/v1/vocab/decks" với tên "Từ vựng N1" và mô tả "Tiếng Nhật cao cấp"
Then Hệ thống tạo mới bộ thẻ trong bảng "flashcard_decks" với user_id của người dùng
And Trả về HTTP 201 Created với ApiResponse chứa ID bộ thẻ vừa tạo
```

### Kịch bản 3: Ngăn chặn truy cập trái phép bộ thẻ của người khác (Security / IDOR)
```gherkin
Given Bộ thẻ có ID=10 thuộc sở hữu của người dùng "userA"
When Người dùng "userB" gửi request PUT "/api/v1/vocab/decks/10" hoặc DELETE "/api/v1/vocab/decks/10"
Then Hệ thống ném AppException với ErrorCode.FORBIDDEN
And Trả về HTTP 403 Forbidden, không cho phép cập nhật hoặc xóa dữ liệu
```

### Kịch bản 4: Xóa bộ thẻ xóa cascade toàn bộ thẻ từ bên trong
```gherkin
Given Bộ thẻ ID=5 có chứa 20 thẻ từ vựng trong bảng "user_flashcards"
When Người dùng sở hữu bộ thẻ gửi DELETE "/api/v1/vocab/decks/5"
Then Hệ thống xóa thành công bản ghi deck ID=5
And 20 thẻ từ vựng liên quan trong bảng "user_flashcards" bị xóa hoàn toàn khỏi CSDL
```

### Kịch bản 5: Tìm kiếm và lọc từ vựng trong bộ thẻ
```gherkin
Given Bộ thẻ ID=1 chứa 5 thẻ: 2 thẻ status="NEW", 2 thẻ status="LEARNING", 1 thẻ status="MASTERED"
When Người dùng gửi request GET "/api/v1/vocab/decks/1/cards?status=LEARNING"
Then Hệ thống trả về đúng 2 thẻ có status="LEARNING"
When Người dùng gửi request GET "/api/v1/vocab/decks/1/cards?keyword=apple"
Then Hệ thống lọc các thẻ có custom_word hoặc custom_meaning chứa "apple" (không phân biệt hoa thường)
```

---

## 7. Ma Trận Kiểm Thử 6 Khía Cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **1. Happy Path** | Lấy danh sách, tạo deck, sửa deck, xóa deck, thêm card, sửa card, xóa card | Tên deck: "IELTS Speaking", Từ: "Diligent", Nghĩa: "Chăm chỉ" | HTTP 200/201, dữ liệu đồng bộ chính xác |
| **2. Negative** | Tạo deck với tên trống; Truy cập deck ID không tồn tại (404) | Name: `""` hoặc `null`; DeckId: `999999` | HTTP 422 `VALIDATION_FAILED`; HTTP 404 `RESOURCE_NOT_FOUND` |
| **3. Boundary** | Tên deck 200 ký tự (Pass); Tên deck 201 ký tự (Fail); Từ vựng 150 ký tự (Pass); 151 ký tự (Fail) | Name length 200 vs 201 | Báo lỗi validation khi vượt ngưỡng tối đa |
| **4. Edge Cases** | Tên deck chứa khoảng trắng đầu/cuối ("  IELTS  "); Tên chứa tiếng Việt có dấu, emoji ("Bộ thẻ 🌟 Tiếng Anh") | Input có khoảng trắng, Unicode UTF-8 | Hệ thống trim khoảng trắng hợp lý, lưu và hiển thị chuẩn Unicode |
| **5. Security** | IDOR: User B xóa deck của User A; XSS injection trong `custom_word` hoặc `description` | Deck của User A; payload `<script>alert('xss')</script>` | HTTP 403 Forbidden; dữ liệu được sanitize / escape an toàn |
| **6. UI/UX** | Hiển thị Empty State khi chưa có bộ thẻ; Loading spinner khi gọi API; Toast thông báo thành công/thất bại | Deck list rỗng | Hiển thị card hướng dẫn tạo bộ thẻ đầu tiên; Nút disabled chống spam click |

---

## 8. Bảng Test Cases Chuẩn Hóa (7 Cột)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VOCAB_DECK_01** | Happy Path | Lấy danh sách bộ thẻ kèm thống kê | User đã đăng nhập, có 2 deck | Gửi GET `/api/v1/vocab/decks` | Header Bearer Token | HTTP 200, trả về danh sách 2 deck kèm tổng số thẻ |
| **TC_VOCAB_DECK_02** | Happy Path | Tạo bộ thẻ mới thành công | User đã đăng nhập | Gửi POST `/api/v1/vocab/decks` | `{"name": "IELTS 7.0", "description": "Writing Task 2", "isPublic": false}` | HTTP 201, trả về deck có ID mới, user_id khớp token |
| **TC_VOCAB_DECK_03** | Negative | Tạo bộ thẻ với tên để trống | User đã đăng nhập | Gửi POST `/api/v1/vocab/decks` | `{"name": "   "}` | HTTP 422, thông báo "Tên bộ thẻ không được để trống" |
| **TC_VOCAB_DECK_04** | Boundary | Tạo bộ thẻ với tên tối đa 200 ký tự | User đã đăng nhập | Gửi POST `/api/v1/vocab/decks` | String 200 ký tự vs 201 ký tự | 200 ký tự: HTTP 201; 201 ký tự: HTTP 422 |
| **TC_VOCAB_DECK_05** | Security | Ngăn chặn sửa/xóa deck của user khác (IDOR) | Deck ID=1 thuộc User A, User B đăng nhập | User B gửi PUT/DELETE `/api/v1/vocab/decks/1` | Token User B | HTTP 403 FORBIDDEN, dữ liệu không bị thay đổi |
| **TC_VOCAB_DECK_06** | Happy Path | Xóa bộ thẻ và cascade xóa các flashcard bên trong | Deck ID=1 có 5 thẻ từ | Gửi DELETE `/api/v1/vocab/decks/1` | Token chủ sở hữu | HTTP 200, deck và 5 thẻ bị xóa sạch khỏi CSDL |
| **TC_VOCAB_CARD_01** | Happy Path | Lấy danh sách thẻ từ trong deck hỗ trợ lọc status | Deck có thẻ NEW và MASTERED | Gửi GET `/api/v1/vocab/decks/1/cards?status=NEW` | Status = "NEW" | HTTP 200, chỉ trả về các thẻ có trạng thái "NEW" |
| **TC_VOCAB_CARD_02** | Happy Path | Tìm kiếm từ vựng theo từ khóa | Deck có từ "Eloquent" | Gửi GET `/api/v1/vocab/decks/1/cards?keyword=elo` | Keyword = "elo" | HTTP 200, trả về thẻ có từ chứa "elo" |
| **TC_VOCAB_CARD_03** | Happy Path | Thêm thẻ từ vựng mới vào deck thành công | User sở hữu deck | Gửi POST `/api/v1/vocab/decks/1/cards` | `{"customWord": "Ubiquitous", "customMeaning": "Có mặt ở khắp nơi"}` | HTTP 201, thẻ được lưu với status mặc định "NEW", easeFactor=2.5 |
| **TC_VOCAB_CARD_04** | Negative | Thêm thẻ từ vựng thiếu nghĩa tự định nghĩa | User sở hữu deck | Gửi POST `/api/v1/vocab/decks/1/cards` | `{"customWord": "Test", "customMeaning": ""}` | HTTP 422, thông báo "Nghĩa từ vựng không được để trống" |
| **TC_VOCAB_CARD_05** | Happy Path | Xóa một thẻ từ vựng khỏi deck | Thẻ ID=10 thuộc deck của user | Gửi DELETE `/api/v1/vocab/cards/10` | Token chủ sở hữu | HTTP 200, thẻ bị xóa vĩnh viễn |
