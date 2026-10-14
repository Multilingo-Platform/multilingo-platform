# Google OAuth2 Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cung cấp tính năng Đăng nhập & Đăng ký một chạm bằng tài khoản Google (Google Identity Services) an toàn và liền mạch từ Frontend React đến Backend Spring Boot.

**Architecture:** Sử dụng kiến trúc Token-based Authentication cho Single Page Application. Frontend dùng `@react-oauth/google` để nhận Google ID Token (JWT Credential), gửi tới Backend endpoint `POST /api/auth/google`. Backend sử dụng `GoogleIdTokenVerifier` để xác thực cryptographic signature, kiểm tra audience và `email_verified`, sau đó thực hiện Auto-linking (với email đã tồn tại) hoặc Auto-provisioning (tạo mới tài khoản với vai trò USER), kiểm tra trạng thái kích hoạt `isActive` và cấp phát Multilingo JWT Tokens (Access Token + HttpOnly Refresh Token Cookie).

**Tech Stack:** Java 21, Spring Boot 3.3.4, Spring Security, `com.google.api-client:google-api-client:2.7.0`, React 19, TypeScript, `@react-oauth/google`, Redux Toolkit.

**Spec:** [docs/superpowers/specs/2026-10-14-google-login-spec.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/superpowers/specs/2026-10-14-google-login-spec.md)  
**AC & Test Design:** [docs/superpowers/specs/2026-10-14-google-login-AC.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/superpowers/specs/2026-10-14-google-login-AC.md)

## Global Constraints
- Backend: Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Backend: Ném lỗi nghiệp vụ qua `AppException(ErrorCode.XYZ)`.
- Backend: Entity `User` kế thừa `BaseEntity`, khóa chính là `Integer`.
- Frontend: Cấu trúc theo Feature-based Architecture (`features/auth/`).
- TDD: Mọi logic nghiệp vụ phải có Unit Test Red -> Green -> Refactor.

## Review Focus
1. Google ID Token giả mạo hoặc sai chữ ký: Ném `ErrorCode.INVALID_GOOGLE_TOKEN (920)` với HTTP 401.
2. Google ID Token thuộc Client ID khác (sai Audience): Ném `ErrorCode.INVALID_GOOGLE_TOKEN (920)` với HTTP 401.
3. Tài khoản Google chưa xác minh email (`email_verified == false`): Ném `ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED (921)` với HTTP 400.
4. Tài khoản trên Multilingo đang bị khóa (`isActive == false`): Ném `ErrorCode.ACCOUNT_INACTIVE (918)` với HTTP 403.
5. Email Google trùng với tài khoản đã đăng ký mật khẩu trước đó: Tự động liên kết `google_id` mà không làm mất mật khẩu hay thay đổi role của tài khoản.

---

### Task 1: Backend Dependencies, Configuration & Error Codes

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`

**Interfaces:**
- Produces: `ErrorCode.INVALID_GOOGLE_TOKEN`, `ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED`, cấu hình `app.google.client-id`.

- [ ] **Step 1: Thêm ErrorCode mới vào ErrorCode.java**
Thêm `INVALID_GOOGLE_TOKEN(920, HttpStatus.UNAUTHORIZED, "Mã xác thực Google không hợp lệ hoặc đã hết hạn")` và `GOOGLE_EMAIL_NOT_VERIFIED(921, HttpStatus.BAD_REQUEST, "Email Google của bạn chưa được xác thực")` vào `ErrorCode.java`.

- [ ] **Step 2: Cập nhật dependency google-api-client trong pom.xml**
Thêm dependency `com.google.api-client:google-api-client:2.7.0` vào `backend/pom.xml`.

- [ ] **Step 3: Cấu hình app.google.client-id trong application.properties**
Thêm thuộc tính `app.google.client-id=${GOOGLE_CLIENT_ID:test-google-client-id.apps.googleusercontent.com}` vào `backend/src/main/resources/application.properties`.

- [ ] **Step 4: Kiểm tra build backend**
Chạy `./mvnw clean compile` để đảm bảo dependency và cú pháp Java không có lỗi.

---

### Task 2: DTO & Google Token Verifier Service

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/request/GoogleLoginRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/GoogleTokenPayload.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/GoogleTokenVerifierService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/GoogleTokenVerifierServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/service/GoogleTokenVerifierServiceTest.java`

