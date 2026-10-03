# ⚡ Multilingo Platform - Architecture & Superpowers Rules

## 1. Phương pháp luận phát triển (Superpowers)
- **Feature mới:** Bắt buộc dùng `brainstorming` đối soát tài liệu trong `docs/DacTa/`. Nếu tính năng **chưa có đặc tả**, BẮT BUỘC viết Spec tại `docs/superpowers/specs/<tên-tính-năng>.md` và được duyệt trước khi lập kế hoạch.
- **Tiêu chí nghiệm thu & Test Design:** Dùng `acceptance-criteria-and-test-design` chuẩn hóa đầy đủ quy trình 4 bước: (1) Scope & Actors, (2) AC (Gherkin + Business Rules Checklist), (3) Ma trận kiểm thử 6 khía cạnh (Happy, Negative, Boundary, Edge cases, Security, UI/UX), (4) Bảng Test Cases chuẩn hóa 7 cột (`TC_[MODULE]_[ACTION]_[STT]`) trước khi lập kế hoạch.
- **Kế hoạch:** Bắt buộc dùng `writing-plans` chia nhỏ task vào `docs/superpowers/plans/` (mỗi task 2–5 phút) dựa trên AC và Test Cases đã thiết kế.
- **Triển khai:** Bắt buộc tuân thủ `test-driven-development` (TDD: Red-Green-Refactor).
- **Kiểm duyệt trước khi Commit:** BẮT BUỘC hiển thị tóm tắt diff / thay đổi và xin xác nhận của người dùng trước khi thực hiện `git commit`. Tuyệt đối không tự động commit khi người dùng chưa kiểm tra và phê duyệt.
- **Hoàn thành:** Bắt buộc chạy `mvn clean test` và chứng minh log PASS (`verification-before-completion`).
- **Git Workflow:** Bắt buộc dùng `git rebase develop` đồng bộ nhánh; chỉ dùng `git push --force-with-lease` trên nhánh cá nhân.

## 2. Tiêu chuẩn kiến trúc Base (Backend)
- Mọi Entity kế thừa `BaseEntity` (Primary key là `INT / Integer`, tự tăng `GenerationType.IDENTITY`).
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Ném lỗi nghiệp vụ qua `AppException(ErrorCode.XYZ)` và xử lý tập trung tại `GlobalExceptionHandler`.

## 3. Tiêu chuẩn kiến trúc Frontend (Feature-based)
- Bắt buộc áp dụng Feature-based Architecture (Feature-Sliced Design).
- Giao diện, API, logic và Redux slice của tính năng nào phải nằm gọn trong thư mục `features/<tên-tính-năng>/`.
- Thư mục `components` ở gốc chỉ dành cho UI components tái sử dụng chung.
