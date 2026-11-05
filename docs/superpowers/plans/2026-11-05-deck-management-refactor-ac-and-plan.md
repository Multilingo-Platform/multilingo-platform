# Kế hoạch & Tiêu chuẩn Nghiệm thu Refactor Chức năng Bộ thẻ Từ vựng (Flashcard Deck Management)

> **Phương pháp luận:** Kế thừa chuẩn `acceptance-criteria-and-test-design` (Quy trình 4 bước) và `writing-plans` (Task nhỏ 2–5 phút, TDD Red-Green-Refactor).  
> **Tài liệu kiểm toán đi kèm:** [2026-11-05-deck-management-audit-and-refactor-progress.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-11-05-deck-management-audit-and-refactor-progress.md)

---

## PHẦN 1: ĐẶC TẢ TIÊU CHUẨN NGHIỆM THU (ACCEPTANCE CRITERIA & TEST DESIGN)

### Bước 1: Phân tích Phạm vi & Tác nhân (Scope & Actors)
- **Tác nhân chính (Actor):** Học viên đã đăng nhập hệ thống (`STUDENT` / Authenticated User).
- **Phạm vi xử lý (In-Scope):**
  1. **Giao diện Danh sách:** Loại bỏ hoàn toàn khối 3 thẻ thống kê tổng hợp thừa ở đầu trang (`DeckListView.tsx`).
  2. **Tạo mới Bộ thẻ:** Hỗ trợ nhập tên, mô tả, chọn cặp ngôn ngữ (Học & Giải nghĩa), chia sẻ công khai / riêng tư. Chống trùng tên trong cùng một tài khoản.
  3. **Chỉnh sửa Bộ thẻ:** Cho phép cập nhật tên, mô tả, quyền riêng tư. Chặn IDOR (không cho người khác sửa).
  4. **Xóa Bộ thẻ:** Xóa an toàn cascade toàn bộ từ vựng bên trong. Chặn IDOR.
  5. **Chuẩn hóa DTO & API:** Hợp nhất DTO trùng lặp, whitelist mã ngôn ngữ chuẩn ISO 639-1, đồng bộ max length mô tả (1000 ký tự).
- **Ngoài phạm vi (Out-of-Scope):** Chức năng Clone bộ thẻ của người khác (để ở module Marketplace/Community).

---

### Bước 2: Soạn thảo Tiêu chí Nghiệm thu (Acceptance Criteria - AC)

#### A. Kịch bản Gherkin chuẩn

```gherkin
Kịch bản 1: Tạo bộ thẻ mới thành công
Given Người dùng đã đăng nhập với userId = 1
When Người dùng gửi yêu cầu POST /api/v1/vocab/decks với tên "IELTS Vocab", ngôn ngữ "en" -> "vi"
Then Hệ thống lưu bản ghi mới vào CSDL với clones_count = 0
And Trả về mã phản hồi HTTP 201 Created với đầy đủ thông tin bộ thẻ (totalCards = 0, percent = 0)
And Frontend cập nhật trực tiếp bộ thẻ mới vào đầu danh sách mà không cần tải lại toàn bộ trang

Kịch bản 2: Báo lỗi khi tạo bộ thẻ với tên đã tồn tại trong tài khoản
Given Người dùng đã có bộ thẻ mang tên "IELTS Vocab"
When Người dùng cố tình tạo thêm bộ thẻ mới với tên "  ielts vocab  " (không phân biệt hoa thường và khoảng trắng)
Then Hệ thống từ chối lưu và ném lỗi AppException(ErrorCode.DECK_NAME_ALREADY_EXISTS)
And Trả về mã lỗi HTTP 400 Bad Request kèm thông báo "Tên bộ thẻ đã tồn tại trong tài khoản của bạn"

Kịch bản 3: Báo lỗi khi mã ngôn ngữ không hợp lệ
When Người dùng gửi mã ngôn ngữ không thuộc danh sách chuẩn (ví dụ "xyz", "123")
Then Hệ thống trả về HTTP 400 Bad Request với mã lỗi FLASHCARD_LANG_INVALID

Kịch bản 4: Chặn truy cập trái phép khi sửa hoặc xóa bộ thẻ người khác (Chống IDOR)
Given Người dùng A (userId = 1) sở hữu bộ thẻ id = 10
When Người dùng B (userId = 2) gửi yêu cầu PUT hoặc DELETE tới /api/v1/vocab/decks/10
Then Hệ thống chặn yêu cầu và ném AppException(ErrorCode.FORBIDDEN)
And Trả về HTTP 403 Forbidden, không cho phép thay đổi dữ liệu

Kịch bản 5: Giao diện danh sách bộ thẻ hiển thị sạch sẽ, không còn 3 thẻ thống kê tổng hợp
Given Người dùng truy cập trang Bộ thẻ từ vựng (/student/flashcards)
When Trang được hiển thị
Then Khối 3 thẻ ("Tổng số từ", "Cần ôn hôm nay", "Đã thành thạo") hoàn toàn không xuất hiện
And Giao diện chuyển mượt mà từ Banner tiêu đề xuống thanh tìm kiếm, bộ lọc ngôn ngữ và lưới danh sách bộ thẻ
And Từng thẻ bộ từ vựng bên dưới vẫn hiển thị chính xác số lượng từ và thanh tiến độ % thành thạo
```

