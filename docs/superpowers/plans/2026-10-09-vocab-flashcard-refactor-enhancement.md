# Kế Hoạch Triển Khai: Refactor & Hoàn Thiện Phân Hệ Flashcard & Từ Vựng (UC012 / UC12.1 - UC12.5)

> **Tài liệu duy nhất (Single Source of Truth) điều phối toàn bộ phân hệ Flashcards & Sổ tay từ vựng.**
> Tham chiếu kịch bản nghiệp vụ: **Bảng 2.32 Kịch bản Use Case Quản lý Sổ tay và bộ thẻ từ vựng (UC012 / UC12.1)**.

**Goal:** Tái cấu trúc (Refactor) phân hệ Từ vựng & Flashcards sang chuẩn Feature-based Architecture (`features/vocab/`), hiện đại hóa giao diện (UI/UX) với Tailwind CSS & Lucide Icons, đa ngôn ngữ hóa 100% (i18n), và hoàn thiện trọn vẹn 4 chế độ học tập (Ôn tập Flashcard SRS, Ghép từ/Trắc nghiệm, Ghép thẻ tốc độ, Thi thử tính giờ).

**Architecture:**
- **Frontend:** Chuyển đổi từ `components/vocab/` sang cấu trúc tính năng độc lập `features/vocab/` chuẩn FSD (Feature-Sliced Design). Thay thế file `vocab.css` tự viết bằng Tailwind CSS utility classes, đồng bộ với Design System của ứng dụng.
- **Backend:** Tận dụng hệ thống API hiện có (`FlashcardDeckController`, `UserFlashcardController`, `FlashcardStudyController`), kết nối đồng bộ dữ liệu XP, Streak và trạng thái từ vựng giữa 4 chế độ học và cơ sở dữ liệu.
- **Testing & Verification:** Đảm bảo toàn bộ 59 unit tests backend tiếp tục PASS 100%, frontend build `npm run build` không lỗi type, và tuân thủ TDD cho các tính năng mới.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Web Speech Synthesis API, Web Audio API, Spring Boot 3, PostgreSQL.

---

## 1. Bản Đồ Tiến Độ 5 Chặng (Roadmap Overview)

- [x] **Chặng 0: Khởi Tạo Nền Tảng, Khung Module & i18n** *(Đã hoàn thành - Commit `b415397`, `5854c62`, `1566715`)*
- [x] **Chặng 1: UC012 - Quản Lý Sổ Tay & Bộ Thẻ Từ Vựng (Bảng 2.32)** *(Đã hoàn thành)*
- [ ] **Chặng 2: UC12.2 - Chế Độ Ôn Tập Flashcard SRS (Spaced Repetition)**
- [ ] **Chặng 3: UC12.3 & UC12.5 - Ghép Từ / Trắc Nghiệm & Trò Chơi Ghép Thẻ 60s**
- [ ] **Chặng 4: UC12.4 - Thi Thử Từ Vựng Tính Giờ (Formal Assessment Test)**
- [ ] **Chặng 5: Đóng Gói Router, Dọn Dẹp Mã Nguồn Cũ & Nghiệm Thu Toàn Diện**

---

## 2. Chi Tiết Từng Chặng Thực Hiện

### CHẶNG 0: NỀN TẢNG DÙNG CHUNG & i18n *(STATUS: COMPLETED ✅)*
- [x] Tạo nhánh Git `feature/vocab-flashcard-revamp`.
- [x] Cấu hình từ khóa song ngữ Anh/Việt vào `frontend/src/locales/vi/translation.json` và `en/translation.json`.
- [x] Dựng `features/vocab/types/vocab.types.ts` và `features/vocab/api/vocabApi.ts`.
- [x] Tạo 3 Custom Hooks dùng chung: `useVocabTimer.ts`, `useKeyboardShortcuts.ts`, `useSoundEffects.ts`.
- [x] Tạo 4 Shared Components dùng chung: `ModeHeader.tsx`, `SessionSummaryCard.tsx`, `SpeakButton.tsx`, `EmptyState.tsx`.
- [x] Tạo các hàm tiện ích: `distractorGenerator.ts`, `vocabFormatters.ts`.
- [x] Đã verify `npm run build` PASS 100%.

---

### CHẶNG 1: UC012 - QUẢN LÝ SỔ TAY & BỘ THẺ TỪ VỰNG (BẢNG 2.32) *(STATUS: COMPLETED ✅)*

