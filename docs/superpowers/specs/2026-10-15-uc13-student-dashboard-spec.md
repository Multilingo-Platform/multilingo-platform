# Đặc Tả Kỹ Thuật: UC13 - Xem Bảng Điều Khiển Học Viên (Student Dashboard)

## 1. Mục tiêu & Bối cảnh

### 1.1. Mục tiêu
Cung cấp màn hình Bảng điều khiển trung tâm (Central Learning Dashboard) cho học viên trong toàn bộ nền tảng Multilingo Platform. 
Tính năng tổng hợp dữ liệu học tập đa phân hệ bao gồm:
- **Thi thử & Đánh giá năng lực:** Số bài thi đã hoàn thành, điểm trung bình, kết quả bài thi gần nhất.
- **Từ vựng & Sổ tay Flashcard:** Tổng số từ vựng đã lưu, tỷ lệ thuộc từ, số từ vựng cần ôn tập hôm nay (theo thuật toán SRS).
- **Chuỗi ngày học & Gamification:** Chuỗi ngày học liên tục (Streak 🔥), kỷ lục streak, tổng thời lượng học thực tế (phút) và tổng điểm kinh nghiệm (XP).
- **Biểu đồ nhiệt hoạt động học tập (Study Activity Heatmap dạng GitHub):** Ma trận 52 tuần x 7 ngày trực quan hóa mức độ chăm chỉ quanh năm với 5 cấp độ màu (Level 0 $\rightarrow$ Level 4), tương tác tooltip hover chi tiết và bộ chọn năm (2026, 2025,...).
- **Biểu đồ tiến độ học tập theo mốc thời gian:** Thể hiện trực quan thời lượng học tập theo từng ngày với các bộ lọc: **Tuần này (This Week)**, **Tháng này (This Month)**, **Tất cả (All Time)**.
- **Lối tắt hành động học tập:** 
  - Với **tân học viên (Luồng 3a)**: Hiển thị giao diện chào mừng, chuỗi học 1 ngày đầu tiên và gợi ý làm **Bài thi đánh giá năng lực đầu vào (Placement Test)**.
  - Với **học viên đang học (Luồng chính)**: Đề xuất nhanh hành động tiếp theo (Làm bài thi thử hoặc Ôn tập từ vựng đến hạn).

### 1.2. Bối cảnh kiến trúc
- Màn hình thuộc phân hệ Student Hub, truy cập qua URL `/student/dashboard` hoặc click menu "Bảng điều khiển" trên thanh điều hướng (`UserLayout`).
- Định danh người dùng được trích xuất an toàn từ JWT Access Token trong `SecurityContextHolder` (`userId`), không truyền `userId` qua query param hay request body.
- Đáp ứng chuẩn Base Architecture: Controller trả về `ResponseEntity<ApiResponse<T>>`, lỗi nghiệp vụ ném qua `AppException(ErrorCode.XYZ)`.

---

## 2. Actor & Điều kiện tiên quyết

- **Actor:** Người dùng có tài khoản Học viên (`STUDENT` hoặc bất kỳ người dùng đã xác thực thành công trong hệ thống).
- **Tiền điều kiện:**
  - Người dùng đã đăng nhập và sở hữu Access Token (JWT) hợp lệ.
  - Cơ sở dữ liệu đã có sẵn các bảng nghiệp vụ: `users`, `user_study_stats`, `daily_study_logs`, `test_attempts`, `user_flashcards`.
- **Hậu điều kiện:**
  - Học viên xem được toàn diện số liệu học tập cá nhân, nhận biết được hôm nay mình đã hoàn thành mục tiêu học tập chưa để duy trì ngọn lửa Streak.
  - Học viên quan sát được "Bản đồ nhiệt đóng góp học tập" (Activity Heatmap) quanh năm để duy trì động lực như GitHub commit graph.
  - Học viên có thể click vào các nút lối tắt để điều hướng tức thì tới màn hình Thi thử (`/student/library`) hoặc Ôn tập từ vựng (`/student/flashcards`).

---

