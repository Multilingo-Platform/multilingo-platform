# Kế Hoạch Triển Khai: UC13 - Xem Bảng Điều Khiển Học Viên (Student Dashboard)

> **Dành cho Agent thực thi:** BẮT BUỘC SỬ DỤNG SUB-SKILL: Sử dụng `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans` để thực thi kế hoạch này từng task một. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu (Goal):** Xây dựng hoàn chỉnh tính năng Bảng điều khiển trung tâm học viên (UC13 - Student Dashboard) bao gồm API tổng hợp Backend (Stats, Streak, Flashcard, Test Attempts, GitHub-style Study Activity Heatmap, Timeline chart) và Giao diện người dùng Frontend theo chuẩn Feature-Sliced Design.

**Kiến trúc (Architecture):** 
- **Backend:** Cung cấp endpoint tổng hợp duy nhất `GET /api/v1/student/dashboard?timeRange={...}&year={...}` thuộc module `gamification`. Tối ưu truy vấn tránh N+1, tự động phân nhánh Cold Start / Active Learner, tính toán ma trận Heatmap 52 tuần theo 5 cấp độ màu và tự động bù ngày trống cho biểu đồ tiến độ. Trích xuất an toàn `userId` từ JWT token.
- **Frontend:** Thiết kế Feature-Sliced Design đặt tại `frontend/src/features/student/dashboard/`, tích hợp TanStack Query cache mượt mà, component `StudyActivityHeatmap` mô phỏng trực quan biểu đồ đóng góp của GitHub với CSS Grid thuần, không phát sinh dependency nặng.

**Công nghệ (Tech Stack):** Spring Boot 3, Spring Data JPA, Spring Security, React 19, TypeScript, Tailwind CSS, Lucide icons, TanStack Query.

**Tài liệu tham chiếu:**
- Spec: [docs/superpowers/specs/2026-10-15-uc13-student-dashboard-spec.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-10-15-uc13-student-dashboard-spec.md)
- Tiêu chí nghiệm thu (AC): [docs/superpowers/specs/2026-10-15-uc13-student-dashboard-AC.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-10-15-uc13-student-dashboard-AC.md)

---

## Ràng Buộc Chung (Global Constraints)

- **Chuẩn Base Backend:** Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`, lỗi nghiệp vụ ném qua `AppException(ErrorCode.XYZ)`.
- **Bảo mật danh tính:** Tuyệt đối không nhận `userId` qua query param hay body; `userId` chỉ được lấy từ `@AuthenticationPrincipal CustomUserDetails`.
- **Kiểm thử tự động:** Backend tuân thủ TDD (Red-Green-Refactor) với JUnit 5 & Mockito / MockMvc.
- **Phạm vi kiểm thử:** Theo yêu cầu của dự án, **chỉ viết testcase tự động cho Backend**, không viết testcase cho Frontend.
- **Quy chuẩn Code Frontend:** Feature-Sliced Design, type-safe 100%, không dùng `any`, tuân thủ Design Tokens của hệ thống.

---

## Trọng Tâm Rà Soát (Review Focus)

1. **Phép chia cho 0 khi tính tỷ lệ thuộc từ:** Khi học viên có 0 từ vựng (`totalWords == 0`), `masteryRate` phải trả về `0.0`, không được gây lỗi `ArithmeticException` hoặc `NaN`.
2. **Xử lý Null khi tính Điểm trung bình thi thử:** Khi học viên chưa thi bài nào (`totalExamsTaken == 0`), `averageScore` phải trả về `0.0`.
3. **Bù ngày trống trong Biểu đồ tiến độ:** Nếu học viên không học trong ngày nào đó, biểu đồ vẫn phải hiển thị đủ 7 ngày trong tuần với `learningMinutes = 0`.
4. **Ánh xạ 5 cấp độ màu Heatmap:** Đảm bảo chính xác ngưỡng phút (0m $\rightarrow$ L0, 1-15m $\rightarrow$ L1, 16-30m $\rightarrow$ L2, 31-60m $\rightarrow$ L3, >60m $\rightarrow$ L4).
5. **Cold Start cho Tân học viên:** Khi chưa có bài thi và từ vựng, hệ thống phải kích hoạt cờ `isNewUser = true`, gán streak ngày 1 và chỉ gợi ý `PLACEMENT_TEST`.

---

## Kế Hoạch Chi Tiết Từng Task

### Task 1: Xây dựng hệ thống DTO và Enum cho Student Dashboard (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/constant/TimeRange.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/UserProfileSummary.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/StreakStatsDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/ExamStatsDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/VocabStatsDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/HeatmapDataPointDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/ActivityHeatmapDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/DailyChartPointDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/ProgressChartDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/SuggestedActionDto.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/dto/dashboard/StudentDashboardResponse.java`

