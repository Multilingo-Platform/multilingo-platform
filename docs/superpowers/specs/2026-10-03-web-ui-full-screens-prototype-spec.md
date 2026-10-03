# Đặc Tả Kỹ Thuật (Spec): Toàn Bộ Giao Diện Thiếu & Hệ Thống Prototype Trực Quan Multilingo

**Dự án:** Nền tảng Thi thử và Đánh giá Ngoại ngữ Multilingo (Multilingo Platform)  
**Ngày lập:** 03/10/2026  
**Tài liệu tham chiếu:** [PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/PHAN_CONG_NHIEM_VU_5_NGUOI.md), [CHUC_NANG_HE_THONG.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/CHUC_NANG_HE_THONG.md), [LUONG_THUC_HIEN.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/LUONG_THUC_HIEN.md), [DATABASE_SCHEMA.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/DATABASE_SCHEMA.md)  
**Kỹ năng kích hoạt:** `acceptance-criteria-and-test-design`, `agent-skills:frontend-ui-engineering`

---

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1 Tác nhân tương tác (Actors / Personas)
1. **Khách vãng lai (Guest):** Khám phá Landing Page, xem bảng giá gói cước VIP, Đăng ký / Đăng nhập tài khoản, Yêu cầu quên & đặt lại mật khẩu.
2. **Học viên (Student - Free & VIP):** Thiết lập Onboarding mục tiêu, tra cứu thư viện đề thi, làm bài thi (Reading, Listening, Writing), nhận điểm và phản hồi AI Diff-View, tra từ điển click-to-translate, lưu & ôn tập Flashcard thuật toán SM-2, nâng cấp gói VIP qua VNPAY, theo dõi Dashboard chuỗi ngày Streak & Radar năng lực.
3. **Quản trị viên & Giáo viên (Admin / Teacher):** Quản lý người dùng, khóa tài khoản vi phạm, theo dõi lịch sử hoạt động (tracking học viên), quản lý ngân hàng đề thi đa cấp (JSONB), Import đề thi từ Excel/JSON, xem nhật ký kiểm toán an ninh (Audit Logs) & Rollback dữ liệu, đối soát giao dịch VNPAY, cấu hình hạn mức Quota Gemini AI và ma trận phân quyền RBAC.

### 1.2 Phạm vi ranh giới (Scope Boundaries)
- **In-Scope:**
  - Hoàn thiện 100% các màn hình còn thiếu trong hệ thống web-ui theo chuẩn thiết kế EdTech hiện đại (Orange/Yellow palette, Flat card, Responsive, WCAG 2.1 AA a11y).
  - Tích hợp **Thanh điều khiển nguyên mẫu Figma (Figma Prototype Navigator Toolbar)** cho phép xem nhanh mọi màn hình, chuyển đổi kích thước khung xem (Desktop 1440px / Laptop 1200px / Tablet 768px / Mobile 390px), và xem bản đồ luồng màn hình (Screen Flow Map).
  - Triển khai mock-data phong phú, tương tác chân thực (chọn đáp án, bấm lật thẻ 3D, mô phỏng quét mã VNPAY QR, tương tác AI Diff-view) để làm "bản vẽ thiết kế sống" (Living Design Blueprint) cho việc phát triển code sau này.
- **Out-of-Scope:**
  - Kết nối trực tiếp vào Spring Boot REST API thực tế (sẽ thực hiện ở các task Backend/Frontend tích hợp tiếp theo).

---

## 2. Bảng Đối Soát Màn Hình & Trạng Thái Hệ Thống

