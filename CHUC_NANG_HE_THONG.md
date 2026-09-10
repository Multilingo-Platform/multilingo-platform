# DANH SÁCH TỔNG HỢP CHỨC NĂNG (FEATURE LIST)
*Dự án: Multilingo - Nền tảng Thi thử và Đánh giá năng lực Đa ngôn ngữ*

Dựa trên thiết kế Cơ sở dữ liệu và yêu cầu hệ thống, dưới đây là toàn bộ các chức năng được phân tách rõ ràng cho 2 nhóm đối tượng: Học viên (User) và Quản trị viên (Admin).

---

## 👨‍🎓 PHÍA NGƯỜI DÙNG (USER / STUDENT)

### 1. Quản lý Tài khoản & Cá nhân hóa (Onboarding)
- **Đăng ký / Đăng nhập:** Đăng nhập qua Email/Password hoặc Google (Hỗ trợ JWT Refresh Token).
- **Thiết lập Ngôn ngữ (Onboarding):** Khai báo `Ngôn ngữ mẹ đẻ` (Native) và `Ngôn ngữ muốn học` (Target) để cá nhân hóa giao diện và nội dung.
- **Quản lý Hồ sơ:** Xem/Sửa thông tin cá nhân, đổi mật khẩu.

### 2. Thi thử & Luyện tập (Mock Test & Practice)
- **Thư viện Đề thi:** Duyệt danh sách đề thi (IELTS, TOEIC, VNLTV) được lọc tự động theo `Target Language` của user.
- **Làm bài thi (Exam Engine):** 
  - Giao diện làm bài thi đa phương tiện (Nghe Audio, Đọc Text).
  - Chọn chế độ: Thi thật (Mock Test - đếm ngược thời gian) hoặc Luyện tập (Practice).
- **Nộp bài & Chấm điểm Tự động:** Chấm điểm trắc nghiệm tức thì (Reading, Listening).
- **Chấm điểm AI (AI Grading):** Tích hợp AI để chấm và nhận xét chi tiết phần Writing/Speaking (chỉ ra lỗi Ngữ pháp, Từ vựng).

### 3. Công cụ Hỗ trợ Làm bài & Sổ tay Từ vựng
- **Highlight & Tra từ tại chỗ:** Khi bôi đen (select text) một cụm từ hoặc một đoạn văn bản trong bài đọc, hệ thống sẽ hiện ra thanh công cụ mini (Popup Toolbar) với 2 tùy chọn:
  - **Highlight (Tô sáng):** Giúp học viên đánh dấu từ khóa (Keywords) quan trọng để tìm đáp án dễ hơn.
  - **Tra từ điển:** Dịch nghĩa từ/cụm từ đó ra ngôn ngữ mẹ đẻ của user (có tích hợp AI để hiểu ngữ cảnh của câu).
- **Lưu Flashcard:** Lưu từ vựng kèm ngữ cảnh (câu chứa từ đó) vào sổ tay cá nhân.
- **Ôn tập Thuật toán (Spaced Repetition):** Học và ôn tập từ vựng mỗi ngày dựa trên thuật toán lặp lại ngắt quãng (SRS).

### 4. Thống kê & Phân tích (Analytics)
- **Lịch sử làm bài:** Xem lại các bài đã nộp, đáp án đúng/sai và nhận xét của AI.
- **Biểu đồ Năng lực:** Vẽ biểu đồ Radar phân tích điểm mạnh/yếu theo từng dạng câu hỏi (Matching, True/False/Not Given...).

### 5. Thanh toán & Gói cước (Subscriptions)
- **Nâng cấp Premium:** Thanh toán qua cổng VNPAY/MOMO để mua gói cước (30 ngày, 90 ngày...).
- **Quản lý Hạn mức AI:** Xem số lượt chấm AI / Tra từ AI còn lại trong tuần (`user_quotas`).

### 6. Tương tác hệ thống
- Nhận thông báo (Push Notifications) nhắc nhở học Flashcard, báo sắp hết hạn Premium, v.v.

---

## 👨‍💻 PHÍA QUẢN TRỊ VIÊN (ADMIN)

### 1. Quản lý Đề thi & Ngân hàng Câu hỏi (Exam Management)
- **CRUD Đề thi:** Tạo mới, Sửa, Xóa, Ẩn/Hiện các đề thi (IELTS, TOEIC, VNLTV).
- **Tạo Cấu trúc Đề:** Thiết lập các Kỹ năng (Sections) và Phần thi (Parts).
- **Upload Media:** Tải trực tiếp file Audio/Image lên Cloudinary/Firebase và nhúng URL vào đề thi.
- **Soạn thảo Nội dung (JSONB):** Xây dựng câu hỏi, đáp án, và các options thông qua trình soạn thảo linh hoạt.

### 2. Quản lý Người dùng & Phân quyền (User & RBAC)
- **Danh sách User:** Xem, Tìm kiếm, Lọc danh sách học viên.
- **Quản lý Quyền (Roles):** Gán vai trò (Role) cho tài khoản (VD: Biến User thành Admin hoặc Content Editor).
- **Cấp quyền chi tiết (Permissions):** Tùy chỉnh các quyền nhỏ gọn (VD: Cấp quyền `CREATE_EXAM` cho một nhóm Editor).
- **Khóa/Xóa tài khoản:** Ban/Block người dùng vi phạm hoặc thu hồi Token (Kick user).

### 3. Quản lý Từ điển Hệ thống (Global Dictionary)
- Quản lý kho từ vựng chung của nền tảng (Thêm/Sửa từ, phiên âm, định nghĩa mặc định đa ngôn ngữ).

### 4. Quản lý Tài chính & Gói cước (Billing & Plans)
- **CRUD Gói cước:** Tạo các gói Premium (Ví dụ: Gói 1 tháng 100k, Gói 6 tháng 500k).
- **Quản lý Giao dịch:** Theo dõi các hóa đơn thanh toán từ VNPAY/MOMO, đối soát trạng thái (Thành công/Thất bại).
- **Cấp Quota thủ công:** Reset hoặc tặng thêm lượt dùng AI cho một User cụ thể.

### 5. Quản trị Hệ thống (System Operations)
- **Gửi Thông báo:** Gửi thông báo (Notifications) hàng loạt cho tất cả hoặc một nhóm User cụ thể.
- **Nhật ký Hoạt động (Audit Logs):** Truy vết lịch sử thao tác của các Admin/Editor khác (Phòng ngừa rủi ro phá hoại dữ liệu).
- **Thống kê Tổng quan (Dashboard):** Xem doanh thu, số lượng người đăng ký mới, số bài test được làm trong ngày.
