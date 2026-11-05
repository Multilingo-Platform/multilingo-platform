# AI Quota Student Visibility & Upgrade CTA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cung cấp API hiển thị hạn mức AI của học viên (`GET /api/v1/student/quotas`) và bổ sung nút kêu gọi hành động nâng cấp Hội viên VIP (CTA) trên `WritingHintsPanel` & `PracticeDictionaryPopover` khi hết quota (HTTP 429).

**Architecture:** Mở rộng `QuotaService` ở backend với phương thức `getMyQuotas(userId)` để phân giải hạn mức ngày của học viên dựa trên bảng `user_quotas` và template hạng thành viên (`FREE`/`PREMIUM`). Tiếp xúc qua `StudentQuotaController`. Ở frontend, tạo `studentQuotaApi` và thêm khối CTA chuyển hướng an toàn đến `/student/premium` khi `error.kind === 'quota'`.

**Tech Stack:** Spring Boot 3, Java 21, Spring Data JPA, React 19, TypeScript, Vitest, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-05-ai-quota-student-visibility-and-upgrade-cta-spec.md`
**Acceptance Criteria:** `docs/superpowers/specs/2026-11-05-ai-quota-student-visibility-and-upgrade-cta-AC.md`

## Global Constraints
- Tuân thủ quy chuẩn `BaseEntity` và `ApiResponse<T>` cho Controller.
- Không ném exception 500 khi người dùng chưa có dòng quota (tự động lazy-load từ Template `userId = 0` hoặc `-1`).
- Múi giờ reset hạn mức chuẩn: `Asia/Ho_Chi_Minh` (00:00:00 ngày tiếp theo).
- Không tự động chạy `git commit` khi người dùng chưa kiểm tra và phê duyệt diff.

## Review Focus
- Học viên mới chưa phát sinh lượt dùng nào: Trả về `usedCount = 0`, `remaining = maxLimit`.
- Học viên hết hạn mức: `remaining = 0`, không được mang giá trị âm.
- Không được làm vỡ các test case cũ của `WritingHintsPanel` và `PracticeDictionaryPopover`.

---

### Task 1: Backend DTO & QuotaService.getMyQuotas
**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/StudentQuotaResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/QuotaService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/QuotaServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/service/QuotaServiceMyQuotasTest.java`

- [ ] Viết test `QuotaServiceMyQuotasTest` kiểm thử `getMyQuotas` cho cả tài khoản FREE và PREMIUM, tài khoản chưa dùng và tài khoản đã dùng một phần.
- [ ] Tạo DTO `StudentQuotaResponse` với các trường: `featureCode`, `featureName`, `usedCount`, `maxLimit`, `remaining`, `tier`, `resetDate`.
- [ ] Khai báo `List<StudentQuotaResponse> getMyQuotas(Integer userId)` trong `QuotaService`.
- [ ] Triển khai `getMyQuotas` trong `QuotaServiceImpl`.
- [ ] Chạy test `QuotaServiceMyQuotasTest` đảm bảo 100% PASS.

---

### Task 2: Backend StudentQuotaController
**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/StudentQuotaController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/analytics/controller/StudentQuotaControllerTest.java`

- [ ] Viết test `StudentQuotaControllerTest` kiểm tra endpoint `GET /api/v1/student/quotas` với token hợp lệ.
- [ ] Tạo `StudentQuotaController` kế thừa quy chuẩn `ApiResponse.success(...)`, lấy `userId` từ `SecurityContextHolder`.
- [ ] Chạy test `StudentQuotaControllerTest` đảm bảo PASS.

---

### Task 3: Frontend API Client `studentQuotaApi.ts`
**Files:**
- Create: `frontend/src/features/student/api/studentQuotaApi.ts`
- Modify: `frontend/src/features/student/types/studentQuota.types.ts`

- [ ] Định nghĩa type `StudentQuotaItem` tương ứng với DTO từ Backend.
- [ ] Viết hàm `getMyQuotas()` sử dụng `axiosClient.get('/v1/student/quotas')`.

---

### Task 4: Frontend Upgrade CTA trong `WritingHintsPanel.tsx`
**Files:**
- Modify: `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx`
- Modify: `frontend/src/features/exam/__tests__/WritingHintsPanel.test.tsx`

- [ ] Viết test case bổ sung trong `WritingHintsPanel.test.tsx`: Khi `state.error.kind === 'quota'`, kiểm tra có hiển thị nút "Nâng cấp gói Premium" (hoặc CTA nâng cấp).
- [ ] Cập nhật `WritingHintsPanel.tsx`: Khi `state.error?.kind === 'quota'`, render thêm một khối thông báo nổi bật với nút chuyển hướng tới `/student/premium`.
- [ ] Chạy test suite `WritingHintsPanel.test.tsx` đảm bảo PASS toàn bộ.

---

### Task 5: Frontend Upgrade CTA trong `PracticeDictionaryPopover.tsx`
**Files:**
- Modify: `frontend/src/features/exam/components/practice/PracticeDictionaryPopover.tsx`
- Modify: `frontend/src/features/exam/__tests__/PracticeDictionaryPopover.test.tsx`

- [ ] Viết test case bổ sung trong `PracticeDictionaryPopover.test.tsx`: Khi `error.kind === 'quota'`, kiểm tra có hiển thị nút CTA nâng cấp hội viên.
- [ ] Cập nhật `PracticeDictionaryPopover.tsx`: Thêm nút mở `/student/premium` khi `error.kind === 'quota'`.
- [ ] Chạy test suite `PracticeDictionaryPopover.test.tsx` đảm bảo PASS.

---

### Task 6: Kiểm thử & Hoàn thiện (Verification & Clean-up)
- [ ] Chạy lại toàn bộ test suite frontend: `npm --prefix frontend test -- writingHints dictionary QuotaSettingsPage`.
- [ ] Kiểm tra TypeScript build: `npm --prefix frontend run build`.
- [ ] Hiển thị bản tóm tắt diff và xin ý kiến phê duyệt của người dùng trước khi commit.

