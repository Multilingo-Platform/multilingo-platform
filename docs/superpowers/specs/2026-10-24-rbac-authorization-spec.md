# Thiết Kế Kỹ Thuật: Phân Quyền Dựa Trên Vai Trò (Role-Based Access Control - RBAC) Không Cần Permission

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu
- **Nhúng Role vào JWT:** Hiện tại JWT Access Token của Multilingo chỉ chứa `subject` (email) và `jti` (UUID), chưa chứa thông tin vai trò (`role`). Cần bổ sung claim `"role": user.getRole().getName()` (ví dụ: `"ADMIN"`, `"USER"`) và `"userId": user.getId()` vào payload của JWT.
- **Bảo vệ Endpoint Backend (RBAC):** Thiết lập kiểm soát truy cập nghiêm ngặt tại Backend:
  - Chỉ người dùng có vai trò `ADMIN` mới được truy cập các endpoint quản trị (`/api/admin/**`, `/api/v1/admin/**`, các controller gắn `@PreAuthorize("hasRole('ADMIN')")`).
  - Người dùng có vai trò `USER` hoặc `ADMIN` truy cập các endpoint học viên và dùng chung.
  - Khách vãng lai (`GUEST`) chỉ được truy cập các endpoint công khai (Public API: đăng nhập, đăng ký, quên mật khẩu, xem danh sách đề thi công khai).
- **Chuẩn hóa Xử lý Lỗi 403 Forbidden:** Khi người dùng đã đăng nhập nhưng không đủ quyền thực hiện thao tác, Backend bắt buộc trả về mã HTTP 403 Forbidden kèm cấu trúc chuẩn `ApiResponse<Void>` với `ErrorCode.FORBIDDEN` (code 403, message "Không có quyền thực hiện thao tác").
- **Bảo vệ Route Frontend (Role-based Route Guard):** Cập nhật `ProtectedRoute` trên React Router để ngăn chặn truy cập trái phép vào các trang `/admin/**`, tự động điều hướng về `/student/dashboard` hoặc `/login` và hiển thị cảnh báo phù hợp.
- **Tối giản hóa (YAGNI / K.I.S.S):** Tuân thủ yêu cầu "k cần permission", toàn bộ cơ chế xác thực và ủy quyền chỉ dựa trên `Role` của người dùng (1 User : 1 Role), không phụ thuộc vào bảng `role_permissions` hay `permissions`.

### 1.2. Bối cảnh & Hiện trạng hệ thống
- Database Schema (`V1__init_schema.sql`): Bảng `roles` (chứa `ADMIN`, `USER`), bảng `users` có cột `role_id NOT NULL REFERENCES roles(id)`.
- Backend:
  - `JwtTokenProvider.generateToken(User user)` hiện chỉ gán `subject(user.getEmail())`, thiếu claim `role`.
  - `JwtAuthenticationFilter` hiện đang truy vấn lại CSDL (`loadUserByUsername`) mỗi request để lấy User Details và Authorities.
  - `SecurityConfig` đã bật `@EnableMethodSecurity`, nhưng thiếu cấu hình `accessDeniedHandler` dẫn đến lỗi 403 trả về format mặc định của Spring hoặc lỗi 500 do `GlobalExceptionHandler` bắt chung `Exception.class`.
- Frontend:
  - Route `/admin` trong `frontend/src/app/router.tsx` hiện đang mở, không được bọc bởi `ProtectedRoute`.
  - `ProtectedRoute.tsx` hiện tại chỉ kiểm tra sự tồn tại của token trong `localStorage`, chưa kiểm tra vai trò `role`.

---

## 2. Actors & Phạm vi (Scope)

