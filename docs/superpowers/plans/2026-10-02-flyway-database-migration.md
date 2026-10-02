# Kế Hoạch Triển Khai Tích Hợp Flyway Database Migration (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập Flyway 10.x Database Migration cho Spring Boot 3.3.4, khởi tạo script di chuyển `V1__init_schema.sql` cho toàn bộ 21 entities (7 modules), cấu hình `ddl-auto=validate` trên PostgreSQL và cách ly môi trường kiểm thử H2.

**Architecture:** Sử dụng Flyway để kiểm soát vòng đời DDL theo cơ chế Versioned Migration as Code. Trên môi trường runtime PostgreSQL, Hibernate chỉ validate schema. Trên môi trường test H2, Flyway được tắt để test slice chạy với `ddl-auto=create-drop`, kiểm tra tính toàn vẹn thông qua việc chạy lại bộ kiểm thử hiện có.

**Tech Stack:** Spring Boot 3.3.4, Java 21, Flyway 10.x (`flyway-core`, `flyway-database-postgresql`), PostgreSQL, H2 (test).

**Spec:** [`docs/superpowers/specs/2026-10-02-flyway-database-migration-design.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-10-02-flyway-database-migration-design.md)

---

## Chi tiết các Task Thực thi

### Task 1: Bổ sung Flyway Dependencies vào `backend/pom.xml`

**Files:**
- Modify: `backend/pom.xml`

- [ ] **Step 1: Thêm Flyway dependencies vào pom.xml**
Thêm `flyway-core` và `flyway-database-postgresql` vào khối `<dependencies>`:
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

- [ ] **Step 2: Chạy kiểm tra Maven dependency resolution**
Run: `mvn compile -DskipTests`
Expected: BUILD SUCCESS, tải về và resolve thành công các thư viện Flyway.

- [ ] **Step 3: Commit**
```bash
git add backend/pom.xml
git commit -m "build(backend): add flyway-core and flyway-database-postgresql dependencies"
```

---

### Task 2: Cấu hình Flyway & Hibernate trong `application.properties` và `application-test.properties`

**Files:**
- Modify: `backend/src/main/resources/application.properties`
- Modify: `backend/src/test/resources/application-test.properties`

- [ ] **Step 1: Cập nhật `application.properties`**
Đổi `spring.jpa.hibernate.ddl-auto=update` thành `validate`, bổ sung cấu hình Flyway:
```properties
# Hibernate configuration
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=true
spring.jpa.open-in-view=false
spring.jpa.properties.hibernate.type.json_format_mapper=jackson

# Flyway configuration
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=0
```

- [ ] **Step 2: Cập nhật `application-test.properties`**
Đảm bảo Flyway tắt trong môi trường test H2:
```properties
spring.flyway.enabled=false
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/application.properties backend/src/test/resources/application-test.properties
git commit -m "feat(config): configure flyway migration properties and set hibernate ddl-auto to validate"
```

---

### Task 3: Tạo Script Migration `V1__init_schema.sql` (22 Bảng / 7 Modules)

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__init_schema.sql`

- [ ] **Step 1: Viết script `V1__init_schema.sql` đầy đủ 22 bảng**
Nội dung script tuân thủ:
- `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- 22 bảng với kiểu dữ liệu chuẩn, `id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`.
- Kiểu `JSONB` cho các trường JSON: `content_data`, `section_scores`, `user_answers`, `is_correct_flags`, `ai_feedback`, `skill_stats`, `default_meaning`, `details`.
- Ràng buộc FK nội bộ module:
  * `role_permissions` -> `roles`, `permissions`
  * `users` -> `roles`
  * `exam_sections` -> `exams`
  * `exam_parts` -> `exam_sections`
  * `attempt_answers` -> `test_attempts`
  * `user_flashcards` -> `flashcard_decks`

- [ ] **Step 2: Commit script V1**
```bash
git add backend/src/main/resources/db/migration/V1__init_schema.sql
git commit -m "feat(db): create V1__init_schema.sql migration for all 21 entities across 7 modules"
```

---

### Task 4: Kiểm thử Toàn diện & Nghiệm thu (`verification-before-completion`)

**Files:**
- Toàn bộ source code backend

- [ ] **Step 1: Chạy toàn bộ test suite của backend**
Run: `mvn clean test`
Expected: BUILD SUCCESS, tất cả 21 tests hiện có chạy PASS 100%.

- [ ] **Step 2: Xác nhận git status sạch sẽ**
Run: `git status`
Expected: Working tree clean.
