# TV3-07 — Resume contract từ backend Implementation Plan

> **For agentic workers:** Chỉ triển khai sau khi kế hoạch được phê duyệt. Gemini Executor dùng `executing-plans` và `test-driven-development`, thực hiện từng task theo Red → Green → Refactor; Codex review sau triển khai. Không commit hoặc push nếu chưa có yêu cầu riêng.

**Goal:** Mở lại attempt bằng dữ liệu backend có thẩm quyền: đúng answers/version, section lock, trạng thái và thời gian; không ghi nhầm phiên hoặc mất edit khi refresh metadata.

**Architecture:** Giữ endpoint workspace hiện có. Backend khóa attempt trong transaction khi dựng response và chỉ trả bản sao snapshot đã sanitize. Frontend kiểm tra contract trước khi hydrate Redux, tách authoritative reload khỏi metadata refresh và chỉ kích hoạt write/timer khi đúng attempt đã sẵn sàng.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Spring Data JPA, PostgreSQL/H2, JUnit 5, Mockito, React 19, Redux Toolkit, Axios, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md`, mục 5.2, 5.4, AC-01/AC-04, BE-RSM-01, FE-RSM-01; `Dac_ta_Usecase_UC08_UC10.md`, UC08/UC08.5. Resume cụ thể được AC-04 quy định; không suy diễn thêm tính năng từ tên task.

**Root:** `D:/Project/University/multilingo-platform`. Mọi đường dẫn repo-relative dưới đây được giải quyết từ root này. **Trạng thái:** PLANNED, ngày 2026-10-10; chưa triển khai.

## Global Constraints

- “Grace 15 giây dùng thống nhất giữa request submit, scheduler và lazy finalize.”
- “Local draft chỉ là fallback rõ ràng.” Không tự động merge local draft vào bản backend.
- “`ai_prompt_context` không bao giờ ra workspace/preview/start page.”
- Giữ `ApiResponse<WorkspaceResponse>`, ownership qua `IdentityAdapter`, lỗi qua `AppException`.
- Không tạo endpoint resume mới, migration mới, `@Version`, dependency mới hoặc fetch lại đề nguồn khi resume.
- Giữ cơ chế version đã triển khai trong TV3-06; không tăng version vì GET hoặc metadata refresh.
- Bảo toàn `TV3-03-review.patch` untracked. HEAD kiểm tra: `30ff0f2`, branch `feature/TV3-00-contract-audit`; không dựa vào worktree/branch cũ ghi trong plan trước.
- Chỉ plan và handoff được tạo trong lượt lập kế hoạch; các checkbox bên dưới dành cho executor sau phê duyệt.

## Review Focus

1. GET đọc version trước nhưng answers sau commit autosave: phải trả một bộ nhất quán, không trộn hai phiên bản — Task 1.
2. Attempt quá grace: không deadlock vì giữ khóa ngoài rồi mở `REQUIRES_NEW` trên cùng dòng — Task 1.
3. Đổi route A → B, response A tới muộn hoặc đồng hồ A hết hạn: không hydrate/save/submit cho B từ dữ liệu A — Tasks 4–5.
4. Refresh section lock khi đang có edit/autosave: không reset dirty, pendingVersion hoặc version Redux — Task 4.
5. Offset thay đổi nhưng deadline giữ nguyên; trạng thái terminal/lock được resume: không bật lại input hoặc timer cũ — Task 5.

## 1. Overview và scope

Actor: học viên đã đăng nhập, owner của attempt. Thành công là reload/mount lại workspace hoặc đăng nhập lại rồi mở URL attempt khôi phục dữ liệu từ server, không tạo attempt mới.

In-scope: response GET nhất quán và an toàn; kiểm tra payload; hydrate có kiểm soát; timer server offset; section lock; chặn write trên dữ liệu chưa sẵn sàng/terminal; regression và bàn giao.

Out-of-scope: danh sách lịch sử/nút resume ở start page, auto-discovery attempt, refresh-token/auth redesign, offline editor/merge draft, persistence highlight/flag/audio position, result/review UI, AI worker, sửa toàn bộ submit/watchdog, backend validation part/question/locked-section write của AC-06.

## 2. Verified repository findings

| VERIFIED tại HEAD | Bằng chứng và ảnh hưởng |
|---|---|
| Backend đã trả `startTime`, `deadline`, `serverTime`, `gracePeriodSeconds=15`, `version`, `savedAnswers`, `lockedSections`, snapshot và status | `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/WorkspaceResponse.java`; `TestAttemptServiceImpl.toWorkspaceResponse()`. Không tạo lại DTO/fields này. |
| GET có hai URL tương thích | `TestAttemptController.getWorkspace()`: `/api/v1/attempts/{id}` và `/{id}/workspace`; frontend dùng URL thứ hai. |
| GET không khóa, load answers bằng query riêng | `TestAttemptServiceImpl.getAttemptWorkspace()` dùng `findByIdAndUserId`; mapper gọi `AttemptAnswerRepository.findByAttemptId`. Có khả năng response trộn version và answers khi save chạy đồng thời. |
| Khóa ghi có sẵn | `TestAttemptRepository.findByIdAndUserIdForUpdate()` dùng `PESSIMISTIC_WRITE`; autosave TV3-06 đã dùng query này. |
| Lazy finalize hiện mở transaction mới | `ensureFinalized()` dùng `REQUIRES_NEW`, còn được result/review dùng. Không gọi helper này sau khi GET giữ khóa attempt. |
| `lockSection()` còn dùng query không khóa | Cần dùng cùng khóa để tránh stale managed entity ghi đè version/state khi cạnh tranh với GET/autosave. Không mở rộng validation section trong task này. |
| Snapshot mới đã được sanitize ở DB adapter, GET trả map persisted trực tiếp | `DbExamAdapter.PRIVATE_GRADING_FIELDS`, `sanitizeForClient()`; `toWorkspaceResponse().examSnapshot(attempt.getExamSnapshot())`. Resume legacy snapshot cần lớp bảo vệ đầu ra; không sửa persisted map. |
| Frontend normalizer mặc định nguy hiểm | `attemptApi.normalizeWorkspace()` mặc định version `0`, answers `[]`, snapshot `{}`; bỏ `startTime`/grace. `getWorkspace()` tính midpoint offset nhưng page dùng raw serverTime. |
| Hydration/refresh đang dùng chung | `useWorkspace()` luôn `setAttemptContext()` sau GET; `WorkspacePage` dùng `retry()` cả sau lock và nút reload conflict. Test retry hiện chỉ kiểm tra attemptId, chưa giữ dirty edit. |
| Store phân biệt version server và local revision | `answerSlice.ts`: `version` và `pendingVersion`; context hydrate chưa reset `lastSavedAt`; flags/highlights không reset trực tiếp khi đổi context. |
| Status frontend thiếu trạng thái backend | BE enum có `IN_PROGRESS`, `SUBMITTED`, `GRADING_FAILED`, `AI_GRADING`, `AI_GRADING_QUEUED`, `COMPLETED`, `EXPIRED`; FE union chỉ có 3. Page chỉ điều hướng `COMPLETED`, ngay trong render. |
| Lock UI đã có | `WorkspacePage`: `isCurrentSectionLocked`, fieldset/input disabled, palette button disabled; nhưng phần đầu mặc định có thể là section đã khóa sau resume. Giữ renderer đã có, sửa chọn phần và gating. |
| DB schema đã đủ | `V2__create_test_attempts_tables.sql`: version/deadline/snapshot; `V3__add_locked_sections.sql`. DB spec thực tế ở `docs/md/DATABASE_SPECIFICATION.md` và còn thiếu các cột mới trong bảng mô tả. |

Spec TV3-00 chứa mô tả baseline cũ “thiếu savedAnswers/version”; đó không còn là hiện trạng. `docs/DacTa/motaUC_Multilingo.md` chỉ chứa UC xác thực/hồ sơ/thanh toán; UC08 thực tế nằm ở file root nêu trên.

### Baseline đã chạy ngày 2026-10-10

- Frontend focused: 5 files, **60/60 PASS** (`attemptApi`, `useWorkspace`, `useExamTimer`, `answerSlice`, `WorkspacePage`).
- Backend focused: **13/13 PASS** (`TestAttemptWorkspaceResponseTest`, `TestAttemptAutosaveVersionTest`, `TestAttemptAutosaveConcurrencyIT`).
- Backend regression thêm: `DbExamAdapterTest` **10/10 PASS**, `TestAttemptSinglePartDurationTest` **3/3 PASS**, `TestAttemptAutosaveControllerTest` **3/3 PASS**. Command nhóm gồm cả `TestAttemptServiceTest` chạy 33 tests, exit1 vì 14 errors thuộc lớp service fixture cũ.
- `TestAttemptControllerIT`: **9 tests, 6 failures, 0 errors**. Ba create/workspace cases nhận 404 tại bước create exam 1; ba save/submit cases dùng ID không tồn tại nhận 403. `DbExamAdapter` là `@Primary`, test không seed exam tương ứng. Report: `backend/target/surefire-reports/com.multilingo.backend.modules.testing.controller.TestAttemptControllerIT.txt`.
- `TestAttemptServiceTest`: **17 tests, 14 errors, 0 failures**; tất cả errors là `AppException: Exam not found: 1`. Report: `backend/target/surefire-reports/com.multilingo.backend.modules.testing.service.TestAttemptServiceTest.txt`. Cases lỗi: `createAttempt_full_exam_mock_test_returns_workspace_with_deadline`, `createAttempt_practice_mode_has_null_deadline`, `createAttempt_single_skill_filters_exam_snapshot_to_single_section`, `createAttempt_single_part_filters_exam_snapshot_to_single_part`, `getAttemptWorkspace_returns_own_attempt`, `exam_snapshot_contains_sections_not_correct_answers`, `exam_snapshot_does_not_contain_correct_answer_after_grading`, `autosaveAnswers_saves_to_attempt_answers_table`, `submitAttempt_changes_status_to_COMPLETED`, `submitAttempt_is_idempotent_when_already_completed`, `submitAttempt_idempotent_does_not_overwrite_score`, `submitAttempt_persists_isCorrectFlags_and_overallScore`, `submitAttempt_persists_overallScore_on_attempt`, `submitAttempt_persists_sectionScores`.
- Đây là baseline của hai lớp fixture cũ, không phải regression TV3-07. Không disable/đổi expected thành 404/403 để làm xanh. Tạo resume IT seed attempt thực, độc lập create fixture cũ. Chưa chạy toàn bộ suite/lint/build trong lượt planning.

## 3. Architecture, quyết định và data flow

**DECISION D1 — khóa và dựng response trong cùng transaction:** GET owner lookup bằng query `ForUpdate`; nếu mock IN_PROGRESS quá deadline +15s thì finalize inline bằng `finalizeAndGradeAttempt(...TIMEOUT_SERVER...)`. Không gọi `ensureFinalized()` trong GET; giữ helper result/review hiện tại. Load answers, sanitize copy, sample serverTime rồi trả DTO trước khi nhả khóa. GET bình thường không ghi DB/increment version. `lockSection()` dùng cùng query khóa, không thay contract/version policy.

**DECISION D2 — nguồn resume có thẩm quyền:** `test_attempts.exam_snapshot` và `attempt_answers`; không đọc lại đề đã sửa/unpublish. `version` từ backend hydrate nguyên giá trị. Empty `savedAnswers: []` là hợp lệ; missing/null savedAnswers không được biến thành empty.

**DECISION D3 — hai loại fetch:** initial fetch và `retry()` là authoritative hydrate; `refreshMetadata()` chỉ cập nhật workspace metadata, tuyệt đối không dispatch context/đổi answers/version/dirty trong Redux. Sau lock dùng metadata refresh. Metadata receipt có thể chứa version cũ so với autosave vừa xong; không lấy receipt đó ghi ngược Redux version hoặc tự kết luận conflict.

**DECISION D4 — authoritative reload là thao tác thay thế có chủ đích:** khi có dirty edit, page yêu cầu xác nhận và lưu draft cùng attempt trước reload; cancel không gọi GET. Khi `saveStatus==='saving'` hoặc đang submit, nút reload disabled, hook `retry()` cũng no-op nếu saving. Chỉ hydrate sau GET thành công; GET lỗi giữ state/draft để retry, không bật write. Không xây offline recovery UI trong task này.

**DECISION D5 — timer:** dùng `(deadline, serverTimeOffset)` đã có, offset tính midpoint request/response. Reload không tính deadline từ duration hay Date.now mới. Offset phải cập nhật ngay cả khi deadline không đổi. Grace là dung sai backend cho request, không cộng vào đồng hồ cho học viên.

**DECISION D6 — trạng thái:** chỉ `IN_PROGRESS` cho phép edit/autosave/submit. Sáu trạng thái còn lại chuyển sang route result hiện có trong effect, không gọi submit lần nữa; không sửa result UI mẫu trong TV3-07. Status lạ/contract lỗi hiển thị lỗi tải, không mở workspace.

```text
GET /attempts/:id/workspace
 → authenticated + owner row lock
 → lazy finalize nếu quá grace, trong transaction đang giữ khóa
 → saved answers + version + locks + snapshot copy + server time
 → kiểm tra contract/attempt ID + tính midpoint offset
 → latest request only → hydrate Redux → ready=true
 → IN_PROGRESS: input/timer/autosave; terminal: result route

