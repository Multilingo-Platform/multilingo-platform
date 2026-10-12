# TV3-16 — Practice UI và luyện lại câu sai

> **Executor:** Đọc plan/handoff và repository instructions; dùng `tv3-plan-executor`, triển khai tuần tự RED → GREEN. Không commit hoặc push.

**Ngày:** 2026-10-12
**Trạng thái:** PLANNED
**Baseline:** HEAD `591d937`, branch `feature/TV3-00-contract-audit`; working tree sạch.

**Goal:** Người học kiểm tra từng câu trong Practice bằng API thật, xem feedback và luyện lại câu sai trong Part hiện tại mà không làm sai autosave/submit.

**Architecture:** Practice feedback API → scoped feedback hook → feedback UI; hook luyện lại giữ danh sách câu cố định cho mỗi lượt. Đáp án tiếp tục thuộc Redux và pipeline TV3-08.

**Tech stack:** React, TypeScript, Redux Toolkit, Axios, Vitest, React Testing Library, Tailwind, DOMPurify và Lucide hiện có.

**Spec:** Các quyết định đã chốt trong hội thoại, contract TV3-15 và implementation hiện tại.

**Tài liệu:** `docs/superpowers/plans/ndt/TV3-16-plan.md`, `docs/superpowers/plans/ndt/TV3-16-handoff.md`.

## Repository findings và quyết định

- TV3-15 đã commit tại `5a43264`; handoff final review kết luận PASS, không có P0/P1.
- Backend cung cấp `POST /api/v1/attempts/{id}/practice-feedback`, chỉ cho owner của Practice `IN_PROGRESS`. Feedback chấm answer trong request, không lưu answer, không tăng version và không tạo result.
- Key và explanation lấy từ snapshot lịch sử của attempt; Mock Test bị từ chối, attempt đã nộp trả 409, ESSAY và dữ liệu không chấm được trả 422.
- Frontend chưa có API client, hook hoặc UI feedback. `WorkspacePage` đã có input, passage/audio, Part động, Redux answers, autosave và submit.
- `attemptApi.ts` có `boundedAttemptRequest`: deadline toàn request 10.000 ms, cancellation, Axios signal/timeout. Không sửa shared Axios.
- Frontend chưa có renderer cho `MATCHING` dạng map. Các dạng objective khác có renderer hiện hữu.

**Baseline planning:** 6 focused frontend test files / 157 tests PASS; lint exit 0 với 25 warnings sẵn có; build PASS với bundle warning sẵn có; `git diff --check` exit 0; working tree sạch. Không chạy full frontend/backend suite. Handoff TV3-15 là evidence trước đó, không phải kết quả chạy mới.

**Quyết định đã chốt:**

1. Luyện lại trong Practice đang làm; không bắt đầu từ Review bài đã nộp.
2. Người học bấm “Kiểm tra đáp án” cho từng câu.
3. Đáp án sửa trong lượt luyện thay thế đáp án hiện tại và đi vào autosave/submit.
4. Chỉ lấy câu có verdict `WRONG` trong Part hiện tại; không thêm `BLANK`, ESSAY hoặc câu chưa kiểm tra.
5. Danh sách ID được giữ cố định trong lượt; câu đúng không tự biến mất.
6. Giữ passage/audio và group context; ẩn feedback cũ khi bắt đầu lượt, không tự xóa answer.
7. Có nút “Về toàn bộ câu”. Đổi Part hoặc authoritative reload kết thúc lượt.
8. Feedback/lượt luyện lại chỉ nằm trong memory; remount không khôi phục feedback.

## Global constraints và review focus

- Chỉ sửa frontend exam feature và hai tài liệu TV3-16; không sửa backend, DB, dependency, shared Axios, auth hoặc router.
- Không đổi autosave/submit/version/deadline/draft lifecycle của TV3-08; giữ đáp án trong Redux hiện tại.
- Không gọi review API hoặc dùng dữ liệu TV2/Redux/local draft để lấy lời giải; không ghi solution vào Redux answers, storage, URL hoặc log.
- Không thêm tự kiểm tra, polling, tự retry, bulk grading, attempt mới, renderer MATCHING map hoặc chấm ESSAY.
- Giữ nguyên mọi uncommitted/untracked work khi executor bắt đầu; không commit/push.
- Review focus: (1) edit A→B→A không phục hồi feedback cũ; (2) response muộn sau đổi Part/rehydrate/route A→B→A không sửa context mới; (3) Mock/loading/submitting không có feedback request; (4) feedback không đổi answer/version/dirty/draft; (5) filter không làm mất group context hoặc answers.

