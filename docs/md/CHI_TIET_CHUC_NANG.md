# TÀI LIỆU ĐẶC TẢ CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)
**Dự án:** Nền tảng Thi thử và Đánh giá năng lực Đa ngôn ngữ (IELTS, TOEIC, Tiếng Việt)

---

## I. PHÂN HỆ NGƯỜI DÙNG (USER/STUDENT)

### 1. Xác thực & Phân quyền (Authentication)
*   **Đăng ký/Đăng nhập:** Hỗ trợ đăng nhập bằng Email/Password và Social Login (Google).
*   **Quản lý tài khoản:** Cập nhật thông tin cá nhân, đổi mật khẩu.

### 2. Thiết lập Mục tiêu & Onboarding
*   **Chọn Ngôn ngữ/Chứng chỉ:** Học viên chọn hướng ôn luyện (Tiếng Anh - IELTS, Tiếng Anh - TOEIC, Tiếng Việt).
*   **Thiết lập Target:** Đặt mức điểm mục tiêu để hệ thống theo dõi tiến độ.

### 3. Trang chủ, Thống kê & Quản lý Từ vựng
*   **Bảng điều khiển (Dashboard):** Biểu đồ hiển thị tiến độ học tập, điểm trung bình các kỹ năng (Reading, Listening, Writing).
*   **Từ điển nội bộ (Dictionary):** Thanh tìm kiếm cho phép học viên tra cứu nghĩa, từ loại, và ví dụ của từ vựng bất kỳ.
*   **Quản lý Flashcard:** Khu vực ôn tập các từ vựng đã lưu, hỗ trợ lật thẻ (spaced repetition cơ bản) để ghi nhớ từ vựng hiệu quả.

### 4. Không gian Làm bài thi (Exam Workspace)
*   **Chế độ thi:** Full Test (đủ kỹ năng) hoặc Practice Test (luyện từng phần).
*   **Công cụ Hỗ trợ Đọc hiểu (Reading):** 
    *   *Highlight:* Bôi vàng các đoạn văn bản quan trọng.
    *   *Click-to-Translate & Add to Flashcard:* Double-click vào một từ để hiển thị popup dịch nghĩa nhanh, kèm theo nút bấm "Lưu vào Flashcard" để học sau.
*   **Giao diện Tự luận (Writing) & AI Hỗ trợ:** 
    *   Khung soạn thảo văn bản (Rich Text Editor) có đếm số từ.
    *   *AI Gợi ý (Hints):* Nút bấm yêu cầu AI cung cấp dàn ý sơ lược hoặc gợi ý một số từ vựng (Vocabulary Topic) phù hợp với đề bài khi học viên bị bí ý tưởng.

### 5. Trả Kết quả & Chữa bài (Review & Explanation)
*   **Chấm điểm tự động (Auto-grading):** Xử lý tức thì các câu Trắc nghiệm, Điền từ, Nối câu dựa trên đáp án JSON. 
*   **Chấm điểm AI (Writing):** Gửi dữ liệu bài viết qua Gemini API để nhận điểm số thành phần (Task Response, Coherence, Lexical Resource, Grammar) và nhận xét chi tiết.
*   **Giao diện Chữa bài:** 
    *   Hiển thị màu sắc trực quan (Xanh/Đỏ) cho trạng thái Đúng/Sai.
    *   Bung phần "Giải thích chi tiết" được trích xuất từ dữ liệu hệ thống.

---

## II. PHÂN HỆ QUẢN TRỊ (ADMIN/TEACHER)

### 1. Quản lý Đề thi (Exam Builder UI)
*   **Thiết lập chung:** Form khai báo Tên đề thi, Loại chứng chỉ, Ngôn ngữ, và Thời gian làm bài.
*   **Quản lý Media & Upload:** Tích hợp tính năng tải file Audio/Image trực tiếp trên giao diện. Trả về URL để đính kèm vào các câu hỏi.
*   **Giao diện Xây dựng Đề thi trực quan (Dynamic Form):**
    *   Cung cấp cấu trúc đa cấp: Thêm Phần thi (Part) -> Thêm Nhóm câu hỏi (Group) -> Thêm Câu hỏi con.
    *   Trình soạn thảo văn bản (Rich Text) để Admin nhập bài đọc dài (Reading Passages).
    *   Dropdown chọn Loại câu hỏi (Trắc nghiệm, Điền từ, Writing...). Giao diện sẽ tự động thay đổi các trường nhập liệu tương ứng với loại câu hỏi được chọn.

### 2. Quản lý Người dùng
*   Xem danh sách, kiểm tra tiến độ học viên, khóa/mở khóa tài khoản.

---

## III. KỊCH BẢN LUỒNG HOẠT ĐỘNG CHI TIẾT (WORKFLOW SCENARIOS)

**Kịch bản 1: Đăng ký, Thiết lập Mục tiêu & Quản lý (Onboarding)**
1.  Người dùng truy cập trang chủ, chọn **Đăng nhập bằng Google** (Social Login).
2.  Lần đầu đăng nhập, hệ thống chuyển hướng sang màn hình **Onboarding**.
3.  Người dùng chọn ngôn ngữ và chứng chỉ mục tiêu (VD: Tiếng Anh - IELTS, hoặc Tiếng Việt - VNLTV) và nhập số điểm kỳ vọng (VD: 7.0).
4.  Hệ thống khởi tạo profile, lưu thông tin vào cơ sở dữ liệu và chuyển hướng vào **Dashboard**.
5.  Tại Dashboard, hệ thống tự động gợi ý một "Bài test đánh giá năng lực đầu vào" dựa trên chứng chỉ đã chọn.

