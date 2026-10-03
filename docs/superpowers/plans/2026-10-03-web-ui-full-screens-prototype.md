# Multilingo Web-UI Full Screens & Figma-like Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện 100% các màn hình còn thiếu của toàn bộ hệ thống Multilingo Platform trong `web-ui`, tích hợp thanh điều hướng nguyên mẫu tương tác (Figma Prototype Navigator Bar) và Sơ đồ luồng màn hình (Screen Flow Map) phục vụ xem trước và đối soát thiết kế trước khi lập trình.

**Architecture:** Mở rộng ứng dụng Vite + React 19 + TypeScript trong `web-ui` với kiến trúc module phân hệ rõ ràng (Student, Admin, Public). Xây dựng các trang mới tuân thủ Design System (Amber/Orange theme, EdTech cards, Glassmorphism, Responsive), tích hợp thanh công cụ nổi toàn cục `FigmaPrototypeBar` cho phép nhảy nhanh tới 27 màn hình và xem đa thiết bị.

**Tech Stack:** React 19, TypeScript, React Router DOM v7, Lucide React Icons, Pure CSS Design System tokens.

**Spec:** [docs/superpowers/specs/2026-10-03-web-ui-full-screens-prototype-spec.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-10-03-web-ui-full-screens-prototype-spec.md)

---

## Global Constraints

- Mọi màn hình mới phải tương thích hoàn toàn với hệ thống CSS hiện có (`index.css`, `App.css`), dùng biến `--primary`, `--bg-secondary`, `--border-light`,...
- Mọi thành phần tương tác phải có mock data phong phú, không dùng placeholder rỗng ("Lorem ipsum").
- Không làm gãy các route hiện tại; mọi route mới được đăng ký chuẩn xác trong `src/App.tsx`.
- Tuyệt đối không để xảy ra lỗi TypeScript hoặc cú pháp khi chạy `npm run build` trong `web-ui`.
- Bắt buộc kiểm thử hiển thị mượt mà trên cả 4 kích thước: Desktop (1440px), Laptop (1200px), Tablet (768px), Mobile (390px).

## Review Focus

1. **Điều hướng không bị chặn:** Các trang dành cho Student hoặc Admin đều có thể truy cập trực tiếp từ Figma Prototype Bar mà không bắt buộc phải login trước.
2. **Khả năng tương tác đa trạng thái:** Màn hình làm bài (Listening/Writing) phải có trạng thái đang làm, đếm giờ, mở gợi ý AI, và chuyển sang xem kết quả.
3. **Mô phỏng thanh toán VNPAY thực tế:** Có mã VietQR động, mã giao dịch, đồng hồ đếm ngược 15:00 và nút giả lập thanh toán Thành công/Thất bại.
4. **Trực quan hóa thuật toán SRS Flashcard:** Hiệu ứng lật thẻ 3D mượt mà và 4 nút đánh giá SuperMemo SM-2 chuẩn xác.
5. **Đầy đủ dữ liệu cho Admin:** Bảng kiểm toán Audit Logs có dữ liệu JSON snapshot chân thực có thể xem và thực hiện rollback.

---

## Task Breakdown

### Task 1: Triển khai Thanh Điều Hướng Prototype & Sơ Đồ Luồng Màn Hình (Figma Prototype Bar & Flow Map)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Xây dựng thanh công cụ nổi toàn cục giúp chuyển đổi tức thì tới mọi màn hình và trang Canvas tổng hợp luồng giao diện.

**Files:**
- Create: `web-ui/src/components/FigmaPrototypeBar.tsx`
- Create: `web-ui/src/pages/prototype/ScreenFlowMap.tsx`
- Modify: `web-ui/src/App.tsx`
- Modify: `web-ui/src/index.css`

- [ ] **Step 1:** Thêm CSS cho thanh Figma Prototype Bar (hiệu ứng floating, backdrop blur, device frame simulator) vào `web-ui/src/index.css`.
- [ ] **Step 2:** Tạo component `FigmaPrototypeBar.tsx` với dropdown danh sách 27 màn hình (phân nhóm theo vai trò & use case), bộ nút chuyển đổi kích thước thiết bị (Desktop / Laptop / Tablet / Mobile), và nút mở Flow Map.
- [ ] **Step 3:** Tạo trang `ScreenFlowMap.tsx` hiển thị sơ đồ phân nhánh luồng người dùng (User Journeys) trực quan với các thẻ màn hình thu nhỏ có thể click nhảy thẳng vào màn hình đó.
- [ ] **Step 4:** Nhúng `FigmaPrototypeBar` vào root `web-ui/src/App.tsx` và thêm route `/prototype-map`.
- [ ] **Step 5:** Kiểm tra build bằng lệnh `npm run build` trong `web-ui`.