lockSection success → refreshMetadata → metadata mới, giữ nguyên Redux edits/version
conflict reload được xác nhận → bảo toàn draft → ready=false → GET → hydrate bản server
```

Phương án không chọn: chỉ bổ sung frontend tests sẽ không đóng race đọc backend; thêm endpoint `/resume` làm trùng contract hiện có; đổi isolation toàn service ảnh hưởng result/lazy-finalize và khó xác minh hơn khóa dòng hiện có.

## 4. API/DTO/DB contracts

GET `/api/v1/attempts/{id}/workspace`, auth như hiện tại. Alias `/{id}` giữ nguyên. HTTP 200 envelope hiện có; missing attempt hoặc non-owner cùng HTTP 403, không tiết lộ tồn tại.

```json
{
  "success": true,
  "code": 200,
  "data": {
    "attemptId": 42,
    "status": "IN_PROGRESS",
    "testScope": "FULL_EXAM",
    "testMode": "MOCK_TEST",
    "startTime": "2026-10-10T03:00:00Z",
    "deadline": "2026-10-10T04:00:00Z",
    "serverTime": "2026-10-10T03:15:00Z",
    "gracePeriodSeconds": 15,
    "version": 7,
    "savedAnswers": [{"part_id": 10, "answers": [{"question_id": "q_1", "answer": "A"}]}],
    "lockedSections": [100],
    "examSnapshot": {"id": 1, "title": "IELTS", "sections": []}
  }
}
```

JSON outer camelCase, nested answers snake_case đã có `@JsonProperty`; không đổi backend wire casing. `PRACTICE.deadline` có thể null hoặc bị bỏ do cấu hình NON_NULL, FE normalize thành null. Không yêu cầu snapshot có `code/type/exam_id` vì DB adapter hiện trả `id/title/...`; chỉ yêu cầu object có sections array, bảo toàn metadata/group đã có.

| Wire → FE | Quy tắc |
|---|---|
| attemptId → attempt_id | Integer 1..2147483647; GET phải trùng requested ID. |
| version → version | Integer 1..2147483647; không default, không local increment. |
| status/testScope/testMode → status/test_scope/test_mode | Enum thật; status union đủ 7 giá trị backend. |
| startTime → startTime | ISO date string parse được, bắt buộc. |
| serverTime → serverTime | ISO date string parse được, bắt buộc; serverClock−midpoint(clientBefore,clientAfter). |
| deadline → deadline | MOCK_TEST: date hợp lệ và không trước startTime; PRACTICE: absent/null. Không coi mock missing deadline là Practice. |
| gracePeriodSeconds → gracePeriodSeconds | Integer >=0; backend hiện 15. Không hardcode FE 15 để bù payload thiếu. |
| savedAnswers → saved_answers | Array bắt buộc; part_id integer >0, answers array, question_id non-empty string; duplicate part/question bị từ chối. AnswerValue giữ string/string[]/Record<string,string>/null. Không trim essay/Unicode. |
| lockedSections → lockedSections | Array positive integers bắt buộc, empty hợp lệ. |
| examSnapshot → exam_snapshot | Object, sections array; không có private grading fields; không ép toàn bộ legacy nội dung về schema mới. |

FE tiếp tục nhận aliases snake_case của fields có sẵn; start_time/grace_period_seconds được hỗ trợ rõ ràng. Với nested answers nhận snake_case/camelCase và normalize về `PartAnswers`. Khi cả hai tên tồn tại dùng canonical camelCase outer, snake_case nested; không thêm alias không có trong contract. Bỏ fallback serverNow/server_now chưa được backend định nghĩa.

`WorkspaceContractError extends Error` có message UI: “Dữ liệu phiên thi không hợp lệ. Vui lòng thử tải lại.” Không đưa payload/essay vào message/log.

Create POST dùng cùng normalizer; đo before/after và offset theo cùng công thức. Không đổi request/create flow start page. ServerTimeOffset luôn finite; không default 0 khi thiếu timestamp, nhưng kết quả offset 0 thực sự hợp lệ.

Snapshot sanitizer: deep-copy Map/List, bỏ cả snake_case/camelCase của `correct_answer`, `explanation`, `ai_prompt_context`, `ai_feedback`, `feedback`, `grading_key(s)`, `is_correct_flags`, `earned_score`, `skill_stats`. Giữ `accepted_answers` nội dung người học nếu chỉ là dữ liệu public? **Không:** nếu snapshot chứa `accepted_answers`/`acceptedAnswers` legacy dưới key câu hỏi, cũng loại vì là đáp án chấm; không sửa grading adapter. Không thay đổi key của user answers; đáp án text có các từ này không bị lọc.

Không thêm cột/bảng/index; persisted snapshot/answers và manual version hiện có không đổi. Định nghĩa version chỉ bảo đảm atomic với autosave đã khóa; submit version validation còn là follow-up TV3-06, không mở rộng trong TV3-07.

## 5. Exact file change matrix

| Task | Action | File (repo-relative từ Root) |
|---|---|---|
| 1 | Modify | `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java` — getAttemptWorkspace/lockSection/toWorkspaceResponse |
| 1 | Modify tests | `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptWorkspaceResponseTest.java` |
| 1 | Create | `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptResumeConcurrencyIT.java` |
| 2 | Create | `backend/src/main/java/com/multilingo/backend/modules/testing/util/WorkspaceSnapshotSanitizer.java` |
| 2 | Modify | `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java` — mapper only |
| 2 | Create | `backend/src/test/java/com/multilingo/backend/modules/testing/util/WorkspaceSnapshotSanitizerTest.java` |
| 2 | Create | `backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptResumeControllerIT.java` |
| 3 | Modify | `frontend/src/features/exam/types/api.types.ts`, `frontend/src/features/exam/types/answer.types.ts`, `frontend/src/features/exam/api/attemptApi.ts` |
| 3 | Modify tests | `frontend/src/features/exam/__tests__/attemptApi.test.ts` |
| 3 | Update typed fixtures | `frontend/src/features/exam/__tests__/useWorkspace.test.tsx`, `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx` — thêm fields required, Practice hoặc mock deadline hợp lệ |
| 4 | Modify | `frontend/src/features/exam/hooks/useWorkspace.ts`, `frontend/src/features/exam/store/answerSlice.ts` |
| 4 | Modify tests | `frontend/src/features/exam/__tests__/useWorkspace.test.tsx`, `frontend/src/features/exam/__tests__/answerSlice.test.ts` |
| 5 | Modify | `frontend/src/features/exam/pages/WorkspacePage.tsx`, `frontend/src/features/exam/hooks/useExamTimer.ts` |
| 5 | Modify tests | `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`, `frontend/src/features/exam/__tests__/useExamTimer.test.ts` |
| 6 | Create | `frontend/src/features/exam/__tests__/resumeContract.test.tsx` — real hook/store/API normalizer/page, chỉ mock HTTP |
| 6 | Append log | `docs/superpowers/plans/ndt/TV3-07-handoff.md` |

Read-only reuse: `TestAttemptRepository.java`, `WorkspaceResponse.java`, `TestAttemptController.java`, `AutosaveAnswersRequest.java`, `DbExamAdapter.java`, `useAutosave.ts`, `SaveStatusBadge.tsx`, existing renderer tests, TV3-06 plans/handoff. Không thay constructor service: sanitizer static utility, giảm ảnh hưởng các unit tests manual constructor.

## 6. Acceptance criteria

- **AC-R1:** Given owner đã autosave, When GET/reload, Then saved answers và version tương ứng cùng một commit, deadline/startTime/locks đúng persisted state; GET thường không tăng version.
- **AC-R2:** Given non-owner/missing ID hoặc private key trong legacy snapshot, When GET, Then bị từ chối hoặc response đã sanitize; persisted snapshot nguyên vẹn và không gọi đề nguồn.
- **AC-R3:** Given response thiếu/sai field, When normalize, Then báo contract error, không hydrate/timer/autosave; empty answers và Practice null deadline vẫn hợp lệ.
- **AC-R4:** Given đổi attempt, request retry cạnh tranh hoặc unmount, When response cũ tới, Then chỉ request hiện hành được publish/hydrate; ready không mang dữ liệu route cũ.
- **AC-R5:** Given edit chưa lưu, When refresh metadata sau lock, Then giữ answers/version/dirty/pendingVersion; authoritative reload chỉ thay thế sau xác nhận và response thành công.
- **AC-R6:** Given Mock clock skew/offset mới hoặc Practice, When resume, Then Mock timer dùng offset mới, Practice không countdown/auto-submit; terminal không write; section đã khóa không nhập.
- **AC-R7:** Given pipeline đã triển khai, When regression/review, Then test mới và focused cũ xanh, broad failures được đối chiếu baseline, handoff có bằng chứng và không commit/push.

## 7. Detailed implementation subtasks

### TV3-07-01 — Backend resume read nhất quán

**Files:** Task 1 trong matrix. **Depends:** TV3-06 đã có khóa/version. **Consumes:** `findByIdAndUserIdForUpdate(Integer,Integer)`, existing finalize helper. **Produces:** cùng `WorkspaceResponse getAttemptWorkspace(Integer)` nhưng coherent với autosave/section lock.

- [ ] Viết unit tests verify GET dùng owner-scoped locked query, version/answers/time/locks đúng và active Practice không gọi repository.save; thay stub GET cũ sang query khóa.
- [ ] Viết tests Mock chưa grace/đúng grace/quá grace: capture `Instant fixedNow` trước `mockStatic(Instant.class, CALLS_REAL_METHODS)`, stub `Instant.now()`; deadline `fixedNow.minusSeconds(15).plusMillis(1)`, `minusSeconds(15)`, `minusSeconds(15).minusMillis(1)`. Hai ca đầu giữ IN_PROGRESS, ca cuối finalize một lần. Stub grading result hợp lệ để không vô tình test GRADING_FAILED.
- [ ] Chạy focused unit, ghi assertion FAIL do query không khóa. Không coi tests characterization đã xanh là Red.
- [ ] Đổi GET sang locked query; nhánh lazy-finalize inline như khung sau; dùng query khóa cho lockSection. Không sửa ensureFinalized dùng bởi result/review.

```java
TestAttempt attempt = testAttemptRepository.findByIdAndUserIdForUpdate(attemptId, userId)
    .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN, "Attempt not found or access denied"));
