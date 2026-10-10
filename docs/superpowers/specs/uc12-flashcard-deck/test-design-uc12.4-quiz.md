# Kế Hoạch & Thiết Kế Kiểm Thử - UC012.4: Học Từ Vựng (Quiz Chấm Tức Thì)

- **Mã Tài Liệu:** TD-UC012.4-QUIZ
- **Tên Phân Hệ:** Vocabulary & Flashcards Practice Engine (`com.multilingo.backend.modules.vocab`)
- **Tác Nhân (Actor):** Học viên / Người dùng đã đăng nhập (`ROLE_USER`)
- **Tài liệu đặc tả nguồn:** [uc12.4-hoc-tu-vung.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.4-hoc-tu-vung.md)

---

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Tác nhân (Actor Persona)
- **Học viên (`ROLE_USER`):** Người dùng sở hữu bộ thẻ ghi nhớ, muốn rèn luyện và kiểm tra phản xạ nhận diện ngữ nghĩa của từ vựng thông qua hình thức trắc nghiệm 4 lựa chọn (A, B, C, D) có chấm điểm và phản hồi tức thì.

### 1.2. Ranh giới triển khai (Scope Boundaries)
- **In-Scope (Phạm vi triển khai):**
  1. **Kiểm tra số lượng thẻ:** Yêu cầu tối thiểu $\ge 4$ từ vựng trong bộ thẻ. Nếu $< 4$ từ ➔ Chặn khởi tạo và hiển thị EmptyState thông báo thân thiện (Luồng 2a).
  2. **Thuật toán sinh câu hỏi & phương án nhiễu (Distractor Generator):**
     - Sinh đề thi theo phiên (10–15 câu).
     - Mỗi câu có 1 đáp án đúng (`customMeaning`) và 3 phương án nhiễu độc nhất (không trùng lặp, ưu tiên cùng từ loại `pos`).
  3. **Giao diện phòng học trắc nghiệm (Zero-scroll Layout):**
     - Thiết kế toàn màn hình `fixed inset-0 z-50 bg-slate-50`, căn giữa `max-w-2xl` (~672px).
     - Không có thanh cuộn dọc (Zero-scroll).
  4. **Phát âm từ vựng (Luồng 4a):** Tích hợp nút loa phát âm chuẩn qua Web Speech Synthesis API.
  5. **Chấm điểm tức thì tại chỗ (Luồng 5):**
     - Chọn đúng: Nút phương án đổi viền/nền xanh lá (`emerald`), icon CheckCircle, tăng điểm và tăng chuỗi đúng (streak).
     - Chọn sai: Nút phương án chọn đổi viền/nền đỏ (`rose`), icon XCircle; ĐỒNG THỜI tự động tô xanh phương án đúng để người học đối chiếu; reset streak về 0; thêm thẻ vào danh sách cần ôn lại.
     - Vô hiệu hóa (disable) 4 nút phương án ngay sau khi chọn để chống spam click.
  6. **Thanh giải thích & Chuyển câu (Luồng 6, 7):**
     - Hiển thị giải thích nghĩa và câu ví dụ ngữ cảnh (nếu có).
     - Nút "Câu tiếp theo" / hỗ trợ phím tắt <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để tiếp tục.
  7. **Hỗ trợ phím tắt số/chữ:** Phím <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd> để chọn phương án A, B, C, D nhanh.
  8. **Thoát giữa chừng (Luồng 6a):** Nút Thoát có modal hỏi xác nhận lưu tiến độ những câu đã làm.
  9. **Màn hình tổng kết (Luồng 8, 9, 10):** Tích hợp `SessionSummaryCard`, tính điểm kinh nghiệm (+15 XP cơ bản + 2 XP/câu đúng), tỷ lệ % chính xác, chuỗi Streak cao nhất và danh sách các từ đã làm sai.

- **Out-of-Scope (Thuộc Use Case khác):**
  - Chế độ Ôn tập Flashcard SRS lặp lại ngắt quãng (thuộc `UC012.2`).
  - Chế độ Thi thử Formal Test có Question Palette và đồng hồ đếm ngược (thuộc chế độ Kiểm tra).
  - Trò chơi Ghép thẻ tốc độ (thuộc `UC012.5`).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin (Behavioral AC)

