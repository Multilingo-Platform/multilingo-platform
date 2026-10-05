# Đặc tả Use Case - Hệ thống Multilingo

Tài liệu đặc tả các Use Case của phân hệ Quản lý xác thực, hồ sơ người dùng và thanh toán (Trích xuất từ file docx).

---

## 1. UC001: Đăng ký tài khoản
- **Tác nhân:** User
- **Sự kiện kích hoạt:** User click vào nút Đăng ký trên giao diện website
- **Tiền điều kiện:** User chưa có tài khoản trong hệ thống
- **Hậu điều kiện:** Tài khoản mới được khởi tạo và lưu trữ thành công vào hệ thống, User được điều hướng đến trang Đăng nhập

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | User | Chọn chức năng Đăng ký |
| 2 | Hệ thống | Hiển thị giao diện form đăng ký tài khoản |
| 3 | User | Nhập thông tin: Họ tên, Số điện thoại, Email, Mật khẩu, Xác nhận mật khẩu |
| 4 | User | Nhấn nút Đăng ký tài khoản |
| 5 | Hệ thống | Kiểm tra các trường thông tin bắt buộc đã được nhập đầy đủ |
| 6 | Hệ thống | Kiểm tra định dạng hợp lệ của Email và Số điện thoại |
| 7 | Hệ thống | Kiểm tra Email và Số điện thoại chưa tồn tại trong cơ sở dữ liệu |
| 8 | Hệ thống | Kiểm tra Mật khẩu và Xác nhận mật khẩu trùng khớp |
| 9 | Hệ thống | Mã hóa mật khẩu (BCrypt), lưu tài khoản mới vào cơ sở dữ liệu |
| 10 | Hệ thống | Hiển thị thông báo Đăng ký thành công và điều hướng đến trang Đăng nhập |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 5a | Hệ thống | Thông báo lỗi: Vui lòng nhập đầy đủ các trường bắt buộc, quay lại bước 3 |
| 6a | Hệ thống | Thông báo lỗi: Email hoặc Số điện thoại không đúng định dạng, quay lại bước 3 |
| 7a | Hệ thống | Thông báo lỗi: Email hoặc Số điện thoại đã được đăng ký trong hệ thống, quay lại bước 3 |
| 8a | Hệ thống | Thông báo lỗi: Mật khẩu xác nhận không trùng khớp, quay lại bước 3 |

---

## 2. UC002: Đăng nhập
- **Tác nhân:** User, Admin
- **Sự kiện kích hoạt:** Admin, User chọn chức năng "Đăng nhập" trên giao diện.
- **Tiền điều kiện:** User đã có tài khoản trong hệ thống
- **Hậu điều kiện:** Admin hoặc User đăng nhập thành công vào hệ thống và được phân quyền, điều hướng đến màn hình chức năng tương ứng của mình.

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | Admin, User | Chọn chức năng "Đăng nhập" |
| 2 | Hệ thống | Hiển thị giao diện đăng nhập |
| 3 | Admin, User | Nhập thông tin (Gmail, mật khẩu) |
| 4 | Hệ thống | Kiểm tra tính hợp lệ của thông tin (Thành công) |
| 5 | Hệ thống | Kiểm tra tài khoản trong CSDL (Thành công) |
| 6 | Hệ thống | Thông báo thành công & điều hướng sang giao diện tương ứng |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 3a | Admin, User | Chọn phương thức "Đăng nhập bằng google" |
| 4a | Admin, User | Xác nhận tài khoản Google |
| 5a | Hệ thống | Tiến hành bước Kiểm tra tài khoản trong CSDL (Giống bước 6 của luồng chính) |
| 5b | Hệ thống | (Từ bước 5 luồng chính) Nếu thông tin không hợp lệ: Hiển thị thông báo lỗi tương ứng và kết thúc. |
| 6a | Hệ thống | (Từ bước 6 luồng chính hoặc 5a luồng thay thế) Nếu tài khoản không hợp lệ trong CSDL: Hiển thị thông báo lỗi tương ứng và kết thúc. |

---

## 3. UC003: Quên mật khẩu
- **Tác nhân:** User
- **Sự kiện kích hoạt:** User nhấn chọn "Quên mật khẩu" tại giao diện đăng nhập.
- **Tiền điều kiện:** Người dùng đã đăng ký tài khoản bằng Email trong hệ thống.
- **Hậu điều kiện:** Mật khẩu mới của User được lưu thành công vào cơ sở dữ liệu. User có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống.

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | User | Chọn chức năng Quên mật khẩu |
| 2 | Hệ thống | Hiển thị form nhập Email |
| 3 | User | Nhập Email |
| 4 | User | Nhấn "Gửi mã xác nhận" |
| 5 | Hệ thống | Kiểm tra tính hợp lệ của Email (Hợp lệ) |
| 6 | Hệ thống | Tạo, gửi mã OTP về Email và Hiển thị form Đặt lại MK |
| 7 | User | Nhập OTP, Mật khẩu mới, Xác nhận MK |
| 8 | User | Nhấn "Lưu thay đổi" |
| 9 | Hệ thống | Xác thực mã OTP và đối chiếu Mật khẩu mới (Hợp lệ) |
| 10 | Hệ thống | Mã hóa MK, lưu vào CSDL |
| 11 | Hệ thống | Thông báo thành công & Điều hướng (về lại trang Đăng nhập) |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 5a | Hệ thống | (Tại bước 5) Nếu Email không hợp lệ (sai định dạng, không tồn tại trong hệ thống,...): Hiển thị thông báo lỗi tương ứng và quay lại bước 3 (yêu cầu nhập lại Email). |
| 9a | Hệ thống | (Tại bước 9) Nếu OTP hoặc Mật khẩu không hợp lệ (OTP sai/hết hạn, Mật khẩu mới và Xác nhận MK không khớp,...): Hiển thị thông báo lỗi tương ứng và quay lại bước 7 (yêu cầu nhập lại OTP/MK). |

