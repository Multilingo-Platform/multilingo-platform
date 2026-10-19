# TV3-21 — AI feedback + Diff-View

> **Executor:** Đọc plan và handoff trước khi làm. Triển khai tuần tự theo các task, mỗi task RED → GREEN → regression. Không commit hoặc push.

**Goal:** Hiển thị nhận xét Writing đã lưu từ backend trên Result page, gồm điểm, bốn tiêu chí, nhận xét, quan sát hình và Diff-View an toàn.

**Architecture:** Result summary nhóm task theo part. Khi người học mở part, frontend tải `GET /api/v1/attempts/{attemptId}/writing-feedback?partId={partId}`, kiểm tra response rồi render trong panel. Trạng thái chờ chỉ được làm mới thủ công.

**Tech stack:** React, TypeScript, Axios, Vitest, React Testing Library, Tailwind và Lucide hiện có; không thêm dependency.

**Spec:** `docs/superpowers/specs/ndt/2026-10-04-sprint06-test-results-design.md` (UC10.2), `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md` (AC-13), `docs/superpowers/plans/ndt/TV3-20-plan.md` và kết quả TV3-20 trong `TV3-20-handoff.md`.

## Global constraints

- Chỉ thay đổi frontend và hai tài liệu TV3-21 này.
- Dùng đúng API đã triển khai ở TV3-20; không thay backend, database, response DTO, grading worker, quota hoặc prompt.
- Không đưa Writing feedback vào `/result` hoặc `/review`; không gọi workspace, review, Gemini hoặc endpoint khác để dựng nội dung.
- Không lưu feedback/essay vào Redux, localStorage, sessionStorage hoặc cache toàn cục.
- Không polling, refetch khi focus, retry tự động hoặc thêm nút retry backend.
- Không render HTML từ API bằng `dangerouslySetInnerHTML`; render text qua React.
- Giữ nguyên bài gốc, Unicode, emoji, CRLF và whitespace; không trim, sửa hoặc cắt essay/feedback.
- Không tạo điểm hoặc phản hồi giả khi API báo trạng thái chờ/lỗi/không khả dụng.
- Giữ mọi thay đổi có sẵn trong working tree; không commit/push.

## Review focus

1. Part chưa mở không tải essay; mỗi part mở chỉ gọi endpoint một lần ban đầu, kể cả có nhiều essay tasks.
2. Response trễ của part/attempt trước không thể ghi đè panel hiện tại sau route change, collapse, unmount hoặc StrictMode replay.
3. Diff chỉ được render sau khi diff và corrections tái tạo chính xác bài gốc/bản sửa, kể cả offset UTF-16 chứa emoji.
4. API error và reason code không đáng tin không được hiển thị nguyên văn; nội dung AI chỉ được render dạng text.
5. Refresh lỗi 401/403/404/contract phải xóa feedback cũ; lỗi mạng/timeout/5xx giữ dữ liệu đã kiểm tra và báo dữ liệu chưa cập nhật.

## Contract và hành vi được chốt

### API client

```ts
getWritingFeedback(
  attemptId: number,
  partId: number,
  options?: { signal?: AbortSignal }
): Promise<WritingFeedbackResponse>;
```

Gọi `GET /v1/attempts/{attemptId}/writing-feedback` với `params: { partId }`, `timeout: 10_000` và `AbortSignal`, thông qua bounded request helper trong `attemptApi.ts`. Không đổi helper hoặc timeout hiện có.

### Response projection

```ts
type WritingFeedbackTaskStatus =
  | 'PENDING' | 'QUEUED' | 'DONE' | 'FAILED' | 'UNAVAILABLE';
type WritingCriterionCode = 'TR' | 'CC' | 'LR' | 'GRA';
type WritingDiffType = 'EQUAL' | 'DELETE' | 'INSERT';

interface WritingCriterion {
  code: WritingCriterionCode;
  score: number;
  feedback: string;
}
interface WritingCorrection {
  start: number;
  end: number;
  replacement: string;
  explanation: string;
}
interface WritingDiffSegment {
  type: WritingDiffType;
  text: string;
}
interface WritingFeedbackTask {
  questionId: string;
  label: string;
  status: WritingFeedbackTaskStatus;
  wordCount: number;
  language: string | null;
  source: 'AI' | 'SYSTEM';
  scoreUnit: 'BAND_0_9';
  overall: number | null;
  maxScore: number | null;
  criteria: WritingCriterion[];
  originalText: string | null;
  overallFeedback: string | null;
  correctedEssay: string | null;
  corrections: WritingCorrection[];
  diff: WritingDiffSegment[];
  reasonCode: string | null;
  displayMessage: string;
  hasVisualContext: boolean;
  visualObservations: string | null;
}
interface WritingFeedbackResponse {
  attemptId: number;
  partId: number;
  attemptStatus: Exclude<AttemptStatus, 'IN_PROGRESS'>;
  partStatus: WritingFeedbackTaskStatus;
  tasks: WritingFeedbackTask[];
}
```