```gherkin
Feature: Chế độ Học từ vựng Trắc nghiệm chấm tức thì (UC012.4)

  # Luồng ngoại lệ 2a
  Scenario: Chặn khởi tạo bài học khi bộ thẻ có dưới 4 từ vựng
    Given Người dùng sở hữu bộ thẻ có 3 thẻ từ vựng
    When Người dùng nhấp chọn nút "Học từ vựng"
    Then Hệ thống hiển thị EmptyState thông báo: "Bộ thẻ cần tối thiểu 4 từ vựng để tạo câu hỏi trắc nghiệm"
    And Hiển thị nút "Quay lại bộ thẻ" và không sinh câu hỏi trắc nghiệm

  # Luồng phụ 4a
  Scenario: Nghe phát âm từ vựng mục tiêu
    Given Người dùng đang ở màn hình câu hỏi của từ "ubiquitous"
    When Người dùng nhấn vào biểu tượng chiếc loa
    Then Hệ thống kích hoạt Web Speech API phát âm từ "ubiquitous" theo đúng targetLanguage của bộ thẻ

  # Luồng chính - Bước 4, 5 (Trả lời ĐÚNG)
  Scenario: Trả lời chính xác câu hỏi trắc nghiệm
    Given Người dùng đang ở câu hỏi từ vựng "ubiquitous" có đáp án đúng là "có mặt ở khắp mọi nơi"
    When Người dùng chọn phương án "có mặt ở khắp mọi nơi"
    Then Nút phương án đổi sang màu viền xanh lá, nền xanh nhạt kèm icon tích xanh
    And Điểm số tăng +1, chuỗi đúng (streak) tăng +1
    And Hiển thị thanh phản hồi: "Chính xác! Làm tốt lắm" cùng câu ví dụ ngữ cảnh và nút "Tiếp tục"

  # Luồng chính - Bước 4, 5 (Trả lời SAI)
  Scenario: Trả lời sai câu hỏi trắc nghiệm
    Given Người dùng đang ở câu hỏi từ vựng "ubiquitous" có đáp án đúng là "có mặt ở khắp mọi nơi"
    When Người dùng chọn sai phương án "nguy hiểm, độc hại"
    Then Nút phương án người dùng chọn đổi sang màu đỏ kèm icon X đỏ
    And Phương án đúng "có mặt ở khắp mọi nơi" tự động được tô màu xanh lá để chỉ rõ đáp án
    And Chuỗi streak bị reset về 0
    And Thẻ từ vựng này được ghi nhận vào danh sách "Từ cần ôn lại"
    And Hiển thị thanh phản hồi giải thích và nút "Tiếp tục"

  # Luồng chính - Bước 6, 7 (Chuyển câu tiếp theo)
  Scenario: Chuyển câu hỏi tiếp theo bằng phím tắt hoặc click
    Given Người dùng đã trả lời xong câu hỏi hiện tại và thanh phản hồi đang hiển thị
    When Người dùng nhấn phím Enter hoặc phím Space hoặc nhấp nút "Câu tiếp theo"
    Then Hệ thống chuyển mượt mà sang câu hỏi tiếp theo
    And Trạng thái 4 phương án được reset về mặc định cho câu mới

  # Luồng thay thế 6a (Thoát giữa chừng)
  Scenario: Thoát phiên học giữa chừng có xác nhận
    Given Người dùng đang làm bài ở câu 3/10
    When Người dùng nhấp nút "Thoát" trên thanh ModeHeader
    Then Hệ thống hiển thị hộp thoại xác nhận: "Bạn có muốn lưu tiến độ những câu đã làm trước khi thoát không?"
    When Người dùng chọn "Lưu & Thoát"
    Then Hệ thống lưu kết quả 3 câu đã làm và đóng phiên học

  # Luồng chính - Bước 8, 9, 10 (Hoàn thành phiên)
  Scenario: Hoàn thành toàn bộ câu hỏi và tổng kết
    Given Người dùng vừa trả lời xong câu hỏi cuối cùng
    When Người dùng nhấn nút "Xem kết quả"
    Then Hệ thống hiển thị màn hình tổng kết SessionSummaryCard
    And Hiển thị điểm XP đạt được (+15 XP cơ bản + 2 XP/câu đúng), tỷ lệ % chính xác, chuỗi Streak cao nhất
    And Hiển thị danh sách các từ đã làm sai (nếu có)
```