---

## 4. UC004: Cập nhật hồ sơ cá nhân
- **Tác nhân:** User
- **Sự kiện kích hoạt:** User nhấn chọn mục "Hồ sơ cá nhân" trên giao diện
- **Tiền điều kiện:** Người dùng đã đăng nhập thành công vào hệ thống.
- **Hậu điều kiện:** Thông tin cá nhân mới của User được cập nhật thành công trong cơ sở dữ liệu và được hiển thị trong hồ sơ của User ở các lần truy cập sau.

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | User | Chọn "Hồ sơ cá nhân" |
| 2 | Hệ thống | Hiển thị chi tiết thông tin hiện tại của User |
| 3 | User | Tiến hành chỉnh sửa thông tin |
| 4 | User | Nhấn nút "Lưu" |
| 5 | Hệ thống | Kiểm tra tính hợp lệ của các thông tin vừa chỉnh sửa (Hợp lệ) |
| 6 | Hệ thống | Lưu thông tin cập nhật vào CSDL và kết thúc |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 5a | Hệ thống | (Tại bước 5) Nếu thông tin không hợp lệ (để trống trường bắt buộc, sai định dạng...): Hệ thống chặn việc lưu, có thể hiển thị cảnh báo lỗi và quay lại bước 3 để User chỉnh sửa lại thông tin. |

---

## 5. UC005: Đổi mật khẩu
- **Tác nhân:** User
- **Sự kiện kích hoạt:** User click vào nút Đổi mật khẩu (chỉnh sửa: thực tế là nút trên trang hồ sơ)
- **Tiền điều kiện:** User đã đăng nhập trong hệ thống
- **Hậu điều kiện:** Mật khẩu mới của User được mã hoá và lưu thành công vào cơ sở dữ liệu. Từ lần đăng nhập kế tiếp, User bắt buộc phải sử dụng mật khẩu mới này.

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | User | Nhập mật khẩu cũ, mật khẩu mới, Xác nhận mật khẩu |
| 2 | User | Nhấn nút "Cập nhật mật khẩu" |
| 3 | Hệ thống | Kiểm tra tính hợp lệ của thông tin mật khẩu (Hợp lệ) |
| 4 | Hệ thống | Mã hóa mật khẩu mới |
| 5 | Hệ thống | Cập nhật mật khẩu vào CSDL |
| 6 | Hệ thống | Hiển thị thông báo đổi mật khẩu thành công và kết thúc |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 3a | Hệ thống | (Tại bước 3) Nếu thông tin không hợp lệ (mật khẩu cũ sai, mật khẩu mới và xác nhận mật khẩu không khớp, hoặc không đủ độ mạnh...): Hệ thống hiển thị thông báo lỗi tương ứng và quay lại bước 1 (yêu cầu User nhập lại thông tin mật khẩu). |

---

## 6. UC006: Nâng cấp tài khoản Premium
- **Tác nhân:** User, Cổng thanh toán (Hệ thống bên thứ 3)
- **Sự kiện kích hoạt:** User nhấn chọn chức năng "Nâng cấp tài khoản" trên giao diện hệ thống.
- **Tiền điều kiện:** Người dùng đã đăng nhập và đang sử dụng tài khoản thường (hoặc gói cước thấp hơn).
- **Hậu điều kiện:** Tài khoản của User được cập nhật thành công gói Premium trong hệ thống cơ sở dữ liệu. User có thể bắt đầu sử dụng các tính năng cao cấp của ứng dụng/website.

### Luồng sự kiện chính (Thành công)
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 1 | User | Chọn chức năng nâng cấp tài khoản |
| 2 | Hệ thống | Hiển thị danh sách các gói dịch vụ |
| 3 | User | Chọn gói dịch vụ phù hợp |
| 4 | Hệ thống | Hiển thị chi tiết dịch vụ đã chọn |
| 5 | User | Nhấn nút Xác nhận thanh toán |
| 6 | Hệ thống | Hiển thị thông tin thanh toán (có thể là chuyển hướng sang trang thanh toán) |
| 7 | User | Tiến hành thanh toán (nhập thông tin thẻ/chuyển khoản...) |
| 8 | Cổng thanh toán | Tiếp nhận thông tin thanh toán và xử lý giao dịch (Kết quả: Thành công) |
| 9 | Hệ thống | Nhận phản hồi thành công, tiến hành cập nhật gói cước của User vào CSDL |
| 10 | Hệ thống | Hiển thị thông báo nâng cấp thành công và kết thúc |

### Luồng sự kiện thay thế
| STT | Thực hiện bởi | Hành động |
|:---:|:---:|---|
| 8a | Cổng thanh toán | (Tại bước 8) Nếu giao dịch Thất bại (do thẻ lỗi, số dư không đủ, hoặc User tự hủy thanh toán...): Trả kết quả thất bại về lại cho Hệ thống. |
| 8b | Hệ thống | Nhận phản hồi thất bại, hiển thị Thông báo lỗi tương ứng cho User và kết thúc quy trình (không cập nhật CSDL). |
