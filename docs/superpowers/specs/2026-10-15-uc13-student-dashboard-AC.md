# Tiêu Chí Nghiệm Thu & Thiết Kế Kịch Bản Kiểm Thử (AC & Test Design)
## Tính năng: UC13 - Xem Bảng Điều Khiển Học Viên (Student Dashboard)

Tài liệu được biên soạn tuân thủ quy chuẩn kỹ năng `acceptance-criteria-and-test-design` và theo chỉ thị: **tập trung kiểm thử toàn diện phân hệ Backend (API, Service, Aggregation, Security & Database), không bao gồm kịch bản kiểm thử giao diện Frontend**.

---

## 1. Phân tích Phạm vi & Tác nhân (Scope & Actors)

- **Tác nhân (Actor):** Học viên (`STUDENT` hoặc bất kỳ người dùng đã xác thực danh tính hợp lệ có JWT token).
- **Phạm vi trong task (In-Scope - Backend & Database):**
  - **DTOs:** Xây dựng cấu trúc dữ liệu phản hồi `StudentDashboardResponse` phân cấp rõ ràng:
    - `UserProfileSummary`: Thông tin cơ bản học viên (id, fullName, avatarUrl, targetLanguage).
    - `StreakStatsDto`: Chuỗi streak hiện tại, kỷ lục streak, tổng thời lượng học tích lũy, tổng XP, trạng thái học hôm nay (`isStudiedToday`).
    - `ExamStatsDto`: Tổng số bài thi đã hoàn thành, điểm trung bình (`averageScore`), thông tin bài thi gần nhất.
    - `VocabStatsDto`: Tổng số từ đã lưu, số từ đã thuộc (`status = 'MASTERED'`), số từ đang học (`status = 'LEARNING'`), tỷ lệ thuộc từ (`masteryRate`), số thẻ đến hạn ôn tập hôm nay (`dueTodayCount`).
    - `ActivityHeatmapDto`: Bản đồ nhiệt hoạt động học tập cả năm theo 5 cấp độ màu (Level 0 – 4) với danh sách `HeatmapDataPointDto`.
    - `ProgressChartDto`: Biểu đồ thời lượng học theo mốc thời gian (`THIS_WEEK`, `THIS_MONTH`, `ALL`) với danh sách `DailyChartPointDto`.
    - `SuggestedActionDto`: Danh sách hành động trực tiếp đề xuất cho học viên (`actionType`, `title`, `description`, `actionUrl`, `buttonText`).
  - **Service:** Xây dựng `StudentDashboardService` & `StudentDashboardServiceImpl`:
    - Truy vấn tổng hợp từ `UserStudyStatRepository`, `DailyStudyLogRepository`, `TestAttemptRepository`, `UserFlashcardRepository`.
    - Logic nhận diện tân học viên (`isNewUser` khi chưa có bài thi và chưa có từ vựng).
    - Logic phân bổ 5 cấp độ cho Study Activity Heatmap (Level 0 $\rightarrow$ Level 4).
    - Logic tổng hợp biểu đồ tiến độ theo mốc thời gian (tự động bù ngày trống với 0 phút).
  - **Controller:** Xây dựng `StudentDashboardController` với endpoint:
    - `GET /api/v1/student/dashboard?timeRange={THIS_WEEK|THIS_MONTH|ALL}&year={year}`
  - **Security:** Trích xuất an toàn `userId` từ JWT token (`@AuthenticationPrincipal CustomUserDetails`), tuyệt đối không nhận `userId` từ query param hay body (phòng chống lỗ hổng IDOR).
  - **Kiểm thử tự động Backend (Automated Tests):**
    - Unit Tests cho `StudentDashboardServiceImpl` bao phủ 100% logic tính toán, rẽ nhánh tân học viên và ma trận heatmap.
    - Integration / MockMvc Tests cho `StudentDashboardController` kiểm tra HTTP status, validation, bảo mật 401 Unauthorized và định dạng JSON phản hồi.
- **Phạm vi Frontend:** Triển khai giao diện theo Spec (không viết unit test FE theo yêu cầu).
- **Ngoài phạm vi (Out-of-Scope):**
  - Thuật toán AI phân tích gợi ý phức tạp.
  - Sửa đổi cấu trúc schema vật lý của CSDL (tận dụng nguyên vẹn các bảng hiện có).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1. AC 01: Học viên đã có dữ liệu xem Dashboard tổng quan (Luồng chính - Tuần này)
