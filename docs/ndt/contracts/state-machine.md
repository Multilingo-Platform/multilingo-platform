# Đặc tả State Machine & Quy tắc Nghiệp vụ Phiên Làm Bài (Test Attempt)

**Tài liệu:** Contract nội bộ Module TV3 (Không gian Thi thử, Luyện tập & Trợ lý AI)  
**Phạm vi:** UC08 (Thi thử), UC09 (Luyện tập), UC10 (Kết quả & AI Grading)  
**Tham chiếu:** [`impl-milestone00-sprint00.md`](file:///d:/Project/University/multilingo-platform/docs/ndt/impl-milestone00-sprint00.md)

---

## 1. Vòng đời Trạng thái Phiên làm bài (Attempt Lifecycle)

### 1.1 Sơ đồ chuyển trạng thái

```
               [Khởi tạo phiên: POST /api/attempts]
                               │
                               ▼
                       ┌──────────────┐
                       │ IN_PROGRESS  │◄──────┐ (Autosave draft:
                       └──────┬───────┘       │  PATCH /api/attempts/{id}/draft)
                              │               │
        ┌─────────────────────┴───────────────────────┐
        │                                             │
        ▼ (Hết giờ / Bấm Nộp)                         ▼ (Hết giờ / Bấm Nộp)
  [Đề KHÔNG có Writing]                        [Đề CÓ Writing]
        │                                             │
        ▼                                             ▼
 ┌──────────────┐                             ┌──────────────┐
 │  COMPLETED   │                             │  AI_GRADING  │
 └──────────────┘                             └──────┬───────┘
                                                     │ (AI chấm xong / FAILED)
                                                     ▼
                                              ┌──────────────┐
                                              │  COMPLETED   │
                                              └──────────────┘
```

### 1.2 Bảng giải thích trạng thái

| Trạng thái | Điều kiện kích hoạt | Hành vi cho phép | Hành vi bị cấm |
|---|---|---|---|
| `IN_PROGRESS` | Thí sinh bắt đầu bài thi hoặc bài luyện tập | - Đọc workspace<br>- Autosave draft câu trả lời<br>- Yêu cầu gợi ý AI (chỉ mode PRACTICE) | - Xem đáp án đúng / giải thích<br>- Xem điểm số |
| `AI_GRADING` | Thí sinh nộp bài và bài thi có phần thi Tự luận / Viết (Writing) | - Chấm điểm câu khách quan (Listening/Reading) ngay lập tức<br>- Gửi bài viết sang hàng đợi chấm AI ngầm | - Sửa câu trả lời<br>- Nộp lại |
| `COMPLETED` | - Bài thi khách quan đã chấm xong<br>- Hoặc bài thi có Writing đã hoàn tất chấm AI | - Xem kết quả tổng quan<br>- Xem phân tích từng kỹ năng<br>- Xem giải thích chi tiết từng câu | - Mọi thao tác sửa đổi dữ liệu phiên thi |

---

## 2. Quy tắc Timer & Tính Thời gian Hết hạn (`deadline`)

Thời gian được chuẩn hóa **UTC ISO-8601** theo quy chuẩn toàn hệ thống (`BackendApplication.java`).

### 2.1 Ma trận xác định `deadline`

| Phạm vi (`test_scope`) | Chế độ (`test_mode`) | Có `deadline`? | Công thức tính `deadline` |
|---|---|---|---|
| `FULL_EXAM` | `MOCK_TEST` | **CÓ** | `startTime + SUM(ExamSection.durationMinutes)` |
| `SINGLE_SKILL` | `MOCK_TEST` | **CÓ** | `startTime + ExamSection.durationMinutes` |
| `SINGLE_PART` | `MOCK_TEST` | **CÓ** | `startTime + ExamSection.durationMinutes` (thuộc section chứa part) |
| Bất kỳ (`FULL_EXAM` / `SINGLE_SKILL` / `SINGLE_PART`) | `PRACTICE` | **KHÔNG** | `deadline = null` (Đồng hồ bấm giờ tăng dần, không ép nộp bài) |

### 2.2 Xử lý Hết giờ (Grace Period & Auto-Submit)

- Client chủ động đếm ngược. Khi `timeRemaining <= 0`, client tự động gửi request `POST /api/attempts/{id}/submit`.
- **Grace Period (Thời gian ân hạn phía Server):** Server cho phép độ trễ mạng tối đa **30 giây** quá `deadline`:
  - Nếu `now <= deadline + 30s`: Chấp nhận nộp bài bình thường.
  - Nếu `now > deadline + 30s`: Server tự động chốt bài với dữ liệu draft gần nhất đã lưu và đánh dấu kết thúc bài thi.
- Nếu client mất kết nối và không gửi submit, request GET workspace hoặc request tiếp theo quá hạn sẽ tự động kích hoạt chốt phiên sang `COMPLETED` / `AI_GRADING`.

---

## 3. Quy tắc Tính điểm (Scoring Rules)

1. **Điểm câu hỏi khách quan:**
   - Điểm số thô = `correct_count / total_count`.
   - Mỗi câu trắc nghiệm/điền từ có trọng số bằng nhau (1 điểm mỗi câu).
   - Câu làm đúng: cộng 1 điểm; Câu làm sai hoặc bỏ trống: 0 điểm.

2. **Quy tắc với phần thi Viết (Writing):**
   - Điểm Writing **KHÔNG** cộng dồn trực tiếp vào điểm câu hỏi khách quan (để tránh sai lệch thang đo năng lực).
   - Điểm Writing được lưu trữ độc lập trong `aiFeedback` theo các tiêu chí (Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Accuracy).

3. **Quy tắc thang điểm IELTS/TOEIC:**
   - Theo định hướng kiến trúc, TV3 **KHÔNG tự ý quy đổi điểm thô sang Band Score IELTS/TOEIC** ở giai đoạn này.
   - Trả về dữ liệu thô: `correct_count`, `total_count`, `accuracy_percent` cho từng kỹ năng (`READING`, `LISTENING`).

---

## 4. Cơ chế Chống Xung đột Draft (Optimistic Locking)

- Mỗi phiên thi có trường `version` (bắt đầu từ `1`).
- Khi client gửi draft qua `PATCH /api/attempts/{id}/draft`, client phải gửi kèm `version` hiện tại.
- Nếu `request.version != attempt.version`: Trả về lỗi `VERSION_CONFLICT` (HTTP 409).
- Sau mỗi lần lưu draft thành công, `version` tăng thêm 1 và trả về cho client.