**Interfaces:**
- Produces: `GoogleTokenVerifierService.verify(String idToken): GoogleTokenPayload`
  - Throws: `AppException(ErrorCode.INVALID_GOOGLE_TOKEN)` hoặc `AppException(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED)`.

- [ ] **Step 1: Tạo GoogleLoginRequest và GoogleTokenPayload DTOs**
  - `GoogleLoginRequest`: `@NotBlank(message = "ID_TOKEN_REQUIRED") String idToken`.
  - `GoogleTokenPayload`: `sub`, `email`, `fullName`, `avatarUrl`, `emailVerified`.

- [ ] **Step 2: Viết Unit Test cho GoogleTokenVerifierService (Red)**
Tạo `GoogleTokenVerifierServiceTest.java` kiểm thử:
  - Khi token null hoặc rỗng -> ném `INVALID_GOOGLE_TOKEN`.
  - Khi `email_verified == false` -> ném `GOOGLE_EMAIL_NOT_VERIFIED`.
  - Khi token giải mã thành công -> trả về đúng `GoogleTokenPayload`.

- [ ] **Step 3: Triển khai GoogleTokenVerifierServiceImpl (Green)**
Khởi tạo `GoogleIdTokenVerifier` bằng `NetHttpTransport` và `GsonFactory`, cấu hình audience với `app.google.client-id`.
Thực hiện verify và trích xuất claims `sub`, `email`, `name`, `picture`, `email_verified`.

- [ ] **Step 4: Chạy test GoogleTokenVerifierServiceTest**
Chạy `./mvnw test -Dtest=GoogleTokenVerifierServiceTest` và xác nhận PASS.

---

### Task 3: AuthenService Google Login Logic (TDD)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/AuthenService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/AuthenServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/service/AuthenServiceGoogleLoginTest.java`

**Interfaces:**
- Consumes: `GoogleTokenVerifierService.verify(idToken)`
- Produces: `AuthenService.loginWithGoogle(GoogleLoginRequest request): AuthenticationResponse`

- [ ] **Step 1: Viết bộ Unit Test cho AuthenServiceGoogleLoginTest (Red)**
Kiểm thử 4 kịch bản trọng tâm:
  - `testLoginWithGoogle_NewUser_Success`: User chưa có trong DB -> Tạo mới với `role = USER`, `isActive = true`, `googleId = sub`, sinh AccessToken & RefreshToken.
  - `testLoginWithGoogle_ExistingGoogleUser_Success`: User đã có `googleId` -> Cập nhật `lastLoginAt`, trả về Tokens.
  - `testLoginWithGoogle_ExistingEmailUser_AutoLink_Success`: User đã có theo email (googleId rỗng) -> Tự động gắn `googleId`, giữ nguyên mật khẩu cũ và role, trả về Tokens.
  - `testLoginWithGoogle_InactiveUser_ThrowsException`: User có `isActive = false` -> Ném `AppException(ErrorCode.ACCOUNT_INACTIVE)`.

- [ ] **Step 2: Khai báo interface AuthenService**
Thêm `AuthenticationResponse loginWithGoogle(GoogleLoginRequest request);` vào `AuthenService.java`.

- [ ] **Step 3: Triển khai AuthenServiceImpl.loginWithGoogle (Green)**
  - Gọi `googleTokenVerifierService.verify(request.getIdToken())`.
  - Tìm kiếm theo `userRepository.findByGoogleId(payload.getSub())`.
  - Nếu không thấy, tìm kiếm theo `userRepository.findByEmail(payload.getEmail())`:
    - Nếu tìm thấy: Liên kết `user.setGoogleId(payload.getSub())`. Nếu `user.getAvatarUrl() == null` thì cập nhật thêm avatar.
  - Nếu không thấy cả hai:
    - Tìm role `USER` từ `roleRepository.findByName(RoleName.USER.name())`.
    - Tạo mới `User` với `googleId`, `email`, `fullName`, `avatarUrl`, `role`, `isActive=true`, `passwordHash=null`.
  - Kiểm tra `!user.getIsActive()` -> Ném `ACCOUNT_INACTIVE`.
  - Cập nhật `user.setLastLoginAt(Instant.now())`, lưu `userRepository.save(user)`.
  - Sinh JWT Access Token và Refresh Token như phương thức `login()`.