```gherkin
Kịch bản: Học viên đã có lịch sử học tập xem Dashboard mặc định trong tuần
Given Học viên đã đăng nhập thành công với JWT token hợp lệ của user có id = 10
And Trong CSDL user 10 đã có:
  | Bảng               | Dữ liệu                                                                           |
  | user_study_stats   | current_streak=5, highest_streak=10, total_learning_minutes=240, total_xp=500     |
  | test_attempts      | 2 bài thi đã hoàn thành (score = 7.0 và 8.0)                                      |
  | user_flashcards    | 20 từ (12 từ MASTERED, 8 từ LEARNING, 4 từ có next_review_date <= TODAY)           |
  | daily_study_logs   | Nhật ký học tập 7 ngày gần nhất                                                  |
When Client gửi HTTP GET /api/v1/student/dashboard với Header "Authorization: Bearer <token>"
Then Hệ thống trả về HTTP 200 OK
And Response body có status code 200, message "Lấy dữ liệu bảng điều khiển thành công"
And Data trả về có:
  | isNewUser                       | false                                                              |
  | streak.currentStreak            | 5                                                                  |
  | streak.highestStreak            | 10                                                                 |
  | streak.totalLearningMinutes     | 240                                                                |
  | streak.totalXp                  | 500                                                                |
  | examStats.totalExamsTaken       | 2                                                                  |
  | examStats.averageScore          | 7.5                                                                |
  | vocabStats.totalWords           | 20                                                                 |
  | vocabStats.masteredWords        | 12                                                                 |
  | vocabStats.masteryRate          | 60.0                                                               |
  | vocabStats.dueTodayCount        | 4                                                                  |
  | activityHeatmap.year            | Năm hiện tại (2026)                                                |
And progressChart chứa đầy đủ các điểm dữ liệu của 7 ngày trong tuần
And suggestedActions chứa thẻ ôn tập từ vựng (vì có 4 từ đến hạn) và thẻ luyện đề thi thử
```

---

### 2.2. AC 02: Tân học viên chưa có lịch sử học tập (Luồng 3a - Cold Start)
```gherkin
Kịch bản: Học viên mới đăng ký tài khoản lần đầu xem Dashboard
Given Học viên mới đăng ký đã đăng nhập với JWT token hợp lệ của user có id = 99
And Trong CSDL user 99 chưa có bài thi nào trong test_attempts (count = 0)
And Trong CSDL user 99 chưa lưu từ vựng nào trong user_flashcards (count = 0)
When Client gửi HTTP GET /api/v1/student/dashboard
Then Hệ thống trả về HTTP 200 OK
And Response body có:
  | isNewUser                       | true                                                               |
  | streak.currentStreak            | 1 (khởi tạo chuỗi ngày 1 chào mừng)                                |
  | streak.highestStreak            | 1                                                                  |
  | streak.totalLearningMinutes     | 0                                                                  |
  | streak.totalXp                  | 0                                                                  |
  | examStats.totalExamsTaken       | 0                                                                  |
  | examStats.averageScore          | 0.0                                                                |
  | vocabStats.totalWords           | 0                                                                  |
  | vocabStats.masteredWords        | 0                                                                  |
  | vocabStats.masteryRate          | 0.0                                                                |
  | vocabStats.dueTodayCount        | 0                                                                  |
And activityHeatmap có totalActiveDays = 1 (ngày hôm nay với Level 1)
And suggestedActions chỉ chứa đúng 1 hành động có actionType = "PLACEMENT_TEST"
And actionUrl trỏ tới màn hình thi thử / làm bài đánh giá đầu vào
```

---

### 2.3. AC 03: Bộ lọc mốc thời gian tiến độ học tập (`timeRange`)
```gherkin
Kịch bản: Lọc biểu đồ tiến độ học tập theo tháng và toàn bộ thời gian
Given Học viên đã đăng nhập và có dữ liệu học tập trải dài nhiều tháng
When Client gửi HTTP GET /api/v1/student/dashboard?timeRange=THIS_MONTH
Then Hệ thống trả về HTTP 200 OK
And progressChart có timeRange = "THIS_MONTH"
And progressChart.dataPoints chứa danh sách các ngày từ đầu tháng đến ngày hiện tại
When Client gửi HTTP GET /api/v1/student/dashboard?timeRange=ALL
Then Hệ thống trả về HTTP 200 OK
And progressChart có timeRange = "ALL"
When Client gửi HTTP GET /api/v1/student/dashboard?timeRange=INVALID_RANGE
Then Hệ thống tự động fallback về timeRange = "THIS_WEEK" và trả về HTTP 200 OK
```

---

