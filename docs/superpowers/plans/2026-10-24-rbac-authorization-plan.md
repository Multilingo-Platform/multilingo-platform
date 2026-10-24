# RBAC Authorization Without Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế phân quyền dựa trên vai trò (RBAC) gọn nhẹ không cần permission: nhúng claim `role` vào JWT Access Token, bảo vệ toàn diện các endpoint Admin ở Backend và bảo vệ các route `/admin` ở Frontend với xử lý 403 Forbidden chuẩn hóa.

**Architecture:** Sử dụng kiến trúc Stateless JWT kết hợp Spring Security 6 / Spring Boot 3.3. `JwtTokenProvider` bổ sung claim `role` ("ADMIN", "USER") và `userId`. `JwtAccessDeniedHandler` và `GlobalExceptionHandler` chuẩn hóa phản hồi 403 thành `ApiResponse(ErrorCode.FORBIDDEN)`. Phía Frontend React Router sử dụng `ProtectedRoute` với tham số `allowedRoles?: string[]` để ngăn chặn truy cập trái phép.

**Tech Stack:** Java 17, Spring Boot 3.3, Spring Security 6, JJWT 0.12.5, JUnit 5, Mockito, React 19, React Router 7, Redux Toolkit, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-24-rbac-authorization-spec.md`
**Acceptance Criteria & Test Cases:** `docs/superpowers/specs/2026-10-24-rbac-authorization-AC.md`

## Global Constraints
- Primary Key của các Entity kế thừa `BaseEntity` (Integer id).
- Mọi Controller response trả về cấu trúc bọc `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ và lỗi phân quyền ném `AppException(ErrorCode.XYZ)` hoặc bắt tập trung tại `GlobalExceptionHandler` / `JwtAccessDeniedHandler`.
- Phản hồi 403 Forbidden bắt buộc tuân theo format: `{"code": 403, "message": "Không có quyền thực hiện thao tác", "data": null}`.
- Không sửa đổi hay phụ thuộc vào bảng `permissions` hay `role_permissions` (tuân thủ nguyên tắc YAGNI).
- Trước khi commit phải hiển thị diff và xin phê duyệt của người dùng.

## Review Focus
1. **User Token mang role USER gọi API Admin:** Phải trả về đúng 403 Forbidden kèm body JSON `ApiResponse` (không được trả HTML trắng hoặc lỗi 500 do unhandled AccessDeniedException).
2. **Khách vãng lai (Guest) không gửi token gọi API Admin:** Phải trả về đúng 401 Unauthorized (`ErrorCode.UNAUTHENTICATED_ACCESS`).
3. **Lấy trực tiếp Role từ CSDL:** CSDL luôn lưu chuẩn `ADMIN` và `USER`, `JwtTokenProvider` lấy trực tiếp `user.getRole().getName()`, không cần xử lý cắt bỏ tiền tố `ROLE_`.
4. **Token hết hạn hoặc bị sửa đổi signature:** Phải bị từ chối 401 ngay tại `JwtAuthenticationFilter`, không được lọt vào tầng Access Control.
5. **Frontend URL Direct Navigation:** Học viên gõ trực tiếp URL `/admin/dashboard` trên thanh địa chỉ phải bị chuyển hướng về `/student/dashboard` kèm Toast cảnh báo rõ ràng.

---

### Task 1: Bổ sung Claim `role` & `userId` vào `JwtTokenProvider` và phương thức trích xuất

**Files:**
- Create: `backend/src/test/java/com/multilingo/backend/modules/auth/security/JwtTokenProviderRoleTest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/security/JwtTokenProvider.java`

**Interfaces:**
- Consumes: `com.multilingo.backend.modules.auth.entity.User`, `com.multilingo.backend.modules.auth.entity.Role`
- Produces: 
  - `JwtTokenProvider.generateToken(User user): String` (chứa claim `role` và `userId`)
  - `JwtTokenProvider.getRoleFromJWT(String token): String`
  - `JwtTokenProvider.getUserIdFromJWT(String token): Integer`

- [ ] **Step 1: Viết test thất bại (Failing Test)**

