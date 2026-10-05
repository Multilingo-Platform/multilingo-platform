# Auth Module Implementation Plan (UC002 - UC005)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện toàn bộ chức năng cốt lõi của Phân hệ Xác thực và Hồ sơ, bao gồm Đăng nhập, Đăng xuất, Quên mật khẩu, Cập nhật hồ sơ, Đổi mật khẩu, tích hợp JWT và Redis.

**Architecture:** Xây dựng trên nền tảng Spring Boot. Tuân thủ triệt để tài liệu `MODULE_ARCHITECTURE_GUIDELINE.md` (Feature-based). Xác thực qua Spring Security kết hợp với JWT Token. Quản lý Refresh Token & OTP, Blacklist qua Redis.

**Tech Stack:** Java 21, Spring Boot 3, Spring Security, JWT (io.jsonwebtoken), Redis (Spring Data Redis), MapStruct, Lombok, Java Mail Sender.

**Spec:** [docs/DacTa/motaUC_Multilingo.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/DacTa/motaUC_Multilingo.md)

## Global Constraints
- API trả về `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ luôn dùng `throw new AppException(ErrorCode.XYZ)`.
- Toàn bộ Entity kế thừa `BaseEntity`.
- Không nhồi nhét Logic vào Controller. Mọi logic nằm ở Service.

## Review Focus
1. Rò rỉ thông tin nhạy cảm: Trả về mật khẩu hash hoặc thông tin quyền Admin trong response DTO không cần thiết.
2. Quản lý phiên bằng Redis: Khi đăng xuất (UC1.3) hoặc đổi mật khẩu (UC1.4/1.6), token cũ phải bị vô hiệu hóa thông qua Redis blacklist.
3. Brute Force OTP: Kẻ tấn công gọi API gửi OTP hoặc xác thực liên tục.

---

## Tiêu chí nghiệm thu (Acceptance Criteria) & Bảng Test Cases (Mẫu)

### Bảng Test Cases - Module Auth

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUTH_LOGIN_01** | Happy Path | Đăng nhập thành công với Email & Password | Tài khoản hợp lệ đã tồn tại | Email đúng, Pass đúng | Trả về 200 OK, Access Token, Refresh Token |
| **TC_AUTH_LOGIN_02** | Negative | Đăng nhập sai mật khẩu | Tài khoản đã tồn tại | Pass sai | Báo lỗi `UNAUTHENTICATED` (401) |
| **TC_AUTH_LOGOUT_01** | Happy Path | Đăng xuất thành công | Đang có JWT Token hợp lệ | Gửi request có kèm Bearer Token | Blacklist token vào Redis, trả 200 OK |
| **TC_AUTH_RESET_01** | Happy Path | Quên mật khẩu - Gửi OTP | Tài khoản tồn tại | Email đúng | Gửi email chứa OTP 6 số, lưu OTP vào Redis (TTL: 5 phút) |
| **TC_AUTH_RESET_02** | Security | Chống spam gửi OTP | Vừa gửi OTP thành công | Gọi lại API gửi OTP trong vòng 60s | Báo lỗi `TOO_MANY_REQUESTS` (429) |
| **TC_AUTH_RESET_03** | Boundary | Đặt lại MK với OTP đã hết hạn | OTP được sinh quá 5 phút | OTP đúng, Pass mới | Báo lỗi `OTP_EXPIRED` |

---

## Các Tasks Thực Hiện

### Task 1: Cấu hình JWT Token & Tích hợp Redis (Core Security)
**Files:**
- Create: `security/JwtTokenProvider.java`
- Create: `security/JwtAuthenticationFilter.java`
- Create: `dto/response/AuthenticationResponse.java`
- Modify: `config/SecurityConfig.java`
- Create: `tests/com/multilingo/backend/modules/auth/security/JwtTokenProviderTest.java`

**Interfaces:**
- Produces: `JwtTokenProvider.generateToken(User)`, `JwtTokenProvider.validateToken(String)`

- [ ] **Step 1: Viết test cho JwtTokenProvider**
```java
@Test
void testGenerateAndValidateToken() {
    // mock User details, generate token, validate true
}
```
- [ ] **Step 2: Viết mã implementation cho JwtTokenProvider** (Sử dụng JJWT, lấy SECRET_KEY từ properties).
- [ ] **Step 3: Cấu hình SecurityConfig** để đăng ký `JwtAuthenticationFilter` vào chuỗi filter, phân quyền endpoint.
- [ ] **Step 4: Chạy test xác nhận PASS.**
- [ ] **Step 5: Commit mã nguồn.**

### Task 2: Chức năng Đăng nhập (UC002)
**Files:**
- Create: `dto/request/LoginRequest.java`
- Modify: `controller/AuthenController.java` (hoặc AuthController)
- Modify: `service/AuthenService.java`, `service/impl/AuthenServiceImpl.java`
- Modify: `repository/UserRepository.java`

**Interfaces:**
- Consumes: `JwtTokenProvider`
- Produces: `AuthenService.login(LoginRequest)`

- [ ] **Step 1: Viết test cho hàm `login` trong AuthenServiceTest.** (Mock UserRepository tìm user, PasswordEncoder matches).
- [ ] **Step 2: Cài đặt DTO `LoginRequest`** với `@NotBlank`.
- [ ] **Step 3: Cài đặt `AuthenServiceImpl.login`**: 
  - Tìm User qua email -> quăng Exception `USER_NOT_FOUND` nếu không thấy.
  - So sánh mật khẩu bằng `PasswordEncoder.matches()` -> quăng `UNAUTHENTICATED` nếu sai.
  - Gọi `jwtTokenProvider` tạo token, trả về `AuthenticationResponse`.
- [ ] **Step 4: Chạy test xác nhận PASS.**
- [ ] **Step 5: Commit.**

### Task 3: Chức năng Đăng xuất (UC002 - Logout)
**Files:**
- Create: `dto/request/LogoutRequest.java` (Gửi token cần blacklist)
- Modify: `controller/AuthenController.java`
- Modify: `service/AuthenService.java`, `service/impl/AuthenServiceImpl.java`

- [ ] **Step 1: Viết test cho hàm `logout`.**
- [ ] **Step 2: Cài đặt `logout` trong Service**: Lấy JTI (Token ID) từ JWT token, lưu vào Redis với TTL bằng thời gian sống còn lại của token (Trạng thái Blacklist).
- [ ] **Step 3: Cập nhật `JwtAuthenticationFilter`** để từ chối các token nằm trong Redis blacklist.
- [ ] **Step 4: Chạy test xác nhận PASS.**
- [ ] **Step 5: Commit.**

### Task 4: Chức năng Quên Mật Khẩu (Gửi OTP & Đặt lại MK - UC003)
**Files:**
- Create: `dto/request/ForgotPasswordRequest.java` (Email), `dto/request/ResetPasswordRequest.java` (Email, OTP, NewPassword)
- Modify: `service/UserService.java`, `service/impl/UserServiceImpl.java`

- [ ] **Step 1: Viết test cho hàm `forgotPassword` & `resetPassword`.**
- [ ] **Step 2: Hàm `forgotPassword`**: Tìm email, sinh mã OTP 6 số, lưu vào Redis với key `OTP_RESET_PWD_{email}` và TTL = 5 phút. Gửi email qua JavaMailSender (hoặc mock log ra console tạm thời).
- [ ] **Step 3: Hàm `resetPassword`**: Lấy OTP từ Redis, so sánh. Nếu đúng -> Cập nhật mật khẩu mã hóa mới vào DB. Xóa OTP trong Redis.
- [ ] **Step 4: Chạy test xác nhận PASS.**
- [ ] **Step 5: Commit.**

### Task 5: Chức năng Cập nhật hồ sơ & Đổi MK (UC004, UC005)
**Files:**
- Create: `dto/request/UpdateProfileRequest.java`, `dto/request/ChangePasswordRequest.java`
- Modify: `controller/UserController.java`
- Modify: `service/UserService.java`, `service/impl/UserServiceImpl.java`

- [ ] **Step 1: Viết test cho `updateProfile` và `changePassword`.**
- [ ] **Step 2: Cài đặt `changePassword`**: Lấy User hiện tại (qua SecurityContext), kiểm tra mật khẩu cũ `PasswordEncoder.matches`. Nếu đúng -> set mật khẩu mới.
- [ ] **Step 3: Cài đặt `updateProfile`**: Cập nhật thông tin không nhạy cảm (Tên, SDT, Native/Target Language).
- [ ] **Step 4: Chạy test xác nhận PASS.**
- [ ] **Step 5: Commit.**
