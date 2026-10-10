# TV3-11: Result summary backend — Implementation Plan

**Ngày:** 2026-10-10  
**Trạng thái:** IMPLEMENTED  
**Baseline:** HEAD `8510049`, branch `feature/TV3-00-contract-audit`.

## 1. Mục tiêu và kết quả kiểm tra repository

### Mục tiêu

Endpoint result trả kết quả backend có cấu trúc, đúng phạm vi attempt:

- Tổng hợp objective theo toàn bài, skill và part, gồm cả câu chưa trả lời.
- Trả thời gian làm bài đúng.
- Hiển thị objective trong lúc Writing đang chờ AI.
- Trả metadata Writing, không tạo điểm giả.
- Giữ các trường grading legacy để tương thích.
- Xử lý dữ liệu cũ thiếu hoặc hỏng bằng trạng thái unavailable.

### Hiện trạng đã xác minh

| Vị trí | Hiện trạng |
|---|---|
| `GET /api/v1/attempts/{id}/result` | Endpoint và kiểm tra chủ sở hữu đã có |
| `ExamResultResponse.resultSummary` | Đang trả `Map` đọc trực tiếp từ JSON grading |
| `finalizeAndGradeAttempt` | Truyền các record đã lưu vào engine; part chưa có record bị bỏ khỏi tổng số câu |
| `timeSpentSeconds` | Chưa được cập nhật khi finalize |
| Nhận diện Writing | Dựa vào tên section chứa `WRITING`, không dựa vào câu `ESSAY` |
| Serialize grading | Có nhánh nuốt lỗi rồi vẫn chuyển sang trạng thái hoàn tất |
| Hai cột điểm | `NUMERIC(4,2)`, không chứa được raw score 100–200 |
| Test profile | H2, Flyway tắt; không chứng minh migration chạy trên PostgreSQL |

TV3-10 đã có final review PASS. Không triển khai lại hoặc refactor engine của task này.

### Quyết định đã chốt

1. Sửa pipeline tối thiểu trong testing service; giữ engine TV3-10.
2. Trả objective khi `AI_GRADING` hoặc `AI_GRADING_QUEUED`; Writing vẫn pending.
3. Chỉ dùng raw score, không quy đổi IELTS Band hoặc TOEIC scaled score.
4. Bổ sung structured summary và giữ grading fields legacy.
5. Dữ liệu summary thiếu, hỏng hoặc không đầy đủ: HTTP 200, metadata thật, `summaryAvailable=false`, `resultSummary=null`.
6. Writing trả metadata từng task; `score` và `maxScore` là `null`.
7. Accuracy dùng toàn bộ câu objective trong scope làm mẫu số.
8. Không regrade hoặc backfill kết quả đã chốt.
9. Được phép một migration nhỏ: mở rộng hai cột điểm sang `NUMERIC(10,2)`.

### Giới hạn phạm vi

Không sửa frontend, submit/autosave contract, engine/adapter TV3-10, AI worker, quota hoặc công thức chấm điểm.

Không thêm endpoint, dependency, backfill hoặc sửa migration cũ. Không thay đổi owner checks, grace 15 giây, idempotency và locking của TV3-09.

## 2. Contract và acceptance criteria

### 2.1 Result API

Giữ endpoint, envelope và các metadata hiện có. Bổ sung:

