# Profile Management Implementation Plan (UC04, UC04.1, UC04.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai các tính năng Xem thông tin, Cập nhật thông tin (Họ tên, SĐT) và Đổi mật khẩu cho người dùng hiện tại (UC04, UC04.1, UC04.2) bao gồm cả Frontend (UI Settings) và Backend (API, Controller, Service).

**Architecture:** Mở rộng `UserController` bằng 2 endpoint `PUT /me` và `PUT /me/password`. Frontend sử dụng tab view trong `SettingsPage` để người dùng quản lý tài khoản, liên kết Redux / React Query để đồng bộ.

**Tech Stack:** React (Frontend), Spring Boot 3 + Spring Security (Backend), JWT.

**Spec:** `docs/superpowers/specs/2026-10-06-profile-management-AC.md`

## Global Constraints
- **Java:** Các API trả về chuẩn `ResponseEntity<ApiResponse<T>>`.
- **Lỗi nghiệp vụ:** Phải ném `AppException` và xử lý qua `GlobalExceptionHandler`.
- **Frontend:** Feature-based, dùng Tailwind / CSS modules, i18n đầy đủ.

## Review Focus
- **SĐT sai định dạng:** API Backend cần trả về 400 Bad Request. Test: Gọi PUT `/me` với SĐT chứa chữ.
- **Mật khẩu cũ không đúng:** API trả về AppException(ErrorCode.PASSWORD_NOT_MATCH). Test: Gọi PUT `/me/password` với mật khẩu cũ sai.
- **Bảo mật SQL/XSS:** Các field Text phải được sanitize. Test: Update fullname chứa ký tự `<script>`.

---

### Task 1: API Cập nhật Thông tin cá nhân (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/request/UpdateProfileRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/UserService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/UserServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/UserController.java`

**Interfaces:**
- Produces: `PUT /api/users/me` nhận `UpdateProfileRequest` trả về `UserResponse`.

- [ ] **Step 1: Tạo DTO UpdateProfileRequest**
Tạo DTO với 2 field `fullName` (NotBlank, 2-50 ký tự) và `phone` (Pattern regex định dạng VN).

- [ ] **Step 2: Cập nhật UserService và UserServiceImpl**
Thêm hàm `updateMyInfo(UpdateProfileRequest request)` vào Interface và Impl. Lấy thông tin user hiện tại qua `SecurityContextHolder`, cập nhật fullName và phone, sau đó `userRepository.save()` và convert sang `UserResponse`.

- [ ] **Step 3: Cập nhật UserController**
Thêm `@PutMapping("/me")` ánh xạ xuống `userService.updateMyInfo(request)`.

- [ ] **Step 4: Chạy test hoặc kiểm tra cú pháp**
Chạy `./mvnw test` (nếu có test) hoặc `./mvnw clean compile` để đảm bảo code build thành công.

---

### Task 2: API Đổi mật khẩu (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/request/ChangePasswordRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/UserService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/UserServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/UserController.java`

**Interfaces:**
- Produces: `PUT /api/users/me/password` nhận `ChangePasswordRequest`.

- [ ] **Step 1: Định nghĩa DTO và ErrorCode**
- Tạo `ChangePasswordRequest` chứa `oldPassword`, `newPassword` (NotBlank, size 6-64), `confirmPassword`.
- Thêm error code: `PASSWORD_NOT_MATCH`, `NEW_PASSWORD_MISMATCH` vào `ErrorCode.java`.

- [ ] **Step 2: Cập nhật UserService và Impl**
Thêm `changePassword(ChangePasswordRequest request)`. Inject `PasswordEncoder`.
- Validate `newPassword == confirmPassword`.
- Lấy user hiện tại, check `passwordEncoder.matches(oldPassword, user.getPassword())`.
- Mã hóa `newPassword` và lưu.

- [ ] **Step 3: Cập nhật UserController**
Thêm `@PutMapping("/me/password")` ánh xạ xuống hàm vừa tạo.

- [ ] **Step 4: Đảm bảo build thành công**
Chạy `./mvnw clean compile`.

---

### Task 3: Cấu hình API và Types trên Frontend (React Query)

**Files:**
- Modify: `frontend/src/features/auth/types/index.ts`
- Modify: `frontend/src/features/auth/api/authApi.ts`

**Interfaces:**
- Consumes: `PUT /api/users/me`, `PUT /api/users/me/password`.

- [ ] **Step 1: Cập nhật Type Frontend**
Bổ sung `UpdateProfileRequest` và `ChangePasswordRequest` vào `types/index.ts` tương ứng với DTO Backend.

- [ ] **Step 2: Bổ sung call API**
Thêm `updateMyInfo` và `changePassword` vào đối tượng `authApi` sử dụng thư viện `axios` có sẵn.

---

### Task 4: Dịch thuật Đa ngôn ngữ (i18n Frontend)

**Files:**
- Modify: `frontend/src/locales/vi/translation.json`
- Modify: `frontend/src/locales/en/translation.json`

**Interfaces:**
- Produces: Ngữ cảnh i18n cho SettingsPage.

- [ ] **Step 1: Bổ sung block "settings" cho tiếng Việt**
Các thông báo, title, tab "Thông tin chung", "Đổi mật khẩu", placeholder, alert success/error.

- [ ] **Step 2: Bổ sung block "settings" cho tiếng Anh**
Tương tự tiếng Việt.

---

### Task 5: Xây dựng Giao diện SettingsPage (Frontend)

**Files:**
- Create: `frontend/src/features/auth/pages/SettingsPage.tsx`
- Create: `frontend/src/features/auth/components/ProfileForm.tsx`
- Create: `frontend/src/features/auth/components/PasswordForm.tsx`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: i18n, authApi, alertUtil.

- [ ] **Step 1: Xây dựng ProfileForm.tsx**
Form quản lý (fullName, phone, readonly email). Gọi mutation `authApi.updateMyInfo`. Thành công `queryClient.invalidateQueries({ queryKey: ['myInfo'] })`.

- [ ] **Step 2: Xây dựng PasswordForm.tsx**
Form quản lý (oldPassword, newPassword, confirmPassword). Gọi mutation `authApi.changePassword`.

- [ ] **Step 3: Xây dựng SettingsPage.tsx tổng hợp**
Thiết kế trang có Sidebar hoặc Tabs dọc/ngang để chuyển đổi giữa 2 components trên. Lấy thông tin user hiện hành truyền xuống `ProfileForm`.

- [ ] **Step 4: Cập nhật Router**
Khai báo route `/student/settings` trong `router.tsx` trỏ tới `SettingsPage` (bên trong `UserLayout`).

- [ ] **Step 5: Kiểm tra build TypeScript**
Chạy `npx tsc --noEmit` để đảm bảo code an toàn, không có lỗi interface.