**Interfaces:**
- Produces: `StudentDashboardResponse` đầy đủ 7 khối thông tin chuẩn Spec để tầng Service đóng gói.

- [ ] **Step 1: Định nghĩa Enum `TimeRange`**
  ```java
  package com.multilingo.backend.modules.gamification.constant;

  public enum TimeRange {
      THIS_WEEK,
      THIS_MONTH,
      ALL;

      public static TimeRange fromString(String value) {
          if (value == null) return THIS_WEEK;
          try {
              return TimeRange.valueOf(value.toUpperCase());
          } catch (IllegalArgumentException e) {
              return THIS_WEEK;
          }
      }
  }
  ```

- [ ] **Step 2: Tạo các DTO thành phần**
  - Tạo `UserProfileSummary.java` (`id`, `fullName`, `avatarUrl`, `targetLanguage`).
  - Tạo `StreakStatsDto.java` (`currentStreak`, `highestStreak`, `totalLearningMinutes`, `totalXp`, `isStudiedToday`, `lastStudyDate`).
  - Tạo `ExamStatsDto.java` (`totalExamsTaken`, `averageScore`, `latestExamTitle`, `latestExamScore`, `latestExamDate`).
  - Tạo `VocabStatsDto.java` (`totalWords`, `masteredWords`, `learningWords`, `masteryRate`, `dueTodayCount`).
  - Tạo `HeatmapDataPointDto.java` (`date`, `learningMinutes`, `flashcardsReviewed`, `practiceQuestions`, `xpEarned`, `level`).
  - Tạo `ActivityHeatmapDto.java` (`year`, `totalActiveDays`, `longestStreak`, `dataPoints`).
  - Tạo `DailyChartPointDto.java` (`date`, `label`, `learningMinutes`, `questionsAnswered`).
  - Tạo `ProgressChartDto.java` (`timeRange`, `dataPoints`).
  - Tạo `SuggestedActionDto.java` (`type`, `title`, `description`, `badge`, `actionUrl`, `buttonText`).

- [ ] **Step 3: Tạo `StudentDashboardResponse.java`**
  ```java
  package com.multilingo.backend.modules.gamification.dto.dashboard;

  import lombok.*;
  import java.util.List;

  @Getter
  @Setter
  @NoArgsConstructor
  @AllArgsConstructor
  @Builder
  public class StudentDashboardResponse {
      private Boolean isNewUser;
      private UserProfileSummary userProfile;
      private StreakStatsDto streak;
      private ExamStatsDto examStats;
      private VocabStatsDto vocabStats;
      private ActivityHeatmapDto activityHeatmap;
      private ProgressChartDto progressChart;
      private List<SuggestedActionDto> suggestedActions;
  }
  ```

- [ ] **Step 4: Kiểm tra compile**
  Run: `cd backend && ./mvnw test-compile`
  Expected: `BUILD SUCCESS`

---

### Task 2: Bổ sung Repository Projections & Aggregation Queries (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/UserVocabStatsProjection.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/UserFlashcardRepository.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/repository/TestAttemptRepository.java`