| STT | Tên màn hình | Đường dẫn Route | Module / Thành viên | Trạng thái |
| :---: | :--- | :--- | :---: | :---: |
| 1 | Trang chủ giới thiệu | `/` | Guest / TV1 | Đã có, trau chuốt |
| 2 | Đăng nhập & Đăng ký | `/auth` | Guest / TV1 | Đã có |
| 3 | **Quên & Đặt lại mật khẩu** | `/forgot-password` | Guest / TV1 (`UC01.1`) | **MỚI** |
| 4 | Onboarding mục tiêu | `/onboarding` | Student / TV2 (`UC05`) | Đã có |
| 5 | Bảng điều khiển học viên | `/student/dashboard` | Student / TV5 (`UC13`) | Đã có |
| 6 | Thư viện đề thi & Gợi ý | `/student/library` | Student / TV2 (`UC07/07.1`) | Đã có, trau chuốt |
| 7 | Không gian thi Reading | `/student/exam/:id` | Student / TV3 (`UC08`) | Đã có |
| 8 | **Không gian luyện Listening** | `/student/exam/:id/listening` | Student / TV3 (`UC08`) | **MỚI** |
| 9 | **Không gian luyện Writing + AI** | `/student/exam/:id/writing` | Student / TV3 (`UC08.4`) | **MỚI** |
| 10 | Báo cáo kết quả & Giải thích | `/student/exam/:id/result` | Student / TV3 (`UC10`) | Đã có |
| 11 | **Báo cáo AI Chấm & Diff-View** | Tab trong `/student/exam/:id/result` | Student / TV3 (`UC10.2`) | **MỚI** |
| 12 | Sổ tay Flashcard cá nhân | `/student/flashcards` | Student / TV5 (`UC12`) | Đã có |
| 13 | **Phiên ôn tập Flashcard SM-2** | `/student/flashcards/study` | Student / TV5 (`UC12.2`) | **MỚI** |
| 14 | **Tra cứu Từ điển Đa ngôn ngữ** | `/student/dictionary` | Student / TV5 (`UC11`) | **MỚI** |
| 15 | **Báo cáo Radar & Tiến độ học** | `/student/analytics` | Student / TV5 (`UC13.1/13.2`)| **MỚI** |
| 16 | **Bảng giá VIP & Cổng VNPAY** | `/student/pricing` | Student / TV1 (`UC06`) | **MỚI** |
| 17 | **Biên lai Thanh toán thành công**| `/student/payment-success` | Student / TV1 (`UC06`) | **MỚI** |
| 18 | Hồ sơ cá nhân & Đổi mật khẩu | `/student/settings` | Student / TV1 (`UC04`) | Đã có |
| 19 | Admin Dashboard | `/admin/dashboard` | Admin / TV4 (`UC16`) | Đã có |
| 20 | Quản lý Người dùng & Tracking | `/admin/users` | Admin / TV4 (`UC15/A_Tracking`)| Đã có, trau chuốt |
| 21 | Quản lý Đề thi & CMS JSONB | `/admin/exams` | Admin / TV2 (`UC14.1-14.3`)| Đã có |
| 22 | **Import Đề thi từ Excel/JSON** | `/admin/exams/import` | Admin / TV2 (`UC14.4`) | **MỚI** |
| 23 | **Nhật ký Kiểm toán & Gian lận** | `/admin/audit` | Admin / TV4 (`UC15.4/A_Tracking`)| **MỚI** |
| 24 | **Đối soát Giao dịch & Báo cáo** | `/admin/billing` | Admin / TV4, TV1 (`UC16.1-16.3`)| **MỚI** |
| 25 | **Cấu hình Quota AI & Phân quyền**| `/admin/settings` | Admin / TV4, TV1 (`UC15.2/15.3`)| **MỚI** |
| 26 | **Figma Prototype Navigator Bar**| Floating Component toàn hệ thống | Core Utility | **MỚI** |
| 27 | **Sơ đồ Luồng Màn hình (Flow Map)**| `/prototype-map` | Core Design Blueprint | **MỚI** |

---

## 3. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 3.1 AC-01: Quên & Đặt lại mật khẩu (UC01.1 - `ForgotPassword.tsx`)
```gherkin
Kịch bản: Đặt lại mật khẩu qua luồng OTP 3 bước
Given Người dùng ở màn hình /forgot-password
When Người dùng nhập email "john@example.com" và bấm "Gửi mã xác thực"
Then Hệ thống chuyển sang Bước 2 (Nhập OTP), bắt đầu đếm ngược cooldown 60 giây
When Người dùng nhập mã OTP 6 số hợp lệ
Then Hệ thống chuyển sang Bước 3 (Đặt mật khẩu mới)
When Người dùng nhập mật khẩu mới và xác nhận mật khẩu
Then Hiển thị thanh đo độ mạnh (Password Strength Meter) từ Yếu -> Rất mạnh
When Người dùng bấm "Xác nhận đổi mật khẩu"
Then Hiển thị thông báo thành công và nút chuyển hướng về trang /auth
```

