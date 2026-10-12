# TV3-04 — Learner Exam Structure API Implementation Plan

## 1. Repository Findings

- Backend dùng Java 21, Spring Boot 3.3.4, Spring MVC, Spring Security, Spring Data JPA, Lombok, JUnit 5, Mockito và MockMvc.
- TV2 đã cung cấp:
  - `Exam`: `id`, `code`, `title`, `type`, `isPublished`, `isVipOnly`, `durationMinutes`…
  - `ExamSection`: `id`, `skillType`, `title`, `durationMinutes`, `orderIndex`…
  - `ExamPart`: `id`, `partNumber`, `contentData`.
  - Repository: `ExamRepository.findById`, `ExamSectionRepository.findByExam_Id`, `ExamPartRepository.findBySection_Id`.
- `contentData` chứa cả nội dung câu hỏi và dữ liệu chấm. Tiêu đề part được hỗ trợ qua khóa canonical `part_title`, với fallback legacy `title`.
- `SecurityConfig` bảo vệ mọi endpoint không nằm trong danh sách `permitAll`; không có custom `AuthenticationEntryPoint`, nên request chưa xác thực hiện trả HTTP 403.
- `GlobalExceptionHandler` chuyển `AppException(ErrorCode.EXAM_NOT_FOUND)` thành HTTP 404, business code `1401`.
- Frontend `ExamStartPage` và `ScopeModePicker` đang dùng metadata và ID section/part hardcode. TV3-04 chỉ cung cấp backend API; frontend wiring nằm ngoài phạm vi.
- Worktree đang có bản TV3-04 dở dang chưa track:
  - DTO, service interface, service implementation và service test.
  - DTO hiện thiếu `code`, section duration và dùng tên `order` thay vì tên nguồn `orderIndex`/`partNumber`.
  - Chưa có controller hoặc HTTP/security test.
- Worktree cũng có thay đổi TV3-03 không liên quan. Gemini không được reset hoặc sửa các file này.
- Baseline mục tiêu đã kiểm tra:
  - `LearnerExamStructureServiceTest`: 2/2 test pass.
  - `AdminExamControllerTest`: 6/6 test pass.
  - Chưa chạy full suite theo ràng buộc.

## 2. Confirmed Architecture

- TV3 sở hữu controller trong package `modules.testing`; không thêm learner endpoint vào `AdminExamController`.
- Luồng xử lý:
  1. `LearnerExamStructureController` nhận `GET /api/v1/exams/{id}/structure`.
  2. `LearnerExamStructureService.getPublishedExamStructure(Integer examId)` tải exam.
  3. Exam không tồn tại hoặc chưa publish đều ném `AppException(EXAM_NOT_FOUND)`.
  4. Service đọc section và part qua repository TV2, chỉ đọc, trong transaction `readOnly`.
  5. Service ánh xạ vào DTO whitelist và sắp xếp ổn định.
  6. Controller bọc DTO bằng `ApiResponse.success(...)`.
- Không kiểm tra `isVipOnly`, subscription tier hoặc `UserQuota`. Published exam có `isVipOnly=true` vẫn truy cập được.
- Không thêm repository method, migration, entity, dependency hoặc query ghi dữ liệu.
- Thứ tự:
  - Section: `orderIndex` tăng dần, hòa thì `id` tăng dần.
  - Part: `partNumber` tăng dần, hòa thì `id` tăng dần.
  - Không đánh lại ID hoặc tự sinh order.
- Không thêm `@PreAuthorize`; sử dụng rule `anyRequest().authenticated()` hiện có để tránh khóa nhầm learner do role naming chưa đồng nhất.

## 3. API Contract

### Request

```http
GET /api/v1/exams/{id}/structure
Authorization: Bearer <JWT>
```

- `id`: `Integer`, là ID thật của `Exam`.
- Không có query parameter hoặc request body.

### Response 200

```json
{
  "success": true,
  "code": 200,
  "message": "Success",
  "data": {
    "id": 9,
    "code": "IELTS-1",
    "title": "IELTS Mock",
    "type": "IELTS",
    "durationMinutes": 120,
    "sections": [
      {
        "id": 70,
        "skillType": "READING",
        "title": "Reading Section",
        "durationMinutes": 60,
        "orderIndex": 1,
        "parts": [
          {
            "id": 701,
            "partNumber": 1,
            "title": "Reading Part 1"
          }
        ]
      }
    ]
  },
  "timestamp": "<ISO-8601>"
}
```

### DTO và nguồn dữ liệu

