# Đề xuất Contract JSON Schema `content_data` giữa TV2 (Exam Module) và TV3 (Testing Module)

**Mã Milestone:** M00-01  
**Người khởi tạo:** TV3  
**Bên tiếp nhận:** TV2 (Quản lý đề thi & Phần thi)  
**Vị trí lưu trữ trong DB:** Cột `ExamPart.content_data` (PostgreSQL JSONB)

---

## 1. Mục tiêu
Thống nhất cấu trúc dữ liệu JSON lưu trữ nội dung đề thi của một `ExamPart` để:
- TV2 biết chính xác cấu trúc khi Admin tạo/import đề thi.
- TV3 biết chính xác cấu trúc để render đề thi (Workspace), chấm điểm tự động (Autograding) và gửi prompt cho AI (Gemini).

---

## 2. Đặc tả JSON Schema

### 2.1 Cấu trúc cấp Part
```json
{
  "part_title": "Part 1: Listening Comprehension",
  "instruction": "Listen to the conversation and answer questions 1 to 5.",
  "shared_media": {
    "type": "AUDIO",
    "url": "/media/exams/cam18-test1-part1.mp3"
  },
  "question_groups": [
    ...
  ]
}
```

- `part_title` (string, required): Tiêu đề phần thi.
- `instruction` (string, required): Hướng dẫn làm bài.
- `shared_media` (object, nullable): Phương tiện dùng chung cho toàn Part (`type`: `AUDIO` | `IMAGE`, `url`: đường dẫn file media).
- `question_groups` (array, required): Danh sách nhóm câu hỏi.

---

### 2.2 Cấu trúc cấp Nhóm câu hỏi (`question_groups`)
```json
{
  "group_id": "qg-01",
  "context_html": "<p>Đoạn văn đọc hiểu hoặc ngữ cảnh dùng chung...</p>",
  "questions": [
    ...
  ]
}
```

- `group_id` (string, required): Mã định danh duy nhất của nhóm câu hỏi trong Part.
- `context_html` (string, nullable): Đoạn văn bài đọc (Reading passage) hoặc ngữ cảnh chung.
- `questions` (array, required): Danh sách câu hỏi thuộc nhóm này.

---

### 2.3 Cấu trúc cấp Câu hỏi (`questions`)
```json
{
  "question_id": "q-001",
  "question_number": 1,
  "question_type": "SINGLE_CHOICE",
  "question_text": "What is the speaker's main purpose?",
  "options": [
    { "id": "A", "text": "To introduce a new policy" },
    { "id": "B", "text": "To complain about a service" },
    { "id": "C", "text": "To ask for information" }
  ],
  "correct_answer": "A",
  "explanation": "At 00:45, the speaker clearly mentions...",
  "explanation_vi": "Ở giây thứ 45, người nói nêu rõ..."
}
```

#### Định dạng `correct_answer` theo từng loại câu hỏi:
| `question_type` | Định dạng `options` | Định dạng `correct_answer` | Ví dụ |
|---|---|---|---|
| `SINGLE_CHOICE` | `ExamOption[]` | `string` (option id) | `"A"` |
| `MULTIPLE_CHOICE` | `ExamOption[]` | `string[]` (mảng option id) | `["A", "C"]` |
| `TRUE_FALSE_NOT_GIVEN` | `ExamOption[]` (T/F/NG) | `string` | `"TRUE"` |
| `YES_NO_NOT_GIVEN` | `ExamOption[]` (Y/N/NG) | `string` | `"YES"` |
| `FILL_IN_THE_BLANK` | `null` | `string[]` (danh sách đáp án chấp nhận) | `["library", "Library"]` |
| `MATCHING` | Danh sách mục cần nối | `Record<string, string>` | `{"1": "B", "2": "A"}` |
| `ESSAY` | `null` | `null` (chấm qua AI Gemini) | `null` |

---

## 3. Câu hỏi cần TV2 xác nhận
1. TV2 có đồng ý với danh sách `QuestionType` ở trên không? Có loại câu nào trong đề thực tế cần thêm?
2. `question_id` sẽ đảm bảo unique trong phạm vi một Part hay toàn bộ Exam? (TV3 đề xuất unique toàn bộ Exam).
3. URL media (`shared_media.url`) sẽ là URL tương đối (`/media/...`) hay URL tuyệt đối qua Cloudinary/S3?
