# Sprint 05 — Timer và Nộp Bài: Kế Hoạch Triển Khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai cơ chế thu bài 3 lớp bảo vệ (Client Timeout, Lazy Finalize, Server Scheduler) và tách biệt pha đóng bài với pha chấm điểm để đảm bảo tính toàn vẹn dữ liệu khi hết giờ thi.

**Architecture:** 
- Two-phase Submission: Pha 1 (Finalize) lưu `end_time = min(now, deadline)` bằng `SELECT ... FOR UPDATE` và chuyển trạng thái `SUBMITTED`. Pha 2 (Grading) chạy độc lập, lỗi chấm điểm chuyển thành `GRADING_FAILED` không ảnh hưởng Pha 1.
- 3-Tier Auto-Submit: Client countdown tự động gửi với `reason=TIMEOUT_CLIENT` (được grace window 15s); Các API GET kiểm tra và Lazy Finalize nếu quá hạn; Cron Scheduler quét và khóa attempt chạy ngầm để thu hồi bài quá hạn cứng.
- Frontend Countdown: Tính `offset = serverTime - clientNow` 1 lần, đếm ngược từ deadline bù offset, tự động recalculate khi `visibilitychange` để chống timer drift.

**Tech Stack:** Java 21, Spring Boot 3.3.4, PostgreSQL 16 (Pessimistic Locking / SKIP LOCKED), React 19, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-02-sprint05-timer-and-submission-design.md`

## Global Constraints

- **Timezone convention:** Thống nhất lưu UTC (`timestamptz` / `Instant`), API trả chuẩn ISO-8601 UTC (`...Z`), Frontend tự format theo Local Time.
- **Grace Window:** 15 giây, chỉ áp dụng cho request submit có `reason = TIMEOUT_CLIENT`.
- **Autosave conflict:** Mọi request autosave sau deadline bị từ chối bằng HTTP 409 (`ATTEMPT_EXPIRED`).

## Review Focus

- **Nộp bài trùng lặp / Race condition:** Hai request submit cùng lúc, request thứ hai phải bị chặn lại hoặc trả về kết quả đã được chốt bởi request đầu (Idempotency).
- **Grace Window bị lạm dụng:** Request có `reason=MANUAL` gửi sau deadline 1 giây phải bị từ chối, chỉ `TIMEOUT_CLIENT` mới được phép trong 15s.
- **Timer drift khi sleep máy tính:** Frontend countdown bị lệch nếu máy sleep, cần test kịch bản `visibilitychange` trigger tính lại dựa trên offset ban đầu.
- **Lỗi hệ thống khi chấm bài khách quan:** Nếu `ObjectiveGradingService` throw Exception, attempt phải lưu được trạng thái `GRADING_FAILED` và đáp án cuối cùng không bị rollback.
- **Autosave đè đáp án sau khi hết giờ:** Autosave request chạy ngầm sau deadline phải nhận lỗi 409 và frontend clear interval, không được phép update `attempt_answers`.

---

### Task 1: S05-01 Cập nhật Enum & Request DTOs

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/model/enums/AttemptStatus.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/model/enums/SubmitReason.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/SubmitAttemptRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/AttemptWorkspaceResponse.java`

**Interfaces:**
- Produces: `AttemptStatus` mới (`SUBMITTED`, `GRADING_FAILED`, `EXPIRED`, `AI_GRADING_QUEUED`)
- Produces: `SubmitReason` (`MANUAL`, `TIMEOUT_CLIENT`, `TIMEOUT_SERVER`)
- Produces: `SubmitAttemptRequest` có chứa `reason`, `baseVersion`, và `finalAnswers`

- [ ] **Step 1: Write the failing test**
```java
// Trong SubmitAttemptRequestTest.java
@Test
void testSubmitRequestValidation() {
    SubmitAttemptRequest req = new SubmitAttemptRequest();
    // Bỏ trống reason sẽ lỗi
    Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    Set<ConstraintViolation<SubmitAttemptRequest>> violations = validator.validate(req);
    assertFalse(violations.isEmpty());
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmitAttemptRequestTest`
Expected: FAIL vì class chưa tồn tại hoặc test không pass.

