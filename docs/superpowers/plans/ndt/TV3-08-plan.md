# TV3-08 — Autosave + restore + finalAnswers ở frontend

Ngày: 2026-10-10. Trạng thái: PLANNED. Bản yêu cầu đã được người dùng duyệt và yêu cầu triển khai trong chat.

**Goal:** Autosave không làm mất chỉnh sửa mới; restore dùng backend; submit gửi snapshot đầy đủ qua `finalAnswers`.
**Architecture:** Giữ TV3-07; dùng chung snapshot/draft helpers, scoped autosave và submission hook, page chỉ điều phối UI.
**Tech Stack:** React, TypeScript, Redux Toolkit, Axios, Vitest, Testing Library.
**Spec:** Contract, AC và các quyết định đã được duyệt dưới đây. Thực hiện tuần tự bằng executing-plans/TDD. Không commit/push.

## Quyết định và Global Constraints

1. Restore chỉ từ backend; không merge/recover local draft vào Redux.
2. Chờ autosave đang chạy rồi POST finalAnswers; không PUT bổ sung.
3. Persist bản dự phòng trước POST; không xóa draft chỉ vì submit thành công.
4. Chỉ sửa frontend và hai tài liệu TV3-08; không sửa backend, shared Axios, schema, dependency.
5. Giữ các thay đổi người dùng; không tự tăng version, không dùng version giả 0; không log đáp án/essay/token.
6. Giữ deadline, server offset và section-lock acknowledgment TV3-07. Giữ key `exam_draft_<attemptId>` và JSON record hiện tại.

Baseline planning: HEAD 676cf82, branch feature/TV3-00-contract-audit; TV3-07 commit 67e7f27, handoff PASS. 253 frontend tests PASS, lint 0 errors/25 warnings, build PASS, diff check exit 0. Đây là planning evidence, không thay verification implementation.

Backend nhận nhưng chưa enforce submit baseVersion. Response thành công có thể không dùng finalAnswers nếu attempt đã chốt hoặc timeout quá grace. Abort không rollback backend. Không hứa chống ghi đè nhiều tab hoặc nhận finalAnswers sau grace.

## Contract và AC

PUT giữ `{ version: number, answers: PartAnswers[] }`.

```ts
interface SubmitAttemptApiRequest {
  reason: 'MANUAL' | 'TIMEOUT_CLIENT';
  baseVersion: number;
  finalAnswers: PartAnswers[];
}
```

POST không gửi version/answers/TIMEOUT_SERVER. Giữ nguyên essay và giá trị xóa null, '', [], {}. Response phải success/data, matching attempt ID, status enum khác IN_PROGRESS, redirect `/attempts/<id>/result`.

- AC-01: Autosave/submit cùng serializer; giữ kiểu/nội dung/clear values.
- AC-02: Một PUT/context; version chỉ lấy response hợp lệ.
- AC-03: Chỉ clean/xóa draft khi PUT ack không có edit mới; lỗi giữ snapshot mới nhất.
- AC-04: Hydrate chỉ backend; metadata refresh không ghi answers/version/dirty.
- AC-05: Pause cycle mới, chờ PUT, POST snapshot mới nhất; không pre-submit PUT.
- AC-06: Bỏ stale completion, không concurrent POST, không false result khi lỗi.
- AC-07: Busy/error/retry rõ ràng, timeout retry TIMEOUT_CLIENT, chỉ result khi xác nhận.
- AC-08: Full frontend tests/build PASS, không thêm lint warning hoặc thay đổi ngoài scope.

## Review Focus

1. Edit trong PUT không bị mark clean/xóa draft.
2. Same-ID hydration và A→B→A không nhận response cũ.
3. Double click/timeout/StrictMode không concurrent submit hoặc stuck saving.
4. 409/network timeout không phải successful submit receipt.
5. Essay/Unicode/clear answers giữ nguyên trong finalAnswers.

## Task 1: TV3-08-01 — Snapshot và local draft

Create `frontend/src/features/exam/utils/answerSnapshot.ts`, `utils/answerDraft.ts`, `__tests__/answerSnapshot.test.ts`, `__tests__/answerDraft.test.ts`.
Interfaces: serializeAnswers(AnswerState['answers']): PartAnswers[]; persistAnswerDraft(attemptId, answers): boolean; removeAnswerDraft(attemptId): boolean.

- [ ] Tests string/array/map/null/empty/Unicode essay/deep copy/invalid part IDs và values.
- [ ] RED trước implementation.
- [ ] Serialize không lọc isAnswered/trim; deep-copy; từ chối dữ liệu không hợp lệ.
- [ ] Storage try/catch trả false khi exception, giữ raw record JSON.
- [ ] GREEN: `npm test -- src/features/exam/__tests__/answerSnapshot.test.ts src/features/exam/__tests__/answerDraft.test.ts`.

