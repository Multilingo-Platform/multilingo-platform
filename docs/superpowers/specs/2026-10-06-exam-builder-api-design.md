# Đặc tả Kỹ thuật: UC14.1 & UC14.2 - API Quản lý Đề thi (Exam Builder API)

## 1. Giới thiệu (Context & Intent)
Tính năng này cung cấp API cho phía Admin (Frontend) lưu trữ và cập nhật toàn bộ cấu trúc của một đề thi đa cấp bậc (Exam -> Section -> Part -> Question Groups).
Do tính chất phức tạp của các loại đề thi (IELTS, TOEIC) với nhiều định dạng media (Audio, Image) và HTML, bảng `exam_parts` sử dụng trường `content_data` kiểu `JSONB` để lưu trữ linh hoạt toàn bộ nội dung câu hỏi.

## 2. Phương pháp tiếp cận (Approach)
**Khuyến nghị (RESTful Aggregation):** 
Xây dựng một API Endpoint duy nhất `POST /api/admin/exams` (hoặc `PUT /api/admin/exams/{id}`) để nhận toàn bộ payload (Exam kèm theo danh sách Sections, và trong mỗi Section kèm theo danh sách Parts).
*   **Ưu điểm:** Khớp 100% với hành vi "Lưu & Xuất JSON" trên giao diện Frontend. Frontend chỉ cần gửi 1 request duy nhất. Backend dùng `@Transactional` để lưu nguyên khối (Atomic), tránh tình trạng rác dữ liệu nếu xảy ra lỗi giữa chừng (ví dụ: lưu Exam thành công nhưng lưu Part thất bại).
*   **Nhược điểm:** Payload có thể lớn (lên tới vài trăm KB), nhưng hoàn toàn chấp nhận được với text JSON.

## 3. Cấu trúc Database & Thực thể (Entities)
Dựa theo `DATABASE_SCHEMA.md`, Backend đã có sẵn các Entity `Exam`, `ExamSection`, `ExamPart`.
*   `Exam`: Quản lý thông tin chung (`title`, `type`, `exam_language`, `is_published`).
*   `ExamSection`: Quản lý kỹ năng (`skill_type`, `duration_minutes`).
*   `ExamPart`: Quản lý nội dung chi tiết (`part_number`, `content_data` kiểu Map/String để map với JSONB PostgreSQL).

## 4. Đặc tả JSONB Schema (content_data)
Cấu trúc `content_data` được map chính xác 1:1 với State của Frontend:

```json
{
  "part_title": "Listening Part 1",
  "instruction": "Listen and answer questions 1-10",
  "shared_audio": { "url": "https://cloudinary.com/audio1.mp3" },
  "question_groups": [
    {
      "group_id": "g-1",
      "instruction": "Questions 1-4",
      "content_html": "<p>Passage content here...</p>",
      "questions": [
        {
          "question_id": "q-1",
          "type": "MULTIPLE_CHOICE",
          "question_text": "What is the answer?",
          "metadata": {
            "options": ["A. Yes", "B. No", "C. Not Given"],
            "correct_answer": "A. Yes",
            "explanation": "Because..."
          }
        }
      ]
    }
  ]
}
```

## 5. Danh sách API Endpoints
### 5.1. Thêm mới đề thi nguyên khối
*   **Endpoint:** `POST /api/admin/exams`
*   **Body:** `ExamRequestDTO` (Chứa `title`, `type`... và List `SectionRequestDTO`, trong đó có List `PartRequestDTO`).
*   **Xử lý:** Lưu `Exam` -> Duyệt lưu `ExamSection` -> Duyệt lưu `ExamPart`. Tất cả đặt trong `@Transactional`.

### 5.2. Chỉnh sửa đề thi nguyên khối
*   **Endpoint:** `PUT /api/admin/exams/{id}`
*   **Body:** `ExamRequestDTO`
*   **Xử lý:** Do tính chất phức tạp của việc so sánh (nhỡ Frontend xóa đi 1 part hoặc thêm 1 part), cách an toàn nhất trong `@Transactional` là: 
    1. Lấy Exam cũ, cập nhật các trường cơ bản.
    2. Xóa cứng (Hard Delete) toàn bộ `ExamSection` và `ExamPart` cũ của Exam này.
    3. Thêm mới lại toàn bộ `ExamSection` và `ExamPart` từ payload mới.
    *(Cách này đảm bảo tính nhất quán tuyệt đối của JSONB và dữ liệu con, gọi là Replace-All Strategy)*.

## 6. Xử lý Lỗi (Error Handling)
*   Ném `AppException(ErrorCode.EXAM_NOT_FOUND)` nếu gọi PUT vào ID không tồn tại.
*   Ném `AppException(ErrorCode.INVALID_JSON_FORMAT)` nếu parse JSONB thất bại.

---
*Tài liệu này được biên soạn bởi AI Assistant trong quá trình Brainstorming.*