### 3.2 AC-02: Không gian Luyện Listening có Audio Player (UC08 - `ListeningPracticeEngine.tsx`)
```gherkin
Kịch bản: Nghe audio và làm bài thi Listening
Given Học viên mở màn hình /student/exam/:id/listening
Then Hiển thị Audio Player trực quan gồm: Thanh sóng âm (Waveform), Nút Play/Pause, Tua lùi/tiến 5s, Điều chỉnh tốc độ (0.75x, 1.0x, 1.25x, 1.5x)
When Học viên nghe audio và chọn đáp án trắc nghiệm hoặc gõ câu trả lời vào ô trống
Then Trạng thái câu hỏi ở thanh điều hướng bên phải đổi màu sang trạng thái "Đã trả lời"
When Học viên bấm "Nộp bài"
Then Hiển thị modal xác nhận và chuyển hướng sang trang kết quả
```

### 3.3 AC-03: Không gian Luyện Writing & Trợ lý Gemini AI (UC08.4, UC10.2 - `WritingPracticeEngine.tsx`)
```gherkin
Kịch bản: Luyện viết và nhận gợi ý thông minh từ AI
Given Học viên mở màn hình /student/exam/:id/writing
Then Giao diện chia 2 cột: Cột trái chứa đề bài/biểu đồ Task 1 hoặc đề luận Task 2; Cột phải chứa khung soạn thảo văn bản
When Học viên gõ bài viết
Then Bộ đếm từ (Word Count) tự động cập nhật thời gian thực kèm cảnh báo nếu chưa đủ số từ tối thiểu (VD: < 150 từ cho Task 1, < 250 từ cho Task 2)
When Học viên bấm "💡 Gợi ý AI Hints"
Then Drawer bên phải mở ra, hiển thị Dàn ý 3 phần (Mở bài, Thân bài, Kết luận) và danh sách 8-10 từ vựng chuyên sâu band 7.5+
When Học viên bôi đen từ lạ trong đề bài
Then Hiển thị popup tra từ nhanh và nút "+ Lưu vào Flashcard"
```

### 3.4 AC-04: Báo cáo AI Chấm Writing & Diff-View Sửa lỗi (UC10.2 - `ExamResult.tsx`)
```gherkin
Kịch bản: Xem nhận xét và sửa lỗi chi tiết từ Gemini AI
Given Học viên xem kết quả bài thi Writing
Then Hiển thị Band điểm dự kiến và điểm chi tiết theo 4 tiêu chí: Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range
When Học viên xem khung Diff-View
Then Văn bản gốc hiển thị gạch đỏ các từ/câu mắc lỗi ngữ pháp hoặc dùng từ sai
When Học viên click vào từ bị lỗi
Then Hiển thị tooltip giải thích nguyên nhân lỗi và gợi ý câu viết lại mượt mà chuẩn Band 8.0+
```

### 3.5 AC-05: Ôn tập Flashcard SRS SM-2 (UC12.2 - `FlashcardStudySession.tsx`)
```gherkin
Kịch bản: Thực hiện phiên ôn tập từ vựng ngắt quãng
Given Học viên truy cập /student/flashcards/study
Then Hiển thị thẻ từ vựng với mặt trước (Từ tiếng Anh, Phiên âm IPA, nút nghe phát âm)
When Học viên click vào thẻ hoặc bấm phím Space
Then Thẻ xoay 3D lật sang mặt sau hiển thị: Nghĩa tiếng Việt, Từ loại, Câu ví dụ ngữ cảnh thực tế
Then Hiển thị 4 nút đánh giá theo thuật toán SuperMemo SM-2: "Quên (1 ngày)", "Khó (2 ngày)", "Nhớ tốt (4 ngày)", "Rất dễ (7 ngày)"
When Học viên chọn một mức nhớ
Then Hệ thống tự động chuyển sang thẻ tiếp theo và cập nhật thanh tiến trình hoàn thành (VD: 3/15 từ)
```

