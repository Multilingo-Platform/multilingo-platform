# TV3-12 — Result page bằng dữ liệu thật

Ngày: 2026-10-11. Trạng thái phê duyệt: PLANNED; user đã yêu cầu triển khai toàn plan.
Baseline: HEAD `06cdd42`, branch `feature/TV3-00-contract-audit`.

## Goal và architecture

Result page dùng kết quả backend, không mock/Redux answers/local draft.
Pipeline: result API normalizer → useAttemptResult → result components → ExamResultPage.
Stack: React, TypeScript, Axios, Vitest, RTL, Tailwind, Lucide hiện có.
Spec: UC10 trong `Dac_ta_Usecase_UC08_UC10.md`, contract audit TV3-00 và result DTO TV3-11.
Đây là phần result summary của UC10, không phải toàn bộ review/AI feedback.

## Quyết định và constraints

- Chỉ overview, skill/part summary và Writing metadata. Xóa mock answers/modal và CTA xem đáp án.
- Refresh thủ công; không polling, automatic retry, focus refetch hoặc cache.
- Header dùng mã attempt, mode/scope/status từ result API; không gọi workspace/exam/review.
- Local hook; không Redux result state, React Query, localStorage result persistence.
- Frontend-only và hai tài liệu TV3-12; không backend/schema/dependency/shared Axios/router/auth changes.
- Giữ nguyên autosave/submit/restore/draft lifecycle; không log essay/answers/token/response.
- Không chấm lại, quy đổi band/TOEIC, dùng raw score như số câu đúng hoặc fallback legacy.
- Không unrelated refactor/warning cleanup, commit hoặc push.
- TV3-12 ở đây là result frontend theo yêu cầu mới nhất, không phải AI worker trong roadmap cũ.

## Contract

`getAttemptResult(attemptId: number, options?: {signal?: AbortSignal}): Promise<ExamResultResponse>`.
GET `/v1/attempts/<id>/result`; deadline 10.000 ms gồm interceptor queue; abort không rollback backend.
Frontend projection:

```ts
interface ObjectiveResultStats {
  rawScore: number; correct: number; incorrect: number;
  unanswered: number; total: number; accuracy: number;
}
type ResultWritingStatus = 'PENDING' | 'QUEUED' | 'FAILED' | 'UNAVAILABLE';
interface ResultSummary {
  objective: ObjectiveResultStats & {
    scoreUnit: 'RAW_OBJECTIVE';
    bySkill: Array<ObjectiveResultStats & {skill: string}>;
    byPart: Array<ObjectiveResultStats & {partId: number; label: string; skill: string}>;
  };
  writing: {status: ResultWritingStatus; tasks: Array<{
    partId: number; questionId: string; label: string; status: ResultWritingStatus;
    wordCount: number; score: null; maxScore: null;
  }>} | null;
}
interface ExamResultResponse {
  attemptId: number; status: Exclude<AttemptStatus, 'IN_PROGRESS'>;
  testScope: TestScope; testMode: TestMode; startTime: string;
  endTime: string | null; timeSpentSeconds: number | null; overallScore: number | null;
  summaryAvailable: boolean; resultSummary: ResultSummary | null;
}
```

Normalization: route ID chuẩn decimal 1..2147483647, không leading zero/space/exponent/suffix.
Envelope success có data, response ID khớp; enum/ISO timezone/type kiểm tra runtime.
Nullable metadata absent → null, không → 0. Counts/wordCount integer không âm; score finite không âm;
accuracy 0..100; counts cộng thành total. Không clamp raw theo total.
Unique part IDs; Writing identity `(partId, questionId)`; strings không stringify object/trim.
summaryAvailable true yêu cầu structured objective; false yêu cầu summary null/absent.
Legacy fields bỏ qua, không fallback, không regrade. Writing score/maxScore luôn null theo TV3-11.
Contract errors dùng fixed message, không raw payload.

## Acceptance criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | Direct URL tải backend, độc lập workspace/Redux/draft |
| AC-02 | Validate ID/response; giữ raw/count/null semantics |
| AC-03 | Overview/duration/accuracy/bySkill/byPart thật, không mock/scaling |
| AC-04 | Writing task/wordCount/status thật; null không thành 0 |
| AC-05 | Loading/unavailable/not-finalized/permission/request/contract states rõ |
| AC-06 | Deadline, scoped race guards, manual refresh only |
| AC-07 | Không đọc/xóa draft, chấm answers, render HTML hoặc persist result |
| AC-08 | Keyboard/live status/alerts/retry; không review CTA giả |
| AC-09 | Focused/full frontend tests/build PASS, không warning mới/out-of-scope diff |

