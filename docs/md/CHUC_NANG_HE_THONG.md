# DANH SÁCH TỔNG HỢP CHỨC NĂNG (FEATURE LIST)
*Dự án: Hệ thống Nền tảng Thi thử và Đánh giá Ngoại ngữ Multilingo*

Dựa trên biểu đồ Phân rã Chức năng (FDD) mà bạn thiết kế, dưới đây là chi tiết các chức năng của hệ thống được chia thành 6 phân hệ lớn chuẩn xác nhất:

## 1. Phân hệ Quản lý xác thực và hồ sơ người dùng
- **1.1 Đăng ký tài khoản:** Cho phép người dùng mới tạo tài khoản qua Email hoặc Google.
- **1.2 Đăng nhập hệ thống:** Đăng nhập an toàn với JWT (JSON Web Token).
- **1.3 Đăng xuất hệ thống:** Hủy phiên làm việc an toàn khỏi các thiết bị.
- **1.4 Đặt lại mật khẩu:** Hỗ trợ người dùng lấy lại mật khẩu qua Email.
- **1.5 Cập nhật hồ sơ cá nhân:** Chỉnh sửa thông tin cá nhân, ảnh đại diện.
- **1.6 Thiết lập mục tiêu học tập:** Cài đặt ngôn ngữ mẹ đẻ (Native) và ngôn ngữ mục tiêu (Target) trong quá trình Onboarding.

## 2. Phân hệ Thi thử và đánh giá năng lực ngoại ngữ
- **2.1 Tìm kiếm và lọc đề thi:** Tìm đề thi theo kỹ năng, loại chứng chỉ (IELTS, TOEIC, VNLTV).
- **2.2 Thực hiện bài thi thử:** Cung cấp môi trường làm bài thi thực tế (Mock Test) đa phương tiện với thời gian đếm ngược.
- **2.3 Luyện tập:** Chế độ làm bài không áp lực thời gian, được phép làm lại.
- **2.4 Xem kết quả và giải thích bài thi:** Nhận điểm số tự động (Reading/Listening) và phản hồi/chấm điểm chi tiết từ AI (Writing/Speaking).

## 3. Phân hệ Tra cứu từ điển và ôn tập từ vựng
- **3.1 Tra cứu từ điển đa ngôn ngữ:** Tính năng bôi đen (Highlight) chữ trong bài đọc để dịch nghĩa tại chỗ bằng popup.
- **3.2 Quản lý sổ tay Flashcard cá nhân:** Lưu từ vựng khó cùng với câu ngữ cảnh vào sổ tay cá nhân.
- **3.3 Ôn tập từ vựng lặp lại ngắt quãng:** Thuật toán SRS (Spaced Repetition System) nhắc nhở học viên ôn lại thẻ từ vựng mỗi ngày.

## 4. Phân hệ Quản lý gói cước và thanh toán dịch vụ
- **4.1 Tra cứu thông tin gói Premium:** Hiển thị đặc quyền của các gói nâng cấp hạn mức AI.
- **4.2 Mua và thanh toán gói cước:** Tích hợp cổng thanh toán trực tuyến như VNPAY, MOMO.
- **4.3 Xem lịch sử thanh toán và hóa đơn:** Quản lý lịch sử nạp tiền và kiểm tra trạng thái giao dịch.

## 5. Phân hệ Thống kê và theo dõi tiến độ học tập
- **5.1 Theo dõi thời lượng và chuỗi ngày học:** Ghi nhận số phút online, số lượng flashcard đã học và chuỗi ngày chăm chỉ (Streak).
- **5.2 Xem phân tích biểu đồ năng lực:** Vẽ biểu đồ hình nhện (Radar Chart) so sánh điểm mạnh/yếu của các dạng câu hỏi hoặc từng kỹ năng.

---

## 6. Phân hệ Quản trị hệ thống và nội dung học liệu (Dành cho Admin)
- **6.1 Quản lý ngân hàng đề thi:** Thao tác thêm, sửa, xóa cấu trúc đề thi, section, phần thi.
- **6.2 Quản lý tệp đa phương tiện:** Upload và quản lý kho Audio/Hình ảnh tập trung.
- **6.3 Quản lý người dùng và phân quyền:**
  - Gán quyền (Role) và phân quyền chi tiết (Permissions).
  - *Theo dõi phiên đăng nhập:* Hiển thị lần đăng nhập cuối cùng (Last Login), địa chỉ IP, và thiết bị truy cập của User.
  - *Phân tích hành vi cá nhân:* Xem chi tiết tiến trình của một User cụ thể (đã làm đề nào, thời lượng học ra sao).
- **6.4 Quản lý gói cước và doanh thu:** Thiết lập bảng giá các gói Premium, duyệt và thống kê doanh thu.
- **6.5 Quản trị dữ liệu và kiểm toán hệ thống:**
  - *Nhật ký hoạt động (Audit Logs):* Lưu vết toàn bộ thao tác xóa/sửa hệ thống của các Admin khác và hành động của User.
  - *Dashboard Thống kê:* Báo cáo tổng quan số lượng User hoạt động (DAU/MAU) và tỷ lệ chuyển đổi.
  - *Giám sát gian lận:* Phát hiện IP bất thường, cảnh báo chia sẻ tài khoản.