## Contract và acceptance criteria

### Frontend API

```ts
interface PracticeFeedbackRequest {
  partId: number;
  questionId: string;
  answer: AnswerValue;
}

type PracticeObjectiveType = Exclude<QuestionType, 'ESSAY'> | 'MATCHING';
type PracticeVerdict = 'CORRECT' | 'WRONG' | 'BLANK';
type ReviewScalar = string | number | boolean;

interface PracticeFeedbackResponse {
  attemptId: number;
  partId: number;
  questionId: string;
  type: PracticeObjectiveType;
  userAnswer: AnswerValue;
  verdict: PracticeVerdict;
  score: number;
  correctAnswer: ReviewScalar | ReviewScalar[] | Record<string, ReviewScalar>;
  explanation: string | null;
}

checkPracticeAnswer(
  attemptId: number,
  req: PracticeFeedbackRequest,
  options?: { signal?: AbortSignal }
): Promise<PracticeFeedbackResponse>;
```

Wire contract: `POST /v1/attempts/<attemptId>/practice-feedback` với đúng `{ partId, questionId, answer }`; không gửi version, mode, owner hoặc key. Request dùng bounded request 10.000 ms và hỗ trợ abort.

### Normalization và state

- ID là positive Java integer `[1, 2147483647]`; `questionId` là string không blank, giữ nguyên. Envelope phải thành công; data phải khớp tuple `(attemptId, partId, questionId)`.
- Giữ nguyên `null`, `''`, `[]`, `{}`, Unicode và khoảng trắng. Array giữ thứ tự; map được so theo key/value, không phụ thuộc thứ tự key.
- Type response phải thuộc objective types backend và khớp type câu workspace. Verdict thuộc `CORRECT | WRONG | BLANK`. Score hữu hạn, không âm, không clamp về 1. Correct answer phải là scalar hoặc collection phẳng hợp lệ; explanation là string hoặc null. Không stringify object hoặc suy ra verdict từ score.
- Projection chỉ gồm chín field của contract; lỗi contract dùng nội dung cố định, không hiển thị raw payload/error backend.

Feedback controller nhận workspace sẵn sàng, Part hiện tại, danh sách câu normalize và trạng thái submission lock; đọc answer mới nhất từ store khi người học bấm kiểm tra. Interface:

```ts
interface PracticeQuestionFeedback {
  phase: 'idle' | 'checking' | 'ready' | 'error';
  data: PracticeFeedbackResponse | null;
  error: { message: string; retryable: boolean } | null;
}

interface PracticeFeedbackController {
  busy: boolean;
  blockedMessage: string | null;
  wrongQuestionIds: string[];
  getFeedback(questionId: string): PracticeQuestionFeedback;
  check(questionId: string): Promise<void>;
  hideFeedback(questionIds: readonly string[]): void;
  suspend(): void;
}
```

- Scope bằng `(attemptId, contextRevision)` và `(partId, questionId)`. Tối đa một request feedback đang chờ; mutex đặt trước await.
- Theo dõi revision riêng của answer từng câu đồng bộ qua store subscription. Edit target invalidates pending/cached result; so sánh revision để bắt A→B→A. Edit câu khác hoặc save acknowledgment không invalidates result không liên quan.
- Chỉ nhận response khi context, Part, câu, answer revision và request identity còn khớp. Đổi Part abort pending và kết thúc retry round; feedback đã settle có thể ở memory trong cùng context.
- Rehydrate, đổi attempt, unmount invalidates/clears feedback. Bắt đầu submit gọi `suspend()` và stop lượt ngay; không chờ feedback. Không phát sinh Redux save action hoặc storage access.
- 401/403 xóa solutions và block feedback trong context. 409 block feedback, yêu cầu authoritative reload; không tạo result. 400/404/422 không gán verdict và yêu cầu reload. Network/timeout/5xx và contract error cho phép người dùng thử lại thủ công. Abort/stale không hiển thị lỗi ở context mới.

Retry chỉ chọn `WRONG` đã validate và còn khớp answer revision khi bắt đầu lượt. Nếu sửa answer trước đó thì phải kiểm tra lại. Snapshot ID theo thứ tự câu của Part; không thay đổi khi có feedback mới. Khi bắt đầu lượt, ẩn feedback cũ của các câu chọn; sau kiểm tra lại mới hiện feedback mới. Filter từng group, bỏ group rỗng, giữ instruction/context/audio/media và không mutate source. `stop()` chỉ bỏ filter, không reset answers/flags/highlights. Đổi Part/reload kết thúc lượt.