### 2.4. AC 04: Biểu đồ nhiệt hoạt động học tập (Study Activity Heatmap)
```gherkin
Kịch bản: Tính toán cấp độ màu Heatmap theo thời lượng học tập trong năm
Given Học viên đã đăng nhập và có nhật ký học tập trong năm 2026 với các ngày:
  | Ngày         | learning_minutes | Cấp độ kỳ vọng |
  | 2026-05-10   | 0                | Level 0        |
  | 2026-05-11   | 10               | Level 1        |
  | 2026-05-12   | 25               | Level 2        |
  | 2026-05-13   | 45               | Level 3        |
  | 2026-05-14   | 90               | Level 4        |
When Client gửi HTTP GET /api/v1/student/dashboard?year=2026
Then Hệ thống trả về HTTP 200 OK
And activityHeatmap.year = 2026
And activityHeatmap.dataPoints chứa các phần tử có đúng level tương ứng:
  | date       | level |
  | 2026-05-11 | 1     |
  | 2026-05-12 | 2     |
  | 2026-05-13 | 3     |
  | 2026-05-14 | 4     |
When Client gửi HTTP GET /api/v1/student/dashboard không kèm param year
Then Hệ thống tự động lấy năm hiện tại (LocalDate.now().getYear())
```

---

### 2.5. AC 05: Kiểm tra trạng thái học hôm nay và cảnh báo duy trì Streak
```gherkin
Kịch bản: Xác định học viên đã học hôm nay hay chưa để hiển thị huy hiệu ngọn lửa
Given Học viên A có bản ghi user_study_stats với last_study_date = Hôm nay (LocalDate.now())
When Học viên A gọi API GET /api/v1/student/dashboard
Then Response body có streak.isStudiedToday = true

Given Học viên B có bản ghi user_study_stats với last_study_date = Hôm qua (LocalDate.now().minusDays(1))
When Học viên B gọi API GET /api/v1/student/dashboard
Then Response body có streak.isStudiedToday = false
And streak.currentStreak vẫn giữ nguyên số ngày của chuỗi hiện tại

Given Học viên C có bản ghi user_study_stats với last_study_date = Cách đây 3 ngày (quá hạn)
When Học viên C gọi API GET /api/v1/student/dashboard
Then Response body có streak.isStudiedToday = false
```

---

### 2.6. AC 06: Bảo mật, Xác thực & Phòng chống IDOR
```gherkin
Kịch bản: Bảo vệ Endpoint Dashboard khỏi truy cập trái phép và giả mạo ID
When Client gửi HTTP GET /api/v1/student/dashboard không kèm Header Authorization
Then Hệ thống trả về HTTP 401 Unauthorized
And Không có dữ liệu nào được tiết lộ

When Client gửi HTTP GET /api/v1/student/dashboard?userId=999 kèm Header Authorization của User 10
Then Hệ thống hoàn toàn phớt lờ param "userId=999"
And Hệ thống chỉ lấy thông tin của User 10 (được trích xuất từ JWT token trong SecurityContext)
```

---

## 3. Checklist Quy tắc Nghiệp vụ (Business Rules Checklist)

- [x] **Tránh phép chia cho 0:** Nếu `totalWords == 0` $\rightarrow$ `masteryRate` phải trả về `0.0` (không gây lỗi `ArithmeticException` hoặc `NaN`).
- [x] **Tránh Null Pointer khi tính Điểm TB:** Nếu `totalExamsTaken == 0` $\rightarrow$ `averageScore` phải trả về `0.0`.
- [x] **Tự động khởi tạo bản ghi Stats:** Nếu user đăng nhập lần đầu chưa có bản ghi trong `user_study_stats` $\rightarrow$ Service tự động khởi tạo với `current_streak = 1`, `highest_streak = 1`, `total_learning_minutes = 0`, `total_xp = 0`.
- [x] **Phân định ranh giới Cấp độ Heatmap:**
  - `0 phút`: Level 0.
  - `1 đến 15 phút`: Level 1.
  - `16 đến 30 phút`: Level 2.
  - `31 đến 60 phút`: Level 3.
  - `> 60 phút`: Level 4.
- [x] **Bù ngày trống trong Biểu đồ:** Đảm bảo trả về đủ 7 ngày cho `THIS_WEEK` (từ Thứ 2 đến Chủ nhật hoặc 7 ngày qua), những ngày học viên không học thì `learningMinutes = 0`.

---

## 4. Bảng Test Cases Backend Chuẩn Hóa (Standard Backend Test Cases)

