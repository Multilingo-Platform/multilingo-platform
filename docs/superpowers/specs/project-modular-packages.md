# ĐẶC TẢ THIẾT KẾ CẤU TRÚC PHÂN HỆ MODULAR MONOLITH (MODULAR PACKAGES SPECIFICATION)

**Dự án:** Nền tảng Thi thử và Đánh giá Năng lực Ngoại ngữ Multilingo (Multilingo Platform)  
**Phân hệ:** Backend Architecture (`backend`)  
**Tác giả:** Superpowers Architecture Team  
**Ngày tạo:** 25/09/2026 | **Trạng thái:** DRAFT FOR REVIEW  
**Tài liệu tham chiếu:** 
- Quy tắc cốt lõi: [`GEMINI.md`](file:///f:/Working/JavaBackend/multilingo-platform/GEMINI.md)
- Phân công nhiệm vụ: [`docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)
- Cơ sở dữ liệu: [`docs/DATABASE_SPECIFICATION.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/DATABASE_SPECIFICATION.md)
- Kiến trúc nền tảng: [`docs/superpowers/specs/project-base-architecture.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-base-architecture.md)

---

## 1. MỤC TIÊU & TỔNG QUAN

Tài liệu này xác lập cấu trúc khung (scaffolding) phân rã mã nguồn Backend Spring Boot thành **5 Phân hệ nghiệp vụ độc lập (Bounded Contexts)** tương ứng với 5 thành viên nhóm phát triển. Mục tiêu:
1. **Phân định rõ ranh giới trách nhiệm (Separation of Concerns):** Mỗi thành viên chỉ làm việc trong package module của mình, giảm thiểu tối đa xung đột mã nguồn (merge conflicts) khi làm việc song song qua Git.
2. **Đồng nhất cấu trúc nội bộ (Layered within Feature Module):** Mọi module đều có cấu trúc phân tầng (`controller`, `dto`, `entity`, `repository`, `service`) đồng bộ.
3. **Tuân thủ triệt để Base Architecture:** Mọi Entity trong các module kế thừa `BaseEntity (id Integer, createdAt, updatedAt)`, mọi Controller trả về `ResponseEntity<ApiResponse<T>>`, và ngoại lệ nghiệp vụ được ném qua `AppException(ErrorCode.XYZ)`.
4. **Loại bỏ mã nguồn thử nghiệm tạm thời:** Xóa bỏ hoàn toàn các file thử nghiệm trước đây (`ExamPart`, `ExamPartRepository`, `ExamPartDto`, `ExamTestController`) do chỉ là dữ liệu test kết nối ban đầu, không thuộc nghiệp vụ chính thức. Dọn dẹp sạch các package cũ ở tầng root.

---

## 2. KIẾN TRÚC TỔNG THỂ CÁC GÓI (PACKAGE STRUCTURE)

```text
com.multilingo.backend
├── BackendApplication.java
│
├── common/                                 # HẠ TẦNG DÙNG CHUNG (CORE INFRASTRUCTURE)
│   ├── base/                              # BaseEntity
│   ├── config/                            # JpaAuditingConfig, SecurityConfig, WebMvcConfig
│   ├── dto/                               # ApiResponse<T>, PageResponse<T>
│   └── exception/                         # ErrorCode, AppException, GlobalExceptionHandler
│
└── modules/                                # 5 PHÂN HỆ NGHIỆP VỤ ĐỘC LẬP (BOUNDED CONTEXTS)
    ├── auth/                              # 👤 TV1: Xác thực, Phân quyền RBAC, Gói VIP & Thanh toán VNPAY
    ├── exam/                              # 👤 TV2: Onboarding Mục tiêu, Kho Đề thi & CMS Đề thi Đa cấp
    ├── testing/                           # 👤 TV3: Không gian Thi thử, Luyện tập & Trợ lý AI (Gemini Flash)
    ├── analytics/                         # 👤 TV4: Giám sát Hệ thống, Tracking Hành vi & Kiểm toán Admin
    └── vocab/                             # 👤 TV5: Từ điển Ngữ cảnh, Sổ Flashcard SRS, Dashboard & Thông báo
```

---

## 3. CHI TIẾT CẤU TRÚC 5 MODULES NGHIỆP VỤ

Mỗi module sẽ chứa 5 tầng nội bộ chuẩn:
- `controller/`: REST Controllers cung cấp API cho Client.
- `dto/request/`: Các Request DTO có validation (`@NotBlank`, `@NotNull`,...).
- `dto/response/`: Các Response payload DTO trả về dữ liệu.
- `entity/`: Các JPA Entities kế thừa `com.multilingo.backend.common.base.BaseEntity`.
- `repository/`: Các Spring Data JPA Repositories kế thừa `JpaRepository<T, Integer>`.
- `service/` & `service/impl/`: Business logic interfaces & implementation.
- `package-info.java`: Khai báo JavaDoc phân định trách nhiệm thành viên và mô tả tổng quan.
- `README.md`: Hướng dẫn nghiệp vụ, bảng CSDL, danh mục Use Case cụ thể.

---

### 3.1. Module `modules.auth` (Thành viên 1)
- **Thành viên phụ trách:** Thành viên 1
- **Phạm vi nghiệp vụ:**
  - Xác thực & Tài khoản: Đăng nhập (`UC01`), Quên mật khẩu (`UC01.1`), Đăng xuất (`UC02`), Đăng ký (`UC03`).
  - Hồ sơ cá nhân: Xem hồ sơ (`UC04`), Đổi mật khẩu (`UC04.1`), Cập nhật avatar & thông tin (`UC04.2`).
  - Gói cước & Thanh toán: Mua gói VIP & Webhook IPN VNPAY (`UC06`).
  - Quản trị RBAC & Bảng giá: Gán Role/Permission (`UC15.2`), Thiết lập giá gói (`UC16.1`).
- **Các bảng CSDL sở hữu:**
  - `users`, `roles`, `permissions`, `role_permissions`, `refresh_tokens`, `subscription_plans`, `transactions`.
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.auth
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/
  ├── repository/
  ├── service/
  │   └── impl/
  ├── package-info.java
  └── README.md
  ```

---

### 3.2. Module `modules.exam` (Thành viên 2)
- **Thành viên phụ trách:** Thành viên 2
- **Phạm vi nghiệp vụ:**
  - Onboarding: Thiết lập mục tiêu học tập ban đầu (`UC05`).
  - Thư viện đề thi: Tra cứu & lọc kho đề thi (`UC07`), Gợi ý đề thi cá nhân hóa (`UC07.1`).
  - CMS Đề thi đa cấp: Thêm mới đề thi (`UC14.1`), Chỉnh sửa đề thi (`UC14.2`), Xóa đề thi (`UC14.3`), Import đề thi từ file JSON/Excel (`UC14.4`).
- **Các bảng CSDL sở hữu:**
  - `exams`, `exam_sections`, `exam_parts`.
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.exam
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/
  ├── repository/
  ├── service/
  │   └── impl/
  ├── package-info.java
  └── README.md
  ```

---

### 3.3. Module `modules.testing` (Thành viên 3)
- **Thành viên phụ trách:** Thành viên 3
- **Phạm vi nghiệp vụ:**
  - Không gian làm bài: Thi thử tính giờ Full Exam / Luyện tập từng kỹ năng (`UC08`), Đếm ngược & Tự động thu bài (`UC08.5`).
  - Trợ lý AI (Gemini 2.5 Flash): Gợi ý dàn ý & từ vựng Writing Hints (`UC08.4`).
  - Chấm điểm: Chấm trắc nghiệm tự động (`UC09`), Chấm bài viết Writing bằng Gemini AI (`UC09.2`).
  - Kết quả & Giải thích: Xem bảng điểm & Lời giải chi tiết (`UC10`), Xem nhận xét AI & Diff-View sửa lỗi (`UC10.2`).
- **Các bảng CSDL sở hữu:**
  - `test_attempts`, `attempt_answers` (chứa `ai_feedback` JSONB).
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.testing
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/
  ├── repository/
  ├── service/
  │   └── impl/
  ├── package-info.java
  └── README.md
  ```

---

### 3.4. Module `modules.analytics` (Thành viên 4)
- **Thành viên phụ trách:** Thành viên 4
- **Phạm vi nghiệp vụ:**
  - Tracking hành vi: Thống kê lượt làm đề & tiến trình học viên (`A_Tracking`).
  - Quản trị Người dùng: Danh sách Users (`UC15`), Khóa/Mở khóa tài khoản vi phạm (`UC15.1`).
  - Quota AI & Kiểm toán: Cấu hình hạn mức Quota AI (`UC15.3`), Nhật ký kiểm toán an ninh `audit_logs` (`UC15.4 / A_Audit`).
  - Báo cáo vận hành: Báo cáo DAU/MAU & Doanh thu tổng quan (`UC16`), Đối soát giao dịch VNPAY (`UC16.2`), Xuất file Excel (`UC16.3`).
- **Các bảng CSDL sở hữu:**
  - `audit_logs`, `login_history`, `user_quotas`.
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.analytics
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/
  ├── repository/
  ├── service/
  │   └── impl/
  ├── package-info.java
  └── README.md
  ```

---

### 3.5. Module `modules.vocab` (Thành viên 5)
- **Thành viên phụ trách:** Thành viên 5
- **Phạm vi nghiệp vụ:**
  - Từ điển ngữ cảnh: Tra cứu từ điển đa ngôn ngữ (`UC11`), Lưu từ vựng kèm ngữ cảnh vào sổ tay (`UC11.1`).
  - Sổ Flashcard SRS: Quản lý sổ từ vựng (`UC12/12.1`), Phiên ôn tập thuật toán lặp lại ngắt quãng SuperMemo SM-2 (`UC12.2`).
  - Dashboard & Gamification: Chuỗi ngày Streak 🔥 và thời lượng học (`UC13`), Biểu đồ Radar năng lực (`UC13.1/13.2`).
  - Thông báo: Nhắc nhở học tập & ôn tập từ vựng (`UC12.3`).
- **Các bảng CSDL sở hữu:**
  - `dictionary_words`, `user_flashcards`, `user_study_stats`, `daily_study_logs`, `notifications`.
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.vocab
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/
  ├── repository/
  ├── service/
  │   └── impl/
  ├── package-info.java
  └── README.md
  ```

---

## 4. KẾ HOẠCH DỌN DẸP & LÀM SẠCH MÃ NGUỒN

1. **Xóa bỏ các file thử nghiệm tạm thời:**
   - Xóa `ExamPart.java`
   - Xóa `ExamPartRepository.java`
   - Xóa `ExamPartDto.java`
   - Xóa `ExamTestController.java`
   - Chuyển `TestController.java` thành `HealthCheckController.java` tại `com.multilingo.backend.common.controller` phục vụ kiểm tra trạng thái hệ thống và test local ban đầu.
2. **Xóa các package cũ rỗng ở tầng root:**
   - Xóa `com.multilingo.backend.entity`
   - Xóa `com.multilingo.backend.repository`
   - Xóa `com.multilingo.backend.dto`
   - Xóa `com.multilingo.backend.controller`
3. **Cấu hình Security & CORS:**
   - Cập nhật [SecurityConfig.java](file:///f:/Working/JavaBackend/multilingo-platform/backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java) chuyển permitAll endpoint sang `/api/test/**` và `/api/health`.

---

## 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- [ ] Tạo đầy đủ 5 modules: `modules.auth`, `modules.exam`, `modules.testing`, `modules.analytics`, `modules.vocab`.
- [ ] Mỗi module có đủ các thư mục con: `controller`, `dto/request`, `dto/response`, `entity`, `repository`, `service/impl`.
- [ ] Mỗi module có 1 file `package-info.java` và 1 file `README.md` mô tả rõ ràng trách nhiệm của thành viên tương ứng.
- [ ] Các lớp liên quan đến `ExamPart` được chuyển sang `modules.exam` không gây lỗi import hay biên dịch.
- [ ] Các package rác ở root level được dọn dẹp sạch sẽ.
- [ ] Lệnh kiểm thử `./mvnw clean test` chạy thành công 100% với toàn bộ unit/integration test pass.