DTO hiện tại omit các nullable JSON fields. Normalizer chấp nhận `null` hoặc field bị omit tương đương nhau, sau đó trả projection có các nullable field là `null`. Unknown fields bị bỏ qua, không được spread vào object UI.

### Runtime validation

- `attemptId`/`partId` là positive Java integer và phải khớp request; response phải có ít nhất một task, `questionId` không rỗng và không trùng trong part.
- Chỉ nhận task status ở enum trên; attempt status phải là status hợp lệ sau submit. `wordCount` là số nguyên không âm.
- Score hữu hạn từ `0` đến `9`, theo bước `0.5`; `scoreUnit` chính xác `BAND_0_9`. Không tự tính lại `overall` từ criteria.
- Task `DONE` có `maxScore = 9`, original text, overall feedback, corrected essay và đủ bốn criterion code `TR`, `CC`, `LR`, `GRA`, mỗi code xuất hiện một lần. `overall` có thể bằng `0` và không được diễn giải thành lỗi.
- Task `DONE` từ AI có criteria feedback/overall feedback không rỗng. `source=SYSTEM` chỉ hợp lệ với `reasonCode=TOO_SHORT`, overall `0`, corrections rỗng và corrected essay bằng original.
- Với `DONE` thường, `diff` phải tái dựng chính xác original (`EQUAL + DELETE`) và corrected (`EQUAL + INSERT`). `corrections` phải đúng giới hạn/offset/ordering/non-overlap/surrogate rules của TV3-20 parser và khi áp dụng phải tạo đúng corrected essay.
- Với `DONE` visual của AI, `visualObservations` phải là text tiếng Việt không rỗng tối đa 1.000 code point. Với text-only phải là null. `TOO_SHORT` không cần observations dù part có hình.
- Status khác `DONE` không có score, criteria, corrected essay, corrections, diff hoặc visual observations; original text và safe display message có thể hiện diện.
- `partStatus` phải khớp rule backend: tất cả task DONE → DONE; nếu không, ưu tiên PENDING, rồi QUEUED, rồi FAILED, còn lại UNAVAILABLE.
- Các kiểm tra dùng UTF-16 index của JavaScript string để khớp offset backend. Không chuẩn hóa Unicode hoặc line endings trước khi so sánh.

### Loading, refresh và hiển thị

- Feedback nằm trong disclosure của từng part tại Writing summary. Disclosure dùng native button, `aria-expanded`, `aria-controls`; một part mở không tự đóng part khác.
- Chỉ lần mở đầu mới phát GET. Sau lần mở đầu, panel vẫn được mount nhưng ẩn bằng thuộc tính `hidden` khi collapse; request đang chạy tiếp tục và dữ liệu giữ trong state của instance cho đến khi Result page unmount.
- Mỗi part có tối đa một request đang chạy. Part khác được tải độc lập. Không cache qua route/page remount.
- PENDING/QUEUED có nút “Cập nhật nhận xét”; không có timer/focus listener. Network/timeout/5xx khi refresh giữ feedback đã validate và hiển thị cảnh báo. 4xx/contract xóa feedback cũ.
- FAILED/UNAVAILABLE hiển thị thông điệp từ bảng reason code allowlist; code lạ dùng thông báo tổng quát. Không render raw Axios/global error hoặc `displayMessage`/`reasonCode` không nằm allowlist.
- DONE hiển thị overall band, bốn tiêu chí theo thứ tự TR/CC/LR/GRA, feedback từng tiêu chí, feedback chung, Diff-View và danh sách corrections.
- Diff-View có 3 chế độ: “So sánh”, “Bài gốc”, “Bản sửa”. “So sánh” là mặc định; `DELETE` dùng `<del>`, `INSERT` dùng `<ins>`, EQUAL dùng text thường. Có legend chữ, không phụ thuộc màu.
- Visual observations chỉ hiện khi normalizer xác nhận trường hợp visual DONE hợp lệ. Feedback essay/dữ liệu AI luôn render thành text.
- `displayMessage` trạng thái được ánh xạ bằng reason code và status sang chuỗi tiếng Việt cố định. Reason code cho phép: `TOO_SHORT`, `ESSAY_TOO_LONG`, `LEGACY_NO_JOB`, `MALFORMED_FEEDBACK`, `UNSUPPORTED_LANGUAGE`, `VISUAL_CONTEXT_UNSUPPORTED`, `UNSUPPORTED_MEDIA`, `INVALID_IMAGE_URL`, `IMAGE_TOO_LARGE`, `IMAGE_INVALID`, `IMAGE_UNAVAILABLE`, `IMAGE_SOURCE_NOT_ALLOWED`, `QUOTA_UNAVAILABLE`, `PROVIDER_DISABLED`, `FEATURE_DISABLED`; code khác dùng thông báo an toàn chung.

