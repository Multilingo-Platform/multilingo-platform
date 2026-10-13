# Kế Hoạch Triển Khai Phân Hệ Quản Trị & Giám Sát (Analytics & Admin Portal Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hoàn chỉnh toàn bộ phân hệ Quản trị & Giám sát (Module `analytics` TV4 - LXT) trên cả Backend và Frontend, bao gồm 6 khối chức năng cốt lõi: Quản trị User & Khóa/Mở khóa, Tracking Học viên & Đề thi, Cấu hình Quota AI, Nhật ký Kiểm toán Audit Logs (kèm JSON Snapshot), Dashboard Vận hành & Doanh thu (DAU/MAU), Đối soát Giao dịch VNPAY & Xuất Excel định kỳ.

**Architecture:** 
- **Backend:** Module `com.multilingo.backend.modules.analytics`, tuân thủ Base Architecture (`BaseEntity`, `ApiResponse<T>`, `PageResponse<T>`, `AppException(ErrorCode)`). Áp dụng Audit Snapshot lưu trường JSONB trong PostgreSQL, bảo vệ phân quyền với `@PreAuthorize("hasRole('ADMIN')")`.
- **Frontend:** Feature-Sliced Design đặt tại `frontend/src/features/admin/` (chia các sub-features: `dashboard`, `users`, `tracking`, `quotas`, `audit`, `transactions`). Tuân thủ nghiêm ngặt Design Tokens trong `index.css` (Amber Theme `#d97706`, `var(--bg-secondary)`, `var(--border-light)`, `lucide-react`, `alertUtil`, React Query `@tanstack/react-query`).

**Tech Stack:** Spring Boot 3.3.4, Java 21, PostgreSQL 16 JSONB, React 19, TypeScript, TailwindCSS 4, Vite, ExcelJS, FileSaver, Lucide React.

