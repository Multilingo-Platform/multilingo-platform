# Đặc tả và Tiêu chí nghiệm thu: Quản lý Gói cước (Premium Packages)

## 1. Mục tiêu & Bối cảnh
Tính năng này cho phép **Admin** có thể xem, thêm mới, sửa, và thay đổi trạng thái (Kích hoạt/Vô hiệu hóa) các Gói cước Premium. Các gói cước này sau đó sẽ được hiển thị trên trang "Nâng cấp tài khoản" cho User thông thường mua.

## 2. Actor & Điều kiện tiên quyết
- **Actor:** Admin
- **Điều kiện tiên quyết:** Admin đã đăng nhập và được xác thực với `RoleName.ADMIN`.

## 3. Thiết kế Database (Bảng `subscription_plans`)
- `id` (INT, PK, Auto Increment, kế thừa BaseEntity)
- `code` (VARCHAR(50), UNIQUE): Mã gói (VD: "PREMIUM_1M", "PREMIUM_1Y")
- `name` (VARCHAR(100)): Tên gói cước (VD: "Gói Premium 1 Tháng")
- `price` (DECIMAL): Giá tiền (VD: 99000)
- `duration_days` (INT): Thời hạn tính bằng ngày (VD: 30, 365)
- `is_active` (BOOLEAN): Trạng thái (Đang bán / Ngừng bán)
- `created_at`, `updated_at` (TIMESTAMP, từ BaseEntity)

## 4. Acceptance Criteria (AC)

### AC1: Xem danh sách gói cước
- **Given** Admin truy cập trang `/admin/premium`
- **When** Hệ thống tải dữ liệu
- **Then** Hiển thị danh sách các gói cước dưới dạng bảng (Table) bao gồm: Mã gói, Tên, Giá, Thời hạn (ngày), Trạng thái hoạt động.

### AC2: Thêm mới gói cước
- **Given** Admin nhấn "Thêm gói cước mới"
- **When** Admin điền hợp lệ các thông tin (Mã gói, Tên, Giá > 0, Thời hạn > 0) và nhấn "Lưu"
- **Then** Gói cước được lưu vào DB và hiển thị trên danh sách. (Trạng thái mặc định là Active).

### AC3: Validate thông tin gói cước (Negative)
- **Given** Admin đang thêm/sửa gói cước
- **When** Admin để trống tên/mã, hoặc nhập giá < 0, hoặc thời hạn < 1, hoặc trùng mã code
- **Then** Hệ thống báo lỗi Validation, không lưu vào DB.

### AC4: Cập nhật thông tin gói cước
- **Given** Admin chọn một gói cước có sẵn để chỉnh sửa
- **When** Admin thay đổi thông tin (Tên, Giá, Số ngày...) và nhấn "Lưu"
- **Then** Thông tin được cập nhật thành công. (Lưu ý: Không cho phép đổi Mã gói - code).

### AC5: Thay đổi trạng thái (Activate / Deactivate)
- **Given** Gói cước đang ở trạng thái Active
- **When** Admin chọn hành động "Ngừng bán" (Deactivate)
- **Then** Gói cước chuyển sang trạng thái Inactive, không được phép xóa hoàn toàn khỏi DB (Soft-delete/Deactivate) để tránh mất dữ liệu liên kết đến lịch sử thanh toán cũ.

## 5. Thiết kế UI (Frontend)
- **Bố cục:** Bảng danh sách các gói cước.
- **Thao tác:** Nút "Thêm mới" mở ra một Dialog/Modal form nhập thông tin. Các nút sửa/đổi trạng thái nằm ở cột "Hành động" của bảng.