---

### Task 2: Triển khai Màn hình Xác thực Bổ sung - Quên & Đặt lại Mật khẩu (UC01.1)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Hoàn thiện luồng xác thực 3 bước khép kín cho phân hệ khách/học viên.

**Files:**
- Create: `web-ui/src/pages/student/ForgotPassword.tsx`
- Modify: `web-ui/src/App.tsx`
- Modify: `web-ui/src/pages/student/AuthPage.tsx`

- [ ] **Step 1:** Xây dựng component `ForgotPassword.tsx` với luồng 3 bước động:
  - Bước 1: Nhập email nhận OTP có kiểm tra định dạng.
  - Bước 2: Nhập mã OTP 6 số với bộ đếm ngược cooldown 60s và nút "Gửi lại mã".
  - Bước 3: Đặt lại mật khẩu mới kèm thước đo độ mạnh (Password Strength Meter: Yếu, Trung bình, Mạnh) và nút hoàn tất.
- [ ] **Step 2:** Liên kết nút "Quên mật khẩu?" trên `AuthPage.tsx` sang `/forgot-password`.
- [ ] **Step 3:** Đăng ký route `/forgot-password` trong `App.tsx` dưới `PublicLayout`.
- [ ] **Step 4:** Chạy kiểm tra TypeScript và xác nhận chuyển bước hoạt động trơn tru.

---

### Task 3: Triển khai Không gian Luyện thi Listening có Audio Player & Sóng Âm (UC08)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Xây dựng phòng thi Listening chuyên nghiệp cho học viên với giao diện Audio Waveform và bảng câu hỏi tương tác.

**Files:**
- Create: `web-ui/src/pages/student/ListeningPracticeEngine.tsx`
- Modify: `web-ui/src/App.tsx`
- Modify: `web-ui/src/pages/student/ExamLibrary.tsx`

- [ ] **Step 1:** Xây dựng `ListeningPracticeEngine.tsx`:
  - Thanh header đếm ngược thời gian làm bài, nút nộp bài.
  - Cột trái: Bộ điều khiển Audio trực quan với thanh sóng âm chạy động (Waveform Visualizer), tua nhanh/chậm 5s, nút chọn tốc độ phát (0.75x, 1.0x, 1.25x), và transcript bài nghe (có nút ẩn/hiện lời thoại).
  - Cột phải: Bộ câu hỏi Listening (Trắc nghiệm Part 1-2, Điền từ vào chỗ trống Part 3-4), bảng Palette số câu hỏi bên phải để nhảy nhanh câu.
- [ ] **Step 2:** Thêm nút mở "Luyện Listening" từ thẻ đề thi trong `ExamLibrary.tsx`.
- [ ] **Step 3:** Đăng ký route `/student/exam/:id/listening` trong `App.tsx`.
- [ ] **Step 4:** Kiểm tra thao tác chọn đáp án, tua audio giả lập và nộp bài chuyển sang màn hình kết quả.

---

### Task 4: Triển khai Không gian Luyện Writing & Trợ lý Gemini AI Hints (UC08.4, UC10.2)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Xây dựng trình luyện viết văn bản tự luận IELTS/TOEIC tích hợp AI trợ giúp và bộ đếm từ.

**Files:**
- Create: `web-ui/src/pages/student/WritingPracticeEngine.tsx`
- Modify: `web-ui/src/App.tsx`
- Modify: `web-ui/src/pages/student/ExamLibrary.tsx`

- [ ] **Step 1:** Xây dựng `WritingPracticeEngine.tsx`:
  - Giao diện 2 cột chuẩn thi máy tính: Cột trái hiển thị đề bài Task 1 (biểu đồ) hoặc Task 2 (đoạn văn nghị luận) kèm tính năng bôi đen tra từ nhanh.
  - Cột phải: Trình soạn thảo văn bản với bộ đếm từ tự động (Word Count) và cảnh báo số từ tối thiểu.
  - Drawer Trợ lý AI (Gemini Assistant): Nút "💡 Gợi ý AI Hints" mở ra dàn ý 3 phần phân tích chi tiết và 10 từ vựng học thuật ăn điểm (C1/C2).
- [ ] **Step 2:** Thêm nút "Luyện Writing" trong `ExamLibrary.tsx`.
- [ ] **Step 3:** Đăng ký route `/student/exam/:id/writing` trong `App.tsx`.
- [ ] **Step 4:** Kiểm tra gõ phím cập nhật số từ và tương tác mở/đóng drawer AI Hints.