Tạo file `backend/src/test/java/com/multilingo/backend/modules/auth/security/JwtTokenProviderRoleTest.java`:
```java
package com.multilingo.backend.modules.auth.security;

import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderRoleTest {

    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", "ThisIsAVeryLongSecretKeyForTestingHS256AlgorithmMustBe32BytesLong");
        ReflectionTestUtils.setField(tokenProvider, "jwtExpirationInMs", 3600000L);
    }

    @Test
    @DisplayName("generateToken phải chứa claim role và userId")
    void generateToken_ShouldContainRoleAndUserIdClaims() {
        Role adminRole = Role.builder().name("ADMIN").build();
        User admin = User.builder()
                .email("admin@multilingo.com")
                .role(adminRole)
                .build();
        ReflectionTestUtils.setField(admin, "id", 99);

        String token = tokenProvider.generateToken(admin);

        assertNotNull(token);
        assertEquals("admin@multilingo.com", tokenProvider.getEmailFromJWT(token));
        assertEquals("ADMIN", tokenProvider.getRoleFromJWT(token));
        assertEquals(99, tokenProvider.getUserIdFromJWT(token));
    }

    @Test
    @DisplayName("generateToken fallback role USER nếu user không có role")
    void generateToken_ShouldFallbackToUserRoleIfNull() {
        User userWithoutRole = User.builder()
                .email("norole@multilingo.com")
                .role(null)
                .build();

        String token = tokenProvider.generateToken(userWithoutRole);

        assertEquals("USER", tokenProvider.getRoleFromJWT(token));
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận test FAIL**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=JwtTokenProviderRoleTest
```
Kỳ vọng: Test biên dịch lỗi hoặc FAIL do `getRoleFromJWT` và `getUserIdFromJWT` chưa tồn tại trong `JwtTokenProvider`.

- [ ] **Step 3: Triển khai mã nguồn tối thiểu để test PASS**

Cập nhật `backend/src/main/java/com/multilingo/backend/modules/auth/security/JwtTokenProvider.java`:
```java
    public String generateToken(User user) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationInMs);

        String roleName = (user.getRole() != null && user.getRole().getName() != null)
                ? user.getRole().getName()
                : "USER";

        var builder = Jwts.builder()
                .subject(user.getEmail())
                .id(UUID.randomUUID().toString())
                .claim("role", roleName)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey());

        if (user.getId() != null) {
            builder.claim("userId", user.getId());
        }

        return builder.compact();
    }

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

- [ ] **Step 4: Chạy lại test để xác nhận PASS**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=JwtTokenProviderRoleTest
```
Kỳ vọng: `Tests run: 2, Failures: 0, Errors: 0, Skipped: 0` -> BUILD SUCCESS.

---

### Task 2: Tạo `JwtAccessDeniedHandler` và cấu hình 403 Forbidden trong `GlobalExceptionHandler`

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/security/JwtAccessDeniedHandler.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/auth/security/JwtAccessDeniedHandlerTest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/GlobalExceptionHandler.java`

**Interfaces:**
- Consumes: `org.springframework.security.web.access.AccessDeniedHandler`, `org.springframework.security.access.AccessDeniedException`, `ErrorCode.FORBIDDEN`
- Produces: 
  - `JwtAccessDeniedHandler`: Trả về JSON 403 `ApiResponse` khi request bị chặn bởi Filter Chain
  - `GlobalExceptionHandler.handleAccessDeniedException(...)`: Bắt ngoại lệ `AccessDeniedException` từ Controller method security và trả 403 `ApiResponse`

- [ ] **Step 1: Viết test thất bại (Failing Test) cho JwtAccessDeniedHandler**

Tạo file `backend/src/test/java/com/multilingo/backend/modules/auth/security/JwtAccessDeniedHandlerTest.java`:
```java
package com.multilingo.backend.modules.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;

class JwtAccessDeniedHandlerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final JwtAccessDeniedHandler accessDeniedHandler = new JwtAccessDeniedHandler(objectMapper);

    @Test
    @DisplayName("handle phải ghi HTTP 403 và trả về ApiResponse của ErrorCode.FORBIDDEN")
    void handle_ShouldWriteForbiddenApiResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/admin/exams");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AccessDeniedException exception = new AccessDeniedException("Access Denied");

        accessDeniedHandler.handle(request, response, exception);

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));
        String json = response.getContentAsString();
        assertTrue(json.contains("\"code\":403"));
        assertTrue(json.contains("Không có quyền thực hiện thao tác"));
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận test FAIL**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=JwtAccessDeniedHandlerTest
```
Kỳ vọng: Lỗi biên dịch vì chưa có class `JwtAccessDeniedHandler`.

- [ ] **Step 3: Triển khai `JwtAccessDeniedHandler` và cập nhật `GlobalExceptionHandler`**

Tạo `backend/src/main/java/com/multilingo/backend/modules/auth/security/JwtAccessDeniedHandler.java`:
```java
package com.multilingo.backend.modules.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.common.exception.ErrorCode;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException, ServletException {
        log.warn("Truy cập bị từ chối (403) tại URI: {} - Lỗi: {}", request.getRequestURI(), accessDeniedException.getMessage());

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());

        ApiResponse<Void> apiResponse = ApiResponse.error(
                ErrorCode.FORBIDDEN.getCode(),
                ErrorCode.FORBIDDEN.getMessage()
        );

        response.getWriter().write(objectMapper.writeValueAsString(apiResponse));
    }
}
```

Cập nhật `backend/src/main/java/com/multilingo/backend/common/exception/GlobalExceptionHandler.java`:
Thêm import và phương thức xử lý `AccessDeniedException`:
```java
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(org.springframework.security.access.AccessDeniedException ex) {
        log.warn("Quyền truy cập bị từ chối (AccessDeniedException): {}", ex.getMessage());
        ErrorCode errorCode = ErrorCode.FORBIDDEN;
        ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), errorCode.getMessage());
        return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
    }
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=JwtAccessDeniedHandlerTest
```
Kỳ vọng: BUILD SUCCESS.

---

### Task 3: Cấu hình URL Authorization & Exception Handling trong `SecurityConfig`

**Files:**
- Create: `backend/src/test/java/com/multilingo/backend/modules/auth/security/SecurityRbacAuthorizationIT.java`
- Modify: `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`

**Interfaces:**
- Consumes: `JwtAccessDeniedHandler`, `JwtAuthenticationEntryPoint`, `SecurityFilterChain`
- Produces: 
  - Đăng ký `accessDeniedHandler(jwtAccessDeniedHandler)` trong `exceptionHandling`
  - URL pattern `.requestMatchers("/api/admin/**", "/api/v1/admin/**").hasRole("ADMIN")`

- [ ] **Step 1: Viết test thất bại (Failing Integration Test)**

Tạo file `backend/src/test/java/com/multilingo/backend/modules/auth/security/SecurityRbacAuthorizationIT.java`:
```java
package com.multilingo.backend.modules.auth.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityRbacAuthorizationIT {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Guest chưa đăng nhập gọi API admin phải nhận 401 UNAUTHENTICATED_ACCESS")
    void guestAccessAdminEndpoint_ShouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exams"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(909));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("User thường gọi API admin phải nhận 403 FORBIDDEN")
    void userAccessAdminEndpoint_ShouldReturn403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/exams"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("Không có quyền thực hiện thao tác"));
    }
}
```

- [ ] **Step 2: Chạy test để xác nhận test FAIL**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=SecurityRbacAuthorizationIT
```
Kỳ vọng: Test `userAccessAdminEndpoint_ShouldReturn403` FAIL vì `SecurityConfig` chưa cấu hình chặn URL admin với `hasRole("ADMIN")` hoặc chưa trả về body chuẩn.

- [ ] **Step 3: Cập nhật `SecurityConfig.java`**

Cập nhật `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`:
1. Thêm `private final JwtAccessDeniedHandler jwtAccessDeniedHandler;` vào constructor.
2. Cấu hình exceptionHandling và authorizeHttpRequests:
```java
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                .accessDeniedHandler(jwtAccessDeniedHandler)
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/health", "/api/test/**", "/api/auth/login", "/api/auth/google", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/refresh-token").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                .requestMatchers("/api/v1/billing/vnpay/ipn").permitAll()
                .requestMatchers("/api/admin/**", "/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            );

        http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy lệnh:
```bash
cd backend && ./mvnw test -Dtest=SecurityRbacAuthorizationIT
```
Kỳ vọng: BUILD SUCCESS (cả 2 test case 401 và 403 đều pass).

---

### Task 4: Nâng cấp `ProtectedRoute` trên Frontend hỗ trợ `allowedRoles`

**Files:**
- Create: `frontend/src/features/auth/components/__tests__/ProtectedRoute.test.tsx`
- Modify: `frontend/src/features/auth/components/ProtectedRoute.tsx`

**Interfaces:**
- Consumes: Redux `RootState` (`auth.user`, `auth.isAuthenticated`, `auth.token`)
- Produces: `ProtectedRoute({ allowedRoles?: string[] })`

- [ ] **Step 1: Viết test thất bại (Failing Test) cho ProtectedRoute**

Tạo file `frontend/src/features/auth/components/__tests__/ProtectedRoute.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import ProtectedRoute from '../ProtectedRoute';
import { describe, it, expect, vi } from 'vitest';

const createMockStore = (authState: any) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: authState
    }
  });
};