### Acceptance criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | Chỉ Practice ready, `IN_PROGRESS`, đúng Redux context và không submission lock mới được kiểm tra. |
| AC-02 | Request/response được validate; null/empty/Unicode và score >1 giữ đúng nghĩa. |
| AC-03 | Verdict, answer đúng và explanation chỉ từ feedback backend hợp lệ. |
| AC-04 | Single-flight; edit/context/Part/submit races không hiện feedback stale. |
| AC-05 | Retry đúng subset WRONG của Part, giữ ID list cố định và nguyên group context. |
| AC-06 | Answer mới qua Redux/autosave/finalAnswers; check/filter không làm đổi bài làm. |
| AC-07 | Không leak solutions sang Mock, storage, URL, log; HTML được sanitize. |
| AC-08 | Busy/error/retry rõ ràng, dùng được bằng keyboard/screen reader và viewport nhỏ. |
| AC-09 | Frontend tests/build PASS; không tăng lint warnings hoặc thay đổi ngoài phạm vi. |

## Subtasks triển khai

Thứ tự tuần tự `16-01 → 16-02 → 16-03 → 16-04 → 16-05 → 16-06`; mỗi task RED → GREEN và review diff riêng.

### TV3-16-01 — Contract, normalizer và API feedback

**Files:**

- Sửa `frontend/src/features/exam/types/api.types.ts`, `frontend/src/features/exam/api/attemptApi.ts`, `frontend/src/features/exam/__tests__/attemptApi.test.ts`.
- Tạo `frontend/src/features/exam/api/practiceFeedbackContract.ts`, `frontend/src/features/exam/__tests__/practiceFeedbackContract.test.ts`, `frontend/src/features/exam/__tests__/fixtures/practiceFeedback.ts`.

**Steps:** tạo fixture wire DTO chín field; viết tests ID biên, exact body, nullable/empty input, wrong tuple/type, malformed key/explanation, scalar/list/map, partial score và score >1; chạy RED. Implement validator, deep-copy, allowlist normalizer và `checkPracticeAnswer`; dùng `boundedAttemptRequest`, Axios signal/timeout 10 giây; không sửa interceptor. Test transport không settle, external abort, late response và timer cleanup; chạy API regressions.

**Assertion:** POST body đúng `{ partId: 10, questionId: 'q1', answer: null }`; timeout là `10_000`. Không gửi trường khác.

**Test:** `npm test -- src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/attemptApi.test.ts`

**Acceptance:** AC-02, AC-03, AC-07; không đổi contract write hiện có.

### TV3-16-02 — Scoped feedback controller, lỗi và race

**Files:** tạo `frontend/src/features/exam/hooks/usePracticeFeedback.ts`, `frontend/src/features/exam/__tests__/usePracticeFeedback.test.tsx`.

**Steps:** viết tests Practice/Mock/loading/context mismatch, double click, pending request, edit và A→B→A, đổi Part, same-ID rehydrate, route A→B→A, StrictMode cleanup; chạy RED. Implement API theo interface phía trên; đọc live store và copy answer; đặt mutex trước await. Subscription theo dõi revision per-question đồng bộ, chỉ invalidate câu thay đổi. Gate response theo context/Part/question/revision/request identity. Implement phân loại lỗi và block 401/403/409; thông báo cố định. `hideFeedback` chỉ ẩn solution, `suspend` hủy/invalidate pending và clear feedback lúc submit; cleanup subscription/controller khi unmount. Assert không dispatch save, không đọc/ghi storage, answer/version/dirty giữ nguyên; chạy GREEN.

**Assertion:** Request A đang pending, store edit A→B→A rồi response A settle; `getFeedback('q1').data === null`, Redux version vẫn 7.

**Test:** `npm test -- src/features/exam/__tests__/usePracticeFeedback.test.tsx`

**Acceptance:** AC-01, AC-03, AC-04, AC-06, AC-07.

### TV3-16-03 — Retry snapshot và filter group

**Files:** tạo `frontend/src/features/exam/hooks/usePracticeRetry.ts`, `frontend/src/features/exam/utils/practiceRetry.ts`, `frontend/src/features/exam/__tests__/practiceRetry.test.ts`, `frontend/src/features/exam/__tests__/usePracticeRetry.test.tsx`.