## Subtasks

Dependency tuần tự: `21-01 → 21-02 → 21-03 → 21-04 → 21-05 → 21-06`. Mỗi task viết test hành vi trước, chạy xác nhận RED, triển khai tối thiểu, chạy test GREEN và test liên quan. Không đánh dấu task hoàn tất chỉ vì test compile.

### TV3-21-01 — Types, API response normalizer và fixture

**Tạo:**

- `frontend/src/features/exam/api/writingFeedbackContract.ts`
- `frontend/src/features/exam/__tests__/fixtures/writingFeedback.ts`
- `frontend/src/features/exam/__tests__/writingFeedbackContract.test.ts`

**Sửa:** `frontend/src/features/exam/types/api.types.ts`.

- [x] Tạo wire fixtures lấy đúng DTO backend cho AI DONE text-only/visual, TOO_SHORT, PENDING, QUEUED, FAILED, UNAVAILABLE.
- [x] Viết RED tests cho invalid/wrong attempt ID, invalid/wrong part ID, status/score/type sai, tasks rỗng, question ID trùng, criterion thiếu/trùng và nullable field bị omit.
- [x] Viết tests cho score `0`, `0.5`, `9`, reject `7.25`, negative, NaN/Infinity; phân biệt zero với null.
- [x] Viết tests cho full diff/correction với emoji surrogate pair, combining character, CRLF, khoảng trắng, insertion/deletion, offset biên và overlap.
- [x] Viết tests khi diff không khớp original/corrected, corrections không tái tạo corrected, visual observations thiếu/rỗng/quá 1.000 code point hoặc xuất hiện trên text-only.
- [x] Thêm types `WritingFeedbackResponse` và nested types, không sửa result/review types hiện có.
- [x] Implement `normalizeWritingFeedback(data, expectedAttemptId, expectedPartId)` theo projection allowlist và quy tắc phía trên; không mutate input.
- [x] Chạy lại focused tests và xác nhận fixture hợp lệ giữ nguyên essay, feedback, diff, score và thứ tự backend.

**Lệnh:** `npm test -- src/features/exam/__tests__/writingFeedbackContract.test.ts`

**Acceptance:** AC-01, AC-02, AC-05, AC-06.

### TV3-21-02 — API client, error mapping và hook

**Sửa:** `frontend/src/features/exam/api/attemptApi.ts`, `frontend/src/features/exam/__tests__/attemptApi.test.ts`.

**Tạo:**

- `frontend/src/features/exam/hooks/useWritingFeedback.ts`
- `frontend/src/features/exam/utils/writingFeedbackErrors.ts`
- `frontend/src/features/exam/__tests__/useWritingFeedback.test.tsx`
- `frontend/src/features/exam/__tests__/writingFeedbackErrors.test.ts`

Hook contract:

```ts
useWritingFeedback(attemptId: number, partId: number, enabled: boolean): {
  data: WritingFeedbackResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: WritingFeedbackLoadError | null;
  refreshError: WritingFeedbackLoadError | null;
  reload(): Promise<void>;
};
```

- [x] Viết API tests cho endpoint, query `partId`, timeout 10 giây, signal, envelope lỗi và response sai identity.
- [x] Viết hook tests cho `enabled=false`, first load, single-flight, manual reload, timeout/abort và timer/listener cleanup.
- [x] Dùng deferred GET tests cho route `attempt/part A → B → A`, unmount, StrictMode và late resolve/reject/finally.
- [x] Chạy tests để xác nhận RED.
- [x] Gọi bounded request helper hiện có; validate ID trước khi gửi và normalize response trước khi hook nhận.
- [x] Hook chỉ tải khi `enabled`; identity/generation và AbortController chặn mọi completion không còn thuộc request hiện hành.
- [x] Lỗi 401/403/404/400/contract xóa data cũ. Network/timeout/5xx khi refresh giữ data cũ và đặt warning cố định.
- [x] Error mapper không dùng `error.message`, backend response body hoặc raw reason code. Map status và reason code allowlist thành thông báo tiếng Việt cố định.
- [x] Chạy API/hook/error tests; xác nhận một part đang tải không chặn part khác và request double-click bị gộp.

