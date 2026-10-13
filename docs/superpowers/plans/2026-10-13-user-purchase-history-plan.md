# Kế Hoạch Triển Khai: Tra Cứu Lịch Sử Mua Gói Cước Người Dùng (User Purchase History)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng API `GET /api/v1/billing/my-history` phân trang (20 bản ghi/trang) lấy danh sách các gói cước đã thanh toán thành công của người dùng hiện tại (trích xuất `userId` từ JWT, bọc kết quả trong `PageResponse<TransactionResponse>`) và tích hợp vào giao diện qua menu `ProfileDropdown` điều hướng tới trang `/student/purchase-history`.

**Architecture:** 
- Backend tuân thủ kiến trúc phân tầng chuẩn Multilingo: Controller $\rightarrow$ Service $\rightarrow$ Repository $\rightarrow$ Entity. `userId` được trích xuất an toàn từ Spring Security `@AuthenticationPrincipal CustomUserDetails`. Response trả về chuẩn `ApiResponse<PageResponse<TransactionResponse>>`.
- Frontend tuân thủ Feature-Sliced Design: Logic API và trang giao diện đặt trong `features/premium/`, menu kích hoạt tại `components/common/ProfileDropdown.tsx`, routing tại `app/router.tsx`.

**Tech Stack:**
- Backend: Java 21, Spring Boot 3.3.4, Spring Data JPA, Spring Security, MapStruct, Lombok, JUnit 5, Mockito, MockMvc.
- Frontend: React 18, TypeScript, Tailwind CSS, Lucide React, React Router 6, TanStack Query, Axios, i18next.

**Spec:**
- Đặc tả kỹ thuật: [2026-10-13-user-purchase-history-spec.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/superpowers/specs/2026-10-13-user-purchase-history-spec.md)
- Tiêu chí nghiệm thu & Test Cases: [2026-10-13-user-purchase-history-AC.md](file:///d:/backup/UTC_programming/semeter_7/PTPM_MNM/Multilingo/multilingo-platform/docs/superpowers/specs/2026-10-13-user-purchase-history-AC.md)

## Global Constraints
- Primary Key của các Entity là `Integer` (tự tăng).
- Không được nhận `userId` từ client param/body; bắt buộc đọc từ JWT Token.
- Phân trang chuẩn 20 bản ghi/trang (`size = 20`, `page = 0`), bọc trong `PageResponse<T>`.
- Chỉ truy vấn các giao dịch có `status = SUCCESS`.
- Controller bắt buộc trả về `ApiResponse<PageResponse<T>>`.
- Ngoại lệ ném qua `AppException(ErrorCode.XYZ)`.
- Frontend áp dụng Feature-based architecture, giao diện hiển thị chuẩn responsive, có đủ các trạng thái Loading, Empty, Data, Error, Pagination.

## Review Focus
1. Đảm bảo chống IDOR: User chỉ thấy giao dịch của chính mình.
2. Không bị `LazyInitializationException` khi truy cập thuộc tính của `plan` trong `TransactionMapper`.
3. Phân trang chính xác: `PageResponse` có đầy đủ `items`, `page`, `size`, `totalElements`, `totalPages`, `last`.
4. Thứ tự sắp xếp giao dịch: Mới nhất lên đầu (`createdAt DESC`).
5. Menu `ProfileDropdown` đóng lại ngay khi người dùng chọn mục và điều hướng đúng URL.

---

### Task 1: Mở rộng DTO & Mapper (TransactionResponse & TransactionMapper)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/dto/response/TransactionResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/mapper/TransactionMapper.java`

- [x] **Step 1.1:** Bổ sung trường `durationDays` và `planCode` vào `TransactionResponse`
- [x] **Step 1.2:** Cập nhật `@Mapping` trong `TransactionMapper`
- [x] **Step 1.3:** Chạy biên dịch xác nhận MapStruct sinh code thành công

---

### Task 2: Cập nhật Repository với Phân trang (TransactionRepository)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/repository/TransactionRepository.java`

- [x] **Step 2.1:** Khai báo query method phân trang trong `TransactionRepository`
- [x] **Step 2.2:** Chạy biên dịch kiểm tra cú pháp Spring Data JPA

---

### Task 3: Triển khai Service Layer Phân trang theo TDD (TransactionService & TransactionServiceImpl)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/service/TransactionService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/service/impl/TransactionServiceImpl.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/billing/service/TransactionServiceTest.java`

- [x] **Step 3.1 (Red):** Viết unit test trong `TransactionServiceTest`
- [x] **Step 3.2:** Chạy test để xác nhận test FAIL (do Service chưa có method)
- [x] **Step 3.3 (Green):** Bổ sung chữ ký hàm trong interface `TransactionService`
- [x] **Step 3.4 (Green):** Cài đặt logic trong `TransactionServiceImpl` với `PageResponse.from(...)`
- [x] **Step 3.5 (Refactor):** Chạy lại test xác nhận PASS 100%

---

### Task 4: Triển khai Controller Layer theo TDD (BillingController)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/controller/BillingController.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/billing/controller/BillingControllerTest.java`

- [x] **Step 4.1 (Red):** Viết test trong `BillingControllerTest`
- [x] **Step 4.2:** Chạy test xác nhận FAIL
- [x] **Step 4.3 (Green):** Thêm endpoint `GET /api/v1/billing/my-history` vào `BillingController`
- [x] **Step 4.4 (Refactor):** Chạy lại toàn bộ test của Billing module để đảm bảo PASS 100%

---

### Task 5: Frontend - Khai báo Types & API Client với Phân trang

**Files:**
- Create: `frontend/src/features/premium/types/billing.ts`
- Create: `frontend/src/features/premium/api/billingApi.ts`

- [x] **Step 5.1:** Định nghĩa interface `PurchaseHistoryItem` và `PageResponse`
- [x] **Step 5.2:** Thêm hàm gọi API trong `billingApi`

---

### Task 6: Frontend - Xây dựng Giao Diện Trang PurchaseHistoryPage (Kèm Phân Trang)

**Files:**
- Create: `frontend/src/features/premium/pages/PurchaseHistoryPage.tsx`
- Modify: `frontend/src/locales/vi/translation.json` & `frontend/src/locales/en/translation.json`

- [x] **Step 6.1:** Bổ sung các bản dịch ngôn ngữ vào i18n (`vi`, `en`)
- [x] **Step 6.2:** Xây dựng component `PurchaseHistoryPage.tsx` chuẩn UX/UI với đủ 4 trạng thái và phân trang

---

### Task 7: Frontend - Tích hợp Route & Menu ProfileDropdown

**Files:**
- Modify: `frontend/src/components/common/ProfileDropdown.tsx`
- Modify: `frontend/src/app/router.tsx`

- [x] **Step 7.1:** Khai báo route `purchase-history` trong `router.tsx`
- [x] **Step 7.2:** Bổ sung mục "Lịch sử mua gói" vào `ProfileDropdown.tsx`

---

### Task 8: Nghiệm Thu Toàn Diện (Verification Before Completion)

- [x] **Step 8.1:** Chạy toàn bộ test suite module billing: 13/13 tests PASS 100%
- [x] **Step 8.2:** Kiểm tra lint (`0 errors`) và build frontend (`✓ built in 3.66s`)
- [x] **Step 8.3:** Đối chiếu với 10 Test Cases trong bảng `TC_BILLING_HISTORY_xx` đảm bảo đáp ứng đầy đủ tiêu chí nghiệm thu
