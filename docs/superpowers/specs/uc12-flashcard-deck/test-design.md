# 🧪 Tài Liệu Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử (Test Design)
## Phân Hệ: UC012 - Quản lý Sổ tay & Bộ thẻ từ vựng (Vocab Decks & Flashcards)

- **Mã Use Case:** UC012
- **Tài liệu tham chiếu:** [Đặc tả kỹ thuật UC012](spec.md)
- **Chuẩn quy trình:** Tuân thủ quy chuẩn 4 bước của kỹ năng `acceptance-criteria-and-test-design`.

---

## BƯỚC 1: Xác Định Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Tác nhân (Actors)
- **Học viên / Người dùng đã đăng nhập (`ROLE_USER`):**
  - Có toàn quyền CRUD với các bộ thẻ và thẻ từ vựng do chính mình tạo ra (`owner`).
  - Không có quyền xem/sửa/xóa bộ thẻ ở chế độ riêng tư hoặc thẻ từ vựng của người dùng khác.
- **Hệ thống (System / Background Job):**
  - Tự động cập nhật các trường audit `created_at`, `updated_at` qua `BaseEntity`.
  - Tự động gán các tham số SRS mặc định khi tạo thẻ mới (`status="NEW"`, `ease_factor=2.50`, `interval_days=0`, `review_count=0`).

### 1.2. Ranh giới hệ thống (System Boundaries)
- **In-Scope:**
  - Quản lý Bộ thẻ: Lấy danh sách kèm thống kê số lượng thẻ (Total, New, Learning, Mastered, Due Review), tạo mới, chỉnh sửa, xóa cascade toàn bộ thẻ con.
  - Chi tiết Bộ thẻ & Quản lý Thẻ: Tìm kiếm từ khóa, lọc theo trạng thái thẻ, thêm thẻ mới, sửa thẻ, xóa thẻ.
  - Launchpad điều hướng sang 4 chế độ học tập (SRS, Quiz, Test, Speed Match).
  - Empty State & Loading State.
- **Out-of-Scope:**
  - Thuật toán chấm điểm và lật thẻ 3D SRS (thuộc UC12.2).
  - Sinh đề và chấm điểm trắc nghiệm (thuộc UC12.3 & UC12.4).
  - Bàn cờ game ghép thẻ (thuộc UC12.5).

---

## BƯỚC 2: Tiêu Chí Nghiệm Thu (Acceptance Criteria & Business Rules)

### 2.1. Kịch bản Gherkin chuẩn hóa

#### AC_01: Lấy danh sách bộ thẻ kèm thống kê số lượng thẻ (Happy Path)
```gherkin
Given Người dùng có ID=1 đã đăng nhập và sở hữu 2 bộ thẻ:
  | ID | Tên bộ thẻ | Tổng thẻ | Mới (NEW) | Đang học (LEARNING) | Đã thuộc (MASTERED) | Cần ôn hôm nay |
  | 10 | IELTS Core | 5        | 2         | 2                   | 1                   | 3              |
  | 11 | TOEIC Basic| 0        | 0         | 0                   | 0                   | 0              |
When Gửi yêu cầu "GET /api/v1/vocab/decks"
Then Hệ thống trả về mã trạng thái HTTP 200 OK
And Cấu trúc JSON dạng ApiResponse: success=true, code=200
And Danh sách chứa đúng 2 bộ thẻ với các chỉ số thống kê khớp với CSDL
```

#### AC_02: Tạo bộ thẻ mới thành công
```gherkin
Given Người dùng có ID=1 đã đăng nhập
When Gửi yêu cầu "POST /api/v1/vocab/decks" với payload:
  """
  {
    "name": "Từ vựng N1 Chuyên sâu",
    "description": "Từ vựng cấp độ cao cấp",
    "isPublic": false
  }
  """
Then Hệ thống lưu bản ghi mới vào bảng "flashcard_decks" với user_id=1
And Trả về HTTP 201 Created với thông tin bộ thẻ kèm ID tự tăng
```

