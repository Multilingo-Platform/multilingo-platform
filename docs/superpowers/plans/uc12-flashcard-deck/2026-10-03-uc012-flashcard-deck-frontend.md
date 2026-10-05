# Kế hoạch Triển khai Frontend UC012: Quản lý Sổ tay & Bộ thẻ từ vựng (Vocab Decks & Flashcards)

> **Mục tiêu:** Xây dựng giao diện Frontend hoàn chỉnh cho tính năng UC012 trong thư mục `frontend/`, kết nối trực tiếp với Spring Boot Backend (cổng 8088), hỗ trợ quản lý bộ thẻ đa ngôn ngữ (Multilingual Pairs), thẻ từ vựng cá nhân, phát âm bản xứ bằng Web Speech Synthesis API, và chế độ ôn tập Spaced Repetition (SRS) với hiệu ứng lật thẻ 3D.
>
> **Tài liệu tham chiếu:**
> - Mockup & Phong cách UI: `web-ui/src/pages/student/Flashcards.tsx` và `web-ui/src/index.css`
> - Đặc tả & Nghiệp vụ: `docs/superpowers/specs/uc12-flashcard-deck/spec.md`
> - Tiêu chí kiểm thử: `docs/superpowers/specs/uc12-flashcard-deck/test-design.md`
> - Postman Collection: `postman/Multilingo_UC012_Vocab_Flashcards.postman_collection.json`
>
> **Stack công nghệ:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Axios, Web Speech API.

---

## Danh sách Task Thực thi (Atomic Tasks 2–5 phút)

- [x] **Task 1: Định nghĩa Types & DTOs TypeScript cho Vocab**
  - **Mục tiêu:** Tạo file `frontend/src/types/vocab.ts` khớp 100% với DTOs của Backend.
  - **Nội dung:**
    - Cặp ngôn ngữ `LanguageOption` (`en`, `vi`, `ko`, `zh`, `ja`,...).
    - `DeckSummary`, `DeckDetail`, `Flashcard`.
    - `CreateDeckRequest`, `UpdateDeckRequest`.
    - `CreateFlashcardRequest`, `UpdateFlashcardRequest`.
    - `ApiResponse<T>` bọc dữ liệu trả về từ backend.
  - **File:** `frontend/src/types/vocab.ts`
  - **Nghiệm thu:** File TypeScript biên dịch không lỗi (`npx tsc --noEmit`).

- [x] **Task 2: Xây dựng Module API Client Vocab & Web Speech TTS**
  - **Mục tiêu:** Tạo các hàm gọi API Backend và tiện ích phát âm bản xứ client-side.
  - **Nội dung:**
    - `frontend/src/api/vocabApi.ts`: Dùng `axiosClient` hiện có (`/api/v1/vocab/...` proxy tới 8088).
      - `getDecks()`, `createDeck()`, `getDeckDetail()`, `updateDeck()`, `deleteDeck()`.
      - `getCards()`, `addCard()`, `updateCard()`, `deleteCard()`.
    - `frontend/src/utils/speech.ts`: Hàm `speakWord(text, langCode)` sử dụng `window.speechSynthesis`, tự động nhận diện `en-US`, `ko-KR`, `zh-CN`, `ja-JP`, `vi-VN`.
  - **Files:** `frontend/src/api/vocabApi.ts`, `frontend/src/utils/speech.ts`
  - **Nghiệm thu:** Đầy đủ các hàm gọi API, không lỗi cú pháp.

- [x] **Task 3: Xây dựng Modal Tạo / Chỉnh sửa Bộ thẻ (DeckModal)**
  - **Mục tiêu:** Cho phép người dùng nhập tên, mô tả, chọn cặp ngôn ngữ (`targetLanguage`, `sourceLanguage`) và quyền riêng tư (`isPublic`).
  - **Nội dung:**
    - Form có validation: Tên bộ thẻ không được để trống (tối đa 200 ký tự).
    - Dropdown chọn ngôn ngữ học (Target) và ngôn ngữ giải nghĩa (Source).
    - Nút Lưu / Hủy kèm trạng thái loading spinner.
  - **File:** `frontend/src/components/vocab/DeckModal.tsx`
  - **Nghiệm thu:** Component render chuẩn, xử lý submit form gọi `onCreate` / `onUpdate`.

- [x] **Task 4: Xây dựng Giao diện Danh sách Bộ thẻ (DeckListView)**
  - **Mục tiêu:** Hiển thị lưới (Grid) các bộ thẻ cá nhân với các thông số thống kê SRS và cặp ngôn ngữ.
  - **Nội dung:**
    - Header: Tiêu đề "Sổ tay & Bộ thẻ từ vựng", nút "+ Tạo bộ thẻ mới".
    - Thanh tìm kiếm và bộ lọc nhanh theo cặp ngôn ngữ (`[EN ➔ VI]`, `[KO ➔ ZH]`,...).
    - Thẻ bộ thẻ (Deck Card):
      - Badge cặp ngôn ngữ nổi bật: `🇺🇸 EN ➔ 🇻🇳 VI`.
      - Tên bộ thẻ, mô tả.
      - Thống kê: Tổng số thẻ, Thẻ mới (New), Thẻ đang học (Learning), Thẻ thành thạo (Mastered).
      - Huy hiệu "Cần ôn hôm nay" (Due Today) nếu `dueTodayCards > 0`.
      - Nút thao tác: "Ôn tập ngay (SRS)", "Chi tiết từ vựng", "Sửa", "Xóa".
    - Empty state thân thiện khi chưa có bộ thẻ nào.
  - **File:** `frontend/src/components/vocab/DeckListView.tsx`
  - **Nghiệm thu:** Hiển thị danh sách decks lấy từ API, chuyển view mượt mà.