| JSON field | Java type | Nguồn |
|---|---|---|
| `id` | `Integer` | `Exam.id` |
| `code` | `String` | `Exam.code` |
| `title` | `String` | `Exam.title` |
| `type` | `String` | `Exam.type` |
| `durationMinutes` | `Integer` | `Exam.durationMinutes` |
| `sections` | `List<Section>` | `ExamSectionRepository.findByExam_Id` |
| `sections[].id` | `Integer` | `ExamSection.id` |
| `sections[].skillType` | `String` | `ExamSection.skillType` |
| `sections[].title` | `String` | `ExamSection.title` |
| `sections[].durationMinutes` | `Integer` | `ExamSection.durationMinutes` |
| `sections[].orderIndex` | `Integer` | `ExamSection.orderIndex` |
| `sections[].parts` | `List<Part>` | `ExamPartRepository.findBySection_Id` |
| `parts[].id` | `Integer` | `ExamPart.id` |
| `parts[].partNumber` | `Integer` | `ExamPart.partNumber` |
| `parts[].title` | `String`, nullable | `contentData.part_title`, fallback `contentData.title` |

Không trả part duration vì entity/schema không có trường này.

### Error contract

- Exam thiếu hoặc chưa publish:
  - HTTP 404.
  - `success=false`, `code=1401`, message từ `EXAM_NOT_FOUND`.
  - Hai trường hợp dùng cùng response để không làm lộ trạng thái draft.
- Chưa xác thực:
  - HTTP 403 theo `SecurityConfig` hiện tại.
  - Không cam kết `ApiResponse` body vì request bị Spring Security chặn trước controller.
- Section không có part hoặc exam không có section: trả danh sách rỗng.
- Thiếu `part_title` và `title`: trả `"title": null`; không suy diễn tên từ part number.

## 4. Exact Files to Change

### Tạo mới

- `backend/src/main/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureController.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/LearnerExamStructureControllerIT.java`

### Hoàn thiện các file chưa track hiện có

- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/LearnerExamStructureResponse.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureService.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/LearnerExamStructureServiceImpl.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/LearnerExamStructureServiceTest.java`

### Không sửa

- Các entity/repository trong `modules.exam`.
- `SecurityConfig`, `ErrorCode`, `GlobalExceptionHandler`.
- `AdminExamController` và admin DTO/service.
- Frontend.
- Các file TV3-03 đang modified/untracked.
- Migration hoặc schema DB.

## 5. Step-by-Step Implementation Tasks

### TV3-04-01 — Khóa DTO và service contract

**Mục tiêu:** Trả đúng metadata nguồn, ID thật và thứ tự ổn định.

**Prerequisites:** Các entity/repository TV2 và bốn file TV3-04 chưa track hiện có.

**Interfaces:**

```java
LearnerExamStructureResponse getPublishedExamStructure(Integer examId);
```

DTO phải có đúng các field trong mục 3, dùng camelCase mặc định của Jackson.

**Các bước:**

- [ ] Mở rộng `LearnerExamStructureServiceTest` trước:
  - Published exam có `isVipOnly=true` vẫn trả thành công.
  - Assert toàn bộ exam/section/part fields.
  - Repository trả dữ liệu đảo thứ tự; response phải sort theo metadata.
  - Hai record cùng order phải sort theo ID.
  - Part thiếu cả `part_title` và `title` trả title null.
  - Exam/section không có con trả list rỗng.
  - Missing và unpublished cùng ném `EXAM_NOT_FOUND`.
  - Với missing/unpublished, verify section/part repository không được gọi.
- [ ] Chạy test và xác nhận fail vì DTO hiện thiếu/sai field.
- [ ] Sửa `LearnerExamStructureResponse`:
  - Exam: `id`, `code`, `title`, `type`, `durationMinutes`, `sections`.
  - Section: `id`, `skillType`, `title`, `durationMinutes`, `orderIndex`, `parts`.
  - Part: `id`, `partNumber`, `title`.
- [ ] Giữ Lombok convention hiện có: `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor`.
- [ ] Sửa service implementation:
  - Giữ `@Service`, `@RequiredArgsConstructor`, `@Transactional(readOnly = true)`.
  - Dùng đúng ba repository hiện có.
  - Filter `Boolean.TRUE.equals(exam.getIsPublished())`.
  - Không đọc hoặc kiểm tra `isVipOnly`.
  - Sort section/part trong service; tie-break bằng ID.
  - Chỉ đọc hai khóa tiêu đề từ map; không serialize hoặc mutate map.
  - Bỏ các alias `name`, `order` của bản nháp.
  - Không tạo lỗi nghiệp vụ mới cho metadata `NOT NULL` do DB đã ràng buộc.
- [ ] Chạy lại unit test và xác nhận pass.

**Edge cases:** duplicate order, empty lists, null content map, thiếu part title, published VIP flag.

**Lệnh:**

```powershell
cd backend
.\mvnw.cmd "-Dtest=LearnerExamStructureServiceTest" test
```

**Acceptance:** Test pass; response không dùng ID giả, part duration giả hoặc tên/order suy diễn.

**Deliverables:** DTO và read-only service hoàn chỉnh.

---

### TV3-04-02 — Thêm HTTP endpoint và security/serialization tests

**Mục tiêu:** Công bố endpoint authenticated learner với envelope chuẩn.

**Target methods:**

```java
@GetMapping("/{id}/structure")
public ResponseEntity<ApiResponse<LearnerExamStructureResponse>> getExamStructure(
        @PathVariable Integer id);
