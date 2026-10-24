# Onboarding Upgrade (UC05) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng luồng Onboarding cá nhân hóa mục tiêu học tập (Full-stack) hoàn chỉnh gồm: Flyway migration, Backend Service/Controller theo chuẩn Base Architecture, và Frontend Multi-step Wizard 4 bước cao cấp với micro-animations và điều hướng mượt mà.

**Architecture:** Sử dụng Spring Boot 3 + PostgreSQL (Flyway migration, JPA Entity, DTO, GlobalExceptionHandler) cho Backend API; React 19 + TypeScript + CSS Modules / Vanilla CSS (Feature-Sliced Design tại `features/onboarding`) cho Frontend.

**Tech Stack:** Spring Boot 3, PostgreSQL, Flyway, JUnit 5, Mockito, React 19, TypeScript, TanStack Query, Lucide Icons, Vite, SweetAlert2.

**Spec:** [docs/superpowers/specs/2026-10-23-onboarding-upgrade-spec.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-23-onboarding-upgrade-spec.md)  
**AC & Test Design:** [docs/superpowers/specs/2026-10-23-onboarding-upgrade-AC.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-23-onboarding-upgrade-AC.md)

## Global Constraints
- Primary key thực thể Backend là `Integer` tự tăng kế thừa `BaseEntity`.
- Controller Backend luôn trả về `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ ném qua `AppException(ErrorCode.XYZ)`.
- Tên file migrate Flyway bắt buộc theo format `VYYYYMMDDHHMMSS__<mo-ta>.sql`.
- Frontend bắt buộc tổ chức trong `features/onboarding/`.
- Không tự ý commit khi chưa hiển thị diff và chưa được user phê duyệt.

## Review Focus
1. Ngôn ngữ mẹ đẻ và ngôn ngữ muốn học không được phép trùng nhau (`nativeLanguage != targetLanguage`).
2. Điểm số kỳ vọng (`targetScore`) phải đúng định dạng số và nằm trong biên điểm chuẩn của từng chứng chỉ (IELTS 4.0-9.0, TOEIC L&R 200-990, TOEIC Writing 50-200, NLTV 1.0-6.0).
3. Đảm bảo tính Idempotency: nếu học viên submit Onboarding lại, cập nhật bản ghi `user_targets` hiện có của học viên, không tạo bản ghi rác.
4. Điều hướng an toàn: nếu học viên đã hoàn thành onboarding thì tự động chuyển về `/student/dashboard`.
5. Trạng thái Loading spinner và disabled trên nút Submit để chống double-click.

---

### Task 1: Database Migration & Entity Updates

**Files:**
- Create: `backend/src/main/resources/db/migration/V20261023111000__add_onboarding_fields_to_user_and_targets.sql`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/entity/UserTarget.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/entity/User.java`

**Steps:**
- [ ] Tạo file migration Flyway `V20261023111000__add_onboarding_fields_to_user_and_targets.sql` thêm cột `daily_minutes`, `current_level` vào `user_targets` và `has_completed_onboarding` vào `users`.
- [ ] Cập nhật `UserTarget.java` thêm trường `Integer dailyMinutes` và `String currentLevel`.
- [ ] Cập nhật `User.java` thêm trường `Boolean hasCompletedOnboarding = false`.
- [ ] Biên dịch thử nghiệm backend qua `./mvnw test-compile` để xác nhận syntax JPA hợp lệ.

---

### Task 2: Backend Repository & Service (TDD)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/repository/UserTargetRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/request/OnboardingRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/response/OnboardingResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/response/OnboardingStatusResponse.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/auth/service/StudentOnboardingServiceTest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/StudentOnboardingService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/StudentOnboardingServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java` (thêm mã lỗi nếu cần)

**Steps:**
- [ ] Tạo interface `UserTargetRepository` kế thừa `JpaRepository<UserTarget, Integer>` với hàm `Optional<UserTarget> findFirstByUserId(Integer userId)`.
- [ ] Tạo các DTO `OnboardingRequest`, `OnboardingResponse`, `OnboardingStatusResponse`.
- [ ] Viết test `StudentOnboardingServiceTest` bao phủ: (1) submit onboarding thành công, (2) submit khi nativeLang trùng targetLang ném ngoại lệ, (3) lấy status onboarding.
- [ ] Chạy test xác nhận FAIL (RED).
- [ ] Triển khai `StudentOnboardingServiceImpl` cập nhật `users`, lưu `user_targets` và trả về response.
- [ ] Chạy lại test xác nhận PASS (GREEN).

---

### Task 3: Backend Controller & Contract Integration Test (TDD)

