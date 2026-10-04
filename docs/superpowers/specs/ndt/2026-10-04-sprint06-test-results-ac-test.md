# Tiêu Chí Nghiệm Thu & Ma Trận Test Cases (UC10 - Test Results)

**Ngày cập nhật:** 2026-10-04  
**Phân hệ:** TV3 (Không gian Thi thử, Luyện tập từng phần & TRỢ LÝ AI)  
**Tài liệu thiết kế:** [2026-10-04-sprint06-test-results-design.md](file:///d:/Project/University/multilingo-platform/docs/superpowers/specs/ndt/2026-10-04-sprint06-test-results-design.md)  

---

## 1. Acceptance Criteria (Gherkin & Business Rules Checklist)

### 1.1 Yêu cầu lấy tổng quan kết quả (`GET /result`)
```gherkin
Given Học viên đã đăng nhập và là chủ sở hữu bài thi (attemptId)
And Bài thi đã được chốt (status là COMPLETED, AI_GRADING, hoặc AI_GRADING_QUEUED)
When Học viên gửi request GET `/api/v1/attempts/{id}/result`
Then Hệ thống chỉ đọc cột `result_summary` đã được lưu tĩnh lúc chấm (không đọc exam_snapshot)
And Xác định trạng thái phần Writing:
    - Tra cứu trạng thái từ bảng WritingGradingJob (PENDING, GRADING, DONE, FAILED)
    - Nếu task bài viết trống (chỉ chứa khoảng trắng) -> trạng thái là EMPTY
And Trả về HTTP 200 OK
And Nếu trạng thái ổn định (COMPLETED): Cache-Control: private, max-age=3600, kèm ETag
And Nếu trạng thái chưa ổn định (AI_GRADING...): Cache-Control: no-store
```

### 1.2 Yêu cầu xem chi tiết lời giải (`GET /review`)
```gherkin
Given Học viên là chủ sở hữu bài thi đã nộp
When Học viên gửi request GET `/api/v1/attempts/{id}/review`
Then Hệ thống tải exam_snapshot từ test_attempts
And Tuyệt đối KHÔNG JOIN với các bảng exams hay exam_parts gốc
And Trả về HTTP 200 kèm ETag (tính theo hash của attemptId + status + snapshotVersion)
```

### 1.3 Cơ chế Thu bài trễ khi xem kết quả (Lazy Finalize)
```gherkin
Given Bài thi MOCK_TEST đang IN_PROGRESS
And Thời gian hiện tại now > deadline + 15s (đã qua Grace Window)
When Học viên gọi GET `/api/v1/attempts/{id}/result` hoặc `/review`
Then Hệ thống khóa dòng dữ liệu trong transaction độc lập (SELECT FOR UPDATE)
And Kích hoạt Lazy Finalize (chốt trạng thái SUBMITTED, reason = TIMEOUT_SERVER)
And Trả về 409 RESULT_NOT_READY (nếu đang chấm) hoặc 200 OK (nếu chấm xong nhanh)
```

### 1.4 Checklist Quy Tắc Nghiệp Vụ
- [ ] Lọc XSS (`onerror`, `javascript:`, `<script>`) cho toàn bộ `passageHtml`, `explanation`.
- [ ] Offset của `evidence` trỏ đúng vào vị trí trên chuỗi HTML **sau khi đã sanitize**.
- [ ] Trạng thái lỗi 503 `GRADING_FAILED` không kèm `Retry-After`. Frontend ngừng poll.
- [ ] Practice Mode: Trả 409 `ATTEMPT_NOT_SUBMITTED` cho đến khi nộp bài chủ động (vì không có deadline).
- [ ] Bất kỳ request `If-None-Match` nào cũng phải kiểm tra quyền sở hữu bài thi trước khi trả 304 để tránh lộ lọt ETag.
- [ ] Đáp án đa dạng kiểu dữ liệu: String (`MULTIPLE_CHOICE`, `FILL_IN`), Mảng (`MULTI_SELECT`), Object (`MATCHING`).

---

## 2. Ma Trận Test Cases Chuẩn Hóa

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Đầu vào / Hành động | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_UC10_RES_01** | Happy Path | Lấy summary bài thi đã `COMPLETED` | Attempt hợp lệ, `COMPLETED` | `GET /result` | HTTP 200. JSON đủ điểm objective. Cache bật. |
| **TC_UC10_REV_04** | Happy Path | Lấy chi tiết review toàn bộ | Attempt hợp lệ, `COMPLETED` | `GET /review` | HTTP 200. Mảng `parts` chứa đủ. |
| **TC_UC10_SEC_06** | Security | IDOR: Attempt của user khác | User A đăng nhập, gọi Attempt của B | `GET /result` | HTTP 404 `ATTEMPT_NOT_FOUND` (tránh dò ID). |
| **TC_UC10_AI_09** | Happy Path | Lấy AI Feedback đã `DONE` | Task Writing chấm xong | `GET /writing-feedback?partId=201` | HTTP 200, status=`DONE`, có rubric, `displayMessage`. |
| **TC_UC10_ERR_14** | Negative | `attemptId` không tồn tại | Attempt ID 999999 | `GET /result` | HTTP 404 `ATTEMPT_NOT_FOUND`. |
| **TC_UC10_INT_15** | Toàn vẹn | Sửa đề thi gốc trong CMS sau khi nộp | Đề gốc bị Admin sửa đáp án | `GET /review` | Nội dung và đáp án chuẩn vẫn là bản snapshot cũ. |
| **TC_UC10_INT_16** | Toàn vẹn | Toán học: `sum(byPart) == objective` | Attempt có nhiều Parts | `GET /result` | `correct + incorrect + unanswered == total` ở từng dòng. |
| **TC_UC10_SEC_17** | Security | Đề bài chứa XSS `<script>` | Đề chứa tag `<script>` | `GET /review` | Đã bị lọc an toàn trong response. |
| **TC_UC10_SEC_26** | Security | User B gọi `/result` trên attempt quá hạn của A | Attempt của A đã quá hạn nộp | User B gọi `GET /result` | HTTP 404. Lệnh gọi của B KHÔNG làm attempt của A bị finalize. |
| **TC_UC10_EDGE_27** | Edge Case | `now` nằm trong vùng Grace Window | `deadline < now < deadline + 15s` | `GET /result` | Kích hoạt `409 ATTEMPT_NOT_SUBMITTED`, KHÔNG finalize sớm. |
| **TC_UC10_CONC_28** | Đồng thời | 2 GET đồng thời trên bài quá hạn | Attempt quá hạn, chưa finalize | 2 luồng gọi `GET /result` | 1 luồng chốt bài, luồng kia đợi. Không lỗi ghi đè. |
| **TC_UC10_STATE_29** | Trạng thái | `/result` khi `GRADING_FAILED` | Attempt status=`GRADING_FAILED` | `GET /result` | HTTP 503 `GRADING_FAILED`, không có `Retry-After`. |
| **TC_UC10_STATE_30** | Trạng thái | `/result` khi `AI_GRADING_QUEUED` | Attempt status=`AI_GRADING_QUEUED`| `GET /result` | HTTP 200, header `Cache-Control: no-store`. |
| **TC_UC10_CACHE_31** | Caching | Gọi `/review` lần 2 (khác timestamp) | Lần 1 lưu ETag | `GET /review` kèm `If-None-Match` | ETag tính từ hash, khớp -> trả HTTP 304. |
| **TC_UC10_CACHE_32** | Caching | Lấy ETag đúng nhưng gọi attempt user khác | User A lấy ETag của User B | `GET /review` kèm `If-None-Match` | HTTP 404 (Auth check fail trước khi check Cache). |
| **TC_UC10_ERR_33** | Negative | `/writing-feedback` với partId trắc nghiệm | `partId` trắc nghiệm | `GET /writing-feedback` | HTTP 404 `PART_NOT_IN_ATTEMPT` (hoặc 400). |
| **TC_UC10_SEC_34** | Security | Lấy Writing khi bài còn `IN_PROGRESS` | Bài chưa nộp | `GET /writing-feedback` | HTTP 409 `ATTEMPT_NOT_SUBMITTED`. |
| **TC_UC10_EDGE_35** | Edge Case | Writing chỉ chứa khoảng trắng/xuống dòng | `userAnswer = "   \n  "` | `GET /writing-feedback` | Trạng thái tự chuyển `EMPTY`, không gọi AI. |
| **TC_UC10_MODE_36** | Edge Case | Mode `PRACTICE` | Attempt đang `IN_PROGRESS` | `GET /result` | Trả 409, không tự động finalize vì không có deadline. |
| **TC_UC10_INT_37** | Toàn vẹn | `evidence` start/end | Chuỗi có HTML tags độc hại | `GET /review` | Offset của `evidence` trỏ chuẩn xác vào đoạn đã lọc XSS. |
| **TC_UC10_SEC_38** | Security | `onerror` hoặc `javascript:` | HTML chứa thuộc tính XSS | `GET /review` | Các thuộc tính này bị xóa trắng khỏi response. |