**Lệnh:** `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useWritingFeedback.test.tsx src/features/exam/__tests__/writingFeedbackErrors.test.ts`

**Acceptance:** AC-01, AC-03, AC-07, AC-08.

### TV3-21-03 — Presentation helpers, Diff-View và corrections

**Tạo:**

- `frontend/src/features/exam/utils/writingFeedbackPresentation.ts`
- `frontend/src/features/exam/components/result/writing/WritingDiffView.tsx`
- `frontend/src/features/exam/components/result/writing/WritingCorrectionsList.tsx`
- `frontend/src/features/exam/__tests__/writingFeedbackPresentation.test.ts`
- `frontend/src/features/exam/__tests__/WritingDiffView.test.tsx`
- `frontend/src/features/exam/__tests__/WritingCorrectionsList.test.tsx`

- [x] Viết tests cho nhãn criteria/status/reason và định dạng band `vi-VN`; `null` không biến thành `0`.
- [x] Viết Diff-View tests cho 3 lựa chọn; mặc định “So sánh”, `aria-pressed`, focus bàn phím, EQUAL/DELETE/INSERT và empty diff.
- [x] Viết corrections tests cho danh sách có thứ tự, start/end, replacement và explanation, gồm chuỗi HTML-like.
- [x] Chạy tests để xác nhận RED.
- [x] Map TR → Task Response, CC → Coherence & Cohesion, LR → Lexical Resource, GRA → Grammatical Range & Accuracy; giữ thứ tự canonical.
- [x] Implement Diff-View bằng `<del>`, `<ins>` và text node; có legend chữ; không dùng HTML injection hoặc chỉ dùng màu để phân biệt.
- [x] Bản gốc/bản sửa lấy từ validated DTO. Dùng `whitespace-pre-wrap`, responsive width và `overflow-wrap:anywhere`; không clamp essay.
- [x] Chạy lại tests với emoji, CRLF, long line và reduced-motion setting; UI không thay nội dung.

**Lệnh:** `npm test -- src/features/exam/__tests__/writingFeedbackPresentation.test.ts src/features/exam/__tests__/WritingDiffView.test.tsx src/features/exam/__tests__/WritingCorrectionsList.test.tsx`

**Acceptance:** AC-04, AC-05, AC-08, AC-09.

### TV3-21-04 — Feedback panel và task view

**Tạo:**

- `frontend/src/features/exam/components/result/writing/WritingFeedbackPanel.tsx`
- `frontend/src/features/exam/components/result/writing/WritingFeedbackTask.tsx`
- `frontend/src/features/exam/__tests__/WritingFeedbackPanel.test.tsx`
- `frontend/src/features/exam/__tests__/WritingFeedbackTask.test.tsx`

- [x] Test state loading, retryable error, permission/contract error, refresh warning và các task status.
- [x] Test DONE text-only, DONE visual, TOO_SHORT, zero score, multiple tasks và unknown reason code.
- [x] Chạy tests RED trước implementation.
- [x] Panel nhận `attemptId`, `partId`; hook chỉ bắt đầu sau lần mở đầu. Parent giữ panel mounted sau lần đầu và collapse bằng `hidden`, nên đóng/mở không phát GET mới.
- [x] Hiển thị trạng thái qua `role=status`/`aria-live=polite`; lỗi qua `role=alert`; refresh là button native, disabled khi busy.
- [x] PENDING/QUEUED có message và nút cập nhật thủ công; không cài timer, focus listener hoặc tự retry.
- [x] DONE hiển thị score/max, 4 tiêu chí, overall feedback, visual observations nếu có, Diff-View và corrections.
- [x] TOO_SHORT ghi rõ điểm 0 do bài quá ngắn và source SYSTEM; không gắn nhãn AI.
- [x] FAILED/UNAVAILABLE hiển thị thông báo đã map cố định, không render điểm/diff. Hiển thị disclaimer feedback AI là nội dung tham khảo.
- [x] Chạy test component và kiểm tra mọi nội dung essay/feedback hiển thị dưới dạng text.

