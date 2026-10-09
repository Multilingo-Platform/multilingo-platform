# Kế Hoạch Triển Khai: Refactor & Hoàn Thiện Phân Hệ Flashcard & Từ Vựng (UC12.1 - UC12.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tái cấu trúc (Refactor) phân hệ Từ vựng & Flashcards sang chuẩn Feature-based Architecture, hiện đại hóa giao diện (UI/UX) với Tailwind CSS & Lucide Icons, và hoàn thiện trọn vẹn 4 chế độ học tập (Ôn tập Flashcard SRS, Ghép từ/Trắc nghiệm, Ghép thẻ tốc độ, Thi thử tính giờ).

**Architecture:**
- **Frontend:** Chuyển đổi từ `components/vocab/` sang cấu trúc tính năng độc lập `features/vocab/` chuẩn FSD (Feature-Sliced Design). Thay thế file `vocab.css` tự viết bằng Tailwind CSS utility classes, đồng bộ với Design System của ứng dụng.
- **Backend:** Tận dụng hệ thống API hiện có (`FlashcardDeckController`, `UserFlashcardController`, `FlashcardStudyController`), kết nối đồng bộ dữ liệu XP, Streak và trạng thái từ vựng giữa 4 chế độ học và cơ sở dữ liệu.
- **Testing & Verification:** Đảm bảo toàn bộ 59 unit tests backend tiếp tục PASS 100%, frontend build `npm run build` không lỗi type, và tuân thủ TDD cho các tính năng mới.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Web Speech Synthesis API, Web Audio API, Spring Boot 3, PostgreSQL, JUnit 5 & Mockito.

**Specs Tham Chiếu:**
- `docs/superpowers/specs/uc12-flashcard-deck/spec.md` (Tổng quan & CRUD Deck/Card)
- `docs/superpowers/specs/uc12-flashcard-deck/uc12.2-on-tap-flashcard.md` (Chế độ 1: Ôn tập Flashcard SRS)
- `docs/superpowers/specs/uc12-flashcard-deck/uc12.3-hoc-tu-vung.md` (Chế độ 2: Ghép từ / Trắc nghiệm)
- `docs/superpowers/specs/uc12-flashcard-deck/uc12.4-kiem-tra-tu-vung.md` (Chế độ 4: Thi thử tính giờ)
- `docs/superpowers/specs/uc12-flashcard-deck/uc12.5-tro-choi-ghep-the-toc-do.md` (Chế độ 3: Ghép thẻ tốc độ)

---

## Global Constraints

- **Quy chuẩn Base Backend:** Mọi API trả về `ResponseEntity<ApiResponse<T>>`, lỗi ném `AppException(ErrorCode.XYZ)`, entity kế thừa `BaseEntity`.
- **Quy chuẩn Base Frontend:** Bắt buộc áp dụng Feature-based Architecture (`features/vocab/`). Không để component đặc thù của tính năng ở thư mục dùng chung `components/`.
- **Git Protocol:** Nhánh phát triển `feature/vocab-flashcard-revamp`, đồng bộ bằng `git rebase develop`. Không commit khi chưa hiển thị diff và được người dùng xác nhận.
- **Code Quality:** Không dùng `vocab.css` tự phát; chuyển sang Tailwind CSS, đảm bảo responsive đầy đủ từ mobile (375px) đến desktop (1280px+).

---

## Review Focus (Các điểm rủi ro cần kiểm soát chặt chẽ)

1. **Bộ thẻ ít từ vựng (< 4 từ hoặc < 6 từ):**
   - Chế độ Trắc nghiệm (Quiz) và Thi thử yêu cầu tối thiểu 4 từ vựng để tạo phương án A, B, C, D. Nếu $< 4$ từ, phải hiển thị Empty State/Alert thông báo rõ ràng kèm nút "Thêm từ vựng".
   - Chế độ Ghép thẻ (Match Game) yêu cầu tối thiểu 6 từ để tạo bàn 12 ô. Nếu $< 6$ từ, phải có Fallback hoặc chặn kèm hướng dẫn thêm từ.
