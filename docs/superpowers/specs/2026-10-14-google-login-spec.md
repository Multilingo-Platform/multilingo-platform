# Thiết Kế Kỹ Thuật: Đăng Nhập & Đăng Ký Bằng Google OAuth2 (Google Identity Services)

## 1. Mục tiêu & Bối cảnh
- **Mục tiêu:** Cung cấp phương thức xác thực nhanh chóng, an toàn và liền mạch cho người dùng thông qua Google Identity Services (GIS). Hỗ trợ đăng nhập một chạm hoặc popup tài khoản Google cho cả người dùng mới (tự động tạo tài khoản) và người dùng hiện tại (tự động liên kết tài khoản).
- **Đối soát Use Case:** Tham chiếu Use Case `UC002: Đăng nhập` trong `docs/DacTa/motaUC_Multilingo.md` (Luồng sự kiện thay thế 3a-6a).
- **Mô hình kiến trúc:** Token-based authentication cho Single Page Application (React 19 + Vite) kết hợp REST API Stateless (Spring Boot 3.3 + Spring Security + JWT).

---

## 2. Actors & Phạm vi (Scope)
- **Actors:** Khách vãng lai (Guest User), Học viên (Student), Quản trị viên (Admin).
- **In-Scope (Trong phạm vi):**
  - Tích hợp nút Google Login trên form Đăng nhập (`LoginForm`) và form Đăng ký (`RegisterForm`).
  - Sử dụng thư viện `@react-oauth/google` tại Frontend để lấy Google ID Token (JWT Credential).
  - Endpoint Backend `POST /api/auth/google` nhận và xác thực cryptographic signature của Google ID Token thông qua thư viện chính thức `google-api-client` (`GoogleIdTokenVerifier`).
  - Cơ chế tự động liên kết tài khoản (Auto-link) nếu người dùng đã có tài khoản theo email trước đó.
  - Cơ chế tự động kích hoạt tài khoản mới (Auto-provision) với vai trò `STUDENT` nếu chưa từng tồn tại trong hệ thống.
  - Kiểm tra trạng thái tài khoản `isActive` (chặn đăng nhập nếu tài khoản bị khóa và ném `ACCOUNT_INACTIVE`).
  - Phát hành bộ JWT Token nội bộ (`accessToken` + `refreshToken` HttpOnly cookie) đồng bộ với luồng đăng nhập truyền thống.
- **Out-of-Scope (Ngoài phạm vi):**
  - Đăng nhập qua các nhà cung cấp bên thứ ba khác (Facebook, Apple, GitHub).
  - Đồng bộ Google Calendar hay Google Drive.

---

## 3. Luồng hoạt động chi tiết (Flow Architecture)

```
[User Browser / React FE]             [Google Identity Platform]             [Multilingo Backend]
           │                                      │                                    │
           │── 1. Bấm nút Google Login ──────────>│                                    │
           │<── 2. Chọn tài khoản Google & Xác thực─│                                    │
           │── 3. Nhận Google ID Token (JWT) ────>│                                    │
           │                                                                           │
           │── 4. POST /api/auth/google { idToken } ──────────────────────────────────>│
           │                                                                           │
           │                                      │<── 5. Verify ID Token Crypto ──────│
           │                                      │    (Audience, Exp, Jwks Signature) │
           │                                      │─── 6. Token Valid (sub, email,...)>│
           │                                                                           │
           │                                                                           │── 7. Xử lý User trong DB:
           │                                                                           │     - Check email_verified
           │                                                                           │     - Find by googleId/email
           │                                                                           │     - Auto-link / Auto-create
           │                                                                           │     - Check isActive
           │                                                                           │     - Save & update lastLoginAt
           │                                                                           │── 8. Sinh Multilingo JWT Tokens
           │                                                                           │
           │<── 9. Response 200 OK (AccessToken, User info, Set-Cookie RefreshToken) ──│
           │                                                                           │
           │── 10. Lưu Redux state & Navigate vào Dashboard ───────────────────────────│
```

### 3.1. Phía Frontend
1. Tích hợp `GoogleOAuthProvider` tại tầng Root (`App.tsx` hoặc `main.tsx`) sử dụng biến môi trường `VITE_GOOGLE_CLIENT_ID`.
2. Trên `LoginForm.tsx` và `RegisterForm.tsx`, nút bấm Google kích hoạt luồng đăng nhập qua hook `useGoogleLogin` (flow `implicit` / `id_token` credential) hoặc component `<GoogleLogin />`.
3. Khi nhận thành công `credential` (Google ID Token), Frontend gọi API `authApi.loginWithGoogle({ idToken })`.
4. Nhận kết quả thành công:
   - Lưu `accessToken` và `user` vào Redux `authSlice` (hàm `setCredentials`).
   - Hiển thị Toast thông báo đăng nhập thành công.
   - Điều hướng về trang học tập (`/student`) hoặc `/admin` dựa trên `role`.
5. Nếu thất bại: Hiển thị Toast thông báo lỗi tương ứng nhận từ Backend.

