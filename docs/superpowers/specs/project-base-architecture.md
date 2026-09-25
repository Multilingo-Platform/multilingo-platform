# ĐẶC TẢ KIẾN TRÚC NỀN TẢNG BACKEND (BASE ARCHITECTURE SPECIFICATION)
**Dự án:** Multilingo Platform  
**Phân hệ:** Backend Core Infrastructure (`backend`)  
**Tác giả:** Superpowers Architecture Team  
**Ngày tạo:** 25/09/2026 | **Trạng thái:** DRAFT FOR REVIEW  

---

## 1. MỤC TIÊU & TỔNG QUAN

Tài liệu này xác lập tiêu chuẩn kiến trúc nền tảng (Base Architecture) cho toàn bộ hệ thống Backend Spring Boot của dự án **Multilingo Platform**. Mục tiêu nhằm chuẩn hóa:
1. **Mô hình thực thể dùng chung (Base Entity & Auditing):** Tự động sinh khóa chính `INT` và tự động cập nhật dấu vết thời gian (`createdAt`, `updatedAt`).
2. **Chuẩn hóa dữ liệu trả về (Unified API Response):** Định dạng chuẩn duy nhất `ApiResponse<T>` cho 100% các API RESTful của hệ thống.
3. **Cơ chế xử lý lỗi tập trung (Global Exception Handling):** Bắt và bao gói toàn bộ lỗi nghiệp vụ (`AppException`) và lỗi hệ thống thông qua `ErrorCode` enum và `@RestControllerAdvice`.
4. **Hạ tầng kiểm thử tự động (Testing Baseline):** Xây dựng bộ test nền móng đảm bảo `mvn clean test` pass 100% độc lập, không phụ thuộc môi trường bên ngoài.

---

## 2. CÔNG NGHỆ & PHIÊN BẢN (TECH STACK)

| Thành phần | Phiên bản / Công nghệ | Vai trò |
| :--- | :--- | :--- |
| **Ngôn ngữ** | Java 21 LTS | Nền tảng lập trình chính |
| **Framework** | Spring Boot 3.3.4 (LTS) | Framework backend cốt lõi |
| **Build Tool** | Apache Maven 3.9+ | Quản lý dependencies & build lifecycle |
| **Persistence** | Spring Data JPA / Hibernate 6.x | Tương tác CSDL ORM |
| **Database** | PostgreSQL 16 (Runtime) / H2 Database (Test Profile) | CSDL quan hệ chính / CSDL test in-memory |
| **Cache & Queue**| Redis 7 / Spring Data Redis | Bộ nhớ đệm và chia sẻ session |
| **Bảo mật** | Spring Security 6.x + JWT | Xác thực và phân quyền RBAC |
| **Validation** | Spring Boot Starter Validation (Hibernate Validator) | Ràng buộc dữ liệu đầu vào DTO (`@Valid`) |
| **Testing** | JUnit 5, Mockito, AssertJ, Spring Boot Test | Bộ công cụ kiểm thử tự động TDD |

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN (PACKAGE STRUCTURE)

Hệ thống được tổ chức theo kiến trúc **Modular Layered with Common Core**:

```text
com.multilingo.backend
├── BackendApplication.java
│
├── common                                 # HẠ TẦNG DÙNG CHUNG (INFRASTRUCTURE & CORE)
│   ├── base                               # Base Entity & MappedSuperclass
│   │   └── BaseEntity.java
│   ├── config                             # Cấu hình hệ thống
│   │   ├── JpaAuditingConfig.java
│   │   ├── SecurityConfig.java
│   │   └── WebMvcConfig.java
│   ├── dto                                # Định dạng response chuẩn
│   │   ├── ApiResponse.java
│   │   └── PageResponse.java
│   └── exception                          # Hệ thống xử lý lỗi tập trung
│       ├── AppException.java
│       ├── ErrorCode.java
│       └── GlobalExceptionHandler.java
│
└── modules                                # CÁC PHÂN HỆ NGHIỆP VỤ (BOUNDED CONTEXTS)
    ├── auth/                              # Phân hệ Xác thực & Người dùng
    ├── exam/                              # Phân hệ Ngân hàng Đề thi & Khảo thí
    ├── billing/                           # Phân hệ Gói cước & Thanh toán
    ├── vocab/                             # Phân hệ Sổ tay Từ vựng & Flashcards SRS
    └── analytics/                         # Phân hệ Giám sát, Nhật ký & Gamification
```

---