### 2.1. Actors (Tác nhân)
| Actor | Mô tả | Quyền hạn chính |
|---|---|---|
| **GUEST** (Khách vãng lai) | Người dùng chưa đăng nhập, chưa có token | Truy cập Landing Page, Đăng nhập, Đăng ký, Quên mật khẩu, Tra cứu đề thi public |
| **USER** (Học viên / Người dùng chuẩn) | Tài khoản thông thường có role `USER` | Làm bài thi, tra từ điển, học từ vựng, quản lý hồ sơ cá nhân, nâng cấp gói cước |
| **ADMIN** (Quản trị viên) | Quản trị viên hệ thống có role `ADMIN` | Quản trị người dùng, quản trị đề thi, thống kê đối soát thanh toán, cấu hình quota, xem audit log |

### 2.2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - **Backend:**
    - Cập nhật `JwtTokenProvider`: bổ sung claim `role` và `userId` khi tạo Access Token (`generateToken`); thêm method `getRoleFromJWT(String token)`.
    - Đồng bộ sinh token có claim `role` trong mọi luồng xác thực: Đăng nhập mật khẩu (`login`), Đăng nhập Google (`loginWithGoogle`), Làm mới token (`refreshToken`).
    - Tạo mới `JwtAccessDeniedHandler` (triển khai `org.springframework.security.web.access.AccessDeniedHandler`) để xử lý các yêu cầu bị từ chối ở tầng Filter Security, trả về JSON `ApiResponse(ErrorCode.FORBIDDEN)`.
    - Cập nhật `GlobalExceptionHandler`: bổ sung `@ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)` để bắt ngoại lệ 403 ở tầng Controller Method Security.
    - Cập nhật `SecurityConfig`: cấu hình `.accessDeniedHandler(jwtAccessDeniedHandler)` và phân quyền URL `.requestMatchers("/api/admin/**", "/api/v1/admin/**").hasRole("ADMIN")`.
    - Viết Unit Tests & Security Integration Tests xác nhận: Token sinh ra chứa đúng claim; Role `USER` truy cập API admin bị trả 403 `ApiResponse`; Role `ADMIN` truy cập thành công 200 OK.
  - **Frontend:**
    - Nâng cấp `ProtectedRoute.tsx` hỗ trợ thuộc tính `allowedRoles?: string[]`.
    - Cập nhật Redux `authSlice` và helper trích xuất vai trò `role` từ token hoặc `user` profile.
    - Áp dụng `ProtectedRoute` bọc các route `/admin/**` (yêu cầu `allowedRoles={['ADMIN']}`) và `/student/**` (yêu cầu xác thực hợp lệ).
    - Hiển thị Toast thông báo và chuyển hướng an toàn khi người dùng truy cập trái phép.
    - Viết kiểm thử tự động Frontend (Vitest) cho component `ProtectedRoute`.
- **Out-of-Scope:**
  - Phân quyền chi tiết theo Permission/Action code (bảng `permissions`, `role_permissions`).
  - Hỗ trợ đa vai trò (Multi-role) đồng thời cho một người dùng.
  - Giao diện Admin phân quyền động (Role Management UI).

---

## 3. Kiến Trúc Luồng & Giải Pháp Chi Tiết

### 3.1. Sơ đồ luồng phát hành Token chứa Role

```
[Client (Web)]             [AuthController]         [AuthenService]         [JwtTokenProvider]
      │                            │                       │                        │
      │── 1. POST /api/auth/login ─>│                       │                        │
      │   (email, password)        │── 2. login(...) ─────>│                        │
      │                            │                       │── 3. Check credentials │
      │                            │                       │   & Load User (Role)   │
      │                            │                       │                        │
      │                            │                       │── 4. generateToken(u) ─>│
      │                            │                       │   (add claim "role")   │
      │                            │                       │<── 5. Signed JWT ──────│
      │                            │<── 6. AuthResponse ───│                        │
      │<── 7. 200 OK (AccessToken) │                       │                        │
```

### 3.2. Sơ đồ luồng phân quyền và chặn 403 Forbidden tại Backend