#### AC_03: Từ chối tạo bộ thẻ khi tên bị trống hoặc vượt quá 200 ký tự (Validation)
```gherkin
Given Người dùng đã đăng nhập
When Gửi yêu cầu "POST /api/v1/vocab/decks" với "name" là chuỗi rỗng "" hoặc chỉ chứa khoảng trắng "   "
Then Hệ thống trả về HTTP 422 Unprocessable Entity
And Mã lỗi ApiResponse là 422 với thông báo "Tên bộ thẻ không được để trống"
When Gửi yêu cầu "POST /api/v1/vocab/decks" với "name" có 201 ký tự
Then Hệ thống trả về HTTP 422 với thông báo độ dài tối đa là 200 ký tự
```

#### AC_04: Bảo vệ chống truy cập trái phép (IDOR Prevention)
```gherkin
Given Bộ thẻ có ID=100 thuộc sở hữu của Người dùng A (userId=1)
When Người dùng B (userId=2) gửi yêu cầu:
  - "GET /api/v1/vocab/decks/100" (nếu isPublic=false)
  - Hoặc "PUT /api/v1/vocab/decks/100"
  - Hoặc "DELETE /api/v1/vocab/decks/100"
Then Hệ thống ném AppException với ErrorCode.FORBIDDEN
And Trả về HTTP 403 Forbidden với message "Không có quyền thực hiện thao tác"
And CSDL không bị thay đổi bất kỳ trường nào
```

#### AC_05: Xóa bộ thẻ kích hoạt xóa cascade toàn bộ thẻ con
```gherkin
Given Bộ thẻ ID=10 thuộc sở hữu của Người dùng A và chứa 15 thẻ từ vựng trong "user_flashcards"
When Người dùng A gửi yêu cầu "DELETE /api/v1/vocab/decks/10"
Then Hệ thống trả về HTTP 200 OK
And Bản ghi bộ thẻ ID=10 bị xóa khỏi bảng "flashcard_decks"
And Toàn bộ 15 bản ghi trong "user_flashcards" có deck_id=10 bị xóa hoàn toàn khỏi CSDL
```

#### AC_06: Tìm kiếm và lọc thẻ từ vựng trong bộ thẻ
```gherkin
Given Bộ thẻ ID=10 chứa 4 thẻ từ vựng:
  | custom_word | custom_meaning | status |
  | Ubiquitous  | Khắp mọi nơi   | NEW    |
  | Eloquent    | Lưu loát       | LEARNING |
  | Diligent    | Chăm chỉ       | MASTERED |
  | Apple       | Quả táo        | NEW    |
When Gửi yêu cầu "GET /api/v1/vocab/decks/10/cards?status=LEARNING"
Then Hệ thống chỉ trả về 1 thẻ "Eloquent"
When Gửi yêu cầu "GET /api/v1/vocab/decks/10/cards?keyword=khắp"
Then Hệ thống trả về 1 thẻ "Ubiquitous" (tìm kiếm không phân biệt hoa thường trong custom_meaning)
```

#### AC_07: Ngăn chặn tạo từ vựng trùng lặp trong cùng một bộ thẻ (Conflict 409)
```gherkin
Given Bộ thẻ ID=10 đã chứa từ vựng "Ubiquitous"
When Người dùng gửi yêu cầu "POST /api/v1/vocab/decks/10/cards" với "customWord": "ubiquitous" (khác hoa thường)
Then Hệ thống ném AppException với ErrorCode.CONFLICT
And Trả về HTTP 409 Conflict với message "Từ vựng này đã tồn tại trong bộ thẻ"
```

### 2.2. Checklist Quy Tắc Nghiệp Vụ (Business Rules Checklist)
- [x] **Audit:** Kế thừa `BaseEntity`, `created_at` và `updated_at` được tự động set, không chỉnh sửa thủ công.
- [x] **SRS Defaults:** Mọi thẻ tạo mới bắt buộc có:
  - `status = "NEW"`
  - `review_count = 0`
  - `ease_factor = 2.50`
  - `interval_days = 0`
  - `next_review_date = Instant.now()`