## 4. CHI TIẾT CÁC THÀNH PHẦN KIẾN TRÚC

### 4.1. Base Entity & Auditing (`BaseEntity.java`)
Mọi thực thể CSDL trong hệ thống đều kế thừa từ `BaseEntity` để đảm bảo tính đồng nhất về khóa chính và thời gian:

*   **Vị trí:** `com.multilingo.backend.common.base.BaseEntity`
*   **Thuộc tính:**
    *   `id`: `Integer` tự tăng (`@GeneratedValue(strategy = GenerationType.IDENTITY)`), map với kiểu `SERIAL` trong PostgreSQL.
    *   `createdAt`: `Instant`, tự động gán thời điểm tạo mới qua `@CreatedDate`, không cho phép update (`updatable = false`).
    *   `updatedAt`: `Instant`, tự động cập nhật qua `@LastModifiedDate` mỗi khi bản ghi thay đổi.
*   **Mã nguồn thiết kế:**
    ```java
    package com.multilingo.backend.common.base;

    import jakarta.persistence.*;
    import lombok.Getter;
    import lombok.Setter;
    import org.springframework.data.annotation.CreatedDate;
    import org.springframework.data.annotation.LastModifiedDate;
    import org.springframework.data.jpa.domain.support.AuditingEntityListener;

    import java.time.Instant;

    @Getter
    @Setter
    @MappedSuperclass
    @EntityListeners(AuditingEntityListener.class)
    public abstract class BaseEntity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "id", nullable = false, updatable = false)
        private Integer id;

        @CreatedDate
        @Column(name = "created_at", nullable = false, updatable = false)
        private Instant createdAt;

        @LastModifiedDate
        @Column(name = "updated_at", nullable = false)
        private Instant updatedAt;
    }
    ```

*   **Kích hoạt JPA Auditing (`JpaAuditingConfig.java`):**
    ```java
    package com.multilingo.backend.common.config;

    import org.springframework.context.annotation.Configuration;
    import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

    @Configuration
    @EnableJpaAuditing
    public class JpaAuditingConfig {
    }
    ```

---

### 4.2. Chuẩn hóa API Response (`ApiResponse<T>`)
Tất cả các REST Controller đều phải trả về đối tượng `ResponseEntity<ApiResponse<T>>`. Định dạng JSON gửi về client có cấu trúc thống nhất:

```json
{
  "success": true,
  "code": 200,
  "message": "Thành công",
  "data": { ... },
  "timestamp": "2026-09-25T08:30:00Z"
}
```

*   **Vị trí:** `com.multilingo.backend.common.dto.ApiResponse`
*   **Các Static Factory Methods:**
    *   `ApiResponse.success(T data)`: Trả về 200 OK với data.
    *   `ApiResponse.success(String message, T data)`: Trả về 200 OK với message tùy biến và data.
    *   `ApiResponse.error(int code, String message)`: Trả về response báo lỗi (khi xử lý Exception).
*   **Mã nguồn thiết kế:**
    ```java
    package com.multilingo.backend.common.dto;

    import com.fasterxml.jackson.annotation.JsonInclude;
    import lombok.AllArgsConstructor;
    import lombok.Builder;
    import lombok.Data;
    import lombok.NoArgsConstructor;

    import java.time.Instant;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public class ApiResponse<T> {

        @Builder.Default
        private boolean success = true;

        @Builder.Default
        private int code = 200;

        private String message;

        private T data;

        @Builder.Default
        private Instant timestamp = Instant.now();

        public static <T> ApiResponse<T> success(T data) {
            return ApiResponse.<T>builder()
                    .success(true)
                    .code(200)
                    .message("Success")
                    .data(data)
                    .timestamp(Instant.now())
                    .build();
        }

        public static <T> ApiResponse<T> success(String message, T data) {
            return ApiResponse.<T>builder()
                    .success(true)
                    .code(200)
                    .message(message)
                    .data(data)
                    .timestamp(Instant.now())
                    .build();
        }

        public static <T> ApiResponse<T> error(int code, String message) {
            return ApiResponse.<T>builder()
                    .success(false)
                    .code(code)
                    .message(message)
                    .data(null)
                    .timestamp(Instant.now())
                    .build();
        }
    }
    ```

---

### 4.3. Danh mục Mã lỗi Chuẩn (`ErrorCode.java`)
Khai báo tập trung toàn bộ mã lỗi định danh, mã HTTP Status tương ứng và thông điệp mặc định.