2. **Âm thanh và Web Speech TTS:**
   - Web Speech API có thể bị từ chối phát âm nếu trình duyệt chưa có tương tác người dùng hoặc thiết bị không hỗ trợ ngôn ngữ. Cần try-catch fallback êm ái, không crash UI.
3. **Độ trễ và rò rỉ Timer (Memory Leak):**
   - Các chế độ có đếm ngược (Ghép thẻ 60s, Thi thử) phải dọn dẹp `clearInterval` trong `useEffect cleanup` khi người dùng chuyển màn hình hoặc thoát giữa chừng.
4. **Hỏng đường dẫn Router khi Refactor:**
   - Khi dọn dẹp file từ `pages/student/Flashcards.tsx` và `components/vocab/` sang `features/vocab/`, phải cập nhật `router.tsx` và mọi import liên quan, đảm bảo `npm run build` PASS 100%.
5. **Đồng bộ số liệu sau khi hoàn thành phiên học:**
   - Sau khi hoàn thành phiên học (SRS/Quiz/Game/Test), tổng số thẻ và số thẻ Đã thuộc (`masteredCards`) phải được refresh tự động khi quay lại màn hình chi tiết bộ thẻ.

---

## Danh Sách Task Chi Tiết

### Task 1: Khởi Tạo Nhánh & Chuẩn Bị Môi Trường Phát Triển
**Files:**
- Modify: `frontend/package-lock.json` (revert nếu dirty)

**Mục tiêu:** Đảm bảo nhánh làm việc độc lập, sạch sẽ từ bản mới nhất của `develop`.

- [ ] **Step 1:** Kiểm tra working tree và revert các thay đổi lockfile không mong muốn:
  ```bash
  git checkout frontend/package-lock.json
  ```
- [ ] **Step 2:** Đồng bộ nhánh `develop` với `origin/develop`:
  ```bash
  git checkout develop
  git pull origin develop
  ```
- [ ] **Step 3:** Tạo và chuyển sang nhánh mới `feature/vocab-flashcard-revamp`:
  ```bash
  git checkout -b feature/vocab-flashcard-revamp
  ```
- [ ] **Step 4:** Kiểm tra trạng thái git đảm bảo đang ở nhánh mới và working tree sạch:
  ```bash
  git status
  ```

---

### Task 2: Refactor Cấu Trúc Thư Mục Frontend (Feature-based Architecture)
**Files:**
- Create: `frontend/src/features/vocab/api/vocabApi.ts`
- Create: `frontend/src/features/vocab/types/vocab.types.ts`
- Create: `frontend/src/features/vocab/components/DeckListView.tsx`
- Create: `frontend/src/features/vocab/components/DeckDetailView.tsx`
- Create: `frontend/src/features/vocab/components/DeckModal.tsx`
- Create: `frontend/src/features/vocab/components/CardModal.tsx`
- Create: `frontend/src/features/vocab/components/ConfirmDeleteDeckModal.tsx`
- Create: `frontend/src/features/vocab/components/ConfirmDeleteCardModal.tsx`
- Create: `frontend/src/features/vocab/modes/SrsStudyView.tsx`
- Create: `frontend/src/features/vocab/modes/QuizPracticeView.tsx`
- Create: `frontend/src/features/vocab/modes/VocabTestView.tsx`
- Create: `frontend/src/features/vocab/modes/MatchGameView.tsx`
- Create: `frontend/src/features/vocab/pages/FlashcardsPage.tsx`
- Create: `frontend/src/features/vocab/index.ts`
- Modify: `frontend/src/app/router.tsx`
- Remove: `frontend/src/components/vocab/` (sau khi đã di chuyển an toàn)
- Remove: `frontend/src/pages/student/Flashcards.tsx` (thay thế bằng `FlashcardsPage.tsx`)