- [ ] **Step 3: Write minimal implementation**
Bổ sung các enum `SubmitReason`, thêm states vào `AttemptStatus`. Sửa `SubmitAttemptRequest` chứa `reason` (@NotNull) và các field `baseVersion`, `finalAnswers`. Bổ sung `serverTime`, `deadline`, `gracePeriodSeconds` vào `AttemptWorkspaceResponse`.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmitAttemptRequestTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/model/enums/ backend/src/main/java/com/multilingo/backend/modules/testing/dto/
git commit -m "feat(testing): add new enums and submit request DTOs for sprint 05"
```

---

### Task 2: S05-02 Tách Đóng bài & Chấm điểm (Submit Service Refactor)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/service/SubmissionServiceTest.java`

**Interfaces:**
- Consumes: `SubmitAttemptRequest`
- Produces: Two-phase submit process. Transaction 1: Finalize (status `SUBMITTED`). Phase 2: Grading (status `COMPLETED` or `GRADING_FAILED`).

- [ ] **Step 1: Write the failing test**
```java
@Test
void submitAttempt_gradingFails_statusIsGradingFailed() {
    // Mock finalize success, grading throws Exception
    // Assert attempt status in DB is GRADING_FAILED, end_time is not null.
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Tách `submitAttempt` hiện tại:
1. `finalizeAttempt()`: Kiểm tra status, update status thành `SUBMITTED`, lưu `finalAnswers`. Yêu cầu `@Transactional`.
2. Khối `try/catch` gọi `gradeAttempt()`. Nếu lỗi, update status thành `GRADING_FAILED`.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java backend/src/test/java/com/multilingo/backend/modules/testing/service/SubmissionServiceTest.java
git commit -m "refactor(testing): implement two-phase submission pipeline"
```

---

