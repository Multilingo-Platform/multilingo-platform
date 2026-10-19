# Đặc tả Kỹ thuật: Bổ sung Loại Câu hỏi MATCHING_SENTENCE_ENDINGS và Hoàn thiện MATCHING_FEATURES

## 1. Bối cảnh & Mục tiêu (Context & Objective)
Trong các bài thi chuẩn hóa quốc tế (đặc biệt là IELTS Reading & Listening), có 2 dạng câu hỏi nối (Matching) rất phổ biến:
1. **Matching Sentence Endings (`MATCHING_SENTENCE_ENDINGS`):**
   - Đề bài cung cấp danh sách các đuôi câu được đánh chữ cái (thường từ A đến G hoặc H).
   - Thí sinh đọc các câu chưa hoàn chỉnh (ví dụ: Câu 31-35) và chọn chữ cái đuôi câu phù hợp nhất từ danh sách để hoàn thành câu.
2. **Matching Features (`MATCHING_FEATURES`):**
   - Đề bài cung cấp danh sách đối tượng / đặc trưng / người / học thuyết (ví dụ: "List of people" gồm A, B, C).
   - Thí sinh nối các nhận định / sự kiện (ví dụ: Câu 19-23) với đối tượng tương ứng. Đề bài thường cho phép sử dụng lại một chữ cái nhiều lần ("NB You may use any letter more than once").

### Mục tiêu cần đạt:
- **Admin Exam Builder:**
  - Bổ sung `MATCHING_SENTENCE_ENDINGS` vào danh mục `QUESTION_TYPES`.
  - Mở rộng `ExcelColumnMap` hỗ trợ các cột `optF`, `optG`, `optH` khi Import và Export Excel.
  - Cho phép quản lý danh sách Options (từ A đến G/H) trên giao diện soạn thảo câu hỏi cho các loại bài Matching.
  - Cho phép cấu hình danh sách lựa chọn ở cấp độ nhóm (Group Options) hoặc ở từng câu hỏi riêng biệt.
- **Student Exam Workspace:**
  - `QuestionRenderer` hỗ trợ hiển thị đẹp mắt cho `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES`.
  - Hiển thị danh sách lựa chọn chung (Box A-G hoặc List of people) kèm thẻ chọn / select box cho từng câu hỏi.
- **Backend Grading:**
  - Khai báo `MATCHING_SENTENCE_ENDINGS` trong `ObjectiveGradingServiceImpl` thuộc `OBJECTIVE_TYPES`.
  - Hỗ trợ chấm điểm tự động chính xác cho cả đáp án là chữ cái (A-G) hoặc nội dung text của option.
  - Hỗ trợ trích xuất grading keys từ snapshot và database qua `SnapshotGradingKeyExtractor` và `DbGradingAdapter`.

---

## 2. Thiết kế Dữ liệu (Data Contract & JSONB Schema)

### 2.1. Cấu trúc Question Metadata trong JSONB
Mỗi câu hỏi dạng Matching được lưu trữ như sau:
```json
{
  "question_id": "q_031",
  "type": "MATCHING_SENTENCE_ENDINGS",
  "question_text": "At times when they were relaxed, the firefighters usually ..............",
  "metadata": {
    "options": [
      "made them feel optimistic.",
      "took relatively little notice of bad news.",
      "responded to negative and positive information in the same way.",
      "were feeling under stress.",
      "put them in a stressful situation.",
      "behaved in a similar manner, regardless of the circumstances.",
      "thought it more likely that they would experience something bad."
    ],
    "correct_option_index": 0,
    "correct_answer": "made them feel optimistic.",
    "explanation": "Chi tiết giải thích đáp án..."
  }
}
```

Đối với trường hợp câu hỏi thuộc nhóm có danh sách lựa chọn chung (`options` ở cấp `question_groups`):
```json
{
  "group_id": "g_ielts_r3_2",
  "instruction": "Complete each sentence with the correct ending, A-G, below.",
  "options": [
    { "id": "A", "text": "made them feel optimistic." },
    { "id": "B", "text": "took relatively little notice of bad news." },
    { "id": "C", "text": "responded to negative and positive information in the same way." },
    { "id": "D", "text": "were feeling under stress." },
    { "id": "E", "text": "put them in a stressful situation." },
    { "id": "F", "text": "behaved in a similar manner, regardless of the circumstances." },
    { "id": "G", "text": "thought it more likely that they would experience something bad." }
  ],
  "questions": [
    {
      "question_id": "q_031",
      "type": "MATCHING_SENTENCE_ENDINGS",
      "question_text": "At times when they were relaxed, the firefighters usually ..............",
      "metadata": {
        "correct_option_index": 0,
        "correct_answer": "A"
      }
    }
  ]
}
```

