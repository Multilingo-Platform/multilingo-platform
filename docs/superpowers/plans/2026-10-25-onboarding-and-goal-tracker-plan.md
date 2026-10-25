# Implementation Plan: Tinh Giản Onboarding (3 Bước) & Thanh Đo Tiến Độ Mục Tiêu 5 Bài Gần Nhất

> **Spec Reference:** [docs/superpowers/specs/2026-10-25-onboarding-and-goal-tracker-spec.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-onboarding-and-goal-tracker-spec.md)

---

### Task 1: Tinh giản Frontend Onboarding Wizard về đúng 3 bước cốt lõi
- **Files:**
  - Modify: `frontend/src/features/onboarding/pages/student/OnboardingPage.tsx`
  - Modify: `frontend/src/features/onboarding/components/Step4RoadmapSummary.tsx`
  - Delete / Exclude: `frontend/src/features/onboarding/components/Step3HabitAndLevel.tsx`
  - Modify: `frontend/src/features/onboarding/__tests__/OnboardingWizard.test.tsx`
- **Steps:**
  1. Xóa component `Step3HabitAndLevel.tsx`.
  2. Cập nhật `OnboardingPage.tsx`:
     - Định nghĩa `totalSteps = 3` với `STEP_TITLES`:
       1. `Chọn Ngôn Ngữ` (`Step1LanguageSelect`)
       2. `Mục Tiêu Chứng Chỉ` (`Step2CertificateGoal`)
       3. `Lộ Trình Cá Nhân` (`Step4RoadmapSummary`)
     - Cập nhật logic chuyển bước `currentStep < 3 ? "Tiếp tục" : "Bắt đầu hành trình học"`.
  3. Cập nhật `Step4RoadmapSummary.tsx`: loại bỏ hiển thị thói quen / trình độ, chỉ hiển thị tập trung:
     - Ngôn ngữ mẹ đẻ ➔ Ngôn ngữ muốn học (kèm cờ)
     - Chứng chỉ mục tiêu
     - Điểm số kỳ vọng
  4. Cập nhật `OnboardingWizard.test.tsx` kiểm thử luồng 3 bước, xác nhận 3/3 tests PASS.

---

### Task 2: Backend - Mở rộng Dashboard API tính toán Mục tiêu từ 5 bài thi gần nhất
- **Files:**
  - Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/GoalProgressDto.java`
  - Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/RecentExamScoreDto.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/StudentDashboardResponse.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/repository/TestAttemptRepository.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/gamification/service/impl/StudentDashboardServiceImpl.java`
  - Modify: `backend/src/test/java/com/multilingo/backend/modules/gamification/service/StudentDashboardServiceTest.java`
- **Steps:**
  1. Tạo `GoalProgressDto` và `RecentExamScoreDto` (điểm số, ngày thi, tiêu đề bài thi).
  2. Thêm `GoalProgressDto goalProgress` vào `StudentDashboardResponse`.
  3. Trong `TestAttemptRepository`, thêm query:
     ```java
     List<TestAttempt> findTop5ByUserIdAndStatusOrderByEndTimeDesc(Integer userId, AttemptStatus status);
     ```
  4. Trong `StudentDashboardServiceImpl`:
     - Lấy `user_targets` của học viên để có `targetCertificate` và `targetScore`.
     - Lấy top 5 `TestAttempt` gần nhất.
     - Tính `recentAverageScore` (trung bình cộng điểm của tối đa 5 bài gần nhất).
     - Tính `progressPercent = Math.min(100, Math.round((recentAverageScore / targetScore) * 100))`.
     - Đóng gói danh sách 5 bài gần nhất vào `recentScores`.
  5. Cập nhật `StudentDashboardServiceTest` và chạy `./mvnw test` xác nhận PASS.

---

### Task 3: Frontend - Xây dựng Component Thanh Đo Tiến Độ Mục Tiêu (`GoalProgressTrackerCard`)
- **Files:**
  - Create: `frontend/src/features/student/dashboard/components/GoalProgressTrackerCard.tsx`
  - Modify: `frontend/src/features/student/dashboard/types/dashboard.types.ts`
  - Modify: `frontend/src/features/student/dashboard/pages/StudentDashboardPage.tsx`
  - Modify: `frontend/src/features/student/dashboard/components/GreetingHeader.tsx`
- **Steps:**
  1. Cập nhật TypeScript interface `StudentDashboardData` thêm `goalProgress`.
  2. Tạo component `GoalProgressTrackerCard.tsx`:
     - Card thiết kế thẩm mỹ cao, nền trắng bo tròn viền slate/amber.
     - Header: Badge cờ ngôn ngữ học, icon mục tiêu, tên chứng chỉ mục tiêu (`IELTS Academic` / `TOEIC` / `NLTV`) và điểm mục tiêu `Target: 7.0`.
     - Body: Thanh tiến trình phần trăm (Progress Bar) có hiệu ứng chuyển màu sống động.
     - 5 Điểm mốc (5 Pills/Dots): Biểu thị điểm số của từng bài trong 5 bài gần nhất theo thứ tự thời gian (`5.5` ➔ `6.0` ➔ `6.0` ➔ `6.5` ➔ `6.5`).
     - Lời động viên cá nhân hóa dựa trên khoảng cách điểm tới mục tiêu.
  3. Đặt `GoalProgressTrackerCard` ngay dưới `GreetingHeader` trên `StudentDashboardPage.tsx`.

---

### Task 4: Frontend - Tự động chọn đề theo mục tiêu trong Thư viện đề thi
- **Files:**
  - Modify: `frontend/src/features/exams/pages/student/ExamLibrary.tsx`
- **Steps:**
  1. Khi `ExamLibrary` mount, gọi API lấy mục tiêu học tập (hoặc từ thông tin user).
  2. Nếu có `targetCertificate`, tự động đặt `selectedCert` mặc định (IELTS, TOEIC hoặc NLTV).
  3. Tự động tải danh sách đề thi phù hợp ngay khi trang vừa mở.

---

### Task 5: Kiểm thử tự động & Nghiệm thu
- **Steps:**
  1. Chạy `npx vitest run src/features/onboarding` kiểm tra luồng 3 bước.
  2. Chạy `npx tsc -b` xác nhận 0 lỗi TypeScript.
  3. Chạy backend `./mvnw test` xác nhận toàn bộ unit test PASS.
  4. Hiển thị tóm tắt diff thay đổi và xin ý kiến phê duyệt của người dùng trước khi commit.
