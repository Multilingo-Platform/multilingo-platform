# TV3-12 — Handoff

## 2026-10-11 — Codex Planner — PLANNED

Feature: Result page bằng dữ liệu thật. Baseline `06cdd42`, branch `feature/TV3-00-contract-audit`, clean tree.
Dependency TV3-11 committed, latest handoff PASS; backend không rerun.
Planning evidence: 36 files/323 tests PASS, lint 0 errors/25 warnings, build PASS/bundle warning, diff check exit0.
Implementation evidence lúc khởi tạo: chưa có.

| Task | Deliverable | Dependency | Status |
|---|---|---|---|
| 12-01 | Types/normalizer/fixtures | TV3-11 | PLANNED |
| 12-02 | Bounded GET | 12-01 | PLANNED |
| 12-03 | Scoped hook | 12-02 | PLANNED |
| 12-04 | Components/format | 12-01 | PLANNED |
| 12-05 | Page integration | 12-03,04 | PLANNED |
| 12-06 | Integration/verification | 12-01..05 | PLANNED |

Locked: summary-only, manual refresh, attempt ID header, local hook/no cache, no review CTA, no Redux/draft source.
Risks: API no exam name/answers/explanation; Writing metadata only; legacy summary may remain unavailable;
abort không rollback; shared auth redirect unchanged; review/AI worker excluded.
Executor: RED→GREEN tuần tự; append evidence/task statuses; preserve user work; no commit/push; stop for final review.
Reviewer: toàn feature AC01..09, actual pipeline tests, runtime contract, race/auth/null checks;
append PASS/NEED_FIX/BLOCKED, P0/P1/P2 exact locations/minimal fixes.

## 2026-10-11 — Codex Executor — Setup / 12-01 IN_PROGRESS

Rechecked HEAD `06cdd42`, clean tree. Approved plan saved; user authorizes full inline implementation.
Pre-flight: 01 types/normalizer→02 GET→03 hook→05 page interfaces consistent;
01 result types→04 components→05 page consistent; 06 exercises real pipeline.
Ruling: dùng handoff làm persistent ledger trong phạm vi hai tài liệu user yêu cầu;
không tạo scratch ledger/worktree, commit hoặc reviewer agent. User yêu cầu giữ checkout và dừng chờ final review.
RED evidence sẽ append sau từng run; không dùng planning baseline như implementation verification.

## 2026-10-11 — Codex Executor — 12-01 IMPLEMENTED / 12-02 IN_PROGRESS

Files: result block api.types.ts, resultContract.ts, resultContract.test.ts, fixtures/attemptResult.ts.
RED: contract suite 8 failed/40 passed (skeleton không parse/normalize). GREEN: 48/48 PASS.
Command: `npm test -- src/features/exam/__tests__/resultContract.test.ts`.
AC-02/04/07: raw>count/partial, null vs zero, unavailable, malformed enums/types, route bounds,
duplicate IDs, tuple Writing identity, strings preserved, legacy omitted, input unchanged.

## 2026-10-11 — Codex Executor — 12-02 IMPLEMENTED / 12-03 IN_PROGRESS

Files: attemptApi.ts, attemptApi.test.ts. Existing ResultNotReadyError had no other consumer (rg).
RED: API suite 15 failed/35 passed; missing config/validation/abort/deadline/HTTP409 preservation.
GREEN: API+contract 98/98 PASS; API alone includes previous 31 write/workspace/create tests.
Command: `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/resultContract.test.ts`.
AC-01/02/06: exact GET, no invalid ID dispatch, fixed malformed error, preserved400/401/403/409/500,
10000ms deadline, external/pre-abort, late response, listener/timer cleanup. Shared Axios unchanged.

## 2026-10-11 — Codex Executor — 12-03 IMPLEMENTED / 12-04 IN_PROGRESS

Files: useAttemptResult.ts, useAttemptResult.test.tsx. RED: 22/22 failed against hook skeleton.
GREEN: hook+API 72/72 PASS. Command: `npm test -- src/features/exam/__tests__/useAttemptResult.test.tsx src/features/exam/__tests__/attemptApi.test.ts`.
AC-05/06/07: single-flight/manual retry, timeout unlock, stale A→B→A/replay/remount,
no previous result during new route, network/5xx refresh retains with warning,
4xx/contract clears, valid unavailable replaces, fixed error text without server detail.

## 2026-10-11 — Codex Executor — 12-04 IMPLEMENTED / 12-05 IN_PROGRESS

