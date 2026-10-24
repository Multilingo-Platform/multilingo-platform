# Tiêu Chí Nghiệm Thu (AC) & Thiết Kế Kiểm Thử: Quên Mật Khẩu (Brevo Email OTP)

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Tác nhân (Actors)
- **Học viên / Người dùng (`STUDENT`, `TEACHER`, `ADMIN`):** Người dùng đã có tài khoản bằng email trong hệ thống, bị quên mật khẩu và muốn đặt lại mật khẩu mới.
- **Khách vãng lai (`GUEST`):** Người dùng chưa đăng nhập, thao tác từ màn hình đăng nhập.

### 1.2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - Form nhập email yêu cầu gửi OTP và cơ chế rate limit cooldown 60s.
  - Gửi mã OTP 6 số qua email bằng Brevo Transactional Email REST API.
  - Form nhập OTP 6 số, Mật khẩu mới, Xác nhận mật khẩu mới.
  - Xác thực OTP trong Redis (TTL 5 phút, giới hạn 5 lần thử sai).
  - Cập nhật mật khẩu mã hóa BCrypt vào bảng `users`.
  - Hiển thị phản hồi UI thân thiện, đa ngôn ngữ (`vi`, `en`), tự động chuyển hướng về `/login`.
- **Out-of-Scope:**
  - Khôi phục qua SMS OTP / Zalo ZNS.
  - Đổi mật khẩu cho tài khoản Google không có email/mật khẩu truyền thống.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1. Kịch bản Gherkin

#### Kịch bản 1: Yêu cầu gửi OTP thành công (Happy Path)
```gherkin
Given người dùng đang ở trang "/forgot-password"
And email "student@example.com" đã tồn tại trong hệ thống
When người dùng nhập "student@example.com" vào ô email
And người dùng bấm nút "Gửi mã xác nhận"
Then hệ thống sinh mã OTP 6 số ngẫu nhiên và lưu vào Redis với TTL 5 phút
And hệ thống thiết lập Redis cooldown 60 giây cho email "student@example.com"
And hệ thống gửi email HTML chứa mã OTP đến "student@example.com" qua Brevo API
And giao diện hiển thị thông báo thành công "Mã OTP đã được gửi đến email của bạn"
And giao diện tự động chuyển sang Bước 2 (Nhập OTP & Mật khẩu mới)
And nút gửi lại OTP bắt đầu đếm lùi từ 60 giây
```

#### Kịch bản 2: Gửi OTP thất bại do email không tồn tại
```gherkin
Given người dùng đang ở trang "/forgot-password" (Bước 1)
And email "nonexistent@example.com" chưa từng được đăng ký trong hệ thống
When người dùng nhập "nonexistent@example.com" và bấm "Gửi mã xác nhận"
Then hệ thống trả về mã lỗi HTTP 404 (USER_NOT_FOUND)
And giao diện hiển thị thông báo lỗi "Tài khoản không tồn tại"
And giao diện giữ nguyên ở Bước 1, không chuyển sang Bước 2
```

#### Kịch bản 3: Chặn spam gửi lại mã OTP khi đang trong cooldown 60s
```gherkin
Given người dùng vừa gửi OTP thành công và đang ở Bước 2
And thời gian đếm lùi cooldown còn lớn hơn 0 giây (ví dụ: 45s)
When người dùng cố tình gửi request POST /api/auth/forgot-password cho cùng email
Then hệ thống chặn lại và trả về mã lỗi HTTP 429 (OTP_COOLDOWN_ACTIVE)
And giao diện vô hiệu hóa (disabled) nút bấm gửi lại với nhãn "Gửi lại mã sau (45s)"
```