**Files:**
- Create: `backend/src/test/java/com/multilingo/backend/modules/auth/controller/StudentOnboardingControllerIT.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/StudentOnboardingController.java`

**Steps:**
- [ ] Viết test `@WebMvcTest(StudentOnboardingController.class)` kiểm tra 2 endpoint: `GET /api/v1/student/onboarding/status` và `POST /api/v1/student/onboarding`.
- [ ] Chạy test xác nhận FAIL (RED).
- [ ] Tạo `StudentOnboardingController` ánh xạ 2 endpoint theo chuẩn `ResponseEntity<ApiResponse<T>>`.
- [ ] Chạy lại test xác nhận PASS (GREEN).

---

### Task 4: Frontend API & Types

**Files:**
- Create: `frontend/src/features/onboarding/types/index.ts`
- Create: `frontend/src/features/onboarding/api/onboardingApi.ts`

**Steps:**
- [ ] Định nghĩa interface TypeScript: `OnboardingData`, `OnboardingRequest`, `OnboardingResponse`, `OnboardingStatusResponse`.
- [ ] Viết `onboardingApi` với các hàm `getStatus()` và `submitOnboarding(data)`.

---

### Task 5: Frontend Multi-Step Wizard Components

**Files:**
- Create: `frontend/src/features/onboarding/components/OnboardingStepIndicator.tsx`
- Create: `frontend/src/features/onboarding/components/Step1LanguageSelect.tsx`
- Create: `frontend/src/features/onboarding/components/Step2CertificateGoal.tsx`
- Create: `frontend/src/features/onboarding/components/Step3HabitAndLevel.tsx`
- Create: `frontend/src/features/onboarding/components/Step4RoadmapSummary.tsx`
- Create: `frontend/src/features/onboarding/components/Onboarding.css`

**Steps:**
- [ ] Tạo `OnboardingStepIndicator.tsx` hiển thị progress bar 4 bước, nhãn bước, % hoàn thành và icon.
- [ ] Tạo `Step1LanguageSelect.tsx` cho phép chọn ngôn ngữ mẹ đẻ (VI, EN, JA, KO, ZH) và ngôn ngữ mục tiêu với cờ quốc gia, tự động validation chống chọn trùng.
- [ ] Tạo `Step2CertificateGoal.tsx` hiển thị thẻ chứng chỉ (IELTS Academic, IELTS General, TOEIC L&R, TOEIC Writing, NLTV) và bộ chọn Band điểm phù hợp theo từng chứng chỉ.
- [ ] Tạo `Step3HabitAndLevel.tsx` chọn trình độ hiện tại (Beginner, Elementary, Intermediate, Advanced) và thời lượng cam kết (15m, 30m, 45m, 60m).
- [ ] Tạo `Step4RoadmapSummary.tsx` tổng kết toàn bộ hồ sơ cá nhân hóa với hiệu ứng visual card, gợi ý bài thi phù hợp và nút hành động chính.
- [ ] Viết `Onboarding.css` với theme sang trọng, card bo tròn, hover effect, badge và animation chuyển bước.

---

### Task 6: Frontend Onboarding Page Integration & Routing

**Files:**
- Modify: `frontend/src/features/onboarding/pages/student/OnboardingPage.tsx`
- Modify: `frontend/src/app/router.tsx`

**Steps:**
- [ ] Cập nhật `OnboardingPage.tsx` kết nối 4 step component, quản lý state tổng, gọi API `getStatus` khi mount (nếu đã xong thì redirect về `/student/dashboard`).
- [ ] Xử lý sự kiện Submit: gọi `onboardingApi.submitOnboarding`, hiển thị loading state trên nút bấm, nổ toast chúc mừng và redirect về `/student/library`.
- [ ] Đảm bảo nút "Quay lại" và "Tiếp tục" hoạt động trơn tru giữa các bước.

---

### Task 7: Verification & Testing

**Files:**
- Create: `frontend/src/features/onboarding/__tests__/OnboardingWizard.test.tsx`

**Steps:**
- [ ] Viết Vitest test `OnboardingWizard.test.tsx` kiểm thử: render 4 bước, validation ngôn ngữ trùng, chuyển step, submit API.
- [ ] Chạy frontend lint `npm run lint` xác nhận 0 lỗi.
- [ ] Chạy frontend build `npm run build` xác nhận PASS.
- [ ] Chạy backend compile `./mvnw test-compile` xác nhận BUILD SUCCESS.
- [ ] Hiển thị tóm tắt diff thay đổi và xin phê duyệt commit của người dùng.