Instant now = Instant.now();
if (attempt.getTestMode() == TestMode.MOCK_TEST
    && attempt.getStatus() == AttemptStatus.IN_PROGRESS
    && attempt.getDeadline() != null
    && now.isAfter(attempt.getDeadline().plusSeconds(15))) {
    finalizeAndGradeAttempt(attempt, SubmitReason.TIMEOUT_SERVER, null, userId);
}
return toWorkspaceResponse(attempt);
```

- [ ] Viết `TestAttemptResumeConcurrencyIT` (`@SpringBootTest`, `@ActiveProfiles("test")`, **không** class @Transactional): seed owner1/attempt/version1 và answer ORIGINAL; dùng ExecutorService hai threads, `@SpyBean AttemptAnswerRepository` chặn GET `findByAttemptId()` bằng latch sau khi đã lấy attempt. Thread autosave gửi version1/NEW. Resume bị giữ phải trả `(1,ORIGINAL)`; sau nhả latch autosave hoàn tất, GET sau trả `(2,NEW)`. Không dùng sleep; latch/future timeout 5–10s, finally nhả latch và shutdown executor.
- [ ] Thêm race lockSection/autosave (cùng row lock): giữ một writer bằng latch, writer còn lại chờ; sau commit version=2, locks chứa section, answers NEW. Cả hai thứ tự chạy không làm version quay về 1.
- [ ] Chạy unit + concurrency + autosave regressions; review transaction boundary, lock order attempt→answers và không mở REQUIRES_NEW khi đang giữ khóa.

**Test assertion lõi** (dùng IDs do seed trả về, không hardcode generated ID):

```java
assertThat(resumeBeforeWrite.getVersion()).isEqualTo(1);
assertThat(resumeBeforeWrite.getSavedAnswers().getFirst().getAnswers().getFirst().getAnswer())
    .isEqualTo("ORIGINAL");