#### B. Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **Tên bộ thẻ:** Bắt buộc (`@NotBlank`), độ dài từ 2 đến 200 ký tự sau khi cắt khoảng trắng thừa.
- [x] **Tính duy nhất của tên:** Trong phạm vi 1 tài khoản (`userId`), không được phép có 2 bộ thẻ trùng tên nhau (so khớp không phân biệt hoa thường).
- [x] **Mô tả:** Tùy chọn, tối đa 1000 ký tự (đồng bộ cả Backend `@Size(max = 1000)` và Frontend `maxLength={1000}`).
- [x] **Cặp ngôn ngữ:** `targetLanguage` và `sourceLanguage` phải thuộc danh sách hợp lệ: `en`, `vi`, `ja`, `ko`, `zh`, `fr`, `de`, `es`. Mặc định target='en', source='vi'.
- [x] **Ràng buộc cặp ngôn ngữ:** `targetLanguage` không được trùng với `sourceLanguage`.
- [x] **Kiểm soát quyền truy cập:** Mọi thao tác sửa (`PUT`) và xóa (`DELETE`) bắt buộc kiểm tra quyền sở hữu (`deck.getUserId().equals(currentUserId)`).

---

### Bước 3: Ma trận Kiểm thử Toàn diện (6 Khía cạnh)

| Khía cạnh | Kịch bản kiểm thử trọng tâm |
| :--- | :--- |
| **1. Happy Path** | Tạo bộ thẻ hợp lệ -> Lấy danh sách -> Sửa tên/mô tả -> Xóa bộ thẻ thành công. |
| **2. Negative Cases** | Tên rỗng, tên chỉ có dấu cách, mã ngôn ngữ lạ, ID không tồn tại (404), sửa deck người khác (403). |
| **3. Boundary (BVA)** | Tên đúng 2 ký tự (Hợp lệ), 1 ký tự (Báo lỗi), 200 ký tự (Hợp lệ), 201 ký tự (Báo lỗi). Mô tả 1000 ký tự (Hợp lệ), 1001 ký tự (Báo lỗi). |
| **4. Edge Cases** | Tên có khoảng trắng đầu/cuối (`"  TOEIC 900  "` -> tự động trim thành `"TOEIC 900"`), tên có dấu tiếng Việt, emoji. |
| **5. Security & IDOR** | Thử gọi PUT/DELETE bằng userId khác; XSS trong tên (`<script>alert(1)</script>` được escape an toàn); SQL Injection. |
| **6. UI/UX** | Bỏ khối 3 thẻ thống kê tổng hợp ở đầu trang; Nút Lưu hiển thị Loading spinner; Validate báo lỗi đỏ ngay tại form. |

---

### Bước 4: Bảng Test Cases Chuẩn Hóa 7 Cột (`TC_VOCAB_DECK_*`)