Acceptance: AC-01; storage exception không crash hoặc báo backup thành công giả.

## Task 2: TV3-08-02 — API và bounded writes

Modify `frontend/src/features/exam/api/attemptApi.ts`, `types/api.types.ts`, `__tests__/attemptApi.test.ts`.
autosaveAnswers/submitAttempt thêm options?: { signal?: AbortSignal }; submit request required canonical fields. SubmitResult.status = Exclude<AttemptStatus, 'IN_PROGRESS'>.

- [ ] RED exact POST body, malformed response, ID/version biên, timeout/abort/late result.
- [ ] Positive Java integer ID/version; bỏ optional alias/default cũ.
- [ ] Validate matching attempt, enum terminal, exact redirect.
- [ ] Bound writes 10.000ms gồm interceptor queue; deadline promise + AbortController + Axios signal/timeout; finally dọn timer/listener.
- [ ] GREEN: `npm test -- src/features/exam/__tests__/attemptApi.test.ts`.

Acceptance: đúng body, không treo vô hạn, invalid response không tạo result. Không sửa shared interceptor.

## Task 3: TV3-08-03 — Scoped autosave và barrier

Modify `frontend/src/features/exam/store/answerSlice.ts`, `hooks/useAutosave.ts`, `__tests__/answerSlice.test.ts`, `__tests__/useAutosave.test.tsx`, `__tests__/useWorkspace.test.tsx`.
State thêm contextRevision:number và activeSaveId:string|null. SaveOperation={attemptId,contextRevision,requestId,pendingVersion}. Save actions scoped; success thêm serverVersion/savedAt; thêm markSaveCancelled, markSubmissionConflict. Hydrate/clear tăng revision, không reset 0.

```ts
interface AutosaveController {
  pauseAndWait(): Promise<{ status: 'ready' | 'conflict' | 'stale' }>;
  resume(): void;
  draftWarning: string | null;
}
// useAutosave(attemptId:number|null, timing?:{deadline:string|null;serverTimeOffset:number})
```

- [ ] RED deferred edit/race, same-ID hydrate, A→B→A, barrier, deadline, cancel/StrictMode.
- [ ] Live Redux snapshot, một active promise/request; reducer chỉ nhận matching context/request.
- [ ] Success updates server version; newer edit giữ dirty/status idle/draft.
- [ ] Failure/conflict persist newest answers; delete chỉ fully clean ack.
- [ ] Pause chặn cycle mới nhưng giữ PUT đang chạy; wait exact promise.
- [ ] 1601 conflict dừng đến authoritative reload; 409 khác giữ error và không lặp PUT. Network error retry interval tiếp theo.
- [ ] Không PUT mới sau deadline; timing update không hủy pending PUT.
- [ ] Context/route/unmount cancel và invalidate completion; không stuck saving.
- [ ] GREEN: `npm test -- src/features/exam/__tests__/answerSlice.test.ts src/features/exam/__tests__/useAutosave.test.tsx src/features/exam/__tests__/useWorkspace.test.tsx`.

Acceptance: AC-02/03; stale không sửa Redux/draft; pause không mất PUT ack.

## Task 4: TV3-08-04 — Submission controller

Create `frontend/src/features/exam/hooks/useAttemptSubmission.ts`, `__tests__/useAttemptSubmission.test.tsx`.
useAttemptSubmission(workspace,autosave) returns phase ('idle'|'waiting'|'submitting'|'error'|'conflict'|'succeeded'), error, draftWarning, result, submit(reason), retry(), isLocked().

- [ ] RED pending PUT, double submit, conflict, deadline/retry, storage error, route/context/unmount.
- [ ] Ref mutex trước await; ready/matching context/IN_PROGRESS guards.
- [ ] Pause/wait; conflict chặn POST, stale kết thúc. Nonconflict PUT error vẫn POST full snapshot/latest confirmed version.
- [ ] Live snapshot sau barrier; persist trước POST; storage error warning không chặn POST.
- [ ] No extra PUT; MANUAL nâng TIMEOUT_CLIENT nếu deadline đã hết trước POST; retry không đổi ngược.
- [ ] Chỉ validated response creates result; 1601 scoped conflict; các lỗi khác không result.
- [ ] Manual error unlock/resume khi được phép; expired/success giữ read-only/paused.
- [ ] Cancel/invalidate stale finally; không xóa draft sau success; không automatic POST retry.
- [ ] GREEN: `npm test -- src/features/exam/__tests__/useAttemptSubmission.test.tsx`.

Acceptance: AC-05/06, no polling/concurrent POST/false navigation.

## Task 5: TV3-08-05 — Page và overlays

Modify `frontend/src/features/exam/pages/WorkspacePage.tsx`, `components/SubmitOverlay.tsx`, `components/TimeUpModal.tsx`, `components/modals/TimeUpOverlay.tsx`, `__tests__/WorkspacePage.test.tsx`, `__tests__/TimeUpOverlay.test.tsx`. Create `__tests__/SubmitOverlay.test.tsx`.