Files: resultPresentation.ts, ObjectiveResultSummary.tsx, WritingResultSummary.tsx,
resultPresentation.test.ts, ResultSummary.test.tsx.
RED: 21 failed/1 passed (format/UI skeleton). GREEN: 22/22 PASS.
Command: `npm test -- src/features/exam/__tests__/resultPresentation.test.ts src/features/exam/__tests__/ResultSummary.test.tsx`.
AC-03/04/07/08: vi-VN raw/accuracy/duration/date, objective0 explanatory, nullable Writing,
four Writing states/null score, tuple IDs/escaped HTML-like labels, table captions/scoped headers.

## 2026-10-11 — Codex Executor — 12-05 IMPLEMENTED / 12-06 IN_PROGRESS

Files: ExamResultPage.tsx, pages/__tests__/ExamResultPage.test.tsx.
RED: 11/11 failed against baseline mock page. GREEN: page+components 19/19 PASS.
Command: `npm test -- src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/ResultSummary.test.tsx`.
AC-01/03..05/08: attempt/mode/scope/status header, backend duration, no mock title/review CTA,
live loading/refresh, native focusable retry, auth errors, unavailable no fallback, history/library Links.

## 2026-10-11 — Codex Executor — 12-06 IMPLEMENTED — READY_FOR_REVIEW

### Files và integration evidence

Tạo `frontend/src/features/exam/__tests__/resultPageContract.test.tsx`.
11 integration tests dùng real ResultPage/hook/normalizer/API; chỉ mock HTTP/browser.
Bao gồm real WorkspacePage/reducer/submission → confirmed redirect → result GET:
GET wordCount 123/status AI_GRADING thắng local essay và submit receipt COMPLETED; draft không bị xóa.
Direct result route không cần Provider/Redux; storage spies chứng minh result không đọc/ghi/xóa draft.
Multi-skill/part giữ order/IDs/stats backend; Writing-only không fake0/0; unavailable không legacy fallback.

RED/GREEN: 9 integration tests chạy PASS ban đầu trên implementation, sau đó đối chiếu bằng
page mock từ HEAD qua apply_patch → 9/9 FAIL, khôi phục implementation → PASS.
Hai cases multi-skill/Writing-only bổ sung cũng FAIL khi đối chiếu baseline mock → GREEN.
Không thay đổi Git index/HEAD hoặc user work trong quá trình đối chiếu.

Build ban đầu phát hiện missing default export mà router đang dùng (TS2613).
Root cause: replacement page giữ named export nhưng thiếu default export baseline.
Regression: page test đổi sang default import giống router → FAIL trước fix;
khôi phục default export trong page, không sửa router → tests/build GREEN.

### Verification cuối

Tại `frontend`:

```powershell
npm test -- src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useAttemptResult.test.tsx src/features/exam/__tests__/resultPresentation.test.ts src/features/exam/__tests__/ResultSummary.test.tsx src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/resultPageContract.test.tsx
npm test
npm run lint
npm run build
```

| Gate | Kết quả |
|---|---|
| Focused cuối | 7 files / 164 tests PASS, exit0 |
| Full frontend cuối | 42 files / 456 tests PASS, exit0 |
| Lint | Exit0, 0 errors / 24 warnings; baseline25, không warnings mới |
| Build | tsc/Vite PASS, exit0; baseline large-bundle warning còn |
| Root `git diff --check` | Exit0; Git có LF→CRLF informational warning, không whitespace error |
| Vietnamese copy validator | Plan/handoff: 0 errors/0 warnings trước final append; chạy lại sau append |

Lint warning giảm do xóa unused attemptId ở result mock; các warnings khác ngoài scope giữ nguyên.
Backend tests/live backend/PostgreSQL không chạy; không backend/dependency/schema/shared Axios/router changes.
HEAD giữ `06cdd42`, không commit/push.

### Browser verification (mocked HTTP, không backend thật)

Vite tạm ở `127.0.0.1:5174`, Playwright session riêng `tv312`.
Mock chỉ URL `/api/v1/**`; app router/UserLayout/page thật.

| Width | document scrollWidth | Result width | Table client/scroll |
|---|---|---|---|
| 375 | 375 | 375 | 341/600 (cuộn riêng) |
| 768 | 768 | 768 | 734/734 |
| 1280 | 1280 | 1024 | 990/990 |