```
[Client (Role: USER)]                                              [Spring Security Filter Chain]                   [Admin Controller]
         │                                                                       │                                           │
         │── 1. GET /api/v1/admin/exams (Bearer JWT) ───────────────────────────>│                                           │
         │                                                                       │── 2. JwtAuthenticationFilter:             │
         │                                                                       │     - Verify Token                        │
         │                                                                       │     - Load Authority: ROLE_USER           │
         │                                                                       │     - Set SecurityContext                 │
         │                                                                       │                                           │
         │                                                                       │── 3. Authorization Check:                 │
         │                                                                       │     - Endpoint requires: ROLE_ADMIN       │
         │                                                                       │     - Current has: ROLE_USER              │
         │                                                                       │     - Result: DENIED                      │
         │                                                                       │                                           │
         │                                                                       │── 4. Trigger JwtAccessDeniedHandler ──────│
         │<── 5. 403 Forbidden JSON ─────────────────────────────────────────────│                                           │
         │    { "code": 403, "message": "Không có quyền thực hiện thao tác" }    │                                           │
```

---

## 4. Đặc Tả Kỹ Thuật Chi Tiết (Technical Specifications)

### 4.1. Cấu trúc Payload của JWT Token
Token phát hành từ `JwtTokenProvider` sẽ có cấu trúc tiêu chuẩn:
```json
{
  "sub": "user@multilingo.com",
  "jti": "d3b07384-d113-4a44-93be-123456789abc",
  "userId": 12,
  "role": "ADMIN",
  "iat": 1729800000,
  "exp": 1729803600
}
```
- `sub`: Email của người dùng (giữ nguyên định danh hiện tại).
- `userId`: ID số tự tăng của User trong CSDL (thuận tiện cho việc trích xuất ID không cần truy vấn DB).
- `role`: Tên vai trò viết hoa (`ADMIN` hoặc `USER`).

### 4.2. Backend Components

#### 4.2.1. `JwtTokenProvider`
- Sửa đổi method `generateToken(User user)`:
  ```java
  public String generateToken(User user) {
      Date now = new Date();
      Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

      String roleName = (user.getRole() != null && user.getRole().getName() != null)
              ? user.getRole().getName()
              : "USER";

      return Jwts.builder()
              .subject(user.getEmail())
              .id(UUID.randomUUID().toString())
              .claim("userId", user.getId())
              .claim("role", roleName)
              .issuedAt(now)
              .expiration(expiryDate)
              .signWith(getSigningKey())
              .compact();
  }
  ```
- Bổ sung helper trích xuất:
  ```java
  public String getRoleFromJWT(String token) {
      Claims claims = Jwts.parser()
              .verifyWith(getSigningKey())
              .build()
              .parseSignedClaims(token)
              .getPayload();
      return claims.get("role", String.class);
  }

  public Integer getUserIdFromJWT(String token) {
      Claims claims = Jwts.parser()
              .verifyWith(getSigningKey())
              .build()
              .parseSignedClaims(token)
              .getPayload();
      return claims.get("userId", Integer.class);
  }
  ```

#### 4.2.2. `JwtAccessDeniedHandler`
Tạo mới tại `com.multilingo.backend.modules.auth.security.JwtAccessDeniedHandler`:
- Triển khai `org.springframework.security.web.access.AccessDeniedHandler`.
- Ghi log mức cảnh báo: `Truy cập bị từ chối (403) tại URI: ...`.
- Trả về mã HTTP 403, Content-Type `application/json;charset=UTF-8`, Body:
  ```json
  {
    "code": 403,
    "message": "Không có quyền thực hiện thao tác",
    "data": null
  }
  ```

#### 4.2.3. Cập nhật `GlobalExceptionHandler`
- Thêm method xử lý `AccessDeniedException`:
  ```java
  @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
  public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(org.springframework.security.access.AccessDeniedException ex) {
      log.warn("Quyền truy cập bị từ chối: {}", ex.getMessage());
      ErrorCode errorCode = ErrorCode.FORBIDDEN;
      ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), errorCode.getMessage());
      return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
  }
  ```

