# TV3-13: Exam review backend — Implementation Plan

**Ngày:** 2026-10-11  
**Trạng thái:** DONE  
**Baseline:** HEAD `adf459c`, branch `feature/TV3-00-contract-audit`.  

## 1. Mục tiêu và kết quả kiểm tra repository

### Mục tiêu

Endpoint `GET /api/v1/attempts/{id}/review/{partId}` trả dữ liệu review bài thi có cấu trúc, bất biến và an toàn:

- Cung cấp dữ liệu review chi tiết cho từng part của bài thi đã nộp/kết thúc (`status != IN_PROGRESS`).
- Bảo toàn tính bất biến (immutability): câu hỏi, options, đáp án đúng (`correct_answer`) và giải thích (`explanation`) được lưu trữ tại thời điểm làm bài và không bị thay đổi nếu đề thi gốc được chỉnh sửa sau này (khắc phục P0 Gap #7 từ `TV3-00`).
- Bảo đảm an toàn tuyệt đối: Không bao giờ để lộ `ai_prompt_context` hoặc các trường nội bộ của hệ thống ở cả không gian làm bài (Workspace) lẫn giao diện review.
- Kiểu dữ liệu chặt chẽ (Typed DTO contract): Thay thế `Map<String, Object>` bằng các DTO có cấu trúc rõ ràng (`ExamReviewResponse`, `ReviewQuestionDto`, `ReviewOptionDto`, `ReviewPartStatsDto`), đồng thời giữ các trường legacy để tương thích ngược.
- Kiểm soát quyền sở hữu và phạm vi: Chỉ chủ sở hữu bài thi mới được xem review; kiểm tra `partId` phải thuộc phạm vi (scope) của bài thi.
- Xử lý tương thích và uyển chuyển (graceful) cho các attempt cũ thiếu dữ liệu giải thích.

### Hiện trạng đã xác minh

| Vị trí | Hiện trạng |
|---|---|
| `GET /api/v1/attempts/{id}/review/{partId}` | Endpoint đã có trong `TestAttemptController`, gọi `testAttemptService.getAttemptReview(id, partId)`. |
| `ExamReviewResponse` | Đang trả `Map<String, Object>` cho `partResult`, `userAnswers` và `examData`. |
| `attempt.getExamSnapshot()` | Hiện được tạo qua `DbExamAdapter.findById()`, trong đó `sanitizeForClient()` đã loại bỏ `correct_answer` và `explanation`. Khiến dữ liệu review sau khi nộp bài bị thiếu giải thích và đáp án đúng. |
| `WorkspaceSnapshotSanitizer` | Đã có sẵn và được kích hoạt trong `toWorkspaceResponse()`, bảo đảm loại bỏ đệ quy các trường nhạy cảm khi trả về workspace. |
| Review Tests | Hiện chưa có test case nào kiểm tra luồng `getAttemptReview()` tại tầng backend. |

### Quyết định đã chốt

1. **Snapshot Persistence:** Bổ sung phương thức `findSnapshotById(examId)` trên `ExamAdapter` (và `DbExamAdapter`), chỉ loại bỏ các trường bí mật hệ thống/AI (`ai_prompt_context`, `ai_feedback`, `grading_key`, `is_correct_flags`, v.v.), nhưng GIỮ LẠI `correct_answer` và `explanation`. Khi tạo attempt, snapshot đầy đủ này được lưu vào `test_attempts.exam_snapshot`.
2. **Workspace Isolation:** Tiếp tục duy trì `WorkspaceSnapshotSanitizer.sanitize(attempt.getExamSnapshot())` tại `toWorkspaceResponse()`, bảo đảm client trong lúc làm bài không bao giờ nhận được `correct_answer` hay `explanation`.
3. **Typed DTO Contract:** Tạo các DTO có cấu trúc kiểu rõ ràng cho review, đồng thời cung cấp các alias/getter legacy (`partResult`, `userAnswers`, `examData`) để giữ tương thích ngược với frontend hiện tại.
4. **Quyền sở hữu & Trạng thái:** Bắt buộc kiểm tra `userId` khớp chủ sở hữu và `status != IN_PROGRESS`. Từ chối các request khi attempt đang làm bài (`400 INVALID_REQUEST`).
5. **Scope validation:** Kiểm tra `partId` thuộc snapshot của attempt. Part ngoài scope trả về `404 RESOURCE_NOT_FOUND`.
6. **Graceful fallback:** Nếu snapshot thiếu `correct_answer` hoặc `explanation` (các attempt cũ), fallback đọc `correct_answer` từ grading keys đã có, và để `explanation = null` thay vì gây lỗi 500.

---

## 2. Danh sách Subtasks

### Subtask TV3-13-01: Typed contract và snapshot persistence
- Thiết kế các DTO kiểu chuẩn cho Review: `ExamReviewResponse`, `ReviewQuestionDto`, `ReviewOptionDto`, `ReviewQuestionGroupDto`, `ReviewPartStatsDto`, `ExamReviewPartDataDto`.
- Bổ sung `findSnapshotById(examId)` trên `ExamAdapter` và `DbExamAdapter`.
- Cập nhật luồng `createAttempt` để lưu snapshot chứa `correct_answer` và `explanation`.
- Đảm bảo `toWorkspaceResponse()` tiếp tục sanitize an toàn qua `WorkspaceSnapshotSanitizer`.
- Viết unit test cho DTOs và snapshot persistence.

### Subtask TV3-13-02: Capture public/private từ cùng phiên bản TV2
- Đảm bảo snapshot lưu trữ cả public content (passages, instructions, questions, inherited options) và private data (correct_answer, alternates, explanation) từ cùng một phiên bản TV2 tại thời điểm tạo attempt.
- Gắn metadata phiên bản TV2 (`updatedAt`) vào snapshot.
- Xử lý kế thừa `options` từ `question_groups` xuống `questions` trong `DbExamAdapter`.
- Xây dựng `SnapshotGradingKeyExtractor` để trích xuất `PartGradingKey` trực tiếp từ snapshot, bảo đảm việc chấm điểm sử dụng đúng keys của cùng phiên bản TV2 đã hiển thị cho thí sinh, độc lập với các thay đổi TV2 trong tương lai. Fallback sang `GradingAdapter` cho các attempt legacy.
- Viết unit test cho việc capture đồng bộ, kế thừa options và trích xuất keys từ snapshot.

### Subtask TV3-13-03: Submit dùng key bất biến
- Hoàn thiện và bảo đảm toàn diện cơ chế Submit dùng key bất biến từ snapshot:
  - Khi submit bài (qua manual submit, auto-submit timeout, scheduler, hoặc inline finalize), hệ thống sử dụng grading keys đã lưu trong `exam_snapshot` của attempt.
  - Độc lập hoàn toàn với việc đề thi gốc ở TV2 bị sửa đáp án hay adapter TV2 gặp lỗi/ngoại lệ.
  - Đảm bảo trích xuất và chấm đúng cho toàn bộ các dạng câu hỏi canonical (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_IN_THE_BLANK`, `TRUE_FALSE_NOT_GIVEN`, `MATCHING_HEADINGS`, v.v.).
  - Kiểm tra tính nhất quán của `AttemptAnswer` (`earnedScore`, `isCorrectFlags`) và `TestAttempt` (`overallScore`, `sectionScores`, `resultSummary`).
  - Duy trì fallback an toàn sang `GradingAdapter` cho các attempt legacy không có snapshot keys.
  - Viết bộ test chuyên sâu bao phủ toàn bộ các kịch bản submit với key bất biến.

### Subtask TV3-13-04: Review service implementation và scope validation
- Cập nhật `TestAttemptServiceImpl.getAttemptReview(attemptId, partId)`:
  - Kiểm tra chủ sở hữu (`userId`).
  - Kiểm tra trạng thái nộp bài (`status != IN_PROGRESS`).
  - Kiểm tra `partId` thuộc scope bài thi (`404 RESOURCE_NOT_FOUND` nếu part ngoài scope).
  - Trả về DTO kiểu chuẩn `ExamReviewResponse` đầy đủ các trường `partStats`, `questions`, `questionGroups`, `examData`, cùng các alias legacy.
  - Xử lý graceful các attempt cũ thiếu dữ liệu giải thích.
- Viết unit test cho review service logic bao phủ các kịch bản lỗi và thành công.

### Subtask TV3-13-05: Controller integration, security regression và bàn giao
- Tích hợp và kiểm thử endpoint `GET /api/v1/attempts/{id}/review/{partId}`.
- Viết integration test (MockMvc / SpringBootTest) kiểm tra:
  - Truy cập trái phép (User khác) -> 403 FORBIDDEN.
  - Truy cập khi chưa nộp bài -> 400 INVALID_REQUEST.
  - Part không thuộc scope -> 404 RESOURCE_NOT_FOUND.
  - Không bao giờ rò rỉ `ai_prompt_context`.
- Chạy toàn bộ test suite backend liên quan đến testing module (`.\mvnw.cmd test`).
- Xác nhận không có hồi quy (regression).
- Cập nhật handoff ledger đầy đủ.

### Subtask TV3-13-06: Historical integration, PostgreSQL và handoff
- Kiểm thử tích hợp toàn diện đầu-cuối (End-to-End Contract IT) với thực thể database thật (`ExamReviewContractIT`):
  - Luồng hoàn chỉnh: Tạo đề canonical -> Tạo attempt -> Autosave câu trả lời -> Submit bài thi -> GET review.
  - Kiểm tra tính bất biến (Immutability): Sửa đổi hoặc xóa đề thi gốc trong database sau khi nộp bài không làm ảnh hưởng đến dữ liệu review được lấy từ snapshot (giải quyết triệt để P0 Gap #7).
  - Kiểm thử attempt lịch sử / legacy: Attempt cũ thiếu `correct_answer` và `explanation` trong snapshot tự động fallback an toàn sang `GradingAdapter` để điền đáp án đúng mà không gây lỗi 500.
  - Kiểm thử fail-closed scope và access control trên database thật.
  - Xác nhận an toàn dữ liệu, chống rò rỉ bí mật nội bộ trên toàn bộ response.
- Kiểm thử lưu trữ và truy xuất JSON trên cơ sở dữ liệu PostgreSQL thực tế (`ExamReviewPostgresIT`):
  - Tự động chạy khi có đủ biến môi trường `TV3_PG_TEST_URL`, `TV3_PG_TEST_USER`, `TV3_PG_TEST_PASSWORD`.
  - Kiểm tra lưu trữ `exam_snapshot` chứa tiếng Việt Unicode, explanation, options và truy xuất qua toán tử JSON native trên PostgreSQL 17.
  - Bỏ qua an toàn (`assumeTrue`) khi môi trường không có PostgreSQL.
- Chạy toàn bộ regression test suite và cập nhật tài liệu bàn giao.