assertThat(saveFuture.get(10, TimeUnit.SECONDS).getVersion()).isEqualTo(2);
assertThat(service.getAttemptWorkspace(attemptId).getVersion()).isEqualTo(2);
```

**Run (cwd backend):** `.\mvnw.cmd '-Dtest=TestAttemptWorkspaceResponseTest,TestAttemptResumeConcurrencyIT,TestAttemptAutosaveVersionTest,TestAttemptAutosaveConcurrencyIT' test`.

**AC:** AC-R1; exact grace boundary không đổi; timeout resume hoàn tất không deadlock; lockSection không ghi stale version. GET thường không sửa attempts/answers.

### TV3-07-02 — Backend response safety và HTTP resume contract

**Files:** Task 2 trong matrix. **Depends:** 01; cùng service file nên làm tuần tự. **Produces:** `WorkspaceSnapshotSanitizer.sanitize(Map<String,Object>): Map<String,Object>`, không mutate source; không đổi DTO schema.

- [ ] Viết sanitizer test map/list lồng 3 tầng, key private snake/camel; giữ groups, media, instruction, unknown public field; source vẫn chứa key sau sanitize. Null snapshot → empty map; FE sẽ báo invalid nếu thiếu sections, không dựng đề giả.
- [ ] Chạy sanitizer test xác nhận Red khi class chưa tồn tại.
- [ ] Viết static recursive copy Map/List và blacklist đúng mục 4. Mapper load answers ra biến local trước, gọi sanitizer copy rồi sample serverTime; không gán map đã sanitize vào entity.

```java
// API của utility; implementation dùng LinkedHashMap và recursive List copy.
public static Map<String, Object> sanitize(Map<String, Object> snapshot)
```

- [ ] Tạo ResumeControllerIT dùng SpringBootTest/AutoConfigureMockMvc/profile test, auth `@WithMockUser(roles="USER")`. Seed direct TestAttempt owner1/version7/PRACTICE/startTime cố định, snapshot canonical nested và answers chứa string, array, map, null, essay tiếng Việt. Không dùng POST create, exam ID fixture hoặc class @Transactional khi test competing transaction. Cleanup chỉ những IDs do lớp test tạo, answer trước attempt.
- [ ] Test HTTP PUT version7 → response8 → GET workspace version8/answers mới; GET alias cùng shape; Practice deadline absent/null; lock IDs thật; repeated GET không đổi version/startTime/deadline. Seed owner2 để test403; missing ID cũng403. Anonymous test dùng `@WithAnonymousUser`, giữ security chain thật và assert403 như cấu hình hiện tại.
- [ ] Test legacy snapshot private key không ra JSON và reread DB snapshot vẫn chứa key; `@SpyBean ExamAdapter` verify GET không gọi `findById`. Parametrize terminal statuses: GET trả status, không grade lại/không ghi answers, không tăng version.

```java
mockMvc.perform(get("/api/v1/attempts/{id}/workspace", attemptId))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.data.attemptId").value(attemptId))
    .andExpect(jsonPath("$.data.version").value(8))
    .andExpect(jsonPath("$.data.savedAnswers[0].part_id").value(10))
    .andExpect(jsonPath("$.data.savedAnswers[0].answers[0].question_id").value("q_1"))
    .andExpect(jsonPath("$.data.gracePeriodSeconds").value(15));