**Interfaces:**

```ts
selectRetryQuestionIds(
  questions: readonly Question[],
  wrongQuestionIds: readonly string[]
): string[];

filterRetryGroups<T extends { questions: Question[] }>(
  groups: readonly T[],
  questionIds: ReadonlySet<string>
): T[];
```

`usePracticeRetry(contextKey, partId)` trả `active`, `questionIds`, `start(ids)` và `stop()`.

**Steps:** tests thứ tự Part, loại trùng/ngoài Part, bỏ group rỗng, giữ group context/media, không mutate source, snapshot không đổi sau feedback mới; hook context/Part đổi kết thúc lượt ngay cả trước effect cleanup; `start([])` không active; `stop()` không đổi answers. Chạy RED, implement selector/hook, chạy GREEN.

**Assertion:** chọn `q2` đúng thứ tự; `shared_audio` giữ nguyên; Redux answers bằng trước khi luyện lại.

**Test:** `npm test -- src/features/exam/__tests__/practiceRetry.test.ts src/features/exam/__tests__/usePracticeRetry.test.tsx`

**Acceptance:** AC-05, AC-06; không tạo attempt.

### TV3-16-04 — Feedback card và retry toolbar

**Files:** tạo `frontend/src/features/exam/components/practice/PracticeQuestionFeedback.tsx`, `frontend/src/features/exam/components/practice/PracticeRetryToolbar.tsx`, `frontend/src/features/exam/__tests__/PracticeFeedbackUI.test.tsx`.

**Steps:** tests render idle/checking/ready/error/retry, empty wrong list, retry toolbar và XSS; RED. Nút “Kiểm tra đáp án” có accessible name và disabled khi busy/không được phép. Verdict có nhãn text và ghi rõ đây là feedback luyện tập. User/correct answer render bằng React text, giữ multiline; tái dùng formatter `reviewPresentation`. Explanation dùng `ExplanationBox`/`HtmlContent`; không thêm raw HTML renderer. Thiếu explanation hiện thông báo cố định. ESSAY hiện “Câu tự luận chưa hỗ trợ kiểm tra tức thì”; unsupported type không có nút check. Toolbar hiển thị số câu và nút “Luyện lại câu sai” / “Về toàn bộ câu”; không diễn giải danh sách rỗng thành tất cả câu đúng. Status dùng `role=status`, lỗi dùng `role=alert`; không tự chuyển focus. Giữ Tailwind/Lucide hiện có, nhãn dài wrap. GREEN.

**Test:** `npm test -- src/features/exam/__tests__/PracticeFeedbackUI.test.tsx`

**Acceptance:** AC-03, AC-07, AC-08.

### TV3-16-05 — Workspace và QuestionPalette integration

**Files:** sửa `frontend/src/features/exam/pages/WorkspacePage.tsx`, `frontend/src/features/exam/components/QuestionPalette.tsx`, `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`; tạo `frontend/src/features/exam/__tests__/WorkspacePractice.test.tsx`, `frontend/src/features/exam/__tests__/QuestionPalettePractice.test.tsx`.

**Steps:** tests Practice check, Mock không hiện controls/request, ESSAY, retry filter, lỗi và submit; chạy RED. Khởi tạo hooks trước early returns; enable dựa trên `activeWorkspace.test_mode === 'PRACTICE'`, không chỉ timer `isPractice`. Gắn feedback dưới từng input; giữ `setAnswer` và fieldset guards. Toolbar đặt trong main content để dùng được ở viewport nhỏ. Bắt đầu lượt snapshot WRONG hiện hành, ẩn feedback cũ rồi filter groups; không reset answers. Giữ nguyên group context và số câu. Thêm prop tùy chọn `visibleQuestionIds` cho palette: disable câu ngoài lượt trong Part hiện tại; Part khác vẫn điều hướng và kết thúc lượt. Progress tiếp tục đo “đã trả lời”, không biến thành “đúng/đã kiểm tra”. Trước khi gọi submit, `suspend()` feedback và `stop()` retry; không thêm PUT hoặc chờ feedback. Lỗi cần reload dùng authoritative reload/dirty-confirm hiện có; 409 không tự điều hướng result. Giữ Mock lock/resume/submit regression; GREEN.

**Assertions:** Mock không render nút check; Practice POST exact `{ partId: 10, questionId: 'q1', answer: 'B' }`.