| Mã Test Case | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_DASHBOARD_GET_01** | Happy Path | Lấy dữ liệu Dashboard thành công cho học viên đang học | User 1 đã có bài thi, từ vựng, streak | 1. Đăng nhập User 1<br>2. Gửi GET `/api/v1/student/dashboard` | Header `Bearer <token_user1>` | HTTP 200 OK. `isNewUser = false`, trả đầy đủ streak, stats thi thử, từ vựng và heatmap. |
| **TC_DASHBOARD_GET_02** | Happy Path | Lấy dữ liệu Dashboard cho Tân học viên (Cold Start) | User mới đăng ký, 0 bài thi, 0 từ | 1. Đăng nhập User mới<br>2. Gửi GET `/api/v1/student/dashboard` | Header `Bearer <token_new_user>` | HTTP 200 OK. `isNewUser = true`, streak = 1, hành động đề xuất là `PLACEMENT_TEST`. |
| **TC_DASHBOARD_TIME_01** | Happy Path | Lọc tiến độ học tập theo mốc "Tháng này" | User đã có log học trong tháng | Gửi GET `/api/v1/student/dashboard?timeRange=THIS_MONTH` | `timeRange=THIS_MONTH` | HTTP 200 OK. `progressChart.timeRange = "THIS_MONTH"`, dữ liệu các ngày trong tháng. |
| **TC_DASHBOARD_TIME_02** | Happy Path | Lọc tiến độ học tập theo mốc "Tất cả" | User đã học nhiều tháng | Gửi GET `/api/v1/student/dashboard?timeRange=ALL` | `timeRange=ALL` | HTTP 200 OK. `progressChart.timeRange = "ALL"`. |
| **TC_DASHBOARD_TIME_03** | Boundary | Truyền giá trị `timeRange` không hợp lệ | Đã xác thực JWT | Gửi GET `/api/v1/student/dashboard?timeRange=NEXT_YEAR` | `timeRange=NEXT_YEAR` | HTTP 200 OK. Hệ thống tự động fallback về `THIS_WEEK`. |
| **TC_DASHBOARD_HEAT_01** | Happy Path | Lấy dữ liệu Heatmap theo năm chỉ định | Có log trong năm 2025 | Gửi GET `/api/v1/student/dashboard?year=2025` | `year=2025` | HTTP 200 OK. `activityHeatmap.year = 2025`. |
| **TC_DASHBOARD_HEAT_02** | Boundary | Kiểm tra ánh xạ đúng 5 cấp độ Level 0 - Level 4 | Mock các ngày có phút học 0, 15, 30, 60, 90 | Gọi phương thức tính Level của Service | Minutes: [0, 15, 30, 60, 90] | Trả về các level tương ứng: [0, 1, 2, 3, 4]. |
| **TC_DASHBOARD_STREAK_01**| Edge Case | User đã học hôm nay (`isStudiedToday = true`) | `last_study_date = today` | Gửi GET `/api/v1/student/dashboard` | Hôm nay | HTTP 200 OK. `isStudiedToday = true`. |
| **TC_DASHBOARD_STREAK_02**| Edge Case | User hôm nay chưa học (`isStudiedToday = false`) | `last_study_date = yesterday` | Gửi GET `/api/v1/student/dashboard` | Hôm qua | HTTP 200 OK. `isStudiedToday = false`, `currentStreak` không bị reset ngay lúc xem. |
| **TC_DASHBOARD_CALC_01** | Edge Case | User có 0 từ vựng (Kiểm tra lỗi chia cho 0) | `totalWords = 0` | Gửi GET `/api/v1/student/dashboard` | 0 từ | HTTP 200 OK. `masteryRate = 0.0`, không phát sinh lỗi ArithmeticException. |
| **TC_DASHBOARD_CALC_02** | Edge Case | User có 0 bài thi (Kiểm tra AVG score null) | `totalExamsTaken = 0` | Gửi GET `/api/v1/student/dashboard` | 0 bài | HTTP 200 OK. `averageScore = 0.0`. |
| **TC_DASHBOARD_SEC_01**  | Security | Truy cập không truyền Bearer token | Không đăng nhập | Gửi GET `/api/v1/student/dashboard` không có Header Authorization | Không Header | HTTP 401 Unauthorized. |
| **TC_DASHBOARD_SEC_02**  | Security | Cố tình truyền `userId` của người khác vào query param (IDOR attack) | Đăng nhập User 1 | Gửi GET `/api/v1/student/dashboard?userId=2` | `userId=2` | HTTP 200 OK. Nhưng dữ liệu trả về 100% thuộc về User 1 (trích từ JWT). |
| **TC_DASHBOARD_ACT_01**  | Business | Có từ vựng đến hạn SRS $\rightarrow$ Gợi ý thẻ Ôn tập từ vựng | Có 5 từ có `next_review_date <= today` | Gửi GET `/api/v1/student/dashboard` | 5 từ đến hạn | `suggestedActions` có thẻ loại `VOCAB_REVIEW`, actionUrl = `/student/flashcards`. |
