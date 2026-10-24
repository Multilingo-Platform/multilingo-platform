# Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử: Onboarding Upgrade (UC05)

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

- **Persona/Role:** Học viên (`STUDENT`), Người dùng mới vừa đăng ký / đăng nhập lần đầu vào Multilingo Platform.
- **In-Scope:**
  - Giao diện Onboarding Multi-step Wizard 4 bước: (1) Ngôn ngữ gốc & mục tiêu -> (2) Chứng chỉ & Band điểm kỳ vọng -> (3) Trình độ hiện tại & Thời lượng học cam kết -> (4) Tổng kết lộ trình cá nhân hóa & CTA chuyển trang.
  - API `GET /api/v1/student/onboarding/status`: Kiểm tra trạng thái đã hoàn thành onboarding của user.
  - API `POST /api/v1/student/onboarding`: Tiếp nhận payload khảo sát, cập nhật bảng `users` (`native_language`, `target_language`, `has_completed_onboarding = true`) và lưu bảng `user_targets`.
  - Migration Flyway bổ sung cột `daily_minutes`, `current_level` vào `user_targets` và `has_completed_onboarding` vào `users`.
  - Điều hướng thông minh: Khi hoàn tất, điều hướng về Thư viện đề thi (`/student/library`). Nếu đã hoàn thành trước đó thì tự động redirect về Dashboard khi truy cập `/onboarding`.
- **Out-of-Scope:**
  - Thi trực tiếp bài Placement test ngay trong Onboarding (bước này chỉ gợi ý làm bài sau khi hoàn tất).
  - Thanh toán gói Premium hay tạo bài thi tùy chỉnh.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin

#### AC-01: Hoàn tất Onboarding thành công (Happy Path)
```gherkin
Kịch bản: Học viên mới hoàn tất khảo sát Onboarding 4 bước
Given Học viên đã đăng nhập và chưa từng hoàn tất onboarding (has_completed_onboarding = false)
When Học viên chọn Ngôn ngữ mẹ đẻ "vi" và Ngôn ngữ mục tiêu "en" ở Bước 1
And Chọn chứng chỉ "IELTS_ACADEMIC" với điểm mục tiêu "7.5" ở Bước 2
And Chọn trình độ "INTERMEDIATE" và thời lượng học "30" phút/ngày ở Bước 3
And Xem trang tổng kết lộ trình và bấm "Bắt đầu hành trình học" ở Bước 4
Then Hệ thống gửi request POST /api/v1/student/onboarding với đầy đủ dữ liệu
And CSDL cập nhật bảng users: native_language="vi", target_language="en", has_completed_onboarding=true
And CSDL tạo bản ghi user_targets với target_certificate="IELTS_ACADEMIC", target_score=7.5, daily_minutes=30, current_level="INTERMEDIATE"
And Giao diện hiển thị thông báo chúc mừng thành công và điều hướng sang /student/library
```

#### AC-02: Kiểm tra trạng thái Onboarding (Status Check)
```gherkin
Kịch bản: Kiểm tra trạng thái Onboarding khi người dùng truy cập
Given Người dùng gửi request GET /api/v1/student/onboarding/status kèm JWT token hợp lệ
When Backend xử lý yêu cầu
Then Trả về mã HTTP 200 OK
And Body trả về JSON chứa hasCompletedOnboarding, nativeLanguage, targetLanguage và target info
```

#### AC-03: Chặn chọn trùng ngôn ngữ mẹ đẻ và ngôn ngữ muốn học
```gherkin
Kịch bản: Người dùng chọn ngôn ngữ mẹ đẻ trùng với ngôn ngữ mục tiêu
Given Người dùng đang ở Bước 1 của Onboarding
When Người dùng chọn Ngôn ngữ mẹ đẻ là "Tiếng Việt" và Ngôn ngữ mục tiêu cũng là "Tiếng Việt"
Then Nút "Tiếp tục" bị vô hiệu hóa hoặc hệ thống cảnh báo "Ngôn ngữ mẹ đẻ và ngôn ngữ muốn học không được trùng nhau"
And Không cho phép chuyển sang Bước 2
```