### 3.6 AC-06: Tra cứu Từ điển Đa ngôn ngữ (UC11 - `DictionaryView.tsx`)
```gherkin
Kịch bản: Tra cứu từ vựng và lưu vào sổ cá nhân
Given Học viên mở màn hình /student/dictionary
When Học viên gõ từ vựng vào thanh tìm kiếm (VD: "Ubiquitous")
Then Hiển thị thông tin chi tiết: Phiên âm IPA, Nút phát âm US/UK, Định nghĩa song ngữ, Cụm Collocations thông dụng, Ví dụ ngữ cảnh
When Học viên bấm nút "+ Lưu vào Flashcard"
Then Mở modal cho phép chọn sổ tay lưu trữ hoặc chỉnh sửa nghĩa ngữ cảnh theo ý muốn
```

### 3.7 AC-07: Phân tích Năng lực Radar Chart & Đề xuất (UC13.1, UC13.2 - `AnalyticsProgress.tsx`)
```gherkin
Kịch bản: Xem báo cáo năng lực và lộ trình cá nhân hóa
Given Học viên vào trang /student/analytics
Then Hiển thị Biểu đồ Radar (Spider Chart) trực quan thể hiện 6 chỉ số năng lực
Then Hiển thị Lịch học tập Heatmap (dạng GitHub commit map) ghi nhận các ngày hoạt động
Then Hiển thị thẻ "Phân tích vùng trũng": Chỉ ra dạng bài điểm thấp nhất (VD: True/False/Not Given) kèm danh sách 3 bộ đề đề xuất luyện ngay
```

### 3.8 AC-08: Bảng giá VIP & Cổng Thanh toán VNPAY (UC06 - `PricingCheckout.tsx`)
```gherkin
Kịch bản: Mua gói cước VIP và mô phỏng thanh toán VNPAY
Given Học viên vào trang /student/pricing
Then Hiển thị bảng so sánh gói cước: Miễn phí (Free) vs Pro 6 tháng vs VIP 1 năm
When Học viên chọn gói "VIP 1 năm" và bấm "Nâng cấp ngay"
Then Mở giao diện Cổng thanh toán VNPAY trực quan (Mã QR VietQR động, Mã đơn hàng, Đồng hồ đếm ngược giao dịch 15:00)
When Học viên bấm nút giả lập "Xác nhận Thanh toán Thành công"
Then Chuyển hướng sang màn hình /student/payment-success hiển thị biên lai giao dịch và trạng thái tài khoản nâng lên PREMIUM
```

### 3.9 AC-09: Quản trị Kiểm toán, Rollback & Chống gian lận (UC15.4, A_Tracking - `AuditLogs.tsx`)
```gherkin
Kịch bản: Admin tra cứu nhật ký kiểm toán và xử lý gian lận
Given Quản trị viên mở trang /admin/audit
Then Hiển thị bảng Audit Logs với bộ lọc theo loại hành động (DELETE_EXAM, UPDATE_USER, SYSTEM_CONFIG)
When Admin bấm "Xem chi tiết" một log xóa đề
Then Modal hiển thị snapshot JSON dữ liệu cũ trước khi xóa kèm nút "Khôi phục dữ liệu (Rollback)"
When Chuyển sang tab "Cảnh báo gian lận (Fraud Detection)"
Then Hiển thị danh sách tài khoản đăng nhập đồng thời 2 địa chỉ IP khác nhau kèm nút "Buộc đăng xuất từ xa (Revoke Session)"
```

### 3.10 AC-10: Quản trị Giao dịch & Báo cáo VNPAY (UC16.1, UC16.2, UC16.3 - `AdminBilling.tsx`)
```gherkin
Kịch bản: Đối soát giao dịch tài chính và xuất báo cáo
Given Quản trị viên mở trang /admin/billing
Then Hiển thị 4 thẻ KPI doanh thu: Doanh thu tháng, Số đơn VIP mới, Tỷ lệ chuyển đổi, Doanh thu TB/đơn
Then Hiển thị bảng danh sách giao dịch VNPAY kèm trạng thái (Thành công, Đang xử lý, Thất bại)
When Admin bấm "Xuất báo cáo tài chính"
Then Mở modal xem trước bản in / export Excel và cho phép tải xuống
```