---

### Task 5: Nâng cấp Báo cáo Kết quả với AI Feedback & Interactive Diff-View (UC10.2)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Bổ sung giao diện so sánh sửa lỗi bài viết bằng AI (Diff-View) vào trang kết quả thi.

**Files:**
- Modify: `web-ui/src/pages/student/ExamResult.tsx`

- [ ] **Step 1:** Thêm Tab điều hướng trong `ExamResult.tsx`: Tab 1 "Tổng quan Trắc nghiệm (Reading/Listening)" và Tab 2 "Đánh giá Bài viết AI (Writing Feedback)".
- [ ] **Step 2:** Xây dựng Tab Đánh giá AI Writing:
  - Bảng điểm 4 tiêu chí quốc tế (Task Achievement, Coherence, Lexical, Grammar) kèm nhận xét chi tiết từng tiêu chí.
  - Khung Diff-View: Đoạn văn bản gốc có đánh dấu gạch đỏ các lỗi ngữ pháp/từ vựng, click vào hiện tooltip phân tích và câu gợi ý viết lại band 8.0+.
  - Thẻ "Phiên bản viết lại hoàn hảo từ Gemini AI" (AI Rewritten Masterpiece).
- [ ] **Step 3:** Kiểm tra tương tác click xem lỗi và chuyển tab mượt mà.

---

### Task 6: Triển khai Từ điển Đa Ngôn Ngữ & Nâng Cấp Phiên Ôn Tập Flashcard SM-2 (UC11, UC12.2)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Hoàn thiện chu trình học từ vựng ngữ cảnh và trải nghiệm lật thẻ ôn tập ngắt quãng 3D.

**Files:**
- Create: `web-ui/src/pages/student/DictionaryView.tsx`
- Create: `web-ui/src/pages/student/FlashcardStudySession.tsx`
- Modify: `web-ui/src/pages/student/Flashcards.tsx`
- Modify: `web-ui/src/layouts/UserLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `DictionaryView.tsx`:
  - Thanh tìm kiếm từ vựng gợi ý thời gian thực.
  - Thẻ kết quả tra cứu: Phát âm UK/US audio, phiên âm IPA, định nghĩa song ngữ Anh - Việt, ví dụ câu trích xuất từ đề thi thật, cụm từ liên quan (Collocations/Idioms), và nút "+ Lưu vào Flashcard".
- [ ] **Step 2:** Xây dựng `FlashcardStudySession.tsx`:
  - Giao diện ôn tập tập trung toàn màn hình.
  - Thẻ từ vựng với hiệu ứng lật 3D (3D Card Flip CSS) khi click hoặc bấm phím Space.
  - 4 nút đánh giá thuật toán SuperMemo SM-2: "Quên (1 ngày)", "Khó (2 ngày)", "Nhớ tốt (4 ngày)", "Rất dễ (7 ngày)".
  - Thanh tiến độ buổi học (VD: 5/15 từ) và màn hình tổng kết khi hoàn thành buổi học.
- [ ] **Step 3:** Thêm nút "Bắt đầu Ôn tập ngay" từ trang `Flashcards.tsx` dẫn sang `/student/flashcards/study`.
- [ ] **Step 4:** Thêm link "Từ điển" trên thanh điều hướng `UserLayout.tsx` và đăng ký các routes trong `App.tsx`.

---

### Task 7: Triển khai Báo Cáo Năng Lực Radar & Trung Tâm Thông Báo (UC13.1, UC13.2, UC12.3)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Trực quan hóa dữ liệu học tập cá nhân với biểu đồ mạng nhện và hộp thông báo nhắc việc.

**Files:**
- Create: `web-ui/src/pages/student/AnalyticsProgress.tsx`
- Create: `web-ui/src/components/NotificationDrawer.tsx`
- Modify: `web-ui/src/layouts/UserLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `AnalyticsProgress.tsx`:
  - Biểu đồ Radar SVG 6 trục trực quan (Reading Skimming, Scanning, Listening Key details, Vocab, Grammar, Writing Flow).
  - Bản đồ hoạt động học tập (Heatmap lịch theo tuần/tháng).
  - Thẻ phân tích "Vùng trũng năng lực" đưa ra lời khuyên AI và 3 bài luyện tập đề xuất giúp cải thiện điểm yếu.
- [ ] **Step 2:** Xây dựng `NotificationDrawer.tsx`:
  - Popup danh sách thông báo khi click chuông ở Header.
  - Phân loại: Nhắc ôn từ vựng đến hạn (SRS), kết quả chấm AI Writing, thông báo gia hạn gói cước.