- [ ] **Step 4: Chạy test AuthenServiceGoogleLoginTest**
Chạy `./mvnw test -Dtest=AuthenServiceGoogleLoginTest` và xác nhận tất cả kịch bản PASS.

---

### Task 4: Backend AuthenController & SecurityConfig (TDD)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/AuthenController.java`
- Modify: `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/controller/AuthenControllerGoogleLoginTest.java`

**Interfaces:**
- Produces: `POST /api/auth/google` (HTTP 200 kèm Set-Cookie refresh_token).

- [ ] **Step 1: Viết Controller Integration Test (Red)**
Tạo `AuthenControllerGoogleLoginTest.java` dùng MockMvc:
  - `POST /api/auth/google` với payload hợp lệ -> HTTP 200, có `accessToken` và cookie `refresh_token`.
  - `POST /api/auth/google` với `idToken` rỗng -> HTTP 400 Bad Request.

- [ ] **Step 2: Thêm endpoint vào AuthenController (Green)**
Thêm:
```java
@PostMapping("/google")
public ResponseEntity<ApiResponse<AuthenticationResponse>> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
    AuthenticationResponse response = authenService.loginWithGoogle(request);
    ResponseCookie cookie = ResponseCookie.from("refresh_token", response.getRefreshToken())
            .httpOnly(true)
            .secure(false)
            .path("/api/auth")
            .maxAge(refreshTokenExpirationMs / 1000)
            .build();
    return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .body(ApiResponse.success(response));
}
```

- [ ] **Step 3: Cấu hình SecurityConfig**
Đảm bảo `/api/auth/google` được phép truy cập không cần xác thực (`permitAll()`).

- [ ] **Step 4: Chạy test AuthenControllerGoogleLoginTest**
Chạy `./mvnw test -Dtest=AuthenControllerGoogleLoginTest` và xác nhận PASS.

---

### Task 5: Frontend Google OAuth Integration

**Files:**
- Modify: `frontend/package.json` (Cài `@react-oauth/google`)
- Modify: `frontend/src/features/auth/types/index.ts`
- Modify: `frontend/src/features/auth/api/authApi.ts`
- Modify: `frontend/src/main.tsx` hoặc `frontend/src/app/App.tsx` (Bọc `GoogleOAuthProvider`)
- Modify: `frontend/src/features/auth/components/LoginForm.tsx`
- Modify: `frontend/src/features/auth/components/RegisterForm.tsx`

**Interfaces:**
- Produces: Luồng Google Login trên UI, dispatch `setCredentials`, điều hướng người dùng.

- [ ] **Step 1: Cài đặt thư viện @react-oauth/google**
Chạy lệnh `npm install @react-oauth/google` tại thư mục `frontend`.

- [ ] **Step 2: Cập nhật types và authApi**
  - Thêm `GoogleLoginRequest { idToken: string }` vào `frontend/src/features/auth/types/index.ts`.
  - Thêm `loginWithGoogle: (data: GoogleLoginRequest) => axiosClient.post('/auth/google', data)` vào `frontend/src/features/auth/api/authApi.ts`.

- [ ] **Step 3: Bọc ứng dụng với GoogleOAuthProvider**
Trong `frontend/src/main.tsx`, bọc `<App />` với `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "test-google-client-id"}>`.

