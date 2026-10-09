# TV3-06 — Server-Authoritative Autosave Version Implementation Plan

> **For agentic workers:** Bắt buộc dùng `test-driven-development`, triển khai lần lượt theo Red → Green → Refactor. Không commit hoặc push.

**Goal:** Biến `test_attempts.version` thành nguồn phiên bản duy nhất của autosave, ngăn ghi đè từ client cũ và đồng bộ phiên bản mới về frontend.

**Architecture:** Backend khóa dòng attempt bằng `PESSIMISTIC_WRITE`, kiểm tra version, lưu answers và tăng version đúng một lần trong cùng transaction. Frontend chỉ cập nhật Redux version từ response server; HTTP 409 chuyển sang conflict và cho tải lại workspace có thẩm quyền.

**Tech Stack:** Java 21, Spring Boot 3.3.4, JPA, H2/PostgreSQL, JUnit 5, Mockito, React 19, Redux Toolkit, Axios, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md`, mục 5.3 và AC-05.

## Global Constraints

- Response autosave chỉ chứa `version`; không thêm `serverTime`.
- Không thêm migration hoặc `@Version`; cột `version INTEGER NOT NULL DEFAULT 1` đã tồn tại và được quản lý ở application layer.
- Mọi thao tác phải giữ ownership check qua `IdentityAdapter`.
- Không sửa thay đổi ngoài phạm vi: `BackendApplication.java` và `TV3-03-review.patch`.
- Không triển khai kiểm tra `SubmitAttemptRequest.baseVersion` ở backend trong task này.
- Không sửa validation part/question/locked section đang tồn đọng từ AC-06.

## Review Focus

- Hai transaction bắt đầu cùng version và chỉ một request thắng.
- Edit mới trong lúc autosave chờ response không bị đánh dấu đã lưu nhầm.
- Lỗi mạng tiếp tục retry, còn 409 chuyển conflict và dừng ghi.
- Empty payload không xóa answers đã lưu nhưng vẫn tiến version.
- Direct autosave trong `WorkspacePage` dùng version response mới trước submit.

## 1. Verified Repository Findings

- Branch: `feature/TV3-00-contract-audit`.
- Worktree có `BackendApplication.java` modified ngoài phạm vi và `TV3-03-review.patch` untracked; phải bảo toàn.
- `TestAttempt.version` là cột thường, mặc định `1`, không có `@Version`.
- `TestAttemptRepository.findByIdAndUserIdForUpdate()` đã có `PESSIMISTIC_WRITE`.
- `autosaveAnswers()` hiện dùng query không khóa, không kiểm tra/tăng version, trả `void`, controller trả `ApiResponse<Void>`.
- `AutosaveAnswersRequest.version` đã có `@NotNull`.
- Frontend gửi version hiện tại nhưng API trả `void`; Redux không cập nhật version sau autosave.
- `useAutosave` đã dừng interval với lỗi 409 nhưng chỉ hiển thị lỗi chung; chưa có conflict/reload UX.
- `WorkspacePage` gọi autosave trực tiếp trước submit và tiếp tục dùng version cũ.
- Baseline: backend focused 5/5 pass; frontend autosave/store focused 31/31 pass. `TestAttemptControllerIT#put_answers_returns_200_for_valid_attempt` fail baseline vì test DB không có exam cho `DbExamAdapter`.

## 2. API, DTO và state contract

Request giữ nguyên:

```json
{"version":1,"answers":[{"part_id":10,"answers":[{"question_id":"q1","answer":"A"}]}]}
```

Success:

```json
{"success":true,"code":200,"data":{"version":2}}
```

- Thêm `ErrorCode.VERSION_CONFLICT(1601, HttpStatus.CONFLICT, ...)`.
- Version stale trả HTTP 409/code 1601; không ghi `attempt_answers`, không tăng version.
- Attempt mới bắt đầu ở `1`; request đúng version tăng đúng một lần.
- `answers: []` không xóa answers cũ nhưng vẫn tăng version.
- Hai request đồng thời cùng version: đúng một request thành công.
- Submitted, expired hoặc không đúng owner không đổi version.