```

- [ ] Chạy focused tests; kiểm tra JSON tree private keys recursive thay vì chỉ substring text để không nhầm đáp án essay có từ “feedback”.

**Run (cwd backend):** `.\mvnw.cmd '-Dtest=WorkspaceSnapshotSanitizerTest,TestAttemptResumeControllerIT,TestAttemptWorkspaceResponseTest' test`.

**AC:** AC-R1/R2; real HTTP contract đúng nested names; ownership intact; snapshot source không đổi; answer map/null không mất; không yêu cầu tạo grading key mới.

### TV3-07-03 — Frontend typed contract và validation

**Files:** Task 3 trong matrix. **Depends:** contract mục 4; có thể làm riêng backend sau khi contract đã chốt. **Consumes:** wire camelCase/nested snake_case. **Produces:** `getWorkspace(attemptId): Promise<WorkspaceResponse>` và `createAttempt(req): Promise<WorkspaceResponse>` strict; `WorkspaceContractError` export trong attemptApi.ts.

- [ ] Thêm tests `getWorkspace()` vào attemptApi.test.ts dùng mock axios hiện có: valid version7/answer types/time/locks, snake aliases, missing/malformed fields, mismatched attempt ID. Empty answers hợp lệ; string version, 0, −1, 2147483648, fractional/NaN bị từ chối; 1 và 2147483647 hợp lệ. Không dùng JSON NaN từ HTTP, chỉ parser unit data.
- [ ] Viết test midpoint offset với Date.now spy trả 1000 rồi3000 và serverTime epoch4000; expect offset2000. Test create POST cũng normalize/time offset, preserve request dynamic IDs đã có ở TV3-05.

```ts
vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3000);
mockAxios.get.mockResolvedValueOnce({ success: true, data: {
  attemptId: 42, status: 'IN_PROGRESS', testScope: 'FULL_EXAM', testMode: 'PRACTICE',
  startTime: new Date(0).toISOString(), serverTime: new Date(4000).toISOString(),
  gracePeriodSeconds: 15, version: 7, savedAnswers: [], lockedSections: [],
  examSnapshot: { id: 1, sections: [] },
} });
expect((await getWorkspace(42)).serverTimeOffset).toBe(2000);
```

- [ ] Chạy test, ghi Red cho missing version không còn được default0 và malformed saved answers không còn được hydrate.
- [ ] Mở rộng AttemptStatus đủ 7 enum; WorkspaceResponse thêm required `startTime:string`, `serverTime:string`, `gracePeriodSeconds:number`, `lockedSections:number[]`; giữ property names khác để không refactor renderer/start page.
- [ ] Chuyển normalizer input `unknown`, kiểm tra mục 4 rồi map; không validate code/type/exam_id không có ở DB snapshot. Normalize nested names và reject duplicate part/question IDs. Không thêm runtime schema dependency; dùng helper type guards nội bộ `isRecord`, `isPositiveInt`, `isAnswerValue`.
- [ ] Dùng normalizer cho create/get với before/after; GET thêm check expected ID. Cập nhật typed fixtures useWorkspace/WorkspacePage đúng fields, không cast any để che lỗi typing.
- [ ] Chạy focused API, hook, page, start-page regression và `npm run build` để phát hiện consumer bị ảnh hưởng required fields.

**Run (cwd frontend):** `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useWorkspace.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx`; `npm run build`. Task6 chạy toàn frontend bao gồm start-page tests.

**AC:** AC-R3; payload valid không mất giá trị; invalid response không bị biến thành attempt version0/đề rỗng; alias compatibility explicit; offset finite.

### TV3-07-04 — Hydration lifecycle và metadata refresh không mất edit

**Files:** Task 4 trong matrix. **Depends:**03. **Interface mới:**

```ts
interface UseWorkspaceResult {
  workspace: WorkspaceResponse | null;
  loading: boolean;
  error: string | null;
  ready: boolean; // đúng route + latest successful authoritative hydration
  retry: () => void; // authoritative reload, no-op khi Redux saveStatus==='saving'
  refreshing: boolean;
  refreshError: string | null;
  refreshMetadata: () => Promise<boolean>; // false nếu lỗi/stale/unmount
}
```

- [ ] Đổi test wrapper trả cả store và Provider. Dùng deferred promises để test A pending→routeB→responseA; unmount pending; retry request1→retry2 response đảo thứ tự; StrictMode mount/cleanup; route invalid0/fraction/NaN không gọi API.
- [ ] Test initial savedAnswers version7 hydrate thật; draft localStorage khác không ghi đè server. Test hydrate reset lastSavedAt/saveStatus/pendingVersion; đổi attempt reset flags/highlights, hydrate cùng attempt giữ decorations (không persistence).
- [ ] Test metadata refresh trong lúc dirty, save pending rồi success: response metadata version cũ/mới không đổi Redux; lockedSections/status/server offset vẫn được cập nhật. Metadata error không clear context, không chuyển whole-page loading; refreshError có message, retry metadata được.

```ts
act(() => store.dispatch(setAnswer({ partId: 10, questionId: 'q_1', value: 'NEW' })));
const before = store.getState().answers;
await act(async () => { await result.current.refreshMetadata(); });
expect(store.getState().answers).toEqual(before);
expect(result.current.workspace?.lockedSections).toEqual([100]);
```

- [ ] Chạy hook/slice tests Red: existing retry hydrate mất NEW; interface refresh chưa có; old workspace route readiness sai.
- [ ] Trong hook giữ request generation/ref + attempt identity; mọi then/catch/finally chỉ publish khi token hiện hành. Return workspace=null/ready=false ngay khi stored attempt khác route, kể cả trước effect; retry set loading/ready barrier ngay callback; không clear Redux trên retry failure. Cleanup route/unmount giữ clearAnswers hiện có, không cleanup mỗi metadata request.
- [ ] Metadata fetch có generation riêng nhưng authoritative reload/route change hủy hiệu lực metadata đang pending; nếu initial hydrate chưa ready thì refreshMetadata return false; chỉ latest metadata response publish. Không dispatch setAttemptContext từ metadata path. Không so version metadata để tự chuyển conflict.
- [ ] `setAttemptContext` reset lastSavedAt và hydration fields; nếu previous attemptId khác incoming thì reset flags/highlights; không đổi markSaveSuccess/local pendingVersion semantics TV3-06. Hook check saving bằng live `useStore().getState()` trong retry callback, không captured state.
- [ ] Update mọi WorkspacePage.test mocked hook return để có đủ interface mới, trong Task5 dùng ready thật cho page gating. Chạy focused hook/store.

**Run (cwd frontend):** `npm test -- src/features/exam/__tests__/useWorkspace.test.tsx src/features/exam/__tests__/answerSlice.test.ts`.

**AC:** AC-R4/R5; hydration đúng once per accepted load; stale response không tác động cả error/loading lẫn Redux; metadata refresh giữ pending save và local edit; retry khi saving không làm interval cleanup bỏ response rồi kẹt saving.

### TV3-07-05 — Workspace resume UX, timer và terminal/locked state

**Files:** Task 5 trong matrix. **Depends:**03–04. **Consumes:** ready/refreshMetadata, validated deadline/offset/status. **Produces:** page không write sai lifecycle; timer dùng offset mới ngay.

- [ ] Thêm timer test rerender cùng deadline/offset0→offset−300000, ngay sau rerender remainingSeconds đúng (không chờ 500ms); null→mock valid không expired thoáng qua; mockA→Practice reset expired; visibilitychange/tick vẫn dùng Date.now + offset mới. Giữ legacy `(serverTime,deadline)` test xanh.

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-10-10T03:00:00Z'));
const deadline = '2026-10-10T03:10:00Z';
const { result, rerender } = renderHook(({ offset }) => useExamTimer(deadline, offset),
  { initialProps: { offset: 0 } });
rerender({ offset: -300000 });
expect(result.current.remainingSeconds).toBe(900);
```