- [ ] **Step 4: Tích hợp sự kiện Google Login vào LoginForm.tsx**
Sử dụng `useGoogleLogin` hoặc Google Button của `@react-oauth/google`.
Khi đăng nhập thành công nhận credential:
  - Gọi mutation `loginWithGoogle`.
  - Dispatch `setCredentials(data)`.
  - Hiển thị Toast thành công.
  - Điều hướng tới `/student` (hoặc `/admin`).

- [ ] **Step 5: Tích hợp sự kiện Google Register vào RegisterForm.tsx**
Tương tự `LoginForm.tsx`, gắn handler Google vào nút "Đăng ký bằng Google".

- [ ] **Step 6: Kiểm tra Frontend Build**
Chạy `npm run build` tại thư mục `frontend` và xác nhận không có lỗi TypeScript.

---

### Task 6: Comprehensive Verification & Regression Check

**Files:**
- Test: Toàn bộ Unit & Integration tests

- [ ] **Step 1: Chạy kiểm thử Backend**
Chạy `./mvnw clean test` trên toàn bộ dự án backend, chứng minh BUILD SUCCESS.

- [ ] **Step 2: Chạy kiểm thử Frontend**
Chạy `npm run test` (nếu có) và `npm run build`.

- [ ] **Step 3: Đối soát Bảng 12 Test Cases (TC_AUTH_GOOGLE_01 đến TC_AUTH_GOOGLE_12)**
Kiểm tra tất cả 12 kịch bản trong tài liệu AC đã được bảo đảm.

- [ ] **Step 4: Báo cáo kết quả và tóm tắt diff trước khi commit**
Hiển thị diff chi tiết và xin xác nhận của người dùng trước khi tạo commit.
### Đề xuất phân chia Commit (Theo quy định kiểm duyệt trước commit)

#### Commit 1: Tài liệu Spec, AC & Kế hoạch
- **Commit Message:** `docs(auth): add specification, acceptance criteria and implementation plan for google oauth2`
- **Danh sách files:**
  - `docs/superpowers/specs/2026-10-14-google-login-spec.md`
  - `docs/superpowers/specs/2026-10-14-google-login-AC.md`
  - `docs/superpowers/plans/2026-10-14-google-login-plan.md`

#### Commit 2: Backend Google OAuth2 Authentication
- **Commit Message:** `feat(auth): implement backend google oauth2 login with token verification and account linking`
- **Danh sách files:**
  - `backend/pom.xml` (thêm `google-api-client:2.7.0`)
  - `backend/src/main/resources/application.properties` (thêm `app.google.client-id`)
  - `backend/src/main/java/.../ErrorCode.java` (thêm mã lỗi 920, 921, 922)
  - `backend/src/main/java/.../SecurityConfig.java` (mở quyền `POST /api/auth/google`)
  - `backend/src/main/java/.../GoogleLoginRequest.java` & `GoogleTokenPayload.java`
  - `backend/src/main/java/.../GoogleTokenVerifierService.java` & `impl/GoogleTokenVerifierServiceImpl.java`
  - `backend/src/main/java/.../AuthenService.java` & `impl/AuthenServiceImpl.java`
  - `backend/src/main/java/.../AuthenController.java`
  - 3 file Unit/Integration Tests: `GoogleTokenVerifierServiceTest.java`, `AuthenServiceGoogleLoginTest.java`, `AuthenControllerGoogleLoginTest.java`

#### Commit 3: Frontend Google Identity Services Integration
- **Commit Message:** `feat(auth): integrate google identity services in login and register forms`
- **Danh sách files:**
  - `frontend/package.json` & `frontend/package-lock.json` (thêm `@react-oauth/google`)
  - `frontend/.env.example`
  - `frontend/src/main.tsx` (bọc `GoogleOAuthProvider`)
  - `frontend/src/features/auth/types/index.ts` (thêm `GoogleLoginRequest`)
  - `frontend/src/features/auth/api/authApi.ts` (thêm `loginWithGoogle`)
  - `frontend/src/features/auth/components/LoginForm.tsx` (tích hợp `GoogleLogin` & mutation)
  - `frontend/src/features/auth/components/RegisterForm.tsx` (tích hợp `GoogleLogin` & mutation)