#### Kịch bản 4: Đặt lại mật khẩu thành công với OTP hợp lệ (Happy Path)
```gherkin
Given người dùng đang ở Bước 2 với email "student@example.com"
And mã OTP "123456" trong Redis còn hạn hiệu lực
When người dùng nhập OTP "123456"
And người dùng nhập mật khẩu mới "NewPass@2026"
And người dùng nhập xác nhận mật khẩu "NewPass@2026"
And người dùng bấm "Lưu thay đổi"
Then hệ thống xác nhận OTP chính xác
And hệ thống mã hóa mật khẩu mới bằng BCrypt và lưu vào database
And hệ thống xóa OTP, cooldown, attempts của email khỏi Redis
And giao diện hiển thị toast thành công "Đặt lại mật khẩu thành công!"
And hệ thống tự động điều hướng người dùng về trang "/login"
```

#### Kịch bản 5: Nhập sai mã OTP chưa quá 5 lần
```gherkin
Given người dùng đang ở Bước 2 và mã OTP đúng là "123456"
When người dùng nhập OTP "654321" và bấm "Lưu thay đổi"
Then hệ thống tăng biến đếm số lần nhập sai trong Redis lên 1
And hệ thống trả về mã lỗi HTTP 400 (INVALID_OTP)
And giao diện hiển thị lỗi "Mã OTP không chính xác"
And người dùng vẫn ở Bước 2 để nhập lại
```

#### Kịch bản 6: Nhập sai mã OTP quá 5 lần (Brute-force protection)
```gherkin
Given người dùng đã nhập sai OTP 4 lần trước đó
When người dùng tiếp tục nhập sai OTP lần thứ 5 và bấm "Lưu thay đổi"
Then hệ thống xóa mã OTP khỏi Redis
And hệ thống trả về mã lỗi HTTP 400 (OTP_MAX_ATTEMPTS_EXCEEDED)
And giao diện thông báo "Bạn đã nhập sai OTP quá 5 lần. Mã đã bị hủy, vui lòng yêu cầu mã mới."
And giao diện chuyển người dùng về Bước 1 để thực hiện lại
```

#### Kịch bản 7: Mã OTP đã hết hạn (quá 5 phút)
```gherkin
Given mã OTP được sinh từ hơn 5 phút trước (key trong Redis đã expire)
When người dùng nhập OTP và bấm "Lưu thay đổi"
Then hệ thống trả về mã lỗi HTTP 400 (OTP_EXPIRED)
And giao diện hiển thị lỗi "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới"
```

#### Kịch bản 8: Mật khẩu mới và Xác nhận mật khẩu không trùng khớp
```gherkin
Given người dùng đang ở Bước 2
When người dùng nhập Mật khẩu mới "Pass@123" và Xác nhận mật khẩu "Pass@456"
Then giao diện hiển thị cảnh báo đỏ "Mật khẩu xác nhận không khớp!"
And nút "Lưu thay đổi" bị vô hiệu hóa hoặc bị chặn ở tầng Client
```

---

### 2.2. Checklist Quy Tắc Nghiệp Vụ (Business Rules Checklist)
- [x] **Định dạng Email:** Bắt buộc tuân thủ regex email hợp lệ (RFC 5322), không chứa ký tự khoảng trắng thừa.
- [x] **Độ dài Mật khẩu mới:** Tối thiểu 6 ký tự, không được để trống.
- [x] **Cơ chế OTP:** Gồm đúng 6 ký số ngẫu nhiên (`000000` - `999999`), TTL 300 giây.
- [x] **Cooldown:** 60 giây kể từ thời điểm gửi OTP thành công.
- [x] **Giới hạn số lần thử (Max Attempts):** Tối đa 5 lần. Sai quá 5 lần lập tức hủy OTP.
- [x] **Bảo mật mật khẩu:** Bắt buộc mã hóa BCrypt trước khi cập nhật `password_hash` vào bảng `users`.
- [x] **Bảo mật dữ liệu:** Tuyệt đối không trả mã OTP trong response body của API `/forgot-password`. Không in OTP thô lên log Production.

---

