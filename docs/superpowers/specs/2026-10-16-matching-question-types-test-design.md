# Tiêu chí Nghiệm thu & Thiết kế Kiểm thử (AC & Test Design)
## Phân hệ: Exam Builder & Testing Module - Bổ sung MATCHING_SENTENCE_ENDINGS và MATCHING_FEATURES

---

## Bước 1: Phân tích Phạm vi & Tác nhân (Scope & Actors)

### 1.1. Actors (Tác nhân)
- **Admin / Giáo viên tạo đề:**
  - Nhập liệu và cấu hình đề thi trên Exam Builder (Web UI).
  - Tải lên đề thi qua file Excel (.xlsx) với các câu hỏi nối và danh sách options (A-G/H).
  - Tải xuống template Excel hoặc xuất đề thi chứa các câu hỏi dạng Matching.
- **Thí sinh (Student):**
  - Làm bài thi / luyện tập trên màn hình Exam Workspace.
  - Xem nội dung câu hỏi và chọn đáp án từ danh sách A-G hoặc danh sách đối tượng (A-C).
- **Hệ thống chấm điểm tự động (Backend Engine):**
  - Trích xuất grading key từ snapshot hoặc database.
  - So khớp câu trả lời của thí sinh (letter hoặc text) và tính điểm chính xác.

### 1.2. Scope Boundaries (Ranh giới phạm vi)
- **In-Scope:**
  - Bổ sung loại câu hỏi `MATCHING_SENTENCE_ENDINGS` vào danh mục câu hỏi trên Frontend và Backend.
  - Mở rộng `ExcelColumnMap` hỗ trợ các cột `optF`, `optG`, `optH` khi import/export Excel.
  - Cho phép quản lý danh sách Options (thêm/xóa/sửa options từ A đến H) trong ExamBuilder cho `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES`.
  - Hỗ trợ hiển thị và làm bài trên `MatchingRenderer` trong Exam Workspace.
  - Backend `ObjectiveGradingServiceImpl` chấm đúng điểm cho `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES` cho cả ký tự (A-G) và text.
  - Bộ kiểm thử unit tests Frontend và Backend.
- **Out-of-Scope:**
  - Dạng bài kéo thả (drag and drop) phức tạp (sẽ phát triển ở giai đoạn sau, hiện tại sử dụng Dropdown Select box chuẩn).
  - Chấm điểm tự luận AI cho các câu hỏi trắc nghiệm khách quan.

---

## Bước 2: Soạn thảo Tiêu chí Nghiệm thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin

#### AC-01: Admin chọn loại câu hỏi MATCHING_SENTENCE_ENDINGS trên Exam Builder
```gherkin
Kịch bản: Thêm mới câu hỏi MATCHING_SENTENCE_ENDINGS thủ công trên UI
Given Admin đang ở màn hình Exam Builder và đã tạo một Question Group
When Admin thêm câu hỏi và chọn loại câu hỏi "Matching Sentence Endings"
Then Giao diện hiển thị các ô nhập đáp án từ A đến G
And Admin có thể bấm "+ Thêm đáp án" để thêm option H hoặc xóa bớt option
And Admin có thể chọn radio button để chỉ định đáp án đúng (A-G)
```

#### AC-02: Import file Excel chứa các câu hỏi có options từ A đến G
```gherkin
Kịch bản: Import đề thi IELTS Reading chứa dạng Sentence Endings qua Excel
Given File Excel có các cột tiêu đề Option A, Option B, Option C, Option D, Option E, Option F, Option G
And Cột Type có giá trị "MATCHING_SENTENCE_ENDINGS" và Cột Correct có giá trị "B"
When Admin bấm Import file Excel vào Exam Builder
Then Hệ thống tự động phát hiện đúng các cột Option A đến Option G
And Tạo câu hỏi loại MATCHING_SENTENCE_ENDINGS với đủ 7 lựa chọn
And Gán đúng đáp án đúng là option B (index 1)
```

#### AC-03: Thí sinh làm bài câu hỏi Matching trong Exam Workspace
```gherkin
Kịch bản: Thí sinh chọn đáp án dạng Matching
Given Thí sinh đang làm bài thi tại phần có câu hỏi MATCHING_SENTENCE_ENDINGS
When Thí sinh mở dropdown danh sách lựa chọn của câu hỏi 31
Then Danh sách hiển thị đầy đủ các mục từ A đến G kèm nội dung mô tả
When Thí sinh chọn "B. took relatively little notice of bad news."
Then Hệ thống lưu câu trả lời là "B" vào state và tự động autosave
And Đánh dấu câu 31 đã hoàn thành trên thanh điều hướng câu hỏi
```

#### AC-04: Backend chấm điểm tự động câu hỏi MATCHING_SENTENCE_ENDINGS
```gherkin
Kịch bản: Chấm điểm bài thi có câu hỏi MATCHING_SENTENCE_ENDINGS
Given Thí sinh nộp bài thi với câu trả lời cho câu q_031 là "B" (hoặc "took relatively little notice of bad news.")
And Đáp án đúng đã lưu trong exam snapshot là "B" kèm alternate là text
When Hệ thống thực hiện chấm điểm qua ObjectiveGradingServiceImpl
Then Kết quả chấm của q_031 là CORRECT (1.0 điểm)
And Điểm được cộng vào tổng điểm Reading của thí sinh
```

