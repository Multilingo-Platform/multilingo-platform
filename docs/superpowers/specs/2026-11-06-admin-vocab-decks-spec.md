# Đặc tả Kỹ thuật & Thiết kế Kiểm thử: Quản lý Bộ thẻ Từ vựng (Admin Flashcard Deck Management)

**Mã chức năng:** `ADMIN-VOCAB-001`  
**Ngày tạo:** 06/11/2026  
**Trạng thái:** Approved  
**Tác nhân chính:** Quản trị viên hệ thống (Admin)  
**Phạm vi:** Backend REST APIs (`/api/v1/admin/vocab/**`) & Frontend Admin Portal (`/admin/vocab`)

---

## 1. Mục tiêu & Phạm vi (Scope & Actors)

### 1.1. Mục tiêu nghiệp vụ
Cung cấp giải pháp toàn diện cho Quản trị viên (Admin) để quản lý tập trung toàn bộ các bộ thẻ từ vựng trong hệ thống Multilingo:
- Quản trị các bộ thẻ do người dùng tạo và tạo lập các bộ thẻ học tập chuẩn mẫu của hệ thống (System Official Decks).
- Tra cứu, tìm kiếm, lọc theo cặp ngôn ngữ và trạng thái công khai.
- Chỉnh sửa, bật/tắt quyền riêng tư (Public/Private), xóa an toàn kèm các thẻ con (Cascade Delete).
- Quản lý danh sách các từ vựng con bên trong từng bộ thẻ.

### 1.2. Tác nhân & Ranh giới bảo mật (Actors & Security Boundaries)
- **Actor:** Quản trị viên (`ADMIN`).
- **Ranh giới ủy quyền:** Toàn bộ API bắt buộc có xác thực JWT hợp lệ và quyền `ROLE_ADMIN` (`@PreAuthorize("hasRole('ADMIN')")`). Người dùng thông thường (`USER`) hoặc chưa đăng nhập nếu gọi API sẽ bị từ chối với HTTP 403 Forbidden hoặc HTTP 401 Unauthorized.

---

## 2. Tiêu chí nghiệm thu (Acceptance Criteria - Gherkin)

### AC 01: Xem danh sách bộ thẻ toàn hệ thống có phân trang và bộ lọc
```gherkin
Given Admin đã đăng nhập vào hệ thống và truy cập trang /admin/vocab
When Admin xem danh sách bộ thẻ với các tham số tìm kiếm và bộ lọc (keyword, targetLanguage, isPublic, page, size)
Then Hệ thống trả về danh sách bộ thẻ phân trang chuẩn PageResponse
And Mỗi bản ghi hiển thị: id, name, description, targetLanguage, sourceLanguage, isPublic, clonesCount, ownerName, ownerEmail, totalCards, createdAt
And Danh sách được sắp xếp mặc định theo createdAt giảm dần (mới nhất lên đầu)
```

### AC 02: Bật/Tắt trạng thái Công khai (Toggle Public) 1-Click
```gherkin
Given Bộ thẻ có ID = 10 đang có trạng thái isPublic = false
When Admin thực hiện PATCH /api/v1/admin/vocab/decks/10/toggle-public
Then Hệ thống cập nhật isPublic = true
And Trả về HTTP 200 OK kèm thông tin bộ thẻ sau khi cập nhật
```

### AC 03: Tạo mới bộ thẻ chuẩn hệ thống (Create Official Deck)
```gherkin
Given Admin nhập thông tin tạo bộ thẻ mới:
  | name | description | targetLanguage | sourceLanguage | isPublic |
  | "TOEIC 600+ Essential" | "Từ vựng trọng tâm TOEIC" | "en" | "vi" | true |
When Admin gửi yêu cầu POST /api/v1/admin/vocab/decks
Then Hệ thống lưu bộ thẻ mới với userId là ID của Admin hiện tại
And Trả về HTTP 201 Created kèm DeckResponse
```

### AC 04: Xem chi tiết bộ thẻ và danh sách thẻ từ vựng bên trong
```gherkin
Given Bộ thẻ ID = 10 tồn tại trong hệ thống và có chứa 5 thẻ từ vựng
When Admin gửi yêu cầu GET /api/v1/admin/vocab/decks/10
Then Hệ thống trả về HTTP 200 OK kèm AdminDeckDetailResponse
And Chứa đầy đủ thông tin bộ thẻ và danh sách 5 thẻ từ vựng (id, customWord, customMeaning, exampleSentence, status, createdAt)
```

### AC 05: Xóa vĩnh viễn bộ thẻ và thẻ từ vựng con (Cascade Delete)
```gherkin
Given Bộ thẻ ID = 10 có chứa 8 thẻ từ vựng con
When Admin gửi yêu cầu DELETE /api/v1/admin/vocab/decks/10
Then Hệ thống xóa toàn bộ 8 thẻ từ vựng con trong bảng user_flashcards
And Hệ thống xóa bản ghi bộ thẻ trong bảng flashcard_decks
And Trả về HTTP 200 OK với thông báo "Xóa bộ thẻ thành công"
```

---

## 3. Ma trận kiểm thử 6 khía cạnh (6-Aspect Test Matrix)

