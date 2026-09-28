---
name: multilingo-debugging
description: "Sử dụng khi gặp lỗi runtime, test failures hoặc hành vi bất thường trong Multilingo Platform. Hướng dẫn debug có hệ thống theo đặc thù kiến trúc dự án."
---

# Debug Có Hệ Thống Trong Multilingo (Systematic Debugging)

Skill này hướng dẫn quy trình debug có hệ thống, chuyên biệt cho kiến trúc Multilingo Platform.

**Công bố khi bắt đầu:** "Tôi đang sử dụng skill `multilingo-debugging` để phân tích và khắc phục lỗi."

---

## Bước 1: Thu thập Bằng chứng

- **Đọc kỹ toàn bộ stack trace / error log.** Không đoán mò.
- Xác định chính xác: File nào? Dòng nào? Exception class nào?
- Tái hiện lỗi bằng lệnh cụ thể:
  ```bash
  # Chạy một test cụ thể
  cd backend && ./mvnw test -Dtest=TênTestClass#tênMethod
  
  # Chạy toàn bộ test suite
  cd backend && ./mvnw clean test
  ```

## Bước 2: Phân loại Lỗi

| Loại lỗi | Dấu hiệu | Hướng điều tra |
| :--- | :--- | :--- |
| **DB Connection** | `PSQLException`, `password authentication failed`, `Connection refused` | Kiểm tra port `5434`, Docker `multilingo-postgres` running, `application.properties` |
| **Entity Mapping** | `MappingException`, `Unknown entity`, cột không tồn tại | Entity có kế thừa `BaseEntity`? `@Table` đúng tên? `ddl-auto=update`? |
| **API Response** | Status 500 thay vì 4xx, thiếu trường `success/code/message` | Controller có trả `ResponseEntity<ApiResponse<T>>`? Lỗi có được `GlobalExceptionHandler` bắt? |
| **Validation** | `MethodArgumentNotValidException`, 422 | DTO có annotation `@Valid`? `@NotBlank`, `@Min` đúng trường? |
| **Test Context** | `NoSuchBeanDefinitionException`, `ApplicationContext` failed | Test có `@ActiveProfiles("test")`? `@WebMvcTest` có `@Import` đủ beans? |
| **Redis** | `RedisConnectionException` | Docker `multilingo-redis` running? Port `6379` open? |
| **Frontend Build** | TypeScript errors, Vite build fail | `npm run lint` trước, kiểm tra import paths, interface types |

## Bước 3: Xác định Root Cause

- Đưa ra **MỘT** giả thuyết cụ thể trước khi sửa.
- Xác minh giả thuyết bằng bằng chứng (log, test output).
- **KHÔNG** sửa nhiều chỗ cùng lúc — thay đổi một điểm, kiểm tra lại.

## Bước 4: Khắc phục & Kiểm chứng

- Sửa code theo root cause đã xác định.
- Chạy lại test/lệnh gây lỗi ban đầu.
- Chạy toàn bộ test suite xác nhận không gây regression:
  ```bash
  cd backend && ./mvnw clean test
  cd frontend && npm run lint && npm run build
  ```

## Bước 5: Ghi nhận & Phòng ngừa

- Nếu lỗi do thiếu test → Bổ sung test case cover trường hợp này.
- Nếu lỗi do cấu hình → Cập nhật tài liệu `.agents/rules/` hoặc `docs/TEAM_DEVELOPMENT_GUIDE.md`.