| Mã TC | Phân loại | Mô tả kịch bản | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VOCAB_DECK_01** | Happy Path | Tạo bộ thẻ thành công | Đã đăng nhập userId=1 | 1. Mở modal tạo<br>2. Nhập tên, mô tả<br>3. Chọn ngôn ngữ EN->VI<br>4. Bấm Lưu | name: "TOEIC Essential"<br>targetLang: "en"<br>sourceLang: "vi" | HTTP 201 Created; CSDL có bản ghi mới; Deck xuất hiện ngay trên UI |
| **TC_VOCAB_DECK_02** | Negative | Bỏ trống tên bộ thẻ | Đang mở modal tạo | 1. Để trống ô tên<br>2. Bấm Lưu | name: "" | Frontend chặn submit; Báo lỗi đỏ "Tên bộ thẻ không được để trống" |
| **TC_VOCAB_DECK_03** | Negative | Trùng tên bộ thẻ trong tài khoản | Đã có deck "TOEIC Essential" | 1. Nhập tên "  toeic essential  "<br>2. Bấm Lưu | name: "  toeic essential  " | HTTP 400 Bad Request; Mã lỗi `DECK_NAME_ALREADY_EXISTS`; Thông báo rõ ràng |
| **TC_VOCAB_DECK_04** | Boundary | Tên bộ thẻ 1 ký tự (Dưới cận biên) | Đang mở modal tạo | 1. Nhập tên 1 ký tự<br>2. Bấm Lưu | name: "A" | Báo lỗi: "Tên bộ thẻ phải từ 2 đến 200 ký tự" |
| **TC_VOCAB_DECK_05** | Boundary | Tên bộ thẻ 200 ký tự (Đúng cận trên) | Đang mở modal tạo | 1. Nhập tên 200 ký tự<br>2. Bấm Lưu | name: chuỗi 200 ký tự | Lưu thành công HTTP 201 |
| **TC_VOCAB_DECK_06** | Negative | Ngôn ngữ học trùng ngôn ngữ giải nghĩa | Đang mở modal tạo | 1. Chọn target = "vi"<br>2. Chọn source = "vi"<br>3. Bấm Lưu | target: "vi", source: "vi" | Báo lỗi: "Ngôn ngữ cần học và ngôn ngữ giải nghĩa không được trùng nhau" |
| **TC_VOCAB_DECK_07** | Negative | Mã ngôn ngữ không hợp lệ | Gọi API trực tiếp | 1. Gửi request POST với targetLanguage="hacker" | targetLanguage: "hacker" | HTTP 400 Bad Request; Mã `FLASHCARD_LANG_INVALID` |
| **TC_VOCAB_DECK_08** | Security | Chống IDOR khi chỉnh sửa bộ thẻ | Đã đăng nhập userId=2 | 1. Gửi PUT tới deckId=10 (của userId=1) | deckId: 10, userId: 2 | HTTP 403 Forbidden; Không sửa dữ liệu |
| **TC_VOCAB_DECK_09** | Security | Chống IDOR khi xóa bộ thẻ | Đã đăng nhập userId=2 | 1. Gửi DELETE tới deckId=10 (của userId=1) | deckId: 10, userId: 2 | HTTP 403 Forbidden; Dữ liệu không bị xóa |
| **TC_VOCAB_DECK_10** | UI/UX | Xác nhận đã bỏ 3 thẻ thống kê tổng hợp | Truy cập `/student/flashcards` | 1. Mở màn hình danh sách bộ thẻ<br>2. Quan sát phần đầu trang | N/A | Không còn hiển thị "Tổng số từ", "Cần ôn hôm nay", "Đã thành thạo"; Giao diện tinh gọn |

---

## PHẦN 2: KẾ HOẠCH TRIỂN KHAI CHI TIẾT (IMPLEMENTATION PLAN)

### Task 1: Bỏ Khối Thống kê Tổng hợp trên Giao diện `DeckListView.tsx`
- **Mục tiêu:** Xóa bỏ hoàn toàn 3 thẻ "Tổng số từ", "Cần ôn hôm nay", "Đã thành thạo" theo đúng yêu cầu người dùng.
- **File cần chỉnh sửa:** `frontend/src/features/vocab/components/deck/DeckListView.tsx`
- **Các bước thực hiện:**
  1. Xóa khối JSX `Ba thẻ Thống Kê Tổng Hợp` (dòng 136 – 185).
  2. Xóa hook tính toán `stats = useMemo(...)` (dòng 71 – 80).
  3. Xóa các icon thừa khỏi câu lệnh import: `Flame`, `GraduationCap` (giữ lại `BookOpen`).
  4. Cập nhật comment JSDoc của component.

