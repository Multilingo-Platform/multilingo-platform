# Sprint 01 — AC & Test Design: Lưu trữ và khởi tạo phiên thi

> **Skill:** acceptance-criteria-and-test-design  
> **Ngày tạo:** 2026-09-28  
> **Tác giả:** TV3  
> **Sprint:** 01 — Attempt Persistence & Start  

---

## Bước 1 — Phân tích Scope & Actor

### Actor
| Actor | Vai trò |
|---|---|
| **Học viên (student)** | Tạo phiên thi, đọc lại workspace. Sprint 01: dùng fixture identity — `userId = 1` hardcode vì TV1 chưa xong JWT. |
| **Backend System** | Validate, snapshot đề, tính deadline, lưu DB. |
| **Test client** | Gọi API qua `permitAll()` trong dev/test profile. |

### In-Scope (Sprint 01)
- Migration schema: `test_attempts`, `attempt_answers`.
- Mapping Entity + enum (`TestScope`, `TestMode`, `AttemptStatus`).
- Mapping JSONB: `exam_snapshot`, `user_answers`, `is_correct_flags`, `ai_feedback`.
- Service: `createAttempt` — validate → snapshot → deadline → lưu DB → `WorkspaceResponse`.
- Service: `getAttemptWorkspace` — đọc → ownership check → trả workspace (không có answer key).
- Controller: `POST /api/v1/attempts`, `GET /api/v1/attempts/{id}`.
- Security: `permitAll()` cho `/api/v1/attempts/**`.
- Integration test với H2 in-memory.

### Out-of-Scope (Sprint sau)
- Lưu nháp đáp án → Sprint 03  
- Nộp bài → Sprint 04  
- Timer/auto-submit → Sprint 05  
- JWT thật TV1 → Tích hợp cuối  
- Testcontainers PostgreSQL → Sprint sau nếu cần

---

## Bước 2 — Acceptance Criteria (Gherkin)

### UC-01: Tạo phiên thi hợp lệ (Mock Test - Full Exam)

```gherkin
Kịch bản: Học viên tạo Mock Test toàn đề thành công
  Given backend chạy với H2 test database
  And fixture exam id=1, duration_minutes=180 (toàn bài), 3 sections, 6 parts
  And fixture identity userId=1
  When POST /api/v1/attempts body: {examId:1, testScope:FULL_EXAM, testMode:MOCK_TEST}
  Then HTTP 201 Created
  And ApiResponse<WorkspaceResponse> với success=true
  And attemptId (Integer > 0), status=IN_PROGRESS
  And deadline = startTime + 180 phút (UTC Instant)
  And examSnapshot khớp fixture (không có correct_answer)
  And DB có 1 bản ghi test_attempts status=IN_PROGRESS
```

### UC-02: Practice Single Skill (không có deadline)

```gherkin
Kịch bản: Học viên tạo Practice cho một Section
  Given fixture exam id=1, section "Reading" sectionId=1
  When POST /api/v1/attempts body: {examId:1, testScope:SINGLE_SKILL, testMode:PRACTICE, targetSectionId:1}
  Then HTTP 201 Created
  And WorkspaceResponse.deadline = null
  And examSnapshot chỉ chứa section đã chọn
  And DB: test_scope=SINGLE_SKILL, test_mode=PRACTICE
```

### UC-03: Practice Single Part

```gherkin
Kịch bản: Practice một Part cụ thể
  Given fixture exam, partId=3 thuộc sectionId=1 thuộc examId=1
  When POST /api/v1/attempts body: {examId:1, testScope:SINGLE_PART, testMode:PRACTICE, targetPartId:3}
  Then HTTP 201 Created
  And examSnapshot chỉ chứa Part đó, deadline=null
```

### UC-04: Đọc workspace attempt đang làm

```gherkin
Kịch bản: Mở lại bài đang làm
  Given attempt id=5, userId=1, IN_PROGRESS
  When GET /api/v1/attempts/5
  Then HTTP 200 OK
  And response chứa đúng attemptId=5
  And examSnapshot KHÔNG chứa correct_answer hoặc explanation
```

### UC-05: Từ chối attempt của người khác

```gherkin
Kịch bản: Học viên cố đọc attempt không phải của mình
  Given attempt id=10, userId=99; identity=userId=1
  When GET /api/v1/attempts/10
  Then HTTP 403 Forbidden, success=false, code=403
```

---

## Business Rules Checklist

| # | Quy tắc | Ảnh hưởng |
|---|---|---|
| BR-01 | `userId` lấy từ fixture identity adapter — KHÔNG nhận từ request body | Security |
| BR-02 | `examId` phải tồn tại trong fixture/DB; nếu không → 404 | Validation |
| BR-03 | Mock Test: exam phải có `duration_minutes > 0`; thiếu → 400 | Validation |
| BR-04 | SINGLE_SKILL cần `targetSectionId` hợp lệ; SINGLE_PART cần `targetPartId` hợp lệ thuộc exam | Validation |
| BR-05 | `exam_snapshot` lưu JSONB server-side; sửa fixture SAU create không đổi snapshot | Data integrity |
| BR-06 | `deadline` = `startTime + duration*60s`; Practice → `null` | Business logic |
| BR-07 | Response KHÔNG chứa `correct_answer`, `explanation`, `ai_feedback` | Security |
| BR-08 | GET `{id}` chỉ trả attempt của `userId` hiện tại; ID khác → 403 | Ownership |
| BR-09 | GET `{id}` với id không tồn tại → 404 | Validation |

---

## Bước 3 — Ma trận Test Cases