#### A. Đối Chiếu Kịch Bản Nghiệp Vụ Bảng 2.32
*   **Tác nhân:** Người dùng đã đăng nhập hệ thống (`ROLE_USER`).
*   **Sự kiện kích hoạt:** Người dùng nhấp chọn menu "Sổ tay từ vựng" trên thanh điều hướng chính.
*   **Tiền điều kiện:** Người dùng đã đăng nhập tài khoản thành công.
*   **Luồng sự kiện chính (Thành công):**
    1. *Người dùng:* Chọn menu "Sổ tay từ vựng".
    2. *Hệ thống:* Gọi `vocabApi.getDecks()` lấy danh sách bộ thẻ và dữ liệu tiến độ học tập (`totalCards`, `dueTodayCards`, `masteredCards`).
    3. *Hệ thống:* Hiển thị `DeckListView.tsx` gồm 3 thẻ thống kê tổng quan, thanh tìm kiếm, chip lọc ngôn ngữ và nút **"+ Tạo bộ thẻ"**.
    4. *Người dùng:* Chọn một bộ thẻ cụ thể để xem chi tiết.
    5. *Hệ thống:* Hiển thị `DeckDetailView.tsx` gồm thông tin bộ thẻ, thanh tiến độ % thuộc từ, và **4 nút chế độ học tập** (Ôn Flashcard SRS, Ghép từ & Luyện tập, Ghép thẻ tốc độ, Thi thử).
    6. *Người dùng:* Lọc trạng thái (`ALL`, `NEW`, `LEARNING`, `MASTERED`, `DUE`) hoặc tìm kiếm từ vựng theo từ khóa.
    7. *Hệ thống:* Cập nhật danh sách từ vựng hiển thị tức thì.
    8. *Người dùng:* Xem danh sách từ vựng chi tiết (Từ, IPA, từ loại, nghĩa, ví dụ, nút loa phát âm `SpeakButton`).
*   **Luồng sự kiện thay thế:**
    *   *3a. Tạo bộ thẻ mới (`DeckModal.tsx`):* Chọn "+ Tạo bộ thẻ" ➔ Nhập tên, mô tả, cặp ngôn ngữ (`targetLanguage` ➔ `sourceLanguage`) ➔ Bấm Lưu ➔ Hệ thống tạo bộ thẻ mới trong CSDL và mở chi tiết để thêm từ.
    *   *3b. Sửa bộ thẻ (`DeckModal.tsx`):* Chọn "Sửa" ➔ Cập nhật tên/mô tả ➔ Bấm Lưu ➔ Hệ thống lưu CSDL và làm mới danh sách.
    *   *3c. Xóa bộ thẻ (`ConfirmDeleteDeckModal.tsx`):* Chọn "Xóa" ➔ Xác nhận cảnh báo ➔ Hệ thống xóa vĩnh viễn bộ thẻ và các từ bên trong.
    *   *3d. Bộ thẻ trống (`EmptyState.tsx`):* Hiển thị giao diện rỗng và gợi ý tạo bộ thẻ mới.
*   **Thao tác Thẻ con (Card Management):**
    *   *Thêm từ vựng (`CardModal.tsx`):* Nhập từ, nghĩa, ví dụ, từ loại, IPA, nghe phát âm thử ➔ Bấm Lưu ➔ Thêm vào CSDL.
    *   *Sửa từ vựng (`CardModal.tsx`):* Nạp thông tin cũ ➔ Sửa ➔ Lưu vào CSDL.
    *   *Xóa từ vựng (`ConfirmDeleteCardModal.tsx`):* Xác nhận ➔ Xóa khỏi CSDL.
*   **Hậu điều kiện:** Danh sách bộ thẻ hoặc danh sách thẻ từ trong bộ thẻ hiển thị chính xác; sẵn sàng kích hoạt các chế độ học.

#### B. Các Task Triển Khai Chặng 1:
- [x] **Task 1.1:** Xây dựng 4 Modal quản lý bằng Tailwind CSS + i18n:
  - `features/vocab/components/deck/DeckModal.tsx`
  - `features/vocab/components/deck/ConfirmDeleteDeckModal.tsx`
  - `features/vocab/components/card/CardModal.tsx`
  - `features/vocab/components/card/ConfirmDeleteCardModal.tsx`
- [x] **Task 1.2:** Xây dựng `features/vocab/components/deck/DeckListView.tsx`:
  - 3 Thẻ thống kê tổng (Tổng số từ, Cần ôn hôm nay, Đã thuộc).
  - Thanh tìm kiếm + Chip lọc ngôn ngữ (`EN`, `VI`, `JA`, `KO`,...).
  - Lưới thẻ bộ thẻ (Deck Card) hiển thị cặp ngôn ngữ (`EN ➔ VI`), thanh tiến độ % thuộc từ, nút "Ôn tập ngay (SRS)" và menu sửa/xóa.
  - Tích hợp `EmptyState.tsx` khi chưa có bộ thẻ nào.