- [ ] **Step 3:** Tích hợp chuông thông báo vào `UserLayout.tsx` và đăng ký route `/student/analytics`.

---

### Task 8: Triển khai Bảng Giá VIP & Mô Phỏng Cổng Thanh Toán VNPAY (UC06)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Hoàn thiện phân hệ thương mại hóa với giao diện so sánh gói cước và cổng thanh toán VNPAY QR tương tác.

**Files:**
- Create: `web-ui/src/pages/student/PricingCheckout.tsx`
- Create: `web-ui/src/pages/student/PaymentSuccess.tsx`
- Modify: `web-ui/src/layouts/UserLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `PricingCheckout.tsx`:
  - Bảng so sánh 3 gói cước: Miễn phí (Free), Gói Bứt Phá 6 tháng, Gói Trọn Gói VIP 1 năm kèm huy hiệu Best Choice.
  - Modal Cổng thanh toán VNPAY trực quan: Mã QR VietQR động thanh toán nhanh, Mã đơn hàng, Số tiền, Đồng hồ đếm ngược 15:00, Tab chọn Quét mã QR / Thẻ ATM / Thẻ Quốc tế.
  - Nút kiểm thử giả lập: "Xác nhận Thanh toán Thành công" hoặc "Mô phỏng Thanh toán Thất bại".
- [ ] **Step 2:** Xây dựng `PaymentSuccess.tsx`:
  - Giao diện hóa đơn / biên lai điện tử thành công: Mã giao dịch VNPAY, Ngày thanh toán, Hạn dùng VIP mới, nút quay về Thư viện đề thi hoặc Bảng điều khiển.
- [ ] **Step 3:** Thêm nút "Nâng cấp VIP" nổi bật trên Header `UserLayout.tsx` và đăng ký các routes trong `App.tsx`.

---

### Task 9: Triển khai Quản trị Kiểm Toán & Phát Hiện Gian Lận Đa IP (UC15.4, A_Tracking)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Xây dựng trung tâm giám sát an ninh và kiểm toán thao tác hệ thống cho Admin.

**Files:**
- Create: `web-ui/src/pages/admin/AuditLogs.tsx`
- Modify: `web-ui/src/layouts/AdminLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `AuditLogs.tsx`:
  - Tab 1: Nhật ký kiểm toán thao tác (Audit Logs): Bộ lọc theo hành vi (DELETE_EXAM, UPDATE_ROLE, USER_LOCK), bảng chi tiết kèm nút "Xem Snapshot JSON".
  - Modal Snapshot Data: Hiển thị bản chụp dữ liệu cũ dạng JSON tô màu cú pháp và nút "Khôi phục dữ liệu (Rollback)".
  - Tab 2: Giám sát an ninh & Chống gian lận (Fraud Detection): Danh sách cảnh báo các tài khoản VIP phát hiện đăng nhập đồng thời 2 địa chỉ IP khác nhau và nút thao tác "Buộc đăng xuất từ xa (Revoke Session)".
- [ ] **Step 2:** Cập nhật liên kết trong `AdminLayout.tsx` dẫn tới `/admin/audit`.
- [ ] **Step 3:** Đăng ký route `/admin/audit` trong `App.tsx`.

---

### Task 10: Triển khai Quản trị Doanh Thu & Đối Soát Giao Dịch VNPAY (UC16.1, UC16.2, UC16.3)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Xây dựng bảng đối soát tài chính và công cụ xuất báo cáo Excel cho Admin.