## 3. Luồng sự kiện chính (Happy Path - Học viên đã có dữ liệu học tập)

Dựa trên **Biểu đồ tuần tự (Hình 2.43)**, **Biểu đồ hoạt động** và **Activity Heatmap**:

1. **Kích hoạt chức năng:**
   - Học viên click vào menu **"Bảng điều khiển"** trên thanh điều hướng hoặc truy cập đường dẫn `/student/dashboard`.
2. **Gửi yêu cầu tổng hợp dữ liệu:**
   - Frontend gửi HTTP request:
     ```http
     GET /api/v1/student/dashboard?timeRange=THIS_WEEK&year=2026
     Authorization: Bearer <jwt_token>
     ```
3. **Backend xử lý và tổng hợp dữ liệu:**
   - `JwtAuthenticationFilter` giải mã token, xác thực danh tính và trích xuất `userId`.
   - `StudentDashboardService` truy vấn dữ liệu học tập cá nhân từ CSDL:
     - `UserStudyStatRepository`: Lấy `current_streak`, `highest_streak`, `total_learning_minutes`, `total_xp`, `last_study_date`. Kiểm tra `isStudiedToday = (last_study_date == LocalDate.now())`.
     - `TestAttemptRepository`: Đếm tổng số bài thi đã hoàn thành (`COUNT`), tính điểm trung bình (`AVG(score)`), lấy thông tin bài thi gần nhất.
     - `UserFlashcardRepository`: Đếm tổng số từ đã lưu, số từ đã thuộc (`status = 'MASTERED'`), số thẻ đến hạn ôn tập hôm nay (`next_review_date <= NOW()`), tính tỷ lệ thuộc từ (`masteryRate = masteredWords * 100 / totalWords`).
     - `DailyStudyLogRepository`: 
       * Truy vấn nhật ký học tập trong kỳ `timeRange` (để vẽ biểu đồ phân bố thời lượng học).
       * Truy vấn toàn bộ nhật ký học tập trong năm được chỉ định (`year = 2026`) để tính toán ma trận **Activity Heatmap**.
   - Kiểm tra điều kiện tài khoản: Nhận thấy tài khoản đã có dữ liệu học tập (`isNewUser = false`).
   - Đóng gói DTO `StudentDashboardResponse` và trả về `200 OK`.
4. **Hiển thị giao diện Dashboard:**
   - Frontend nhận dữ liệu và render các khối thông tin:
     - **Thẻ Streak & EXP:** Hiển thị ngọn lửa Streak 🔥 kèm số ngày liên tiếp, tổng thời lượng học và tổng XP tích lũy. Cảnh báo nếu hôm nay chưa học để tránh đứt chuỗi.
     - **Thẻ Năng lực Thi thử:** Điểm trung bình, tổng số bài thi đã làm, kết quả bài thi mới nhất.
     - **Thẻ Vốn từ vựng:** Tổng từ đã lưu, số từ đã thuộc, tỷ lệ % ghi nhớ, số thẻ cần ôn hôm nay.
     - **Biểu đồ nhiệt hoạt động học tập (Study Activity Heatmap):** 
       * Lưới ô vuông 52 tuần (Mon, Wed, Fri).
       * Màu sắc 5 cấp độ thể hiện thời lượng học tập.
       * Hover hiển thị Tooltip: Ngày, số phút học, số từ ôn tập, XP nhận được.
       * Cột chuyển năm bên phải (2026, 2025).
     - **Biểu đồ tiến độ học tập (Bar Chart):** Biểu đồ cột thể hiện số phút học theo từng ngày trong tuần/tháng.
     - **Lối tắt bài học đề xuất:** 
       * Thẻ ôn từ vựng (nếu có từ đến hạn) kèm nút *"Vào ôn tập ngay"*.
       * Thẻ thi thử kèm nút *"Làm bài thi mới"*.
