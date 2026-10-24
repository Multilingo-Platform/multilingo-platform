# Tiêu Chí Nghiệm Thu & Test Design: Phân Quyền RBAC Không Cần Permission (Role-Based Access Control)

Tài liệu chuẩn hóa tiêu chí nghiệm thu (Acceptance Criteria - AC) và ma trận kiểm thử toàn diện phục vụ triển khai cơ chế **Phân quyền dựa trên vai trò (RBAC) với Role được nhúng trong JWT** theo phương pháp luận Superpowers.

---

## 📋 Bước 1: Phân tích Scope & Actors

### 1. Actors (Tác nhân)
- **Khách vãng lai (Guest):** Chưa đăng nhập, không có JWT hoặc token đã hết hạn/vô hiệu hóa.
- **Học viên (User / Student):** Người dùng thông thường đã đăng nhập, sở hữu JWT hợp lệ chứa claim `"role": "USER"`.
- **Quản trị viên (Admin):** Người dùng có đặc quyền quản trị, sở hữu JWT hợp lệ chứa claim `"role": "ADMIN"`.

### 2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - Token JWT phát hành khi đăng nhập (`login`, `loginWithGoogle`, `refreshToken`) bắt buộc chứa claim `"role": "ADMIN"` hoặc `"USER"` và `"userId": <id>`.
  - Backend bảo vệ tất cả endpoint tiền tố `/api/admin/**` và `/api/v1/admin/**` chỉ cho phép `ADMIN`.
  - Backend xử lý 403 Forbidden trả về `ApiResponse` chuẩn (`code: 403, message: "Không có quyền thực hiện thao tác"`).
  - Frontend bảo vệ các route `/admin/**` thông qua `ProtectedRoute` có ràng buộc `allowedRoles={['ADMIN']}`.
  - Frontend tự động điều hướng an toàn và hiện thông báo khi người dùng truy cập trang ngoài quyền hạn.
- **Out-of-Scope:**
  - Phân quyền chi tiết theo từng permission/action code (bảng `permissions`, `role_permissions`).
  - Hỗ trợ đa vai trò (Multi-role) đồng thời.
  - Giao diện Admin phân quyền động (Role Management UI).

---

## 📋 Bước 2: Tiêu chí nghiệm thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin

#### AC-01: Phát hành Token chứa Claim Role khi Đăng nhập thành công
```gherkin
Kịch bản: Người dùng đăng nhập thành công và nhận được JWT chứa claim role
Given Người dùng tồn tại trong hệ thống với email "admin@multilingo.com" và role "ADMIN"
When Người dùng gửi yêu cầu POST /api/auth/login với thông tin đăng nhập chính xác
Then Hệ thống trả về mã trạng thái 200 OK
And Phản hồi chứa accessToken hợp lệ
And Khi giải mã accessToken, payload chứa:
    - "sub": "admin@multilingo.com"
    - "role": "ADMIN"
    - "userId": ID tương ứng trong CSDL
    - "exp": thời gian hết hạn hợp lệ
```

#### AC-02: Phát hành Token chứa Claim Role trong luồng Google OAuth và Refresh Token
```gherkin
Kịch bản: Học viên làm mới token (Refresh Token) hoặc đăng nhập Google nhận được token có role
Given Học viên có Refresh Token hợp lệ của tài khoản có role "USER"
When Học viên gửi yêu cầu POST /api/auth/refresh-token
Then Hệ thống trả về mã trạng thái 200 OK
And accessToken mới được sinh ra chứa claim "role": "USER"
```

#### AC-03: Chặn người dùng có Role USER truy cập Endpoint Quản trị (Backend 403)
```gherkin
Kịch bản: Học viên cố gắng gọi API quản trị bằng token hợp lệ của mình
Given Người dùng đã đăng nhập với vai trò "USER" và sở hữu Bearer Token hợp lệ
When Người dùng gửi yêu cầu HTTP GET đến "/api/v1/admin/exams" kèm Bearer Token
Then Backend từ chối truy cập và trả về HTTP Status 403 Forbidden
And Cấu trúc JSON trả về tuân thủ chuẩn ApiResponse:
    - "code": 403
    - "message": "Không có quyền thực hiện thao tác"
    - "data": null
```