**Interfaces:**
- Consumes: `UserFlashcardRepository`, `TestAttemptRepository`
- Produces: 
  - `UserVocabStatsProjection getUserVocabStats(Integer userId, Instant now)`
  - `long countByUserIdAndStatus(Integer userId, AttemptStatus status)`
  - `Double getAverageScoreByUserIdAndStatus(Integer userId, AttemptStatus status)`
  - `Optional<TestAttempt> findFirstByUserIdAndStatusOrderByCompletedAtDesc(Integer userId, AttemptStatus status)`

- [ ] **Step 1: Tạo Projection `UserVocabStatsProjection.java`**
  ```java
  package com.multilingo.backend.modules.vocab.dto.response;

  public interface UserVocabStatsProjection {
      Long getTotalCards();
      Long getMasteredCards();
      Long getLearningCards();
      Long getDueReviewCards();
  }
  ```

- [ ] **Step 2: Thêm query vào `UserFlashcardRepository.java`**
  ```java
  @Query("""
      SELECT COUNT(u.id) AS totalCards,
             COALESCE(SUM(CASE WHEN u.status = 'MASTERED' THEN 1 ELSE 0 END), 0) AS masteredCards,
             COALESCE(SUM(CASE WHEN u.status = 'LEARNING' THEN 1 ELSE 0 END), 0) AS learningCards,
             COALESCE(SUM(CASE WHEN u.nextReviewDate <= :now THEN 1 ELSE 0 END), 0) AS dueReviewCards
      FROM UserFlashcard u
      WHERE u.userId = :userId
  """)
  UserVocabStatsProjection getUserVocabStats(@Param("userId") Integer userId, @Param("now") java.time.Instant now);
  ```

- [ ] **Step 3: Thêm aggregate methods vào `TestAttemptRepository.java`**
  ```java
  long countByUserIdAndStatus(Integer userId, AttemptStatus status);

  @Query("SELECT AVG(a.score) FROM TestAttempt a WHERE a.userId = :userId AND a.status = :status")
  Double getAverageScoreByUserIdAndStatus(@Param("userId") Integer userId, @Param("status") AttemptStatus status);

  Optional<TestAttempt> findFirstByUserIdAndStatusOrderByCompletedAtDesc(Integer userId, AttemptStatus status);
  ```

- [ ] **Step 4: Kiểm tra compile**
  Run: `cd backend && ./mvnw test-compile`
  Expected: `BUILD SUCCESS`

---

### Task 3: Phát triển `StudentDashboardService` với TDD (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/service/StudentDashboardService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/service/impl/StudentDashboardServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/gamification/service/StudentDashboardServiceTest.java`

**Interfaces:**
- Consumes: `UserRepository`, `UserStudyStatRepository`, `DailyStudyLogRepository`, `TestAttemptRepository`, `UserFlashcardRepository`
- Produces: `StudentDashboardResponse getStudentDashboard(Integer userId, String timeRangeStr, Integer year)`

- [ ] **Step 1: Viết test failing `StudentDashboardServiceTest.java`**
  Kiểm thử bao phủ:
  1. `getStudentDashboard_ActiveUser_Success`: User đã có dữ liệu, `isNewUser = false`, trả đúng streak, stats thi thử, từ vựng và heatmap.
  2. `getStudentDashboard_NewUser_ColdStart`: User 0 bài thi, 0 từ vựng $\rightarrow$ `isNewUser = true`, streak = 1, suggestedActions có `PLACEMENT_TEST`.
  3. `getStudentDashboard_AvoidDivisionByZero`: Khi `totalWords == 0` $\rightarrow$ `masteryRate = 0.0`.
  4. `calculateHeatmapLevel`: Kiểm tra chính xác 5 cấp độ (0, 15, 30, 60, 90 phút $\rightarrow$ Level 0, 1, 2, 3, 4).
  5. `getStudentDashboard_StreakAtRisk`: Hôm qua học, hôm nay chưa học $\rightarrow$ `isStudiedToday = false`.

- [ ] **Step 2: Chạy test để xác nhận FAIL**
  Run: `cd backend && ./mvnw test -Dtest=StudentDashboardServiceTest`
  Expected: FAIL (vì chưa có implementation)