Labels tiếng Việt dài wrap; mobile screenshot đã xem; không page horizontal overflow.
Tab tới update + Enter → mocked503: role=alert giữ validated data với thông báo cũ;
Tab lại tới button + Enter → mocked200: hết alert, result vẫn hiển thị.
Native disabled button có thể mất focus trong busy; vẫn retry được bằng Tab/Enter.
Reduced-motion: busy button disabled=true, spinner animationName=none.
Refresh mocked403: alert quyền truy cập, table count0 và Writing heading count0.
Harness ban đầu mock quá rộng bắt module `/src/core/api/axiosClient.ts`; thu hẹp pattern rồi render thành công.
503/403 console network errors trong probes là responses có chủ đích, không production exception.
Browser session và dev server đã đóng; artifacts nằm trong OS Temp, không thêm file ngoài scope vào repository.
Chưa kiểm thử bằng screen reader thật; semantic roles/live regions/table headers kiểm tra bằng RTL và browser snapshot.

### AC/TC mapping

| AC | Evidence |
|---|---|
| AC-01 | Direct URL/storage spies + real submit→GET integration (TC01,14,16) |
| AC-02 | 48 contract tests + API normalization/ID/error cases (TC02..05) |
| AC-03 | Formatter/component/multi-skill integration tests (TC01,03,04) |
| AC-04 | All Writing statuses/null/tuple task IDs + Writing-only integration (TC07,08) |
| AC-05 | Hook/page 400/401/403/409/5xx/contract/unavailable and refresh cleanup (TC05,06,09,12,13) |
| AC-06 | API deadline/abort, hook/routes/replay and manual-only integration (TC10..12) |
| AC-07 | Escaped labels, projection allowlist, storage spies and unchanged draft (TC13,14,16) |
| AC-08 | Page/components roles/buttons/Links; browser keyboard/viewport/reduced-motion (TC15) |
| AC-09 | Full456/focused164/lint24/build/diff verification; scope inventory below |

### Changed-file inventory

Modified:
- `frontend/src/features/exam/types/api.types.ts`
- `frontend/src/features/exam/api/attemptApi.ts`
- `frontend/src/features/exam/__tests__/attemptApi.test.ts`
- `frontend/src/features/exam/pages/ExamResultPage.tsx`

New production:
- `frontend/src/features/exam/api/resultContract.ts`
- `frontend/src/features/exam/hooks/useAttemptResult.ts`
- `frontend/src/features/exam/utils/resultPresentation.ts`
- `frontend/src/features/exam/components/result/ObjectiveResultSummary.tsx`
- `frontend/src/features/exam/components/result/WritingResultSummary.tsx`

New tests/fixture:
- `frontend/src/features/exam/__tests__/fixtures/attemptResult.ts`
- `frontend/src/features/exam/__tests__/resultContract.test.ts`
- `frontend/src/features/exam/__tests__/useAttemptResult.test.tsx`
- `frontend/src/features/exam/__tests__/resultPresentation.test.ts`
- `frontend/src/features/exam/__tests__/ResultSummary.test.tsx`
- `frontend/src/features/exam/pages/__tests__/ExamResultPage.test.tsx`
- `frontend/src/features/exam/__tests__/resultPageContract.test.tsx`

Docs: `docs/superpowers/plans/ndt/TV3-12-plan.md`, `docs/superpowers/plans/ndt/TV3-12-handoff.md`.

### Remaining boundaries và review request

All six tasks IMPLEMENTED; chưa có independent final review/PASS verdict.
Residual contract risks giữ nguyên: no exam name/review data/AI scores, legacy unavailable có thể vĩnh viễn;
abort không rollback lazy finalization; auth redirect infrastructure không đổi.
Skills TDD/executing-plans ảnh hưởng evidence/ledger; UI skills ảnh hưởng native controls/live alerts/
responsive overflow/reduced motion; Vietnamese skill kiểm tra copy và register.
Reviewer cần review toàn bộ modified và untracked files, AC01..09, null/zero/raw semantics,
route/replay races, permission refresh, tuple identities, deadline và real submit→GET integration.
Executor dừng chờ Codex final review theo yêu cầu; không tự dispatch reviewer/commit/push.

### Final verification append

Sau bổ sung hai integration cases: focused164/full456 PASS; lint/build chạy lại exit0 (24 baseline warnings/bundle warning).
Copy validator chạy lại sau final append: 0 errors/0 warnings.
Untracked files được kiểm tra whitespace riêng bằng `git diff --no-index --check -- NUL <file>`;
exit1 trong no-index nghĩa là có added content, không phải whitespace failure; check stdout không có lỗi.
Root diff check exit0. Temporary browser/server đóng, port5174 không còn listener.

## Codex final review — 2026-10-11

