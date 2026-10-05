# Kế Hoạch Triển Khai: Redesign Popup Thêm / Sửa Thẻ Từ Vựng & Hỗ Trợ Phiên Âm, Loại Từ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết kế lại Popup (Modal) Thêm/Sửa thẻ từ vựng theo giao diện 2 cột hiện đại (Form nhập liệu + Live Preview thẻ lật 2 mặt) và hỗ trợ lưu trữ, hiển thị đầy đủ Phiên âm (IPA) cùng Loại từ (POS).

**Architecture:** Mở rộng DTO tầng Backend (`CreateFlashcardRequest`, `UpdateFlashcardRequest`) nhận thêm `phonetic` và `pos`. `UserFlashcardServiceImpl` tự động liên kết hoặc tạo bản ghi trong `DictionaryWord` để tận dụng khóa ngoại `word_id` và mapper hiện có mà không phá vỡ CSDL. Tầng Frontend tái cấu trúc `CardModal.tsx` thành dạng 2 cột chia rõ Form nhập liệu (trái) và Live Flashcard Preview (phải) cập nhật theo thời gian thực.

**Tech Stack:** Java 23, Spring Boot 3.3.4, PostgreSQL, MapStruct, JUnit 5, Mockito, React 19, TypeScript, Vite, Vanilla CSS.

**Spec:** `docs/superpowers/specs/uc12-flashcard-deck/uc12.1-tao-moi-va-chinh-sua-the-ghi-nho.md`

## Global Constraints
- Primary Key của các Entity kế thừa `BaseEntity` (`Integer`, tự tăng `GenerationType.IDENTITY`).
- Mọi Controller Backend trả về `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ ném qua `AppException(ErrorCode)`.
- Frontend tuân thủ Feature-based Architecture; CSS dùng Design Tokens hiện có trong `vocab.css`.
- **Yêu cầu UI:** Bỏ hết các icon trang trí trong Modal (icon sách, icon ảnh, icon sparkles, icon lật thẻ, v.v.). Sử dụng typography thuần, nhãn text trực quan, thanh lịch, tinh gọn tối đa.
- Tuyệt đối không tự ý commit git khi chưa hiển thị diff và được người dùng phê duyệt.

## Review Focus
1. Thêm từ mới khi người dùng nhập cả `phonetic` và `pos` ➔ response trả về đầy đủ `phonetic` và `pos`.
2. Chỉnh sửa thẻ có sẵn: Cập nhật `phonetic` hoặc `pos` ➔ dữ liệu được lưu và hiển thị lại chính xác.
3. Người dùng không nhập `phonetic` hoặc `pos` ➔ hệ thống hoạt động bình thường, không gây lỗi null pointer.
4. Giao diện Live Preview trên modal: Tự động đổi nội dung tức thì khi người dùng gõ vào các ô input.
5. Responsive trên mobile: Modal chuyển từ 2 cột sang 1 cột xếp chồng mượt mà.

---

### Task 1: Cập Nhật Backend DTOs & Repository Method

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/CreateFlashcardRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/UpdateFlashcardRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/DictionaryWordRepository.java`

- [x] **Step 1.1:** Thêm các trường `phonetic` (@Size max 150), `pos` (@Size max 50), `level` (@Size max 10) vào `CreateFlashcardRequest.java`.
- [x] **Step 1.2:** Thêm các trường `phonetic`, `pos`, `level` vào `UpdateFlashcardRequest.java`.
- [x] **Step 1.3:** Khai báo phương thức `Optional<DictionaryWord> findFirstByWordIgnoreCaseAndLanguageCode(String word, String languageCode)` trong `DictionaryWordRepository.java`.
- [x] **Step 1.4:** Chạy lệnh `mvn test-compile` kiểm tra biên dịch Java thành công.

---