```ts
interface ExamResultResponse {
  // Giữ các metadata hiện có.
  overallScore: number | null;
  summaryAvailable: boolean;
  resultSummary: ResultSummaryResponse | null;
}

interface ResultSummaryResponse {
  // Giữ tên và shape grading legacy.
  partResults: Record<string, Record<string, {
    questionId: string;
    verdict: 'CORRECT' | 'WRONG' | 'BLANK';
    score: number;
  }>>;
  totalScore: number;
  correctCount: number;
  totalObjectiveCount: number;
  sectionScores: Record<string, number>;

  objective: ObjectiveSummary;
  writing: WritingSummary | null;
}

interface ObjectiveStats {
  rawScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracy: number;
}

interface ObjectiveSummary extends ObjectiveStats {
  scoreUnit: 'RAW_OBJECTIVE';
  bySkill: Array<ObjectiveStats & { skill: string }>;
  byPart: Array<ObjectiveStats & {
    partId: number;
    label: string;
    skill: string;
  }>;
}

interface WritingSummary {
  status: 'PENDING' | 'QUEUED' | 'FAILED' | 'UNAVAILABLE';
  tasks: Array<{
    partId: number;
    questionId: string;
    label: string;
    status: 'PENDING' | 'QUEUED' | 'FAILED' | 'UNAVAILABLE';
    wordCount: number;
    score: null;
    maxScore: null;
  }>;
}
```

Backend dùng DTO Java có kiểu rõ ràng, theo convention Lombok hiện tại. Interfaces trên mô tả JSON, không yêu cầu sửa TypeScript trong TV3-11.

`overallScore`, `totalScore` và `objective.rawScore` đều là **raw objective score**, không phải tổng điểm cuối cùng gồm Writing.

### 2.2 Quy tắc tổng hợp

- `CORRECT → correct`, `WRONG → incorrect`, `BLANK → unanswered`.
- `total = correct + incorrect + unanswered`.
- `accuracy = correct × 100 / total`, làm tròn hai chữ số bằng `HALF_UP`.
- Khi không có câu objective: các count và accuracy bằng 0; các danh sách objective rỗng.
- Raw score lấy từ điểm grading đã lưu, không suy ra từ số câu đúng.
- Giữ partial score của legacy `MATCHING`; không ép `rawScore = correct` hoặc `rawScore ≤ total`.
- Part chỉ có ESSAY không xuất hiện trong `objective.byPart`.
- Thứ tự part theo snapshot; thứ tự skill theo lần xuất hiện đầu tiên trong snapshot.
- Skill: trim, uppercase bằng `Locale.ROOT`; tên thiếu/rỗng dùng `UNKNOWN`.
- Label part: `title` không rỗng → `partTitle` không rỗng → `Part <partId>`.

### 2.3 Nguồn dữ liệu và tính đầy đủ

Summary được dựng khi GET từ:

1. `examSnapshot` đã lưu.
2. JSON `GradingResult` đã lưu.
3. `AttemptAnswer.userAnswers` để tính word count Writing.

Không đọc lại đề hoặc grading key từ TV2 cho attempt đã finalize.

Chỉ trả summary available khi:

- Snapshot có cấu trúc và định danh hợp lệ.
- Mọi câu objective trong snapshot có đúng một grading result tương ứng.
- Không có verdict objective ngoài scope.
- Verdict, score, question ID và các counters hợp lệ, nhất quán.
- Tổng score/counters khớp với các kết quả từng câu.
- `overallScore`, nếu có, khớp với raw total.

Không suy đoán BLANK cho câu bị thiếu trong **grading legacy đã lưu**. Việc bổ sung câu BLANK chỉ áp dụng cho pipeline finalize mới.

Chỉ serialize các trường DTO được cho phép. Không trả arbitrary fields từ JSON, đáp án người dùng, answer key, essay, explanation, AI prompt hoặc raw AI feedback.

### 2.4 Writing và thời gian

Một task Writing tương ứng một câu `ESSAY`; dùng cặp `partId/questionId` làm định danh.

| Attempt status | Writing status |
|---|---|
| `SUBMITTED`, `AI_GRADING` | `PENDING` |
| `AI_GRADING_QUEUED` | `QUEUED` |
| `GRADING_FAILED` | `FAILED` |
| `COMPLETED`, `EXPIRED` khi chưa có scoring contract | `UNAVAILABLE` |

Không có ESSAY thì `writing=null`.

Word count chỉ đếm answer dạng string bằng khoảng trắng Unicode; chuỗi rỗng hoặc answer không phải string cho 0. Không chuyển object thành chuỗi và không log essay.

Duration:

```text
floor(endTime - startTime), clamp vào [0, Integer.MAX_VALUE]
```

Finalize mới persist giá trị này. GET legacy có đủ timestamps thì tính từ timestamps, không backfill DB; thiếu timestamps thì trả duration đã lưu nếu hợp lệ, nếu không trả `null`.

### 2.5 Acceptance criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | GET giữ endpoint/envelope và grading legacy, bổ sung structured summary đúng contract |
| AC-02 | Tổng hợp đúng FULL_EXAM/SINGLE_SKILL/SINGLE_PART, gồm part chưa trả lời |
| AC-03 | Counts, accuracy và raw score nhất quán; giữ semantics TV3-10 |
| AC-04 | Duration đúng; không thay đổi deadline/grace/idempotency |
| AC-05 | Objective đọc được khi AI pending; Writing không có điểm giả |
| AC-06 | Legacy thiếu/hỏng/không đầy đủ trả unavailable, không regrade/backfill |
| AC-07 | Owner/auth checks được giữ; không lộ dữ liệu nhạy cảm; GET finalized không phụ thuộc đề hiện tại |
| AC-08 | Persist được raw 200 ở cả hai cột; migration bảo toàn dữ liệu cũ |
| AC-09 | Focused integration và regression PASS; handoff có evidence và final review |

## 3. Các subtasks triển khai

Triển khai tuần tự:

`11-01 → 11-02 → 11-03 → 11-04 → 11-05 → 11-06`

Mỗi task cần RED → GREEN, test gate và append handoff. RED phải chứng minh hành vi thiếu/sai, không dùng lỗi môi trường làm evidence.

### TV3-11-01 — Mở rộng precision lưu raw score

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/entity/TestAttempt.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/entity/AttemptAnswer.java`

**Tạo:**

- `backend/src/main/resources/db/migration/V20261010233000__widen_testing_raw_scores.sql`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/ResultScorePrecisionTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/ResultScorePrecisionPostgresIT.java`

**Các bước:**

- [ ] Test persist/flush/reload `200.00` cho attempt và answer.
- [ ] Test giá trị cũ như `9.25` không bị thay đổi.
- [ ] Đổi hai annotations thành `precision=10, scale=2`.
- [ ] Migration chỉ chứa hai thao tác:

```sql
ALTER TABLE test_attempts
  ALTER COLUMN overall_score TYPE NUMERIC(10,2);

ALTER TABLE attempt_answers
  ALTER COLUMN earned_score TYPE NUMERIC(10,2);
```

- [ ] PostgreSQL IT dùng JDBC/Flyway dependencies hiện có, không thêm Testcontainers.
- [ ] Lấy kết nối test từ `TV3_PG_TEST_URL`, `TV3_PG_TEST_USER`, `TV3_PG_TEST_PASSWORD`; không log credentials.
- [ ] Tạo schema riêng `tv3_11_it_<uuid>` và hai bảng fixture precision cũ.
- [ ] Baseline Flyway tại `20261006165504`, target migration mới; kiểm tra schema history, precision/scale, dữ liệu cũ và insert 200.
- [ ] Cleanup chỉ schema do test tạo; không gọi database-wide `clean`.
- [ ] Thiếu PostgreSQL test environment thì ghi SKIPPED và migration gate BLOCKED, không coi H2 là bằng chứng migration PASS.

**Test:**

```powershell
.\mvnw.cmd "-Dtest=ResultScorePrecisionTest" test
.\mvnw.cmd "-Dtest=ResultScorePrecisionPostgresIT" test
```

**Acceptance:** AC-08. Không clamp, chia hoặc quy đổi raw score.

---

### TV3-11-02 — Đọc scope snapshot và chuẩn bị grading input đầy đủ

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/util/AttemptResultScope.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/AttemptGradingInputFactory.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/util/AttemptResultScopeTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/AttemptGradingInputFactoryTest.java`

**Interfaces:**

```java
List<ScopedPart> read(Map<String, Object> snapshot);

