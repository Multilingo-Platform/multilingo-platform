# Hướng Dẫn Refactor Từng Use Case & Chuẩn Hóa Thành Phần Dùng Chung (UC12.1 - UC12.5)

Tài liệu này cung cấp kiến trúc thiết kế mô-đun hóa, bản đồ các thành phần dùng chung (Shared Components/Hooks/Utils) và lộ trình refactor chi tiết theo từng Use Case độc lập cho phân hệ Từ vựng & Flashcards (`features/vocab`).

---

## 1. Triết Lý Thiết Kế & Chuẩn Hóa Dùng Chung (Shared Architecture)

Để tránh lặp lại mã nguồn (DRY) và đảm bảo trải nghiệm người dùng nhất quán giữa 4 chế độ học tập, toàn bộ phân hệ `features/vocab` sẽ được tổ chức theo chuẩn **Feature-Sliced Design** (học tập trực tiếp từ kiến trúc kiểu mẫu của `features/exam` trong dự án).

### 1.1. Cấu Trúc Thư Mục Chuẩn (`frontend/src/features/vocab/`)

```text
frontend/src/features/vocab/
├── api/
│   └── vocabApi.ts                   # Gọi các API Backend (Decks, Cards, Study Session)
├── types/
│   └── vocab.types.ts                # TypeScript Interfaces (Deck, Card, Session, Quiz, Match)
├── hooks/                            # CÁC CUSTOM HOOKS DÙNG CHUNG
│   ├── useVocabTimer.ts              # Hook đếm ngược thời gian (dùng chung cho Match Game & Test Mode)
│   ├── useKeyboardShortcuts.ts       # Hook lắng nghe phím tắt (Space lật thẻ, 1/2 đánh giá, Enter tiếp tục)
│   └── useSoundEffects.ts            # Web Audio API phát âm thanh đúng (ting) / sai (buzz) tức thì
├── utils/                            # CÁC TIỆN ÍCH DÙNG CHUNG
│   ├── distractorGenerator.ts        # Thuật toán bốc phương án nhiễu ngẫu nhiên (cho Quiz & Test)
│   └── vocabFormatters.ts            # Định dạng thời gian (mm:ss), tính % chính xác, tính điểm combo
├── components/                       # CÁC THÀNH PHẦN GIAO DIỆN DÙNG CHUNG
│   ├── common/
│   │   ├── ModeHeader.tsx            # Header chuẩn của 4 chế độ (Nút Thoát, Tên Deck, Progress Bar, Timer)
│   │   ├── SessionSummaryCard.tsx    # Card tổng kết kết quả phiên học (XP, số câu đúng/sai, nút Chơi lại)
│   │   ├── EmptyState.tsx            # Trạng thái rỗng (chưa có deck, chưa có thẻ, hoặc không đủ từ)
│   │   └── SpeakButton.tsx           # Nút icon chiếc loa phát âm chuẩn qua Web Speech API
│   ├── deck/
│   │   ├── DeckListView.tsx          # Danh sách bộ thẻ (Grid layout)
│   │   ├── DeckDetailView.tsx        # Chi tiết bộ thẻ & danh sách từ vựng con
│   │   └── DeckModal.tsx             # Modal tạo / sửa thông tin bộ thẻ
│   └── card/
│       ├── CardModal.tsx             # Modal thêm / sửa từ vựng (hỗ trợ IPA, POS, ví dụ, nghĩa)
│       ├── ConfirmDeleteCardModal.tsx
│       └── ConfirmDeleteDeckModal.tsx
├── modes/                            # 4 CHẾ ĐỘ HỌC TẬP CHUYÊN BIỆT
│   ├── srs/                          # UC12.2: Ôn tập Flashcard SRS
│   │   ├── SrsStudyView.tsx
│   │   └── FlipCard.tsx              # Component thẻ lật 3D
│   ├── quiz/                         # UC12.3: Học từ vựng / Ghép từ (Quiz trắc nghiệm)
│   │   ├── QuizPracticeView.tsx
│   │   └── QuizOptionButton.tsx      # Nút phương án A, B, C, D đổi màu tức thì
│   ├── match/                        # UC12.5: Trò chơi Ghép thẻ tốc độ 60s
│   │   ├── MatchGameView.tsx
│   │   └── MatchTile.tsx             # Ô thẻ từ vựng / định nghĩa có animation
│   └── test/                         # UC12.4: Thi thử từ vựng có tính giờ
│       ├── VocabTestView.tsx
│       ├── TestQuestionPalette.tsx   # Bảng điều hướng câu hỏi 1 -> N
│       └── TestReviewModal.tsx       # Xem lại chi tiết đáp án sau khi thi
├── pages/
│   └── FlashcardsPage.tsx            # Controller điều phối chuyển đổi giữa các View/Mode
└── index.ts                          # Public API export ra ngoài (cho router.tsx)
```