**Test:** `npm test -- src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/QuestionPalettePractice.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx`

**Acceptance:** AC-01, AC-05–08; TV3-08 không hồi quy.

### TV3-16-06 — Integration regression và handoff

**Files:** tạo `frontend/src/features/exam/__tests__/practiceWorkspaceContract.test.tsx`; append `docs/superpowers/plans/ndt/TV3-16-handoff.md`.

**Steps:** integration dùng page, hooks, reducers, normalizer/API thật; chỉ mock HTTP/browser. Kiểm chứng GET Practice v7 → edit B → feedback WRONG không đổi Redux/version và không PUT → retry edit A → feedback CORRECT, câu vẫn trong lượt → autosave PUT A trả v8 → submit `finalAnswers` A/baseVersion 8. Test feedback pending rồi edit/đổi Part/rehydrate/submit; response cũ không hiện. Fresh store hydrate backend và không phục hồi feedback/lượt. Cùng question ID hai Part không chia sẻ verdict. Mock không gọi API; feedback không tạo attempt/result request. 409 không false-success, errors không xóa draft. Chạy focused feature suite, full frontend tests, lint, build, diff check; kiểm tra browser mock HTTP ở 375/768/1280 px, keyboard, label dài. Append RED/GREEN, AC/TC mapping, commands/results và residual risks; dừng chờ final review.

**Assertion:** một PUT; POST finalAnswers chứa A và baseVersion 8; draft hiện có không bị xóa.

**Test:** `npm test -- src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx`

**Acceptance:** AC-01–09; test integration không chỉ mock hook.

## Test matrix và Definition of Done

| TC | Loại | Kịch bản/dữ liệu | Kết quả bắt buộc | Task |
|---|---|---|---|---|
| TC_16_01 | Happy | Practice check string/array | Exact POST và feedback từ server | 01, 02, 05 |
| TC_16_02 | Boundary | ID 0/1/max/max+1/fraction | Chỉ positive Java integer | 01 |
| TC_16_03 | Integrity | null/empty/Unicode/whitespace | Giữ nguyên request answer | 01, 02 |
| TC_16_04 | Integrity | Scalar/list/map; score >1 | Preserve type/score; không suy verdict | 01 |
| TC_16_05 | Negative | Wrong tuple/type/echo/key | Contract error; không hiện solution | 01, 02 |
| TC_16_06 | State | Double click, request pending | Một pending feedback request | 02, 04 |
| TC_16_07 | Race | Edit A→B→A, response cũ | Không phục hồi feedback cũ | 02 |
| TC_16_08 | Race | Đổi Part/rehydrate/route/StrictMode | Stale completion bị bỏ | 02, 03 |
| TC_16_09 | Negative | Timeout/401/403/409/422 | Đúng thông báo; không false result | 02, 05 |
| TC_16_10 | Happy | Luyện WRONG rồi trả lời đúng | Chỉ WRONG trong Part; list cố định | 03–05 |
| TC_16_11 | Integrity | Group passage/audio/media | Context giữ nguyên khi filter/exit | 03, 05 |
| TC_16_12 | Security | Mock/ESSAY/script-like text | Không request trái scope; HTML sanitize | 02, 04, 05 |
| TC_16_13 | Integration | Answer luyện mới rồi save/submit | PUT/finalAnswers/version đúng | 05, 06 |
| TC_16_14 | Restore | Local draft khác backend | Dùng answers server; không restore feedback | 06 |
| TC_16_15 | A11y | Keyboard, 375px, nhãn dài | Focus/status/error rõ; không tràn layout | 04–06 |

**Definition of Done:** AC/TC có evidence; frontend tests/build PASS; lint không tăng warning so baseline 25; không thay contract ngoài scope; không có feedback tự động, solution giả, storage feedback hay Mock feedback; review toàn feature về request, races, retry subset và finalAnswers; handoff append và dừng chờ final review; không commit/push.

**Residual risks/out of scope:** Luyện lại bài đã nộp cần contract backend riêng để giữ snapshot lịch sử. Reload mất feedback/round theo thiết kế, answers vẫn restore từ backend. MATCHING map được kiểm tra trong contract nhưng không có input renderer. Legacy snapshot thiếu key có thể trả 422; không fallback sang TV2. Client abort không bảo đảm server chưa nhận request. P2 TV3-15 về coverage persisted timestamps/grading metadata là dependency hiện hữu, không sửa trong TV3-16.
