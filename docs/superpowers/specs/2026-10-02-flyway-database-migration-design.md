# ĐẶC TẢ THIẾT KẾ TÍCH HỢP FLYWAY DATABASE MIGRATION

**Dự án:** Nền tảng Thi thử và Đánh giá Năng lực Ngoại ngữ Multilingo (Multilingo Platform)  
**Phân hệ:** Backend Database Architecture & Infrastructure (`backend`)  
**Tác giả:** Superpowers Architecture Team  
**Ngày tạo:** 02/10/2026 | **Trạng thái:** DRAFT FOR REVIEW  
**Tài liệu tham chiếu:**
- Quy chuẩn kiến trúc Base: [`GEMINI.md`](file:///f:/Working/JavaBackend/multilingo-platform/GEMINI.md)
- Đặc tả 21 JPA Entities: [`docs/superpowers/specs/project-jpa-entities.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-jpa-entities.md)
- Schema CSDL: [`docs/md/DATABASE_SCHEMA.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/DATABASE_SCHEMA.md)

---

## 1. BỐI CẢNH & MỤC TIÊU

### 1.1. Bối cảnh
Trước đây, ứng dụng backend (`Spring Boot 3.3.4`, `Java 21`, `PostgreSQL`) phụ thuộc vào cấu hình của Hibernate:
```properties
spring.jpa.hibernate.ddl-auto=update
```
Cơ chế tự động sinh và cập nhật schema của Hibernate tiềm ẩn nhiều rủi ro nghiêm trọng trong dự án thực tế:
- **Schema Drift:** Các môi trường (Local, Docker, CI/CD, Staging, Production) dễ bị phân mảnh hoặc không đồng bộ cấu trúc bảng.
- **Mất kiểm soát lịch sử DDL:** Không lưu vết được ai đã thay đổi cột nào, chỉ số (indexes) nào, khi nào.
- **Rủi ro rò rỉ dữ liệu:** Hibernate không hỗ trợ rollback hoặc kiểm soát migration khi có thay đổi kiểu dữ liệu/drop column.

### 1.2. Mục tiêu
1. Tích hợp **Flyway Migration Engine** vào `backend` nhằm kiểm soát cấu trúc CSDL bằng mã nguồn (Database Migration as Code), bảo đảm tính bất biến (immutable) và khả năng tái lập 100% ở mọi môi trường.
2. Khởi tạo script di chuyển ban đầu `V1__init_schema.sql` bao gồm đầy đủ **21 bảng nghiệp vụ** và **1 bảng liên kết trung gian** cho toàn bộ 7 modules (`auth`, `billing`, `exam`, `testing`, `vocab`, `gamification`, `analytics`), tuân thủ chuẩn `BaseEntity`.
3. Chuyển đổi cấu hình Hibernate sang `spring.jpa.hibernate.ddl-auto=validate` trên môi trường thực thi (PostgreSQL), buộc Hibernate kiểm tra tính khớp nối với CSDL thay vì tự ý chỉnh sửa schema.
4. Bảo đảm toàn bộ bộ kiểm thử tự động (Unit / Slice / Integration tests) chạy mượt mà trên môi trường in-memory `H2` với thời gian thực thi tối ưu.

---

## 2. KIẾN TRÚC & CẤU HÌNH KỸ THUẬT

### 2.1. Quản lý Thư viện (`backend/pom.xml`)
Spring Boot 3.3.4 sử dụng Flyway 10.x. Kể từ phiên bản 10, Flyway đã tách các driver hỗ trợ cơ sở dữ liệu cụ thể ra khỏi `flyway-core`. Vì vậy, cần bổ sung cả 2 dependencies:
```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

### 2.2. Cấu hình Runtime (`backend/src/main/resources/application.properties`)
```properties
# Flyway Migration Configuration
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0

# Hibernate Schema Validation
spring.jpa.hibernate.ddl-auto=validate
```
*Giải thích quyết định thiết kế:*
- `baseline-on-migrate=true` & `baseline-version=0`: Khi triển khai trên môi trường Docker hoặc máy dev đã có sẵn CSDL cũ, Flyway sẽ tự động gắn baseline version 0 thay vì báo lỗi `Found non-empty schema(s) without schema history table`.
- `spring.jpa.hibernate.ddl-auto=validate`: Ngăn chặn hoàn toàn Hibernate can thiệp DDL, bảo vệ tính toàn vẹn của Flyway.

### 2.3. Cấu hình Môi trường Kiểm thử (`backend/src/test/resources/application-test.properties`)
```properties
# Test Profile: H2 In-Memory
spring.flyway.enabled=false
spring.jpa.hibernate.ddl-auto=create-drop
```
*Giải thích quyết định thiết kế:*
- Tránh xung đột cú pháp đặc thù PostgreSQL (như `JSONB`, hàm `uuid_generate_v4()`) khi chạy test nhanh với H2.
- Giữ tốc độ kiểm thử nhanh nhất cho các test slice (`@DataJpaTest`, `@WebMvcTest`).

---

## 3. CHI TIẾT SCRIPT MIGRATION BAN ĐẦU (`V1__init_schema.sql`)

Vị trí lưu trữ: `backend/src/main/resources/db/migration/V1__init_schema.sql`

### 3.1. Nguyên tắc thiết kế DDL
1. **Tuân thủ BaseEntity:** 100% bảng nghiệp vụ có các cột sau:
   - `id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` (hoặc `SERIAL PRIMARY KEY`)
   - `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
   - `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`
2. **Khóa ngoại (Foreign Keys):**
   - **Nội bộ module:** Khai báo `CONSTRAINT ... FOREIGN KEY REFERENCES` vật lý đầy đủ để đảm bảo tính toàn vẹn dữ liệu.
   - **Xuyên module:** Khai báo cột `INT` logic (ví dụ `user_id INT NOT NULL`), không tạo FK vật lý qua module khác, giữ vững tính độc lập ranh giới module (Modular Monolith Boundaries).
3. **Cột Dữ liệu Phi cấu trúc:** Khai báo kiểu `JSONB` đối với PostgreSQL để hỗ trợ lưu trữ mảng câu hỏi, kết quả thi, cấu trúc dictionary và audit logs.

### 3.2. Danh mục 21 Bảng + 1 Bảng Join

#### Phân hệ `auth`
1. `roles`: `id`, `name` (varchar 50, unique), `description` (text), `created_at`, `updated_at`.
2. `permissions`: `id`, `action_code` (varchar 100, unique), `module` (varchar 50), `description` (text), `created_at`, `updated_at`.
3. `role_permissions` (Join table): `role_id` (FK -> `roles.id`), `permission_id` (FK -> `permissions.id`), `PRIMARY KEY (role_id, permission_id)`.
4. `users`: `id`, `email` (varchar 255, unique), `password_hash` (varchar 255), `full_name` (varchar 150), `avatar_url` (varchar 500), `role_id` (FK -> `roles.id`), `native_language` (varchar 10, default 'vi'), `target_language` (varchar 10, default 'en'), `subscription_tier` (varchar 20, default 'FREE'), `premium_expires_at` (timestamptz), `is_active` (boolean, default true), `google_id` (varchar 255, unique), `last_login_at` (timestamptz), `last_login_ip` (varchar 45), `created_at`, `updated_at`.
5. `user_targets`: `id`, `user_id` (int), `target_certificate` (varchar 50), `target_language` (varchar 10, default 'en'), `target_score` (numeric(4,1)), `created_at`, `updated_at`.
6. `refresh_tokens`: `id`, `user_id` (int), `token` (varchar 500, unique), `device_info` (varchar 255), `ip_address` (varchar 45), `expires_at` (timestamptz), `is_revoked` (boolean, default false), `created_at`, `updated_at`.

#### Phân hệ `billing`
7. `subscription_plans`: `id`, `code` (varchar 50, unique), `name` (varchar 100), `price` (numeric(12,2)), `duration_days` (int), `is_active` (boolean, default true), `created_at`, `updated_at`.
8. `transactions`: `id`, `user_id` (int), `plan_id` (int), `vnp_txn_ref` (varchar 100, unique), `vnp_transaction_no` (varchar 100), `amount` (numeric(12,2)), `bank_code` (varchar 20), `payment_method` (varchar 50, default 'VNPAY'), `status` (varchar 20, default 'PENDING'), `paid_at` (timestamptz), `created_at`, `updated_at`.

#### Phân hệ `exam`
9. `exams`: `id`, `code` (varchar 100, unique), `title` (varchar 255), `type` (varchar 50), `exam_language` (varchar 10, default 'en'), `is_published` (boolean, default false), `is_vip_only` (boolean, default false), `duration_minutes` (int, default 60), `thumbnail_url` (varchar 500), `created_by` (int), `created_at`, `updated_at`.
10. `exam_sections`: `id`, `exam_id` (FK -> `exams.id`), `skill_type` (varchar 50), `title` (varchar 150), `duration_minutes` (int, default 60), `audio_url` (varchar 500), `order_index` (int, default 1), `created_at`, `updated_at`.
11. `exam_parts`: `id`, `section_id` (FK -> `exam_sections.id`), `part_number` (int, default 1), `content_data` (JSONB), `created_at`, `updated_at`.

#### Phân hệ `testing`
12. `test_attempts`: `id`, `user_id` (int), `exam_id` (int), `test_scope` (varchar 50, default 'FULL_EXAM'), `test_mode` (varchar 50, default 'MOCK_TEST'), `status` (varchar 30, default 'IN_PROGRESS'), `start_time` (timestamptz), `end_time` (timestamptz), `time_spent_seconds` (int, default 0), `overall_score` (numeric(4,2)), `section_scores` (JSONB), `created_at`, `updated_at`.
13. `attempt_answers`: `id`, `attempt_id` (FK -> `test_attempts.id`), `part_id` (int), `user_answers` (JSONB), `is_correct_flags` (JSONB), `ai_feedback` (JSONB), `skill_stats` (JSONB), `earned_score` (numeric(4,2)), `created_at`, `updated_at`.

#### Phân hệ `vocab`
14. `dictionary_words`: `id`, `word` (varchar 150), `language_code` (varchar 10, default 'en'), `phonetic` (varchar 150), `pos` (varchar 50), `level` (varchar 10), `default_meaning` (JSONB), `example_sentence` (text), `audio_url` (varchar 500), `created_at`, `updated_at`.
15. `flashcard_decks`: `id`, `user_id` (int), `name` (varchar 200), `description` (text), `is_public` (boolean, default false), `clones_count` (int, default 0), `created_at`, `updated_at`.
16. `user_flashcards`: `id`, `user_id` (int), `deck_id` (FK -> `flashcard_decks.id`), `word_id` (int), `custom_word` (varchar 150), `custom_meaning` (text), `example_sentence` (text), `custom_image_url` (varchar 500), `status` (varchar 30, default 'NEW'), `review_count` (int, default 0), `ease_factor` (numeric(4,2), default 2.50), `interval_days` (int, default 0), `next_review_date` (timestamptz), `created_at`, `updated_at`.

#### Phân hệ `gamification`
17. `user_study_stats`: `id`, `user_id` (int, unique), `current_streak` (int, default 0), `highest_streak` (int, default 0), `total_learning_minutes` (int, default 0), `last_study_date` (date), `created_at`, `updated_at`.
18. `daily_study_logs`: `id`, `user_id` (int), `study_date` (date), `learning_minutes` (int, default 0), `flashcards_due` (int, default 0), `flashcards_reviewed` (int, default 0), `created_at`, `updated_at`.
19. `notifications`: `id`, `user_id` (int), `title` (varchar 200), `content` (text), `is_read` (boolean, default false), `created_at`, `updated_at`.

#### Phân hệ `analytics`
20. `user_quotas`: `id`, `user_id` (int), `feature_code` (varchar 50), `used_count` (int, default 0), `max_limit` (int, default 1), `reset_date` (timestamptz), `created_at`, `updated_at`.
21. `audit_logs`: `id`, `user_id` (int), `action` (varchar 100), `entity_type` (varchar 50), `entity_id` (varchar 100), `details` (JSONB), `ip_address` (varchar 45), `created_at`, `updated_at`.
22. `login_history`: `id`, `user_id` (int), `ip_address` (varchar 45), `device_info` (varchar 255), `login_time` (timestamptz), `status` (varchar 20, default 'SUCCESS'), `created_at`, `updated_at`.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

| Mã AC | Tiêu chí nghiệm thu | Phương thức kiểm chứng |
| :--- | :--- | :--- |
| **AC-01** | Bổ sung đầy đủ dependency `flyway-core` và `flyway-database-postgresql` vào `backend/pom.xml`. | Chạy `mvn dependency:tree` kiểm tra xuất hiện các artifact Flyway. |
| **AC-02** | Khai báo cấu hình `spring.flyway.*` và `ddl-auto=validate` trong `application.properties`. | Kiểm tra file cấu hình. |
| **AC-03** | File migration `V1__init_schema.sql` được tạo đúng vị trí `src/main/resources/db/migration/` với đầy đủ 22 bảng (21 entity + 1 bảng join). | Kiểm tra cú pháp SQL và sự tồn tại của file. |
| **AC-04** | Kiểm thử xác thực cấu hình Flyway (`FlywayConfigurationTest`) kiểm tra bean Flyway và migration location. | Chạy test tự động với JUnit 5. |
| **AC-05** | Môi trường test (`application-test.properties`) cách ly an toàn: tắt Flyway, dùng H2 `create-drop`. | Chạy toàn bộ test suite, không phát sinh lỗi H2. |
| **AC-06** | Lệnh `mvn clean test` chạy thành công 100% không có lỗi. | Terminal execution log kết thúc với `BUILD SUCCESS`. |