#### AC-04: Tự động điều hướng khi đã hoàn thành Onboarding
```gherkin
Kịch bản: Người dùng đã hoàn tất Onboarding truy cập lại trang /onboarding
Given Học viên đã hoàn thành onboarding trước đó (has_completed_onboarding = true)
When Học viên truy cập đường dẫn /onboarding
Then Hệ thống tự động chuyển hướng (redirect) về /student/dashboard
```

### 2.2. Checklist Quy Tắc Nghiệp Vụ (Business Rules Checklist)
- [x] **Xác thực:** Cả 2 endpoint `/status` và `/onboarding` đều yêu cầu xác thực JWT Bearer Token (trả về 401 nếu thiếu hoặc sai token).
- [x] **Ràng buộc trường:**
  - `nativeLanguage`: Bắt buộc, độ dài 2-10 ký tự (VD: `vi`, `en`).
  - `targetLanguage`: Bắt buộc, độ dài 2-10 ký tự, khác `nativeLanguage`.
  - `targetCertificate`: Bắt buộc, thuộc danh sách `IELTS_ACADEMIC`, `IELTS_GENERAL`, `TOEIC_LR`, `TOEIC_WRITING`, `NLTV`.
  - `targetScore`: Bắt buộc, kiểu số dương, hợp lệ với thang điểm của chứng chỉ.
  - `dailyMinutes`: Thuộc danh sách [15, 30, 45, 60].
  - `currentLevel`: Thuộc danh sách [`BEGINNER`, `ELEMENTARY`, `INTERMEDIATE`, `ADVANCED`].
- [x] **Idempotency:** Nếu người dùng gửi Onboarding lần 2 (cập nhật lại), hệ thống cập nhật bản ghi `user_targets` hiện có thay vì sinh trùng lặp rác.

---