describe('ProtectedRoute RBAC', () => {
  it('Chưa đăng nhập -> Điều hướng sang /login', () => {
    const store = createMockStore({
      isAuthenticated: false,
      token: null,
      user: null
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Trang Đăng Nhập</div>} />
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Trang Đăng Nhập')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });

  it('Đã đăng nhập với role USER nhưng vào trang yêu cầu ADMIN -> Chuyển hướng sang /student/dashboard', () => {
    const store = createMockStore({
      isAuthenticated: true,
      token: 'fake-token',
      user: { id: '1', email: 'user@multilingo.com', role: 'USER' }
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route path="/student/dashboard" element={<div>Student Dashboard</div>} />
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });

  it('Đã đăng nhập với role ADMIN vào trang yêu cầu ADMIN -> Cho phép truy cập', () => {
    const store = createMockStore({
      isAuthenticated: true,
      token: 'admin-token',
      user: { id: '2', email: 'admin@multilingo.com', role: 'ADMIN' }
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test FAIL**

Chạy lệnh:
```bash
cd frontend && npm test -- src/features/auth/components/__tests__/ProtectedRoute.test.tsx
```
Kỳ vọng: Test FAIL vì `ProtectedRoute` chưa hỗ trợ prop `allowedRoles`.

- [ ] **Step 3: Cập nhật `ProtectedRoute.tsx`**

Cập nhật `frontend/src/features/auth/components/ProtectedRoute.tsx`:
```tsx
import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { alertUtil } from '../../../utils/alert';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const token = localStorage.getItem('token');

  const isUserAuthenticated = isAuthenticated || Boolean(token);

  if (!isUserAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role ? user.role.toUpperCase() : 'USER';
    const isAllowed = allowedRoles.some(r => r.toUpperCase() === userRole);

    if (!isAllowed) {
      alertUtil.toast('Bạn không có quyền truy cập trang này!', 'error');
      const fallbackRedirect = userRole === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard';
      return <Navigate to={fallbackRedirect} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Chạy lệnh:
```bash
cd frontend && npm test -- src/features/auth/components/__tests__/ProtectedRoute.test.tsx
```
Kỳ vọng: PASS cả 3 bài test.

---

### Task 5: Tích hợp `ProtectedRoute` vào `router.tsx` và nghiệm thu toàn diện

**Files:**
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `<ProtectedRoute allowedRoles={["ADMIN"]} />`, `<ProtectedRoute allowedRoles={["USER", "ADMIN"]} />`
- Produces: Bảo vệ toàn bộ các nhánh `/admin` và `/student` trong hệ thống định tuyến

- [ ] **Step 1: Cập nhật `router.tsx`**

Cập nhật `frontend/src/app/router.tsx`:
Bọc các route `/student` và `/admin` với `ProtectedRoute`:
```tsx
  // --- MÀN HÌNH STUDENT ---
  {
    path: "/student",
    element: <ProtectedRoute allowedRoles={["USER", "ADMIN"]} />,
    children: [
      {
        element: <UserLayout />,
        children: [
          { path: "library", element: <ExamLibrary /> },
          { path: "history", element: <TestHistory /> },
          { path: "dashboard", element: <StudentDashboardPage /> },
          { path: "flashcards", element: <FlashcardsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "premium", element: <PremiumUpgradePage /> },
          { path: "payment/result", element: <PaymentResultPage /> },
          { path: "purchase-history", element: <PurchaseHistoryPage /> },
        ],
      },
    ],
  },

  // --- MÀN HÌNH ADMIN ---
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
          { path: "tracking", element: <TrackingAnalyticsPage /> },
          { path: "transactions", element: <TransactionReconciliationPage /> },
          { path: "quotas", element: <QuotaSettingsPage /> },
          { path: "settings", element: <QuotaSettingsPage /> },
          { path: "audit", element: <AuditLogPage /> },
          { path: "exams", element: <ExamManagement /> },
          { path: "exams/create", element: <ExamBuilderPage /> },
          { path: "exams/edit/:id", element: <ExamBuilderPage /> },
          { path: "premium", element: <AdminPremiumPage /> },
        ],
      },
    ],
  },
```

- [ ] **Step 2: Chạy kiểm thử toàn bộ Frontend**

Chạy lệnh:
```bash
cd frontend && npm run test && npm run lint && npm run build
```
Kỳ vọng: Toàn bộ bài test của Frontend PASS, không có lỗi TypeScript hay build error.

- [ ] **Step 3: Chạy kiểm thử toàn bộ Backend**

Chạy lệnh:
```bash
cd backend && ./mvnw clean test
```
Kỳ vọng: `BUILD SUCCESS`, tất cả unit tests và integration tests đều PASS.
