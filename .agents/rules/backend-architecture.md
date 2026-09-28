# ⚡ Multilingo Platform - Quy Tắc Kiến Trúc Backend

## Tiêu chuẩn Entity & Database
- Mọi Entity **BẮT BUỘC** kế thừa `com.multilingo.backend.common.base.BaseEntity`.
- Khóa chính: `Integer id`, tự tăng `GenerationType.IDENTITY`.
- **KHÔNG ĐƯỢC** khai báo lại `id`, `createdAt`, `updatedAt` trong Entity con.
- Trường audit `createdAt` và `updatedAt` kiểu `Instant`, tự động gán bởi JPA Auditing.

## Tiêu chuẩn API Response
- Mọi Controller endpoint **BẮT BUỘC** trả về `ResponseEntity<ApiResponse<T>>`.
- Sử dụng `ApiResponse.success(data)` hoặc `ApiResponse.success("message", data)` cho response thành công.
- Sử dụng `ApiResponse.error(code, message)` cho response lỗi.
- Cấu trúc JSON: `{ success, code, message, data, timestamp }`.

## Tiêu chuẩn Xử lý Lỗi
- Ném lỗi nghiệp vụ qua `throw new AppException(ErrorCode.XYZ)` hoặc `throw new AppException(ErrorCode.XYZ, "custom message")`.
- **KHÔNG** trả response lỗi thủ công qua Map, chuỗi hoặc status code tuỳ tiện.
- `GlobalExceptionHandler` xử lý tập trung: `AppException` (4xx), `MethodArgumentNotValidException` (422), `NoResourceFoundException` (404), `Exception` (500).
- Khi cần ErrorCode mới, bổ sung vào `com.multilingo.backend.common.exception.ErrorCode` enum.

## Package Convention
- Common Infrastructure: `com.multilingo.backend.common.*` (base, dto, exception, config).
- Domain Entities: `com.multilingo.backend.entity.*`
- Domain DTOs: `com.multilingo.backend.dto.*`
- Domain Controllers: `com.multilingo.backend.controller.*`
- Domain Services: `com.multilingo.backend.service.*`
- Domain Repositories: `com.multilingo.backend.repository.*`
