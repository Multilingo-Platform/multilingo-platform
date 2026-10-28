# Đặc tả Kỹ thuật: Nâng Cấp Toàn Diện Trang Lịch Sử Làm Bài (Test History)

> **Mã tính năng:** `FEAT_STUDENT_TEST_HISTORY`  
> **Ngày tạo:** 2026-10-25  
> **Tác giả:** Multilingo Development Team  
> **Trạng thái:** Chờ phê duyệt  

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Bối cảnh hiện tại
- Trang **Lịch sử làm bài** (`/student/history`) tại `frontend/src/features/history/pages/student/TestHistory.tsx` hiện đang dùng dữ liệu giả định (`mockHistory`) và các chỉ số thống kê cứng (`mock statistics`), chưa kết nối với cơ sở dữ liệu thật.
- Backend đã có bảng `test_attempts` lưu trữ đầy đủ mọi lượt thi, điểm số (`overallScore`), thời gian làm bài (`timeSpentSeconds`), chế độ (`MOCK_TEST`, `PRACTICE`), phạm vi (`FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART`) và trạng thái (`COMPLETED`, `IN_PROGRESS`), nhưng chưa có API riêng biệt cung cấp danh sách lịch sử phân trang và thống kê tổng hợp cho học viên.

### 1.2. Mục tiêu nâng cấp
1. **Kết nối dữ liệu thực tế (Real Backend Data):** Thay thế 100% mock data bằng API thực tế, bảo mật theo tài khoản học viên đang đăng nhập.
2. **Dashboard Thống kê & Biểu đồ tiến độ (KPIs & Score Trend Chart):**
   - KPI Cards: Tổng bài đã làm, Điểm trung bình, Tổng thời gian luyện tập, Chuỗi ngày học liên tục (streak).
   - Biểu đồ trực quan hóa tiến độ điểm số (Score Trend Chart) qua các lần làm bài gần nhất.
3. **Hệ thống Lọc & Tìm kiếm đa năng:**
   - Tabs chứng chỉ: `[Tất Cả]`, `[IELTS]`, `[TOEIC]`, `[NLTV]`.
   - Chips chế độ thi: `[Tất cả]`, `[Thi thử (Mock Test)]`, `[Luyện tập (Practice)]`.
   - Chips trạng thái: `[Tất cả]`, `[Hoàn thành]`, `[Đang làm dở]`.
   - Tìm kiếm theo tên đề thi và sắp xếp theo ngày làm bài / điểm số.
4. **Hành động nhanh trên từng thẻ lượt thi:**
   - Xem chi tiết kết quả & phân tích bài làm (`/attempts/:id/result`).
   - Tiếp tục làm bài nếu lượt thi đang dở dang (`/attempts/:id/workspace`).
   - Làm lại đề thi này (`/student/exam/:examId`).
5. **Giao diện đồng bộ hệ sinh thái Multilingo:** Bảng màu cam/hổ phách ấm áp, không khoảng hở Navbar, responsive hoàn hảo trên Mobile và Desktop.

---

## 2. Kiến trúc Backend

### 2.1. Thiết kế API Endpoints