### Task 3: S05-03 Concurrency, Idempotency & end_time

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/repository/TestAttemptRepository.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`

**Interfaces:**
- Produces: `SELECT * FROM test_attempts WHERE id = ? FOR UPDATE`
- Produces: `endTime = min(now, deadline)`

- [ ] **Step 1: Write the failing test**
```java
@Test
void submitAttempt_concurrentRequests_idempotent() throws InterruptedException {
    // Dùng 2 thread gọi submit trên cùng 1 attemptId
    // Assert chỉ 1 thread thay đổi DB, thread kia trả về kết quả cũ
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmissionServiceTest#submitAttempt_concurrentRequests_idempotent`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Thêm `@Lock(LockModeType.PESSIMISTIC_WRITE)` vào `findByIdForUpdate` trong repository. 
Trong service `finalizeAttempt`:
- `Attempt attempt = repo.findByIdForUpdate(id)`
- Nếu `status != IN_PROGRESS`, throw/return early.
- Cố định `end_time`: `Instant calculatedEndTime = attempt.getDeadline() != null && now.isAfter(attempt.getDeadline()) ? attempt.getDeadline() : now; attempt.setEndTime(calculatedEndTime);`

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(testing): add pessimistic locking and end_time calculation for submit"
```

---

### Task 4: S05-04 Grace Window 15s cho Submit & Phân xử Autosave

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`

**Interfaces:**
- Consumes: `SubmitReason` và `deadline`
- Produces: 409 `ATTEMPT_EXPIRED` logic cho autosave.

- [ ] **Step 1: Write the failing test**
```java
@Test
void autosave_afterDeadline_throwsExpired() {
    // setup attempt with deadline 10s ago
    // call autosave
    // Assert throws AppException with ErrorCode.ATTEMPT_EXPIRED
}
@Test
void submit_manualAfterDeadline_throwsExpired() {
   // submit reason MANUAL 1s after deadline -> throws
}
@Test
void submit_timeoutClientInGraceWindow_success() {
   // submit reason TIMEOUT_CLIENT 10s after deadline -> success
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Trong `autosaveAnswers`: 
`if (deadline != null && Instant.now().isAfter(deadline)) throw new AppException(ErrorCode.ATTEMPT_EXPIRED);`
Trong `finalizeAttempt`:
Nếu `reason == MANUAL`, bắt buộc `now <= deadline` (có margin delay nhỏ như 2s tùy policy).
Nếu `reason == TIMEOUT_CLIENT`, cho phép `now <= deadline.plusSeconds(15)`. Quá 15s thì fallback sang `TIMEOUT_SERVER` (bỏ qua `finalAnswers` client gửi, dùng bản autosave gần nhất).

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(testing): enforce strict deadline on autosave and 15s grace window on submit"
```

---

### Task 5: S05-05 Job Writing (Stub) & Chuyển Trạng Thái

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`

**Interfaces:**
- Produces: Logic kiểm tra quota (stub) và chuyển status sang `AI_GRADING` hoặc `AI_GRADING_QUEUED`. Bài thuần khách quan thì `COMPLETED`.

- [ ] **Step 1: Write the failing test**
```java
@Test
void gradeAttempt_withWriting_statusAiGrading() {
   // mock hasWritingPart = true
   // Assert status is AI_GRADING
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmissionServiceTest#gradeAttempt_withWriting_statusAiGrading`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Trong Pha 2 (Grading), sau khi chấm khách quan:
```java
boolean hasWriting = checkHasWriting(attempt);
if (hasWriting) {
    boolean hasQuota = checkAiQuota(userId); // Stub trả true
    attempt.setStatus(hasQuota ? AttemptStatus.AI_GRADING : AttemptStatus.AI_GRADING_QUEUED);
    // TODO: Create Job Writing (sẽ implement chi tiết ở Sprint 09)
} else {
    attempt.setStatus(AttemptStatus.COMPLETED);
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(testing): add AI grading status routing based on writing skill"
```

---

### Task 6: S05-06 Lazy Finalize & Background Scheduler (⚠️ Xin Phép)

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/service/scheduler/AttemptExpirationScheduler.java`

**Interfaces:**
- Consumes: GET requests (`getAttemptWorkspace`, `getAttemptResult`).
- Produces: Cron Job chạy mỗi 30s.

- [ ] **Step 1: Write the failing test**
```java
@Test
void getWorkspace_pastDeadline_triggersLazyFinalize() {
    // setup IN_PROGRESS attempt past deadline
    // call getAttemptWorkspace
    // Assert response status is EXPIRED or SUBMITTED, and DB is updated
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Trong `getAttemptWorkspace` và `getAttemptResult`, kiểm tra nếu `now > deadline`, lập tức gọi `finalizeAttempt(id, TIMEOUT_SERVER)`.
Tạo `AttemptExpirationScheduler` với `@Scheduled(fixedDelay = 30000)`:
`repo.findExpiredInProgressAttempts(now - 15s)`. Loop và gọi submit với `reason=TIMEOUT_SERVER`. *(Note: cần cấu hình `@EnableScheduling` ở class Config nào đó)*.

- [ ] **Step 4: Run test to verify it passes**
Run: `mvn test -Dtest=SubmissionServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/scheduler/
git commit -am "feat(testing): implement lazy finalize and background expiration scheduler"
```

---

### Task 7: S05-07 Frontend Countdown & Chống Timer Drift

**Files:**
- Create: `frontend/src/features/exam/hooks/useExamTimer.ts`
- Modify: `frontend/src/features/exam/components/workspace/ExamHeader.tsx`

**Interfaces:**
- Consumes: `serverTime`, `deadline` từ workspace.
- Produces: `remainingSeconds`, `isExpired`.

- [ ] **Step 1: Write the failing test**
```typescript
import { renderHook, act } from '@testing-library/react';
import { useExamTimer } from './useExamTimer';
import { vi } from 'vitest';

test('useExamTimer calculates remaining seconds correctly with offset', () => {
    vi.useFakeTimers();
    const serverTime = '2026-10-02T12:00:00Z';
    const deadline = '2026-10-02T12:01:00Z';
    // mock Date.now = 2026-10-02T11:59:50Z (Client chậm hơn server 10s)
    
    const { result } = renderHook(() => useExamTimer(serverTime, deadline));
    expect(result.current.remainingSeconds).toBe(60); 
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.remainingSeconds).toBe(59);
    vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- useExamTimer`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
`useExamTimer.ts`:
- Tính `offset = new Date(serverTime).getTime() - Date.now()` 1 lần duy nhất trong `useEffect`.
- `setInterval` 1000ms tính `currentEstimatedServerTime = Date.now() + offset`.
- `remaining = Math.max(0, Math.floor((deadline - currentEstimatedServerTime) / 1000))`.
- Lắng nghe `visibilitychange` để trigger force update.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- useExamTimer`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/hooks/
git commit -m "feat(exam): robust countdown timer with drift compensation"
```

---

### Task 8: S05-08 Frontend Modal Nộp Bài Thủ Công

**Files:**
- Create: `frontend/src/features/exam/components/modals/SubmitConfirmModal.tsx`
- Modify: `frontend/src/features/exam/pages/ExamWorkspacePage.tsx`

**Interfaces:**
- Consumes: `answeredCount`, `totalQuestions`
- Produces: UI modal xác nhận với trạng thái loading

- [ ] **Step 1: Write the failing test**
```typescript
test('displays uncompleted questions warning', () => {
   render(<SubmitConfirmModal total={40} answered={38} onConfirm={vi.fn()} />);
   expect(screen.getByText(/Bạn còn 2 câu chưa làm/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- SubmitConfirmModal`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Tạo Modal dùng Tailwind/shadcn. Nếu `answered < total`, đổi màu text sang warning, nút xác nhận disable trong 2s (chống double click do cuống). Gọi API `submitAttempt` kèm `reason: 'MANUAL'`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- SubmitConfirmModal`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/components/modals/
git commit -am "feat(exam): add manual submit confirmation modal with stats"
```

---

### Task 9: S05-09 Tự Động Thu Bài Khi Hết Giờ (Auto-submit & Error UX)

**Files:**
- Create: `frontend/src/features/exam/components/modals/TimeUpOverlay.tsx`
- Modify: `frontend/src/features/exam/pages/ExamWorkspacePage.tsx`

**Interfaces:**
- Consumes: `isExpired` từ `useExamTimer`
- Produces: Gọi `submitAttempt` với `reason: 'TIMEOUT_CLIENT'`

- [ ] **Step 1: Write the failing test**
```typescript
test('renders unclosable time up overlay and calls submit automatically', () => {
   const submitMock = vi.fn();
   render(<TimeUpOverlay isExpired={true} onSubmit={submitMock} />);
   expect(screen.getByText(/Thời gian làm bài đã hết/i)).toBeInTheDocument();
   expect(submitMock).toHaveBeenCalledWith('TIMEOUT_CLIENT');
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- TimeUpOverlay`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
`TimeUpOverlay` full screen, `z-index` cao nhất.
Trong `useEffect` kiểm tra `isExpired`, nếu true:
- Disable mọi tương tác bàn phím/chuột bằng class `pointer-events-none`.
- Gọi API. Nếu lỗi mạng, hiển thị text "Kết nối không ổn định, đang thử lại...".
- Nút "Thử lại ngay" gọi lại API.
- Nếu API trả lỗi 409 (`ATTEMPT_EXPIRED` hoặc `ATTEMPT_ALREADY_SUBMITTED`), coi như thành công và navigate sang trang kết quả `/exam/result/:id`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- TimeUpOverlay`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/components/modals/TimeUpOverlay.tsx
git commit -am "feat(exam): time up auto-submit overlay with network retry"
```

---

### Task 10: S05-10 Dừng Autosave Sau Khi Hết Giờ

**Files:**
- Modify: `frontend/src/features/exam/hooks/useAutosave.ts`

**Interfaces:**
- Consumes: Lỗi 409 từ API.
- Produces: Dừng `setInterval` timer.

- [ ] **Step 1: Write the failing test**
```typescript
test('clears interval on 409 error', async () => {
    // mock fetch to return 409 ATTEMPT_EXPIRED
    // renderHook useAutosave
    // Assert interval is cleared and state is 'stopped'
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- useAutosave`
Expected: FAIL 

- [ ] **Step 3: Write minimal implementation**
Bổ sung `try/catch` trong callback fetch autosave. Nếu `err.response.status === 409`, gọi `clearInterval(timerRef.current)`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- useAutosave`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "fix(exam): clear autosave interval gracefully on expiration conflict"
```