**Files:**
- Create: `web-ui/src/pages/admin/AdminBilling.tsx`
- Modify: `web-ui/src/layouts/AdminLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `AdminBilling.tsx`:
  - 4 thẻ KPI tài chính: Tổng doanh thu, Doanh thu tháng này, Giao dịch thành công, Tỷ lệ chuyển đổi Free -> VIP.
  - Bảng tra cứu đối soát giao dịch VNPAY: Mã giao dịch, Học viên, Gói cước, Số tiền, Cổng thanh toán, Thời gian, Trạng thái (SUCCESS/PENDING/FAILED).
  - Modal quản trị Bảng giá gói cước VIP (`subscription_plans`): Thêm / sửa giá gói, thời hạn ngày, mô tả đặc quyền.
  - Nút & Modal "Xuất báo cáo tài chính": Chọn khoảng thời gian, xem trước bảng dữ liệu và nút tải file Excel `.xlsx` / PDF.
- [ ] **Step 2:** Thêm menu "Tài chính & Gói cước" trong `AdminLayout.tsx`.
- [ ] **Step 3:** Đăng ký route `/admin/billing` trong `App.tsx`.

---

### Task 11: Triển khai Cấu Hình Hệ Thống, Quota AI & Phân Quyền RBAC (UC15.2, UC15.3)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Hoàn thiện trang cấu hình vận hành hệ thống, hạn mức gọi AI Gemini và ma trận quyền hạn.

**Files:**
- Create: `web-ui/src/pages/admin/SystemSettings.tsx`
- Modify: `web-ui/src/layouts/AdminLayout.tsx`
- Modify: `web-ui/src/App.tsx`

- [ ] **Step 1:** Xây dựng `SystemSettings.tsx`:
  - Tab 1: Cấu hình Quota Gemini AI: Thanh trượt/ô nhập thiết lập số lượt chấm Writing/Speaking mỗi ngày/tuần cho Free User vs VIP User, trạng thái kết nối Gemini API (Status: Connected, Latency: 320ms, Tokens used).
  - Tab 2: Ma trận phân quyền RBAC (Role-Based Access Control): Bảng ma trận Roles (Admin, Teacher, Moderator, Student) x Danh sách Permissions (Quản lý đề thi, Xóa đề thi, Khóa user, Xem audit log, Cấu hình giá) với các checkbox bật/tắt quyền trực quan.
  - Tab 3: Cài đặt chung hệ thống (Tên nền tảng, Email gửi thông báo, Bảo trì hệ thống).
- [ ] **Step 2:** Cập nhật liên kết `/admin/settings` trong `AdminLayout.tsx`.
- [ ] **Step 3:** Đăng ký route `/admin/settings` trong `App.tsx`.

---

### Task 12: Triển khai Modal Import Đề Thi Thông Minh & Nâng Cấp Tracking Học Viên (UC14.4, A_Tracking)
> **Kích hoạt:** `agent-skills:frontend-ui-engineering`  
> Hoàn thiện nghiệp vụ Import đề thi từ Excel/JSON và xem chi tiết tiến trình cá nhân của học viên.

**Files:**
- Create: `web-ui/src/pages/admin/ExamImportModal.tsx`
- Create: `web-ui/src/pages/admin/UserDetailModal.tsx`
- Modify: `web-ui/src/pages/admin/ExamManagement.tsx`
- Modify: `web-ui/src/pages/admin/UserManagement.tsx`

- [ ] **Step 1:** Xây dựng `ExamImportModal.tsx`:
  - Khu vực kéo thả tệp tin `.json` / `.xlsx` kèm nút tải file template mẫu.
  - Trình duyệt tệp giả lập hiển thị cấu trúc parse được: Tên đề, Kỹ năng, Số lượng Sections, Số lượng câu hỏi kèm bộ kiểm tra hợp lệ (đủ đáp án đúng, có audio URL).
  - Nút nạp vào hệ thống với toast thông báo kết quả.
- [ ] **Step 2:** Tích hợp nút "Import từ File" trên `ExamManagement.tsx`.
- [ ] **Step 3:** Xây dựng `UserDetailModal.tsx` trên `UserManagement.tsx`: Hiển thị chi tiết một học viên (Lịch sử làm bài thi, Điểm trung bình, Số phút học tập, Lịch sử các thiết bị đăng nhập, Nút khóa/mở khóa tài khoản).

---

### Task 13: Đánh Giá Toàn Diện, Kiểm Thử Build & Nghiệm Thu Prototype
> **Kích hoạt:** `verification-before-completion`, `agent-skills:frontend-ui-engineering`  
> Đảm bảo toàn bộ 27 màn hình được kết nối, không có lỗi TypeScript, giao diện chuẩn đẹp và sẵn sàng bàn giao.

**Files:**
- Inspect: Tất cả các file trong `web-ui/src`

- [ ] **Step 1:** Chạy lệnh `npm run build` trong `web-ui` để xác nhận 0 lỗi cú pháp và 0 lỗi TypeScript.
- [ ] **Step 2:** Khởi chạy `npm run dev` hoặc kiểm tra preview để đảm bảo điều hướng hoạt động trơn tru từ thanh Figma Prototype Bar.
- [ ] **Step 3:** Đối soát toàn bộ các tiêu chí nghiệm thu AC-01 đến AC-13 trong Spec.
- [ ] **Step 4:** Cập nhật tài liệu hướng dẫn và báo cáo kết quả cho người dùng.

---
*Kế hoạch đã sẵn sàng để thực thi từng task theo phương pháp TDD & Subagent/Inline Execution.*