#### API 1: Lấy thống kê tổng hợp & xu hướng điểm số của học viên
- **Method:** `GET`
- **Path:** `/api/v1/student/history/stats`
- **Quyền hạn:** `USER`, `ADMIN` (Xác thực qua JWT Token)
- **Response Format:**
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "totalAttempts": 15,
    "completedAttempts": 12,
    "inProgressAttempts": 3,
    "averageScore": 7.2,
    "highestScore": 8.5,
    "totalPracticeMinutes": 480,
    "currentStreak": 5,
    "targetAchievedCount": 8,
    "recentScoreTrends": [
      {
        "attemptId": 101,
        "examTitle": "IELTS Academic Test 1",
        "certType": "IELTS",
        "score": 6.5,
        "maxScore": 9.0,
        "percentage": 72.2,
        "completedAt": "2026-10-20T10:00:00Z"
      },
      {
        "attemptId": 108,
        "examTitle": "IELTS Academic Test 2",
        "certType": "IELTS",
        "score": 7.5,
        "maxScore": 9.0,
        "percentage": 83.3,
        "completedAt": "2026-10-23T14:30:00Z"
      }
    ]
  }
}
```

#### API 2: Lấy danh sách lịch sử làm bài (Phân trang, Lọc & Tìm kiếm)
- **Method:** `GET`
- **Path:** `/api/v1/student/history`
- **Quyền hạn:** `USER`, `ADMIN` (Xác thực qua JWT Token)
- **Query Parameters:**
  - `page`: Số trang (0-indexed, mặc định: 0)
  - `size`: Số phần tử/trang (mặc định: 10)
  - `search`: Từ khóa tìm theo tên đề thi (tùy chọn)
  - `cert`: Lọc theo chứng chỉ (`IELTS`, `TOEIC`, `NLTV` - tùy chọn)
  - `mode`: Lọc theo chế độ (`MOCK_TEST`, `PRACTICE` - tùy chọn)
  - `status`: Lọc theo trạng thái (`COMPLETED`, `IN_PROGRESS`, `ABANDONED` - tùy chọn)
  - `sort`: `newest` (mặc định), `highestScore`, `duration`
- **Response Format:**
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "items": [
      {
        "attemptId": 108,
        "examId": 12,
        "examCode": "IELTS-CAM-18-01",
        "examTitle": "Cambridge IELTS 18 - Academic Test 1",
        "examType": "IELTS_ACADEMIC",
        "examLanguage": "en",
        "testMode": "MOCK_TEST",
        "testScope": "FULL_EXAM",
        "status": "COMPLETED",
        "startTime": "2026-10-23T13:00:00Z",
        "endTime": "2026-10-23T14:30:00Z",
        "timeSpentSeconds": 5400,
        "durationMinutes": 90,
        "overallScore": 7.5,
        "maxScore": 9.0,
        "targetScore": 7.0,
        "targetAchieved": true,
        "passed": true,
        "accuracyPercentage": 82.5
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 25,
    "totalPages": 3,
    "last": false
  }
}
```

### 2.2. Xử lý tầng Service & Repository
- **Repository:** Cập nhật `TestAttemptRepository`:
  - Thêm truy vấn phân trang với `JOIN Exam e ON a.examId = e.id`:
    `Page<TestAttempt> findUserAttempts(@Param("userId") Integer userId, @Param("search") String search, @Param("certPrefix") String certPrefix, @Param("mode") TestMode mode, @Param("status") AttemptStatus status, Pageable pageable);`
  - Thêm truy vấn tính tổng thời gian làm bài:
    `@Query("SELECT COALESCE(SUM(a.timeSpentSeconds), 0) FROM TestAttempt a WHERE a.userId = :userId") Long sumTimeSpentSecondsByUserId(@Param("userId") Integer userId);`
  - Thêm truy vấn đếm số lượt đạt mục tiêu:
    `@Query("SELECT COUNT(a) FROM TestAttempt a WHERE a.userId = :userId AND a.targetAchieved = true") Long countTargetAchievedByUserId(@Param("userId") Integer userId);`
  - Lấy top bài thi gần nhất có điểm để vẽ trend chart:
    `List<TestAttempt> findTop10ByUserIdAndStatusOrderByEndTimeDesc(Integer userId, AttemptStatus status);`
- **Service:** `StudentHistoryService` & `StudentHistoryServiceImpl` chịu trách nhiệm tổng hợp chỉ số (kết hợp với `UserStudyStatRepository` để lấy chuỗi ngày `currentStreak`) và ánh xạ sang DTO response.

---

## 3. Kiến trúc Frontend