| STT | Khía cạnh | Kịch bản kiểm thử | Kết quả kỳ vọng |
| :---: | :--- | :--- | :--- |
| 1 | **Happy Path** | Lấy danh sách bộ thẻ với trang 0, kích thước 10 | HTTP 200, trả về đúng số bản ghi và thông tin người sở hữu |
| 2 | **Happy Path** | Tạo mới bộ thẻ mẫu hệ thống thành công | HTTP 201, ID tự tăng, `userId` gắn đúng Admin |
| 3 | **Happy Path** | Sửa thông tin bộ thẻ và đổi sang Public | HTTP 200, dữ liệu được cập nhật chính xác |
| 4 | **Happy Path** | Xóa bộ thẻ đang chứa các từ vựng con | HTTP 200, bộ thẻ và toàn bộ từ vựng con bị xóa sạch |
| 5 | **Negative** | Tạo bộ thẻ với tên để trống (`name = ""`) | HTTP 422/400 Validation Error, báo tên không được để trống |
| 6 | **Negative** | Lấy chi tiết hoặc xóa bộ thẻ không tồn tại (`id = 999999`) | HTTP 404 NOT_FOUND (`DECK_NOT_FOUND`) |
| 7 | **Boundary** | Tìm kiếm từ khóa không khớp (`keyword = "XYZ_NOT_EXIST"`) | HTTP 200, trả về danh sách rỗng (`totalElements = 0`) |
| 8 | **Edge Case** | Xóa bộ thẻ rỗng không có thẻ từ vựng nào bên trong | HTTP 200, xóa thành công không sinh lỗi SQL constraint |
| 9 | **Security/RBAC** | Người dùng thường (`USER`) hoặc token nặc danh gọi API Admin | HTTP 403 FORBIDDEN hoặc 401 UNAUTHORIZED |
| 10 | **UI/UX** | Admin bấm nút Xóa trên giao diện | Hiển thị Modal SweetAlert2 cảnh báo xác nhận trước khi gọi API |

---

## 4. Bảng Test Cases chuẩn hóa 7 cột

| Test Case ID | Tên Test Case | Điều kiện tiên quyết | Dữ liệu đầu vào (Input) | Các bước thực hiện | Kết quả mong đợi | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TC_ADMIN_DECK_GET_01` | Lấy danh sách bộ thẻ phân trang thành công | Admin đã đăng nhập | `page=0, size=10, keyword=null` | Gửi GET `/api/v1/admin/vocab/decks` | HTTP 200, danh sách chứa đủ các trường tổng hợp | Pending |
| `TC_ADMIN_DECK_GET_02` | Lọc bộ thẻ theo cặp ngôn ngữ và trạng thái public | Đã có bộ thẻ trong DB | `targetLanguage=en, isPublic=true` | Gửi GET `/api/v1/admin/vocab/decks` kèm query params | HTTP 200, tất cả kết quả trả về đều có `targetLanguage=en` và `isPublic=true` | Pending |
| `TC_ADMIN_DECK_GET_03` | Lấy chi tiết bộ thẻ kèm danh sách thẻ từ vựng | Bộ thẻ ID=1 tồn tại | `deckId=1` | Gửi GET `/api/v1/admin/vocab/decks/1` | HTTP 200, thông tin bộ thẻ và danh sách `cards` không rỗng | Pending |
| `TC_ADMIN_DECK_GET_04` | Lấy chi tiết bộ thẻ không tồn tại báo lỗi 404 | Không có deck ID=999 | `deckId=999` | Gửi GET `/api/v1/admin/vocab/decks/999` | HTTP 404, mã lỗi `DECK_NOT_FOUND` | Pending |
| `TC_ADMIN_DECK_POST_01` | Tạo mới bộ thẻ hệ thống thành công | Admin đã đăng nhập | `name="IELTS Core", targetLanguage="en", isPublic=true` | Gửi POST `/api/v1/admin/vocab/decks` | HTTP 201, trả về `DeckResponse` mới tạo | Pending |
| `TC_ADMIN_DECK_POST_02` | Tạo bộ thẻ validation lỗi tên trống | Admin đã đăng nhập | `name=""` | Gửi POST `/api/v1/admin/vocab/decks` | HTTP 422/400 Validation Error | Pending |
| `TC_ADMIN_DECK_PUT_01` | Cập nhật thông tin bộ thẻ thành công | Bộ thẻ ID=1 tồn tại | `name="TOEIC Updated", isPublic=false` | Gửi PUT `/api/v1/admin/vocab/decks/1` | HTTP 200, thông tin được cập nhật | Pending |
| `TC_ADMIN_DECK_PATCH_01` | Chuyển đổi trạng thái Public/Private 1-Click | Bộ thẻ ID=1 đang isPublic=false | `deckId=1` | Gửi PATCH `/api/v1/admin/vocab/decks/1/toggle-public` | HTTP 200, `isPublic` đổi thành `true` | Pending |
| `TC_ADMIN_DECK_DEL_01` | Xóa bộ thẻ thành công kèm cascade thẻ con | Bộ thẻ ID=1 tồn tại | `deckId=1` | Gửi DELETE `/api/v1/admin/vocab/decks/1` | HTTP 200, bản ghi deck và cards bị xóa khỏi DB | Pending |
| `TC_ADMIN_DECK_SEC_01` | Chặn truy cập trái phép khi không phải ADMIN | User có role `STUDENT` | Token của Student | Gửi GET `/api/v1/admin/vocab/decks` | HTTP 403 FORBIDDEN | Pending |