*   **Vị trí:** `com.multilingo.backend.common.exception.ErrorCode`
*   **Các mã lỗi nền tảng (Foundation Codes):**
    ```java
    package com.multilingo.backend.common.exception;

    import lombok.Getter;
    import org.springframework.http.HttpStatus;

    @Getter
    public enum ErrorCode {
        SUCCESS(200, HttpStatus.OK, "Thao tác thành công"),
        INVALID_REQUEST(400, HttpStatus.BAD_REQUEST, "Yêu cầu không hợp lệ"),
        UNAUTHORIZED(401, HttpStatus.UNAUTHORIZED, "Chưa xác thực hoặc token không hợp lệ"),
        FORBIDDEN(403, HttpStatus.FORBIDDEN, "Không có quyền thực hiện thao tác"),
        RESOURCE_NOT_FOUND(404, HttpStatus.NOT_FOUND, "Không tìm thấy tài nguyên yêu cầu"),
        METHOD_NOT_ALLOWED(405, HttpStatus.METHOD_NOT_ALLOWED, "Phương thức HTTP không được hỗ trợ"),
        CONFLICT(409, HttpStatus.CONFLICT, "Dữ liệu bị trùng lặp hoặc xung đột"),
        VALIDATION_FAILED(422, HttpStatus.UNPROCESSABLE_ENTITY, "Dữ liệu đầu vào không hợp lệ"),
        QUOTA_EXCEEDED(429, HttpStatus.TOO_MANY_REQUESTS, "Đã vượt quá hạn mức sử dụng tính năng"),
        UNCATEGORIZED_EXCEPTION(500, HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi máy chủ nội bộ không xác định");

        private final int code;
        private final HttpStatus httpStatus;
        private final String message;

        ErrorCode(int code, HttpStatus httpStatus, String message) {
            this.code = code;
            this.httpStatus = httpStatus;
            this.message = message;
        }
    }
    ```

---

### 4.4. Ngoại lệ Nghiệp vụ (`AppException.java`)
Unchecked Exception dùng để ném lỗi ở bất kỳ tầng nào (Service, Validator, Security) mà không cần khai báo `throws`.

*   **Vị trí:** `com.multilingo.backend.common.exception.AppException`
*   **Mã nguồn thiết kế:**
    ```java
    package com.multilingo.backend.common.exception;

    import lombok.Getter;

    @Getter
    public class AppException extends RuntimeException {

        private final ErrorCode errorCode;

        public AppException(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        public AppException(ErrorCode errorCode, String customMessage) {
            super(customMessage);
            this.errorCode = errorCode;
        }
    }
    ```

---

### 4.5. Xử lý Lỗi Tập trung (`GlobalExceptionHandler.java`)
Đón bắt toàn bộ ngoại lệ phát sinh trong quá trình xử lý request và chuẩn hóa về đối tượng `ApiResponse<T>`:

*   **Vị trí:** `com.multilingo.backend.common.exception.GlobalExceptionHandler`
*   **Các kịch bản xử lý:**
    1.  **`AppException`:** Trích xuất `errorCode.getCode()`, `errorCode.getHttpStatus()` và message.
    2.  **`MethodArgumentNotValidException` (Validation Error):** Trích xuất danh sách lỗi các trường (Field Errors) thành message rõ ràng (ví dụ: `"email: Định dạng email không hợp lệ, password: Không được để trống"`).
    3.  **`Exception` (Fallback an toàn):** Bắt toàn bộ lỗi chưa được phân loại, ghi log `log.error()`, và trả về `ErrorCode.UNCATEGORIZED_EXCEPTION` (500) để không làm lộ cấu trúc hệ thống hoặc stack trace ra bên ngoài.
