# UC14.1 & UC14.2 Exam Builder API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng API cho phép Admin lưu mới (POST) và cập nhật (PUT) toàn bộ cấu trúc Đề thi đa cấp bậc (Exam -> Section -> Part) cùng lúc (RESTful Aggregation) vào Database PostgreSQL (dùng `JSONB` cho content_data).

**Architecture:** Sử dụng Spring Boot MVC. Nhận payload lớn từ Client. Tại tầng Service, mở Transaction. Với tạo mới: insert tuần tự Exam, Sections, Parts. Với cập nhật: update Exam, xóa toàn bộ Sections/Parts cũ bằng `deleteByExamId`, sau đó insert lại (Replace-All Strategy) để tránh rủi ro lệch map ID khi frontend thêm/bớt câu hỏi.

**Tech Stack:** Java 23, Spring Boot 3.3.4, Spring Data JPA, Hibernate, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-10-06-exam-builder-api-design.md`

## Global Constraints

- Tuân thủ quy tắc Base Architecture: Trả về `ResponseEntity<ApiResponse<T>>`.
- Xử lý lỗi ném `AppException(ErrorCode.XYZ)` và để `GlobalExceptionHandler` bắt.
- File JSONB mapping sử dụng `Map<String, Object>` và `ObjectMapper` chuẩn của Spring.
- Toàn bộ service method update/create phải có `@Transactional`.

## Review Focus

- Gửi lên payload rỗng hoặc thiếu field bắt buộc (title, skill_type) -> Báo lỗi 400 Validation.
- Gửi PUT update vào `exam_id` không tồn tại trong DB -> Báo lỗi `EXAM_NOT_FOUND`.
- Đảm bảo khi lưu Part, `section_id` phải được set từ Section cha vừa được lưu vào.
- Nếu lỗi xảy ra khi đang lưu Part cuối cùng -> Rollback toàn bộ Exam và Section trước đó (Test Transaction).
- Khi update (Replace-All), đảm bảo các bản ghi Section/Part cũ thực sự bị xóa khỏi DB.

---

### Task 1: Định nghĩa các Request DTOs cho Exam Builder

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/request/ExamBuilderRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/request/SectionBuilderRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/dto/request/PartBuilderRequest.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/exam/dto/request/ExamBuilderRequestValidationTest.java`

**Interfaces:**
- Produces: `ExamBuilderRequest`, `SectionBuilderRequest`, `PartBuilderRequest` with JSR-303 validation (`@NotBlank`, `@NotNull`, `@NotEmpty`).

- [ ] **Step 1: Write the failing test**
Viết `ExamBuilderRequestValidationTest` sử dụng `Validator` để kiểm tra lỗi khi truyền payload thiếu `title` hoặc danh sách `sections` rỗng.

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=ExamBuilderRequestValidationTest`
Expected: FAIL (lớp DTO chưa tồn tại hoặc chưa cấu hình validation).

- [ ] **Step 3: Write minimal implementation**
Tạo các record hoặc class DTO với Lombok. Bổ sung các annotation `@NotBlank`, `@Valid`, `@NotNull`.
`PartBuilderRequest` chứa `Integer partNumber` và `Map<String, Object> contentData`.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=ExamBuilderRequestValidationTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/exam/dto/request/*.java backend/src/test/java/com/multilingo/backend/modules/exam/dto/request/*.java
git commit -m "feat(exam): add DTOs for Exam Builder API"
```

### Task 2: Cập nhật Repository & Định nghĩa Service Interface

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/ExamSectionRepository.java` (nếu chưa có `deleteByExamId`)
- Modify: `backend/src/main/java/com/multilingo/backend/modules/exam/repository/ExamPartRepository.java` (nếu chưa có `deleteBySectionIdIn`)
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/service/AdminExamService.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/exam/repository/ExamRepositoryUpdateTest.java`

**Interfaces:**
- Produces: `void deleteByExam_Id(Integer examId)` trong SectionRepo. `void deleteBySection_IdIn(List<Integer> sectionIds)` trong PartRepo.
- Produces: `Integer createExam(ExamBuilderRequest req)` và `void updateExam(Integer id, ExamBuilderRequest req)`.

- [ ] **Step 1: Write the failing test**
Viết DataJpaTest tạo Exam, Section, Part. Thử gọi hàm xóa custom `deleteByExam_Id`.

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=ExamRepositoryUpdateTest`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**
Thêm các custom method (VD: `@Modifying @Query("DELETE FROM ExamSection s WHERE s.exam.id = :examId")`) vào Repository.
Khai báo interface `AdminExamService` với 2 method `createExam` và `updateExam`.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=ExamRepositoryUpdateTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "feat(exam): add repository methods and AdminExamService interface"
```

### Task 3: Tầng Service - Logic Create & Update Exam (Replace-All Strategy)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/service/impl/AdminExamServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/exam/service/impl/AdminExamServiceImplTest.java`

**Interfaces:**
- Consumes: `ExamBuilderRequest`, `ExamRepository`, `ExamSectionRepository`, `ExamPartRepository`.
- Produces: Service layer bean được `@Transactional` quản lý, thực hiện đúng spec.

- [ ] **Step 1: Write the failing test**
Viết Unit Test dùng Mockito mock Repositories. Test case 1: `createExam` trả về ID và verify `save` được gọi. Test case 2: `updateExam` ném `AppException` nếu ID không có. Test case 3: `updateExam` xóa các sections cũ và thêm mới.

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=AdminExamServiceImplTest`
Expected: FAIL (Service implementation chưa có hoặc trả về null).

- [ ] **Step 3: Write minimal implementation**
Tạo class `AdminExamServiceImpl` implements `AdminExamService`.
- Trong `createExam`: Map DTO sang `Exam`, save. Lặp sections map qua `ExamSection`, gán exam, save. Lặp parts map qua `ExamPart`, gán section, save.
- Trong `updateExam`: Tìm `Exam`. Lấy list section IDs cũ. Gọi `partRepo.deleteBySectionIdIn(...)` và `sectionRepo.deleteByExamId(...)`. Cập nhật `Exam`, và lưu lại list Section/Part mới y hệt luồng create.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=AdminExamServiceImplTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "feat(exam): implement AdminExamServiceImpl for create and update"
```

### Task 4: API Controller cho Exam Builder

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/exam/controller/AdminExamController.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/exam/controller/AdminExamControllerTest.java`

**Interfaces:**
- Consumes: `AdminExamService`
- Produces: `POST /api/admin/exams`, `PUT /api/admin/exams/{id}` trả về `ApiResponse<Integer>` và `ApiResponse<Void>`.

- [ ] **Step 1: Write the failing test**
Dùng `@WebMvcTest(AdminExamController.class)`. Mock `AdminExamService`. Test POST trả status 201 Created. Test POST truyền JSON rỗng bị 400 Bad Request.

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=AdminExamControllerTest`
Expected: FAIL (404 Not Found do Controller chưa mapping).

- [ ] **Step 3: Write minimal implementation**
Tạo `AdminExamController`, thêm `@RestController`, `@RequestMapping("/api/admin/exams")`. Bổ sung `@PostMapping` và `@PutMapping("/{id}")` với `@Valid @RequestBody ExamBuilderRequest`. Wrap kết quả vào `ApiResponse.success()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=AdminExamControllerTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add .
git commit -m "feat(exam): expose Admin Exam API endpoints"
```