**Kịch bản 2: Thực hiện Bài thi Trắc nghiệm (Listening/Reading)**
1.  Học viên chọn một đề thi (VD: TOEIC Reading) và bấm **Bắt đầu**.
2.  Frontend (React) gọi API để lấy toàn bộ dữ liệu JSON của đề thi và render giao diện. Đồng hồ đếm ngược (Timer) bắt đầu chạy.
3.  Học viên làm bài. Khi click chọn đáp án (A, B, C, D) hoặc gõ text vào ô điền từ, **Bảng điều hướng (Navigation Panel)** bên góc màn hình lập tức đổi màu câu đó thành "Đã làm".
4.  Học viên có thể dùng chức năng *Highlight* bôi vàng các đoạn văn bản quan trọng.
5.  Khi thời gian về 00:00, hệ thống tự động khóa giao diện, thu thập tất cả đáp án thành một khối JSON và gửi API POST nộp bài về Backend.

**Kịch bản 3: Tương tác Tra từ & Lưu Flashcard (Reading/Từ điển)**
1.  Trong lúc làm bài Practice Test (không tính giờ), học viên gặp từ vựng khó trong bài đọc hiểu.
2.  Học viên **double-click** vào từ đó. Frontend bắt sự kiện, gửi từ vựng về Backend (hoặc API từ điển bên thứ 3) để lấy nghĩa.
3.  Một Popup nhỏ xuất hiện hiển thị: Nghĩa tiếng Việt, phiên âm, và từ loại.
4.  Học viên bấm nút **"Thêm vào Flashcard"**. Hệ thống lưu từ này vào danh sách cá nhân của học viên.
5.  Học viên thoát ra trang Dashboard, truy cập tab **Flashcard** để ôn tập lại các từ vừa lưu bằng thao tác lật thẻ (Click to flip).

**Kịch bản 4: Làm bài Tự luận với Trợ lý AI (Writing)**
1.  Học viên mở một đề thi Writing Task 2. Giao diện hiển thị đề bài và khung Rich Text Editor.
2.  Sau một lúc suy nghĩ, học viên bị "bí" ý tưởng và bấm nút **"Gợi ý AI (Hints)"**.
3.  Backend Spring Boot gửi prompt (chứa đề bài và bối cảnh) lên Gemini API, nhận về một dàn ý ngắn gọn (Mở, Thân, Kết) và hiển thị cho học viên.
4.  Học viên hoàn thiện bài viết (có bộ đếm từ tự động cập nhật bên dưới) và bấm nộp bài.

**Kịch bản 5: Hệ thống Chấm điểm & Trả Kết quả (Grading & Review)**
1.  Sau khi nhận JSON bài làm, Backend tự động đối chiếu các câu trắc nghiệm, điền từ với `correct_answer`. (Hệ thống tự động `trim()` và chuyển thành chữ thường để so khớp chính xác).
2.  Đối với phần Writing, Backend gửi toàn bộ bài làm và `ai_prompt_context` qua Gemini để chấm.
3.  Sau khi tổng hợp, Backend trả kết quả về Frontend. Giao diện chuyển sang màn hình **Result**.
4.  Màn hình hiển thị Điểm tổng, biểu đồ tròn phân tích Đúng/Sai.
5.  Học viên cuộn xuống xem lại chi tiết:
    *   Câu trả lời đúng được tô viền Xanh, câu sai tô viền Đỏ kèm đáp án chuẩn.
    *   Học viên bấm **"Xem giải thích"**, hệ thống bung phần giải nghĩa (Explanation) đã lưu sẵn trong JSON ra cho học viên đọc.
    *   Đọc nhận xét chi tiết và điểm thành phần của AI cho bài Writing.

**Kịch bản 6: Quản trị viên Xây dựng Đề thi (Admin Exam Builder)**
1.  Admin đăng nhập tài khoản quyền quản trị, truy cập **Tạo Đề Thi Mới**.
2.  Admin điền form thông tin cơ bản: Tên đề, Loại chứng chỉ, Ngôn ngữ.
3.  Khi thêm Part Listening, Admin bấm **Upload Audio**. Frontend đẩy file lên Firebase Storage, nhận URL và lưu ngầm vào form.
4.  Admin tạo một nhóm câu hỏi (Question Group). Giao diện hiển thị Dynamic Form:
    *   Bấm "Thêm ảnh minh họa" -> Upload lên Cloudinary -> Trả URL.
    *   Chọn dạng "Trắc nghiệm 4 đáp án" -> Form hiện 4 ô A, B, C, D và 1 ô nhập lời Giải thích.
5.  Admin bấm **Lưu Đề Thi**. Frontend tự động chuyển đổi toàn bộ Form Data thành chuỗi `JSONB` chuẩn và gửi về PostgreSQL lưu trữ. Đề thi lập tức xuất hiện trên kho tài liệu của học viên.