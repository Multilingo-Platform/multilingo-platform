# Kế Hoạch Triển Khai Kiến Trúc Base (Base Architecture Implementation Plan)

> **Dành cho kỹ sư AI (Agentic Workers):** Áp dụng quy trình thực thi task tuần tự (`superpowers:executing-plans`). Mỗi bước tuân thủ triệt để phương pháp luận **TDD (Red - Green - Refactor)** và nghiệm thu bằng **`verification-before-completion`**.

**Mục tiêu:** Khởi tạo và chuẩn hóa toàn bộ nền móng kiến trúc Backend (Spring Boot 3.3.4, BaseEntity INT, JPA Auditing, ApiResponse<T>, ErrorCode, GlobalExceptionHandler, Baseline Tests).

**Kiến trúc:** Modular Layered with Common Core (`com.multilingo.backend.common.*`). Phân tách độc lập hạ tầng dùng chung khỏi các miền nghiệp vụ.

**Tech Stack:** Java 21, Spring Boot 3.3.4 (Maven), Spring Data JPA, PostgreSQL 16 / H2 Database (Test Profile), Spring Validation, Spring Security, Lombok, JUnit 5, MockMvc.

**Đặc tả thiết kế (Spec):** [`docs/superpowers/specs/project-base-architecture.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-base-architecture.md)

---

## Global Constraints
- Java Version: `21` (bắt buộc).
- Spring Boot: `3.3.4` (LTS, hạ từ 4.1.0 thử nghiệm).
- ID Strategy: `Integer` tự tăng (`GenerationType.IDENTITY`).
- Định dạng API Response: `ApiResponse<T>` với các trường `{ success, code, message, data, timestamp }`.
- Mọi Controller trả về: `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ: Ném qua `AppException(ErrorCode.XYZ)`.
- Kiểm thử tự động: Profile test dùng H2 in-memory độc lập, không phụ thuộc CSDL bên ngoài khi chạy `mvn clean test`.

## Review Focus
1. **Lỗi NullPointerException khi Auditing:** `createdAt` hoặc `updatedAt` bị `null` nếu quên bật `@EnableJpaAuditing` hoặc cấu hình thiếu `@EntityListeners`.
2. **Lỗi tuần tự hóa JSON của `Instant`:** Trường `timestamp` trong `ApiResponse` và `createdAt`/`updatedAt` phải được serialize chuẩn ISO-8601 (Jackson JavaTimeModule).
3. **Lỗi hiển thị Validation Error:** Khi DTO vi phạm validation (`@NotBlank`, `@Min`), message trả về phải chứa tên trường và nội dung lỗi rõ ràng, HTTP Status là 422 hoặc 400.
4. **Lỗi rò rỉ Stack Trace hệ thống:** Khi phát sinh lỗi không mong muốn (`NullPointerException`, `SQLException`), `GlobalExceptionHandler` phải ẩn chi tiết nội bộ, trả về `500` và `ErrorCode.UNCATEGORIZED_EXCEPTION`.
5. **Độc lập môi trường kiểm thử:** `mvn clean test` phải chạy thành công 100% ngay cả khi Docker/PostgreSQL/Redis cục bộ chưa bật.

---

## DANH SÁCH TASK CHI TIẾT (BITE-SIZED TASKS)

### Task 1: Chuẩn hóa Cấu hình Dự án & Dependencies (`pom.xml`, `GEMINI.md`, Test Profile)

**Mục tiêu:** Căn chỉnh `pom.xml` về Spring Boot `3.3.4`, bổ sung H2 in-memory cho test, cập nhật rule trong `GEMINI.md`, và tạo cấu hình `application-test.properties`.

**Files:**
- Sửa: `backend/pom.xml`
- Sửa: `GEMINI.md`
- Tạo mới: `backend/src/test/resources/application-test.properties`
- Sửa: `backend/src/test/java/com/multilingo/backend/BackendApplicationTests.java`

- [x] **Bước 1.1:** Cập nhật `GEMINI.md` sửa dòng quy tắc:
  `- Mọi Entity kế thừa BaseEntity (Primary key là INT / Integer, tự tăng GenerationType.IDENTITY).`
- [x] **Bước 1.2:** Sửa `backend/pom.xml`:
  - Đổi parent version sang `<version>3.3.4</version>`.
  - Chuẩn hóa dependency: Đổi `spring-boot-starter-webmvc` thành `spring-boot-starter-web`.
  - Đổi `spring-boot-starter-webmvc-test` thành `spring-boot-starter-test`.
  - Bổ sung dependency H2 database phạm vi `test`:
    ```xml
    <dependency>
        <groupId>com.h2database</groupId>
        <artifactId>h2</artifactId>
        <scope>test</scope>
    </dependency>
    ```
- [x] **Bước 1.3:** Tạo file `backend/src/test/resources/application-test.properties` cấu hình H2 in-memory:
  ```properties
  spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
  spring.datasource.driver-class-name=org.h2.Driver
  spring.datasource.username=sa
  spring.datasource.password=
  spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
  spring.jpa.hibernate.ddl-auto=create-drop
  spring.jpa.show-sql=false
  spring.data.redis.host=localhost
  spring.data.redis.port=6379
  ```
- [x] **Bước 1.4:** Thêm annotation `@ActiveProfiles("test")` vào `BackendApplicationTests.java`.
- [x] **Bước 1.5:** Chạy thử nghiệm để kiểm chứng:
  ```bash
  cd backend && ./mvnw test -Dtest=BackendApplicationTests
  ```

---

### Task 2: Xây dựng Thực thể Nền tảng & Cơ chế Tự động Auditing (`BaseEntity`, `JpaAuditingConfig`)

**Mục tiêu:** Cài đặt `BaseEntity` (id INT, createdAt, updatedAt) và kích hoạt JPA Auditing tự động thông qua TDD.

**Files:**
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/base/BaseEntity.java`
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/config/JpaAuditingConfig.java`
- Tạo mới: `backend/src/test/java/com/multilingo/backend/common/base/BaseEntityAuditingTest.java`
- Sửa: `backend/src/main/java/com/multilingo/backend/entity/ExamPart.java`

- [x] **Bước 2.1 (TDD Red):** Viết bài test `BaseEntityAuditingTest.java` kiểm tra:
  - Tạo entity kế thừa `BaseEntity`.
  - Khi lưu entity, `id` phải tự sinh > 0, `createdAt` và `updatedAt` không được null.
  - Khi cập nhật entity, `updatedAt` phải được cập nhật thời gian mới.
- [x] **Bước 2.2:** Chạy test để xác nhận test THẤT BẠI (vì chưa có `BaseEntity` và `JpaAuditingConfig`).
- [x] **Bước 2.3 (TDD Green):** Tạo file `BaseEntity.java` tại `com.multilingo.backend.common.base`:
  - `@MappedSuperclass`, `@EntityListeners(AuditingEntityListener.class)`.
  - `@Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Integer id;`
  - `@CreatedDate @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;`
  - `@LastModifiedDate @Column(name = "updated_at", nullable = false) private Instant updatedAt;`
- [x] **Bước 2.4:** Tạo file `JpaAuditingConfig.java` tại `com.multilingo.backend.common.config` với `@Configuration` và `@EnableJpaAuditing`.
- [x] **Bước 2.5:** Chạy lại `BaseEntityAuditingTest` để xác nhận test VƯỢT QUA (Green).
- [x] **Bước 2.6 (Refactor):** Cập nhật `ExamPart.java` kế thừa `BaseEntity` (loại bỏ trường `id` khai báo trùng lặp).

---

### Task 3: Chuẩn hóa Cấu trúc Phản hồi API (`ApiResponse<T>`)

**Mục tiêu:** Xây dựng `ApiResponse<T>` chuẩn JSON `{ success, code, message, data, timestamp }` với đầy đủ static factory methods và unit tests.

**Files:**
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/dto/ApiResponse.java`
- Tạo mới: `backend/src/test/java/com/multilingo/backend/common/dto/ApiResponseTest.java`

- [x] **Bước 3.1 (TDD Red):** Viết unit test `ApiResponseTest.java` kiểm tra:
  - `ApiResponse.success(data)` sinh đúng `success=true`, `code=200`, `message="Success"`, `timestamp != null`.
  - `ApiResponse.success("Custom message", data)` sinh đúng custom message.
  - `ApiResponse.error(400, "Error detail")` sinh đúng `success=false`, `code=400`, `data=null`.
- [x] **Bước 3.2:** Chạy test để xác nhận test THẤT BẠI.
- [x] **Bước 3.3 (TDD Green):** Tạo file `ApiResponse.java` tại `com.multilingo.backend.common.dto`:
  - Triển khai đầy đủ thuộc tính, Lombok `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`.
  - Triển khai các phương thức static helper `success(...)` và `error(...)`.
- [x] **Bước 3.4:** Chạy lại `ApiResponseTest` để xác nhận test VƯỢT QUA (Green).

---

### Task 4: Hệ thống Xử lý Lỗi Toàn cục (`ErrorCode`, `AppException`, `GlobalExceptionHandler`)

**Mục tiêu:** Xây dựng hệ thống bắt lỗi tập trung `@RestControllerAdvice` xử lý `AppException`, Bean Validation và Uncaught Exceptions.

**Files:**
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/exception/AppException.java`
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/exception/GlobalExceptionHandler.java`
- Tạo mới: `backend/src/test/java/com/multilingo/backend/common/exception/GlobalExceptionHandlerTest.java`

- [x] **Bước 4.1 (TDD Red):** Viết bài test `@WebMvcTest` trong `GlobalExceptionHandlerTest.java`:
  - Tạo Controller giả lập (`TestExceptionController`):
    - Endpoint 1: Ném `AppException(ErrorCode.RESOURCE_NOT_FOUND)`.
    - Endpoint 2: Gửi request body vi phạm validation (`@Valid`).
    - Endpoint 3: Ném `NullPointerException`.
  - Test case 1: Xác nhận Endpoint 1 trả về HTTP 404 và body `{ success: false, code: 404, message: ... }`.
  - Test case 2: Xác nhận Endpoint 2 trả về HTTP 422 và body chứa chi tiết field errors.
  - Test case 3: Xác nhận Endpoint 3 trả về HTTP 500 và body chứa message `UNCATEGORIZED_EXCEPTION`.
- [x] **Bước 4.2:** Chạy test để xác nhận test THẤT BẠI.
- [x] **Bước 4.3 (TDD Green):** Tạo file `ErrorCode.java` enum chứa: `code`, `httpStatus`, `message`.
- [x] **Bước 4.4:** Tạo file `AppException.java` kế thừa `RuntimeException`.
- [x] **Bước 4.5:** Tạo file `GlobalExceptionHandler.java` với `@RestControllerAdvice` xử lý:
  - `@ExceptionHandler(AppException.class)`
  - `@ExceptionHandler(MethodArgumentNotValidException.class)`
  - `@ExceptionHandler(Exception.class)`
- [x] **Bước 4.6:** Chạy lại `GlobalExceptionHandlerTest` để xác nhận toàn bộ test VƯỢT QUA (Green).

---

### Task 5: Chuẩn hóa Controller Hiện hữu & Nghiệm thu Toàn diện (`mvn clean test`)

**Mục tiêu:** Nâng cấp `ExamTestController` trả về `ResponseEntity<ApiResponse<T>>`, kiểm tra tương thích và chạy nghiệm thu toàn bộ test suite.

**Files:**
- Sửa: `backend/src/main/java/com/multilingo/backend/controller/ExamTestController.java`
- Sửa: `backend/src/main/java/com/multilingo/backend/controller/TestController.java` (nếu có)
- Kiểm thử toàn diện: Toàn bộ test suite

- [x] **Bước 5.1:** Sửa `ExamTestController.java`:
  - Chuyển kiểu trả về của các endpoint thành `ResponseEntity<ApiResponse<...>>`.
  - Áp dụng `ApiResponse.success(...)`.
- [x] **Bước 5.2:** Kiểm tra toàn bộ package import để không còn package rác hay tham chiếu lỗi thời.
- [x] **Bước 5.3 (Verification Before Completion):** Chạy lệnh kiểm thử toàn diện:
  ```bash
  cd backend && ./mvnw clean test
  ```
- [x] **Bước 5.4:** Thu thập log và chứng minh 100% tests PASS (không có Failure, không có Error).