### A: POST /api/v1/attempts

| Mã TC | Loại | Kịch bản | Dữ liệu | Kết quả mong đợi |
|---|---|---|---|---|
| TC_ATT_CREATE_01 | Happy | Mock Test Full Exam | `{examId:1, testScope:FULL_EXAM, testMode:MOCK_TEST}` | 201, attemptId>0, deadline set, snapshot đúng |
| TC_ATT_CREATE_02 | Happy | Practice Single Skill | `{examId:1, testScope:SINGLE_SKILL, testMode:PRACTICE, targetSectionId:1}` | 201, deadline=null, snapshot 1 section |
| TC_ATT_CREATE_03 | Happy | Practice Single Part | `{examId:1, testScope:SINGLE_PART, testMode:PRACTICE, targetPartId:3}` | 201, deadline=null, snapshot 1 part |
| TC_ATT_CREATE_04 | Negative | examId không tồn tại | `{examId:9999, ...}` | 404, success=false |
| TC_ATT_CREATE_05 | Negative | Mock Test thiếu duration | Fixture exam duration=0 | 400, message rõ ràng |
| TC_ATT_CREATE_06 | Negative | SINGLE_SKILL thiếu targetSectionId | `{testScope:SINGLE_SKILL, testMode:PRACTICE}` | 400/422 |
| TC_ATT_CREATE_07 | Negative | targetPartId không thuộc exam | `{targetPartId:999}` | 404/400 |
| TC_ATT_CREATE_08 | Negative | testScope null | `{testScope:null}` | 400/422 |
| TC_ATT_CREATE_09 | Security | Snapshot độc lập fixture | Đổi fixture sau create, đọc lại | Snapshot KHÔNG thay đổi |
| TC_ATT_CREATE_10 | Security | Không lộ answer key | Mọi attempt hợp lệ | JSON không có correct_answer, explanation |
| TC_ATT_CREATE_11 | Boundary | examId = 0 | `{examId:0}` | 400/404 |
| TC_ATT_CREATE_12 | Boundary | examId = Integer.MAX_VALUE | `{examId:2147483647}` | 404 |

### B: GET /api/v1/attempts/{id}

| Mã TC | Loại | Kịch bản | Dữ liệu | Kết quả mong đợi |
|---|---|---|---|---|
| TC_ATT_GET_01 | Happy | Đọc attempt đang làm | attempt id=5, userId=1 | 200, status=IN_PROGRESS |
| TC_ATT_GET_02 | Happy | Snapshot đủ câu hỏi | attempt hợp lệ | questions + options, KHÔNG có correct_answer |
| TC_ATT_GET_03 | Security | Attempt của user khác | attempt userId=99, identity=1 | 403 Forbidden |
| TC_ATT_GET_04 | Negative | ID không tồn tại | id=99999 | 404 |
| TC_ATT_GET_05 | Boundary | ID = 0 | id=0 | 400/404 |
| TC_ATT_GET_06 | Boundary | ID âm | id=-1 | 400/404 |
| TC_ATT_GET_07 | Edge | Attempt status=COMPLETED | attempt đã nộp | 200 (frontend tự lock UI) |

### C: JSONB round-trip

| Mã TC | Loại | Kịch bản | Dữ liệu | Kết quả mong đợi |
|---|---|---|---|---|
| TC_ATT_JSON_01 | Edge | Unicode tiếng Việt | Câu "Đây là câu có dấu" | Round-trip đúng, không bị escape sai |
| TC_ATT_JSON_02 | Edge | Nhiều loại câu trong snapshot | MCQ + Fill-in + Essay | Tất cả loại câu round-trip đúng |

---

## Bước 4 — Review Focus (failure modes chưa được test đủ)

| # | Input / Condition | Expected behavior |
|---|---|---|
| RF-01 | `MOCK_TEST + SINGLE_PART` (kết hợp hợp lệ?) | **Cho phép** — Mock một Part có nghĩa, deadline = Part duration. |
| RF-02 | Fixture adapter trả `duration_minutes=null` | Null-safe; không NPE, trả 400 rõ ràng. |
| RF-03 | Create attempt 2 lần liên tiếp cùng exam | Tạo 2 attempt độc lập — không unique constraint (userId, examId). |
| RF-04 | Snapshot đề 80 câu / 3 section (JSONB lớn) | H2 xử lý OK; đảm bảo không truncate ở mapper. |
| RF-05 | `startTime` timezone | Dùng `Instant` UTC tuyệt đối — không dùng `LocalDateTime`. |

---

## Quyết định kỹ thuật Sprint 01

| # | Quyết định | Lý do |
|---|---|---|
| D-01 | `permitAll()` cho `/api/v1/attempts/**` | TV1 JWT chưa xong; TODO comment bắt buộc |
| D-02 | `FixtureIdentityAdapter` trả `userId=1` trong dev/test | Không nhận userId từ request; dễ swap |
| D-03 | `FixtureExamAdapter` đọc JSON fixture từ `test/resources/fixtures/` | Isolate với TV2 |
| D-04 | H2 integration test (không Testcontainers) | Đủ cho Sprint 01; Testcontainers Sprint sau |
| D-05 | `exam_snapshot` kiểu `Map<String,Object>` + `@JdbcTypeCode(SqlTypes.JSON)` | Nhất quán với AttemptAnswer đã có |
| D-06 | `deadline` kiểu `Instant` nullable | Practice null; Mock Test tính từ fixture |
| D-07 | `version` Integer default=1 trên TestAttempt | Chuẩn bị optimistic locking Sprint 03; chưa dùng Sprint 01 |