GradingInput prepare(
    Map<String, Object> snapshot,
    List<AttemptAnswer> savedAnswers,
    Map<Integer, PartGradingKey> loadedKeys);
```

`ScopedPart` chứa part ID, label, skill và danh sách question ID/type. `GradingInput` chứa answers và keys dành riêng cho scope.

**Các bước:**

- [ ] Test snapshot `questionGroups`, canonical `question_groups` và legacy flat `questions`.
- [ ] Dùng groups khi có giá trị không null; chỉ fallback flat questions khi không có groups.
- [ ] Không đếm lại flat questions đã được adapter flatten từ groups.
- [ ] Reject cấu trúc malformed, ID không hợp lệ, question ID/type thiếu và định danh trùng.
- [ ] Filter cả part và question của grading keys theo snapshot.
- [ ] Key thiếu hoặc type không khớp cho câu objective phải phát sinh grading data error, không bỏ qua.
- [ ] Copy grading keys; không mutate dữ liệu adapter.
- [ ] Gán section name của input theo skill trong snapshot.
- [ ] Tạo `AttemptAnswer` transient với answers rỗng cho part chưa có record.
- [ ] Không persist record transient chỉ để đếm câu.
- [ ] Record/answer ngoài scope không đi vào grading input; không xóa dữ liệu đã lưu.
- [ ] Writing-only part được xử lý mà không yêu cầu objective key.

**Test:**

```powershell
.\mvnw.cmd "-Dtest=AttemptResultScopeTest,AttemptGradingInputFactoryTest" test
```

**Acceptance:** AC-02, AC-03. Engine nhận đủ câu trong scope mà không bị sửa.

---

### TV3-11-03 — Finalize đầy đủ, duration và nhận diện ESSAY

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/SubmissionServiceTest.java`

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/util/AttemptDuration.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/util/AttemptDurationTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/ResultFinalizationServiceTest.java`

**Các bước:**

- [ ] Test part chưa có answer row vẫn tạo verdict BLANK cho mọi câu objective.
- [ ] Wire factory vào finalize trước khi gọi actual grading engine.
- [ ] Persist JSON `GradingResult` với shape legacy hiện có.
- [ ] Persist flags/earned score chỉ cho answer rows đã tồn tại; không tạo synthetic rows.
- [ ] Tính và persist duration từ end time đã được giới hạn bởi deadline.
- [ ] Test duration 0, phần giây lẻ, clock skew và giới hạn Integer.
- [ ] Nhận diện có Writing từ `ESSAY` trong scope, thay helper kiểm tra tên section.
- [ ] Giữ quota stub và lựa chọn AI status hiện có; không thêm worker.
- [ ] Serialize grading result trước khi gán/persist các derived grading fields.
- [ ] Serialization thất bại phải đi vào `GRADING_FAILED`, không nuốt lỗi rồi báo COMPLETED.
- [ ] Log attempt ID và mã/nguyên nhân an toàn; không đưa JSON/answers/exception payload nhạy cảm vào log.
- [ ] Giữ nguyên transaction, owner lock, finalAnswers handling và idempotent return.
- [ ] Cập nhật fixture/mock thật sự bị ảnh hưởng; không nới assertion để né regression.

**Assertions bắt buộc:**

```java
assertThat(result.getTotalObjectiveCount()).isEqualTo(allScopedObjectiveQuestions);
assertThat(untouchedPartResults.values())
    .allMatch(q -> q.getVerdict() == GradingVerdict.BLANK);
assertThat(persistedAttempt.getTimeSpentSeconds())
    .isEqualTo(expectedDuration);
```

**Test:**

```powershell
.\mvnw.cmd "-Dtest=AttemptDurationTest,ResultFinalizationServiceTest,SubmissionServiceTest,ObjectiveGradingServiceTest" test
```

**Acceptance:** AC-02–05. Section tên WRITING nhưng không có ESSAY không bị chờ AI; ESSAY trong section tên khác vẫn được nhận diện.

---

### TV3-11-04 — DTO và mapper structured summary

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/ExamResultResponse.java`

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/ResultSummaryResponse.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/AttemptResultSummaryMapper.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/AttemptResultSummaryMapperTest.java`

**Interface:**

```java
ResultSummaryResponse map(
    TestAttempt attempt,
    List<AttemptAnswer> savedAnswers);