## Tasks (RED → GREEN; thứ tự 01 → 02 → 03 → 04 → 05 → 06)

Paths dưới đây relative repository root; mỗi task append evidence vào handoff.

### TV3-12-01 — Typed contract/normalizer (AC-02,04,07)

- Sửa `frontend/src/features/exam/types/api.types.ts` chỉ result block.
- Tạo `frontend/src/features/exam/api/resultContract.ts`:
  `parseResultAttemptId(raw: string|undefined): number|null`,
  `normalizeAttemptResult(data: unknown, expectedAttemptId: number): ExamResultResponse`, `ResultContractError`.
- Tạo tests `frontend/src/features/exam/__tests__/resultContract.test.ts` và wire fixtures
  `frontend/src/features/exam/__tests__/fixtures/attemptResult.ts` gồm legacy fields.
- Test invalid route/response/enum/type/null/unavailable; raw>total, partial score, zero,
  Writing-only, duplicate part ID, tuple Writing identity, input không mutate.
- Run test RED trước implementation, GREEN sau implementation.
- Command: `npm test -- src/features/exam/__tests__/resultContract.test.ts` tại frontend.

### TV3-12-02 — Bounded/cancellable GET (AC-01,02,06)

- Sửa `frontend/src/features/exam/api/attemptApi.ts` và `frontend/src/features/exam/__tests__/attemptApi.test.ts`.
- Test exact GET, invalid ID không HTTP, envelope fail, normalization, never-settling transport,
  abort, late response, timer/listener cleanup; quan sát RED.
- Rename private boundedWrite → boundedAttemptRequest, giữ write semantics/body/deadline.
- GET signal/timeout 10.000 ms và whole-request deadline. Normalize trước return.
- Bỏ HTTP409→ResultNotReadyError và class nếu không còn consumer; giữ HTTP error để hook classify.
- Không shared interceptor changes/automatic retry; rerun write regression.
- Command: `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/resultContract.test.ts`.

### TV3-12-03 — Scoped hook (AC-05,06,07)

- Tạo `frontend/src/features/exam/hooks/useAttemptResult.ts` và `frontend/src/features/exam/__tests__/useAttemptResult.test.tsx`.
- Return data/loading/refreshing/error/refreshError/reload(): Promise<void>.
- Error kinds: invalid-id, not-finalized (400), unauthorized (401), forbidden (403), contract, request.
- Tests RED: initial/manual/double refresh, A→B→A, same-ID remount, StrictMode, late settle/finally.
- Generation/request identity + abort cleanup; mutex trước await; route change không render old data trước effect.
- Refresh giữ validated data trong lúc chờ; network/timeout/5xx giữ data với warning;
  4xx/contract xóa old data. Response unavailable mới thay summary cũ.
- Fixed error messages/next step; invalid/auth không retry button; các lỗi khác retry thủ công.
- Không cache/interval/focus listener/Redux/storage.
- Command: `npm test -- src/features/exam/__tests__/useAttemptResult.test.tsx src/features/exam/__tests__/attemptApi.test.ts`.

### TV3-12-04 — Presentation components (AC-03,04,07,08)

- Tạo `frontend/src/features/exam/utils/resultPresentation.ts`,
  `frontend/src/features/exam/components/result/ObjectiveResultSummary.tsx`,
  `frontend/src/features/exam/components/result/WritingResultSummary.tsx`.
- Tạo tests `frontend/src/features/exam/__tests__/resultPresentation.test.ts`,
  `frontend/src/features/exam/__tests__/ResultSummary.test.tsx`; RED trước UI/formatters.
- Existing cards/tables/slate/amber/Lucide; không redesign/dependency/chart.
- raw vi-VN max2 decimals, accuracy backend fixed2 decimals, duration h:mm:ss/null placeholder,
  dates vi-VN/Asia/Ho_Chi_Minh. Không suy ra duration/accuracy/points.
- Objective total0: explanatory text, không 0/0/cards/tables rỗng. Writing null: hide section.
- Writing score null: Chưa có điểm; statuses PENDING/QUEUED/FAILED/UNAVAILABLE có text đúng.
- React escaped strings, tuple task keys, captions/th scope, decorative aria-hidden icons, label wrapping.
- Command: `npm test -- src/features/exam/__tests__/resultPresentation.test.ts src/features/exam/__tests__/ResultSummary.test.tsx`.

### TV3-12-05 — Page integration (AC-01,03..05,08)

- Sửa `frontend/src/features/exam/pages/ExamResultPage.tsx`;
  tạo `frontend/src/features/exam/pages/__tests__/ExamResultPage.test.tsx`.
