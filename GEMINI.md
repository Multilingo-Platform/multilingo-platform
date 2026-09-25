# ⚡ Multilingo Platform - Architecture & Superpowers Rules

## 1. Phương pháp luận phát triển (Superpowers)
- **Feature mới:** Bắt buộc dùng `brainstorming` đối soát tài liệu trong `docs/DacTa/`. Nếu tính năng **chưa có đặc tả**, BẮT BUỘC viết Spec tại `docs/superpowers/specs/<tên-tính-năng>.md` và được duyệt trước khi lập kế hoạch.
- **Kế hoạch:** Bắt buộc dùng `writing-plans` chia nhỏ task vào `docs/superpowers/plans/` (mỗi task 2–5 phút).
- **Triển khai:** Bắt buộc tuân thủ `test-driven-development` (TDD: Red-Green-Refactor).
- **Hoàn thành:** Bắt buộc chạy `mvn clean test` và chứng minh log PASS (`verification-before-completion`).
- **Git Workflow:** Bắt buộc dùng `git rebase develop` đồng bộ nhánh; chỉ dùng `git push --force-with-lease` trên nhánh cá nhân.

## 2. Tiêu chuẩn kiến trúc Base (Backend)
- Mọi Entity kế thừa `BaseEntity` (Primary key là `INT / Integer`, tự tăng `GenerationType.IDENTITY`).
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Ném lỗi nghiệp vụ qua `AppException(ErrorCode.XYZ)` và xử lý tập trung tại `GlobalExceptionHandler`.

