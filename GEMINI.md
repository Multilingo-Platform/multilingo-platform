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

## 4. Hướng dẫn kích hoạt Skill (Skill Triggers)

| Nhóm | Tên Skill | Khi nào cần gọi (Trigger Condition) |
| :--- | :--- | :--- |
| **UI/UX & Design** | `ui-ux-pro-max` | Bắt đầu thiết kế màn hình mới, cần tư vấn layout, phong cách thẩm mỹ, bảng màu và font chữ chuẩn UX. |
| | `ui-styling` | Viết code component giao diện (CSS / Tailwind / shadcn/ui), tinh chỉnh Responsive đa màn hình, làm Dark Mode. |
| | `design-system` | Khởi tạo / quy chuẩn Design Tokens (biến CSS màu sắc, typography, spacing, radius) dùng chung toàn app. |
| | `banner-design` | Thiết kế Banner quảng bá, Hero Section trang chủ hoặc hình ảnh quảng bá sự kiện. |
| | `design` | Tạo bộ Icon SVG vector (cúp danh hiệu, ngọn lửa streak, badge...), thiết kế logo hoặc mockup sản phẩm. |
| | `brand` | Định hình văn phong (Tone of Voice), viết câu thông báo UI (chúc mừng, khích lệ khi làm đúng/sai bài tập). |
| | `slides` | Tạo bài trình chiếu thuyết trình đồ án / báo cáo tiến độ dạng HTML & Chart.js tương tác. |
| **Phát triển Tính năng** | `multilingo-feature-development` | Bắt đầu luồng phát triển tính năng mới từ A–Z theo chuẩn Multilingo Platform. |
| | `brainstorming` | Khám phá yêu cầu, thảo luận ý tưởng, đối soát tài liệu `docs/DacTa/` và viết Spec. |
| | `multilingo-crud-generator` | Cần sinh nhanh bộ mã CRUD đầy đủ chuẩn kiến trúc (Entity, DTO, Repository, Service, Controller, Tests). |
| | `test-driven-development` | Viết code tính năng hoặc fix bug theo chu trình TDD (Red -> Green -> Refactor). |
| **Chất lượng & Quy trình** | `acceptance-criteria-and-test-design` | Chuẩn hóa Scope, AC (Gherkin), Ma trận kiểm thử 6 khía cạnh và Bảng Test Cases 7 cột trước khi lập plan. |
| | `writing-plans` | Chia nhỏ công việc thành các bước thực thi cụ thể (2–5 phút/task) sau khi đã có Spec và AC. |
| | `systematic-debugging` / `multilingo-debugging` | Gặp lỗi runtime, test failure hoặc hành vi bất thường cần truy tìm nguyên nhân gốc rễ. |
| | `requesting-code-review` / `receiving-code-review` | Hoàn thành một task lớn, cần rà soát lại chất lượng mã nguồn hoặc xử lý feedback review. |
| | `verification-before-completion` | Trước khi tuyên bố hoàn thành task, nghiệm thu kết quả và xác nhận `mvn clean test` PASS. |