- [ ] **Step 3: Định nghĩa Interface `StudentDashboardService.java`**
  ```java
  package com.multilingo.backend.modules.gamification.service;

  import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;

  public interface StudentDashboardService {
      StudentDashboardResponse getStudentDashboard(Integer userId, String timeRangeStr, Integer year);
  }
  ```

- [ ] **Step 4: Viết mã triển khai `StudentDashboardServiceImpl.java`**
  - Inject 5 repositories (`userRepository`, `userStudyStatRepository`, `dailyStudyLogRepository`, `testAttemptRepository`, `userFlashcardRepository`).
  - Tính toán `isNewUser`: nếu `totalExams == 0 && totalWords == 0`.
  - Tự động bù ngày trống cho biểu đồ `progressChart`.
  - Ánh xạ ma trận 52 tuần cho `activityHeatmap` với 5 cấp độ màu.
  - Xử lý an toàn: `COALESCE`, chia cho 0, null check.

- [ ] **Step 5: Chạy lại test để xác nhận PASS**
  Run: `cd backend && ./mvnw test -Dtest=StudentDashboardServiceTest`
  Expected: `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0` $\rightarrow$ `BUILD SUCCESS`

---

### Task 4: Phát triển `StudentDashboardController` với TDD (Backend)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/gamification/controller/StudentDashboardController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/gamification/controller/StudentDashboardControllerTest.java`

**Interfaces:**
- Consumes: `StudentDashboardService`, `CustomUserDetails`
- Produces: `GET /api/v1/student/dashboard` $\rightarrow$ `ResponseEntity<ApiResponse<StudentDashboardResponse>>`

- [ ] **Step 1: Viết test failing `StudentDashboardControllerTest.java` (@WebMvcTest)**
  Kiểm thử các kịch bản:
  1. `getDashboard_Authenticated_Returns200`: Gọi kèm token hợp lệ, trả về HTTP 200 OK và đúng cấu trúc JSON (`TC_DASHBOARD_GET_01`).
  2. `getDashboard_Unauthenticated_Returns401`: Gọi không có token, trả về HTTP 401 Unauthorized (`TC_DASHBOARD_SEC_01`).
  3. `getDashboard_WithQueryParams_PassesToService`: Gọi với `timeRange=THIS_MONTH&year=2025` $\rightarrow$ Service nhận đúng tham số (`TC_DASHBOARD_TIME_01`, `TC_DASHBOARD_HEAT_01`).
  4. `getDashboard_IgnoresUserIdQueryParam_IDORProtection`: Truyền `?userId=999`, Controller vẫn trích xuất `userId` từ token (`TC_DASHBOARD_SEC_02`).

- [ ] **Step 2: Chạy test để xác nhận FAIL**
  Run: `cd backend && ./mvnw test -Dtest=StudentDashboardControllerTest`
  Expected: FAIL

- [ ] **Step 3: Triển khai `StudentDashboardController.java`**
  ```java
  package com.multilingo.backend.modules.gamification.controller;

  import com.multilingo.backend.common.base.ApiResponse;
  import com.multilingo.backend.common.security.CustomUserDetails;
  import com.multilingo.backend.modules.gamification.dto.dashboard.StudentDashboardResponse;
  import com.multilingo.backend.modules.gamification.service.StudentDashboardService;
  import lombok.RequiredArgsConstructor;
  import org.springframework.http.ResponseEntity;
  import org.springframework.security.core.annotation.AuthenticationPrincipal;
  import org.springframework.web.bind.annotation.*;

  @RestController
  @RequestMapping("/api/v1/student/dashboard")
  @RequiredArgsConstructor
  public class StudentDashboardController {

      private final StudentDashboardService studentDashboardService;

      @GetMapping
      public ResponseEntity<ApiResponse<StudentDashboardResponse>> getDashboard(
              @AuthenticationPrincipal CustomUserDetails userDetails,
              @RequestParam(value = "timeRange", defaultValue = "THIS_WEEK") String timeRange,
              @RequestParam(value = "year", required = false) Integer year
      ) {
          Integer userId = userDetails.getUser().getId();
          StudentDashboardResponse response = studentDashboardService.getStudentDashboard(userId, timeRange, year);
          return ResponseEntity.ok(ApiResponse.success("Lấy dữ liệu bảng điều khiển thành công", response));
      }
  }
  ```

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
  Run: `cd backend && ./mvnw test -Dtest=StudentDashboardControllerTest`
  Expected: `BUILD SUCCESS`