### Task 2: Backend Service Logic & TDD Unit Tests

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/UserFlashcardServiceImpl.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/UserFlashcardServiceTest.java`

- [x] **Step 2.1 (TDD Red):** Viết unit test trong `UserFlashcardServiceTest.java` kiểm tra trường hợp `addCard` có truyền `phonetic` và `pos` ➔ xác nhận thẻ được liên kết với `DictionaryWord` chứa `phonetic` và `pos` tương ứng.
- [x] **Step 2.2 (Green):** Cập nhật `addCard` và `updateCard` trong `UserFlashcardServiceImpl.java` để tìm hoặc tạo mới `DictionaryWord` khi người dùng nhập `phonetic`/`pos`.
- [x] **Step 2.3:** Chạy `mvn test -Dtest=UserFlashcardServiceTest` và `mvn test -Dtest=UserFlashcardControllerTest` xác nhận 100% test PASS.

---

### Task 3: Cập Nhật Frontend TypeScript Types

**Files:**
- Modify: `frontend/src/types/vocab.ts`

- [x] **Step 3.1:** Bổ sung `phonetic?: string; pos?: string; level?: string;` vào interface `CreateFlashcardRequest`.
- [x] **Step 3.2:** Bổ sung `phonetic?: string; pos?: string; level?: string;` vào interface `UpdateFlashcardRequest`.

---

### Task 4: Redesign Component CardModal (2 Cột & Live Preview)

**Files:**
- Modify: `frontend/src/components/vocab/CardModal.tsx`
- Modify: `frontend/src/pages/student/Flashcards.tsx`

- [x] **Step 4.1:** Bổ sung state `phonetic`, `pos`, `level` và state `previewSide` ('FRONT' | 'BACK') trong `CardModal.tsx`.
- [x] **Step 4.2:** Tái cấu trúc JSX:
  - Cột Trái: Nhóm từ vựng (Word + nút loa phát âm text), hàng đôi Phiên âm (IPA) & Loại từ (Dropdown select: noun, verb, adj, adv...), Nghĩa giải thích, Câu ví dụ minh họa, Link ảnh.
  - Cột Phải: Live Flashcard Preview hiển thị thẻ 2 mặt (có nút lật mặt trước/sau), hiển thị ảnh preview, từ vựng, phiên âm, badge loại từ, nghĩa, câu ví dụ thời gian thực.
  - **Quy chuẩn UI:** Hoàn toàn không dùng icon (thay bằng text tinh gọn, thanh lịch).
- [x] **Step 4.3:** Cập nhật `handleSaveCard` trong `Flashcards.tsx` để truyền đầy đủ `phonetic` và `pos` khi gọi `vocabApi.updateCard` và `vocabApi.addCard`.

---

### Task 5: Bổ Sung Styling Hiện Đại trong vocab.css

**Files:**
- Modify: `frontend/src/components/vocab/vocab.css`

- [x] **Step 5.1:** Thêm CSS cho modal 2 cột: `.vocab-modal-split-layout`, `.vocab-modal-left-col`, `.vocab-modal-right-col`.
- [x] **Step 5.2:** Thêm CSS cho Live Preview Flashcard: `.vocab-live-card-box`, `.vocab-preview-switch-btn`, `.vocab-live-card-badge`, `.vocab-preview-phonetic-text`, `.vocab-preview-pos-badge`.
- [x] **Step 5.3:** Cấu hình Media Query cho mobile (`@media (max-width: 860px)`) tự động chuyển thành 1 cột mượt mà.

---

### Task 6: Nghiệm Thu Toàn Diện & Verification

- [x] **Step 6.1:** Chạy `npm run build` trong `frontend/` xác nhận 0 errors.
- [x] **Step 6.2:** Chạy `mvn test` trong `backend/` xác nhận toàn bộ test PASS (79/79 tests passed).
- [ ] **Step 6.3:** Hiển thị diff và xin xác nhận commit từ người dùng theo đúng quy chuẩn dự án.