### 2.2. Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **Ràng buộc số lượng từ:** Tối thiểu 4 từ vựng mới khởi tạo được quiz.
- [x] **Tính duy nhất của đáp án:** Trong 4 phương án A, B, C, D, chỉ có duy nhất 1 đáp án đúng; 3 phương án nhiễu không được trùng lặp với đáp án đúng và không trùng nhau.
- [x] **Chống click lặp (Anti-spam):** Sau khi đã chọn 1 phương án (`isAnswered = true`), lập tức `disabled` toàn bộ 4 nút đáp án để người dùng không thể đổi ý hoặc spam click.
- [x] **Phím tắt hỗ trợ:** Phím <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd>, <kbd>4</kbd> để chọn đáp án; Phím <kbd>Enter</kbd> hoặc <kbd>Space</kbd> để tiếp tục.

---

## 3. Ma Trận Kịch Bản Kiểm Thử 6 Khía Cạnh (Test Matrix)

| Khía cạnh kiểm thử | Mục tiêu kiểm tra | Kịch bản chi tiết |
| :--- | :--- | :--- |
| **1. Happy Path** | Luồng học chuẩn lý tưởng | Làm đủ 10 câu, đúng 10/10 câu ➔ Nhận 35 XP, accuracy 100%, Streak 10, hiển thị vinh danh. |
| **2. Negative Cases** | Xử lý dữ liệu không hợp lệ | - Bộ thẻ rỗng (0 từ) ➔ Báo lỗi không thể học.<br>- Bộ thẻ có 2 từ ➔ Chặn và gợi ý thêm từ mới.<br>- Bộ thẻ có từ nhưng từ đó không có nghĩa (`customMeaning` rỗng) ➔ Bỏ qua hoặc lấy fallback. |
| **3. Boundary Value (BVA)** | Kiểm tra giá trị biên $N = 4$ | - **$N = 3$ từ:** Chặn khởi tạo (Luồng 2a).<br>- **$N = 4$ từ (Ngưỡng tối thiểu):** Khởi tạo thành công phiên học 4 câu, mỗi câu đủ 4 phương án độc nhất.<br>- **$N = 5$ từ:** Khởi tạo bình thường, bốc ngẫu nhiên 3 phương án nhiễu từ 4 từ còn lại. |
| **4. Edge Cases** | Ca biên thao tác người dùng | - Spam click đúp 2 đáp án cùng lúc ➔ Chỉ ghi nhận phương án đầu tiên.<br>- Nhấn phím Enter/Space khi chưa chọn đáp án ➔ Không chuyển câu.<br>- Thoát ở câu đầu tiên khi chưa làm câu nào ➔ Đóng phiên bình thường không lỗi runtime.<br>- Câu ví dụ ngữ cảnh rất dài (dài hơn 200 ký tự) ➔ Tự động ngắt dòng `line-clamp-2`, không vỡ layout. |
| **5. Security & Integrity** | Tính toàn vẹn dữ liệu | - F12 Inspect DOM trước khi chọn đáp án: Không để lộ class `correct` trên nút A, B, C, D trước khi người dùng click.<br>- Kiểm tra phân quyền: Không cho phép học bộ thẻ của người khác (IDOR). |
| **6. UI/UX & A11y** | Trải nghiệm & Độ tương phản | - Độ tương phản WCAG 2.1 AA cho màu xanh lá (`emerald-600`) và màu đỏ (`rose-600`).<br>- Zero-scroll: Giao diện vừa khít khung nhìn 100vh trên cả màn hình laptop 1366x768 và mobile.<br>- Có `aria-label` và tooltip cho nút phát âm, nút thoát. |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (`TC_VOCAB_QUIZ_...`)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_VOCAB_QUIZ_01** | Boundary / Negative | Chặn khi bộ thẻ có 3 từ | Bộ thẻ có đúng 3 từ vựng | 1. Nhấn nút "Học từ vựng" | Bộ thẻ ID: 2 (3 từ) | - Hiển thị màn hình EmptyState: Cần tối thiểu 4 từ vựng.<br>- Có nút "Quay lại bộ thẻ". |
| **TC_VOCAB_QUIZ_02** | Boundary / Happy | Khởi tạo thành công với 4 từ | Bộ thẻ có đúng 4 từ vựng | 1. Nhấn nút "Học từ vựng" | Bộ thẻ ID: 3 (4 từ) | - Khởi tạo phiên 4 câu hỏi.<br>- Mỗi câu hỏi có đủ 4 phương án A, B, C, D không trùng lặp. |
| **TC_VOCAB_QUIZ_03** | Happy Path | Trả lời câu hỏi ĐÚNG | Đang ở câu hỏi từ "apple" | 1. Click vào phương án "quả táo" | Đáp án đúng: "quả táo" | - Nút đổi màu viền xanh lá.<br>- Hiện icon CheckCircle.<br>- Hiện thanh giải thích & nút "Câu tiếp theo".<br>- Streak tăng lên 1. |
| **TC_VOCAB_QUIZ_04** | Happy Path | Trả lời câu hỏi SAI | Đang ở câu hỏi từ "apple" | 1. Click vào phương án "quả chuối" | Chọn sai: "quả chuối"<br>Đúng: "quả táo" | - Nút "quả chuối" đổi viền đỏ, icon XCircle.<br>- Nút "quả táo" tự động tô xanh lá.<br>- Streak bị reset về 0.<br>- Thẻ được thêm vào danh sách cần ôn lại. |
| **TC_VOCAB_QUIZ_05** | UI/UX & Keyboard | Dùng phím tắt để chọn & tiếp tục | Đang ở màn hình câu hỏi | 1. Nhấn phím `1` để chọn phương án A.<br>2. Nhấn phím `Enter` | Phím `1` và `Enter` | - Phương án A được chọn ngay.<br>- Nhấn Enter chuyển ngay sang câu tiếp theo. |
| **TC_VOCAB_QUIZ_06** | UI/UX | Phát âm từ vựng (Luồng 4a) | Đang ở câu hỏi từ "apple" | 1. Nhấn biểu tượng loa | Ngôn ngữ: `en` | - Giọng đọc tiếng Anh phát âm từ "apple".<br>- Không làm ảnh hưởng đến trạng thái chọn đáp án. |
| **TC_VOCAB_QUIZ_07** | Edge Case | Chống spam click nhiều đáp án | Chưa chọn đáp án | 1. Nhấn liên tiếp cực nhanh vào phương án A và B | Thao tác click nhanh | - Chỉ ghi nhận phương án A.<br>- Các nút lập tức disabled, không đổi sang B. |
| **TC_VOCAB_QUIZ_08** | Alternative | Thoát phiên học giữa chừng (Luồng 6a) | Đang ở câu 2/10 | 1. Bấm nút "Thoát" trên ModeHeader | Đang làm dở | - Xuất hiện Modal: "Bạn có muốn lưu tiến độ những câu đã làm không?".<br>- Bấm "Tiếp tục học" ➔ Đóng modal, giữ nguyên câu hỏi. |
| **TC_VOCAB_QUIZ_09** | Happy Path | Hoàn thành toàn bộ phiên học | Vừa hoàn thành câu cuối cùng | 1. Bấm nút "Xem kết quả" | Điểm: 8/10 | - Hiển thị màn hình tổng kết SessionSummaryCard.<br>- Hiển thị XP: +31 XP, Tỷ lệ: 80%, Streak cao nhất.<br>- Hiển thị danh sách 2 từ làm sai. |
| **TC_VOCAB_QUIZ_10** | Happy Path | Chơi lại phiên học từ tổng kết | Đang ở màn hình tổng kết | 1. Bấm nút "Luyện tập lại" | N/A | - Reset toàn bộ điểm, streak về 0.<br>- Xáo trộn lại câu hỏi và bắt đầu từ câu 1. |
