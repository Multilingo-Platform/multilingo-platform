# 🔐 MODULE AUTH & BILLING (XÁC THỰC, PHÂN QUYỀN & THANH TOÁN)

**Thành viên phụ trách:** Thành viên 1 (TV1)  
**Package:** `com.multilingo.backend.modules.auth`  
**Tài liệu phân công chi tiết:** [docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (9 AD / 9 SD)

1. **UC01 - Đăng nhập hệ thống (Email & Google OAuth2):** Xác thực tài khoản, sinh JWT Tokens (Access Token + Refresh Token), lưu phiên vào Redis.
2. **UC01.1 - Đặt lại mật khẩu (Forgot Password):** Gửi email chứa token đặt lại mật khẩu, mã hóa Bcrypt khi đổi mật khẩu mới.
3. **UC02 - Đăng xuất (Logout):** Thu hồi Refresh Token trên Redis/DB (`is_revoked = true`), blacklist Access Token.
4. **UC03 - Đăng ký tài khoản (Register):** Đăng ký tài khoản học viên, validate dữ liệu, gán mặc định `ROLE_STUDENT` và gói `FREE`.
5. **UC04 - Quản lý hồ sơ cá nhân (Profile):** Xem thông tin người dùng, gói cước hiện tại và thời hạn.
6. **UC04.1 - Đổi mật khẩu tài khoản:** Kiểm tra mật khẩu cũ, cập nhật mật khẩu mới.
7. **UC04.2 - Cập nhật thông tin & Avatar:** Tải ảnh đại diện mới lên lưu trữ, cập nhật thông tin cá nhân.
8. **UC06 - Mua & Thanh toán gói VIP qua VNPAY:** Khởi tạo giao dịch, sinh URL thanh toán VNPAY (HMAC-SHA512), xử lý Webhook IPN, nâng hạng tài khoản `PREMIUM`.
9. **UC15.2 / UC16.1 - Quản trị RBAC & Bảng giá gói cước:** Phân quyền người dùng (Role/Permission) và điều chỉnh giá gói trong `subscription_plans`.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `users`: Thông tin tài khoản người dùng, email, mật khẩu mã hóa, hạng thành viên (`FREE`, `PREMIUM`).
- `roles`: Danh mục vai trò (`ROLE_STUDENT`, `ROLE_TEACHER`, `ROLE_ADMIN`).
- `permissions`: Danh mục quyền hạn chi tiết trong hệ thống.
- `role_permissions`: Bảng liên kết nhiều-nhiều giữa Roles và Permissions.
- `refresh_tokens`: Lưu trữ Refresh Token quản lý phiên đăng nhập và thu hồi token.
- `subscription_plans`: Bảng giá và thông tin các gói VIP (thời hạn, quyền lợi).
- `transactions`: Nhật ký giao dịch nạp tiền / mua gói VIP qua cổng VNPAY.

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.auth
├── controller/          # REST Controllers: AuthController, UserController, PaymentController
├── dto/                 # Data Transfer Objects
│   ├── request/         # LoginRequest, RegisterRequest, ChangePasswordRequest, VnpayPaymentRequest
│   └── response/        # AuthResponse, UserProfileResponse, PaymentUrlResponse
├── entity/              # User, Role, Permission, RefreshToken, SubscriptionPlan, Transaction
├── repository/          # UserRepository, RoleRepository, RefreshTokenRepository, TransactionRepository,...
└── service/             # AuthService, UserService, PaymentService, VnpayService
    └── impl/            # AuthServiceImpl, UserServiceImpl,...
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Tất cả Entity kế thừa `BaseEntity` (`id` tự tăng `Integer`, `createdAt`, `updatedAt`).
2. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>`.
3. **Ném lỗi:** Sử dụng `throw new AppException(ErrorCode.UNAUTHORIZED, ...)` hoặc các mã lỗi tương ứng trong `ErrorCode`.
4. **Bảo mật:** Mật khẩu phải được mã hóa qua `PasswordEncoder` (BCrypt).