- [x] **Sanitization & Trim:** Chuỗi `name`, `custom_word`, `custom_meaning` phải được trim khoảng trắng ở hai đầu trước khi validate và lưu.
- [x] **Cascade Safe:** Xóa deck phải dọn dẹp sạch flashcards liên quan trên mọi môi trường DB (H2, PostgreSQL).

---

## BƯỚC 3: Ma Trận Kiểm Thử 6 Khía Cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **1. Happy Path** | Lấy danh sách, tạo deck, xem chi tiết, sửa deck, xóa deck, thêm card, sửa card, xóa card | Dữ liệu hợp lệ chuẩn tiếng Anh/tiếng Việt | HTTP 200/201, payload `ApiResponse` chuẩn, status=true |
| **2. Negative** | - Tạo deck với name rỗng<br>- Thêm card thiếu nghĩa<br>- Tìm kiếm deck/card với ID không tồn tại | Name: `""`, `null`<br>customMeaning: `""`<br>ID: `999999` | - HTTP 422 `VALIDATION_FAILED`<br>- HTTP 422 `VALIDATION_FAILED`<br>- HTTP 404 `RESOURCE_NOT_FOUND` |
| **3. Boundary** | - Tên deck 200 ký tự vs 201 ký tự<br>- Từ vựng 150 ký tự vs 151 ký tự | String có độ dài chính xác 200 & 201 ký tự | 200 ký tự -> Pass (201); 201 ký tự -> Báo lỗi validation (422) |
| **4. Edge Cases** | - Tên deck có ký tự đặc biệt, Unicode, emoji: `Bộ thẻ IELTS 🎯 2026`<br>- Từ vựng chứa khoảng trắng dư: `"   ephemeral   "`<br>- Bộ thẻ không có từ nào (0 thẻ) | Ký tự Unicode, whitespace | Trim khoảng trắng sạch sẽ, lưu đúng định dạng Unicode, trả về `totalCards=0` không bị lỗi chia cho 0 |
| **5. Security** | - IDOR: User B sửa/xóa deck hoặc card của User A<br>- XSS Injection trong tên deck hoặc nghĩa từ | ID của người khác, payload `<script>alert('xss')</script>` | - HTTP 403 `FORBIDDEN`<br>- Nội dung được escape an toàn khi render UI |
| **6. UI/UX** | - Empty State khi người dùng chưa có deck nào<br>- Loading Skeleton/Spinner khi gọi API<br>- Nút bấm bị vô hiệu hóa khi đang submit | Danh sách rỗng, mạng chậm | Hiển thị hướng dẫn tạo bộ thẻ đầu tiên; Chống spam submit nhiều lần |

---

## BƯỚC 4: Bảng Test Cases Chuẩn Hóa (Standard Test Cases)