## 3. Exact File Change Matrix

### Backend

- Create `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/AutosaveVersionResponse.java`
- Modify `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`
- Modify `backend/src/main/java/com/multilingo/backend/modules/testing/service/TestAttemptService.java`
- Modify `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Modify `backend/src/main/java/com/multilingo/backend/modules/testing/controller/TestAttemptController.java`
- Create `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptAutosaveVersionTest.java`
- Create `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptAutosaveConcurrencyIT.java`
- Create `backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptAutosaveControllerTest.java`

### Frontend

- Modify `frontend/src/features/exam/types/api.types.ts`
- Modify `frontend/src/features/exam/api/attemptApi.ts`
- Modify `frontend/src/features/exam/store/answerSlice.ts`
- Modify `frontend/src/features/exam/hooks/useAutosave.ts`
- Modify `frontend/src/features/exam/components/SaveStatusBadge.tsx`
- Modify `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Modify `frontend/src/features/exam/__tests__/attemptApi.test.ts`
- Modify `frontend/src/features/exam/__tests__/answerSlice.test.ts`
- Modify `frontend/src/features/exam/__tests__/useAutosave.test.tsx`
- Modify `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`
- Create `frontend/src/features/exam/__tests__/SaveStatusBadge.test.tsx`

## 4. Detailed Implementation Subtasks

### TV3-06-01 — Backend version transaction

**Steps:**

1. Viết test đỏ cho matching version, stale version, empty answers, submitted/expired và repository lock.
2. Tạo `AutosaveVersionResponse` chỉ có `Integer version`.
3. Đổi signature service thành `AutosaveVersionResponse autosaveAnswers(Integer, AutosaveAnswersRequest)`.
4. Trong service dùng `findByIdAndUserIdForUpdate`, kiểm tra owner/status/deadline, so sánh version trước `saveAnswersInternal`.
5. Lưu answers, tăng version đúng một lần, `testAttemptRepository.save(attempt)` và trả DTO.
6. Bảo đảm lỗi trong quá trình lưu rollback cả answers và version.

**Test:** `cd backend; .\mvnw.cmd "-Dtest=TestAttemptAutosaveVersionTest" test`.

**Acceptance:** Matching trả version mới; stale không mutation; empty không xóa dữ liệu; state/deadline/ownership được kiểm tra trước mutation.

### TV3-06-02 — Controller contract và concurrency

**Steps:**

1. Viết standalone MockMvc test: success trả `$.data.version == 2`, không có `serverTime`; conflict trả HTTP 409/code 1601.
2. Đổi controller thành `ResponseEntity<ApiResponse<AutosaveVersionResponse>>`.
3. Viết integration test seed trực tiếp attempt owner `1`, không gọi endpoint tạo attempt đang lỗi baseline.
4. Dùng latch cho hai thread cùng version `1`; xác nhận một success, một `VERSION_CONFLICT`, version cuối `2`, answer không bị trộn.
5. Test stale giữ nguyên answer/version.

**Tests:**

```powershell
.\mvnw.cmd "-Dtest=TestAttemptAutosaveControllerTest" test
.\mvnw.cmd "-Dtest=TestAttemptAutosaveConcurrencyIT" test
```

**Acceptance:** JSON contract đúng; row lock loại bỏ lost update; test không phụ thuộc exam fixture.

### TV3-06-03 — Frontend API, Redux và autosave hook

**Steps:**

1. Thêm `AutosaveResponse { version: number }`.
2. Đổi `autosaveAnswers()` thành `Promise<AutosaveResponse>`, unwrap `res.data` và reject response thiếu version hợp lệ.
3. Thêm save status `'conflict'`.
4. Đổi `markSaveSuccess` thành payload `{savedAt, pendingVersion, serverVersion}`; reducer cập nhật version server và chỉ clear dirty khi pending version không đổi.
5. Thêm `markSaveConflict()` giữ dirty state.
6. Hook dispatch success với version server; network error lưu draft/retry; 409 chuyển conflict và guard bỏ qua chu kỳ sau.
7. Không tự suy đoán `version + 1` ở client.