## 3. Ma Trận Kiểm Thử 6 Khía Cạnh (Comprehensive Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Mô tả chi tiết | Kết quả mong đợi |
| :--- | :--- | :--- | :--- |
| **1. Happy Path** | Gửi OTP thành công | Email tồn tại trong hệ thống | Nhận mã OTP trong mail, chuyển bước 2, cooldown 60s |
| | Đổi mật khẩu thành công | OTP đúng, mật khẩu >= 6 ký tự khớp nhau | Đổi mật khẩu thành công, chuyển hướng về `/login` |
| **2. Negative** | Email rỗng / sai format | Nhập email không có `@` hoặc để trống | Báo lỗi validation "Định dạng email không hợp lệ" |
| | Email không tồn tại | Nhập email chưa từng đăng ký | Trả lỗi HTTP 404 `USER_NOT_FOUND` |
| | OTP sai | Nhập OTP khác với Redis | Trả lỗi HTTP 400 `INVALID_OTP` |
| | OTP hết hạn | Nhập OTP sau 5 phút | Trả lỗi HTTP 400 `OTP_EXPIRED` |
| | Mật khẩu xác nhận lệch | Pass mới: `123456`, xác nhận: `123457` | Báo lỗi không khớp, chặn submit |
| **3. Boundary** | Mật khẩu 5 ký tự | Thử đặt mật khẩu mới 5 ký tự (`abc12`) | Báo lỗi "Mật khẩu phải từ 6 ký tự trở lên" |
| | Mật khẩu đúng 6 ký tự | Thử đặt mật khẩu mới đúng 6 ký tự (`123456`) | Đổi mật khẩu thành công |
| | OTP 5 ký tự / 7 ký tự | Nhập OTP thiếu hoặc thừa số | Input giới hạn đúng 6 số |
| **4. Edge Cases** | Whitespace email | Nhập `  student@example.com  ` | Tự động trim khoảng trắng trước khi gửi |
| | Cooldown 60s hết hạn | Đợi hết 60s bấm gửi lại | Gửi lại OTP thành công, reset đếm lùi về 60s |
| | Bấm nút Submit liên tục | Spam click nút "Gửi mã xác nhận" | Nút bị disabled khi `isPending = true`, tránh gọi đúp API |
| **5. Security** | Thử brute force OTP | Nhập sai OTP liên tiếp 5 lần | Hủy OTP trong Redis, ném `OTP_MAX_ATTEMPTS_EXCEEDED` |
| | Chống spam gửi mail | Gọi API `/forgot-password` trong 60s | Trả về HTTP 429 `OTP_COOLDOWN_ACTIVE` |
| | Không lộ OTP trong API | Kiểm tra response payload của forgot-password | `data: null`, không chứa OTP |
| **6. UI/UX** | Loading Spinner | Khi đang gọi API Brevo | Nút hiển thị trạng thái "Đang xử lý..." và icon xoay |
| | Ẩn/Hiện mật khẩu | Bấm icon con mắt ở 2 ô mật khẩu | Chuyển đổi giữa `type="password"` và `type="text"` |
| | Đổi email ở bước 2 | Bấm "Thay đổi email" | Quay về bước 1, giữ lại email đã nhập để chỉnh sửa |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (Standard Test Cases)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUTH_RESET_PWD_01** | Happy Path | Gửi OTP qua Brevo thành công | Tài khoản đã đăng ký trong DB | 1. Vào `/forgot-password`<br>2. Nhập email hợp lệ<br>3. Bấm "Gửi mã xác nhận" | Email: `student@multilingo.com` | - Nhận thông báo thành công<br>- Chuyển sang Bước 2<br>- Bắt đầu đếm lùi 60s<br>- Mail OTP được gửi thành công |
| **TC_AUTH_RESET_PWD_02** | Negative | Nhập email không tồn tại | Email chưa từng có trong hệ thống | 1. Nhập email lạ<br>2. Bấm "Gửi mã xác nhận" | Email: `ghost@multilingo.com` | - Trả mã lỗi 404 `USER_NOT_FOUND`<br>- Hiển thị thông báo "Tài khoản không tồn tại"<br>- Giữ nguyên ở Bước 1 |
| **TC_AUTH_RESET_PWD_03** | Negative | Nhập email sai định dạng | Đang ở Bước 1 | 1. Nhập email không hợp lệ<br>2. Bấm "Gửi mã xác nhận" | Email: `bad-email-format` | - Báo lỗi form "Định dạng email không hợp lệ"<br>- Không gửi request lên backend |
| **TC_AUTH_RESET_PWD_04** | Security | Chặn gửi lại OTP khi đang trong cooldown 60s | Vừa gửi OTP thành công ở TC_01 | 1. Gọi trực tiếp API `/api/auth/forgot-password` khi cooldown chưa hết | Email: `student@multilingo.com` | - Trả mã lỗi 429 `OTP_COOLDOWN_ACTIVE`<br>- Nút gửi lại trên UI bị disabled với số giây đếm lùi |
| **TC_AUTH_RESET_PWD_05** | Happy Path | Đặt lại mật khẩu thành công | Có OTP hợp lệ trong Redis | 1. Nhập đúng OTP 6 số<br>2. Nhập mật khẩu mới<br>3. Xác nhận mật khẩu khớp<br>4. Bấm "Lưu thay đổi" | OTP: `123456`<br>NewPass: `Secret@2026`<br>Confirm: `Secret@2026` | - Trả mã HTTP 200 OK<br>- Cập nhật mật khẩu mã hóa BCrypt vào DB<br>- Xóa OTP khỏi Redis<br>- Toast thành công và điều hướng sang `/login` |
| **TC_AUTH_RESET_PWD_06** | Negative | Nhập sai mã OTP | OTP trong Redis là `123456` | 1. Nhập OTP sai<br>2. Nhập mật khẩu mới<br>3. Bấm "Lưu thay đổi" | OTP: `999999` | - Trả mã 400 `INVALID_OTP`<br>- Hiển thị thông báo "Mã OTP không chính xác"<br>- Không cập nhật DB |
| **TC_AUTH_RESET_PWD_07** | Boundary | Mật khẩu mới dưới 6 ký tự | Đang ở Bước 2 | 1. Nhập OTP đúng<br>2. Nhập mật khẩu mới 5 ký tự | NewPass: `12345` | - Báo lỗi "Mật khẩu phải từ 6 ký tự trở lên"<br>- Không cho submit đổi mật khẩu |
| **TC_AUTH_RESET_PWD_08** | Negative | Mật khẩu mới và Xác nhận không khớp | Đang ở Bước 2 | 1. Nhập mật khẩu mới<br>2. Nhập xác nhận khác | NewPass: `Pass123`<br>Confirm: `Pass456` | - Hiển thị lỗi đỏ "Mật khẩu xác nhận không khớp"<br>- Nút "Lưu thay đổi" bị disabled |
| **TC_AUTH_RESET_PWD_09** | Edge Case | Nhập OTP đã hết hạn sau 5 phút | OTP sinh quá 5 phút | 1. Nhập OTP cũ<br>2. Bấm "Lưu thay đổi" | OTP: `123456` (đã quá 5m) | - Trả mã 400 `OTP_EXPIRED`<br>- Báo lỗi "Mã OTP đã hết hạn, vui lòng gửi lại mã mới" |
| **TC_AUTH_RESET_PWD_10** | Security | Chống tấn công dò OTP (Brute-force) | Đã nhập sai OTP 4 lần | 1. Nhập sai OTP lần thứ 5<br>2. Bấm "Lưu thay đổi" | OTP: `000000` (lần 5) | - Trả mã 400 `OTP_MAX_ATTEMPTS_EXCEEDED`<br>- Tự động xóa OTP khỏi Redis<br>- Báo lỗi và đưa user về Bước 1 |
| **TC_AUTH_RESET_PWD_11** | UI/UX | Toggle hiển thị mật khẩu bằng icon con mắt | Đang ở Bước 2 | 1. Nhập mật khẩu<br>2. Bấm icon con mắt | NewPass: `Secret@123` | - Chuyển đổi input type giữa text và password mượt mà |
| **TC_AUTH_RESET_PWD_12** | UI/UX | Thay đổi email quay lại Bước 1 | Đang ở Bước 2 | 1. Bấm nút "Thay đổi email" | N/A | - Quay về form Bước 1<br>- Email cũ vẫn được điền sẵn trong ô input |
