# ĐẶC TẢ THIẾT KẾ CẤU TRÚC PHÂN HỆ MODULAR MONOLITH (MODULAR PACKAGES SPECIFICATION)

**Dự án:** Nền tảng Thi thử và Đánh giá Năng lực Ngoại ngữ Multilingo (Multilingo Platform)  
**Phân hệ:** Backend Architecture (`backend`)  
**Tác giả:** Superpowers Architecture Team  
**Ngày tạo:** 25/09/2026 | **Cập nhật:** 26/09/2026 | **Trạng thái:** APPROVED  
**Tài liệu tham chiếu:** 
- Quy tắc cốt lõi: [`GEMINI.md`](file:///f:/Working/JavaBackend/multilingo-platform/GEMINI.md)
- Phân công nhiệm vụ: [`docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)
- Cơ sở dữ liệu: [`docs/DATABASE_SPECIFICATION.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/DATABASE_SPECIFICATION.md)
- Kiến trúc nền tảng: [`docs/superpowers/specs/project-base-architecture.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-base-architecture.md)
- Entities chi tiết: [`docs/superpowers/specs/project-jpa-entities.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-jpa-entities.md)

---

## 1. MỤC TIÊU & TỔNG QUAN

Tài liệu này xác lập cấu trúc khung (scaffolding) phân rã mã nguồn Backend Spring Boot thành **7 Phân hệ nghiệp vụ độc lập (Bounded Contexts)** theo mô hình Microservices-Ready (Modular Monolith). Mục tiêu:
1. **Phân định rõ ranh giới trách nhiệm (Separation of Concerns):** Mỗi thành viên làm việc trong package module của mình, giảm thiểu tối đa xung đột mã nguồn (merge conflicts) khi làm việc song song qua Git.
2. **Database-per-Service Boundaries:** Mỗi module sở hữu bảng dữ liệu riêng. **FK vật lý chỉ tồn tại trong cùng module.** Liên kết xuyên module dùng `userId`, `examId`, `partId`,... (loose coupling).
3. **Đồng nhất cấu trúc nội bộ (Layered within Feature Module):** Mọi module đều có cấu trúc phân tầng (`controller`, `dto`, `entity`, `repository`, `service`) đồng bộ.
4. **Tuân thủ triệt để Base Architecture:** Mọi Entity kế thừa `BaseEntity (id Integer, createdAt, updatedAt)`, mọi Controller trả về `ResponseEntity<ApiResponse<T>>`, ngoại lệ nghiệp vụ ném qua `AppException(ErrorCode.XYZ)`.

---

## 2. KIẾN TRÚC TỔNG THỂ CÁC GÓI (PACKAGE STRUCTURE)

```text
com.multilingo.backend
├── BackendApplication.java
│
├── common/                                 # HẠ TẦNG DÙNG CHUNG (CORE INFRASTRUCTURE)
│   ├── base/                              # BaseEntity
│   ├── config/                            # JpaAuditingConfig, SecurityConfig, WebMvcConfig
│   ├── controller/                        # HealthCheckController
│   ├── dto/                               # ApiResponse<T>, PageResponse<T>
│   └── exception/                         # ErrorCode, AppException, GlobalExceptionHandler
│
└── modules/                                # 7 PHÂN HỆ MICROSERVICES-READY (BOUNDED CONTEXTS)
    ├── auth/                              # 👤 TV1: Xác thực, Phân quyền RBAC & Quản lý Tài khoản (IAM Service)
    ├── billing/                           # 👤 TV1: Gói VIP, Bảng giá & Thanh toán VNPAY (Billing Service)
    ├── exam/                              # 👤 TV2: Kho Đề thi & CMS Đề thi Đa cấp (Exam Bank Service)
    ├── testing/                           # 👤 TV3: Không gian Thi thử, Luyện tập & Trợ lý AI (Testing Service)
    ├── vocab/                             # 👤 TV5: Từ điển Ngữ cảnh & Bộ Flashcard SRS SM-2 (Vocab Service)
    ├── gamification/                      # 👤 TV5: Streak 🔥, Nhật ký Học tập & Thông báo (Gamification Service)
    └── analytics/                         # 👤 TV4: Giám sát Hệ thống, Tracking & Kiểm toán Admin (Analytics Service)
```

---

## 3. NGUYÊN TẮC PHÂN RANH GIỚI CSDL

### 3.1. FK Vật lý (Physical FK) - Chỉ trong nội bộ module

| Module | FK Vật lý được phép |
|---|---|
| `auth` | `users.role_id → roles`, `role_permissions.role_id → roles`, `role_permissions.permission_id → permissions` |
| `exam` | `exam_sections.exam_id → exams`, `exam_parts.section_id → exam_sections` |
| `testing` | `attempt_answers.attempt_id → test_attempts` |
| `vocab` | `user_flashcards.deck_id → flashcard_decks`, `user_flashcards.word_id → dictionary_words` |
| `billing` | *(Các bảng độc lập, transactions tham chiếu userId & planId qua loose coupling)* |
| `gamification` | *(Các bảng độc lập, liên kết qua userId)* |
| `analytics` | *(Các bảng độc lập, liên kết qua userId)* |

### 3.2. Liên kết xuyên module (Cross-Module - Loose Coupling)

Các liên kết sau **không được dùng FK vật lý** mà chỉ lưu ID số nguyên:

- `testing.test_attempts.user_id` → logic trỏ tới `auth.users`
- `testing.test_attempts.exam_id` → logic trỏ tới `exam.exams`
- `testing.attempt_answers.part_id` → logic trỏ tới `exam.exam_parts`
- `billing.transactions.user_id` → logic trỏ tới `auth.users`
- `analytics.*.user_id` → logic trỏ tới `auth.users`
- `vocab.flashcard_decks.user_id`, `vocab.user_flashcards.user_id` → logic trỏ tới `auth.users`
- `gamification.*.user_id` → logic trỏ tới `auth.users`

---

## 4. CHI TIẾT 7 MODULES NGHIỆP VỤ

Mỗi module sẽ chứa các tầng nội bộ chuẩn:
- `controller/`: REST Controllers cung cấp API cho Client.
- `dto/request/`: Các Request DTO có validation (`@NotBlank`, `@NotNull`,...).
- `dto/response/`: Các Response payload DTO trả về dữ liệu.
- `entity/`: Các JPA Entities kế thừa `com.multilingo.backend.common.base.BaseEntity`.
- `repository/`: Các Spring Data JPA Repositories kế thừa `JpaRepository<T, Integer>`.
- `service/` & `service/impl/`: Business logic interfaces & implementation.
- `package-info.java`: Khai báo JavaDoc phân định trách nhiệm thành viên và mô tả tổng quan.

---

### 4.1. Module `modules.auth` (Thành viên 1)
- **Thành viên phụ trách:** Thành viên 1
- **Phạm vi nghiệp vụ:**
  - Xác thực & Tài khoản: Đăng nhập (`UC01`), Quên mật khẩu (`UC01.1`), Đăng xuất (`UC02`), Đăng ký (`UC03`).
  - Hồ sơ cá nhân: Xem hồ sơ (`UC04`), Đổi mật khẩu (`UC04.1`), Cập nhật avatar & thông tin (`UC04.2`).
  - Quản trị RBAC: Gán Role/Permission (`UC15.2`).
- **Các bảng CSDL sở hữu (5 bảng):**
  - `users`, `roles`, `permissions`, `role_permissions`, `refresh_tokens`
- **FK vật lý nội bộ:** `users.role_id → roles`, `role_permissions (role_id, permission_id)`
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.auth
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # Role, Permission, User, UserTarget, RefreshToken
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.2. Module `modules.billing` (Thành viên 1)
- **Thành viên phụ trách:** Thành viên 1
- **Phạm vi nghiệp vụ:**
  - Gói cước: Thiết lập giá gói VIP (`UC16.1`).
  - Thanh toán: Mua gói VIP & Webhook IPN VNPAY (`UC06`).
  - Báo cáo: Đối soát giao dịch VNPAY (`UC16.2`).
- **Các bảng CSDL sở hữu (2 bảng):**
  - `subscription_plans`, `transactions`
- **FK vật lý nội bộ:** không có (transactions dùng `user_id` và `plan_id` là ID thuần)
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.billing
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # SubscriptionPlan, Transaction
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.3. Module `modules.exam` (Thành viên 2)
- **Thành viên phụ trách:** Thành viên 2
- **Phạm vi nghiệp vụ:**
  - Onboarding: Thiết lập mục tiêu học tập ban đầu (`UC05`).
  - Thư viện đề thi: Tra cứu & lọc kho đề thi (`UC07`), Gợi ý đề thi cá nhân hóa (`UC07.1`).
  - CMS Đề thi đa cấp: Thêm mới (`UC14.1`), Chỉnh sửa (`UC14.2`), Xóa (`UC14.3`), Import từ JSON/Excel (`UC14.4`).
- **Các bảng CSDL sở hữu (3 bảng):**
  - `exams`, `exam_sections`, `exam_parts`
- **FK vật lý nội bộ:** `exam_sections.exam_id → exams`, `exam_parts.section_id → exam_sections`
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.exam
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # Exam, ExamSection, ExamPart
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.4. Module `modules.testing` (Thành viên 3)
- **Thành viên phụ trách:** Thành viên 3
- **Phạm vi nghiệp vụ:**
  - Không gian làm bài: Thi thử tính giờ Full Exam / Luyện tập từng kỹ năng (`UC08`), Đếm ngược & Tự động thu bài (`UC08.5`).
  - Trợ lý AI (Gemini 2.5 Flash): Gợi ý dàn ý & từ vựng Writing Hints (`UC08.4`).
  - Chấm điểm: Chấm trắc nghiệm tự động (`UC09`), Chấm bài viết Writing bằng Gemini AI (`UC09.2`).
  - Kết quả & Giải thích: Xem bảng điểm & Lời giải chi tiết (`UC10`), Xem nhận xét AI & Diff-View sửa lỗi (`UC10.2`).
- **Các bảng CSDL sở hữu (2 bảng):**
  - `test_attempts`, `attempt_answers` (chứa `ai_feedback` JSONB)
- **FK vật lý nội bộ:** `attempt_answers.attempt_id → test_attempts`
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.testing
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # TestAttempt, AttemptAnswer
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.5. Module `modules.vocab` (Thành viên 5)
- **Thành viên phụ trách:** Thành viên 5
- **Phạm vi nghiệp vụ:**
  - Từ điển ngữ cảnh: Tra cứu từ điển đa ngôn ngữ (`UC11`), Lưu từ vựng kèm ngữ cảnh vào sổ tay (`UC11.1`).
  - Sổ Flashcard SRS: Quản lý sổ từ vựng (`UC12/12.1`), Phiên ôn tập thuật toán SM-2 (`UC12.2`).
  - Thông báo: Nhắc nhở ôn tập từ vựng (`UC12.3`).
- **Các bảng CSDL sở hữu (3 bảng):**
  - `dictionary_words`, `flashcard_decks`, `user_flashcards`
- **FK vật lý nội bộ:** `user_flashcards.deck_id → flashcard_decks`, `user_flashcards.word_id → dictionary_words`
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.vocab
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # DictionaryWord, FlashcardDeck, UserFlashcard
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.6. Module `modules.gamification` (Thành viên 5)
- **Thành viên phụ trách:** Thành viên 5
- **Phạm vi nghiệp vụ:**
  - Gamification: Chuỗi ngày Streak 🔥 và thời lượng học (`UC13`), Biểu đồ Radar năng lực (`UC13.1/13.2`).
  - Nhật ký học tập hàng ngày (`A_Tracking`).
  - Thông báo hệ thống: Nhắc nhở học tập (`UC12.3`).
- **Các bảng CSDL sở hữu (3 bảng):**
  - `user_study_stats`, `daily_study_logs`, `notifications`
- **FK vật lý nội bộ:** không có (các bảng độc lập, liên kết qua `user_id`)
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.gamification
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # UserStudyStat, DailyStudyLog, Notification
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

### 4.7. Module `modules.analytics` (Thành viên 4)
- **Thành viên phụ trách:** Thành viên 4
- **Phạm vi nghiệp vụ:**
  - Tracking hành vi: Thống kê lượt làm đề & tiến trình học viên (`A_Tracking`).
  - Quản trị Người dùng: Danh sách Users (`UC15`), Khóa/Mở khóa tài khoản vi phạm (`UC15.1`).
  - Quota AI & Kiểm toán: Cấu hình hạn mức Quota AI (`UC15.3`), Nhật ký kiểm toán an ninh (`UC15.4 / A_Audit`).
  - Báo cáo vận hành: Báo cáo DAU/MAU & Doanh thu tổng quan (`UC16`), Xuất file Excel (`UC16.3`).
- **Các bảng CSDL sở hữu (3 bảng):**
  - `audit_logs`, `login_history`, `user_quotas`
- **FK vật lý nội bộ:** không có (các bảng độc lập, liên kết qua `user_id`)
- **Cấu trúc package:**
  ```text
  com.multilingo.backend.modules.analytics
  ├── controller/
  ├── dto/
  │   ├── request/
  │   └── response/
  ├── entity/          # UserQuota, AuditLog, LoginHistory
  ├── repository/
  ├── service/
  │   └── impl/
  └── package-info.java
  ```

---

## 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- [x] Tạo đầy đủ 7 modules: `modules.auth`, `modules.billing`, `modules.exam`, `modules.testing`, `modules.vocab`, `modules.gamification`, `modules.analytics`.
- [x] Mỗi module có đủ các thư mục con: `controller`, `dto/request`, `dto/response`, `entity`, `repository`, `service/impl`.
- [x] Mỗi module có 1 file `package-info.java` mô tả rõ ràng trách nhiệm thành viên tương ứng.
- [x] FK vật lý chỉ tồn tại nội bộ module — đã xác minh trên PostgreSQL (ALTER TABLE đã chạy thành công).
- [x] Lệnh kiểm thử `./mvnw clean test` chạy thành công 21/21 entity mapping tests PASS.
