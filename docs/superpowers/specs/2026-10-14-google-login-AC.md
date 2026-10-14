# Tiêu Chí Nghiệm Thu & Test Design: Đăng Nhập & Đăng Ký Bằng Google OAuth2

Tài liệu chuẩn hóa tiêu chí nghiệm thu (Acceptance Criteria - AC) và ma trận kiểm thử toàn diện phục vụ triển khai tính năng **Đăng nhập & Đăng ký bằng Google (Google Identity Services)** theo phương pháp luận Superpowers.

---

## 📋 Bước 1: Phân tích Scope & Actors

### 1. Actors (Tác nhân)
- **Khách vãng lai (Guest):** Chưa có tài khoản trên Multilingo Platform, muốn đăng ký nhanh bằng tài khoản Google.
- **Học viên (Student):** Đã có tài khoản (qua email/mật khẩu hoặc Google trước đó), muốn đăng nhập vào hệ thống.
- **Quản trị viên (Admin):** Người dùng có vai trò ADMIN, tài khoản có thể liên kết với email Google để đăng nhập.

### 2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - Nút đăng nhập Google trên `LoginForm.tsx` và nút đăng ký Google trên `RegisterForm.tsx`.
  - Frontend gọi Google GIS để nhận ID Token (JWT) và gửi tới Backend.
  - API `POST /api/auth/google` tiếp nhận và xác thực tính hợp lệ của Google ID Token qua `GoogleIdTokenVerifier`.
  - Tự động tạo tài khoản mới nếu chưa tồn tại (Auto-provisioning với role `STUDENT`).
  - Tự động liên kết tài khoản nếu email từ Google đã tồn tại trong DB (Auto-linking).
  - Kiểm tra trạng thái hoạt động của tài khoản (`isActive == true`).
  - Cấp phát Multilingo JWT Tokens (Access Token + Refresh Token HttpOnly Cookie) và lưu phiên vào Redis.
- **Out-of-Scope:**
  - Đồng bộ quyền truy cập tài liệu Google Drive, Google Classroom hoặc Google Calendar.
  - Đăng nhập qua các nhà cung cấp bên thứ ba khác (Facebook, Apple).

---

## 📋 Bước 2: Tiêu chí nghiệm thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin

#### Kịch bản AC-01: Đăng ký / Đăng nhập tài khoản mới bằng Google thành công
```gherkin
Kịch bản: Người dùng mới đăng nhập bằng tài khoản Google chưa từng có trong hệ thống
Given Người dùng ở trang Đăng nhập hoặc Đăng ký của Multilingo
When Người dùng nhấn vào nút "Đăng nhập với Google"
And Người dùng chọn và xác thực thành công tài khoản Google hợp lệ với email "newstudent@gmail.com"
And Google trả về ID Token hợp lệ kèm claim email_verified = true
Then Backend xác thực thành công Google ID Token
And Hệ thống tự động tạo mới một bản ghi User trong CSDL với:
    - email: "newstudent@gmail.com"
    - fullName: tên từ Google profile
    - avatarUrl: link ảnh từ Google profile
    - googleId: subject ID từ Google
    - role: STUDENT
    - subscriptionTier: FREE
    - isActive: true
    - passwordHash: null
And Hệ thống phát hành Multilingo Access Token và Refresh Token hợp lệ
And Người dùng được điều hướng đến trang học tập với thông báo "Đăng nhập thành công"
```

#### Kịch bản AC-02: Đăng nhập tài khoản Google đã từng đăng nhập trước đó
```gherkin
Kịch bản: Học viên đã có tài khoản liên kết Google đăng nhập lại
Given Người dùng đã có bản ghi User trong CSDL với googleId "google-sub-12345" và isActive = true
When Người dùng đăng nhập qua Google với tài khoản tương ứng
Then Backend tìm thấy tài khoản qua googleId
And Hệ thống cập nhật trường lastLoginAt thành thời điểm hiện tại
And Hệ thống trả về Access Token và Refresh Token hợp lệ
And Người dùng đăng nhập thành công vào hệ thống
```

#### Kịch bản AC-03: Tự động liên kết tài khoản khi email đã tồn tại (Auto-linking)
```gherkin
Kịch bản: Người dùng đã đăng ký bằng email/mật khẩu trước đó, nay đăng nhập bằng Google cùng email
Given Người dùng đã có tài khoản trong CSDL với email "user@example.com", googleId = null
When Người dùng đăng nhập qua Google với tài khoản có email "user@example.com"
And Google xác thực email_verified = true
Then Backend tìm thấy tài khoản qua email
And Hệ thống cập nhật googleId = subject ID của Google vào bản ghi User
And Giữ nguyên mật khẩu cũ và vai trò của tài khoản
And Người dùng đăng nhập thành công vào hệ thống
```