**Test:**

```powershell
cd frontend
npm test -- --run src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/answerSlice.test.ts src/features/exam/__tests__/useAutosave.test.tsx
```

**Acceptance:** Redux chỉ nhận version server; edit mới không mất dirty state; network error và 409 khác hành vi.

### TV3-06-04 — Conflict UX và pre-submit flush

**Steps:**

1. Cho `SaveStatusBadge` nhận `onReload?: () => void`.
2. Với conflict, render `role="alert"`, thông báo phiên đã thay đổi và nút “Tải lại bản mới nhất”; không hiển thị “Đang thử lại”.
3. Truyền `useWorkspace().retry` từ `WorkspacePage`; retry hydrate answers/version server và reset conflict.
4. Pre-submit flush giữ `pendingVersion`, nhận response version, dispatch success và dùng version mới làm `baseVersion`.
5. Test alert/reload, dirty submit dùng version mới, non-dirty submit dùng version hiện tại và submit failure không quay về version cũ.

**Test:** `npm test -- --run src/features/exam/__tests__/SaveStatusBadge.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx`.

**Acceptance:** 409 không retry vô hạn; người dùng tải được workspace authoritative; pre-submit không dùng stale version.

### TV3-06-05 — Regression và handoff

```powershell
cd backend
.\mvnw.cmd "-Dtest=TestAttemptAutosaveVersionTest,TestAttemptAutosaveControllerTest,TestAttemptAutosaveConcurrencyIT,TestAttemptWorkspaceResponseTest,TestAttemptSinglePartDurationTest,LearnerExamStructureServiceTest,LearnerExamStructureControllerIT" test

cd ..\frontend
npm test -- --run src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/answerSlice.test.ts src/features/exam/__tests__/useAutosave.test.tsx src/features/exam/__tests__/SaveStatusBadge.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx
npm test -- --run
npm run lint
npm run build

cd ..
git diff --check
git status --short
```

Append agent role, subtask, status, changed files, exact test counts, concurrency evidence, blockers/deviations và next action vào handoff. Không ghi “working tree clean” khi còn thay đổi TV3-03/TV3-06. Full backend suite chỉ là diagnostic nếu baseline `DbExamAdapter` còn fail.

## 5. Acceptance Criteria tổng

- AC-01: Save đúng version lưu atomic và trả version tăng một.
- AC-02: Save stale trả HTTP 409/code 1601 và DB không đổi.
- AC-03: Hai client cùng version chỉ một client thắng.
- AC-04: Empty answers không xóa answers cũ và vẫn tiến version.
- AC-05: Frontend cập nhật version server kể cả khi có edit mới trong request.
- AC-06: 409 chuyển UI sang conflict, dừng ghi và cho tải workspace mới.
- AC-07: Pre-submit dùng version do autosave vừa trả về.
- AC-08: Wrong owner, submitted và expired không làm đổi answers/version.

## 6. Security, compatibility và out of scope

- Response không lộ answer key, snapshot hoặc grading data; ownership luôn nằm trong query khóa.
- Không thêm schema, dependency hoặc route.
- Không triển khai part/question scope validation, locked-section conflict, submit baseVersion enforcement, submit/scheduler lifecycle, offline merge hoặc sửa baseline test DB.
- Không sửa `BackendApplication.java`, `TV3-03-review.patch` hay file ngoài matrix.

## 7. Definition of Done và execution order

- Backend lock/compare/increment/response đúng contract.
- Stale/concurrent autosave không ghi đè.
- Frontend dùng version server và có conflict reload UX.
- Focused backend tests, frontend full suite, lint, build và diff check đạt.
- Handoff có bằng chứng thực tế và giữ lịch sử append-only.

Thứ tự: `TV3-06-01 → TV3-06-02 → TV3-06-03 → TV3-06-04 → TV3-06-05`.