---

## 3. Kiến trúc Frontend (Exam Builder & Workspace)

### 3.1. ExamBuilder (`frontend/src/features/exams/pages/admin/ExamBuilder.tsx`)
1. **QUESTION_TYPES danh mục:**
   - Thêm: `{ value: 'MATCHING_SENTENCE_ENDINGS', label: 'Matching Sentence Endings (Nối đuôi câu A-G)' }`
   - Nhãn rõ ràng cho: `{ value: 'MATCHING_FEATURES', label: 'Matching Features (Nối đối tượng / Danh sách người)' }`
2. **Excel Import/Export:**
   - Bổ sung `optF`, `optG`, `optH` vào `ExcelColumnMap` (tương ứng với các cột "Lựa chọn F", "Option F", "Lựa chọn G", "Option G", "Lựa chọn H", "Option H").
   - Trình import tự động nhận diện đến 8 options (A, B, C, D, E, F, G, H).
   - Khi type là `MATCHING_SENTENCE_ENDINGS` hoặc `MATCHING_FEATURES`, nếu có các lựa chọn này, tự động đưa vào mảng `options`.
3. **Question Editor UI:**
   - Cho phép các dạng Matching (`MATCHING_SENTENCE_ENDINGS`, `MATCHING_FEATURES`, `MATCHING_HEADINGS`) có giao diện chỉnh sửa Options đầy đủ (thay vì bị set `undefined` như trước).
   - Nút "+ Thêm đáp án" cho phép thêm options tới F, G, H.
   - Thí sinh / Admin có thể click radio chọn đáp án đúng (A, B, C, D, E, F, G...).

### 3.2. Student Workspace (`frontend/src/features/exam/components/renderers/`)
1. `QuestionRenderer.tsx`:
   - Định tuyến `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES` đến `MatchingRenderer`.
2. `MatchingRenderer.tsx`:
   - Chuẩn hóa đầu vào `options`: Hỗ trợ cả mảng chuỗi `string[]` (tự động gán id A, B, C, D...) và mảng `ExamOption[]` (`{ id, text }`).
   - Giao diện thân thiện, dropdown hoặc nút chọn nhanh chữ cái (A-G), hiển thị rõ ràng nội dung câu hỏi và lựa chọn.

---

## 4. Kiến trúc Backend (Testing Module & Grading Engine)

### 4.1. `ObjectiveGradingServiceImpl.java`
- Thêm `MATCHING_SENTENCE_ENDINGS` vào `OBJECTIVE_TYPES`.
- Trong switch-case chấm điểm, xử lý `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES` qua phương thức chấm điểm matching chuẩn (hỗ trợ so khớp chính xác mã chữ cái A-G hoặc nội dung chuỗi tương ứng).

### 4.2. `SnapshotGradingKeyExtractor.java` & `DbGradingAdapter.java`
- Đảm bảo `MATCHING_SENTENCE_ENDINGS` được tự động trích xuất đáp án đúng từ `correct_answer`, `correct_option_index`, và kế thừa options từ `group.options` nếu câu hỏi chưa có options riêng.

---

## 5. Quy trình Kiểm thử & Nghiệm thu (Verification Plan)
1. **Frontend Tests:**
   - Viết unit test cho `detectExcelColumns` nhận diện đúng các cột `optF`, `optG`, `optH`.
   - Viết unit test cho việc import Excel với câu hỏi `MATCHING_SENTENCE_ENDINGS` có options A-G.
   - Viết test cho `MatchingRenderer` hiển thị và chọn đáp án đúng với các options A-G.
2. **Backend Tests:**
   - Viết unit test cho `ObjectiveGradingServiceImpl` chấm điểm chính xác câu hỏi `MATCHING_SENTENCE_ENDINGS` cho cả letter và option text.
   - Viết unit test cho `SnapshotGradingKeyExtractor` và `DbGradingAdapter`.
   - Chạy toàn bộ test suite `mvn clean test` bảo đảm PASS 100%.
