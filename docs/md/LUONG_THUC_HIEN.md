# TÀI LIỆU LUỒNG THỰC HIỆN CÁC CHỨC NĂNG (EXECUTION FLOWS)
*Dự án: Hệ thống Nền tảng Thi thử và Đánh giá Ngoại ngữ Multilingo*

Tài liệu này phân tích chi tiết "đường đi của dữ liệu" (Data Flow) và logic xử lý của hệ thống từ lúc User tương tác trên giao diện đến lúc lưu vào Cơ sở dữ liệu.

---

## 1. Luồng Khởi tạo Hệ thống & Đăng nhập (Onboarding & Auth Flow)

### Kịch bản Đăng ký & Onboarding
1. User nhập Email & Password trên giao diện đăng ký.
2. Hệ thống chuyển sang màn hình Onboarding yêu cầu User chọn: `Ngôn ngữ mẹ đẻ` (VD: Tiếng Việt) và `Ngôn ngữ muốn học` (VD: Tiếng Anh).
3. Backend mã hóa mật khẩu (Bcrypt) và lưu vào bảng `users`. Đồng thời tạo mặc định một bản ghi trong bảng `user_study_stats` với `current_streak = 0`.
4. Trả về JWT Token cho Frontend.

### Kịch bản Đăng nhập & Lưu Vết (Login Tracking)
1. User đăng nhập thành công.
2. Backend sinh ra Access Token (sống 15 phút) và Refresh Token (sống 7 ngày).
3. Backend cập nhật `last_login_at` và `last_login_ip` vào bảng `users`.
4. Backend lưu Refresh Token cùng `device_info` và `ip_address` vào bảng `refresh_tokens`.
5. Backend tự động chèn 1 dòng log vào bảng `login_history` (Status: SUCCESS) để Admin có thể xem lại lịch sử.

---

## 2. Luồng Thi Thử & Đánh Giá Năng Lực (Exam Taking & AI Grading Flow)

### Kịch bản Làm bài & Chấm điểm
1. User chọn làm đề IELTS Test 1. Hệ thống sinh một `id` phiên làm bài trong bảng `test_attempts` (Trạng thái: `IN_PROGRESS`).
2. Giao diện Frontend mở ra, load Audio từ Cloudinary và hiển thị câu hỏi (đọc từ cột JSONB `content_data` trong `exam_parts`). Đồng hồ bắt đầu đếm ngược.
3. Trong lúc làm, hệ thống tự động lưu nháp đáp án của User gửi về Backend mỗi 1 phút.
4. User bấm **Nộp bài** (Hoặc hết giờ). Hệ thống cập nhật trạng thái `test_attempts` thành `COMPLETED`.
5. **Chấm điểm Tự động:** Backend so sánh JSON đáp án của User với JSON đáp án gốc để chấm Reading/Listening.
6. **Chấm điểm AI:** Backend đẩy bài Writing/Speaking của User qua API của Google Gemini. AI trả về JSON nhận xét (Lỗi ngữ pháp, Từ vựng, Band điểm dự kiến). Backend lưu vào `ai_feedback` trong bảng `attempt_answers`.
7. Backend cập nhật `total_learning_minutes` trong bảng `user_study_stats` và `daily_study_logs` dựa trên thời gian (Start Time - End Time) của bài thi.

---

## 3. Luồng Tra cứu Từ điển & Học lặp lại (Flashcard & SRS Flow)

### Kịch bản Tra từ tại chỗ & Highlight
1. User đang làm bài thi Reading, bôi đen từ *"Ubiquitous"*. Giao diện hiện Popup "Highlight" và "Tra từ".
2. User bấm "Tra từ". Frontend gọi API gửi từ *"Ubiquitous"* kèm `language_code=en` và `native_language=vi` của User.
3. Backend truy vấn bảng `dictionary_words`, trích xuất `default_meaning->>'vi'`. Trả nghĩa tiếng Việt về cho Frontend. (Nếu không có, Backend gọi AI dịch rồi lưu DB).

### Kịch bản Ôn tập Từ vựng (SRS)
1. User bấm "Lưu Flashcard". Backend lưu từ đó vào `user_flashcards` kèm theo cả câu tiếng Anh (Ngữ cảnh) mà User vừa đọc.
2. Thuật toán Spaced Repetition (SRS) được kích hoạt. Ngày hôm sau, khi User mở tab "Ôn tập", hệ thống truy vấn các từ có `next_review_date <= TODAY`.
3. User trả lời đúng, Backend tăng `ease_factor` và đẩy `interval_days` lên (3 ngày, 7 ngày, 14 ngày). Nếu sai, đẩy về 1 ngày. Cập nhật `flashcards_reviewed` trong bảng `daily_study_logs`.

---

## 4. Luồng Thanh toán & Gói cước (Monetization Flow)

1. User bấm "Nâng cấp Premium" gói 6 tháng.
2. Backend tạo một bản ghi trong bảng `transactions` (Trạng thái: `PENDING`).
3. Backend sinh URL thanh toán VNPAY/MOMO và trả cho Frontend chuyển hướng.
4. Sau khi User thanh toán thành công, VNPAY gọi API Webhook (IPN) về Backend.
5. Backend xác thực chữ ký (Checksum), đổi trạng thái `transactions` thành `SUCCESS`.
6. Cập nhật `subscription_tier = PREMIUM` và cộng dồn `premium_expires_at` trong bảng `users`.
7. Reset lại Hạn mức AI (`user_quotas`) cho User này về mức không giới hạn hoặc mức cao nhất.

---

## 5. Luồng Quản trị & Giám sát Hệ thống (Admin Operations & Tracking Flow)

### Kịch bản Phát hiện Gian lận (Fraud Detection)
1. Cứ mỗi lần có request gửi lên bằng Access Token, Backend có bộ lọc (Filter) kiểm tra IP Address.
2. Nếu phát hiện một User (`subscription_tier = PREMIUM`) có 2 Refresh Token đang sống (`is_revoked = false`) ở 2 IP cách xa nhau về mặt địa lý trong cùng 1 khoảng thời gian, hệ thống sẽ chèn 1 dòng cảnh báo vào bảng `audit_logs`.
3. Admin xem Dashboard, thấy cờ đỏ (Red Flag), bấm nút "Buộc đăng xuất".
4. Backend đổi `is_revoked = true` cho thiết bị vi phạm. Lần tới kẻ xài ké F5 trang web, hệ thống sẽ đẩy văng ra màn hình Đăng nhập.

### Kịch bản Kiểm toán (Audit Logging)
1. Admin A vào "Xóa Đề thi IELTS 01".
2. Hệ thống kiểm tra quyền `permission_id` của Admin A có cho phép xóa đề thi không.
3. Nếu hợp lệ, hệ thống xóa đề thi. Sau đó tạo 1 bản ghi vào `audit_logs` (Nội dung: `DELETE_EXAM`, Entity_ID: `IELTS 01`, Kèm toàn bộ data JSON của đề thi đó vào cột `details` để lỡ xóa nhầm còn có thể Rollback).