## 3. Ma Trận Kịch Bản Kiểm Thử 6 Khía Cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Dữ liệu thử nghiệm | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **1. Happy Path** | Học viên đi qua đủ 4 bước và submit thành công | Native: vi, Target: en, Cert: TOEIC_LR, Score: 850, Time: 30m, Level: INTERMEDIATE | 200 OK, CSDL lưu đúng, redirect `/student/library` |
| **2. Negative** | Gọi API submit với JWT không hợp lệ hoặc thiếu Token | Token rỗng hoặc hết hạn | 401 Unauthorized |
| **2. Negative** | Submit thiếu trường bắt buộc (`targetCertificate` = null) | Request body thiếu `targetCertificate` | 400 Bad Request / Validation Failed |
| **2. Negative** | Ngôn ngữ mẹ đẻ trùng ngôn ngữ mục tiêu (`vi` == `vi`) | `nativeLanguage: "vi"`, `targetLanguage: "vi"` | 400 Bad Request, báo lỗi ngôn ngữ trùng |
| **3. Boundary** | Điểm mục tiêu IELTS cận biên nhỏ nhất (4.0) và lớn nhất (9.0) | `targetScore = 4.0` và `targetScore = 9.0` | 200 OK, hợp lệ |
| **3. Boundary** | Điểm mục tiêu IELTS ngoài biên (3.5 hoặc 9.5) | `targetScore = 9.5` | 400 Bad Request, điểm không hợp lệ |
| **4. Edge Cases** | Người dùng quay lại (Back) giữa các bước 3 -> 2 -> 1 rồi Next lại | Đổi lựa chọn ở bước 2 | Dữ liệu các bước vẫn duy trì, không bị reset trắng |
| **4. Edge Cases** | Double click / Spam click nút "Bắt đầu hành trình học" | Nhấp 5 lần liên tiếp | Nút chuyển sang trạng thái Loading/Disabled, chỉ 1 request được gửi |
| **5. Security** | Truyền script XSS vào các trường text | `currentLevel = "<script>alert(1)</script>"` | Bị chặn validation enum / mã hóa an toàn |
| **6. UI/UX** | Thanh tiến trình cập nhật trực quan theo từng bước | Step 1: 25%, Step 2: 50%, Step 3: 75%, Step 4: 100% | Thanh progress bar co giãn mượt mà |
| **6. UI/UX** | Responsive hoàn hảo trên mobile (375px), tablet (768px), desktop (1366px) | Resize kích thước viewport | Card co giãn cân đối, nút bấm to rõ dễ chạm |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_ONB_GET_STATUS_01** | Happy Path | Lấy trạng thái Onboarding của học viên mới | Đã login, chưa onboarding | 1. Gọi GET `/api/v1/student/onboarding/status` | Token học viên mới | 200 OK, `hasCompletedOnboarding: false` |
| **TC_ONB_GET_STATUS_02** | Happy Path | Lấy trạng thái Onboarding của học viên cũ đã xong | Đã login, đã hoàn thành | 1. Gọi GET `/api/v1/student/onboarding/status` | Token học viên cũ | 200 OK, `hasCompletedOnboarding: true`, trả về target info |
| **TC_ONB_SUBMIT_01** | Happy Path | Submit Onboarding hợp lệ (IELTS) | Đã login | 1. Gửi POST `/api/v1/student/onboarding` | `{nativeLanguage: 'vi', targetLanguage: 'en', targetCertificate: 'IELTS_ACADEMIC', targetScore: 7.0, dailyMinutes: 30, currentLevel: 'INTERMEDIATE'}` | 200 OK, `hasCompletedOnboarding: true`, DB cập nhật đúng |
| **TC_ONB_SUBMIT_02** | Happy Path | Submit Onboarding hợp lệ (TOEIC L&R) | Đã login | 1. Gửi POST `/api/v1/student/onboarding` | `{nativeLanguage: 'vi', targetLanguage: 'en', targetCertificate: 'TOEIC_LR', targetScore: 800, dailyMinutes: 45, currentLevel: 'ELEMENTARY'}` | 200 OK, CSDL lưu đúng `targetScore: 800` |
| **TC_ONB_SUBMIT_03** | Negative | Submit với token rỗng | Chưa login | 1. Gửi POST `/api/v1/student/onboarding` không có header Auth | Dữ liệu hợp lệ | 401 Unauthorized |
| **TC_ONB_SUBMIT_04** | Negative | Submit trùng ngôn ngữ mẹ đẻ và mục tiêu | Đã login | 1. Gửi POST `/api/v1/student/onboarding` | `{nativeLanguage: 'en', targetLanguage: 'en', ...}` | 400 Bad Request, mã lỗi tương ứng |
| **TC_ONB_SUBMIT_05** | Negative | Submit thiếu trường chứng chỉ mục tiêu | Đã login | 1. Gửi POST thiếu `targetCertificate` | `{nativeLanguage: 'vi', targetLanguage: 'en', ...}` | 400 Bad Request / Validation Failed |
| **TC_ONB_SUBMIT_06** | Boundary | Submit điểm kỳ vọng cận trên IELTS 9.0 | Đã login | 1. Gửi POST với `targetScore: 9.0` | `targetCertificate: 'IELTS_ACADEMIC', targetScore: 9.0` | 200 OK |
| **TC_ONB_SUBMIT_07** | Boundary | Submit điểm kỳ vọng ngoài cận IELTS 9.5 | Đã login | 1. Gửi POST với `targetScore: 9.5` | `targetCertificate: 'IELTS_ACADEMIC', targetScore: 9.5` | 400 Bad Request |
| **TC_ONB_UI_STEP_01** | UI/UX | Chuyển đổi qua lại giữa các bước Wizard mượt mà | Đang ở `/onboarding` | 1. Chọn Step 1 -> Bấm Tiếp tục<br>2. Chọn Step 2 -> Bấm Quay lại | Click chuột / chạm màn hình | Step 1 hiển thị lại lựa chọn cũ, progress bar nhảy tương ứng |
| **TC_ONB_UI_REDIRECT_01**| UI/UX | Tự động chuyển trang sau khi submit thành công | Đang ở Step 4 | 1. Bấm "Bắt đầu hành trình học" | Click submit | Hiển thị Toast thành công, điều hướng về `/student/library` |