#### 4.2.4. Cập nhật `SecurityConfig`
- Tiêm thêm `JwtAccessDeniedHandler jwtAccessDeniedHandler`.
- Cấu hình exception handling:
  ```java
  .exceptionHandling(ex -> ex
      .authenticationEntryPoint(jwtAuthenticationEntryPoint)
      .accessDeniedHandler(jwtAccessDeniedHandler)
  )
  ```
- Cấu hình phân quyền URL:
  ```java
  .authorizeHttpRequests(auth -> auth
      .requestMatchers("/api/health", "/api/test/**", "/api/auth/login", "/api/auth/google", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/refresh-token").permitAll()
      .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users").permitAll()
      .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
      .requestMatchers("/api/v1/billing/vnpay/ipn").permitAll()
      .requestMatchers("/api/admin/**", "/api/v1/admin/**").hasRole("ADMIN")
      .anyRequest().authenticated()
  )
  ```

### 4.3. Frontend Components

#### 4.3.1. Nâng cấp `ProtectedRoute.tsx`
Tệp: `frontend/src/features/auth/components/ProtectedRoute.tsx`
- Nhận props: `allowedRoles?: string[]`.
- Logic kiểm tra:
  1. Kiểm tra xác thực: Nếu `!isAuthenticated` hoặc không có token -> Chuyển hướng sang `/login` (kèm `state: { from: location }`).
  2. Kiểm tra vai trò: Nếu có truyền `allowedRoles` và role của người dùng (`user?.role`) không nằm trong danh sách `allowedRoles`:
     - Hiển thị Toast cảnh báo: `Bạn không có quyền truy cập trang này!`
     - Điều hướng an toàn về `/student/dashboard` (nếu role là USER) hoặc `/admin/dashboard` (nếu role là ADMIN).
  3. Nếu hợp lệ: Render `<Outlet />`.

#### 4.3.2. Cập nhật `router.tsx`
- Bọc cấu trúc các route Admin:
  ```tsx
  {
    path: "/admin",
    element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: "dashboard", element: <AdminDashboardPage /> },
          { path: "users", element: <UserManagementPage /> },
          // ... các trang admin khác
        ]
      }
    ]
  }
  ```
- Bọc cấu trúc các route Student:
  ```tsx
  {
    path: "/student",
    element: <ProtectedRoute allowedRoles={["USER", "ADMIN"]} />,
    children: [
      {
        element: <UserLayout />,
        children: [
          { path: "library", element: <ExamLibrary /> },
          { path: "dashboard", element: <StudentDashboardPage /> },
          // ... các trang student khác
        ]
      }
    ]
  }
  ```

---

## 5. Kế Hoạch Kiểm Thử TDD & Nghiệm Thu
- **Unit Test Backend:**
  - `JwtTokenProviderTest`: Kiểm tra token tạo ra có claim `role` và `userId`; giải mã đúng giá trị.
  - `JwtAccessDeniedHandlerTest`: Kiểm tra việc ghi response status 403 và JSON body `ApiResponse`.
- **Integration Test Security Backend:**
  - `AdminEndpointSecurityIT`:
    - GUEST gửi request tới `/api/v1/admin/exams` -> 401 Unauthorized (`ApiResponse` code 909).
    - USER gửi request tới `/api/v1/admin/exams` -> 403 Forbidden (`ApiResponse` code 403).
    - ADMIN gửi request tới `/api/v1/admin/exams` -> 200 OK.
- **Frontend Test (Vitest):**
  - `ProtectedRoute.test.tsx`:
    - Khi chưa đăng nhập -> điều hướng về `/login`.
    - Khi đăng nhập với role `USER` truy cập route yêu cầu `ADMIN` -> điều hướng về `/student/dashboard` và thông báo lỗi.
    - Khi đăng nhập với role `ADMIN` truy cập route yêu cầu `ADMIN` -> hiển thị component con thành công.