### 2.2. Business Rules Checklist (Quy tắc nghiệp vụ)
1. **Số lượng options tối thiểu & tối đa:**
   - Dạng `MATCHING_SENTENCE_ENDINGS`: tối thiểu 2 options, tối đa 8 options (A đến H).
   - Dạng `MATCHING_FEATURES`: tối thiểu 2 options, tối đa 8 options (A đến H).
2. **Kế thừa options từ Group (Group Options):**
   - Nếu `question.options` trống nhưng `group.options` có dữ liệu, câu hỏi tự động kế thừa options từ nhóm.
3. **Tính linh hoạt của đáp án đúng:**
   - Đáp án đúng có thể là chữ cái in hoa (`'A'`, `'B'`, `'C'`) hoặc text đầy đủ của option. Cả hai trường hợp đều được grading engine công nhận là đúng.

---

## Bước 3: Ma trận Kịch bản Kiểm thử 6 Khía cạnh (Comprehensive Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **1. Happy Path** | Import Excel câu hỏi `MATCHING_SENTENCE_ENDINGS` 7 options A-G | Cột A-G có text, Correct = 'C' | Import thành công, có 7 options, correct answer là 'C' |
| **1. Happy Path** | Thí sinh chọn đáp án và nộp bài | Chọn 'C' | Điểm được tính đúng 1.0 (CORRECT) |
| **2. Negative** | Thí sinh chọn sai đáp án | Chọn 'A' trong khi đáp án là 'C' | Điểm là 0.0 (WRONG) |
| **2. Negative** | Import Excel có type `MATCHING_SENTENCE_ENDINGS` nhưng thiếu cột Đáp án đúng | Correct để trống | Import vẫn thành công, correct_answer là rỗng, cảnh báo khi Admin xuất bản |
| **3. Boundary** | Matching có 2 options (cận dưới Min) | Options A, B | Hiển thị và chấm điểm chuẩn xác |
| **3. Boundary** | Matching có 8 options (cận trên Max: A-H) | Options A, B, C, D, E, F, G, H | Import và hiển thị trọn vẹn cả 8 options A-H |
| **4. Edge Case** | Đáp án nhập chữ thường 'b' thay vì 'B' | User answer = "b" | Grading engine chuẩn hóa hoa/thường, chấm CORRECT |
| **4. Edge Case** | Options chứa khoảng trắng thừa ở đầu/cuối | "  Option text  " | Tự động trim, không gây lệch kết quả so sánh |
| **4. Edge Case** | Option có ký tự Unicode tiếng Việt hoặc dấu câu phức tạp | "Điểm đặc trưng: (1) & (2)..." | Render chuẩn Unicode UTF-8 |
| **5. Security** | Thử inject mã HTML/XSS trong nội dung câu hỏi hoặc option | `<script>alert(1)</script>` | Được escape an toàn qua React DOM, không thực thi script |
| **6. UI/UX** | Dropdown option hiển thị responsive trên màn hình nhỏ | Mobile / Tablet viewport | Dropdown co giãn vừa vặn, không tràn lề |

---

## Bước 4: Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_EXAM_MATCH_01** | Happy Path | Nhận diện cột Excel optF và optG | File Excel có cột Lựa chọn F và G | 1. Gọi hàm detectExcelColumns() | Header chứa ["Option F", "Option G"] | `colMap.optF > 0` và `colMap.optG > 0` |
| **TC_EXAM_MATCH_02** | Happy Path | Import câu hỏi MATCHING_SENTENCE_ENDINGS từ Excel | Đang ở trang Exam Builder | 1. Upload file Excel có 7 options A-G<br>2. Kiểm tra danh sách câu hỏi | File mẫu IELTS Reading 31-35 | Câu hỏi q_031 có 7 options, correct_option_index = 0, type = MATCHING_SENTENCE_ENDINGS |
| **TC_EXAM_MATCH_03** | UI/UX | Thêm và xóa options trên giao diện Exam Builder | Đang mở câu hỏi MATCHING_SENTENCE_ENDINGS | 1. Bấm "+ Thêm đáp án"<br>2. Nhập text cho Option E, F, G<br>3. Chọn radio cho Option F | Text mới cho option | Danh sách cập nhật ngay lập tức, radio F được chọn |
| **TC_EXAM_MATCH_04** | Happy Path | Thí sinh làm bài với MatchingRenderer | Thí sinh đang mở Workspace | 1. Mở dropdown câu 31<br>2. Chọn option 'B'<br>3. Kiểm tra state | Option 'B' | State answers chứa `{ q_031: 'B' }`, hiển thị trạng thái đã làm |
| **TC_EXAM_MATCH_05** | Happy Path | Backend chấm MATCHING_SENTENCE_ENDINGS với chữ cái | Key có correct = 'B' | 1. Gửi answer "B" vào engine | Answer = "B" | Verdict = CORRECT, score = 1.0 |
| **TC_EXAM_MATCH_06** | Happy Path | Backend chấm MATCHING_SENTENCE_ENDINGS với option text | Key có correct = 'B', alternates = ["made them feel..."] | 1. Gửi answer text vào engine | Answer = "made them feel..." | Verdict = CORRECT, score = 1.0 |
| **TC_EXAM_MATCH_07** | Negative | Backend chấm MATCHING_SENTENCE_ENDINGS với đáp án sai | Key có correct = 'B' | 1. Gửi answer "D" vào engine | Answer = "D" | Verdict = WRONG, score = 0.0 |
| **TC_EXAM_MATCH_08** | Boundary | Xử lý tối đa 8 options (A đến H) | Câu hỏi có 8 options | 1. Render trong MatchingRenderer<br>2. Chọn option H | Option H | Option H hiển thị trong dropdown và chọn được bình thường |