5. **Tùy chọn lọc mốc thời gian (Tuần này / Tháng này / Tất cả):**
   - Học viên bấm chuyển Tab mốc thời gian (ví dụ chọn `"Tháng này"`).
   - Frontend gửi lại request: `GET /api/v1/student/dashboard?timeRange=THIS_MONTH&year=2026`.
   - Backend truy vấn và trả về dữ liệu cập nhật.
   - Frontend cập nhật mượt mà số liệu và biểu đồ tiến độ mà không làm giật trang.
6. **Điều hướng học tập:**
   - Học viên bấm vào nút *"Làm bài thi thử"* $\rightarrow$ Hệ thống điều hướng sang `/student/library`.
   - Học viên bấm vào nút *"Ôn tập từ vựng"* $\rightarrow$ Hệ thống điều hướng sang `/student/flashcards`.

---

## 4. Luồng sự kiện thay thế & Ngoại lệ

### 4.1. Luồng 3a: Tân học viên chưa có lịch sử học tập (New User / Cold Start)
1. Tại Bước 3 của luồng chính, Backend kiểm tra:
   - Học viên chưa hoàn thành bài thi nào (`totalExamsTaken == 0`) VÀ chưa lưu thẻ từ vựng nào (`totalWords == 0`).
2. Backend xác định `isNewUser = true` và trả về dữ liệu mặc định:
   - `currentStreak = 1` (khởi tạo chuỗi ngày 1 chào mừng).
   - `highestStreak = 1`, `totalXp = 0`, `totalLearningMinutes = 0`.
   - `vocabStats` = 0 từ.
   - `examStats` = 0 bài.
   - `activityHeatmap`: Chỉ có duy nhất 1 ô màu sáng cho ngày hôm nay (Day 1).
   - Danh sách hành động đề xuất: Gợi ý duy nhất bài thi đánh giá đầu vào.
3. Giao diện Frontend hiển thị:
   - **Banner Chào mừng Tân học viên:** Thông điệp chào đón và khích lệ bắt đầu hành trình.
   - **Huy hiệu Chuỗi ngày học:** Ngày đầu tiên (Streak Day 1 🌱).
   - **Thẻ hành động trọng tâm (Primary CTA):** *"Làm bài kiểm tra đánh giá năng lực đầu vào (Placement Test)"* $\rightarrow$ Click điều hướng đến bài thi đánh giá đầu vào.
   - Các biểu đồ thống kê hiển thị ở trạng thái khởi đầu sạch sẽ (Empty/Placeholder State thân thiện).

### 4.2. Chưa đăng nhập hoặc Token hết hạn
- **Hành vi:** Frontend gửi request không có Bearer Token hoặc Token đã hết hạn.
- **Backend:** Trả về mã lỗi HTTP `401 Unauthorized` (`ErrorCode.UNAUTHENTICATED_ACCESS`).
- **Frontend:** Axios Interceptor tự động kích hoạt refresh token hoặc điều hướng người dùng về trang `/login`.

### 4.3. Hôm nay chưa học (Streak at Risk)
- Nếu `last_study_date` là ngày hôm qua (`today - 1 day`): `currentStreak` vẫn được giữ nguyên nhưng `isStudiedToday = false`.
- Frontend hiển thị cảnh báo viền vàng/cam tại thẻ Streak: *"Hôm nay bạn chưa học! Hãy hoàn thành 1 bài ôn tập hoặc thi thử để giữ chuỗi ngọn lửa 🔥"*.

---

## 5. Thiết kế API Contract

### Endpoint: `GET /api/v1/student/dashboard`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <access_token>`
- **Query Parameters:**
  - `timeRange`: String (Tùy chọn, giá trị: `THIS_WEEK`, `THIS_MONTH`, `ALL`. Mặc định: `THIS_WEEK`).
  - `year`: Integer (Tùy chọn, năm cần lấy dữ liệu Heatmap, mặc định: năm hiện tại, ví dụ: `2026`).

