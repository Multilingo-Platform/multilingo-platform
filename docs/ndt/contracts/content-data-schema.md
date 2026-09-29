# Contract JSON Schema `content_data` — TV2 (Exam Module) ↔ TV3 (Testing Module)

**Mã Milestone:** M00-01  
**Người khởi tạo:** TV3  
**Bên tiếp nhận:** TV2 (Quản lý đề thi & Phần thi)  
**Vị trí lưu trữ trong DB:** Cột `ExamPart.content_data` (PostgreSQL JSONB)  
**Cập nhật lần cuối:** 2026-09-29 — Chuẩn hóa từ dữ liệu thực tế IELTS & TOEIC

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
  "part_title": "Part 1: Form Completion",
  "instruction": "Listen to a telephone conversation and complete the form.",
  "shared_audio": {
    "url": "https://cdn.example.com/audio/ielts-part1.mp3",
    "duration_seconds": 245
  },
  "shared_media": null,
  "content_html": null,
  "question_groups": []
}
```

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `part_title` | string | ✅ | Tiêu đề phần thi |
| `instruction` | string | ✅ | Hướng dẫn làm bài tổng quát cho Part |
| `shared_audio` | object \| null | ❌ | Audio dùng chung toàn Part (IELTS Listening Part 1-4). Có `url` (string) và `duration_seconds` (int, giây) |
| `shared_media` | object \| null | ❌ | Hình ảnh/biểu đồ dùng chung toàn Part. Xem §2.3 |
| `content_html` | string \| null | ❌ | HTML giới thiệu/hướng dẫn ở đầu Part khi cần render rich text |
| `question_groups` | array | ✅ | Danh sách nhóm câu hỏi. Tối thiểu 1 phần tử |

---

### 2.2 Cấu trúc cấp Nhóm câu hỏi (`question_groups`)
```json
{
  "group_id": "list-p1-form",
  "instruction": "Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
  "content_html": "<h3>CAR INSURANCE QUOTE FORM</h3>",
  "shared_audio": null,
  "shared_media": {
    "type": "image",
    "url": "https://cdn.example.com/images/park-map.png",
    "display_config": {
      "size_preset": "large",
      "alignment": "center"
    }
  },
  "questions": []
}
```

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `group_id` | string | ✅ | Unique trong phạm vi Exam. Format kebab-case (vd: `list-p1-form`) |
| `instruction` | string \| null | ❌ | Hướng dẫn riêng cho nhóm câu hỏi này |
| `content_html` | string \| null | ❌ | HTML render kèm nhóm câu hỏi (bảng điền, đoạn văn, email...) |
| `shared_audio` | object \| null | ❌ | Audio riêng cho nhóm (TOEIC Part 1/2: mỗi group có 1 audio). Có `url` và `duration_seconds` |
| `shared_media` | object \| null | ❌ | Hình ảnh/biểu đồ/bản đồ dùng chung trong nhóm |
| `questions` | array | ✅ | Danh sách câu hỏi thuộc nhóm này |

#### Cấu trúc `shared_audio`:
```json
{
  "url": "https://cdn.example.com/audio/toeic-part1-q1.mp3",
  "duration_seconds": 25
}
```

#### Cấu trúc `shared_media`:
```json
{
  "type": "image",
  "url": "https://cdn.example.com/images/park-map.png",
  "display_config": {
    "size_preset": "medium | large",
    "alignment": "center | left | right"
  }
}
```

---

### 2.3 Cấu trúc cấp Câu hỏi (`questions`)
```json
{
  "question_id": "q_001",
  "type": "SINGLE_CHOICE",
  "question_text": "What is the speaker's main purpose?",
  "media": null,
  "options": [
    { "id": "A", "text": "To introduce a new policy" },
    { "id": "B", "text": "To complain about a service" },
    { "id": "C", "text": "To ask for information" }
  ],
  "correct_answer": "A",
  "explanation": "At 00:45, the speaker clearly mentions...",
  "ai_prompt_context": null
}
```

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `question_id` | string | ✅ | Unique trong phạm vi toàn Exam (vd: `q_001`, `q_tw_006`) |
| `type` | string (enum) | ✅ | Xem bảng `QuestionType` §2.4 |
| `question_text` | string | ✅ | Nội dung câu hỏi. Có thể chứa placeholder `[___N___]` cho dạng điền vào chỗ trống |
| `media` | object \| null | ❌ | Hình ảnh riêng của câu hỏi (TOEIC Part 1: mỗi câu có 1 ảnh). Cùng cấu trúc với `shared_media` |
| `options` | `ExamOption[]` \| null | Phụ thuộc `type` | `null` cho `FILL_IN_THE_BLANK` và `ESSAY` |
| `correct_answer` | string \| string[] \| null | Phụ thuộc `type` | `null` cho `ESSAY` |
| `explanation` | string \| null | ❌ | Giải thích đáp án (tiếng Anh hoặc tiếng Việt) |
| `ai_prompt_context` | string \| null | ❌ | Hướng dẫn chi tiết cho AI Gemini khi chấm dạng ESSAY. Bắt buộc có nếu `type = ESSAY` |

---

### 2.4 Bảng `QuestionType` (Enum đầy đủ)

| `type` | Tên hiển thị | Định dạng `correct_answer` | Áp dụng |
|---|---|---|---|
| `SINGLE_CHOICE` | Trắc nghiệm 1 đáp án | `string` (option id: `"A"`) | IELTS/TOEIC Listening, TOEIC Reading Part 5/7 |
| `MULTIPLE_CHOICE` | Trắc nghiệm nhiều đáp án | `string[]` (vd: `["B", "E"]`) | IELTS Reading MCQ multi, IELTS Listening Part 3 |
| `TRUE_FALSE_NOT_GIVEN` | True/False/Not Given | `string` (`"TRUE"` \| `"FALSE"` \| `"NOT GIVEN"`) | IELTS Reading |
| `YES_NO_NOT_GIVEN` | Yes/No/Not Given | `string` (`"YES"` \| `"NO"` \| `"NOT GIVEN"`) | IELTS Reading |
| `FILL_IN_THE_BLANK` | Điền vào chỗ trống | `string[]` (các đáp án chấp nhận) | IELTS Listening/Reading, TOEIC Part 6 |
| `MATCHING_FEATURES` | Nối tính năng / Matching | `string` (option id) | IELTS Listening Part 3, IELTS Reading |
| `MATCHING_HEADINGS` | Đặt tiêu đề đoạn văn | `string` (option text đầy đủ) | IELTS Reading |
| `MAP_LABELING` | Labeling bản đồ (clickable zones) | `string` (option id: `"D"`) | IELTS Listening Part 2 |
| `DIAGRAM_LABELING` | Labeling sơ đồ/biểu đồ (fill blanks) | `string[]` (đáp án điền) | IELTS Listening Part 4, IELTS Reading |
| `ESSAY` | Viết luận / Viết câu / Phản hồi email | `null` (AI chấm qua Gemini) | IELTS Writing, TOEIC Writing |

> **Lưu ý phân biệt `MAP_LABELING` vs `DIAGRAM_LABELING`:**
> - `MAP_LABELING`: Frontend render bản đồ có các vùng click được (A→F), học viên chọn label nào ứng với vị trí được hỏi.
> - `DIAGRAM_LABELING`: Sơ đồ tĩnh với các mũi tên chỉ vào bộ phận, học viên điền tên bộ phận đó (dạng fill-in).

---

### 2.5 Cấu trúc `ExamOption`
```json
{ "id": "A", "text": "To introduce a new policy" }
```

| Field | Type | Required | Ghi chú |
|---|---|---|---|
| `id` | string | ✅ | Định danh option. Thường là `"A"`, `"B"`, `"C"`, `"D"` hoặc Roman numeral `"i"`, `"ii"` |
| `text` | string | ✅ | Nội dung hiển thị của option |

> **Ví dụ đặc biệt** — TOEIC Part 1/2 (chỉ có label, không có text vì audio đọc):
> ```json
> [{ "id": "A", "text": "(A)" }, { "id": "B", "text": "(B)" }, { "id": "C", "text": "(C)" }, { "id": "D", "text": "(D)" }]
> ```

---

## 3. Quy tắc định danh `question_id`

- Unique trong phạm vi **toàn bộ Exam** (không chỉ Part).
- Format gợi ý:
  - IELTS Listening/Reading: `q_001`, `q_002`, ... `q_040`
  - IELTS Writing: `q_w_001`, `q_w_002`
  - TOEIC Listening/Reading: `q_001` ... `q_200`
  - TOEIC Writing: `q_tw_001`, `q_tw_008`
- Backend validate uniqueness khi import.

---

## 4. Câu hỏi mở (cần TV2 xác nhận)

1. `shared_audio` ở cấp Part hay cấp group? → **Đề xuất:** Hỗ trợ cả hai (ưu tiên Part nếu toàn Part dùng chung 1 audio như IELTS; ưu tiên group nếu mỗi nhóm câu hỏi có audio riêng như TOEIC Part 1/2/3).
2. URL media (`url`) là URL tuyệt đối (Cloudinary/S3) hay tương đối? → TV3 đề xuất URL tuyệt đối HTTPS.
3. TV2 có cần thêm `question_number` (số thứ tự câu hỏi hiển thị) vào cấu trúc question không? TV3 thấy chưa cần vì đã embed trong `question_text`.