- [ ] **Step 1:** Tạo cấu trúc thư mục `frontend/src/features/vocab/` với các thư mục con: `api/`, `types/`, `components/`, `modes/`, `pages/`.
- [ ] **Step 2:** Di chuyển các file từ `frontend/src/components/vocab/` sang các thư mục tương ứng trong `features/vocab/`.
- [ ] **Step 3:** Tách `types/vocab.ts` và `core/api/vocabApi.ts` đưa vào `features/vocab/types/` và `features/vocab/api/` để tính năng hoàn toàn tự chủ.
- [ ] **Step 4:** Cập nhật import trong `frontend/src/app/router.tsx` trỏ tới `features/vocab/pages/FlashcardsPage.tsx`.
- [ ] **Step 5:** Chạy `npm run build` để xác minh việc tái cấu trúc không gây đứt gãy dependency hay import lỗi.

---

### Task 3: Hiện Đại Hóa UI/UX Quản Lý Bộ Thẻ & Thẻ Từ Vựng
**Files:**
- Modify: `frontend/src/features/vocab/components/DeckListView.tsx`
- Modify: `frontend/src/features/vocab/components/DeckDetailView.tsx`
- Modify: `frontend/src/features/vocab/components/DeckModal.tsx`
- Modify: `frontend/src/features/vocab/components/CardModal.tsx`

**Mục tiêu:** Loại bỏ `vocab.css`, thay bằng Tailwind CSS; cải tiến giao diện theo phong cách EdTech hiện đại.

- [ ] **Step 1:** Thiết kế lại `DeckListView`:
  - Card bộ thẻ với gradient nhẹ, badge thống kê số từ trực quan: Thẻ mới (Blue), Đang học (Amber), Đã thuộc (Emerald).
  - Empty state sinh động khi chưa có bộ thẻ với nút kêu gọi hành động (CTA) "Tạo bộ thẻ đầu tiên".
  - Thanh tìm kiếm và bộ lọc nhanh theo ngôn ngữ học (`targetLanguage`).
- [ ] **Step 2:** Thiết kế lại `DeckDetailView`:
  - Header bộ thẻ hiển thị đầy đủ thông tin: tên, mô tả, cặp ngôn ngữ, thanh tiến độ tổng thể (Progress Bar).
  - Thanh công cụ học tập nổi bật với 4 nút điều hướng tương ứng 4 chế độ:
    + 🎴 **Ôn tập Flashcard** (SRS)
    + 📝 **Ghép từ / Luyện tập** (Quiz)
    + ⏱️ **Thi thử từ vựng** (Test)
    + ⚡ **Ghép thẻ tốc độ** (Match Game)
  - Bảng / Lưới thẻ từ vựng với tính năng tìm kiếm theo từ/nghĩa, lọc theo trạng thái (`NEW`, `LEARNING`, `MASTERED`), nút nghe phát âm trực tiếp từng thẻ.
- [ ] **Step 3:** Nâng cấp `DeckModal` & `CardModal`:
  - Form trực quan, validate tức thì (tên không trống, từ vựng không trống).
  - `CardModal` hỗ trợ nhập từ, phiên âm IPA, từ loại (pos), nghĩa, ví dụ câu, và nút test âm thanh phát âm ngay trong modal.
- [ ] **Step 4:** Kiểm tra giao diện trên mobile và desktop, xác nhận build `npm run build` thành công.

---

### Task 4: Hoàn Thiện Chế Độ 1 - Ôn Tập Flashcard SRS (UC12.2)
**Files:**
- Modify: `frontend/src/features/vocab/modes/SrsStudyView.tsx`

**Mục tiêu:** Nâng cấp trải nghiệm lật thẻ 3D, hỗ trợ phím tắt, phát âm chuẩn và kết nối API SRS Backend.

- [ ] **Step 1:** Nâng cấp hiệu ứng 3D Flip Card mượt mà bằng CSS transform & transition Tailwind (mặt trước: từ vựng, phiên âm, nút loa, câu ví dụ che từ `___`; mặt sau: định nghĩa đầy đủ, câu ví dụ hoàn chỉnh, ghi chú).
- [ ] **Step 2:** Tích hợp phím tắt thao tác nhanh:
  - Phím `<Space>` hoặc click thẻ: Lật thẻ.
  - Phím `1`: Đánh giá "Quên" (Forgotten / Again) - giảm độ dễ và xếp lịch ôn lại.
  - Phím `2`: Đánh giá "Đã thuộc" (Remembered / Good) - tăng khoảng cách ôn tập.