- [ ] Thêm page tests useAutosave được gọi null khi !ready/loading/error/mismatch/terminal; stale expired workspace của A trên routeB không submit. Parametrize6 terminal statuses, assert result route bằng MemoryRouter route sentinel, autosave/submit không gọi. Không chỉ assert overlay testid không tồn tại.
- [ ] Test resume first section locked: chọn part đầu thuộc section chưa khóa; palette và controls section khóa disabled. Nếu tất cả section locked thì read-only shell, không chọn target giả, không autosubmit chỉ vì lock; vẫn để user submit hợp lệ theo flow hiện tại. Empty sections không crash.
- [ ] Test lock success gọi refreshMetadata, không retry/hydrate; metadata error có rolealert/nút “Thử lại” refreshMetadata và vẫn giữ dirty. Test dirty conflict reload: cancel không GET; confirm draft saved đúng key và retry; saving/submitting button disabled; network/contract error rolealert và keyboard-operable retry.
- [ ] Chạy Red tests timer/page.
- [ ] Page parse route bằng Number và integer range1..2147483647, áp dụng cùng range tại hook (không parseInt chấp nhận `42abc`). Derive `activeWorkspace = ready && !loading && !error && workspace?.attempt_id===attemptId ? workspace : null`; hook timer dùng activeWorkspace deadline/offset, autosave chỉ active IN_PROGRESS; handleSubmit đầu hàm guard cùng readiness/status + store.attemptId===attemptId. Auto-submit effect dùng active workspace, không cộng grace.
- [ ] Thay navigate trong render bằng effect chỉ khi ready đúng ID và status!=IN_PROGRESS. Guard submit/reload/section navigation trong khi submit. Không sửa result route/page.
- [ ] After lock dùng refreshMetadata; local selectedPartId dùng target thuộc snapshot, reset khi đổi attempt. Chọn initial part từ first unlocked section nếu chưa có selection hợp lệ; effective read-only cho locked section. Không tự gọi lockSection khi mount/resume.
- [ ] Reload callback xác nhận nếu isDirty, thử lưu `exam_draft_${attemptId}` trước retry; storage lỗi phải báo “Không thể giữ bản nháp trên thiết bị. Hãy sao chép bài làm trước khi tải lại.” và không tự discard. Draft có sẵn không auto-load/auto-delete chỉ vì GET thành công; nếu present hiển thị note “Đang dùng bản đã lưu trên máy chủ; bản nháp trên thiết bị chưa được khôi phục.”
- [ ] Timer theo dõi cả explicitOffset và resolvedDeadline; đồng bộ render-time derived remaining để không phát expired từ offset trước. Có thể giữ overloaded API; không dùng raw serverTime tính offset lại ở page. Cleanup interval/listener như hiện tại.
- [ ] Chạy focused page/timer + useAutosave regressions và build.

**Run (cwd frontend):** `npm test -- src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/useExamTimer.test.ts src/features/exam/__tests__/useAutosave.test.tsx`; `npm run build`.

**AC:** AC-R5/R6; no write trước hydrate hoặc sau terminal; mock timer còn đúng thời gian persisted; reload có chủ đích không mất draft âm thầm; section lock đúng UI. Không yêu cầu Practice elapsed timer mới.

### TV3-07-06 — Regression contract và bàn giao

**Files:** Task 6 trong matrix. **Depends:**01–05. **Produces:** integration-style frontend tests và log bằng chứng.

- [ ] Tạo resumeContract.test.tsx dùng real WorkspacePage/useWorkspace/answerSlice/attemptApi; chỉ mock axiosClient HTTP và các browser media API cần thiết, không mock hook/reducer/timer. Reuse canonical small reading+writing fixture inline trong file, ID sections100/200, parts10/20, string question IDs.
- [ ] Test remount store mới: GET version7/answersA → edit→timer15s→PUT response8 → unmount→fresh store mount→GET version8/answersB. Assert rendered radio/text essay + storeversion8, countdown không reset, locks đúng. Test stale local draft không thay B. Giữ HTTP calls có version khớp response, không suy đoán tăng local.
- [ ] Test conflict1601 → reload confirm → GETversion9 → input/version9 + conflict reset; terminal resume không gửi PUT/POST; GET failure retry thành công không gây duplicate interval. Dùng act/fake timers cho15s rồi flush microtasks; đếm calls thay vì chờ thực15s.