#### AC-04: Cho phép người dùng có Role ADMIN truy cập Endpoint Quản trị
```gherkin
Kịch bản: Quản trị viên truy cập các tài nguyên quản trị
Given Người dùng đã đăng nhập với vai trò "ADMIN" và sở hữu Bearer Token hợp lệ
When Người dùng gửi yêu cầu HTTP GET đến "/api/v1/admin/exams" kèm Bearer Token
Then Backend xử lý yêu cầu và trả về HTTP Status 200 OK cùng dữ liệu quản trị
```

#### AC-05: Chặn khách vãng lai (Chưa đăng nhập) truy cập Endpoint Quản trị
```gherkin
Kịch bản: Khách vãng lai gửi yêu cầu tới API quản trị mà không có token
Given Người dùng chưa xác thực (không gửi header Authorization hoặc token sai định dạng)
When Người dùng gửi yêu cầu HTTP GET đến "/api/v1/admin/exams"
Then Backend từ chối truy cập và trả về HTTP Status 401 Unauthorized
And Cấu trúc JSON trả về tuân thủ chuẩn ApiResponse với ErrorCode UNAUTHENTICATED_ACCESS
```

#### AC-06: Frontend ProtectedRoute chặn người dùng không phải Admin vào trang /admin
```gherkin
Kịch bản: Học viên nhập URL trang quản trị trên trình duyệt
Given Người dùng đang đăng nhập với tài khoản có role "USER"
When Người dùng điều hướng đến "/admin/dashboard"
Then Hệ thống chặn hiển thị giao diện AdminLayout
And Hệ thống hiển thị thông báo cảnh báo "Bạn không có quyền truy cập trang này"
And Người dùng được tự động chuyển hướng về "/student/dashboard"
```

#### AC-07: Frontend ProtectedRoute cho phép Admin vào trang /admin
```gherkin
Kịch bản: Quản trị viên điều hướng vào trang quản trị
Given Người dùng đang đăng nhập với tài khoản có role "ADMIN"
When Người dùng điều hướng đến "/admin/dashboard"
Then Hệ thống cho phép hiển thị trang AdminDashboardPage trong AdminLayout
```

---

### 2.2. Business Rules Checklist
- [x] **BR-RBAC-01:** Mọi JWT Access Token hợp lệ đều phải có claim `role` (không được `null` hoặc chuỗi rỗng).
- [x] **BR-RBAC-02:** Định dạng claim `role` trong token là chuỗi ngắn gọn viết hoa (ví dụ: `ADMIN`, `USER`), không bao gồm tiền tố `ROLE_`.
- [x] **BR-RBAC-03:** Tại tầng Spring Security Context, role được chuẩn hóa thành `ROLE_ADMIN` hoặc `ROLE_USER` để tương thích hoàn toàn với `@PreAuthorize("hasRole('ADMIN')")` và `hasRole(...)`.
- [x] **BR-RBAC-04:** Mọi phản hồi 403 Forbidden từ Spring Security Filter hoặc Controller Method Security đều phải có Content-Type `application/json` và cấu trúc `ApiResponse` chuẩn của hệ thống Multilingo.
- [x] **BR-RBAC-05:** Client không được phép truy cập trái phép bằng cách sửa đổi payload của token trên client (bất kỳ sửa đổi signature nào sẽ bị `JwtAuthenticationFilter` chặn ở bước xác thực 401).

---

## 📋 Bước 3: Ma trận kiểm thử 6 khía cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Kỳ vọng |
|---|---|---|
| **1. Happy Path** | Admin đăng nhập -> nhận token có `role: ADMIN` -> gọi `/api/v1/admin/exams` thành công (200 OK) | Token chứa đúng claim, API xử lý thành công |
| | User đăng nhập -> nhận token có `role: USER` -> gọi `/api/student/dashboard` thành công (200 OK) | Token chứa đúng claim, API học viên xử lý thành công |
| **2. Negative Cases** | User gọi `/api/v1/admin/**` hoặc endpoint có `@PreAuthorize("hasRole('ADMIN')")` | HTTP 403 Forbidden, body `ApiResponse(403, "Không có quyền...")` |
| | Guest gọi `/api/v1/admin/**` không gửi token | HTTP 401 Unauthorized, body `ApiResponse(909, ...)` |
| | User gửi token giả mạo sửa claim `role: ADMIN` nhưng sai chữ ký | Token verification thất bại, HTTP 401 Unauthorized |
| **3. Boundary Cases** | User mới đăng ký tài khoản (Auto-provision) | Tài khoản mặc định có role `USER`, token phát hành ngay sau đó chứa `role: USER` |
| | Gọi API làm mới token (`/api/auth/refresh-token`) khi user đổi role trong DB | Token mới được sinh với role mới nhất của User trong DB |
| **4. Edge Cases** | Người dùng trong DB chưa có role (`role == null`) | `JwtTokenProvider` fallback về vai trò mặc định `"USER"` |
| | Tài khoản bị vô hiệu hóa (`isActive = false`) cố gắng dùng token cũ truy cập | Bị chặn từ tầng xác thực hoặc blacklist |
| **5. Security & Integrity** | Chống Privilege Escalation (Leo thang đặc quyền): User không thể tự gán role khi đăng ký | API đăng ký bỏ qua mọi tham số role gửi từ client, luôn cố định gán `RoleName.USER` |
| | IDOR / Route Traversal: Học viên cố tình gõ link trực tiếp `/admin/users` | Frontend `ProtectedRoute` chặn và chuyển hướng ngay lập tức |
| **6. UI/UX** | Học viên bị redirect khi truy cập trái phép | Hiển thị Toast cảnh báo rõ ràng, không bị màn hình trắng (Blank Screen) hoặc loop chuyển hướng |

