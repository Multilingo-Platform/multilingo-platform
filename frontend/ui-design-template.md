# Tài Liệu Đặc Tả & Hướng Dẫn Template Giao Diện: Multilingo Web-UI

Tài liệu này ghi nhớ toàn bộ cấu trúc, phong cách thiết kế, hệ thống mã nguồn, quy chuẩn CSS và hành vi tương tác của dự án **`web-ui`** ([d:\Project\University\multilingo-platform\web-ui](file:///d:/Project/University/multilingo-platform/web-ui)). Tài liệu đóng vai trò làm mẫu chuẩn (template reference) để tái sử dụng, chuẩn hóa hoặc di dời sang các module giao diện khác của dự án Multilingo Platform.

---

## 1. Công nghệ & Thư viện Cốt lõi (Tech Stack)

| Thành phần | Phiên bản / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **Core Framework** | React 19 (`^19.2.8`) + React DOM (`^19.2.8`) | Nền tảng xây dựng UI Component |
| **Bundler & Dev Server**| Vite 8 (`^8.3.0`) + `@vitejs/plugin-react` (`^6.1.1`) | Tốc độ dev server cực nhanh, HMR tức thì |
| **Ngôn ngữ** | TypeScript (`~6.0.2`) | Type safety, quản lý model câu hỏi và layout |
| **Định tuyến (Routing)** | `react-router-dom` (`^7.18.3`) | Nested routes, layouts phân quyền (Public/Student/Admin) |
| **Biểu tượng (Icons)** | `lucide-react` (`^1.45.0`) | Icon vector sắc nét, đồng bộ cho toàn bộ hệ thống |
| **Đa ngôn ngữ (i18n)** | `i18next` (`^26.4.2`) + `react-i18next` (`^17.0.13`) | Chuyển đổi ngôn ngữ Tiếng Việt (vi) / Tiếng Anh (en) |
| **Linter** | `oxlint` (`^1.81.0`) | Linter siêu tốc trên nền Rust Oxc |
| **CSS Strategy** | Pure Vanilla CSS Tokens & Utility Classes | Linh hoạt, không phụ thuộc Tailwind, hiệu năng cao |

---

## 2. Hệ Thống Thiết Kế (Design System Tokens)

Được định nghĩa tại [index.css](file:///d:/Project/University/multilingo-platform/web-ui/src/index.css) và [App.css](file:///d:/Project/University/multilingo-platform/web-ui/src/App.css):

### 2.1 Bảng màu (Color Palette - Practical EdTech Theme)
* **Backgrounds:**
  * `--bg-primary: #f9fafb`: Màu nền chính toàn trang (Lighter Gray dịu mắt).
  * `--bg-secondary: #ffffff`: Màu nền trắng của card, modal, header.
  * `--bg-tertiary: #f3f4f6`: Màu xám nhạt (Gray 100) cho sidebar, khung giải thích, panel phụ.
* **Brand / Primary (Màu Cam Hổ Phách Sang Trọng):**
  * `--primary: #d97706` (Amber 600 - Muted).
  * `--primary-hover: #b45309` (Amber 700).
  * `--primary-light: #fffbeb` (Amber 50 - dùng cho background highlight, badges, active tabs).
* **Accent & Feedback Colors:**
  * `--accent: #ca8a04` (Yellow 600 - điểm nhấn avatar, streak).
  * `--success: #10b981` (Xanh lục - câu đúng, trạng thái thành công).
  * `--danger: #ef4444` (Đỏ - câu sai, cảnh báo gian lận, nút xóa/force logout).
  * `--warning: #f59e0b` (Cam vàng - cảnh báo, mức độ ôn tập).
* **Typography & Borders:**
  * `--text-primary: #111827` (Gray 900 - tiêu đề, nội dung chính).
  * `--text-secondary: #4b5563` (Gray 600 - mô tả, metadata, câu hỏi phụ).
  * `--text-muted: #9ca3af` (Gray 400 - placeholder, thời gian phụ).
  * `--border-light: #e5e7eb` (Gray 200 - đường viền thẻ card, divider).
  * `--border-dark: #d1d5db` (Gray 300 - viền ô input, viền hovered).
* **Bóng đổ & Bo góc:**
  * `--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`
  * `--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
  * `--shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`
  * Bo góc: `--radius-sm: 0.25rem` (4px), `--radius-md: 0.5rem` (8px), `--radius-lg: 0.75rem` (12px), `--radius-xl: 1rem` (16px).

### 2.2 Các Class Thành phần Dùng chung (Reusable Classes)
* `.ed-card`: Khung card bo góc `--radius-lg`, viền mỏng, có hiệu ứng hover nổi bóng nhẹ và chuyển màu viền.
* `.btn`: Nút bấm tiêu chuẩn với các biến thể:
  * `.btn-primary`: Nền cam `--primary`, chữ trắng, hover đổi màu `--primary-hover`.
  * `.btn-outline`: Nền trong suốt, viền viền xám, hover nền `--bg-tertiary`.
  * `.btn-light`: Nền cam nhạt `--primary-light`, chữ cam `--primary`.
* `.badge`: Nhãn trạng thái nhỏ gọn:
  * `.badge-gray`: Nền xám nhạt viền nhẹ.
  * `.badge-orange`: Nền cam nhạt chữ cam.
  * `.badge-green`: Nền xanh lá nhạt chữ xanh lá.
* `.input-field`: Ô nhập liệu có bo góc `--radius-md`, focus có ring màu `--primary-light` và viền `--primary`.
* `.slide-up`: Hiệu ứng chuyển động mượt mà khi load page hoặc mở modal (dịch chuyển `translateY(10px) -> 0` và `opacity 0 -> 1`).

---

## 3. Cấu Trúc Layouts & Định Tuyến (Routing Architecture)

Hệ thống định tuyến tại [App.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/App.tsx) được phân tách thành 3 Layout chính:

```
App.tsx
├── PublicLayout (Dành cho khách chưa đăng nhập)
│   ├── /                 -> LandingPage
│   └── /auth             -> AuthPage (Login/Register toggle)
│
├── Standalone Pages (Trải nghiệm toàn màn hình)
│   ├── /onboarding       -> OnboardingPage (Cá nhân hóa mục tiêu học tập)
│   └── /student/exam/:id -> MockTestEngine (Phòng thi thử Split-pane & Tra từ)
│
├── UserLayout (Dành cho Học viên đã đăng nhập)
│   ├── /student/dashboard    -> StudentDashboard (Thống kê, lịch sử, radar chart)
│   ├── /student/library      -> ExamLibrary (Thư viện đề thi, bộ lọc đa cấp)
│   ├── /student/flashcards   -> Flashcards (Học từ vựng 3D Flip Card SRS)
│   ├── /student/exam/:id/result -> ExamResult (Báo cáo điểm số, AI feedback chi tiết)
│   └── /student/settings     -> UserSettings (Tabs: Hồ sơ, mục tiêu, i18n, thông báo)
│
└── AdminLayout (Dành cho Quản trị viên - Sidebar Đen #111827)
    ├── /admin/dashboard  -> AdminDashboard (Số liệu học viên, đề thi, cảnh báo gian lận)
    ├── /admin/users      -> UserManagement (Quản lý thiết bị session, Force Logout)
    └── /admin/exams      -> ExamManagement + ExamBuilder (Visual JSONB Exam Creator)
```

---

## 4. Chi Tiết Từng Màn Hình & Trải Nghiệm Người Dùng

### 4.1 Nhóm Giao diện Công khai (Public & Onboarding)

#### 1. [PublicLayout.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/layouts/PublicLayout.tsx)
* **Header dính (Sticky Top Bar):** Chiều cao `70px`, nền trắng có đổ bóng nhẹ.
* **Bộ chọn ngôn ngữ (Language Switcher):** Icon `Globe`, dropdown tự đóng khi click bên ngoài (`clickOutside`), hỗ trợ chuyển tức thì giữa Tiếng Việt và English qua i18next.
* **Footer:** 3 cột chuẩn (Giới thiệu Multilingo, Sản phẩm luyện thi, Hỗ trợ & Hướng dẫn).

#### 2. [LandingPage.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/LandingPage.tsx)
* **Hero Section:** Tiêu đề lớn 3.5rem với 2 tông màu (Đen & Cam), nút kêu gọi hành động (CTA) "Bắt đầu học miễn phí" kèm mũi tên chuyển trang sang `/auth`.
* **Feature Grid:** 3 thẻ tính năng nổi bật (Chấm điểm AI, Ngân hàng đề thi đa dạng, Spaced Repetition SRS) với icon `CheckCircle`.

#### 3. [AuthPage.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/AuthPage.tsx)
* **Cấu trúc 2 cột đối xứng (Split Card 1000px):**
  * Cột trái màu cam thương hiệu: Tuyên ngôn giá trị và lợi ích học tập với AI.
  * Cột phải màu trắng: Form tương tác chuyển đổi mượt mà giữa **Đăng nhập** và **Đăng ký** mà không reload trang.
* **Đăng nhập bằng mạng xã hội:** Nút đăng nhập Google với logo SVG vector chuẩn màu chính hãng.

#### 4. [OnboardingPage.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/OnboardingPage.tsx)
* Trắc nghiệm chọn nhanh thiết lập cá nhân:
  1. Ngôn ngữ mẹ đẻ (Tiếng Việt / Tiếng Anh).
  2. Ngôn ngữ & Chứng chỉ muốn luyện thi (Tiếng Anh IELTS/TOEIC hoặc Tiếng Việt VSTEP).
* Nút card tương tác chọn đổi trạng thái active có viền cam 2px và nền cam nhạt.

---

### 4.2 Nhóm Giao diện Học viên (Student Portal)

#### 5. [UserLayout.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/layouts/UserLayout.tsx)
* Navigation bar có highlight link đang active (`NavLink`).
* **Huy hiệu Chuỗi ngày học (Streak Badge):** Icon ngọn lửa `Flame` màu cam nổi bật ("5 ngày").
* **Menu người dùng (Profile Dropdown):** Avatar hình tròn chữ cái đầu, click mở dropdown Hồ sơ & Cài đặt (`/student/settings`) và Đăng xuất.

#### 6. [Dashboard.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/Dashboard.tsx)
* **3 Thẻ thống kê nhanh:**
  * Thời lượng học tuần (kèm so sánh % tăng trưởng tuần trước).
  * Số thẻ từ vựng cần ôn tập hôm nay (kèm nút "Ôn tập ngay").
  * Mục tiêu hiện tại (thanh tiến độ hoàn thành 60% lộ trình mục tiêu IELTS 7.0).
* **Bảng lịch sử thi gần đây:** Hiển thị điểm số, ngày làm và trạng thái nhận xét từ AI ("Đã nhận xét" / "Chờ chấm").
* **Radar Chart Placeholder:** Khung hiển thị biểu đồ mạng nhện kỹ năng mạnh/yếu.

#### 7. [ExamLibrary.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/ExamLibrary.tsx)
* **Thanh tìm kiếm & Bộ lọc (Filter Sidebar):** Tìm theo tên đề thi, checkbox lọc theo loại chứng chỉ (IELTS, TOEIC, VSTEP).
* **Lưới Đề thi (Exam Cards Grid):** Thẻ bài thi hiển thị loại chứng chỉ làm hình nền mờ nghệ thuật, badge cấp độ (Academic / General / B1), thời lượng, số lượt làm bài và nút "Chi tiết đề thi".

#### 8. [MockTestEngine.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/MockTestEngine.tsx) — *(Thành phần Trọng yếu)*
* **Toàn màn hình (Fixed 100vh):** Không có thanh cuộn trình duyệt ngoài, tạo cảm giác như phần mềm thi thực thụ.
* **Thanh Header trên cùng:**
  * Nút quay lại, tên đề thi.
  * Đồng hồ đếm ngược thời gian (`Clock` 59:45) với badge cam.
  * Nút "Nộp bài" chuyển trạng thái sang chế độ chấm điểm tức thì.
* **Giao diện Chia đôi màn hình (Split-pane):**
  * **Pane Trái (Reading Passage):** Hiển thị văn bản bài đọc, bắt sự kiện bôi đen từ vựng (`onMouseUp` -> `window.getSelection()`).
  * **Popup Tra Từ Tại Chỗ (Dictionary Tooltip):** Khi bôi đen từ (ví dụ *ubiquitous*), popup nổi tại tọa độ con trỏ hiển thị phiên âm IPA, loại từ, giải nghĩa tiếng Việt và nút "+ Lưu Flashcard".
  * **Pane Phải (Questions & Palette):**
    * Dạng câu hỏi True / False / Not Given với radio button tùy chỉnh.
    * Dạng điền từ vào chỗ trống (Fill in the blanks) lồng ô input vào giữa đoạn văn bản.
    * Sau khi nộp bài: Khung thông báo kết quả, viền xanh/đỏ cho câu đúng/sai kèm khung **Giải thích (Explanation)** có icon `Info`.
    * **Bảng câu hỏi (Question Palette - Phong cách Study4):** Lưới 5 cột hiển thị trạng thái từng câu (đã làm, đang làm, đúng xanh, sai đỏ).

#### 9. [ExamResult.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/ExamResult.tsx)
* **Tổng quan điểm số nổi bật:** Card nền cam đậm hiển thị Band Score lớn (6.5), tỷ lệ đúng (32/40 câu) và thời gian hoàn thành.
* **Phân tích kỹ năng Radar:** Đánh giá 4 trục (Ngữ pháp, Từ vựng, Đọc hiểu, Tư duy logic).
* **Nhận xét sâu từ AI (Actionable Insights):** Phân tích rõ Điểm mạnh, Điểm yếu và Khuyến nghị ôn tập chi tiết.
* **Đánh giá tiêu chí Writing/Speaking:** Phân tích điểm thành phần (Lexical Resource, Grammatical Range) kèm gợi ý từ đồng nghĩa nâng band.

#### 10. [Flashcards.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/Flashcards.tsx)
* **Hiệu ứng lật thẻ 3D (3D Flip Animation):** Áp dụng `perspective: 1000px`, `transform-style: preserve-3d`, click để lật mặt sau (`rotateY(180deg)`).
* **Mặt trước:** Từ vựng tiếng Anh, badge loại từ, phiên âm IPA, nút phát âm audio `Volume2`.
* **Mặt sau:** Định nghĩa tiếng Việt, câu ví dụ trích xuất từ chính bài đọc.
* **Điều khiển SRS (Spaced Repetition System):** 3 nút đánh giá cấp độ ghi nhớ:
  * Quên (1 ngày - Màu đỏ `XCircle`).
  * Khó (3 ngày - Màu vàng `RefreshCcw`).
  * Nhớ (7 ngày - Màu xanh `CheckCircle`).

#### 11. [UserSettings.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/student/UserSettings.tsx)
* Tab điều hướng bên trái: Hồ sơ cá nhân, Mục tiêu học tập, Ngôn ngữ & Giao diện, Thông báo.
* Cho phép đổi ngôn ngữ hiển thị và cấu hình bật/tắt gợi ý sửa lỗi AI trong lúc làm bài.

---

### 4.3 Nhóm Giao diện Quản trị (Admin Portal)

#### 12. [AdminLayout.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/layouts/AdminLayout.tsx)
* **Sidebar chuyên biệt Dark Mode (`#111827`):** Phân biệt hoàn toàn với giao diện học viên để tránh nhầm lẫn.
* Điều hướng Admin: Tổng quan, Quản lý người dùng, Quản lý đề thi, Logs hệ thống (Audit), Cài đặt.

#### 13. [AdminDashboard.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/admin/AdminDashboard.tsx)
* 3 Thẻ chỉ số hệ thống: Tổng học viên (12,450), Bộ đề thi (345), Cảnh báo gian lận (12 ca IP bất thường).
* Bảng nhật ký kiểm toán hệ thống (Audit Logs) theo dõi hành động theo thời gian thực (nộp bài, đổi đề, IP lạ).

#### 14. [UserManagement.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/admin/UserManagement.tsx)
* Quản lý phiên đăng nhập và định danh thiết bị (`Chrome / Windows`, `Safari / iOS`).
* Phát hiện nghi vấn chia sẻ tài khoản trái phép (Fraud Risk Badge).
* Hành động quản trị cấp cao: Nút **Force Logout** ngắt kết nối session người dùng ngay lập tức.

#### 15. [ExamManagement.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/admin/ExamManagement.tsx) & [ExamBuilder.tsx](file:///d:/Project/University/multilingo-platform/web-ui/src/pages/admin/ExamBuilder.tsx) — *(Bộ Công Cụ Tạo Đề Thi Trực Quan)*
* **Tự động áp dụng Template Đề Thi:**
  * **IELTS Template:** Tạo sẵn cấu trúc chuẩn gồm 4 Phần Listening (Questions 1-40), 3 Bài đọc Reading (Passages 1-3) và 2 Bài viết Writing (Task 1 & Task 2).
  * **TOEIC Template:** Tạo sẵn cấu trúc chuẩn 7 Part (Part 1 Photos -> Part 7 Reading Comprehension) kèm số lượng lựa chọn đáp án tương ứng (A-C hoặc A-D).
  * **TOEIC Writing & VSTEP:** Thiết lập sẵn câu tự luận và nhóm bài kiểm tra.
* **Hỗ trợ 10 loại câu hỏi phong phú:**
  1. `MULTIPLE_CHOICE`: Trắc nghiệm 1 đáp án.
  2. `MULTIPLE_CHOICE_MULTI`: Trắc nghiệm chọn nhiều đáp án.
  3. `FILL_IN_THE_BLANKS`: Điền từ vào chỗ trống.
  4. `TRUE_FALSE_NOT_GIVEN`: True / False / Not Given.
  5. `YES_NO_NOT_GIVEN`: Yes / No / Not Given.
  6. `MATCHING_HEADINGS`: Nối tiêu đề đoạn văn.
  7. `MATCHING_FEATURES`: Nối đặc điểm / thông tin.
  8. `MAP_LABELING`: Xác định vị trí bản đồ.
  9. `DIAGRAM_LABELING`: Chú thích sơ đồ.
  10. `ESSAY`: Viết tự luận.
* **Xuất dữ liệu chuẩn JSONB:** Cấu trúc dữ liệu đầu ra tương thích hoàn toàn với schema database PostgreSQL / Spring Boot backend (`ExamPart -> QuestionGroup -> Question -> metadata`).

---

## 5. Hướng Dẫn Tái Sử Dụng Giao Diện Làm Mẫu Chuẩn (Template Usage Guide)

### 5.1 Cách di chuyển / tích hợp sang dự án chính (`frontend`)
1. **Sao chép Design Tokens:** Sao chép các biến màu sắc và class tiện ích trong [index.css](file:///d:/Project/University/multilingo-platform/web-ui/src/index.css) và [App.css](file:///d:/Project/University/multilingo-platform/web-ui/src/App.css) sang file CSS toàn cục của ứng dụng chính.
2. **Cài đặt thư viện phụ thuộc:** Đảm bảo cài đặt `lucide-react`, `react-router-dom`, `i18next`, `react-i18next`.
3. **Thay thế Mock Data bằng API calls:**
   * Trong `ExamLibrary.tsx`: Thay mảng `exams` bằng API `GET /api/v1/exams`.
   * Trong `MockTestEngine.tsx`: Thay việc hardcode bài đọc bằng dữ liệu JSONB nhận được từ API `GET /api/v1/exams/{id}/workspace`.
   * Gửi câu trả lời về backend: Gọi API `POST /api/v1/testing/submissions/{id}/submit` hoặc `autosave`.

### 5.2 Lưu ý về TypeScript & Build
* File [tsconfig.app.json](file:///d:/Project/University/multilingo-platform/web-ui/tsconfig.app.json#L20) có cấu hình `"noUnusedLocals": true`.
* Khi chạy lệnh `npm run dev`, Vite chạy trực tiếp trên file TypeScript nên giao diện hoạt động tức thì.
* Trước khi chạy `npm run build`, cần dọn dẹp các unused import (như `import React from 'react'`) để vượt qua bước typecheck `tsc -b`.
