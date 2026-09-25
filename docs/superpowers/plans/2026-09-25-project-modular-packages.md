# Kế Hoạch Khởi Tạo Cấu Trúc Module Cho Team (Modular Packages Implementation Plan)

> **Dành cho kỹ sư AI (Agentic Workers):** BẮT BUỘC sử dụng `superpowers:executing-plans` (Native) hoặc `superpowers:subagent-driven-development` để thực thi tuần tự từng task. Mỗi bước tuân thủ triệt để nghiệm thu bằng **`verification-before-completion`**.

**Mục tiêu:** Khởi tạo khung package chuẩn (scaffolding) cho 5 phân hệ nghiệp vụ (`auth`, `exam`, `testing`, `analytics`, `vocab`) tương ứng với 5 thành viên của team; dọn dẹp toàn bộ mã nguồn thử nghiệm tạm thời (`ExamPart`); tạo `package-info.java` và `README.md` hướng dẫn chi tiết cho từng thành viên.

**Kiến trúc:** Modular Monolith with Layered Feature Packages (`com.multilingo.backend.modules.<module-name>`).

**Tech Stack:** Java 21, Spring Boot 3.3.4, Spring Data JPA, Spring Security, JUnit 5, H2 Test Profile.

**Đặc tả thiết kế (Spec):** [`docs/superpowers/specs/project-modular-packages.md`](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/project-modular-packages.md)

---

## Global Constraints
- Java Version: `21`.
- Spring Boot: `3.3.4`.
- Package gốc các module: `com.multilingo.backend.modules.*`.
- Mọi Entity tương lai kế thừa: `com.multilingo.backend.common.base.BaseEntity`.
- Mọi Controller tương lai trả về: `ResponseEntity<ApiResponse<T>>`.
- Ngoại lệ ném qua: `AppException(ErrorCode.XYZ)`.
- Kiểm thử tự động: `./mvnw clean test` phải luôn đạt 100% PASS sau khi tái cấu trúc.