**Spec:** [`docs/superpowers/specs/2026-10-13-analytics-admin-portal-spec.md`](file:///d:/Project/MyProject/multilingo-platform/docs/superpowers/specs/2026-10-13-analytics-admin-portal-spec.md)

---

## Global Constraints

- Mọi Entity mới hoặc mở rộng bắt buộc kế thừa `BaseEntity` với ID kiểu `Integer` tự tăng.
- Mọi Controller endpoint trả về chuẩn `ResponseEntity<ApiResponse<T>>`.
- Mọi lỗi nghiệp vụ ném qua `AppException(ErrorCode.XYZ)` và xử lý tập trung tại `GlobalExceptionHandler`.
- Không tạo Foreign Key vật lý cứng giữa `audit_logs`, `login_history` với `users` (tuân thủ nguyên tắc Cross-cluster Logical References tránh lock bảng log).
- Frontend dùng CSS Variables định nghĩa trong `index.css` (`var(--primary)`, `var(--text-primary)`, `var(--border-light)`...), không dùng màu hardcode tuỳ tiện.

---

## Review Focus

1. **Khóa tài khoản:** Khi Admin khóa user, kiểm tra cờ `is_active = false`, thu hồi token và đảm bảo user bị chặn ngay ở request kế tiếp; chặn không cho Admin tự khóa chính tài khoản của mình.
2. **Audit Logging:** Chụp snapshot JSON các trường dữ liệu trước khi thay đổi (nhưng tuyệt đối không ghi password hash vào audit details).
3. **Hiệu năng Dashboard & Tracking:** Các truy vấn thống kê DAU/MAU và doanh thu phải dùng query tổng hợp (aggregation), không load toàn bộ bảng vào RAM.
4. **Bảo mật phân quyền:** Tất cả API `/api/admin/**` bắt buộc yêu cầu quyền `ROLE_ADMIN`, người dùng thông thường (`ROLE_USER`) truy cập phải nhận 403 Forbidden.
5. **Xuất Excel:** Khi dữ liệu rỗng hoặc có ký tự đặc biệt, file Excel vẫn xuất hợp lệ mà không gây crash client/server.

---

## Chi Tiết Các Task Thực Hiện

### Task 1: Khởi tạo Repositories cho Module Analytics

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/repository/AuditLogRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/repository/LoginHistoryRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/repository/UserQuotaRepository.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/repository/AnalyticsRepositoryTest.java`

- [ ] **Step 1: Viết test kiểm tra Repository queries**
Viết unit test cho các query tìm kiếm theo action, userId, khoảng thời gian trong `AuditLogRepository` và `UserQuotaRepository`.

- [ ] **Step 2: Chạy test để xác nhận FAIL (Red)**
Run: `cd backend && ./mvnw test -Dtest=AnalyticsRepositoryTest`
Expected: FAIL vì các Repository chưa được tạo.

- [ ] **Step 3: Triển khai các Repositories**
Khai báo interface Spring Data JPA kế thừa `JpaRepository` với các phương thức phân trang và lọc:
- `AuditLogRepository.findByActionAndCreatedAtBetween(...)`
- `LoginHistoryRepository.countDistinctUserIdByLoginTimeBetween(...)`
- `UserQuotaRepository.findByFeatureCode(...)`

- [ ] **Step 4: Chạy lại test (Green)**
Run: `cd backend && ./mvnw test -Dtest=AnalyticsRepositoryTest`
Expected: PASS 100%.

---

### Task 2: Xây dựng DTOs cho Quản lý User & Khóa/Mở khóa

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/AdminUserResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/AdminUserDetailResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/request/UpdateUserStatusRequest.java`

- [ ] **Step 1: Định nghĩa các DTOs**
Bao gồm:
- `AdminUserResponse`: id, email, fullName, subscriptionTier, isActive, createdAt, lastLoginAt, lastLoginIp, isFraudRisk.
- `UpdateUserStatusRequest`: `@NotNull Boolean isActive`, `@Size(max = 255) String reason`.
- `AdminUserDetailResponse`: Thông tin chi tiết kèm lịch sử đăng nhập gần nhất (từ `login_history`) và tổng lượt thi (từ `test_attempts`).

---

### Task 3: Triển khai Service Quản lý Người dùng (`UserManagementService`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/UserManagementService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/UserManagementServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/UserManagementServiceTest.java`

- [ ] **Step 1: Viết test cho UserManagementService**
Test các case:
- Lấy danh sách users phân trang có filter keyword/status/tier.
- Khóa tài khoản: đổi `is_active = false`, tạo audit log `LOCK_USER`.
- Mở khóa tài khoản: đổi `is_active = true`, tạo audit log `UNLOCK_USER`.
- Chặn Admin tự khóa chính mình: ném `AppException(ErrorCode.INVALID_REQUEST)`.

- [ ] **Step 2: Chạy test xác nhận FAIL (Red)**
Run: `cd backend && ./mvnw test -Dtest=UserManagementServiceTest`
Expected: FAIL vì service chưa được implement.

- [ ] **Step 3: Triển khai Service & Logic**
Inject `UserRepository`, `AuditLogRepository`, `LoginHistoryRepository`, `RefreshTokenRepository`. Thực thi khóa tài khoản, revoke refresh token, ghi audit log snapshot JSON.

- [ ] **Step 4: Chạy test xác nhận PASS (Green)**
Run: `cd backend && ./mvnw test -Dtest=UserManagementServiceTest`
Expected: PASS.

---

### Task 4: Xây dựng Service & DTOs cho Quota AI (`QuotaService`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/request/UpdateQuotaRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/UserQuotaResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/QuotaService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/QuotaServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/QuotaServiceTest.java`

- [ ] **Step 1: Viết test cho QuotaService**
Test lấy danh sách cấu hình quota, cập nhật `maxLimit` thành công, validate `maxLimit > 0`.

- [ ] **Step 2: Triển khai QuotaServiceImpl**
Truy vấn `UserQuota`, cập nhật `maxLimit`, ghi audit log hành động `UPDATE_AI_QUOTA`.

- [ ] **Step 3: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=QuotaServiceTest`
Expected: PASS.

---

### Task 5: Xây dựng Service & DTOs cho Audit Logs (`AuditService`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/AuditLogResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/AuditService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/AuditServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/AuditServiceTest.java`

- [ ] **Step 1: Viết test cho AuditService**
Test lọc log theo action, lọc theo khoảng thời gian `from`/`to`, phân trang.

- [ ] **Step 2: Triển khai AuditServiceImpl**
Truy vấn `AuditLogRepository` với Dynamic Specification hoặc Repository query, map sang `AuditLogResponse` giữ nguyên Map `details` (JSON Snapshot).

- [ ] **Step 3: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=AuditServiceTest`
Expected: PASS.

---

### Task 6: Xây dựng Service cho Dashboard & Tracking (`AnalyticsService`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/DashboardStatsResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/RevenueChartResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/UserTrackingResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/ExamTrackingResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/AnalyticsService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/AnalyticsServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/AnalyticsServiceTest.java`

- [ ] **Step 1: Viết test cho AnalyticsService**
Test tính toán DAU/MAU, tổng doanh thu từ transactions thành công, tracking bài thi của học viên, thống kê lượt làm đề thi.

- [ ] **Step 2: Triển khai AnalyticsServiceImpl**
Truy vấn dữ liệu từ `UserRepository`, `TransactionRepository`, `TestAttemptRepository`, `LoginHistoryRepository` để tính:
- `totalUsers`, `activeUsersToday` (DAU), `activeUsersThisMonth` (MAU).
- `vipConversionRate` = (số VIP / tổng users) * 100.
- `totalRevenue` = tổng tiền từ các giao dịch `status = 'SUCCESS'`.
- `revenueTrend`: Dãy số liệu doanh thu theo ngày trong tuần/tháng.

- [ ] **Step 3: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=AnalyticsServiceTest`
Expected: PASS.

---

### Task 7: Xây dựng Service Đối soát Giao dịch VNPAY (`TransactionReconciliationService`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/AdminTransactionResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/TransactionReconciliationService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/TransactionReconciliationServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/TransactionReconciliationServiceTest.java`

- [ ] **Step 1: Viết test cho TransactionReconciliationService**
Test lọc giao dịch theo status (`SUCCESS`, `PENDING`, `FAILED`), tìm kiếm theo mã đơn / email, xuất danh sách giao dịch.

- [ ] **Step 2: Triển khai TransactionReconciliationServiceImpl**
Kết nối `TransactionRepository`, map sang `AdminTransactionResponse` có đầy đủ thông tin: id, amount, paymentMethod, status, paidAt, createdAt, userEmail, planName.

- [ ] **Step 3: Chạy test xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=TransactionReconciliationServiceTest`
Expected: PASS.

---

### Task 8: Xây dựng Bộ Controllers Backend (`/api/admin/**`)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminUserController.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminTrackingController.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminQuotaController.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminAuditLogController.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminDashboardController.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/AdminTransactionController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/controller/AdminControllersSecurityTest.java`

- [ ] **Step 1: Viết WebMvcTest bảo mật**
Kiểm tra: Request không có token -> 401; Token role USER -> 403; Token role ADMIN -> 200.

- [ ] **Step 2: Triển khai các Controller**
Đảm bảo tất cả phương thức trả về `ResponseEntity<ApiResponse<T>>`, gắn `@PreAuthorize("hasRole('ADMIN')")`.

- [ ] **Step 3: Chạy test bảo mật xác nhận PASS**
Run: `cd backend && ./mvnw test -Dtest=AdminControllersSecurityTest`
Expected: PASS 100%.

---

### Task 9: Frontend - Xây dựng Admin API Client & Types

**Files:**
- Create: `frontend/src/features/admin/types/adminTypes.ts`
- Create: `frontend/src/features/admin/api/adminApi.ts`

- [ ] **Step 1: Khai báo Types cho toàn bộ phân hệ Admin**
Định nghĩa TypeScript interfaces: `AdminUser`, `AdminUserDetail`, `DashboardStats`, `RevenueChartItem`, `AuditLogItem`, `UserQuotaItem`, `AdminTransactionItem`, `TrackingStudentItem`, `TrackingExamItem`.

- [ ] **Step 2: Cài đặt API functions trong `adminApi.ts`**
Viết các hàm gọi Axios client:
- `getUsers(params)`, `getUserDetail(id)`, `updateUserStatus(id, isActive, reason)`
- `getDashboardStats()`, `getRevenueChart(range)`
- `getAuditLogs(params)`
- `getQuotas()`, `updateQuota(id, data)`
- `getTransactions(params)`
- `getStudentTracking(userId)`, `getExamTracking()`

---

### Task 10: Frontend - Xây dựng Màn hình Admin Dashboard

**Files:**
- Create: `frontend/src/features/admin/dashboard/pages/AdminDashboardPage.tsx`
- Create: `frontend/src/features/admin/dashboard/components/StatCard.tsx`
- Create: `frontend/src/features/admin/dashboard/components/RevenueChart.tsx`
- Create: `frontend/src/features/admin/dashboard/components/RecentActivityTable.tsx`

- [ ] **Step 1: Tạo các components StatCard & Chart**
Thiết kế card màu viền `var(--primary)`, `var(--success)`, `var(--warning)`, `var(--danger)` kèm icon từ `lucide-react` (Users, DollarSign, Activity, AlertTriangle). Vẽ biểu đồ thanh/cột doanh thu trực quan bằng SVG/Canvas không cần thư viện nặng.

- [ ] **Step 2: Hoàn thiện `AdminDashboardPage.tsx`**
Sử dụng `useQuery` gọi `adminApi.getDashboardStats()` và `adminApi.getRevenueChart()`. Hiển thị DAU/MAU, tổng doanh thu, tỷ lệ VIP, bộ đề và bảng hoạt động gần nhất.

---

### Task 11: Frontend - Xây dựng Màn hình Quản trị Người dùng & Khóa tài khoản

**Files:**
- Create: `frontend/src/features/admin/users/pages/UserManagementPage.tsx`
- Create: `frontend/src/features/admin/users/components/UserTable.tsx`
- Create: `frontend/src/features/admin/users/components/UserFilterBar.tsx`
- Create: `frontend/src/features/admin/users/components/LockUserModal.tsx`
- Create: `frontend/src/features/admin/users/components/UserDetailDrawer.tsx`

- [ ] **Step 1: Xây dựng bảng người dùng và bộ lọc**
Input tìm kiếm email/tên, dropdown lọc theo trạng thái (Tất cả / Hoạt động / Bị khóa) và gói VIP (FREE / PREMIUM). Hiển thị badge trạng thái màu xanh/đỏ chuẩn design token.

- [ ] **Step 2: Triển khai Modal Khóa / Mở khóa tài khoản**
Khi bấm "Khóa tài khoản", mở popup xác nhận yêu cầu nhập lý do. Gọi mutation `adminApi.updateUserStatus`, hiển thị toast thông báo qua `alertUtil`.

- [ ] **Step 3: Triển khai Drawer xem chi tiết hồ sơ & Session thiết bị**
Hiển thị lịch sử đăng nhập (IP, thiết bị, thời gian) và cảnh báo nghi ngờ chia sẻ tài khoản nếu đăng nhập từ nhiều IP lạ.

---

### Task 12: Frontend - Xây dựng Màn hình Tracking Học viên & Đề thi

**Files:**
- Create: `frontend/src/features/admin/tracking/pages/TrackingAnalyticsPage.tsx`
- Create: `frontend/src/features/admin/tracking/components/StudentTrackingTab.tsx`
- Create: `frontend/src/features/admin/tracking/components/ExamTrackingTab.tsx`

- [ ] **Step 1: Tạo giao diện Tab chuyển đổi giữa Học viên và Đề thi**
- Tab 1: Nhập email/ID học viên để tra cứu lịch sử làm bài, điểm trung bình, tổng phút học.
- Tab 2: Danh sách toàn bộ đề thi kèm số lượt thi, điểm trung bình và tỷ lệ hoàn thành.

---

### Task 13: Frontend - Xây dựng Màn hình Cấu hình Quota AI

**Files:**
- Create: `frontend/src/features/admin/quotas/pages/QuotaSettingsPage.tsx`
- Create: `frontend/src/features/admin/quotas/components/QuotaCard.tsx`

- [ ] **Step 1: Tạo giao diện thiết lập hạn mức AI**
Hiển thị danh sách tính năng AI: Chấm Writing (`AI_WRITING_GRADING`), Tra từ điển (`AI_DICTIONARY`), Chat gia sư (`AI_CHAT_TUTOR`).
Cho phép Admin chỉnh sửa `max_limit` (số lượt/ngày hoặc tuần) cho tài khoản Free và VIP, kèm nút "Lưu thay đổi" có xác nhận qua `alertUtil`.

---

### Task 14: Frontend - Xây dựng Màn hình Nhật ký Kiểm toán & Snapshot JSON

**Files:**
- Create: `frontend/src/features/admin/audit/pages/AuditLogPage.tsx`
- Create: `frontend/src/features/admin/audit/components/AuditLogTable.tsx`
- Create: `frontend/src/features/admin/audit/components/JsonSnapshotModal.tsx`

- [ ] **Step 1: Xây dựng bảng Audit Logs có phân trang & bộ lọc**
Hiển thị cột: Thời gian, Người thực hiện, Hành động (`LOCK_USER`, `UPDATE_AI_QUOTA`...), Entity, IP.

- [ ] **Step 2: Triển khai Modal hiển thị Snapshot JSON**
Khi bấm "Xem chi tiết", mở modal hiển thị dữ liệu JSON snapshot `details` định dạng code block `pre/code` đẹp mắt, có nút copy JSON vào clipboard.

---

### Task 15: Frontend - Xây dựng Phân hệ Đối soát Giao dịch & Xuất Báo Cáo Excel

**Files:**
- Create: `frontend/src/features/admin/transactions/pages/TransactionReconciliationPage.tsx`
- Create: `frontend/src/features/admin/transactions/components/TransactionTable.tsx`
- Create: `frontend/src/features/admin/transactions/utils/excelExport.ts`

- [ ] **Step 1: Xây dựng bảng đối soát giao dịch**
Hiển thị mã đơn hàng, ngày thanh toán, số tiền format VNĐ (`99.000 đ`), gói cước, cổng thanh toán VNPAY, trạng thái (`SUCCESS` xanh, `PENDING` vàng, `FAILED` đỏ).

- [ ] **Step 2: Triển khai tính năng xuất file Excel bằng `exceljs` & `file-saver`**
Tạo helper `excelExport.ts` sử dụng thư viện `exceljs` đã có trong dự án: format tiêu đề bảng, căn chỉnh độ rộng cột, style màu header, xuất file `.xlsx` và tự động kích hoạt tải xuống cho Admin.

---

### Task 16: Tích Hợp Router & Kiểm Thử Toàn Diện (End-to-End)

**Files:**
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Cập nhật `router.tsx`**
Thay thế toàn bộ các placeholder bằng các component hoàn chỉnh:
- `/admin/dashboard` $\rightarrow$ `AdminDashboardPage`
- `/admin/users` $\rightarrow$ `UserManagementPage`
- `/admin/audit` $\rightarrow$ `AuditLogPage`
- `/admin/settings` $\rightarrow$ `QuotaSettingsPage`
- Bổ sung `/admin/tracking` $\rightarrow$ `TrackingAnalyticsPage`
- Bổ sung `/admin/transactions` $\rightarrow$ `TransactionReconciliationPage`

- [ ] **Step 2: Chạy kiểm thử Backend**
Run: `cd backend && ./mvnw clean test`
Expected: Tất cả bài test PASS 100%.

- [ ] **Step 3: Chạy Lint và Build Frontend**
Run: `cd frontend && npm run build`
Expected: TypeScript compile và Vite build thành công không có lỗi type.