- [ ] RED busy/error/retry/read-only và chưa có confirmed result.
- [ ] Consume controllers; bỏ polling/serializer trùng/pre-flush.
- [ ] Guard answers/flags/highlights/section navigation bằng mutex và existing locked/expired rules.
- [ ] onClose optional; result callback chỉ có khi confirmed. Timeout retry gọi hook, không MANUAL.
- [ ] Error role alert, busy feedback, keyboard retry, storage warning; manual error không mang nhãn hết giờ hoặc nói tự retry.
- [ ] Preserve authoritative reload/dirty confirm/metadata/lock ack TV3-07; update fixtures/controller mocks; thay preflush expectations bằng finalAnswers.
- [ ] GREEN: `npm test -- src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/TimeUpOverlay.test.tsx src/features/exam/__tests__/SubmitOverlay.test.tsx`.

Acceptance: AC-04/07 và toàn bộ lock/route regressions giữ xanh.

## Task 6: TV3-08-06 — Integration và handoff

Create `frontend/src/features/exam/__tests__/autosaveSubmitContract.test.tsx`; update `__tests__/resumeContract.test.tsx` fixtures khi cần. Append handoff.

- [ ] Real page/hooks/reducer/API normalizer; chỉ mock HTTP/browser.
- [ ] GET v7 → edit B → pending PUT → edit C → submit waits → PUT v8 → POST C/base8; đúng một PUT, draft còn.
- [ ] Fresh-store restore backend B thay local C, đúng answers/version/input/palette/timer.
- [ ] Conflict → draft → backend reload → autosave new version.
- [ ] Timeout error → không result → explicit TIMEOUT_CLIENT retry → confirmed result.
- [ ] Full test/lint/build/diff check; append RED/GREEN evidence/AC mapping/risks/review request.

Acceptance: AC-01–08; không dùng mocked hooks làm integration evidence.

## Test matrix

| TC | Phân loại | Kịch bản | Tiền điều kiện | Bước | Dữ liệu | Kết quả |
|---|---|---|---|---|---|---|
| 08_01 | Happy | Autosave | Dirty v7 | Tick15s/resolve | v8 | Clean v8 |
| 08_02 | Happy | Direct submit | Dirty/no PUT | Submit | Full snapshot | 1 POST/0 PUT |
| 08_03 | Negative | Bad submit response | POST sent | Bad ID/status/URL | IN_PROGRESS/foreign | Error/draft/no navigation |
| 08_04 | Negative | Hanging write | Pending | Tick10000ms | No response | Settled error |
| 08_05 | Boundary | Interval | Dirty | 14999+1ms | 15s | PUT at15s only |
| 08_06 | Boundary | IDs/versions | Write | Try bounds | 0/1/MAX/MAX+1/fraction | Positive Java int only |
| 08_07 | State | Edit during PUT | B pending | EditC/resolve | v8 | C dirty/draft retained |
| 08_08 | State | Context race | Pending | Hydrate/A→B→A | New revision | Old completion ignored |
| 08_09 | State | Double submit/timeup | Active | Concurrent calls | Manual/timeout | One pending POST |
| 08_10 | Integrity | Clear/essay | Answers | Serialize/POST | null/empty/Unicode/HTML-like | Exact inert values |
| 08_11 | Security | Permission denied | Write | 401/403 | Error | No result/no sensitive log |
| 08_12 | Integrity | Version conflict | Dirty | 1601/reload | New backend version | Stop writes/backend hydrate |
| 08_13 | UI/a11y | Timeout retry | Expired | Error/keyboard retry | TIMEOUT_CLIENT | Locked/error/correct reason |
| 08_14 | Restore | Local differs | Fresh store | Mount | LocalC/serverB | UsesB |
| 08_15 | State | Storage failure | Snapshot | Storage throw/POST | Quota | Warning/POST allowed |
| 08_16 | State | StrictMode | Pending | Cleanup/replay/settle | Scoped request | No stuck/mutation |

## Verification, DoD và handoff

Cwd frontend: `npm test -- src/features/exam/__tests__`, `npm test`, `npm run lint`, `npm run build`. Cwd repo: `git diff --check`, `git status --short`.
DoD: AC/matrix evidence, full tests/build pass, no new warnings, no backend/shared Axios/dependency/schema edits, fresh review of five focus items, append-only handoff, no commit/push.
Out of scope: backend baseVersion/write enforcement, local recovery/merge, cross-tab coordination, close-tab durability, result redesign, PostgreSQL smoke.
Handoff statuses: PLANNED → IN_PROGRESS → IMPLEMENTED → PASS/NEED_FIX → FIXED. Implementer appends files/RED-GREEN/commands/results/risks; reviewer checks exact payload, stale races, real UI and integration; never considers 409 a successful receipt.