- [x] **Task 1.3:** Xây dựng `features/vocab/components/deck/DeckDetailView.tsx`:
  - Header bộ thẻ hiển thị: Tên, mô tả, cặp ngôn ngữ, thanh tiến độ ghi nhớ tổng thể.
  - Thanh công cụ 4 nút chế độ học tập (Flashcard, Quiz, Match Game, Test).
  - Thanh tìm kiếm từ vựng và Tabs lọc trạng thái (`ALL`, `NEW`, `LEARNING`, `MASTERED`, `DUE`).
  - Bảng danh sách từ vựng tích hợp nút loa phát âm `SpeakButton`.
- [x] **Task 1.4:** Xây dựng Controller trang `features/vocab/pages/FlashcardsPage.tsx`:
  - Kết nối State (`decks`, `cards`, `selectedDeckId`, `viewMode`).
  - Gọi các API từ `vocabApi` để xử lý CRUD Decks & Cards.
  - Cập nhật [router.tsx](file:///F:/Working/JavaBackend/multilingo-platform/frontend/src/app/router.tsx) trỏ sang `FlashcardsPage`.
  - Đảm bảo `npm run build` PASS 100%.

---

### CHẶNG 2: UC12.2 - CHẾ ĐỘ ÔN TẬP FLASHCARD SRS (SPACED REPETITION)
- [ ] **Task 2.1:** Xây dựng component `features/vocab/modes/srs/FlipCard.tsx`:
  - Hiệu ứng lật 3D bằng CSS transform Tailwind.
  - Mặt trước che từ vựng trong câu ví dụ (`___`); mặt sau hiển thị đầy đủ nghĩa và ví dụ.
- [ ] **Task 2.2:** Xây dựng `features/vocab/modes/srs/SrsStudyView.tsx`:
  - Tích hợp `ModeHeader` ở trên cùng.
  - Tích hợp `useKeyboardShortcuts`: phím `<Space>` lật thẻ, phím `1` Quên, phím `2` Đã thuộc.
  - Tích hợp `SpeakButton` phát âm tự động khi lật thẻ.
  - Màn hình kết thúc hiển thị `SessionSummaryCard`, gọi API `finish-session` để cộng XP và tính streak.

---

### CHẶNG 3: UC12.3 & UC12.5 - GHÉP TỪ / TRẮC NGHIỆM & TRÒ CHƠI GHÉP THẺ 60S
- [ ] **Task 3.1:** Xây dựng `features/vocab/modes/quiz/QuizPracticeView.tsx` (UC12.3):
  - Sinh 4 đáp án A, B, C, D bằng `distractorGenerator.ts`.
  - Instant Feedback: Đổi màu xanh/đỏ tức thì kèm âm thanh qua `useSoundEffects`.
  - Hiển thị giải thích chi tiết, phím tắt `<Enter>` qua câu tiếp.
- [ ] **Task 3.2:** Xây dựng `features/vocab/modes/match/MatchGameView.tsx` (UC12.5):
  - Bàn cờ Responsive 12 ô (6 từ + 6 nghĩa).
  - Tận dụng `useVocabTimer` đếm ngược 60 giây, phạt trừ 5s khi chọn sai cặp.
  - Hiệu ứng biến mất khi đúng, rung lắc khi sai, lưu kỷ lục High Score.

---

### CHẶNG 4: UC12.4 - THI THỬ TÍNH GIỜ (FORMAL ASSESSMENT TEST)
- [ ] **Task 4.1:** Xây dựng `features/vocab/modes/test/TestQuestionPalette.tsx` (Bảng câu hỏi chuyển nhanh 1 ➔ N).
- [ ] **Task 4.2:** Xây dựng `features/vocab/modes/test/VocabTestView.tsx`:
  - Không lộ đáp án trong lúc làm bài, tính giờ bằng `useVocabTimer`.
  - Popup cảnh báo câu chưa làm trước khi nộp bài.
  - Chấm điểm theo thang 100, màn hình Review Answers phân tích câu đúng/sai chi tiết.

---

### CHẶNG 5: ĐÓNG GÓI ROUTER & NGHIỆM THU TOÀN DIỆN
- [ ] **Task 5.1:** Cập nhật `frontend/src/app/router.tsx` trỏ tới `features/vocab/pages/FlashcardsPage.tsx`.
- [ ] **Task 5.2:** Dọn dẹp thư mục cũ `frontend/src/components/vocab/` và `frontend/src/pages/student/Flashcards.tsx`.
- [ ] **Task 5.3:** Chạy toàn bộ test Backend (`./mvnw test`) và Frontend build (`npm run build`).
- [ ] **Task 5.4:** Hiển thị diff và xin xác nhận commit hoàn tất phân hệ.
