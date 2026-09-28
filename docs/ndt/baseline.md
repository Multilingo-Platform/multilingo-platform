# Baseline Build & Trạng thái Hệ thống (Sau Merge origin/develop)

**Thời gian kiểm tra:** 2026-09-28 22:17 (UTC+7)  
**Branch hiện tại:** `feature/UC08-testing-module-foundation`  
**Thực hiện bởi:** TV3 (Testing Module Developer)  

---

## 1. Kết quả Build thực tế

| Hạng mục | Kết quả | Chi tiết & Ghi chú |
|---|---|---|
| **Java Version System** | `java version "25.0.4"` | ⚠️ Default PATH trỏ Java 25 gây lỗi compiler Lombok AST (`TypeTag :: UNKNOWN`) |
| **Java Version Target** | `jdk-21.0.12` | ✅ Đã kiểm tra tại `C:\Program Files\Java\jdk-21.0.12`. Khi set `JAVA_HOME=...jdk-21`, compile hoàn toàn thành công |
| **Backend Compile** | ✅ **BUILD SUCCESS** | Lệnh: `.\mvnw.cmd compile` với JDK 21. Thời gian: 6.6s, 38 source files |
| **Frontend Build** | ✅ **BUILD SUCCESS** | Lệnh: `npm run build`. `tsc -b && vite build` hoàn thành trong 430ms, 0 lỗi |
| **Maven Plugin Trùng** | ⚠️ **Cảnh báo** | `pom.xml` dòng 83-86 và 87-93 khai báo trùng `spring-boot-maven-plugin`. Cần xin phép team fix |
| **Frontend Test Runner** | ❌ **Chưa có** | `package.json` frontend chưa có `vitest` / `jest`. Task S00-11 cần xin phép cài đặt |

---

## 2. Ranh giới & Hiện trạng Codebase Module TV3

### 2.1 Backend (`com.multilingo.backend.modules.testing`)

```
com.multilingo.backend.modules.testing/
├── controller/       [.gitkeep — chưa có file]
├── dto/
│   ├── request/      [.gitkeep — chưa có file]
│   └── response/     [.gitkeep — chưa có file]
├── entity/
│   ├── TestAttempt.java    [EXISTS — thiếu 3 cột: deadline, examSnapshot, version]
│   └── AttemptAnswer.java  [EXISTS — đầy đủ các trường JSONB: userAnswers, isCorrectFlags, aiFeedback, skillStats]
├── repository/       [.gitkeep — chưa có file]
└── service/
    └── impl/         [.gitkeep — chưa có file]
```

### 2.2 Frontend (`frontend/src/features/exam/`)

Thư mục `frontend/src/features/exam/` hiện tại **chưa được tạo**. Sẽ tạo theo Task S00-05, S00-06, S00-07.

---

## 3. Kiến trúc Base & Các Ràng buộc Hệ thống

| Thành phần | File nguồn | Mô tả / Quy chuẩn bắt buộc |
|---|---|---|
| **Base Entity** | `com.multilingo.backend.common.base.BaseEntity` | Cung cấp `Integer id` (IDENTITY), `Instant createdAt`, `Instant updatedAt`. Mọi Entity TV3 phải kế thừa |
| **API Response** | `com.multilingo.backend.common.dto.ApiResponse<T>` | Chuẩn phản hồi JSON thống nhất: `success`, `code`, `message`, `data`, `timestamp` |
| **Exception** | `com.multilingo.backend.common.exception.AppException` | Ném lỗi nghiệp vụ: `throw new AppException(ErrorCode.XYZ)` |
| **Error Handling** | `com.multilingo.backend.common.exception.GlobalExceptionHandler` | Bắt tập trung `AppException`, `MethodArgumentNotValidException`, `NoResourceFoundException`... |
| **Database** | `docker-compose.yml`, `application.properties` | PostgreSQL 16 (port 5434), fallback env var `DB_PORT:5434`, `ddl-auto=update` |
| **Test Database** | `pom.xml` | Đã có H2 in-memory scope=test. Định hướng dùng `application-test.properties` (H2 PostgreSQL mode) |
| **Security** | `SecurityConfig.java` | Hiện tại `anyRequest().authenticated()`. Cần cấu hình test profile để bypass security trong integration tests |

---

## 4. Hành động tiếp theo

1. **S00-12**: Tạo `application-test.properties` (H2) và `SmokeTest.java` cho testing module, chứng minh `./mvnw test` xanh.
2. **S00-07 & S00-08**: Định nghĩa TypeScript API types và State machine document cho attempt lifecycle.
3. Gửi đề xuất M00-01 (content_data schema) cho TV2 và M00-03 (JWT payload) cho TV1.