```

Mapper trả `null` khi summary unavailable. Không inject TV2 repository, grading adapter hoặc grading engine.

**Các bước:**

- [ ] Đổi Java type của `resultSummary` sang DTO typed; thêm `summaryAvailable`.
- [ ] Dùng nested DTO rõ ràng cho legacy question result, objective, skill, part và Writing.
- [ ] Parse persisted JSON có kiểm soát; không phụ thuộc vào việc `GradingResult` có constructor Jackson phù hợp.
- [ ] Validate completeness và consistency theo §2.3 trước khi trả summary.
- [ ] Rebuild legacy output bằng allowlist DTO; không chuyển tiếp arbitrary JSON fields.
- [ ] Dựng counts từ verdict, score từ persisted question score.
- [ ] Test accuracy `2/3 → 66.67`, blank làm giảm accuracy và incorrect không gồm unanswered.
- [ ] Test legacy MATCHING partial score vẫn giữ nguyên.
- [ ] Dựng Writing task cho từng ESSAY, giữ question ID, tính word count từ string backend.
- [ ] Test nhiều ESSAY trong cùng part, Unicode, whitespace, blank và answer sai kiểu.
- [ ] Writing score/maxScore luôn null; không diễn giải raw `aiFeedback`.
- [ ] Test null/empty JSON, malformed JSON, thiếu verdict, sai counter, sai score và snapshot lỗi.
- [ ] Không mutate attempt, snapshot hoặc persisted grading JSON.

**Test:**

```powershell
.\mvnw.cmd "-Dtest=AttemptResultSummaryMapperTest" test
```

**Acceptance:** AC-01, AC-03, AC-05, AC-06. Writing-only attempt có grading hợp lệ vẫn summary available với objective total 0.

---

### TV3-11-05 — Wire GET result và kiểm thử contract/security

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`

**Tạo:**

- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptResultControllerIT.java`

Không cần đổi route hoặc service interface.

**Các bước:**

- [ ] Thay nhánh trả raw Map bằng mapper typed.
- [ ] Load saved answers của đúng attempt; không query dữ liệu người dùng khác.
- [ ] Set `summaryAvailable = resultSummary != null`.
- [ ] Dùng duration helper cho response legacy mà không backfill.
- [ ] Giữ metadata/status/overallScore đã lưu; không tạo score 0 khi thiếu dữ liệu.
- [ ] Giữ `ensureFinalized` và kiểm tra owner trước lazy finalize.
- [ ] IN_PROGRESS chưa đủ điều kiện finalize vẫn trả lỗi 400 hiện có.
- [ ] Non-IN_PROGRESS có summary unavailable vẫn trả HTTP 200.
- [ ] Test unauthenticated 401, wrong owner/missing attempt 403.
- [ ] Test các AI/failed/submitted/expired statuses và null Writing scores.
- [ ] Assert JSON legacy keys còn đúng shape và structured fields đúng contract.
- [ ] Chèn secret marker trong arbitrary JSON fields; assert không xuất hiện trong response.
- [ ] Với attempt đã finalized, verify không gọi exam adapter, grading adapter hoặc engine.
- [ ] Không đặt outer pessimistic lock trước `ensureFinalized`, tránh xung đột với transaction REQUIRES_NEW hiện có.

**Test:**

```powershell
.\mvnw.cmd "-Dtest=TestAttemptResultControllerIT,TestAttemptResumeControllerIT,TestAttemptGracePeriodTest" test
```

**Acceptance:** AC-01, AC-04–07. Lỗi dữ liệu legacy không trở thành HTTP 500 hoặc một kết quả giả.

---

### TV3-11-06 — End-to-end regression và bàn giao

**Tạo:**

- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/ResultSummaryContractIT.java`