- [x] **Task 5: Xây dựng Modal Thêm / Chỉnh sửa Thẻ Từ vựng (CardModal)**
  - **Mục tiêu:** Cho phép thêm từ mới vào bộ thẻ hoặc sửa thẻ đã có.
  - **Nội dung:**
    - Ô nhập `customWord` (bắt buộc).
    - Nút "Nghe thử phát âm" trực tiếp trong modal.
    - Ô nhập `customMeaning` (nếu bỏ trống khi liên kết từ điển, Backend sẽ tự bốc nghĩa theo `sourceLanguage` của bộ thẻ).
    - Ô nhập câu ví dụ `exampleSentence`, link ảnh minh họa `customImageUrl`.
    - Thông báo lỗi trực quan nếu từ bị trùng (Conflict 409).
  - **File:** `frontend/src/components/vocab/CardModal.tsx`
  - **Nghiệm thu:** Thêm mới và cập nhật thẻ thành công, bắt lỗi validation.

- [x] **Task 6: Xây dựng Giao diện Chi tiết Bộ thẻ & Quản lý Thẻ con (DeckDetailView)**
  - **Mục tiêu:** Quản lý toàn bộ thẻ từ vựng bên trong một bộ thẻ đã chọn.
  - **Nội dung:**
    - Header: Nút quay lại danh sách decks, Tên bộ thẻ, Cặp ngôn ngữ, Nút "+ Thêm từ mới", Nút "Ôn tập SRS".
    - Thanh tìm kiếm từ vựng theo từ khóa (`keyword`) và bộ lọc trạng thái (`status`: ALL, NEW, LEARNING, MASTERED).
    - Danh sách thẻ:
      - Từ vựng (font đậm, kèm nút loa phát âm TTS), phiên âm, từ loại.
      - Nghĩa đã được trích xuất theo ngôn ngữ đích/nguồn.
      - Câu ví dụ minh họa và ảnh (nếu có).
      - Badge trạng thái SRS: Mới (Xanh lam), Đang học (Vàng), Thành thạo (Xanh lục).
      - Nút Sửa thẻ và Xóa thẻ (có confirm dialog).
  - **File:** `frontend/src/components/vocab/DeckDetailView.tsx`
  - **Nghiệm thu:** Xem, tìm kiếm, lọc, sửa, xóa thẻ hoạt động trơn tru với API.

- [x] **Task 7: Xây dựng Chế độ Luyện tập Flashcard SRS 3D Flip (SrsStudyView)**
  - **Mục tiêu:** Trải nghiệm lật thẻ 3D cao cấp (kế thừa từ `web-ui/src/pages/student/Flashcards.tsx`) kết nối dữ liệu thật từ Backend.
  - **Nội dung:**
    - Thanh tiến độ: "Thẻ X / Tổng số thẻ cần ôn".
    - Thẻ lật 3D (Flip Card):
      - Mặt trước: Từ vựng, phiên âm, nút loa phát âm (tự động phát âm khi chuyển thẻ).
      - Mặt sau: Nghĩa, câu ví dụ có highlight từ, nút lật lại.
    - Bộ điều khiển đánh giá SRS:
      - Nút "Quên" (1 ngày) - Đỏ.
      - Nút "Khó" (3 ngày) - Vàng.
      - Nút "Nhớ" (7 ngày) - Xanh lá.
    - Màn hình chúc mừng khi hoàn thành toàn bộ thẻ ôn tập trong ngày.
  - **File:** `frontend/src/components/vocab/SrsStudyView.tsx`
  - **Nghiệm thu:** Lật thẻ mượt mà, phát âm đúng giọng bản xứ, hoàn thành phiên học quay về danh sách.

- [x] **Task 8: Tích hợp Trang chính Flashcards & Cấu hình Routes trong App.tsx**
  - **Mục tiêu:** Kết nối tất cả các view vào trang chính `frontend/src/pages/student/Flashcards.tsx` và cấu hình route trong `frontend/src/App.tsx`.
  - **Nội dung:**
    - `frontend/src/pages/student/Flashcards.tsx`: Quản lý state điều hướng giữa `LIST` ➔ `DETAIL` ➔ `STUDY`.
    - Thay thế placeholder tại dòng 62 trong `frontend/src/App.tsx` bằng component `Flashcards`.
  - **Files:** `frontend/src/pages/student/Flashcards.tsx`, `frontend/src/App.tsx`
  - **Nghiệm thu:** Truy cập `/student/flashcards` hiển thị giao diện hoàn chỉnh.

- [x] **Task 9: Kiểm thử Tích hợp & Build nghiệm thu**
  - **Mục tiêu:** Đảm bảo toàn bộ dự án `frontend` build thành công không có lỗi TypeScript, CSS hoặc runtime.
  - **Lệnh kiểm thử:** `npm run build` tại thư mục `frontend/`.
  - **Nghiệm thu:** `tsc -b && vite build` kết thúc với exit code 0.

---
