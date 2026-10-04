# Sprint 06 — API Xem Kết Quả & Review Bài Thi (UC10): Design Spec

**Ngày cập nhật:** 2026-10-04  
**Sprint:** 06 — Test Results & Explanations Architecture (`UC10`, `UC10.1`, `UC10.2`)  
**Phân hệ:** TV3 (Không gian Thi thử, Luyện tập từng phần & TRỢ LÝ AI)  
**Phụ thuộc:** Sprint 04 (Objective Grading Engine), Sprint 05 (Timer & Submission)  
**Nhánh Git:** `feature/UC10-sprint06-test-results`  

---

## 1. Mục Tiêu & Nguyên Tắc Kiến Trúc

### 1.1 Nguyên Tắc Cốt Lõi
1. **Tách biệt Mối quan tâm (Separation of Concerns):**
   - `GET /api/v1/attempts/{id}/result`: Tổng quan điểm số. Phản hồi tức thì.
   - `GET /api/v1/attempts/{id}/review?partId=`: Chi tiết bài thi, đáp án, giải thích. Hỗ trợ tham số `partId`.
   - `GET /api/v1/attempts/{id}/writing-feedback?partId=`: AI Feedback, dữ liệu Diff-View.
2. **Hiệu năng `/result` (Lưu bản tóm tắt tính sẵn):**
   - Cột `exam_snapshot` vô cùng nặng. Không thể dùng nó cho `/result`. Việc dùng Projection lên Entity cũ cũng không đủ dữ liệu (thiếu tên Part, số chữ, trạng thái task).
   - **Giải pháp:** Cần thêm một cột `result_summary` (JSONB) vào bảng `test_attempts` (Cần Migration). Khi chấm điểm xong (Pha 2), ghi toàn bộ cấu trúc điểm tóm tắt vào cột này. Endpoint `/result` chỉ cần đọc cột này qua Projection. (Cột `overall_score` hiện tại chỉ dùng để lưu điểm khách quan).
3. **Cơ chế Thu bài trễ (Lazy Finalize) an toàn:**
   - Thứ tự kiểm tra: (1) Xác thực JWT $\rightarrow$ (2) Kiểm tra quyền sở hữu (nếu sai trả 404) $\rightarrow$ (3) Kiểm tra hạn nộp.
   - **Grace Window:** Chỉ kích hoạt Lazy Finalize nếu `now > deadline + 15s` (để chừa thời gian cho request submit timeout của client bay lên). Nếu `now` nằm trong vùng grace window, không chốt bài trước.
   - Lazy Finalize chạy trong một transaction độc lập, dùng khóa (`SELECT FOR UPDATE`), tránh đụng độ (race condition) khi gọi 2 lệnh GET đồng thời.
4. **Bảo mật & Toàn vẹn Dữ liệu:**
   - Dựng dữ liệu `/review` **100% từ snapshot**, tuyệt đối không JOIN với `exams` hay `exam_parts`.
   - Lọc XSS: Mọi nội dung HTML (`passageHtml`, `explanation`, `translation`) đều được sanitize (lọc cả `onerror`, `javascript:`). Offset `evidence` (`start`, `end`) được tính trên chuỗi HTML **sau khi đã sanitize**.
5. **Chính sách ETag & Cache:**
   - Không băm body vì chứa `timestamp` thay đổi liên tục. ETag phải được tính từ: `hash(attemptId + status + version)`.
   - Phải kiểm tra quyền sở hữu (Auth) trước khi so khớp `If-None-Match`, tránh lộ thông tin qua ETag.

---

## 2. Bảng Danh Mục Enum Chuẩn Hóa

| Tên Enum | Giá trị hợp lệ | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| **AttemptStatus** | `IN_PROGRESS`, `SUBMITTED`, `GRADING_FAILED`, `AI_GRADING`, `AI_GRADING_QUEUED`, `COMPLETED` | Trạng thái vòng đời. (Lưu ý: `EXPIRED` nếu có sẽ được xử lý coi như `SUBMITTED` để kích hoạt chấm điểm). |
| **QuestionStatus** | `CORRECT`, `INCORRECT`, `UNANSWERED`, `ANSWERED` | Trạng thái từng câu hỏi (`ANSWERED` dành riêng cho tự luận Writing). |
| **WritingStatus** | `PENDING`, `GRADING`, `DONE`, `FAILED`, `EMPTY` | Trạng thái xử lý chấm bài Writing. |
| **QuestionType** | `MULTIPLE_CHOICE`, `FILL_IN`, `ESSAY`, `TFNG_YNNG`, `MATCHING`, `LABELING` | Định dạng câu hỏi (Kiểu của `userAnswer` tương ứng là String, Object hoặc Array). |
| **ErrorCode** | `UNAUTHENTICATED`, `ATTEMPT_NOT_FOUND`, `PART_NOT_IN_ATTEMPT`, `ATTEMPT_NOT_SUBMITTED`, `RESULT_NOT_READY`, `GRADING_FAILED` | Mã lỗi nghiệp vụ trả về trong JSON. |

---

## 3. Chi Tiết API Contract