```ts
expect(storeAfterRemount.getState().answers.version).toBe(8);
expect(storeAfterRemount.getState().answers.answers[20]['essay_1']).toBe('Bài viết đã lưu');
expect(mockAxios.put).toHaveBeenCalledWith('/v1/attempts/42/answers',
  expect.objectContaining({ version: 7 }));
expect(mockAxios.post).not.toHaveBeenCalled(); // resume không tạo/nộp attempt
```

- [ ] Chạy riêng resumeContract test để có test cycle; các assertion mới race/conflict phải Red trước khi sửa thiếu behavior nếu phát hiện, không sửa test cho khớp bug.
- [ ] Chạy focused backend toàn Task1–2 + autosave/controller/duration/adapter cũ đang xanh; chạy toàn frontend, lint/build. Chạy backend full suite một lần cuối để đối chiếu hai lớp fixture baseline lỗi, không sau mỗi step.
- [ ] Kiểm tra git diff --check/status và file matrix; không vô tình sửa attachment/untracked patch, migrations hoặc result UI.
- [ ] Append handoff: command/cwd/date/count/exit code, AC mapping, known failures, changed files, unresolved risks và next action. Codex reviewer kiểm tra invariants trước PASS; nếu còn regression task-owned ghi NEED_FIX, không PASS.

**AC:** AC-R7; contract được kiểm chứng backend HTTP và frontend real pipeline độc lập; không gọi đây là browser E2E/login E2E. Chưa có môi trường PostgreSQL kiểm tra race thì ghi rõ H2-only, không khẳng định production lock behavior đã chứng minh.

## 8. Focused test matrix (6 khía cạnh)

| Mã TC | Phân loại | Mô tả | Tiền điều kiện | Steps | Dữ liệu | Expected / owner task |
|---|---|---|---|---|---|---|
| TC_TV3_RSM_01 | Happy | Autosave rồi resume | owner attempt active | PUT→GET→remount | v7→8, string/array/map/null/essay | đúng tuple+UI, không mất answer type /01,02,06 |
| TC_TV3_RSM_02 | Happy | Practice restore | active Practice | GET→mount | deadline absent/null, startTime | no countdown/timeout, giữ startTime /02,03,05 |
| TC_TV3_RSM_03 | Negative | Contract malformed | HTTP200 invalid data | getWorkspace | missing answers/version/serverTime/grace; mock thiếu deadline; sai ID | contract error, không hydrate/write /03,05 |
| TC_TV3_RSM_04 | Boundary | Version bounds | valid outer DTO | parse từng value | −1,0,1,2,2147483646,2147483647,2147483648 | chỉ integer1..MAX pass /03 |
| TC_TV3_RSM_05 | Boundary | Grace threshold | mock active | fixed Instant GET | deadline+15s ±1ms, equality | equality giữ active, > finalize1 lần /01 |
| TC_TV3_RSM_06 | Edge/state | Stale requests | deferred GET | A→B/retry/unmount/StrictMode | response đảo thứ tự | latest only, không save/submit sai route /04,05 |
| TC_TV3_RSM_07 | Edge/state | Refresh khi dirty/saving | local NEW, pending save | refreshMetadata→save resolves | metadata version cũ/mới, lock100 | Redux không hydrate/reset/revert /04,05 |
| TC_TV3_RSM_08 | Edge/state | Clock/offset | fake clock | rerender/visibilitychange | ±5min skew, same deadline, offset0→−5min | time đúng ngay, không expired cũ /03,05 |
| TC_TV3_RSM_09 | Security/integrity | IDOR/anonymous | owner1 attempt/owner2 seed | GET owner2/missing/anonymous | real auth chain |403, không payload/mutation /02 |
| TC_TV3_RSM_10 | Security/integrity | Legacy private snapshot | nested source map | GET và reread DB | private snake/camel3 tầng, essay text “feedback” | response stripped, DB/source+answer text giữ /02 |
| TC_TV3_RSM_11 | Integrity | Read/write race | latch-controlled tx | GET pauses→save→release | ORIGINALv1/NEWv2 | không tuple(1,NEW), no deadlock /01 |
| TC_TV3_RSM_12 | Integrity | Lock/save race | two writers | khóa→chạy writer2→release | lock100/version1 |version2, NEW, lock100 tồn tại /01 |
| TC_TV3_RSM_13 | UI/UX/a11y | Loading/error/lock | ready=false/failed/locked | mount/retry/keyboard | role status/alert, locked first/all sections | no editable stale UI, accessible retry /05 |
| TC_TV3_RSM_14 | UI/UX/state | Terminal resume | each of6 statuses | GET→mount | SUBMITTED/FAILED/AI/QUEUED/COMPLETED/EXPIRED |result route, no PUT/POST /02,05,06 |
| TC_TV3_RSM_15 | UI/UX/integrity | Reload dirty + draft | conflict, local essay | cancel/confirm/storage failure | backendversion9 vs draft | no silent overwrite, draft note, success hydrate /04–06 |

Rate-limit/brute-force, SQLi policy và auth token refresh không thay đổi; không thêm endpoint/search/raw SQL. XSS answer text render qua renderer/HtmlContent sanitization hiện có, chạy renderer regressions toàn frontend; không render draft JSON bằng innerHTML.

### Commands cuối cùng (PowerShell, mỗi command chạy riêng)

```powershell
# Cwd D:/Project/University/multilingo-platform/backend
.\mvnw.cmd '-Dtest=TestAttemptResumeConcurrencyIT,TestAttemptResumeControllerIT,WorkspaceSnapshotSanitizerTest,TestAttemptWorkspaceResponseTest,TestAttemptAutosaveVersionTest,TestAttemptAutosaveConcurrencyIT,TestAttemptAutosaveControllerTest,TestAttemptSinglePartDurationTest,DbExamAdapterTest' test
.\mvnw.cmd test
# Cwd D:/Project/University/multilingo-platform/frontend
npm test
npm run lint
npm run build
# Cwd root
git diff --check
git status --short
```

Expected: mọi focused/new test PASS, frontend suite/build PASS, lint không lỗi và không tăng warning task-owned; ghi count thực tế, không dùng count cũ làm target. Backend full suite nếu fail phải liệt kê từng case và so baseline 6 failures ControllerIT + 14 errors ServiceTest; các lớp khác chưa có baseline toàn suite, cần kiểm tra trên HEAD gốc nếu phát hiện lỗi trước khi phân loại. Baseline không cho phép bỏ qua failure mới. PostgreSQL staging race smoke chỉ trên DB test riêng khi có môi trường được cấp, không dùng production hoặc xóa broad data.

