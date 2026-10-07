# Kế hoạch triển khai: Quản lý Gói cước (Premium Packages)

**Tài liệu tham chiếu:** [Spec & AC](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/superpowers/specs/2026-10-06-premium-packages-management.md)

## Tóm tắt Test Cases & Test Design
| Mã TC | Happy/Negative | Kịch bản |
| :--- | :--- | :--- |
| `TC_PKG_CREATE_01` | Happy | Thêm mới gói cước hợp lệ -> Tạo thành công, lưu DB. |
| `TC_PKG_CREATE_02` | Negative | Thêm mới gói cước giá < 0 -> Báo lỗi Validation. |
| `TC_PKG_CREATE_03` | Negative | Thêm mới gói cước tên rỗng -> Báo lỗi Validation. |
| `TC_PKG_UPDATE_01` | Happy | Chỉnh sửa tên, giá hợp lệ -> Cập nhật thành công. |
| `TC_PKG_STATUS_01` | Happy | Chuyển trạng thái sang Inactive -> Cập nhật thành công, user không mua được nữa. |
| `TC_PKG_GET_01` | Happy | Lấy danh sách gói cước -> Trả về danh sách đầy đủ. |

## Các bước thực thi (Tasks 2-5 phút)

### Giai đoạn 1: Backend - Khởi tạo Base và TDD (30 phút)
- [ ] **Task 1.1:** (Bỏ qua việc tạo bảng do đã có bảng `subscription_plans`). Tạo các DTO: `SubscriptionPlanRequest` (code, name, price, durationDays), `SubscriptionPlanResponse`. Thêm validation.
- [ ] **Task 1.2:** Sửa `SubscriptionPlanRepository` và tạo `SubscriptionPlanService` interface nếu chưa có.
- [ ] **Task 1.3:** Viết Test `SubscriptionPlanServiceTest` (TC_PKG_CREATE, TC_PKG_UPDATE, TC_PKG_STATUS, TC_PKG_GET).
- [ ] **Task 1.4:** Implement `SubscriptionPlanServiceImpl` để cho Test PASS.
- [ ] **Task 1.5:** Tạo `SubscriptionPlanController` với các endpoints: `GET /api/admin/plans`, `POST /api/admin/plans`, `PUT /api/admin/plans/{id}`, `PATCH /api/admin/plans/{id}/status`. Chạy test toàn hệ thống `mvn clean test`.

### Giai đoạn 2: Frontend - Tích hợp API và UI (30 phút)
- [ ] **Task 2.1:** Thêm các hàm gọi API cho gói cước vào thư mục `features/admin/api/packageApi.ts` (GET, POST, PUT, PATCH). Thêm interface types.
- [ ] **Task 2.2:** Xây dựng trang `/admin/premium` (`AdminPremiumPage.tsx`) hiển thị danh sách dạng Table.
- [ ] **Task 2.3:** Xây dựng Component Modal form `PackageFormModal.tsx` dùng chung cho Thêm mới và Chỉnh sửa (react-hook-form + validation).
- [ ] **Task 2.4:** Ghép nối `useQuery` và `useMutation` để lấy danh sách, xử lý thêm mới, chỉnh sửa, đổi trạng thái. Đảm bảo UI cập nhật ngay sau khi thao tác.

### Giai đoạn 3: Nghiệm thu (10 phút)
- [ ] **Task 3.1:** Chạy backend lên, test thử màn hình Admin bằng trình duyệt thực tế.
- [ ] **Task 3.2:** Chạy `npm run lint` và `npm run build` trên Frontend. Đảm bảo 0 errors.