- [ ] **Step 3:** Tích hợp Web Speech API (TTS) tự động phát âm khi lật sang mặt từ vựng hoặc khi click nút icon loa.
- [ ] **Step 4:** Màn hình kết thúc phiên học (Summary View):
  - Hiển thị số thẻ đã ôn, tỷ lệ thuộc, XP nhận được (+10 XP cơ bản + 2 XP/thẻ thuộc).
  - Tự động gọi API `POST /decks/{deckId}/finish-session` để lưu vào Backend và cập nhật streak.
- [ ] **Step 5:** Kiểm thử thủ công và xác nhận `npm run build` PASS.

---

### Task 5: Hoàn Thiện Chế Độ 2 - Ghép Từ & Luyện Tập Trắc Nghiệm (UC12.3)
**Files:**
- Modify: `frontend/src/features/vocab/modes/QuizPracticeView.tsx`

**Mục tiêu:** Trải nghiệm luyện tập trắc nghiệm 4 đáp án A, B, C, D chấm điểm tức thì (Instant Feedback).

- [ ] **Step 1:** Xử lý điều kiện tiên quyết: Nếu bộ thẻ $< 4$ từ, hiển thị thông báo yêu cầu tối thiểu 4 từ vựng kèm nút "Thêm từ mới".
- [ ] **Step 2:** Thuật toán sinh câu hỏi thông minh:
  - Tự động tạo câu hỏi trắc nghiệm: Đoán nghĩa của từ hoặc Điền từ vào câu khuyết.
  - 1 Đáp án đúng + 3 Phương án nhiễu lấy từ các từ khác trong bộ thẻ.
- [ ] **Step 3:** Chấm điểm và phản hồi tức thì (Instant Feedback):
  - Người dùng chọn đáp án: Tô xanh viền nếu đúng, tô đỏ viền nếu sai + đồng thời làm nổi bật ô đáp án đúng màu xanh.
  - Hiển thị giải thích chi tiết (nghĩa, câu ví dụ) sau khi chọn.
  - Nút "Tiếp tục" (hỗ trợ phím `<Enter>` / `<Space>`) để chuyển câu tiếp theo.
- [ ] **Step 4:** Màn hình tổng kết phiên luyện tập:
  - Điểm số, tỷ lệ chính xác (%), số câu đúng/sai, danh sách từ cần chú ý ôn lại.
  - Nút "Luyện tập lại" và nút "Quay về bộ thẻ".
- [ ] **Step 5:** Xác nhận build `npm run build` PASS.

---

### Task 6: Hoàn Thiện Chế Độ 3 - Trò Chơi Ghép Thẻ Tốc Độ 60s (UC12.5)
**Files:**
- Modify: `frontend/src/features/vocab/modes/MatchGameView.tsx`

**Mục tiêu:** Trò chơi phản xạ nhanh 12 ô (6 từ + 6 nghĩa), tính điểm combo, đồng hồ đếm ngược và hiệu ứng đồ họa bắt mắt.

- [ ] **Step 1:** Xử lý điều kiện tiên quyết: Nếu bộ thẻ $< 6$ từ, hiển thị cảnh báo cần tối thiểu 6 từ vựng để tạo bàn chơi 12 ô.
- [ ] **Step 2:** Bàn cờ Responsive 12 ô:
  - Lưới 3x4 (desktop) hoặc 4x3/6x2 (mobile).
  - Chọn 1 ô từ vựng (viền sáng), chọn 1 ô nghĩa:
    + Nếu đúng: Đổi màu xanh lá, phát âm thanh vui tươi nhẹ, mờ dần rồi biến mất khỏi bàn chơi (+100 điểm * combo).
    + Nếu sai: Đổi màu viền đỏ, hiệu ứng rung lắc (shake), tự động nhả chọn sau 0.5s và **bị phạt trừ 5 giây**.