### 3.11 AC-11: Cấu hình Hệ thống, Quota AI & Phân quyền RBAC (UC15.2, UC15.3 - `SystemSettings.tsx`)
```gherkin
Kịch bản: Cấu hình hạn mức AI và phân quyền người dùng
Given Quản trị viên mở trang /admin/settings
Then Hiển thị tab "Cấu hình Quota AI": Cho phép điều chỉnh số lượt chấm Writing/Speaking mỗi ngày cho Free và VIP
Then Hiển thị tab "Ma trận phân quyền RBAC": Bảng ma trận Role x Permission cho phép bật/tắt các quyền chi tiết
Then Hiển thị tab "Quản lý Bảng giá VIP": Cho phép thêm/sửa gói cước
```

### 3.12 AC-12: Import Đề thi từ Excel / JSON (UC14.4 - `ExamImportModal.tsx`)
```gherkin
Kịch bản: Nạp cấu trúc đề thi đa cấp tự động
Given Quản trị viên tại trang /admin/exams bấm "Import từ File"
Then Hiển thị khu vực kéo thả tệp tin (.xlsx hoặc .json) kèm file mẫu tải về
When Admin tải lên file mẫu JSON chuẩn
Then Hệ thống tự động parse và hiển thị cây câu hỏi (Sections -> Parts -> Questions) kèm kết quả kiểm tra tính hợp lệ
When Bấm "Xác nhận Import"
Then Đề thi được thêm vào danh sách và lưu thành công
```

### 3.13 AC-13: Figma Prototype Navigator & Screen Flow Map (Core Prototype Mode)
```gherkin
Kịch bản: Người dùng xem và duyệt hệ thống như xem Figma
Given Người dùng ở bất kỳ trang nào trong ứng dụng web-ui
Then Thanh công cụ "Figma Prototype Bar" xuất hiện ở góc dưới/trên màn hình
When Người dùng mở dropdown chọn màn hình
Then Danh sách 27 màn hình được phân nhóm rõ ràng (Khách, Học viên, Admin) kèm mã Use Case (UCxx)
When Chọn 1 màn hình bất kỳ
Then Trình duyệt chuyển ngay tới màn hình đó mà không bị chặn auth
When Chọn kích thước thiết bị (Laptop, Tablet, Mobile)
Then Khung giao diện co dãn mượt mà theo kích thước khung chuẩn
When Bấm "Sơ đồ luồng (Flow Map)"
Then Mở trang /prototype-map hiển thị toàn cảnh hệ sinh thái màn hình kèm liên kết bấm trực tiếp
```

---

## 4. Ma Trận Kịch Bản Kiểm Thử (Comprehensive Test Matrix - 6 Khía Cạnh)

| Nhóm kiểm thử | Kịch bản chi tiết |
| :--- | :--- |
| **1. Happy Path** | Làm bài thi, nộp bài, xem điểm, ôn flashcard 4 mức, thanh toán VNPAY giả lập thành công, điều chỉnh quota AI, import file JSON hợp lệ. |
| **2. Negative Cases** | Quên mật khẩu nhập sai định dạng email; Đặt lại mật khẩu 2 lần không khớp; Nhập OTP sai; Import file đề thi sai định dạng hoặc thiếu đáp án. |
| **3. Boundary (BVA)** | Mật khẩu mới dưới 6 ký tự hoặc trên 64 ký tự; Bài viết Writing dưới số lượng từ tối thiểu; Quota AI đặt về 0 hoặc số âm. |
| **4. Edge Cases** | Tua audio listening khi đang pause; Lật flashcard nhanh liên tục; Bôi đen từ có ký tự đặc biệt/dấu chấm câu; Chuyển đổi qua lại giữa các viewport Figma mà không bị vỡ layout. |
| **5. Security** | Ẩn mật khẩu khi nhập liệu; Chống hiển thị dữ liệu nhạy cảm trong Audit snapshot; Xác thực token giả lập khi truy cập luồng Admin. |
| **6. UI/UX & A11y** | Gam màu đồng bộ (Amber/Yellow/Slate); Loading spinners khi chuyển tab; Hỗ trợ phím tắt (Space để lật thẻ flashcard); Chuẩn tương phản màu sắc. |