**Lệnh:** `npm test -- src/features/exam/__tests__/WritingFeedbackPanel.test.tsx src/features/exam/__tests__/WritingFeedbackTask.test.tsx`

**Acceptance:** AC-03–09.

### TV3-21-05 — Tích hợp Result page theo part động

**Sửa:**

- `frontend/src/features/exam/components/result/WritingResultSummary.tsx`
- `frontend/src/features/exam/pages/ExamResultPage.tsx`
- `frontend/src/features/exam/__tests__/ResultSummary.test.tsx`
- `frontend/src/features/exam/pages/__tests__/ExamResultPage.test.tsx`

- [x] Test Writing tasks thuộc 1 hoặc nhiều part, part ID không liên tục, thứ tự API và nhiều task chung part.
- [x] Test open/close/reopen, aria controls, status button và chỉ mở part mới tạo request.
- [x] Test `writing=null`, danh sách task rỗng và result summary unavailable không tạo panel.
- [x] Chạy page tests RED.
- [x] Truyền attempt ID vào `WritingResultSummary`; group task theo part theo thứ tự lần xuất hiện, không giả định ID liên tiếp.
- [x] Mỗi part có nút “Xem nhận xét AI”; button dùng `aria-expanded`, `aria-controls`, focus style và vùng nhấn hiện có.
- [x] Lưu trạng thái đã mở theo part trong component; panel vẫn mounted sau lần mở đầu. Không đóng part khác tự động.
- [x] Nút “Cập nhật kết quả” chỉ gọi result hook. Nút panel chỉ gọi writing feedback hook.
- [x] Giữ nguyên objective summary, review link, navigation, error và metadata của page.
- [x] Chạy page/result tests; xác nhận chưa mở panel thì không gọi feedback API và result summary vẫn không chứa score AI.

**Lệnh:** `npm test -- src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/ResultSummary.test.tsx src/features/exam/__tests__/WritingFeedbackPanel.test.tsx`

**Acceptance:** AC-01, AC-03, AC-07–10.

### TV3-21-06 — Integration regression và bàn giao

**Tạo:** `frontend/src/features/exam/__tests__/writingFeedbackPageContract.test.tsx`.

**Cập nhật:** hai tài liệu TV3-21 này.

- [x] Dùng Result page, WritingResultSummary, hook, API client và normalizer thật; chỉ mock Axios và browser APIs.
- [x] Test direct URL → chỉ GET `/result`; phần feedback không gọi cho đến khi mở part.
- [x] Test mở part gọi endpoint chính xác một lần, với part ID thật; nhiều essay cùng part không nhân số request.
- [x] Test part khác mở độc lập; pending không polling theo timer/focus và chỉ nút cập nhật tạo GET.
- [x] Test PENDING→DONE, refresh lỗi mạng giữ state, refresh 403/contract xóa dữ liệu cũ.
- [x] Test A→B→A, unmount và StrictMode với deferred request; response cũ không hiển thị vào panel mới.
- [x] Test `<script>`, HTML, sentinel URL/digest/job/quota/run ID trong các unknown fields không thực thi/không render; essay gốc hợp lệ vẫn được hiển thị.
- [x] Spy storage và Axios; xác nhận không đọc/ghi/xóa draft, không PUT/POST, không gọi review/workspace/Gemini.
- [x] Chạy focused tests và toàn bộ frontend tests, lint, build. So lint warnings với baseline 28; không tính bundle warning thành lint warning.
- [x] Chạy backend feedback regression tuần tự, không song song Maven cùng `target`.
- [x] Kiểm tra Result page tại 375, 768, 1280 px và keyboard-only; ghi evidence vào handoff.
- [x] Append task status, files, RED/GREEN evidence, AC mapping, lệnh/kết quả, residual issues và request final review.

**Focused frontend command:**

```powershell
npm test -- src/features/exam/__tests__/writingFeedbackContract.test.ts src/features/exam/__tests__/useWritingFeedback.test.tsx src/features/exam/__tests__/writingFeedbackPresentation.test.ts src/features/exam/__tests__/WritingDiffView.test.tsx src/features/exam/__tests__/WritingCorrectionsList.test.tsx src/features/exam/__tests__/WritingFeedbackPanel.test.tsx src/features/exam/__tests__/WritingFeedbackTask.test.tsx src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/writingFeedbackPageContract.test.tsx
```