## 9. Security, compatibility, dependencies và risks

- Auth/owner check trước đọc private state; non-owner/missing indistinguishable. Không trust attempt/user ID từ localStorage.
- GET workspace là read thường nhưng có lazy-finalize side effect đã tồn tại, giữ behavior timeout; không tạo attempt/session mới hoặc grade lại terminal state.
- Sanitizer không mutate grading snapshot; alias endpoint/wire giữ tương thích. FE strict reject legacy payload thiếu authoritative fields là chủ đích; backend HEAD đã có fields, không giả lập timestamp/version để “hỗ trợ” response không đủ.
- `01→02` backend; `03→04→05` frontend; `01–05→06`. Hai nhánh backend/frontend có thể chuẩn bị riêng sau khi duyệt contract, nhưng không sửa cùng file/test đồng thời. Khuyến nghị tuần tự 01→02→03→04→05→06 cho Gemini.
- **RISK:** khóa GET có thể giữ lâu khi grading lazy-finalize; giữ lock row một attempt, không thêm external AI/network call. Future async grading không thuộc task này.
- **RISK:** H2 PostgreSQL-mode không chứng minh toàn bộ PostgreSQL locking semantics; cần staging test riêng trước production rollout nếu PostgreSQL chưa được kiểm chứng.
- **VERIFIED baseline issue:** `TestAttemptControllerIT` 6 failures và `TestAttemptServiceTest` 14 errors nêu trên. Không chặn viết plan/new focused IT, nhưng full-suite clean gate chưa đạt; sửa fixture lớp cũ phải được scope riêng, không reset DB production.
- **VERIFIED follow-up:** result route hiện dùng `ExamResultPage` sample data, chưa hiển thị terminal status thật. TV3-07 chỉ bảo đảm không tiếp tục làm bài trên terminal, không tuyên bố result UX hoàn tất.
- **Không có blocker để lập kế hoạch.** Gate tiếp theo là phê duyệt plan/contract; nếu yêu cầu recovery UI offline hoặc một trạng thái ngoài enum hiện tại, dừng executor và xin điều chỉnh scope.

## 10. Definition of Done

- [ ] AC-R1..R7 và 15 TC có evidence, không chỉ checklist.
- [ ] Backend resume tuple coherent, race test deterministic, no REQUIRES_NEW self-deadlock, normal GET không tăng version.
- [ ] HTTP response nested names đúng, owner-only, snapshot deep-copy sanitized; saved answer values giữ nguyên.
- [ ] FE strict contract, live server version, latest-request hydrate và metadata-only refresh tách biệt.
- [ ] Ready gate/timer/terminal/locks đúng, reload không discard draft âm thầm.
- [ ] Focused/new tests và frontend broad/build xanh; full backend failures được phân loại baseline/new. Không báo full suite PASS khi còn baseline failures/errors.
- [ ] Handoff append-only có changed files, commands và reviewer result; không thay files ngoài matrix nếu chưa ghi amendment.
- [ ] Không commit/push; không sửa persisted schema hoặc unrelated patch.

## 11. Gemini execution instructions

1. Đọc plan này, spec AC-04 và latest handoff; kiểm tra HEAD/status trước sửa. Không thực hiện Task1 nếu chỉ đang được yêu cầu review/plan.
2. Khi được duyệt triển khai, append IN_PROGRESS cho task; Red→Green→Refactor từng checkbox, chạy focused command đúng cwd. Không cần full suite sau mỗi bước.
3. Không tạo endpoint mới, đổi API casing hoặc reconstruct deadline từ duration. Không dùng `workspace.version` receipt metadata làm current autosave version.
4. Không reuse fixture create exam1 trong resume IT; seed attempt/answers và cleanup IDs riêng. Không class @Transactional trong concurrency tests; không sleep chờ race.
5. Nếu phải sửa file khác matrix vì compile failure, ghi file/lý do trong handoff và chỉ làm thay đổi tương thích cần thiết; thay đổi architecture phải chờ điều chỉnh plan.
6. Append IMPLEMENTED với test evidence, không tự nhận PASS toàn task nếu chưa review. Fix theo Codex review và append FIXED; không xóa log cũ.

## 12. Codex review checklist

- [ ] Review từ diff thực tế: query owner khóa, transaction held tới materialize answers, writer lockSection cùng order; grace boundary exact.
- [ ] Không gọi ensureFinalized/REQUIRES_NEW khi đang giữ workspace row lock; result/review không bị đổi ngoài scope.
- [ ] Sanitizer map/list recursively và aliases đầy đủ, DB source unchanged; không strip user answer contents.
- [ ] Required fields validated trước hydrate; source IDs/status/time đúng; nullable Practice khác malformed Mock.
- [ ] Hook guards cả then/catch/finally, route mismatch immediate; metadata never dispatch hydration/reset, retry saving barrier thật.
- [ ] Page uses ready+matchingID+IN_PROGRESS, submit handler và timeout effect cùng gate; navigate effect, no terminal writes.
- [ ] Timer same-deadline new-offset test không chờ tick; all-locked/empty snapshot không chọn part giả.
- [ ] Real pipeline test không mock hook/store; assertions UI/context/call counts đủ mạnh, không dùng nonexistent testid.
- [ ] Test logs current, failures không bị hidden/skipped; baseline phân loại chính xác; diff chỉ scope cho phép.

## 13. Out-of-scope follow-up issues

- Sửa seed/fixture `TestAttemptControllerIT` và `TestAttemptServiceTest` để full backend suite clean; DB migration V1/V2 và docs schema drift audit riêng.
- Backend write validation part/question/snapshot/locked section và submit baseVersion theo AC-06/TV3-06 follow-up.
- Result/review data thật và trạng thái AI_GRADING_QUEUED/GRADING_FAILED/EXPIRED UI.
- Offline recovery/merge/export draft có version metadata và xử lý nhiều tài khoản cùng thiết bị.
- UC08.1 persistent flags/highlights; audio/selection position resume chưa nằm trong backend contract.
- PostgreSQL concurrency smoke trên test DB riêng; timer drift dài hạn/clock đổi trong phiên nếu cần sync định kỳ.

### Planner self-review

- Contract names/signatures, file existence và DB paths đã đối chiếu HEAD; file mới được đánh dấu Create.
- Resume AC-04/BE-RSM-01/FE-RSM-01 map tới01–06; snapshot AC-01 tới02; không nhận thay toàn bộ TV3-00.
- Năm Review Focus có test owner; 15 TC phủ 6 khía cạnh; TDD commands và AC riêng mỗi task.
- Không thêm placeholder, commit/push step hoặc triển khai production/test code trong lượt planning.