**Cập nhật tài liệu khi được phép ghi:**

- `docs/superpowers/plans/ndt/TV3-11-plan.md`
- `docs/superpowers/plans/ndt/TV3-11-handoff.md`

**Các bước:**

- [ ] Dùng MockMvc, actual service, actual JPA repositories, DbExamAdapter, DbGradingAdapter và engine.
- [ ] Không import fixture-adapter override hoặc mock kết quả grading để chứng minh pipeline.
- [ ] Seed canonical exam; create → save/submit → GET result → đối chiếu dữ liệu persist.
- [ ] Test multi-section/multi-part: một phần đúng, một phần sai, một part chưa trả lời.
- [ ] Test FULL_EXAM/SINGLE_SKILL/SINGLE_PART, không tính câu ngoài scope.
- [ ] Test raw 200 qua submit, DB reload và GET.
- [ ] Test objective + ESSAY: objective visible, Writing pending, score/maxScore null.
- [ ] Sau finalize, sửa/xóa nguồn đề; GET summary vẫn giữ snapshot và grading đã lưu.
- [ ] Test past-grace lazy finalize và repeated GET không regrade.
- [ ] Test GET result cạnh tranh submit theo owner-scoped locking hiện có; không chấm hai lần.
- [ ] Test legacy không đầy đủ giữ nguyên DB, trả unavailable.
- [ ] Kiểm tra raw JSON vẫn đọc được bằng shape legacy dùng tại review; không mở rộng thành task sửa review UI.
- [ ] Chạy regression gates bên dưới và append evidence.
- [ ] Dừng để final review toàn feature, không commit/push.

**Acceptance:** AC-01–09. Evidence phải đi qua HTTP → service → grading → persistence → HTTP, không chỉ unit mapper.

## 4. Test matrix và verification gates

### Ma trận bắt buộc

| TC | Kịch bản | Kết quả mong đợi | Task |
|---|---|---|---|
| TC-01 | Câu đúng/sai/blank trong nhiều parts | Counts và raw scores nhất quán | 03, 04, 06 |
| TC-02 | Part chưa có answer row | Đủ BLANK, không tạo synthetic DB row | 02, 03, 06 |
| TC-03 | SINGLE_SKILL/SINGLE_PART | Chỉ tính câu trong snapshot scope | 02, 06 |
| TC-04 | Groups và flat questions cùng tồn tại | Không đếm trùng | 02 |
| TC-05 | Legacy MATCHING partial score | Giữ điểm engine, không suy từ correct count | 04 |
| TC-06 | Accuracy 2/3 và total 0 | 66.67 và 0; không divide-by-zero | 04 |
| TC-07 | Raw 200 toàn bài và một part | Persist/reload/GET đúng 200 | 01, 06 |
| TC-08 | Writing-only/nhiều ESSAY | Objective 0; từng task có ID, null scores | 03, 04 |
| TC-09 | AI_GRADING/QUEUED | Objective available; Writing pending/queued | 04, 05 |
| TC-10 | Summary JSON hỏng/thiếu/mâu thuẫn | HTTP 200, unavailable, không backfill | 04–06 |
| TC-11 | Serialize thất bại khi finalize | GRADING_FAILED, không false COMPLETED | 03 |
| TC-12 | Manual/timeout duration, clock skew | Duration đúng và được giới hạn | 03 |
| TC-13 | 401/403/IN_PROGRESS | Giữ auth/error behavior hiện có | 05 |
| TC-14 | Secret fields trong snapshot/JSON | Không lộ answers/key/essay/prompt | 04, 05 |
| TC-15 | Đề nguồn đổi sau finalize | Summary không đổi, không regrade | 06 |
| TC-16 | Lazy GET/repeated GET/submit race | Giữ grace và finalize một lần | 05, 06 |
| TC-17 | PostgreSQL migration | Hai cột widened, dữ liệu cũ giữ nguyên | 01 |