### 3.1. Cấu trúc Thư mục & Modules
```
frontend/src/features/history/
├── api/
│   └── historyApi.ts               # Axios client calls cho stats & history list
├── types/
│   └── history.types.ts            # Type definitions: AttemptHistoryItem, HistoryStats, FilterParams
├── components/
│   ├── HistoryKpiCards.tsx         # 4 thẻ thống kê trực quan (Tổng bài, Điểm TB, Thời gian, Streak)
│   ├── ScoreTrendChart.tsx         # Biểu đồ xu hướng điểm số trực quan (SVG chart nhẹ nhàng, responsive)
│   ├── HistoryFilterBar.tsx        # Tabs chứng chỉ, Chips chế độ, Chips trạng thái & Tìm kiếm
│   └── HistoryAttemptCard.tsx      # Thẻ bài thi với vòng điểm, badges và nút hành động nhanh
└── pages/student/
    ├── TestHistory.tsx             # Trang tổng hợp logic, state & pagination
    └── TestHistory.css             # Style chuẩn EdTech, tông cam Multilingo, responsive
```

### 3.2. Trải nghiệm người dùng (UX) & Thiết kế giao diện (UI)
1. **Header & Thống kê sinh động:**
   - 4 KPI Cards với icon nổi bật và background gradient:
     - 📘 *Tổng bài thi đã làm* (Số bài thi hoàn thành / Đang làm dở).
     - 🎯 *Điểm trung bình* (Kèm tag so sánh với mục tiêu đặt ra ở Onboarding).
     - ⏱️ *Tổng thời gian rèn luyện* (Quy đổi tự động sang Giờ / Phút).
     - 🔥 *Chuỗi ngày học liên tục* (Streak ngày học).
2. **Biểu đồ xu hướng điểm số (Score Trend Chart):**
   - Biểu đồ đường mềm mại (Smooth SVG Line & Area Chart) thể hiện sự tiến bộ qua các lần thi gần đây.
   - Tooltip hover hiển thị chi tiết tên đề thi, ngày thi và số điểm đạt được.
3. **Bộ lọc trực quan:**
   - Tabs chứng chỉ: `[Tất Cả]`, `[IELTS]`, `[TOEIC]`, `[NLTV]`.
   - Chips chế độ: `[Tất cả]`, `[Thi thử (Mock Test)]`, `[Luyện tập (Practice)]`.
   - Chips trạng thái: `[Tất cả]`, `[Hoàn thành]`, `[Đang làm dở]`.
4. **Thẻ lượt thi (Attempt Card):**
   - Vòng điểm số tròn màu theo band:
     - IELTS: Xanh dương / Xanh ngọc (Band 1.0 - 9.0).
     - TOEIC: Tím / Xanh lá (Điểm 10 - 990).
     - NLTV: Cam ấm (Bậc 1 - 6).
   - Badge trạng thái:
     - `Hoàn thành` (Xanh lá) ➔ Nút chính: `Xem chi tiết kết quả ➔`.
     - `Đang làm dở` (Cam) ➔ Nút chính: `Tiếp tục làm bài ➔`.
   - Nút phụ: `Làm lại đề này ↻` giúp học viên nhanh chóng bắt đầu một lần thử sức mới.
5. **Empty State:**
   - Khi chưa có dữ liệu hoặc tìm kiếm không thấy, hiển thị minh họa sinh động cùng nút `Khám phá Thư viện Đề thi`.

---

## 4. Kế hoạch xác minh & Tiêu chuẩn chất lượng
- **Backend:**
  - Viết unit tests cho `StudentHistoryServiceImplTest`: Bao quát tính toán thống kê, phân trang, lọc theo chứng chỉ, chế độ và trạng thái.
  - Viết integration test `StudentHistoryControllerIT`: Kiểm tra xác thực token, HTTP 200, phân quyền.
- **Frontend:**
  - Kiểm tra TypeScript (`npx tsc -b`) đạt 0 lỗi.
  - Kiểm tra Production Build (`npm run build`) thành công.
  - Không có khoảng hở trắng phía trên Navbar (đã cấu hình `UserLayout.tsx`).