| Mã Test Case | Phân loại | Mô tả kịch bản | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VOCAB_DECK_01** | Happy Path | Lấy danh sách bộ thẻ kèm thống kê | User 1 đăng nhập, có 2 deck | Gửi `GET /api/v1/vocab/decks` | Header `X-User-Id: 1` | HTTP 200, danh sách 2 deck kèm đủ 5 trường thống kê |
| **TC_VOCAB_DECK_02** | Happy Path | Tạo bộ thẻ mới thành công | User 1 đăng nhập | Gửi `POST /api/v1/vocab/decks` | `{"name": "IELTS Writing", "isPublic": false}` | HTTP 201, trả về deck có ID mới, user_id=1 |
| **TC_VOCAB_DECK_03** | Negative | Tạo bộ thẻ với tên trống | User 1 đăng nhập | Gửi `POST /api/v1/vocab/decks` | `{"name": "   "}` | HTTP 422, thông báo validation rõ ràng |
| **TC_VOCAB_DECK_04** | Boundary | Kiểm tra độ dài tên deck tối đa 200 ký tự | User 1 đăng nhập | Gửi POST với name 200 và 201 ký tự | String 200 vs 201 ký tự | 200 -> HTTP 201 Created; 201 -> HTTP 422 Error |
| **TC_VOCAB_DECK_05** | Security | Chặn sửa/xóa deck của user khác (IDOR) | Deck ID=10 thuộc User 1; User 2 gửi request | Gửi `PUT` hoặc `DELETE /api/v1/vocab/decks/10` | Header `X-User-Id: 2` | HTTP 403 FORBIDDEN, dữ liệu không bị thay đổi |
| **TC_VOCAB_DECK_06** | Happy Path | Xóa bộ thẻ và cascade xóa các flashcards | Deck ID=10 có 5 flashcards | Gửi `DELETE /api/v1/vocab/decks/10` | Header `X-User-Id: 1` | HTTP 200, deck và toàn bộ 5 thẻ bị xóa khỏi DB |
| **TC_VOCAB_DECK_07** | Happy Path | Tạo bộ thẻ với cặp ngôn ngữ tùy chỉnh | User 1 đăng nhập | Gửi `POST /api/v1/vocab/decks` | `{"name": "TOEIC for Korean", "targetLanguage": "en", "sourceLanguage": "ko"}` | HTTP 201, trả về deck có targetLanguage="en", sourceLanguage="ko" |
| **TC_VOCAB_CARD_01** | Happy Path | Lọc thẻ theo trạng thái | Deck ID=10 có thẻ NEW và LEARNING | Gửi `GET /api/v1/vocab/decks/10/cards?status=NEW` | Header `X-User-Id: 1` | HTTP 200, chỉ trả về các thẻ có status="NEW" |
| **TC_VOCAB_CARD_02** | Happy Path | Tìm kiếm từ khóa không phân biệt hoa thường | Deck ID=10 có từ "Eloquent" | Gửi `GET /api/v1/vocab/decks/10/cards?keyword=elo` | Header `X-User-Id: 1` | HTTP 200, trả về thẻ "Eloquent" |
| **TC_VOCAB_CARD_03** | Happy Path | Thêm thẻ từ vựng mới với tham số SRS mặc định | Deck ID=10 thuộc User 1 | Gửi `POST /api/v1/vocab/decks/10/cards` | `{"customWord": "Pernicious", "customMeaning": "Nguy hại"}` | HTTP 201, thẻ được lưu với status="NEW", easeFactor=2.50 |
| **TC_VOCAB_CARD_04** | Negative | Thêm thẻ thiếu nghĩa tùy chỉnh khi không có wordId | Deck ID=10 thuộc User 1 | Gửi `POST /api/v1/vocab/decks/10/cards` | `{"customWord": "Test", "customMeaning": ""}` | HTTP 422 VALIDATION_FAILED |
| **TC_VOCAB_CARD_05** | Conflict | Ngăn chặn thêm từ vựng đã tồn tại trong deck | Deck ID=10 đã có từ "Apple" | Gửi `POST /api/v1/vocab/decks/10/cards` với word="apple" | `{"customWord": "apple", "customMeaning": "Trái táo"}` | HTTP 409 CONFLICT, message cảnh báo trùng từ |
| **TC_VOCAB_CARD_06** | Happy Path | Xóa một thẻ từ vựng khỏi bộ thẻ | Thẻ ID=5 thuộc deck của User 1 | Gửi `DELETE /api/v1/vocab/cards/5` | Header `X-User-Id: 1` | HTTP 200, thẻ ID=5 bị xóa |
| **TC_VOCAB_CARD_07** | Security | Chặn sửa/xóa thẻ từ vựng của user khác (IDOR) | Thẻ ID=5 thuộc User 1; User 2 gửi request | Gửi `DELETE /api/v1/vocab/cards/5` | Header `X-User-Id: 2` | HTTP 403 FORBIDDEN |
| **TC_VOCAB_CARD_08** | Happy Path | Thêm thẻ liên kết DictionaryWord tự động lấy nghĩa theo source_language | Deck ID=10 (sourceLanguage="ko"), Word ID=1 có defaultMeaning: `{"ko":"사과"}` | Gửi `POST /api/v1/vocab/decks/10/cards` với wordId=1, customMeaning="" | `{"customWord": "apple", "wordId": 1}` | HTTP 201, customMeaning được tự động gán là "사과" |