## Review Focus
1. **Lỗi biên dịch do thiếu file khi xóa `ExamPart`:** Cần đảm bảo không còn class, import hay annotation nào sót lại tham chiếu đến `ExamPart` hoặc `ExamPartRepository`.
2. **Kiểm tra liveness endpoint sau khi dọn package:** Endpoint `/api/health` hoặc `/api/test/hello` vẫn phải hoạt động bình thường, phục vụ kiểm tra hệ thống.
3. **Cấu hình Security không chặn Health Check:** [SecurityConfig.java](file:///f:/Working/JavaBackend/multilingo-platform/backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java) phải mở quyền truy cập `permitAll()` cho `/api/health` và `/api/test/**`.
4. **Tính toàn vẹn của cấu trúc thư mục:** Git không lưu thư mục rỗng, do đó mỗi tầng trong từng module bắt buộc phải có ít nhất 1 file (`.gitkeep` hoặc `package-info.java` hoặc class/interface) để đảm bảo khi team clone về có đầy đủ thư mục.
5. **Độ chính xác tài liệu phân công (`README.md`):** Danh mục use cases và danh sách bảng CSDL trong `README.md` của từng module phải khớp 100% với tài liệu [PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md).

---

## DANH SÁCH TASK CHI TIẾT (BITE-SIZED TASKS)

### Task 1: Dọn dẹp mã nguồn thử nghiệm tạm thời & Thiết lập `HealthCheckController`

**Mục tiêu:** Xóa bỏ hoàn toàn các file `ExamPart*` thử nghiệm, chuyển `TestController` thành `HealthCheckController` tại `com.multilingo.backend.common.controller`, cập nhật `SecurityConfig` và kiểm chứng test suite vẫn pass 100%.

**Files:**
- Xóa: `backend/src/main/java/com/multilingo/backend/entity/ExamPart.java`
- Xóa: `backend/src/main/java/com/multilingo/backend/repository/ExamPartRepository.java`
- Xóa: `backend/src/main/java/com/multilingo/backend/dto/ExamPartDto.java`
- Xóa: `backend/src/main/java/com/multilingo/backend/controller/ExamTestController.java`
- Xóa: `backend/src/main/java/com/multilingo/backend/controller/TestController.java`
- Tạo mới: `backend/src/main/java/com/multilingo/backend/common/controller/HealthCheckController.java`
- Tạo mới test: `backend/src/test/java/com/multilingo/backend/common/controller/HealthCheckControllerTest.java`
- Sửa: `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`

- [x] **Bước 1.1:** Xóa 4 file thử nghiệm tạm thời:
  - `backend/src/main/java/com/multilingo/backend/entity/ExamPart.java`
  - `backend/src/main/java/com/multilingo/backend/repository/ExamPartRepository.java`
  - `backend/src/main/java/com/multilingo/backend/dto/ExamPartDto.java`
  - `backend/src/main/java/com/multilingo/backend/controller/ExamTestController.java`
- [x] **Bước 1.2:** Tạo `HealthCheckController.java` tại `com.multilingo.backend.common.controller`:
  - Mapping: `@GetMapping("/api/health")` và `@GetMapping("/api/test/hello")`
  - Trả về: `ResponseEntity<ApiResponse<Map<String, String>>>`
- [x] **Bước 1.3:** Xóa file cũ `backend/src/main/java/com/multilingo/backend/controller/TestController.java` và các thư mục rỗng cũ `controller`, `dto`, `entity`, `repository` ở root level.
- [x] **Bước 1.4:** Cập nhật `SecurityConfig.java` cho phép truy cập công khai `/api/health` và `/api/test/**`:
  ```java
  .requestMatchers("/api/health", "/api/test/**").permitAll()
  ```
- [x] **Bước 1.5:** Viết bài test `HealthCheckControllerTest.java` kiểm tra endpoint `/api/health` trả về HTTP 200 và `{ success: true, code: 200, message: "Server is healthy", ... }`.
- [x] **Bước 1.6:** Chạy `./mvnw test` để xác nhận toàn bộ test PASS.

---

### Task 2: Khởi tạo Phân hệ `modules.auth` (Thành viên 1)

**Mục tiêu:** Tạo cấu trúc thư mục, `package-info.java` và `README.md` cho phân hệ Xác thực, Phân quyền RBAC, Gói VIP & Thanh toán VNPAY.

**Files:**
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/controller/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/request/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/dto/response/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/entity/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/repository/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/service/impl/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/package-info.java`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/auth/README.md`

- [x] **Bước 2.1:** Tạo cấu trúc thư mục con trong `backend/src/main/java/com/multilingo/backend/modules/auth/`.
- [x] **Bước 2.2:** Viết `package-info.java` khai báo phân hệ `com.multilingo.backend.modules.auth` do Thành viên 1 phụ trách.
- [x] **Bước 2.3:** Viết `README.md` mô tả danh mục 9 Use Case (`UC01`, `UC01.1`, `UC02`, `UC03`, `UC04`, `UC04.1`, `UC04.2`, `UC06`, `UC15.2/16.1`), danh sách 7 bảng CSDL (`users`, `roles`, `permissions`, `role_permissions`, `refresh_tokens`, `subscription_plans`, `transactions`) và quy chuẩn viết code.

---

### Task 3: Khởi tạo Phân hệ `modules.exam` (Thành viên 2)

**Mục tiêu:** Tạo cấu trúc thư mục, `package-info.java` và `README.md` cho phân hệ Onboarding Mục tiêu, Kho Đề thi & CMS Đề thi Đa cấp.

**Files:**
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/controller/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/request/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/entity/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/service/impl/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/package-info.java`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/exam/README.md`

- [x] **Bước 3.1:** Tạo cấu trúc thư mục con trong `backend/src/main/java/com/multilingo/backend/modules/exam/`.
- [x] **Bước 3.2:** Viết `package-info.java` khai báo phân hệ `com.multilingo.backend.modules.exam` do Thành viên 2 phụ trách.
- [x] **Bước 3.3:** Viết `README.md` mô tả danh mục 7 Use Case (`UC05`, `UC07`, `UC07.1`, `UC14.1` -> `UC14.4`), danh sách bảng CSDL (`exams`, `exam_sections`, `exam_parts`) và hướng dẫn định dạng JSONB cho cây câu hỏi.

---

### Task 4: Khởi tạo Phân hệ `modules.testing` (Thành viên 3)

**Mục tiêu:** Tạo cấu trúc thư mục, `package-info.java` và `README.md` cho phân hệ Không gian Thi thử, Luyện tập từng phần & Trợ lý AI Gemini.

**Files:**
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/controller/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/entity/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/repository/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/package-info.java`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/testing/README.md`

- [x] **Bước 4.1:** Tạo cấu trúc thư mục con trong `backend/src/main/java/com/multilingo/backend/modules/testing/`.
- [x] **Bước 4.2:** Viết `package-info.java` khai báo phân hệ `com.multilingo.backend.modules.testing` do Thành viên 3 phụ trách.
- [x] **Bước 4.3:** Viết `README.md` mô tả danh mục 7 Use Case (`UC08`, `UC08.4`, `UC08.5`, `UC09`, `UC09.2`, `UC10`, `UC10.2`), danh sách bảng CSDL (`test_attempts`, `attempt_answers`) và cấu trúc JSONB `ai_feedback` từ Gemini API.

---

### Task 5: Khởi tạo Phân hệ `modules.analytics` (Thành viên 4)

**Mục tiêu:** Tạo cấu trúc thư mục, `package-info.java` và `README.md` cho phân hệ Giám sát Hệ thống, Tracking Hành vi & Kiểm toán Admin.

**Files:**
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/controller/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/request/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/dto/response/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/entity/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/repository/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/service/impl/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/package-info.java`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/analytics/README.md`

- [x] **Bước 5.1:** Tạo cấu trúc thư mục con trong `backend/src/main/java/com/multilingo/backend/modules/analytics/`.
- [x] **Bước 5.2:** Viết `package-info.java` khai báo phân hệ `com.multilingo.backend.modules.analytics` do Thành viên 4 phụ trách.
- [x] **Bước 5.3:** Viết `README.md` mô tả danh mục 8 Use Case (`A_Tracking`, `UC15`, `UC15.1`, `UC15.3`, `UC15.4`, `UC16`, `UC16.2`, `UC16.3`), danh sách bảng CSDL (`audit_logs`, `login_history`, `user_quotas`) và quy chuẩn lưu snapshot JSON khi audit.

---

### Task 6: Khởi tạo Phân hệ `modules.vocab` (Thành viên 5)

**Mục tiêu:** Tạo cấu trúc thư mục, `package-info.java` và `README.md` cho phân hệ Từ điển Ngữ cảnh, Sổ Flashcard SRS, Dashboard & Thông báo.

**Files:**
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/controller/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/request/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/dto/response/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/entity/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/.gitkeep`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/package-info.java`
- Tạo: `backend/src/main/java/com/multilingo/backend/modules/vocab/README.md`

- [x] **Bước 6.1:** Tạo cấu trúc thư mục con trong `backend/src/main/java/com/multilingo/backend/modules/vocab/`.
- [x] **Bước 6.2:** Viết `package-info.java` khai báo phân hệ `com.multilingo.backend.modules.vocab` do Thành viên 5 phụ trách.
- [x] **Bước 6.3:** Viết `README.md` mô tả danh mục 8 Use Case (`UC11`, `UC11.1`, `UC12`, `UC12.1`, `UC12.2`, `UC12.3`, `UC13`, `UC13.1/13.2`), danh sách bảng CSDL (`dictionary_words`, `user_flashcards`, `user_study_stats`, `daily_study_logs`, `notifications`) và thuật toán lặp lại ngắt quãng SuperMemo SM-2.

---

### Task 7: Nghiệm thu Toàn diện (`verification-before-completion`)

**Mục tiêu:** Chạy `./mvnw clean test` xác minh toàn bộ dự án sạch sẽ, không có lỗi import, không có package rác, 100% tests PASS.

- [x] **Bước 7.1:** Kiểm tra lại cây thư mục `backend/src/main/java/com/multilingo/backend/` bằng lệnh hoặc tool xem các root packages (`entity`, `repository`, `dto`, `controller`) đã được xóa sạch hoàn toàn chưa.
- [x] **Bước 7.2:** Chạy lệnh kiểm thử toàn diện:
  ```bash
  cd backend && ./mvnw clean test
  ```
- [x] **Bước 7.3:** Thu thập log và chứng minh 100% tests PASS (không có Failure, không có Error).
