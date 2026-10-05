# Plan: Khởi tạo Sprint 06 - Lazy Finalize & DB Migration (UC10)

**Nhánh:** `feature/UC10-sprint06-test-results`
**Dựa trên:** `docs/superpowers/specs/ndt/2026-10-04-sprint06-test-results-design.md`

## 1. Mục tiêu
- Thêm cột `result_summary` (JSONB) vào `test_attempts` để lưu tóm tắt điểm, phục vụ API `/result` tải nhanh.
- Xây dựng cơ chế "Lazy Finalize" (Thu bài trễ an toàn) cho `TestAttemptServiceImpl`: tự động chấm và khóa bài (những bài quá hạn + 15s) ngay khi user fetch `/result` hoặc `/review` mà bài chưa đóng.

## 2. Các bước thực hiện

### Bước 1: Database Migration (Flyway)
1. Tạo file `backend/src/main/resources/db/migration/V4__add_result_summary_to_attempts.sql`.
2. Nội dung: `ALTER TABLE test_attempts ADD COLUMN result_summary JSONB;`

### Bước 2: Cập nhật Entity `TestAttempt`
1. Mở `TestAttempt.java`.
2. Bổ sung trường `private String resultSummary;` (với `@JdbcTypeCode(SqlTypes.JSON)`).

### Bước 3: Cập nhật `TestAttemptServiceImpl` (Lazy Finalize)
1. Mở `TestAttemptServiceImpl.java`.
2. Tạo hàm `private void ensureFinalized(TestAttempt attempt)`:
   - Kiểm tra `attempt.getStatus() == IN_PROGRESS`.
   - Nếu `now() > attempt.getDeadline().plusSeconds(15)`, tự động chuyển status sang `SUBMITTED`, tính điểm (sử dụng logic chấm có sẵn), cập nhật `overall_score`, tạo JSON `result_summary` và save.
   - Hàm này nên chạy trong một Transaction độc lập (cần `@Transactional(propagation = Propagation.REQUIRES_NEW)` ở một helper hoặc trực tiếp).

### Bước 4: Tạo Test cho Lazy Finalize
1. Mở `TestAttemptServiceTest.java`.
2. Viết test case `should_LazyFinalize_When_FetchingExpiredAttempt`:
   - Tạo một attempt có deadline ở quá khứ.
   - Gọi `ensureFinalized` (hoặc thông qua một API).
   - Kiểm tra status đã chuyển thành `SUBMITTED` và điểm được cập nhật.

## 3. Xác minh
- Chạy `mvn clean test` qua 100%.
- Kiểm tra DB script bằng cách start app xem có lỗi migrate không.