---

## 2. Danh Mục Các Khối Dùng Chung Cần Tách (Shared Building Blocks)

### 2.1. Hooks Dùng Chung

| Tên Hook | Mục đích | Các chế độ sử dụng | Chi tiết kỹ thuật |
| :--- | :--- | :--- | :--- |
| `useVocabTimer` | Quản lý đồng hồ đếm ngược | **Ghép thẻ (60s)**, **Thi thử (tính giờ)** | Nhận vào `initialSeconds`, callback `onTimeUp`. Hỗ trợ: `start`, `pause`, `reset`, `deductTime(seconds)` (phạt khi ghép sai). Tự động cleanup tránh rò rỉ bộ nhớ. |
| `useKeyboardShortcuts` | Lắng nghe phím tắt bàn phím | **Flashcard SRS**, **Quiz Practice** | Lắng nghe sự kiện `keydown`: `<Space>` lật thẻ, `1`/`2` đánh giá nhớ/quên, `<Enter>` qua câu tiếp theo, `<Esc>` thoát phiên. Tự động unbind khi unmount. |
| `useSoundEffects` | Hiệu ứng âm thanh phản xạ | **Ghép thẻ**, **Quiz Practice** | Dùng Web Audio API (Synthesizer tần số Hz đơn giản), không cần tải file mp3 bên ngoài: âm thanh đúng (587Hz -> 880Hz trong 0.15s), âm thanh sai (150Hz rung nhẹ). |

### 2.2. Components Dùng Chung