---

### Task 5: Frontend - Types & API Client

**Files:**
- Create: `frontend/src/features/student/dashboard/types/dashboard.types.ts`
- Create: `frontend/src/features/student/dashboard/api/studentDashboardApi.ts`

- [ ] **Step 1: Định nghĩa TypeScript Interfaces trong `dashboard.types.ts`**
  Định nghĩa đầy đủ:
  - `UserProfileSummary`
  - `StreakStats`
  - `ExamStats`
  - `VocabStats`
  - `HeatmapDataPoint`, `ActivityHeatmap`
  - `DailyChartPoint`, `ProgressChart`
  - `SuggestedAction`
  - `StudentDashboardData`

- [ ] **Step 2: Viết hàm gọi API trong `studentDashboardApi.ts`**
  ```typescript
  import axiosClient from "../../../core/api/axiosClient";
  import type { ApiResponse } from "../../../core/types/api.types";
  import type { StudentDashboardData } from "../types/dashboard.types";

  export const studentDashboardApi = {
    getDashboard: async (timeRange: string = "THIS_WEEK", year?: number): Promise<StudentDashboardData> => {
      const params: Record<string, any> = { timeRange };
      if (year) params.year = year;
      const res = await axiosClient.get<ApiResponse<StudentDashboardData>>("/api/v1/student/dashboard", { params });
      return res.data.data;
    },
  };
  ```

- [ ] **Step 3: Kiểm tra TypeScript build**
  Run: `cd frontend && npm run build`
  Expected: `✓ built in ...ms`

---

### Task 6: Frontend - Greeting, Metric Cards & New User Welcome Banner

**Files:**
- Create: `frontend/src/features/student/dashboard/components/GreetingHeader.tsx`
- Create: `frontend/src/features/student/dashboard/components/NewUserWelcomeCard.tsx`
- Create: `frontend/src/features/student/dashboard/components/MetricStatCard.tsx`
- Create: `frontend/src/features/student/dashboard/components/SuggestedActionCard.tsx`

- [ ] **Step 1: Xây dựng `GreetingHeader.tsx`**
  - Chào theo buổi (Sáng: "Chào buổi sáng", Chiều: "Chào buổi chiều", Tối: "Chào buổi tối").
  - Huy hiệu Streak với icon ngọn lửa `Flame` màu cam rực. Cảnh báo viền vàng nếu `isStudiedToday = false`.
  - Huy hiệu XP với icon ngôi sao `Sparkles` màu vàng kim.

- [ ] **Step 2: Xây dựng `NewUserWelcomeCard.tsx`**
  - Render khi `isNewUser = true`.
  - Banner gradient hiện đại, lời chào mừng và nút CTA lớn: *"Bắt đầu làm bài thi đánh giá đầu vào (Placement Test)"* dẫn tới `/student/library`.

- [ ] **Step 3: Xây dựng `MetricStatCard.tsx`**
  - 3 thẻ hiển thị dạng Grid:
    - Card 1: Thời lượng học (`Clock`) - Tổng phút học.
    - Card 2: Năng lực thi thử (`FileText`) - Số bài thi đã hoàn thành & Điểm TB.
    - Card 3: Vốn từ vựng (`BookOpen`) - Tổng từ & Tỷ lệ thuộc từ ghi nhớ.

- [ ] **Step 4: Xây dựng `SuggestedActionCard.tsx`**
  - Hiển thị danh sách gợi ý hành động (Ôn tập từ vựng SRS hoặc Luyện thi thử tiếp theo).
  - Có badge nổi bật và nút chuyển hướng trực tiếp.

- [ ] **Step 5: Kiểm tra lint**
  Run: `cd frontend && npm run lint`
  Expected: `Found 0 warnings and 0 errors`