### 5.1. Response Format - Học viên đã có dữ liệu (200 OK)
```json
{
  "code": 200,
  "message": "Lấy dữ liệu bảng điều khiển thành công",
  "data": {
    "isNewUser": false,
    "userProfile": {
      "fullName": "Nguyễn Hữu Giáp",
      "avatarUrl": "https://multilingo.com/avatars/user_1.png",
      "targetLanguage": "ENGLISH"
    },
    "streak": {
      "currentStreak": 5,
      "highestStreak": 12,
      "totalLearningMinutes": 245,
      "totalXp": 620,
      "isStudiedToday": true,
      "lastStudyDate": "2026-10-15"
    },
    "examStats": {
      "totalExamsTaken": 8,
      "averageScore": 7.8,
      "latestExamTitle": "IELTS Mock Test Reading & Listening Cam 18",
      "latestExamScore": 8.0,
      "latestExamDate": "2026-10-14T19:30:00Z"
    },
    "vocabStats": {
      "totalWords": 150,
      "masteredWords": 95,
      "learningWords": 55,
      "masteryRate": 63.3,
      "dueTodayCount": 18
    },
    "activityHeatmap": {
      "year": 2026,
      "totalActiveDays": 68,
      "longestStreak": 12,
      "dataPoints": [
        {
          "date": "2026-10-14",
          "learningMinutes": 45,
          "flashcardsReviewed": 20,
          "practiceQuestions": 25,
          "xpEarned": 40,
          "level": 3
        },
        {
          "date": "2026-10-15",
          "learningMinutes": 50,
          "flashcardsReviewed": 15,
          "practiceQuestions": 30,
          "xpEarned": 45,
          "level": 3
        }
      ]
    },
    "progressChart": {
      "timeRange": "THIS_WEEK",
      "dataPoints": [
        { "date": "2026-10-09", "label": "T6", "learningMinutes": 35, "questionsAnswered": 25 },
        { "date": "2026-10-10", "label": "T7", "learningMinutes": 45, "questionsAnswered": 40 },
        { "date": "2026-10-11", "label": "CN", "learningMinutes": 0, "questionsAnswered": 0 },
        { "date": "2026-10-12", "label": "T2", "learningMinutes": 50, "questionsAnswered": 30 },
        { "date": "2026-10-13", "label": "T3", "learningMinutes": 30, "questionsAnswered": 20 },
        { "date": "2026-10-14", "label": "T4", "learningMinutes": 40, "questionsAnswered": 35 },
        { "date": "2026-10-15", "label": "T5", "learningMinutes": 45, "questionsAnswered": 28 }
      ]
    },
    "suggestedActions": [
      {
        "type": "VOCAB_REVIEW",
        "title": "Ôn tập 18 từ vựng đến hạn",
        "description": "Củng cố trí nhớ dài hạn theo chu kỳ lặp lại ngắt quãng.",
        "badge": "Cần làm hôm nay",
        "actionUrl": "/student/flashcards",
        "buttonText": "Ôn tập ngay"
      },
      {
        "type": "EXAM_PRACTICE",
        "title": "Luyện đề thi thử tiếp theo",
        "description": "Cải thiện kỹ năng làm bài và duy trì phản xạ đề thi.",
        "badge": "Luyện tập",
        "actionUrl": "/student/library",
        "buttonText": "Vào thư viện đề"
      }
    ]
  }
}
```

### 5.2. Response Format - Tân học viên (Luồng 3a) (200 OK)
```json
{
  "code": 200,
  "message": "Lấy dữ liệu bảng điều khiển thành công",
  "data": {
    "isNewUser": true,
    "userProfile": {
      "fullName": "Trần Thị Mai",
      "avatarUrl": null,
      "targetLanguage": "ENGLISH"
    },
    "streak": {
      "currentStreak": 1,
      "highestStreak": 1,
      "totalLearningMinutes": 0,
      "totalXp": 0,
      "isStudiedToday": true,
      "lastStudyDate": "2026-10-15"
    },
    "examStats": {
      "totalExamsTaken": 0,
      "averageScore": 0.0,
      "latestExamTitle": null,
      "latestExamScore": null,
      "latestExamDate": null
    },
    "vocabStats": {
      "totalWords": 0,
      "masteredWords": 0,
      "learningWords": 0,
      "masteryRate": 0.0,
      "dueTodayCount": 0
    },
    "activityHeatmap": {
      "year": 2026,
      "totalActiveDays": 1,
      "longestStreak": 1,
      "dataPoints": [
        {
          "date": "2026-10-15",
          "learningMinutes": 0,
          "flashcardsReviewed": 0,
          "practiceQuestions": 0,
          "xpEarned": 0,
          "level": 1
        }
      ]
    },
    "progressChart": {
      "timeRange": "THIS_WEEK",
      "dataPoints": []
    },
    "suggestedActions": [
      {
        "type": "PLACEMENT_TEST",
        "title": "Kiểm tra đánh giá năng lực đầu vào",
        "description": "Làm bài test 20 phút để xác định trình độ và lộ trình học phù hợp nhất cho bạn.",
        "badge": "Khởi đầu",
        "actionUrl": "/student/library",
        "buttonText": "Bắt đầu làm bài"
      }
    ]
  }
}
```