- Test states/header/navigation/keyboard retry/busy RED, rồi wire parser/hook/components.
- Xóa sample passage/questions/categories/modal/portal/mock list/no-op Xem đáp án/imports.
- Header mode/scope/status/attempt ID; metadata/duration độc lập summary.
- Unavailable chỉ metadata/message, không overallScore/legacy fallback.
- Manual update disabled busy; loading role=status/aria-live polite, errors role=alert.
- Giữ history/library navigation; không workspace/exam/review API.
- Status labels SUBMITTED Đã nộp bài; AI_GRADING Đang xử lý chấm Writing;
  AI_GRADING_QUEUED Writing đang chờ xử lý; GRADING_FAILED Chấm bài thất bại;
  COMPLETED Bài làm đã hoàn tất; EXPIRED Bài làm đã hết hạn.
- Không hứa timing/auto retry; COMPLETED không đồng nghĩa Writing có điểm.
- Command: `npm test -- src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/ResultSummary.test.tsx`.

### TV3-12-06 — Integration regression/handoff (AC-01..09)

- Tạo `frontend/src/features/exam/__tests__/resultPageContract.test.tsx`;
  real page/hook/normalizer/API, chỉ mock HTTP/browser.
- Direct URL fresh state + draft khác backend không ảnh hưởng/xóa; pending→manual refresh;
  unavailable không legacy fallback; refresh403/contract không old data; A→B→A stale guards;
  real submit redirect→result GET dùng backend khác local draft.
- Assert không polling/workspace/exam/review/PUT/POST từ result page.
- StrictMode có thể dispatch aborted GET, chỉ current response được cập nhật.
- Focused/full frontend tests/lint/build/diff check; browser 375/768/1280, keyboard,
  long Vietnamese labels bằng mocked HTTP, không attempt thật.
- Append files, RED/GREEN, AC/TC mapping, results, risks, final review request.

## Test matrix

| TC | Loại | Scenario | Expected | Task |
|---|---|---|---|---|
| 12-01 | Happy | Direct URL multiple skill/part | Backend overview | 01,05,06 |
| 12-02 | Boundary | ID0/1/max/max+1/frac/suffix/exponent | Valid ID only HTTP | 01,02 |
| 12-03 | Integrity | raw>count/partial | Không clamp/scale | 01,04 |
| 12-04 | Boundary | zero vs null | Distinct rendering | 01,04 |
| 12-05 | Negative | Wrong ID/status/type/missing summary | Contract error | 01,02,06 |
| 12-06 | Edge | unavailable + legacy score | No fallback | 01,05,06 |
| 12-07 | Edge | Writing-only/same qid two parts | All tasks/no0/0 | 01,04 |
| 12-08 | State | Writing statuses | Correct text/no fake0 | 04,05,06 |
| 12-09 | Negative | 400/401/403/409/5xx/network | Error/next step | 03,05 |
| 12-10 | Boundary | Transport hang10000ms | Settle/cleanup | 02 |
| 12-11 | Race | A→B→A/remount/StrictMode/late finally | No stale/stuck | 03,06 |
| 12-12 | State | Double refresh/network failure | Single-flight/notice | 03,05 |
| 12-13 | Security | Refresh403/HTML text | Clear/escaped | 03..06 |
| 12-14 | Restore boundary | Draft differs backend | GET wins/draft unchanged | 06 |
| 12-15 | Accessibility | Keyboard/status/small viewport | Semantic/responsive | 04..06 |
| 12-16 | Integration | Confirmed submit→GET | Backend result only | 06 |

## Verification/DoD

Frontend: `npm test`, `npm run lint`, `npm run build`. Root: `git diff --check`, `git status --short`.
AC/TC evidence ghi đầy đủ, không tuyên bố PASS nếu missing. Không warnings mới/out-of-scope changes.
Không mock title/answers, no-op CTA, polling/cache/fake scores. Handoff append, không rewrite history.
Final reviewer review whole feature: null/zero, stale responses, permission cleanup, Writing tuple IDs, deadline.
Không commit/push. Residual: no exam name/answer explanation, Writing metadata only, legacy unavailable may persist,
abort không rollback server, auth redirect shared interceptor ngoài scope, review/AI worker excluded.

## Planning evidence

Lượt planning: 36 files/323 frontend tests PASS; lint 0 errors/25 warnings; build PASS (large bundle warning);
git diff --check exit0, clean tree. Backend TV3-11 handoff PASS, không rerun backend trong planning.
Skills: writing-plans/acceptance-criteria-and-test-design, ui-ux-pro-max, vietnamese-tech-writing.