### 3.2. Phía Backend
1. Cấu hình biến môi trường `app.google.client-id=${GOOGLE_CLIENT_ID:your-client-id}` trong `application.properties`.
2. Endpoint `POST /api/auth/google` được mở công khai (`permitAll`) trong `SecurityConfig`.
3. Backend tiếp nhận `GoogleLoginRequest`:
   - Dùng `GoogleIdTokenVerifier` (khởi tạo từ `NetHttpTransport` và `GsonFactory`, thiết lập audience với Client ID cấu hình).
   - Xác thực token: Kiểm tra tính toàn vẹn chữ ký số, issuer (`accounts.google.com` hoặc `https://accounts.google.com`), audience (`clientId`), thời hạn hiệu lực.
   - Nếu token không hợp lệ hoặc hết hạn: Ném `AppException(ErrorCode.INVALID_GOOGLE_TOKEN)`.
   - Kiểm tra `payload.getEmailVerified()`: Nếu `false`, ném `AppException(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED)`.
4. Tìm kiếm và xử lý thực thể `User`:
   - Bước 1: Tìm theo `googleId`: `userRepository.findByGoogleId(sub)`.
   - Bước 2: Nếu chưa có theo `googleId`, tìm theo `email`: `userRepository.findByEmail(email)`.
     - Nếu tìm thấy tài khoản đã đăng ký trước đó bằng email/mật khẩu: Tự động liên kết `user.setGoogleId(sub)`. Nếu `avatarUrl` rỗng thì cập nhật avatar từ Google.
   - Bước 3: Nếu chưa tồn tại trong hệ thống:
     - Tạo mới tài khoản với `role = STUDENT`, `nativeLanguage = "vi"`, `targetLanguage = "en"`, `subscriptionTier = SubscriptionTier.FREE`, `isActive = true`, `googleId = sub`, `email = email`, `fullName = name`, `avatarUrl = picture`, `passwordHash = null`.
5. Kiểm tra trạng thái tài khoản:
   - Nếu `!user.getIsActive()` -> Ném `AppException(ErrorCode.ACCOUNT_INACTIVE)`.
6. Cập nhật `lastLoginAt = Instant.now()`, `lastLoginIp = clientIp`.
7. Phát hành Token:
   - Tạo Access Token (JWT 30 phút).
   - Tạo Refresh Token (UUID lưu vào DB `RefreshToken` và Redis).
   - Trả về `AuthenticationResponse` và kèm header `Set-Cookie` cho `refresh_token`.

---

## 4. API Contract

### 4.1. Endpoint Đăng nhập Google
- **URL:** `POST /api/auth/google`
- **Quyền hạn:** Công khai (`permitAll`)
- **Headers:** `Content-Type: application/json`

#### Request Body:
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
}
```

#### Response Thành Công (200 OK):
```json
{
  "code": 200,
  "message": "Thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 1800,
    "user": {
      "id": 12,
      "email": "student@gmail.com",
      "fullName": "Nguyen Van A",
      "phone": null,
      "avatarUrl": "https://lh3.googleusercontent.com/a/...",
      "role": "STUDENT",
      "nativeLanguage": "vi",
      "targetLanguage": "en",
      "subscriptionTier": "FREE",
      "isActive": true
    }
  }
}
```
*Kèm Header:* `Set-Cookie: refresh_token=...; Path=/api/auth; HttpOnly; SameSite=Lax`

#### Response Thất Bại:
1. **Token Google không hợp lệ hoặc hết hạn (401 Unauthorized):**
   ```json
   {
     "code": 920,
     "message": "Mã xác thực Google không hợp lệ hoặc đã hết hạn",
     "data": null
   }
   ```
2. **Email Google chưa xác thực (400 Bad Request):**
   ```json
   {
     "code": 921,
     "message": "Email Google của bạn chưa được xác thực",
     "data": null
   }
   ```
3. **Tài khoản bị vô hiệu hóa / khóa (403 Forbidden):**
   ```json
   {
     "code": 918,
     "message": "Tài khoản đã bị khóa liên hệ admin để được hỗ trợ",
     "data": null
   }
   ```

---

## 5. Thư viện & Cấu hình phụ thuộc

### 5.1. Backend (`pom.xml`)
- Thêm dependency Google API Client:
  ```xml
  <dependency>
      <groupId>com.google.api-client</groupId>
      <artifactId>google-api-client</artifactId>
      <version>2.7.0</version>
  </dependency>
  ```
- Cấu hình trong `application.properties`:
  ```properties
  app.google.client-id=${GOOGLE_CLIENT_ID:test-client-id.apps.googleusercontent.com}
  ```

### 5.2. Frontend (`package.json`)
- Thêm thư viện Google OAuth React:
  ```bash
  npm install @react-oauth/google
  ```
- Cấu hình trong `.env`:
  ```properties
  VITE_GOOGLE_CLIENT_ID=test-client-id.apps.googleusercontent.com
  ```

---

## 6. Bảo mật & Phòng chống rủi ro
1. **Kiểm tra Audience:** Bắt buộc `GoogleIdTokenVerifier` phải cấu hình audience đúng bằng `app.google.client-id` để ngăn chặn kẻ tấn công dùng Token hợp lệ của một ứng dụng Google khác để đăng nhập vào Multilingo.
2. **Kiểm tra `email_verified`:** Không liên kết hoặc tạo tài khoản nếu email trên tài khoản Google chưa được Google xác thực.
3. **Mật khẩu an toàn:** Người dùng tạo mới qua Google sẽ có `password_hash = null`. Khi người dùng muốn đặt mật khẩu sau này, sẽ dùng chức năng Quên mật khẩu hoặc Thiết lập mật khẩu trong Profile.
4. **Không lưu trữ nhạy cảm:** Token Google `idToken` chỉ dùng xác thực tức thời trong request, không lưu vào cơ sở dữ liệu.