---

## 5. Bảng Test Cases Chuẩn Hóa (Standard Test Cases)

| Mã TC | Phân loại | Mô tả kịch bản | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_AUTH_FORGOT_01** | Happy Path | Quên mật khẩu & gửi OTP thành công | Đang ở `/forgot-password` | 1. Nhập email hợp lệ<br>2. Bấm "Gửi mã xác thực" | `john@example.com` | Chuyển sang Bước 2, đếm ngược 60s, hiện thông báo gửi OTP thành công. |
| **TC_AUTH_FORGOT_02** | Negative | Nhập OTP sai định dạng | Đang ở Bước 2 | 1. Nhập OTP ít hơn 6 số<br>2. Bấm "Xác thực" | `123` | Báo lỗi "Vui lòng nhập đủ 6 chữ số OTP". Nút submit bị disabled. |
| **TC_EXAM_LISTEN_01** | Happy Path | Tương tác Audio Player & chọn đáp án | Đang ở `/student/exam/:id/listening` | 1. Bấm Play audio<br>2. Tua +5s<br>3. Chọn đáp án câu 1 | Đáp án `B` | Audio chạy sóng âm, câu 1 chuyển trạng thái sang đã làm trên palette. |
| **TC_EXAM_WRITE_01** | Happy Path | Mở AI Hints & đếm từ | Đang ở `/student/exam/:id/writing` | 1. Gõ 100 từ vào editor<br>2. Bấm nút "💡 Gợi ý AI Hints" | Văn bản luận mẫu | Bộ đếm từ hiển thị 100 từ; Sidebar mở ra hiển thị dàn ý 3 phần & 10 từ vựng. |
| **TC_EXAM_RESULT_01** | Happy Path | Xem Diff-View AI sửa lỗi | Đang ở trang Result tab Writing | 1. Bấm vào câu bị gạch đỏ | Đoạn văn có lỗi | Tooltip hiện phân tích ngữ pháp & đề xuất câu sửa lại band 8.0+. |
| **TC_FLASH_SM2_01** | Happy Path | Lật thẻ 3D & chấm nhớ tốt | Đang ở `/student/flashcards/study` | 1. Click thẻ lật mặt sau<br>2. Bấm "Nhớ tốt (4 ngày)" | Thẻ từ "Ubiquitous" | Thẻ lật mượt mà, chuyển sang thẻ tiếp theo, tăng số từ đã ôn 1 đơn vị. |
| **TC_PAY_VNPAY_01** | Happy Path | Quét mã VNPAY QR & Hoàn tất | Đang ở `/student/pricing` | 1. Chọn gói 1 năm<br>2. Quét QR giả lập<br>3. Bấm xác nhận | Gói VIP 1.188.000đ | Chuyển sang `/student/payment-success` với biên lai đầy đủ. |
| **TC_ADMIN_AUDIT_01** | Happy Path | Xem snapshot JSON & Rollback | Đang ở `/admin/audit` | 1. Tìm log `DELETE_EXAM`<br>2. Bấm "Xem chi tiết"<br>3. Bấm "Rollback" | Log ID `#1042` | Modal hiển thị cây JSON cũ, thông báo "Khôi phục dữ liệu thành công". |
| **TC_ADMIN_IMPORT_01**| Happy Path | Import file đề thi JSON | Đang ở modal Import | 1. Chọn file json mẫu<br>2. Bấm "Kiểm tra"<br>3. Bấm "Import" | File JSON chuẩn | Hiển thị preview 40 câu hỏi, validate 100% hợp lệ, thêm vào DB. |
| **TC_FIGMA_BAR_01** | UI/UX | Chuyển đổi nhanh qua thanh prototype | Đang ở bất kỳ màn hình nào | 1. Mở Figma Bar<br>2. Chọn màn hình bất kỳ<br>3. Chọn mobile 390px | Chọn `/admin/billing` | Trình duyệt nhảy ngay đến trang đích và co vào khung mobile có viền mô phỏng. |

---
*Tài liệu đặc tả đã sẵn sàng chuyển giao cho Implementation Plan (`writing-plans`).*
