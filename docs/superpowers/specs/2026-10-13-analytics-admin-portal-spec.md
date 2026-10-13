# Đặc Tả Kỹ Thuật & Tiêu Chí Nghiệm Thu: Phân Hệ Quản Trị & Giám Sát (Analytics & Admin Portal)

> **Tài liệu tham chiếu:** [`docs/lxt/srs.md`](file:///d:/Project/MyProject/multilingo-platform/docs/lxt/srs.md)  
> **Module phụ trách:** `com.multilingo.backend.modules.analytics` & `frontend/src/features/admin/`  
> **Người thực hiện:** Thành viên 4 (Lê Xuân Thành - LXT)

---

## 1. Phân Tích Scope & Actors

### 1.1 Actors
- **Quản trị viên (Admin):** Tài khoản người dùng có quyền `RoleName.ADMIN` (`role_id = 1`), đã đăng nhập thành công và sở hữu JWT Token hợp lệ.

### 1.2 Danh mục Use Case trong Scope
1. **A_Tracking:** Theo dõi hành vi người dùng và hiệu quả đề thi (Tra cứu tiến trình học viên & thống kê đề thi).
2. **UC15:** Quản trị người dùng tổng quan (Danh sách, tìm kiếm, lọc theo hạng VIP/trạng thái, xem chi tiết session/thiết bị).
3. **UC15.1:** Khóa / Mở khóa tài khoản học viên (Cập nhật `is_active`, hủy phiên Redis, ép logout, ghi nhật ký).
4. **UC15.3:** Cấu hình hạn mức Quota sử dụng AI (Thiết lập `max_limit` trong `user_quotas` cho các tính năng Writing / Dictionary / Chat AI theo nhóm Free / VIP, ghi audit log).
5. **UC15.4 / A_Audit:** Xem Nhật ký kiểm toán an ninh (Tra cứu `audit_logs`, lọc theo thời gian/hành động, hiển thị JSON Snapshot `details` trước và sau thao tác).
6. **UC16:** Báo cáo Vận hành & Doanh thu Tổng quan (Dashboard DAU/MAU, tăng trưởng người dùng, tỷ lệ chuyển đổi VIP, tổng hợp doanh thu thành công từ `transactions`).
7. **UC16.2:** Tra cứu & Đối soát giao dịch VNPAY (Danh sách hóa đơn, lọc theo trạng thái/thời gian, tìm theo mã đơn/email).
8. **UC16.3:** Xuất báo cáo tài chính định kỳ (Xuất danh sách giao dịch doanh thu ra tệp `.xlsx` hoặc `.csv`).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### AC 01: Quản trị Người dùng & Tìm kiếm (UC15)
```gherkin
Given Admin đã đăng nhập và truy cập trang /admin/users
When Admin xem danh sách hoặc nhập từ khóa tìm kiếm (email, họ tên) hoặc lọc theo trạng thái (Active/Locked), hạng VIP (FREE/PREMIUM)
Then Hệ thống trả về danh sách phân trang (PageResponse) chứa: id, email, fullName, subscriptionTier, isActive, createdAt, lastLoginIp, lastLoginAt
And Hỗ trợ phân trang chuẩn: page, size, sort
```

### AC 02: Khóa & Mở khóa tài khoản học viên (UC15.1)
```gherkin
Given Admin đang ở màn hình Quản lý Người dùng và chọn một học viên đang hoạt động (isActive = true)
When Admin nhấn "Khóa tài khoản", nhập lý do và bấm xác nhận
Then Hệ thống cập nhật users.is_active = false
And Hệ thống xóa/thu hồi token phiên làm việc của user (Revoke refresh tokens trong DB/Redis)
And Hệ thống ghi một bản ghi vào audit_logs với action = 'LOCK_USER', entityType = 'USER', details chứa reason và snapshot cũ
And Trả về thông báo thành công cho Admin
When Học viên đó thực hiện bất kỳ request nào, hệ thống chặn với mã 403 (Tài khoản đã bị khóa)
```

```gherkin
Given Admin chọn một học viên đang bị khóa (isActive = false)
When Admin nhấn "Mở khóa tài khoản" và bấm xác nhận
Then Hệ thống cập nhật users.is_active = true
And Ghi audit_logs với action = 'UNLOCK_USER'
And Học viên có thể đăng nhập lại bình thường
```

### AC 03: Tracking Học viên & Đề thi (A_Tracking)
```gherkin
Given Admin truy cập phân hệ Tracking
When Admin tra cứu một học viên theo userId hoặc email
Then Hệ thống trả về hồ sơ tiến trình: tổng số bài thi đã làm, điểm trung bình, tổng phút học (từ daily_study_logs / user_study_stats), lịch sử thiết bị và IP gần nhất (từ login_history)
When Admin chuyển sang tab Thống kê Đề thi
Then Hệ thống trả về danh sách đề thi kèm chỉ số: tổng lượt làm (attemptsCount), điểm trung bình (avgScore), tỷ lệ hoàn thành (completionRate)
```

### AC 04: Cấu hình Hạn mức Quota AI (UC15.3)
```gherkin
Given Admin truy cập trang Cấu hình Quota AI (/admin/settings)
When Admin xem danh sách hạn mức
Then Hệ thống hiển thị các cấu hình hiện tại theo featureCode (AI_WRITING_GRADING, AI_DICTIONARY, AI_CHAT_TUTOR)
When Admin chỉnh sửa max_limit > 0 và bấm "Lưu cấu hình"
Then Hệ thống cập nhật tham số max_limit vào bảng user_quotas
And Ghi nhật ký vào bảng audit_logs với action = 'UPDATE_AI_QUOTA'
And Trả về ApiResponse thành công
```

### AC 05: Xem Nhật ký Kiểm toán & Snapshot JSON (UC15.4)
```gherkin
Given Admin truy cập trang Logs Hệ thống (/admin/audit)
When Admin lọc theo khoảng ngày, hoặc action (LOCK_USER, DELETE_EXAM, UPDATE_QUOTA)
Then Hệ thống trả về danh sách audit logs sắp xếp mới nhất lên đầu
When Admin bấm "Xem chi tiết" của một bản ghi
Then Hệ thống mở Modal hiển thị Snapshot JSON (details) định dạng code highlight rõ ràng (dữ liệu trước/sau thay đổi)
```

### AC 06: Báo cáo Dashboard Vận hành & Doanh thu (UC16)
```gherkin
Given Admin truy cập trang Tổng quan (/admin/dashboard)
When Hệ thống tải dữ liệu tổng quan
Then Hiển thị các Card thống kê:
  - Tổng số học viên & số lượng user mới trong kỳ
  - DAU (Daily Active Users) và MAU (Monthly Active Users)
  - Tỷ lệ chuyển đổi VIP (PREMIUM / Tổng Users %)
  - Tổng doanh thu thực nhận (tính từ transactions có status = 'SUCCESS')
And Hiển thị biểu đồ xu hướng doanh thu và lượt thi theo thời gian (Tuần / Tháng)
```

### AC 07: Đối soát Giao dịch VNPAY & Xuất Excel (UC16.2 & UC16.3)
```gherkin
Given Admin truy cập phân hệ Đối soát Giao dịch (/admin/transactions)
When Admin lọc theo trạng thái (SUCCESS, PENDING, FAILED) hoặc nhập mã đơn hàng (orderId/vnp_TxnRef), email
Then Hiển thị danh sách giao dịch chính xác kèm số tiền, ngày thanh toán, mã tham chiếu VNPAY
When Admin bấm nút "Xuất báo cáo Excel"
Then Hệ thống kết xuất file Excel (.xlsx) chứa đầy đủ các cột đối soát và kích hoạt tải về trình duyệt
```

---

## 3. Ma Trận Kiểm Thử 6 Khía Cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Kỳ vọng |
| :--- | :--- | :--- |
| **Happy Path** | - Đăng nhập quyền Admin truy cập tất cả màn hình Admin.<br>- Lọc, phân trang, khóa/mở khóa user.<br>- Xuất file Excel giao dịch.<br>- Cập nhật quota AI thành công. | Mọi API trả về `200 OK` với `ApiResponse`, giao diện hiển thị mượt mà. |
| **Negative** | - User thường (`ROLE_USER`) gọi API Admin (`/api/admin/**`).<br>- Khóa tài khoản không tồn tại (`userId = 999999`).<br>- Cập nhật quota với `maxLimit <= 0`. | - 403 Forbidden.<br>- 404 NOT_FOUND.<br>- 422 VALIDATION_FAILED. |
| **Boundary** | - Phân trang với `page = 0`, `size = 100`, lọc ngày bắt đầu = ngày kết thúc.<br>- Export báo cáo với khoảng thời gian không có giao dịch nào. | Phân trang đúng giới hạn, export file rỗng với header bảng đầy đủ, không bị crash. |
| **Edge Cases** | - Khóa chính tài khoản Admin hiện tại đang đăng nhập.<br>- User bị khóa trong khi đang làm bài thi hoặc gửi request. | - Chặn không cho Admin tự khóa chính mình.<br>- Request tiếp theo của user bị từ chối với 403 ngay lập tức. |
| **Security** | - Bắt buộc kiểm tra token Bearer và quyền `ROLE_ADMIN`.<br>- Chống SQL Injection trong các bộ lọc tìm kiếm text.<br>- Dữ liệu nhạy cảm trong Audit snapshot không lộ mật khẩu hash. | Mọi endpoint được bảo vệ bởi Spring Security; mật khẩu luôn bị loại trừ khỏi snapshot. |
| **UI/UX** | - Layout Admin nhất quán với Theme EdTech (Amber/Orange `#d97706`).<br>- Hiển thị badge trạng thái (Active xanh, Locked đỏ, VIP vàng).<br>- Modal popup hiển thị JSON snapshot có cuộn và format dễ đọc. | Giao diện chuẩn UX, responsive trên cả mobile lẫn desktop. |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã Test Case | Phân loại | Tên ca kiểm thử | Điều kiện tiên quyết | Dữ liệu đầu vào (Input) | Các bước thực hiện | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_ADMIN_USER_01** | Happy | Lấy danh sách users phân trang | Đăng nhập Admin | `page=0, size=10` | Gửi GET `/api/admin/users` | 200 OK, trả về danh sách user và thông tin page |
| **TC_ADMIN_USER_02** | Happy | Tìm kiếm user theo email | Có user `test@example.com` | `keyword=test@example.com` | Gửi GET `/api/admin/users?keyword=...` | 200 OK, chỉ trả về user khớp email |
| **TC_ADMIN_USER_03** | Happy | Khóa tài khoản học viên | User đang `isActive=true` | `userId=2, reason="Gian lận thi"` | Gửi PATCH `/api/admin/users/2/status` (false) | 200 OK, user chuyển thành inactive, audit log được tạo |
| **TC_ADMIN_USER_04** | Security | Chặn Admin tự khóa chính mình | Admin id = 1 | `userId=1, isActive=false` | Gửi PATCH `/api/admin/users/1/status` (false) | 400 Bad Request, báo lỗi không thể tự khóa tài khoản quản trị |
| **TC_ADMIN_USER_05** | Negative | User thường gọi API khóa user | Đăng nhập với ROLE_USER | `userId=2, isActive=false` | Gửi PATCH `/api/admin/users/2/status` | 403 Forbidden |
| **TC_ADMIN_TRACK_01** | Happy | Xem tracking học viên | User đã thi 3 đề | `userId=2` | Gửi GET `/api/admin/tracking/users/2` | 200 OK, trả về tổng bài làm = 3, avg score, login history |
| **TC_ADMIN_TRACK_02** | Happy | Xem thống kê danh sách đề thi | Có 2 đề thi đã có lượt làm | - | Gửi GET `/api/admin/tracking/exams` | 200 OK, trả về danh sách đề kèm số lượt làm và avg score |
| **TC_ADMIN_QUOTA_01** | Happy | Cập nhật hạn mức Quota AI | Đăng nhập Admin | `featureCode="AI_WRITING_GRADING", maxLimit=5` | Gửi PUT `/api/admin/quotas` | 200 OK, maxLimit cập nhật thành 5, tạo audit log |
| **TC_ADMIN_QUOTA_02** | Boundary | Cập nhật Quota với maxLimit = 0 | Đăng nhập Admin | `maxLimit=0` | Gửi PUT `/api/admin/quotas` | 422 Unprocessable Entity, báo lỗi maxLimit phải >= 1 |
| **TC_ADMIN_AUDIT_01** | Happy | Tra cứu audit logs theo action | Có bản ghi `LOCK_USER` | `action="LOCK_USER"` | Gửi GET `/api/admin/audit-logs?action=LOCK_USER` | 200 OK, danh sách log khớp action, có details JSON |
| **TC_ADMIN_DASH_01** | Happy | Lấy thống kê Dashboard vận hành | Đăng nhập Admin | - | Gửi GET `/api/admin/dashboard/stats` | 200 OK, trả về totalUsers, dau, mau, totalRevenue, vipRate |
| **TC_ADMIN_TXN_01** | Happy | Đối soát danh sách giao dịch | Có giao dịch SUCCESS | `status="SUCCESS"` | Gửi GET `/api/admin/transactions?status=SUCCESS` | 200 OK, danh sách giao dịch thành công |
| **TC_ADMIN_TXN_02** | Happy | Xuất file Excel báo cáo doanh thu | Đăng nhập Admin | `fromDate=2026-10-01, toDate=2026-10-31` | Gửi GET `/api/admin/transactions/export?...` | 200 OK, Content-Type là Excel hoặc client xuất qua ExcelJS |