---

## 6. Thiết kế Cơ sở Dữ liệu & Quy tắc Tính Cấp độ Heatmap

### 6.1. Bảng CSDL liên quan
1. `users`: Lấy thông tin họ tên, avatar, ngôn ngữ mục tiêu (`native_language`, `target_language`).
2. `user_study_stats`: Lưu trữ Streak, EXP và tổng phút học cá nhân (`current_streak`, `highest_streak`, `total_learning_minutes`, `total_xp`, `last_study_date`).
3. `daily_study_logs`: Lưu trữ nhật ký học tập từng ngày (`study_date`, `learning_minutes`, `flashcards_reviewed`, `practice_questions_answered`, `practice_xp_earned`).
4. `test_attempts`: Lịch sử làm bài thi thử (`user_id`, `score`, `status`, `created_at`).
5. `user_flashcards`: Vốn từ vựng cá nhân (`user_id`, `status`, `next_review_date`).

### 6.2. Quy tắc phân định Cấp độ màu Heatmap (Heatmap Activity Levels)
Dựa trên thời lượng học thực tế trong bảng `daily_study_logs.learning_minutes`:
- **Level 0:** `learning_minutes == 0` hoặc không có bản ghi (Chưa học / Nghỉ).
- **Level 1:** `1 <= learning_minutes <= 15` (Khởi động).
- **Level 2:** `16 <= learning_minutes <= 30` (Tiêu chuẩn).
- **Level 3:** `31 <= learning_minutes <= 60` (Chăm chỉ).
- **Level 4:** `learning_minutes > 60` (Bứt phá 🔥).

### 6.3. Truy vấn Tối ưu
```sql
-- Lấy dữ liệu Heatmap trong 1 năm
SELECT 
    d.study_date,
    d.learning_minutes,
    d.flashcards_reviewed,
    d.practice_questions_answered,
    d.practice_xp_earned
FROM daily_study_logs d
WHERE d.user_id = :userId 
  AND EXTRACT(YEAR FROM d.study_date) = :year
ORDER BY d.study_date ASC;
```

---

## 7. Thiết kế Giao diện Frontend (Feature-Sliced Design)

### 7.1. Cấu trúc thư mục Feature
Toàn bộ mã nguồn giao diện Dashboard học viên được đặt tại:
```text
frontend/src/features/student/dashboard/
├── api/
│   └── studentDashboardApi.ts         # Axios client gọi GET /api/v1/student/dashboard
├── components/
│   ├── GreetingHeader.tsx             # Chào theo buổi + Ngọn lửa Streak 🔥 + Cấp độ XP
│   ├── NewUserWelcomeCard.tsx         # Banner chào mừng tân học viên & CTA thi đầu vào
│   ├── MetricStatCard.tsx             # Card số liệu nhanh (Streak, Thi thử, Từ vựng)
│   ├── StudyActivityHeatmap.tsx       # Biểu đồ nhiệt hoạt động học tập dạng GitHub (52 tuần)
│   ├── ProgressChart.tsx              # Biểu đồ thời lượng học theo ngày (dạng Bar trực quan)
│   ├── DashboardTimeFilter.tsx        # Tabs lọc: Tuần này | Tháng này | Tất cả
│   └── SuggestedActionCard.tsx        # Thẻ hành động nhanh (Ôn từ vựng / Thi thử)
├── types/
│   └── dashboard.types.ts             # TypeScript interfaces cho Response DTO & Heatmap
└── pages/
    └── StudentDashboardPage.tsx       # Trang tổng thể kết nối các components
```

