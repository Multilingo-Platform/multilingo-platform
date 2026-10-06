# Acceptance Criteria & Test Cases - Quản lý Hồ sơ cá nhân (UC04, UC04.1, UC04.2)

## 1. Phân tích Phạm vi & Tác nhân (Scope & Actors)
- **Tác nhân:** User (Student đã đăng nhập).
- **In-Scope:** 
  - Xem thông tin cá nhân hiện tại (Họ tên, email, SĐT, ngày tham gia, hạng tài khoản).
  - Cập nhật thông tin cá nhân (Họ tên, SĐT). (Avatar có thể phát triển ở phase sau hoặc mock giao diện trước).
  - Đổi mật khẩu (yêu cầu mật khẩu cũ, mật khẩu mới, xác nhận mật khẩu).
- **Out-of-Scope:** Nâng cấp gói cước (thuộc UC06), Quên mật khẩu qua email (thuộc UC01.1).

---

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)

### UC04: Xem thông tin hồ sơ
```gherkin
Kịch bản: Tải dữ liệu hồ sơ cá nhân
Given Người dùng đã đăng nhập và đang ở trang Dashboard
When Người dùng chuyển hướng sang trang "Hồ sơ & Cài đặt" (/student/settings)
Then Giao diện hiển thị form thông tin cá nhân chứa Họ tên, Email, SĐT, Ngày tham gia, và Trạng thái gói cước (FREE/PREMIUM).
And Avatar của người dùng được hiển thị (nếu có, nếu không thì hiển thị chữ cái đầu tên).
```

### UC04.2: Cập nhật thông tin cá nhân
```gherkin
Kịch bản: Cập nhật thông tin cá nhân thành công
Given Người dùng đang ở trang Hồ sơ
When Người dùng sửa thông tin Họ tên, SĐT hợp lệ và bấm "Lưu thay đổi"
Then Hiển thị thông báo "Cập nhật thành công" (Toast)
And Dữ liệu trong Database được cập nhật
And Trạng thái giao diện và Redux state được đồng bộ ngay lập tức.
```

**Checklist Quy tắc nghiệp vụ:**
- `Họ tên`: Bắt buộc, độ dài 2-50 ký tự, không chứa ký tự đặc biệt lạ.
- `SĐT`: Tùy chọn, đúng định dạng số điện thoại VN (10 số, bắt đầu 03,05,07,08,09).
- `Email`: Disabled, không cho phép đổi (ràng buộc nghiệp vụ).

### UC04.1: Đổi mật khẩu
```gherkin
Kịch bản: Đổi mật khẩu trong cài đặt
Given Người dùng đang ở tab "Đổi mật khẩu" trong trang Hồ sơ
When Người dùng nhập đúng mật khẩu cũ, mật khẩu mới >= 6 ký tự và xác nhận khớp nhau
And Bấm "Cập nhật mật khẩu"
Then Mật khẩu mới được mã hóa và lưu vào CSDL
And Hiển thị thông báo "Đổi mật khẩu thành công"
```

**Checklist Quy tắc nghiệp vụ:**
- `Mật khẩu cũ`: Bắt buộc. Phải khớp với mật khẩu đang lưu trữ (BCrypt verify).
- `Mật khẩu mới`: Bắt buộc, 6-64 ký tự.
- `Xác nhận mật khẩu`: Bắt buộc, phải khớp với mật khẩu mới.

---

## 3. Ma trận Kịch bản kiểm thử (Test Cases)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_PROFILE_01** | Happy Path | Hiển thị đúng dữ liệu | Đã đăng nhập | 1. Vào `/student/settings`<br>2. Kiểm tra form | N/A | Các trường thông tin đổ ra chính xác từ API `/me`. Email bị khóa (disabled). |
| **TC_PROFILE_UPD_01** | Happy Path | Cập nhật tên và SĐT | Ở tab Thông tin chung | 1. Nhập tên mới<br>2. Nhập SĐT hợp lệ<br>3. Bấm "Lưu thay đổi" | Tên: `Nguyễn B`<br>SĐT: `0912345678` | - Toast success<br>- Nút Header cập nhật ngay thành "N"<br>- Database đổi dữ liệu. |
| **TC_PROFILE_UPD_02** | Negative | SĐT sai định dạng | Ở tab Thông tin chung | 1. Nhập SĐT chứa chữ<br>2. Bấm "Lưu" | SĐT: `0912345abc` | - Form validate báo lỗi màu đỏ ngay dưới ô SĐT<br>- Không gọi API. |
| **TC_PROFILE_PWD_01** | Happy Path | Đổi mật khẩu thành công | Ở tab Đổi mật khẩu | 1. Nhập MK cũ đúng<br>2. Nhập MK mới hợp lệ<br>3. Nhập XN đúng<br>4. Submit | Cũ: `123456`<br>Mới: `654321`<br>XN: `654321` | - Toast "Đổi mật khẩu thành công"<br>- Các ô input clear trắng. |
| **TC_PROFILE_PWD_02** | Negative | Sai mật khẩu cũ | Ở tab Đổi mật khẩu | 1. Nhập MK cũ sai<br>2. Nhập MK mới<br>3. Submit | Cũ: `sai123`<br>Mới: `654321` | - API trả lỗi 400<br>- Toast báo lỗi "Mật khẩu cũ không chính xác". |
| **TC_PROFILE_PWD_03** | Boundary | Mật khẩu mới quá ngắn | Ở tab Đổi mật khẩu | 1. Nhập MK mới 5 ký tự<br>2. Submit | Mới: `12345` | - Lỗi validate Frontend: "Mật khẩu tối thiểu 6 ký tự". |
| **TC_PROFILE_PWD_04** | Security | XSS Injection ở trường Tên | Ở tab Thông tin chung | 1. Nhập tên chứa `<script>`<br>2. Submit | Tên: `<script>alert(1)</script>` | - Dữ liệu được encode trước khi lưu hoặc API báo lỗi. Frontend không chạy script. |