---

## 📋 Bước 4: Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã Test Case | Module | Tác nhân (Actor) | Điều kiện tiên quyết | Các bước thực hiện (Steps) | Dữ liệu kiểm thử (Test Data) | Kết quả mong đợi (Expected Result) |
|---|---|---|---|---|---|---|
| `TC_AUTH_RBAC_001` | Auth | Admin | Admin đã tồn tại trong CSDL | 1. Gửi request POST `/api/auth/login` | Email: `admin@multilingo.com`, Pass: `admin123` | HTTP 200, JWT token decode ra có `role == "ADMIN"` và `userId` hợp lệ |
| `TC_AUTH_RBAC_002` | Auth | User | User đã tồn tại trong CSDL | 1. Gửi request POST `/api/auth/login` | Email: `user@multilingo.com`, Pass: `password123` | HTTP 200, JWT token decode ra có `role == "USER"` và `userId` hợp lệ |
| `TC_AUTH_RBAC_003` | Auth | User | User có Refresh Token hợp lệ | 1. Gửi request POST `/api/auth/refresh-token` | Refresh Token hợp lệ | HTTP 200, access token mới sinh ra có claim `role == "USER"` |
| `TC_SEC_RBAC_004` | Security | User | Đã đăng nhập với role USER | 1. Gửi GET `/api/v1/admin/exams` kèm Bearer Token | Header: `Authorization: Bearer <user_token>` | HTTP 403 Forbidden, JSON `{ "code": 403, "message": "Không có quyền thực hiện thao tác" }` |
| `TC_SEC_RBAC_005` | Security | Admin | Đã đăng nhập với role ADMIN | 1. Gửi GET `/api/v1/admin/exams` kèm Bearer Token | Header: `Authorization: Bearer <admin_token>` | HTTP 200 OK, trả về danh sách đề thi quản trị |
| `TC_SEC_RBAC_006` | Security | Guest | Chưa đăng nhập | 1. Gửi GET `/api/v1/admin/exams` không header Auth | Không có header Authorization | HTTP 401 Unauthorized, JSON mã lỗi `909` |
| `TC_SEC_RBAC_007` | Security | User | Đã đăng nhập với role USER | 1. Gửi GET `/api/admin/users` (AdminUserController có `@PreAuthorize`) | Header: `Authorization: Bearer <user_token>` | HTTP 403 Forbidden, JSON mã lỗi `403` do `GlobalExceptionHandler` hoặc `AccessDeniedHandler` |
| `TC_FE_RBAC_008` | Frontend | Guest | Chưa có token trong LocalStorage | 1. Điều hướng trình duyệt đến URL `/admin/dashboard` | URL: `/admin/dashboard` | Điều hướng về `/login`, không render `AdminLayout` |
| `TC_FE_RBAC_009` | Frontend | User | Đã đăng nhập với role USER | 1. Điều hướng trình duyệt đến URL `/admin/dashboard` | URL: `/admin/dashboard`, State: role `USER` | Hiển thị Toast cảnh báo, điều hướng về `/student/dashboard` |
| `TC_FE_RBAC_010` | Frontend | Admin | Đã đăng nhập với role ADMIN | 1. Điều hướng trình duyệt đến URL `/admin/dashboard` | URL: `/admin/dashboard`, State: role `ADMIN` | Hiển thị thành công trang `AdminDashboardPage` trong `AdminLayout` |