*   **Mã nguồn thiết kế:**
    ```java
    package com.multilingo.backend.common.exception;

    import com.multilingo.backend.common.dto.ApiResponse;
    import lombok.extern.slf4j.Slf4j;
    import org.springframework.http.ResponseEntity;
    import org.springframework.validation.FieldError;
    import org.springframework.web.bind.MethodArgumentNotValidException;
    import org.springframework.web.bind.annotation.ExceptionHandler;
    import org.springframework.web.bind.annotation.RestControllerAdvice;

    import java.util.stream.Collectors;

    @Slf4j
    @RestControllerAdvice
    public class GlobalExceptionHandler {

        @ExceptionHandler(AppException.class)
        public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
            ErrorCode errorCode = ex.getErrorCode();
            String message = ex.getMessage() != null ? ex.getMessage() : errorCode.getMessage();
            
            log.warn("Nghiệp vụ ném AppException: code={}, message={}", errorCode.getCode(), message);
            
            ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), message);
            return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
            String details = ex.getBindingResult().getFieldErrors().stream()
                    .map(FieldError::getDefaultMessage)
                    .collect(Collectors.joining(", "));

            log.warn("Lỗi Validation đầu vào: {}", details);

            ErrorCode errorCode = ErrorCode.VALIDATION_FAILED;
            ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), details);
            return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
            log.error("Lỗi không mong muốn phát sinh (Uncaught Exception): ", ex);

            ErrorCode errorCode = ErrorCode.UNCATEGORIZED_EXCEPTION;
            ApiResponse<Void> response = ApiResponse.error(errorCode.getCode(), errorCode.getMessage());
            return ResponseEntity.status(errorCode.getHttpStatus()).body(response);
        }
    }
    ```

---

## 5. ĐỒNG BỘ DỰ ÁN & QUY TẮC PHÁT TRIỂN

### 5.1. Cập nhật `GEMINI.md`
Chỉnh sửa dòng quy tắc số 2 trong `GEMINI.md`:
*   *Cũ:* `- Mọi Entity kế thừa BaseEntity (Primary key là UUID).`
*   *Mới:* `- Mọi Entity kế thừa BaseEntity (Primary key là INT / Integer, tự tăng GenerationType.IDENTITY).`

### 5.2. Căn chỉnh `pom.xml` về Spring Boot 3.3.4 (LTS)
Căn chỉnh version parent trong `backend/pom.xml`:
```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
</parent>
```
Đồng thời chuẩn hóa các dependencies `spring-boot-starter-web` (thay vì webmvc thử nghiệm), và bổ sung dependency H2 database cho profile test.

### 5.3. Cấu hình Kiểm thử Độc lập (`application-test.properties`)
Tạo file `backend/src/test/resources/application-test.properties` sử dụng H2 in-memory:
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

---

## 6. KẾ HOẠCH KIỂM THỬ ĐẦU RA (TEST BASELINE)

Theo phương pháp luận **TDD (Red-Green-Refactor)** và quy tắc **verification-before-completion**, các bài kiểm thử sau bắt buộc phải được cài đặt:

1.  **`ApiResponseTest` (Unit Test):**
    *   Kiểm tra phương thức factory `success()`, `error()` gán đúng các trường `success`, `code`, `message`, `data`, `timestamp`.
2.  **`GlobalExceptionHandlerTest` (`@WebMvcTest` Slice):**
    *   Kiểm tra khi Controller ném `AppException(ErrorCode.RESOURCE_NOT_FOUND)`, kết quả trả về HTTP 404 và JSON `code: 404`.
    *   Kiểm tra khi gửi DTO vi phạm validation (`@NotBlank`), kết quả trả về HTTP 422 kèm danh sách lỗi.
    *   Kiểm tra khi ném lỗi `NullPointerException` hoặc `RuntimeException`, kết quả trả về HTTP 500 kèm `UNCATEGORIZED_EXCEPTION`.
3.  **`BaseEntityAuditingTest` (`@DataJpaTest` Slice):**
    *   Tạo entity kiểm thử kế thừa `BaseEntity`.
    *   Lưu vào CSDL test, xác nhận `id != null`, `createdAt != null`, `updatedAt != null`.
    *   Cập nhật entity, xác nhận `updatedAt` tự động được thay đổi lớn hơn `createdAt`.
4.  **`BackendApplicationTests` (Context Loads Test):**
    *   Kiểm tra toàn bộ ApplicationContext của Spring Boot khởi tạo thành công không phát sinh lỗi bean.

---

## 7. TIÊU CHÍ HOÀN THÀNH (ACCEPTANCE CRITERIA)
*   [ ] Toàn bộ package `common.base`, `common.dto`, `common.exception`, `common.config` được tổ chức sạch sẽ, chuẩn coding convention.
*   [ ] File `GEMINI.md` được cập nhật đồng bộ rule `BaseEntity (INT)`.
*   [ ] File `pom.xml` được căn chỉnh về bản `3.3.4` ổn định, không có dependency xung đột.
*   [ ] `ExamPart.java` và các file liên quan kế thừa `BaseEntity`.
*   [ ] Chạy lệnh `mvn clean test` hoàn thành 100% với log PASS toàn bộ các bài unit/integration test baseline.