### Task 2: Chuẩn hóa & Hợp nhất DTO Backend (DRY & Data Validation)
- **Mục tiêu:** Xóa bỏ class trùng lặp `DeckDetailResponse`, tạo DTO cơ sở chuẩn hóa validation.
- **Files:**
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/CreateDeckRequest.java`
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/UpdateDeckRequest.java`
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/DeckResponse.java`
  - `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`
- **Các bước thực hiện:**
  1. Thêm mã lỗi `DECK_NAME_ALREADY_EXISTS(400, "Tên bộ thẻ đã tồn tại trong tài khoản của bạn")` và `DECK_LANGUAGES_MUST_DIFFER(400, "Ngôn ngữ cần học và ngôn ngữ giải nghĩa không được trùng nhau")` vào `ErrorCode.java`.
  2. Bổ sung regex validation whitelist ngôn ngữ (`^(en|vi|ja|ko|zh|fr|de|es)$`) và giới hạn mô tả `@Size(max = 1000)` vào `CreateDeckRequest` & `UpdateDeckRequest`.
  3. Bổ sung các trường thống kê khởi tạo vào `DeckResponse` (`totalCards = 0`, `masteredCards = 0`...) để trả về trọn vẹn ngay khi tạo.
  4. Hợp nhất `DeckSummaryResponse` và `DeckDetailResponse` thành một DTO duy nhất.

### Task 3: Nâng cấp Backend Service & Repository (Business Logic & Anti-Duplicate)
- **Mục tiêu:** Kiểm tra trùng lặp tên bộ thẻ và đảm bảo dữ liệu hợp lệ.
- **Files:**
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/FlashcardDeckRepository.java`
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/FlashcardDeckServiceImpl.java`
  - `backend/src/main/java/com/multilingo/backend/modules/vocab/mapper/FlashcardDeckMapper.java`
- **Các bước thực hiện:**
  1. Thêm phương thức truy vấn vào Repository:
     - `boolean existsByUserIdAndNameIgnoreCase(Integer userId, String name);`
     - `boolean existsByUserIdAndNameIgnoreCaseAndIdNot(Integer userId, String name, Integer id);`
  2. Trong `createDeck()`:
     - Validate `targetLanguage` khác `sourceLanguage`.
     - Kiểm tra nếu `existsByUserIdAndNameIgnoreCase(userId, trimmedName)` -> ném `DECK_NAME_ALREADY_EXISTS`.
  3. Trong `updateDeck()`:
     - Kiểm tra nếu tên thay đổi và trùng với deck khác của cùng user -> ném lỗi tương tự.
  4. Cập nhật MapStruct Mapper tương thích với DTO đã hợp nhất.

### Task 4: Viết Test TDD Guard cho Backend (Controller & Service)
- **Mục tiêu:** Đảm bảo 100% test case pass và không có hồi quy lỗi (regression).
- **Files:**
  - `backend/src/test/java/com/multilingo/backend/modules/vocab/controller/FlashcardDeckControllerTest.java`
  - `backend/src/test/java/com/multilingo/backend/modules/vocab/service/FlashcardDeckServiceTest.java`
- **Các bước thực hiện:**
  1. Thêm test case chặn trùng tên bộ thẻ khi tạo mới (trả về 400).
  2. Thêm test case chặn trùng tên khi cập nhật (trả về 400).
  3. Thêm test case chặn cặp ngôn ngữ trùng nhau (trả về 400).
  4. Chạy `mvn test -Dtest=FlashcardDeck*` xác nhận kết quả Green.

### Task 5: Nâng cấp Form `DeckModal.tsx` & Dọn dẹp Frontend Client
- **Mục tiêu:** Đồng bộ validation, tối ưu cập nhật state.
- **Files:**
  - `frontend/src/features/vocab/components/deck/DeckModal.tsx`
  - `frontend/src/features/vocab/types/vocab.types.ts`
  - `frontend/src/features/vocab/pages/FlashcardsPage.tsx`
- **Các bước thực hiện:**
  1. Cập nhật validation trong `DeckModal.tsx`:
     - Tên tối thiểu 2 ký tự.
     - Cảnh báo nếu `targetLanguage === sourceLanguage`.
  2. Tối ưu hàm `handleSaveDeck` trong `FlashcardsPage.tsx`:
     - Chèn trực tiếp bản ghi mới trả về vào đầu mảng `decks` để UI cập nhật tức thì.

### Task 6: Nghiệm thu Toàn diện (Final Verification)
- **Các bước thực hiện:**
  1. Kiểm tra build frontend (không có lỗi TypeScript).
  2. Chạy test suite backend: `mvn test -Dtest=FlashcardDeckControllerTest,FlashcardDeckServiceTest`.
  3. Kiểm tra thực tế giao diện: Khối 3 thẻ thống kê đã biến mất hoàn toàn, danh sách bộ thẻ hiển thị sạch sẽ, tạo/sửa/xóa mượt mà.