| Component | Mục đích | Các màn hình sử dụng |
| :--- | :--- | :--- |
| `ModeHeader` | Thanh điều hướng đầu trang của phiên học | Cả 4 chế độ (`SRS`, `Quiz`, `Match`, `Test`) |
| | *Bao gồm:* Nút Back/Thoát kèm popup xác nhận, Tên bộ thẻ, Thanh tiến độ `X / Total`, Đồng hồ (nếu có chế độ đếm ngược). | |
| `SessionSummaryCard` | Khung hiển thị tổng kết sau khi kết thúc phiên | Cả 4 chế độ |
| | *Bao gồm:* Huy hiệu vinh danh (Trophy icon), Điểm XP nhận được, Tỷ lệ chính xác %, Thống kê số thẻ, 2 nút hành động ("Học lại" / "Quay về bộ thẻ"). | |
| `SpeakButton` | Nút nghe phát âm chuẩn bản xứ | `DeckDetailView`, `CardModal`, `FlipCard`, `QuizPracticeView` |
| | Gọi trực tiếp `speakWord(text, langCode)` từ [frontend/src/utils/speech.ts](file:///F:/Working/JavaBackend/multilingo-platform/frontend/src/utils/speech.ts). Có hiệu ứng sóng âm/nhấp nháy khi đang đọc. | |
| `EmptyState` | Hiển thị thông báo thân thiện khi thiếu dữ liệu | `DeckListView`, `DeckDetailView`, Các chế độ học khi thiếu từ |
| | Gồm hình minh họa icon, tiêu đề giải thích, và nút bấm hành động (CTA) tương ứng (VD: "Tạo bộ thẻ đầu tiên", "Thêm từ vựng"). | |

---

## 3. Hướng Dẫn Refactor Từng Use Case (Tách Nhỏ & Tuần Tự)

Chúng ta chia quá trình làm thành **5 chặng độc lập**. Sau mỗi chặng, toàn bộ ứng dụng vẫn build thành công (`npm run build` PASS) và có thể kiểm thử trực quan ngay:

```
┌────────────────────────────────────────────────────────────────────────┐
│  CHẶNG 0: NỀN TẢNG DÙNG CHUNG (Scaffolding & Shared Primitives)        │
│  Tạo thư mục features/vocab/, tách Hooks & Components dùng chung       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  CHẶNG 1: UC12.1 - QUẢN LÝ BỘ THẺ & THẺ CON (Deck & Card Management)   │
│  Refactor DeckListView, DeckDetailView, DeckModal, CardModal          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  CHẶNG 2: UC12.2 - CHẾ ĐỘ ÔN TẬP FLASHCARD SRS (Spaced Repetition)     │
│  Tách FlipCard 3D, tích hợp phím tắt, kết nối API finish-session       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  CHẶNG 3: UC12.3 & UC12.5 - GAME & LUYỆN TẬP (Quiz & Speed Match)      │
│  Refactor QuizPracticeView, MatchGameView, tích hợp useSoundEffects    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│  CHẶNG 4: UC12.4 - THI THỬ TÍNH GIỜ (Formal Vocab Assessment Test)     │
│  Refactor VocabTestView, QuestionPalette, Review Answers sau khi thi   │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Chặng 0: Khởi Tạo Nền Tảng Dùng Chung (Scaffolding & Shared Primitives)
*   **Mục tiêu:** Tạo bộ khung `features/vocab/` và các thành phần dùng chung trước để các Use Case sau chỉ việc import dùng lại.
*   **Nội dung công việc:**
    1.  Tạo nhánh Git: `feature/vocab-flashcard-revamp`.
    2.  Tạo thư mục `features/vocab/` với các thư mục con: `api/`, `types/`, `hooks/`, `utils/`, `components/common/`.
    3.  Chuyển `vocabApi.ts` và `vocab.types.ts` về `features/vocab/`.
    4.  Viết các Custom Hooks: `useVocabTimer.ts`, `useKeyboardShortcuts.ts`, `useSoundEffects.ts`.
    5.  Viết các Shared Components: `ModeHeader.tsx`, `SessionSummaryCard.tsx`, `SpeakButton.tsx`, `EmptyState.tsx`.
*   **Tiêu chí nghiệm thu (AC):** `npm run build` PASS, các hooks có unit test hoặc chạy mượt mà.

---

### Chặng 1: UC12.1 - Quản Lý Bộ Thẻ & Thẻ Con (Deck & Card CRUD)
*   **Mục tiêu:** Hiện đại hóa giao diện quản lý danh sách bộ thẻ và chi tiết bộ thẻ, loại bỏ hoàn toàn `vocab.css`.
*   **File refactor:**
    - `components/deck/DeckListView.tsx`
    - `components/deck/DeckDetailView.tsx`
    - `components/deck/DeckModal.tsx`
    - `components/card/CardModal.tsx`
    - `components/card/ConfirmDeleteCardModal.tsx`
    - `components/card/ConfirmDeleteDeckModal.tsx`
*   **Điểm nâng cấp:**
    - **DeckListView:** Thẻ bộ thẻ thiết kế dạng card hiện đại với Tailwind, hiển thị các tag ngôn ngữ (EN -> VI), badge đếm từ trực quan (New, Learning, Mastered).
    - **DeckDetailView:** Header hiển thị thanh tiến độ ghi nhớ (Progress bar %), danh sách từ vựng có bảng/lưới rõ ràng, tích hợp `SpeakButton` phát âm từng từ, bộ lọc từ khóa và trạng thái.
    - **CardModal:** Hỗ trợ nhập từ vựng, phiên âm IPA, từ loại, định nghĩa, ví dụ câu ngữ cảnh và nút phát âm thử.
*   **Tiêu chí nghiệm thu (AC):** Thêm, sửa, xóa bộ thẻ và thẻ từ vựng trơn tru, hiển thị đẹp trên cả mobile và desktop.

---

### Chặng 2: UC12.2 - Chế Độ Ôn Tập Flashcard SRS (Spaced Repetition)
*   **Mục tiêu:** Trải nghiệm lật thẻ học tập đỉnh cao, tương thích thuật toán SuperMemo/SM-2 của Backend.
*   **File refactor:**
    - `modes/srs/SrsStudyView.tsx`
    - `modes/srs/FlipCard.tsx` (tách riêng component thẻ lật)
*   **Điểm nâng cấp:**
    - Sử dụng `ModeHeader` ở trên cùng, hiển thị số thẻ đã ôn `i / N`.
    - Component `FlipCard` lật 3D bằng hiệu ứng `transform: rotateY(180deg)` mượt mà. Mặt trước che từ khuyết `___` trong câu ví dụ; mặt sau hiển thị định nghĩa và ví dụ đầy đủ.
    - Tích hợp `useKeyboardShortcuts`: phím `<Space>` lật thẻ, phím `1` Quên, phím `2` Đã thuộc.
    - Tự động gọi API phát âm khi chuyển thẻ qua `SpeakButton`.
    - Kết thúc phiên sử dụng `SessionSummaryCard` đồng bộ API `finish-session` để cộng XP và tính streak.
*   **Tiêu chí nghiệm thu (AC):** Thao tác phím tắt mượt, đánh giá thẻ lưu về Backend đúng chỉ số SRS (`reviewCard`), tổng kết cộng XP chính xác.

---

### Chặng 3: UC12.3 & UC12.5 - Ghép Từ / Trắc Nghiệm & Trò Chơi Ghép Thẻ 60s
*   **Mục tiêu:** Hoàn thiện 2 chế độ luyện tập có tính tương tác cao và gamification.
*   **File refactor:**
    - `modes/quiz/QuizPracticeView.tsx` (UC12.3 - Học từ vựng / Ghép từ)
    - `modes/match/MatchGameView.tsx` (UC12.5 - Trò chơi Ghép thẻ tốc độ)
*   **Điểm nâng cấp:**
    - **QuizPracticeView:**
      + Dùng `distractorGenerator.ts` sinh 4 phương án trắc nghiệm A, B, C, D (1 đúng + 3 nhiễu).
      + Instant Feedback: Chọn xong ô đúng hóa xanh, ô sai hóa đỏ + làm nổi bật đáp án đúng; phát âm thanh qua `useSoundEffects`.
      + Hiển thị giải thích ngữ cảnh chi tiết trước khi bấm Tiếp tục (`<Enter>`).
    - **MatchGameView:**
      + Tận dụng `useVocabTimer` đếm ngược 60 giây, hỗ trợ hàm `deductTime(5)` khi người dùng chọn sai cặp thẻ.
      + Bàn cờ 12 ô (6 từ + 6 nghĩa) có hiệu ứng khớp thẻ: Đúng phát âm thanh vui tươi và biến mất; Sai rung lắc (shake) và trừ 5 giây.
      + Lưu kỷ lục điểm cao cá nhân vào `localStorage` / hồ sơ.
*   **Tiêu chí nghiệm thu (AC):** Cả 2 chế độ đều kiểm tra chặn nếu bộ thẻ chưa đủ số từ tối thiểu (Quiz cần $\ge 4$ từ, Match Game cần $\ge 6$ từ); trải nghiệm game mượt mà không delay.

---

### Chặng 4: UC12.4 - Thi Thử Từ Vựng Tính Giờ (Formal Assessment Test)
*   **Mục tiêu:** Phòng thi trắc nghiệm nghiêm túc, khách quan, có xem lại bài thi chi tiết.
*   **File refactor:**
    - `modes/test/VocabTestView.tsx`
    - `modes/test/TestQuestionPalette.tsx` (Bảng câu hỏi chuyển nhanh)
    - `modes/test/TestReviewModal.tsx` (Xem lại chi tiết bài làm)
*   **Điểm nâng cấp:**
    - Dùng `useVocabTimer` tính giờ làm bài thi. Khi hết giờ tự động khóa bài và nộp bài.
    - Trong lúc thi: **tuyệt đối không hiển thị đúng/sai** sau mỗi câu.
    - Thêm `TestQuestionPalette`: Danh sách các nút số `[1] [2] [3]...` giúp chuyển nhanh giữa các câu, đổi màu ô đã trả lời và ô còn trống.
    - Popup xác nhận nộp bài hiển thị cảnh báo nếu còn câu chưa làm.
    - Màn hình kết quả tính điểm theo thang 100, kèm nút "Xem lại bài thi" hiển thị chi tiết câu nào đúng (xanh), câu nào sai (đỏ) kèm đáp án đúng chuẩn xác.
*   **Tiêu chí nghiệm thu (AC):** Thi thử khách quan, chấm điểm chính xác %, xem lại bài thi rõ ràng.

---

### Chặng 5: Đóng Gói Router, Kiểm Thử Toàn Diện & Verification
*   **Mục tiêu:** Dọn dẹp mã nguồn cũ, kết nối router chính và chạy kiểm thử nghiệm thu.
*   **File thao tác:**
    - Cập nhật `frontend/src/app/router.tsx` trỏ tới `frontend/src/features/vocab/pages/FlashcardsPage.tsx`.
    - Xóa thư mục cũ `frontend/src/components/vocab/` và file `frontend/src/pages/student/Flashcards.tsx`.
    - Chạy toàn bộ test Backend và build Frontend:
      ```bash
      # Backend
      cd backend && ./mvnw test '-Dtest=*Vocab*Test,*Flashcard*Test'
      
      # Frontend
      cd frontend && npm run build
      ```
    - Hiển thị diff và xin duyệt trước khi commit.

---

## 4. Bảng Quy Chuẩn Coding Convention (Cho Phân Hệ Vocab)

1.  **CSS & Styling:** 100% sử dụng Tailwind CSS utilities (ví dụ: `bg-card`, `text-card-foreground`, `rounded-xl`, `shadow-sm`). Không viết thêm các class tự chế trong file `.css` rời rạc.
2.  **Quản lý State & Async:**
    - Các state của một phiên học (currentQuestionIndex, score, answers, timer) phải được cô lập gọn gàng trong component mode tương ứng.
    - Sau khi hoàn thành phiên học, kích hoạt callback `onFinish()` hoặc refresh danh sách deck để đồng bộ số liệu ra màn hình ngoài.
3.  **Khả năng mở rộng (Extensibility):** Mọi Mode chỉ cần nhận prop `deck: DeckSummary`, `cards: Flashcard[]`, `onBack: () => void`, `onFinish?: () => void`. Nhờ đó dễ dàng tích hợp thêm các chế độ học mới trong tương lai mà không làm ảnh hưởng các chế độ cũ.