### 7.2. Wireframe Bố cục Màn hình (Bao gồm GitHub Heatmap)

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Header: Xin chào, Nguyễn Hữu Giáp 👋   |   🔥 5 Ngày Streak   |   ⭐ 620 XP   │
├───────────────────────────────────────────────────────────────────────────────┤
│ [Nếu là Tân học viên]                                                        │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ 🎉 CHÀO MỪNG BẠN ĐẾN VỚI MULTILINGO!                                      │ │
│ │ Hãy bắt đầu với bài thi đánh giá năng lực để cá nhân hóa lộ trình.        │ │
│ │ [ Bắt đầu làm bài test đầu vào ]                                          │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────┬─────────────────────────┬───────────────────────┐ │
│ │ ⏱️ Thời lượng học       │ 📝 Thi thử              │ 📚 Vốn từ vựng        │ │
│ │ 245 Phút tổng cộng      │ 8 Đề • Điểm TB: 7.8     │ 150 Từ (Thuộc 63%)    │ │
│ └─────────────────────────┴─────────────────────────┴───────────────────────┘ │
│                                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ 🟩 BẢN ĐỒ NHIỆT HOẠT ĐỘNG HỌC TẬP (ACTIVITY HEATMAP)                      │ │
│ │                                                                           │ │
│ │      Oct   Nov   Dec   Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep  │ │
│ │ Mon  ░░    ██    ░░    ██    ░░    ██    ██    ░░    ░░    ██    ░░    ██   │ │ [2026]
│ │ Wed  ██    ██    ░░    ░░    ░░    ██    ██    ░░    ██    ░░    ██    ██   │ │  2025
│ │ Fri  ░░    ██    ██    ░░    ██    ░░    ██    ██    ░░    ░░    ██    ██   │ │
│ │                                                                           │ │
│ │ 68 ngày học tập trong năm 2026                 Less ░ ▒ ▓ █ █ More        │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ 📈 TIẾN ĐỘ HỌC TẬP TRONG KỲ               [Tuần này] [Tháng này] [Tất cả] │ │
│ │                                                                           │ │
│ │ 60m ┼                                                                     │ │
│ │ 40m ┼         █                  █         █                              │ │
│ │ 20m ┼    █    █             █    █         █                              │ │
│ │  0m ┴────█────█─────────────█────█─────────█───────                       │ │
│ │         T6   T7   CN   T2   T3   T4   T5(Hôm nay)                         │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│ ┌─────────────────────────────────────┬─────────────────────────────────────┐ │
│ │ 🎯 Ôn tập 18 từ vựng đến hạn        │ 🚀 Luyện đề thi thử tiếp theo       │ │
│ │ Tránh quên từ theo chu kỳ SRS.      │ Cải thiện tốc độ làm bài thi.       │ │
│ │ [ Ôn tập ngay ]                     │ [ Vào thư viện đề ]                 │ │
│ └─────────────────────────────────────┴─────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Danh mục Mã lỗi (Error Codes)

| Mã lỗi HTTP | Mã nội bộ (`ErrorCode`) | Tình huống phát sinh | Cách xử lý |
| :--- | :--- | :--- | :--- |
| `401 Unauthorized` | `UNAUTHENTICATED_ACCESS` | Chưa truyền Bearer token hoặc token hết hạn | Điều hướng về `/login` |
| `400 Bad Request` | `INVALID_TIME_RANGE` | Giá trị `timeRange` không thuộc `THIS_WEEK`, `THIS_MONTH`, `ALL` | Mặc định sử dụng `THIS_WEEK` |
| `500 Internal Error`| `INTERNAL_SERVER_ERROR` | Lỗi kết nối CSDL hoặc lỗi tính toán | Trả thông báo lỗi chung, ghi log |
