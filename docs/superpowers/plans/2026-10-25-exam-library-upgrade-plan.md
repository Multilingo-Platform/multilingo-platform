# Implementation Plan: Nâng Cấp Toàn Diện Thư Viện Đề Thi (Exam Library)

> **Spec:** [docs/superpowers/specs/2026-10-25-exam-library-upgrade-spec.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-exam-library-upgrade-spec.md)  
> **AC & Test Design:** [docs/superpowers/specs/2026-10-25-exam-library-upgrade-AC.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-exam-library-upgrade-AC.md)

---

### Task 1: Backend - Bổ sung thông tin làm bài cá nhân vào API Thư viện đề thi
- **Files:**
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/StudentExamSummaryResponse.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/repository/TestAttemptRepository.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/service/StudentExamService.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/service/impl/StudentExamServiceImpl.java`
  - Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/controller/StudentExamController.java`
  - Modify: `backend/src/test/java/com/multilingo/backend/modules/exam/service/impl/StudentExamServiceImplTest.java`
- **Steps:**
  1. Thêm các trường vào `StudentExamSummaryResponse`:
     - `Boolean isAttempted`
     - `Integer userAttemptsCount`
     - `Double userHighestScore`
     - `Double userLatestScore`
  2. Trong `TestAttemptRepository`, thêm query tổng hợp lịch sử làm bài theo `userId`:
     ```java
     @Query("SELECT a.examId, COUNT(a), MAX(a.overallScore) FROM TestAttempt a WHERE a.userId = :userId AND a.status = 'COMPLETED' GROUP BY a.examId")
     List<Object[]> findUserAttemptSummariesByUserId(@Param("userId") Integer userId);
     ```
  3. Cập nhật `StudentExamService` & `StudentExamServiceImpl` nhận thêm tham số `Integer userId`. Nếu `userId != null`, truy vấn map thống kê làm bài và ánh xạ vào từng đề thi.
  4. Trong `StudentExamController`, trích xuất `userId` từ `@AuthenticationPrincipal CustomUserDetails userDetails` (nếu đã đăng nhập) và truyền vào service.
  5. Cập nhật test `StudentExamServiceImplTest` và chạy `./mvnw test -Dtest=StudentExamServiceImplTest` xác nhận PASS.

---

### Task 2: Frontend - Cập nhật Types & API Client cho Exam Library
- **Files:**
  - Modify: `frontend/src/features/exams/types/index.ts` (hoặc types tương ứng)
  - Modify: `frontend/src/features/exams/api/examApi.ts`
- **Steps:**
  1. Mở rộng interface `StudentExamSummary` có các trường: `isAttempted`, `userAttemptsCount`, `userHighestScore`, `userLatestScore`.
  2. Bổ sung tham số `status?: 'ALL' | 'ATTEMPTED' | 'UNATTEMPTED'` vào API call lấy đề thi.

---

### Task 3: Frontend - Thiết kế CSS & Component Thư viện Đề thi Mới
- **Files:**
  - Create: `frontend/src/features/exams/pages/student/ExamLibrary.css`
  - Modify: `frontend/src/features/exams/pages/student/ExamLibrary.tsx`
- **Steps:**
  1. Tạo `ExamLibrary.css`:
     - Hero banner gradient, search bar lớn bo tròn với icon kính lúp.
     - Segmented Tabs thanh lịch với hiệu ứng active pill.
     - Filter Chips cuộn ngang mượt mà (scrollable chips).
     - Card đề thi bo góc `rounded-2xl`, hiệu ứng hover 3D nâng nhẹ và bóng đổ mềm.
     - Badge trạng thái `✓ Đã làm (2 lần) • Điểm: 7.5` và `Chưa làm`.
  2. Cập nhật `ExamLibrary.tsx`:
     - Tích hợp kiểm tra mục tiêu học viên từ Onboarding API (lấy `targetCertificate` và `targetLanguage`).
     - Bổ sung Tab `[✨ Dành Cho Bạn]` tự động hiển thị các đề đúng chứng chỉ & ngôn ngữ mục tiêu.
     - Thay thế sidebar select cũ bằng hàng Filter Chips: Kỹ năng (`Nghe`, `Đọc`, `Viết`) và Trạng thái (`Tất cả`, `Chưa làm`, `Đã làm`).
     - Render card đề thi hiện đại hiển thị badge trạng thái đã thi / chưa thi, điểm cao nhất, và nút bấm `Làm bài ngay` / `Làm lại`.

---

### Task 4: Frontend - Kiểm thử tự động (Vitest)
- **Files:**
  - Create: `frontend/src/features/exams/__tests__/ExamLibrary.test.tsx`
- **Steps:**
  1. Viết test kiểm tra:
     - Render giao diện thư viện với đầy đủ tabs và chips.
     - Tự động kích hoạt tab "Dành cho bạn" khi học viên có mục tiêu Onboarding.
     - Lọc theo kỹ năng và trạng thái làm bài ("Chưa làm", "Đã làm").
     - Hiển thị chính xác badge điểm cao nhất của đề đã hoàn thành.
  2. Chạy `npx vitest run src/features/exams/__tests__/ExamLibrary.test.tsx` xác nhận PASS.
  3. Chạy `npx tsc -b` xác nhận 0 lỗi TypeScript.

---

### Task 5: Nghiệm thu & Báo cáo Diff
- **Steps:**
  1. Chạy toàn bộ test Backend và Frontend.
  2. Hiển thị tóm tắt diff thay đổi cho người dùng kiểm tra và xin phép commit.