#### Kịch bản AC-04: Chặn đăng nhập khi tài khoản bị khóa (Inactive Account)
```gherkin
Kịch bản: Người dùng đăng nhập qua Google nhưng tài khoản trên Multilingo đang bị khóa
Given Tài khoản có email hoặc googleId trong CSDL đang có isActive = false
When Người dùng thực hiện đăng nhập qua Google
Then Backend ném lỗi AppException(ErrorCode.ACCOUNT_INACTIVE) với mã HTTP 403 Forbidden
And Không phát hành bất kỳ Token nào
And Giao diện hiển thị thông báo lỗi "Tài khoản đã bị khóa liên hệ admin để được hỗ trợ"
```

#### Kịch bản AC-05: Chặn khi Google ID Token không hợp lệ hoặc hết hạn
```gherkin
Kịch bản: Request gửi ID Token giả mạo hoặc đã hết hạn
Given ID Token gửi trong request POST /api/auth/google bị sai chữ ký hoặc hết hạn hoặc sai audience
When Backend tiến hành verify token
Then Backend ném AppException(ErrorCode.INVALID_GOOGLE_TOKEN) với mã HTTP 401 Unauthorized
And Không cấp token đăng nhập
```

#### Kịch bản AC-06: Chặn khi Email Google chưa được xác minh
```gherkin
Kịch bản: Tài khoản Google trả về claim email_verified = false
When Backend verify Google ID Token và phát hiện email_verified != true
Then Backend ném AppException(ErrorCode.GOOGLE_EMAIL_NOT_VERIFIED) với mã HTTP 400 Bad Request
And Không cho phép tạo tài khoản hoặc liên kết tài khoản
```

---

### 2.2. Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- [ ] **Audience Constraint:** Chữ ký ID Token từ Google bắt buộc phải có `aud` (Audience) khớp chính xác với `app.google.client-id` được cấu hình trên server.
- [ ] **Mã lỗi chuẩn hóa:**
  - `INVALID_GOOGLE_TOKEN (920)`: 401 Unauthorized khi token sai định dạng, sai chữ ký, sai audience, hoặc quá hạn `exp`.
  - `GOOGLE_EMAIL_NOT_VERIFIED (921)`: 400 Bad Request khi `email_verified` là false.
  - `ACCOUNT_INACTIVE (918)`: 403 Forbidden khi tài khoản bị khóa (`isActive == false`).
- [ ] **Đảm bảo tính duy nhất:** Cột `google_id` trong bảng `users` là `UNIQUE`, không cho phép 2 tài khoản khác nhau liên kết cùng 1 `google_id`.
- [ ] **Bảo mật mật khẩu:** Tài khoản tạo mới bằng Google có `password_hash = null`, tuyệt đối không sinh mật khẩu giả hoặc lộ plain text.

---

## 📋 Bước 3: Ma trận kiểm thử 6 khía cạnh

| Khía cạnh | Kịch bản kiểm thử trọng tâm |
| :--- | :--- |
| **1. Happy Path** | - Đăng ký mới thành công tài khoản Google.<br>- Đăng nhập lại thành công tài khoản Google đã tồn tại.<br>- Tự động liên kết tài khoản Google với tài khoản email cũ thành công. |
| **2. Negative Cases** | - Gửi ID Token rỗng (`idToken: ""`) -> Báo lỗi validation `400 BAD_REQUEST`.<br>- Gửi ID Token giả mạo chữ ký -> Báo lỗi `INVALID_GOOGLE_TOKEN (920)`.<br>- Gửi ID Token của một Google App khác (Audience sai) -> Báo lỗi `INVALID_GOOGLE_TOKEN (920)`.<br>- Tài khoản Google chưa verify email -> Báo lỗi `GOOGLE_EMAIL_NOT_VERIFIED (921)`.<br>- Tài khoản bị khóa trong DB (`isActive = false`) -> Báo lỗi `ACCOUNT_INACTIVE (918)`. |
| **3. Boundary Value** | - ID Token vừa hết hạn cách 1 giây (`exp < now`) -> Bị từ chối xác thực.<br>- Email dài cận biên (255 ký tự) -> Lưu thành công vào DB mà không bị cắt chuỗi. |
| **4. Edge Cases** | - Spam click nút Google Login nhiều lần liên tục -> Frontend debouncing / disabled button khi đang mutate.<br>- Người dùng tắt popup Google giữa chừng -> Không gửi request về backend, không hiển thị lỗi crash app.<br>- Google profile không có avatar (`picture` null) -> Lưu tài khoản thành công với `avatarUrl = null`. |
| **5. Security & Data Integrity** | - Không lộ `idToken` trong query params (bắt buộc dùng POST body).<br>- `refresh_token` trả về qua HttpOnly cookie có cờ an toàn.<br>- Không thể chiếm đoạt tài khoản người khác nếu chưa xác minh quyền sở hữu email (`email_verified`). |
| **6. UI/UX & Accessibility** | - Trạng thái loading / spinner khi đang đợi backend xử lý token Google.<br>- Nút Google Login có đầy đủ icon, typography chuẩn Google Brand Guidelines.<br>- Phím tắt bàn phím và hỗ trợ chuyển đổi đa ngôn ngữ (Tiếng Việt / Tiếng Anh) qua i18n. |