---

### Task 7: Frontend - Study Activity Heatmap & Progress Timeline Chart

**Files:**
- Create: `frontend/src/features/student/dashboard/components/StudyActivityHeatmap.tsx`
- Create: `frontend/src/features/student/dashboard/components/ProgressChart.tsx`
- Create: `frontend/src/features/student/dashboard/components/DashboardTimeFilter.tsx`

- [ ] **Step 1: Xây dựng `StudyActivityHeatmap.tsx` (Bản đồ nhiệt 52 tuần dạng GitHub)**
  - Lưới CSS Grid 7 hàng (Mon, Wed, Fri...).
  - 52 cột biểu diễn các tuần trong năm với tên tháng phía trên (Oct, Nov, Dec...).
  - 5 cấp độ màu: Level 0 (xám), Level 1 (xanh nhạt), Level 2 (xanh vừa), Level 3 (xanh đậm), Level 4 (xanh bứt phá 🔥).
  - Hover hiển thị Tooltip: Ngày, số phút học, số từ đã ôn, XP.
  - Cột chuyển đổi năm (2026, 2025...) bên phải.
  - Chú giải thang đo: `Less ▢ ▢ ▢ ▢ ▢ More`.

- [ ] **Step 2: Xây dựng `ProgressChart.tsx` & `DashboardTimeFilter.tsx`**
  - `ProgressChart.tsx`: Biểu đồ cột biểu diễn số phút học theo từng ngày trong tuần/tháng với hiệu ứng hover tooltip.
  - `DashboardTimeFilter.tsx`: Tab chuyển đổi mượt mà `[ Tuần này ]` `[ Tháng này ]` `[ Tất cả ]`.

- [ ] **Step 3: Kiểm tra lint & build**
  Run: `cd frontend && npm run lint && npm run build`
  Expected: `✓ built in ...ms`

---

### Task 8: Frontend - Lắp ráp StudentDashboardPage & Cấu hình Router

**Files:**
- Create: `frontend/src/features/student/dashboard/pages/StudentDashboardPage.tsx`
- Modify: `frontend/src/app/router.tsx:105-113`

- [ ] **Step 1: Tạo trang tổng thể `StudentDashboardPage.tsx`**
  - Sử dụng `@tanstack/react-query`: `useQuery(['student-dashboard', timeRange, selectedYear], ...)`.
  - Hiển thị Skeleton loading khi đang tải dữ liệu.
  - Hiển thị `NewUserWelcomeCard` nếu `isNewUser = true`.
  - Kết nối `GreetingHeader`, `MetricStatCard`, `StudyActivityHeatmap`, `ProgressChart`, `SuggestedActionCard`.

- [ ] **Step 2: Cập nhật route trong `frontend/src/app/router.tsx`**
  - Thay thế placeholder tại `path: "dashboard"` bằng:
    ```tsx
    import StudentDashboardPage from "../features/student/dashboard/pages/StudentDashboardPage";
    ...
    {
      path: "dashboard",
      element: <StudentDashboardPage />,
    },
    ```

- [ ] **Step 3: Kiểm tra lint và build Frontend**
  Run: `cd frontend && npm run lint && npm run build`
  Expected: 0 warnings, 0 errors, build thành công.

---

### Task 9: Nghiệm thu Toàn diện & Bằng chứng Kết quả (Verification Before Completion)

**Files:** Toàn bộ dự án

- [ ] **Step 1: Chạy toàn bộ Test Suite Backend**
  Run: `cd backend && ./mvnw clean test`
  Expected: `BUILD SUCCESS` (Toàn bộ Unit Test và MockMvc Test PASS 100%).

- [ ] **Step 2: Kiểm tra Lint và Build Frontend**
  Run: `cd frontend && npm run lint && npm run build`
  Expected: `Found 0 warnings and 0 errors` và Vite build thành công.

- [ ] **Step 3: Trình bày tóm tắt diff & Xin phê duyệt commit**
  Hiển thị danh sách file tạo mới/sửa đổi cho người dùng xác nhận trước khi commit.