**Backend regression command:**

```powershell
.\mvnw.cmd '-Dtest=WritingFeedbackContractIT,WritingFeedbackServiceTest,WritingGradingResultCompatibilityIT' test
```

**Final frontend commands:** `npm test`, `npm run lint`, `npm run build`. Repository root: `git diff --check`, `git status --short`.

**Acceptance:** AC-01–10 có evidence; backend contract tương thích; không có code backend thay đổi.

## Acceptance criteria

| AC | Kết quả bắt buộc |
|---|---|
| AC-01 | Feedback chỉ lấy từ GET Writing feedback của đúng attempt/part sau khi người học mở part. |
| AC-02 | Normalizer xác nhận identity, status, scores, criteria, corrections, diff và visual observations. |
| AC-03 | Lazy load, single-flight, abort và stale response guard đúng lifecycle. |
| AC-04 | DONE hiển thị overall band cùng đủ 4 criteria và feedback. |
| AC-05 | Diff/corrections tái tạo đúng essay gốc/bản sửa với Unicode và line endings giữ nguyên. |
| AC-06 | Visual observations chỉ hiển thị cho AI DONE visual hợp lệ. |
| AC-07 | Chờ/lỗi/không khả dụng/too-short có state đúng; không polling hoặc điểm giả. |
| AC-08 | Không lộ raw API error, URL ảnh, digest, job/quota/run metadata hoặc draft. |
| AC-09 | Keyboard, screen reader, zoom và mobile reflow hoạt động; không phụ thuộc màu. |
| AC-10 | `/result`, `/review`, submit, autosave và objective summary không bị đổi contract. |

## Test matrix

| ID | Kịch bản | Kết quả bắt buộc | Task |
|---|---|---|---|
| TC_21_01 | AI DONE text-only, đủ criteria | Score, feedback và diff hiển thị từ API | 01, 04 |
| TC_21_02 | AI DONE visual, observations hợp lệ | Observations hiện; metadata ảnh không hiện | 01, 04 |
| TC_21_03 | PENDING/QUEUED chờ lâu | Không polling; nút cập nhật hoạt động | 02, 04, 06 |
| TC_21_04 | FAILED/UNAVAILABLE | Không score/diff; message an toàn | 02, 04 |
| TC_21_05 | TOO_SHORT/score 0 | Phân biệt SYSTEM/0 với null hoặc AI failure | 01, 04 |
| TC_21_06 | Sai attempt/part hoặc contract | Reject trước render; hiện lỗi cố định | 01, 02 |
| TC_21_07 | Criteria thiếu/trùng/sai band step | Reject response | 01 |
| TC_21_08 | Diff/corrections sai reconstruction | Reject response | 01 |
| TC_21_09 | Offset split surrogate pair | Reject response | 01 |
| TC_21_10 | CRLF, emoji, combining marks, whitespace | Giữ nguyên trên bản gốc/bản sửa | 01, 03 |
| TC_21_11 | Double click cập nhật | Một request đang chạy cho part đó | 02, 04 |
| TC_21_12 | Attempt/part A→B→A, unmount, StrictMode | Không hiển thị response stale | 02, 06 |
| TC_21_13 | Refresh network/timeout/5xx sau feedback hợp lệ | Giữ data; cảnh báo chưa cập nhật | 02, 04 |
| TC_21_14 | Refresh 401/403/404/contract | Xóa data cũ và essay khỏi DOM | 02, 04, 06 |
| TC_21_15 | HTML-like essay/feedback và unknown fields | Text escaped; field nội bộ bị bỏ | 01, 03, 06 |
| TC_21_16 | Nhiều task cùng part và nhiều part | Một GET mỗi part đã mở | 05, 06 |
| TC_21_17 | Chưa mở panel, direct result URL | Chỉ GET result; không GET feedback | 05, 06 |
| TC_21_18 | Keyboard, mobile và long essay | Focus/state rõ; text reflow không bị cắt | 03–06 |

## Definition of Done

- AC-01–10 và TC_21_01–18 đều có tests/evidence hoặc ghi rõ giới hạn chưa xác minh.
- Full frontend tests và build PASS; lint không vượt 28 baseline warnings.
- Backend feedback regression PASS; không sửa backend hoặc thay contract.
- Không còn score/feedback giả trong Result summary; panel chỉ render response đã normalize.
- Không có polling, persistent cache, request từ panel chưa mở hoặc HTML injection.
- Handoff ghi kết quả implementation, verification và review request; không commit/push.