---

## 📋 Bước 4: Bảng Test Cases Chuẩn Hóa (Standard 7-Column Test Cases)

Quy tắc đặt mã: `TC_AUTH_GOOGLE_[STT]`

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUTH_GOOGLE_01** | Happy Path | Đăng nhập tài khoản mới chưa có trong hệ thống | Email Google chưa có trong DB `users` | 1. Nhấn nút Đăng nhập Google<br>2. Chọn tài khoản Google<br>3. FE gửi ID Token tới API `/api/auth/google` | ID Token hợp lệ từ `newuser@gmail.com` | - Backend tạo mới User với role `STUDENT`, `isActive=true`<br>- Trả về AccessToken + RefreshToken Cookie<br>- Giao diện chuyển hướng vào `/student` |
| **TC_AUTH_GOOGLE_02** | Happy Path | Đăng nhập tài khoản đã có sẵn `google_id` | User đã tồn tại trong DB với `google_id = 'sub_999'` | 1. Đăng nhập qua tài khoản Google tương ứng<br>2. FE gửi ID Token tới Backend | ID Token hợp lệ có sub `'sub_999'` | - Backend tìm đúng User<br>- Cập nhật `lastLoginAt`<br>- Trả về Token hợp lệ, đăng nhập thành công |
| **TC_AUTH_GOOGLE_03** | Happy Path | Tự động liên kết tài khoản đã đăng ký bằng mật khẩu | User đã có tài khoản `user@test.com` với `google_id = null` | 1. Đăng nhập Google bằng email `user@test.com`<br>2. Backend tiếp nhận | ID Token có email `user@test.com`, `email_verified=true` | - Backend cập nhật `google_id` vào User cũ<br>- Giữ nguyên mật khẩu cũ và quyền hạn<br>- Đăng nhập thành công |
| **TC_AUTH_GOOGLE_04** | Negative | ID Token rỗng | Khách vãng lai | 1. Gửi request `POST /api/auth/google` với `idToken = ""` | `{"idToken": ""}` | - Trả về lỗi 400 Bad Request<br>- Thông báo lỗi validation |
| **TC_AUTH_GOOGLE_05** | Negative | ID Token giả mạo hoặc chữ ký không hợp lệ | Khách vãng lai | 1. Gửi request `POST /api/auth/google` với chuỗi token giả | `{"idToken": "fake.jwt.token"}` | - Trả về HTTP 401 với mã lỗi `920`<br>- Thông báo "Mã xác thực Google không hợp lệ..." |
| **TC_AUTH_GOOGLE_06** | Negative | ID Token hết hạn (Expired) | Khách vãng lai | 1. Gửi request `POST /api/auth/google` với ID Token đã hết hạn | Token hợp lệ nhưng đã quá `exp` | - Trả về HTTP 401 với mã lỗi `920` |
| **TC_AUTH_GOOGLE_07** | Negative | ID Token thuộc Client ID khác (Sai Audience) | Khách vãng lai | 1. Gửi request với token sinh ra từ một dự án Google khác | Token có `aud != app.google.client-id` | - Trả về HTTP 401 với mã lỗi `920` |
| **TC_AUTH_GOOGLE_08** | Negative | Email Google chưa xác thực (`email_verified = false`) | Khách vãng lai | 1. Đăng nhập Google trả về token có `email_verified = false` | ID Token có claim `email_verified: false` | - Trả về HTTP 400 với mã lỗi `921`<br>- Thông báo "Email Google của bạn chưa được xác thực" |
| **TC_AUTH_GOOGLE_09** | Negative | Tài khoản trong hệ thống bị vô hiệu hóa (`isActive = false`) | User trong DB có `isActive = false` | 1. Đăng nhập qua tài khoản Google tương ứng | ID Token hợp lệ của user bị khóa | - Trả về HTTP 403 với mã lỗi `918`<br>- Thông báo "Tài khoản đã bị khóa liên hệ admin..." |
| **TC_AUTH_GOOGLE_10** | Edge Case | User hủy / tắt popup đăng nhập Google | Ở form Đăng nhập | 1. Bấm nút Đăng nhập Google<br>2. Đóng cửa sổ popup mà không chọn tài khoản | N/A | - Giao diện không bị treo hoặc crash<br>- Nút bấm trở về trạng thái bình thường |
| **TC_AUTH_GOOGLE_11** | Edge Case | Tài khoản Google không có avatar (`picture` null) | Tài khoản Google mới không đặt ảnh đại diện | 1. Đăng nhập Google<br>2. Backend tạo tài khoản mới | ID Token không có field `picture` | - User được tạo thành công với `avatar_url = null`<br>- Giao diện hiển thị avatar mặc định |
| **TC_AUTH_GOOGLE_12** | UI/UX | Hiển thị nút Google đồng bộ cả form Login và Register | Khách vãng lai | 1. Truy cập `/login` và `/register` | N/A | - Nút Google hiển thị đúng style, logo màu chuẩn, responsive mượt mà trên mobile |