### 3.1 Endpoint 1: `GET /api/v1/attempts/{id}/result` (Tổng quan)
- **Truy xuất:** Lấy trực tiếp từ cột `result_summary` (đã lưu sẵn lúc chấm).
- **Trạng thái bài & Chế độ thi:**
  - `IN_PROGRESS`:
    - `MOCK_TEST` (đã hết `deadline + 15s`): Kích hoạt Lazy Finalize.
    - `MOCK_TEST` (còn hạn hoặc trong grace window) / `PRACTICE`: Trả `409 ATTEMPT_NOT_SUBMITTED`.
  - `SUBMITTED`: Đang chấm khách quan $\rightarrow$ `409 RESULT_NOT_READY` (Header `Retry-After: 2`). Frontend poll tiếp.
  - `GRADING_FAILED`: Lỗi hệ thống khi chấm $\rightarrow$ `503 GRADING_FAILED` (Không có `Retry-After`). Frontend dừng poll.
  - `AI_GRADING_QUEUED` / `AI_GRADING`: Trả HTTP `200` (`Cache-Control: no-store`).
  - `COMPLETED`: Trả HTTP `200` (`Cache-Control: private, max-age=3600`, có `ETag`).
- **Ràng buộc toán học:**
  - `correct + incorrect + unanswered == total` (cho từng dòng `byPart` và `bySkill`).

**Mẫu Response 200 OK:**
```json
{
  "success": true,
  "code": 200,
  "errorCode": "SUCCESS",
  "message": "Success",
  "data": {
    "attemptId": 86,
    "examId": 12,
    "status": "AI_GRADING",
    "startedAt": "2026-10-04T08:00:00Z",
    "endedAt": "2026-10-04T10:58:41Z",
    "objective": {
      "scoreUnit": "RAW_CORRECT",
      "correct": 5, "incorrect": 1, "unanswered": 1, "total": 7, "accuracy": 0.714,
      "bySkill": [
        { "skill": "READING", "correct": 4, "incorrect": 1, "unanswered": 0, "total": 5, "accuracy": 0.8 },
        { "skill": "LISTENING", "correct": 1, "incorrect": 0, "unanswered": 1, "total": 2, "accuracy": 0.5 }
      ],
      "byPart": [
        { "partId": 101, "label": "Reading Part 1", "skill": "READING", "correct": 2, "incorrect": 0, "unanswered": 0, "total": 2 },
        { "partId": 102, "label": "Reading Part 2", "skill": "READING", "correct": 2, "incorrect": 1, "unanswered": 0, "total": 3 },
        { "partId": 104, "label": "Listening Part 1", "skill": "LISTENING", "correct": 1, "incorrect": 0, "unanswered": 1, "total": 2 }
      ]
    },
    "writing": {
      "status": "GRADING",
      "tasks": [
        { "partId": 201, "label": "Writing Task 1", "status": "GRADING", "wordCount": 132, "score": null, "maxScore": 9 },
        { "partId": 202, "label": "Writing Task 2", "status": "EMPTY", "wordCount": 0, "score": null, "maxScore": 9 }
      ]
    }
  },
  "timestamp": "2026-10-04T11:00:00Z"
}
```

---

### 3.2 Endpoint 2: `GET /api/v1/attempts/{id}/review?partId=` (Chi tiết)
- **Tham số:** `partId` (tùy chọn).
- `userAnswer` và `correctAnswer` hỗ trợ đa kiểu dữ liệu (String, Array, Object) tương ứng với định dạng `QuestionType`.
- **Nội dung thuần túy (Plain Text):** `userAnswer` của Writing và `comment` của AI là text thuần, không chứa HTML.
- Mẫu câu hỏi (giữ nguyên cấu trúc đã chốt ở thiết kế trước, chú ý đa hình đáp án).

---

### 3.3 Endpoint 3: `GET /api/v1/attempts/{id}/writing-feedback?partId=`
- Các trạng thái hợp đồng:
  - **PENDING**: Đã tạo job, đang đợi chạy.
  - **GRADING**: AI đang xử lý.
  - **DONE**: Chấm hoàn tất, có `criteria` và text.
  - **FAILED**: Gặp lỗi. Cung cấp `retryAvailable`, `retryAfterSeconds` (tham chiếu: gọi `POST /api/v1/attempts/{id}/writing-retry`), dùng trường `displayMessage` để tránh trùng lặp.
  - **EMPTY**: Thí sinh nộp khoảng trắng, không chấm.

**Mẫu PENDING / GRADING:**
```json
{
  "success": true, "code": 200, "errorCode": "SUCCESS", "message": "Success",
  "data": {
    "attemptId": 86, "partId": 201, "status": "PENDING",
    "overall": null, "maxScore": 9.0, "criteria": [],
    "originalText": "...", "revisedText": null
  },
  "timestamp": "2026-10-04T11:00:10Z"
}
```

**Mẫu FAILED:**
```json
{
  "success": true, "code": 200, "errorCode": "SUCCESS", "message": "Success",
  "data": {
    "attemptId": 86, "partId": 201, "status": "FAILED",
    "retryAvailable": true, "retryAfterSeconds": 30,
    "displayMessage": "Lỗi kết nối AI. Vui lòng thử lại sau.",
    "overall": null, "criteria": [], "originalText": "..."
  },
  "timestamp": "2026-10-04T11:00:10Z"
}
```

---

## 4. Format Lỗi Chuẩn Hóa
```json
{
  "success": false,
  "code": 409,
  "errorCode": "ATTEMPT_NOT_SUBMITTED",
  "message": "Bài thi chưa được nộp.",
  "data": null,
  "timestamp": "2026-10-04T08:30:00Z"
}
```