- [ ] **Step 3:** Quản lý đồng hồ đếm ngược 60 giây và combo liên tiếp. Tự động kết thúc khi xóa sạch 12 ô hoặc khi hết giờ.
- [ ] **Step 4:** Màn hình kết quả vinh danh:
  - Điểm số đạt được, thời gian hoàn thành (ví dụ: `24.5s`), hiển thị nhãn "Kỷ lục mới" nếu phá điểm cao nhất lưu trong `localStorage`.
  - Nút "Chơi lại" để phá kỷ lục và nút "Về bộ thẻ".
- [ ] **Step 5:** Xác nhận build `npm run build` PASS.

---

### Task 7: Hoàn Thiện Chế Độ 4 - Thi Thử Từ Vựng Tính Giờ (UC12.4)
**Files:**
- Modify: `frontend/src/features/vocab/modes/VocabTestView.tsx`

**Mục tiêu:** Phòng thi trắc nghiệm nghiêm túc, không lộ đáp án trong lúc làm, có bảng điều hướng câu hỏi (Question Palette) và xem lại bài thi chi tiết.

- [ ] **Step 1:** Giao diện làm bài thi trắc nghiệm:
  - Đồng hồ đếm ngược thời gian làm bài (ví dụ: 1 phút / câu). Tự động nộp bài khi hết giờ.
  - Bảng điều hướng câu hỏi (Question Palette bên hông/phía trên) giúp thí sinh nhảy nhanh đến câu bất kỳ, đổi màu ô câu hỏi đã làm và câu chưa làm.
  - Tuyệt đối không hiển thị đúng/sai sau mỗi câu để đảm bảo tính khách quan của kỳ thi.
- [ ] **Step 2:** Popup xác nhận nộp bài thi:
  - Thống kê rõ số câu đã trả lời / tổng số câu (ví dụ: "Bạn đã làm 8/10 câu"). Cảnh báo nếu còn câu chưa trả lời.
- [ ] **Step 3:** Chấm điểm và Màn hình Kết quả thi:
  - Điểm số theo thang điểm 100, số câu đúng/sai, xếp loại năng lực (Xuất sắc $\ge 90$, Đạt chuẩn $70-89$, Cần cải thiện $< 70$).
- [ ] **Step 4:** Tính năng "Xem lại bài thi" (Review Answers):
  - Hiển thị danh sách tất cả các câu: Tô xanh đáp án thí sinh chọn đúng; Tô đỏ câu thí sinh chọn sai và chỉ rõ đáp án đúng kèm giải thích.
- [ ] **Step 5:** Xác nhận build `npm run build` PASS.

---

### Task 8: Đối Soát Toàn Diện & Nghiệm Thu (Verification Before Completion)
**Files:**
- Modify: Toàn bộ các file liên quan đã tạo/sửa.

**Mục tiêu:** Chạy đầy đủ các bộ kiểm thử tự động của cả Backend và Frontend, cung cấp bằng chứng nghiệm thu trước khi tạo PR/Commit.

- [ ] **Step 1: Backend Verification:**
  - Chạy toàn bộ test suite của phân hệ vocab trong Backend:
    ```bash
    cd backend && ./mvnw test '-Dtest=*Vocab*Test,*Flashcard*Test'
    ```
  - Tiêu chuẩn: 59/59 tests PASS, không có lỗi runtime hay break API contract.
- [ ] **Step 2: Frontend Verification:**
  - Kiểm tra lint và build production frontend:
    ```bash
    cd frontend && npm run build
    ```
  - Tiêu chuẩn: Build hoàn tất không có lỗi compile TypeScript hay cảnh báo đứt gãy.
- [ ] **Step 3: Review Diff với Người Dùng:**
  - Chạy `git status` và `git diff --stat` hiển thị tóm tắt toàn bộ thay đổi.
  - Xin ý kiến xác nhận của người dùng trước khi thực hiện commit theo quy tắc `GEMINI.md`.

---