```

**Các bước:**

- [ ] Viết `LearnerExamStructureControllerIT` trước bằng:
  - `@SpringBootTest`
  - `@AutoConfigureMockMvc`
  - `@ActiveProfiles("test")`
  - `@MockBean LearnerExamStructureService`
- [ ] Thêm test authenticated `ROLE_USER`:
  - HTTP 200.
  - Envelope `success/code/message/data/timestamp`.
  - ID và order giữ nguyên.
- [ ] Thêm test service ném `EXAM_NOT_FOUND`:
  - HTTP 404.
  - `$.success=false`, `$.code=1401`.
- [ ] Thêm test không có authentication:
  - HTTP 403.
  - Verify service không được gọi.
- [ ] Thêm test whitelist serialization, xác nhận JSON không có:
  - `isPublished`, `isVipOnly`, `createdBy`, `createdAt`, `updatedAt`.
  - `audioUrl`, `thumbnailUrl`.
  - `contentData`, `questions`, `questionGroups`, `instruction`, `contentHtml`.
  - `correctAnswer`, `correct_answer`, `solution`, `explanation`.
  - `gradingKey`, `gradingKeys`, `aiPromptContext`, `ai_prompt_context`.
- [ ] Chạy test và xác nhận fail vì controller chưa tồn tại.
- [ ] Tạo `LearnerExamStructureController`:
  - Package `modules.testing.controller`.
  - `@RestController`, `@RequestMapping("/api/v1/exams")`, `@RequiredArgsConstructor`.
  - Chỉ inject `LearnerExamStructureService`.
  - Không inject identity, user, subscription hoặc quota service.
- [ ] Chạy lại integration test.

**Lệnh:**

```powershell
.\mvnw.cmd "-Dtest=LearnerExamStructureControllerIT" test
```

**Acceptance:** Endpoint đúng URL, authenticated learner nhận 200, anonymous nhận 403, lỗi nghiệp vụ dùng envelope chuẩn, JSON chỉ có whitelist fields.

**Deliverables:** Controller và HTTP integration test.

---

### TV3-04-03 — Regression và bàn giao

**Mục tiêu:** Chứng minh endpoint mới không ảnh hưởng admin API hay các thay đổi TV3 khác.

**Các bước:**

- [ ] Chạy toàn bộ test tập trung của TV3-04 cùng admin regression.
- [ ] Kiểm tra `git diff`/`git status`; chỉ sáu file TV3-04 được tạo/sửa ngoài các thay đổi đã tồn tại trước task.
- [ ] Kiểm tra không có migration, dependency, repository write hoặc frontend diff.
- [ ] Báo cáo số test pass và các warning baseline; không tuyên bố full suite pass.

**Lệnh:**

```powershell
.\mvnw.cmd "-Dtest=LearnerExamStructureServiceTest,LearnerExamStructureControllerIT,AdminExamControllerTest" test
git status --short
git diff --check
```

**Acceptance:** Tất cả test tập trung pass; sáu admin controller tests tiếp tục pass; không có whitespace error.

**Deliverables:** Log kiểm chứng và diff summary, không commit/push.

## 6. Test Cases and Commands

### Required

| ID | Kịch bản | Kết quả bắt buộc |
|---|---|---|
| `TC_EXAM_STRUCTURE_01` | Learner đã xác thực đọc published exam | 200, đúng envelope và metadata |
| `TC_EXAM_STRUCTURE_02` | Published exam có `isVipOnly=true` | Vẫn 200; không gọi quota/subscription |
| `TC_EXAM_STRUCTURE_03` | Repository trả section/part sai thứ tự | Sort theo `orderIndex`/`partNumber`, tie bằng ID |
| `TC_EXAM_STRUCTURE_04` | Exam không tồn tại | 404, code 1401 |
| `TC_EXAM_STRUCTURE_05` | Exam chưa publish | Cùng 404/code 1401; không tải cấu trúc |
| `TC_EXAM_STRUCTURE_06` | Request chưa xác thực | 403; service không được gọi |
| `TC_EXAM_STRUCTURE_07` | Part thiếu title metadata | 200, `title=null`, không tự sinh tên |
| `TC_EXAM_STRUCTURE_08` | Exam/section không có con | `sections=[]` hoặc `parts=[]` |
| `TC_EXAM_STRUCTURE_09` | Kiểm tra JSON whitelist | Không có nội dung câu hỏi, đáp án, grading/admin fields |
| `TC_EXAM_STRUCTURE_10` | Admin controller regression | 6 test hiện có tiếp tục pass |

### Optional improvements, không thuộc TV3-04

- Chuẩn hóa toàn hệ thống từ anonymous 403 sang JSON 401.
- Bulk-load parts để tránh N+1 query khi cấu trúc đề rất lớn.
- Thêm OpenAPI annotations.
- Frontend gọi endpoint và thay section/part hardcode.
- Chuẩn hóa lỗi path variable không phải số.

### Acceptance criteria

```gherkin
Given một learner đã xác thực và một exam đã publish
When gọi GET /api/v1/exams/{id}/structure
Then hệ thống trả metadata Exam/Section/Part với ID thật và thứ tự ổn định
And không trả question content hoặc grading data
And giá trị isVipOnly không ảnh hưởng quyền truy cập
```

```gherkin
Given exam không tồn tại hoặc chưa publish
When learner gọi endpoint structure
Then hệ thống trả HTTP 404 với code 1401
And không đọc section hoặc part
```

```gherkin
Given request không có authentication
When gọi endpoint structure
Then Spring Security trả HTTP 403
And controller service không được thực thi
```

## 7. Security Requirements

- Dùng DTO whitelist; tuyệt đối không trả entity trực tiếp.
- Không đưa `contentData` vào DTO.
- Chỉ lấy `part_title` hoặc fallback `title` từ map.
- Draft exam và missing exam phải không phân biệt được qua HTTP response.
- Không kiểm tra VIP, subscription hoặc Gemini quota.
- Không log `contentData`, question, answer key hoặc solution.
- Không thay đổi auth rule chung, role model hoặc security entry point.
- Endpoint không được tái sử dụng admin detail API vì API đó trả cấu trúc authoring chứa `contentData`.

## 8. Dependencies and Blockers

- Không còn blocker sản phẩm sau các quyết định đã khóa.
- Bản nháp TV3-04 hiện có phải được chỉnh, không tạo song song một bộ class khác.
- Worktree bẩn là ràng buộc quan trọng: Gemini phải giữ nguyên toàn bộ thay đổi TV3-03 và `TV3-03-review.patch`.
- Canonical part title là `part_title`; fallback `title` được giữ để tương thích dữ liệu legacy đang được `MockDataSeeder` và `DbExamAdapter` hỗ trợ.
- HTTP 403 anonymous là quyết định tương thích hiện tại, không phải chuẩn hóa REST toàn hệ thống.

## 9. Definition of Done

- Endpoint `GET /api/v1/exams/{id}/structure` hoạt động cho authenticated learner.
- Published exam truy cập được bất kể `isVipOnly`.
- Missing và unpublished đều trả 404/code 1401.
- Response đúng contract tối thiểu, dùng ID và ordering thật.
- Không có part duration hoặc schema field tự sáng tạo.
- JSON không chứa question, solution, grading key, admin metadata hoặc toàn bộ `contentData`.
- Test service, controller integration và admin regression đều pass.
- Không sửa TV2 entity/repository, SecurityConfig, admin API, frontend hoặc DB.
- Không chạy full suite, không commit và không push.

## 10. Gemini Execution Instructions

1. Đọc `GEMINI.md`, plan này và sáu file TV3-04 được liệt kê.
2. Chạy `git status --short`; ghi nhận và bảo toàn toàn bộ thay đổi có sẵn.
3. Thực hiện đúng TDD: mở rộng test đỏ → thay đổi nhỏ nhất → test xanh → refactor.
4. Không đổi tên endpoint, DTO fields hoặc error behavior đã chốt.
5. Không thêm repository method, dependency, migration hay abstraction mới.
6. Không sửa frontend hoặc dùng admin API làm learner endpoint.
7. Chỉ chạy các test tập trung trong mục 6; không chạy full suite.
8. Trước khi kết thúc, cung cấp:
   - Danh sách file đã đổi.
   - Kết quả từng lệnh test.
   - Xác nhận sensitive fields không xuất hiện.
   - `git diff --check`.
9. Không commit hoặc push.