- Agent: Codex Reviewer.
- Reviewed scope: toàn bộ TV3-12-01..06, không chỉ subtask cuối; đối chiếu approved plan và execution ledger.
- Decision: **PASS**.
- Git evidence: inspected staged (rỗng), unstaged (4 files) và toàn bộ untracked production/tests/fixture/docs trong inventory phía trên. Không thấy thay đổi ngoài phạm vi TV3-12. Đối chiếu DTO TV3-11 và router/shared Axios hiện hành để xác nhận integration, không audit backend.

### Verified acceptance criteria

| AC | Kết quả và bằng chứng |
|---|---|
| AC-01 | Đạt: direct URL gọi result GET qua production API/hook/page; integration test không cần Redux/workspace/draft. Test real WorkspacePage submit→redirect chứng minh dữ liệu từ GET, không từ submit receipt hoặc local essay. |
| AC-02 | Đạt: parser giới hạn decimal ID; envelope/ID/enum/type/count/accuracy/summary validation, projection bỏ legacy fields, giữ raw lớn hơn total, null khác zero; tests kiểm tra duplicate part và Writing tuple, input không mutate. |
| AC-03 | Đạt: overview, duration, timestamps giờ Việt Nam, accuracy, bySkill/byPart từ backend; không scale/clamp/tính lại điểm, không dữ liệu mock trong production. |
| AC-04 | Đạt: Writing task identity (partId, questionId), wordCount và bốn trạng thái từ backend; null score hiển thị “Chưa có điểm”; Writing-only không có 0/0 hoặc objective tables. |
| AC-05 | Đạt: loading/unavailable/400/401/403/request/contract states; messages cố định không echo server payload; permission errors không retry và xóa dữ liệu cũ khi refresh. |
| AC-06 | Đạt: deadline 10 giây bao gồm promise chưa settle, AbortSignal và cleanup; operation identity/mutex bảo vệ A→B→A, remount, StrictMode, late settlement; không polling/focus refetch/automatic retry. |
| AC-07 | Đạt: result pipeline không đọc/xóa draft hoặc persist result, không chấm answers/render HTML; escaped labels và storage spies được kiểm tra. Shared auth interceptor vẫn đọc token theo hành vi có sẵn, không thuộc draft/result persistence. |
| AC-08 | Đạt: native keyboard controls, busy disabled, status/live region, alerts, table caption/header scope, escaped/wrapped labels và history/library links; fake review CTA/modal đã xóa. Browser evidence 375/768/1280 và keyboard/reduced-motion do executor báo cáo, reviewer không chạy lại browser hoặc screen reader. |
| AC-09 | Đạt: focused và full frontend tests, lint, build được reviewer chạy độc lập; không warning mới trong các file TV3-12, write regression vẫn PASS, không đổi dependency/router/shared Axios/backend. |

### Confirmed findings

- **IN-SCOPE:** Không phát hiện lỗi actionable P0/P1/P2 trong sáu subtasks và luồng tích hợp được review. Không có minimal fix hoặc regression test bổ sung bắt buộc.
- **OUT-OF-SCOPE:** 24 lint warnings tại các file hiện hữu ngoài thay đổi TV3-12 và large-bundle warning; không dùng làm blocker. Shared auth refresh/redirect, backend lazy finalization, review chi tiết và AI worker giữ nguyên boundary của plan; không xác nhận thêm defect ở các phần này.

### Independent verification evidence

- Focused `npm test --` cho attemptApi, resultContract, useAttemptResult, ResultSummary, resultPresentation, resultPageContract và ExamResultPage: **7 files / 164 tests PASS**, exit 0.
- `npm test` tại frontend: **42 files / 456 tests PASS**, exit 0.
- `npm run lint`: exit 0, **0 errors / 24 warnings**, không warning tại file thay đổi TV3-12.
- `npm run build`: TypeScript + Vite PASS, exit 0; large-bundle warning có sẵn.
- `git diff --check`: exit 0; chỉ thông báo LF→CRLF, không whitespace error.
- Tests normalizer/API/hook/components và resultPageContract exercise production code; riêng page-state unit tests mock hook, được bổ sung bằng real-pipeline integration tests chỉ mock HTTP/browser.
- RED/GREEN ledger và browser checks là evidence executor báo cáo, không phải reviewer độc lập tái chạy. Không chạy full backend suite, live backend/PostgreSQL hoặc real screen reader trong review frontend này.

### Next required action

Không cần sửa lỗi trong phạm vi review; TV3-12 đủ điều kiện bàn giao theo plan. Chỉ append entry này, không sửa code/test/approved plan, không commit/push. Dừng review.
