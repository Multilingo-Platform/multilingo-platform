# TV3-19 — Writing hints UI — Implementation Plan

> **Dành cho Executor khi được yêu cầu triển khai:** dùng `tv3-plan-executor`, thực hiện tuần tự RED → GREEN và append evidence vào handoff. Không commit hoặc push.

- **Ngày:** 2026-10-13
- **Trạng thái:** PLANNED
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`.

**Goal:** Người học Practice Writing chủ động yêu cầu dàn ý và từ vựng từ API TV3-18, đúng task/ngôn ngữ, có trạng thái chờ, quota và retry an toàn.

**Architecture:** `Writing hints contract → attemptApi → useWritingHints → WritingHintsPanel → WorkspacePage`. State hints nằm trong hook, không lưu vào Redux answers hoặc storage.

**Tech stack:** React, TypeScript, Axios, Redux Toolkit, Vitest, React Testing Library, Tailwind và Lucide hiện có.

**Spec:** AC-12 trong `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md`, `docs/superpowers/plans/ndt/TV3-18-plan.md` và các quyết định UI đã chốt trong lượt này.

**Tài liệu:** `docs/superpowers/plans/ndt/TV3-19-plan.md`, `docs/superpowers/plans/ndt/TV3-19-handoff.md`.

## 1. Hiện trạng, quyết định và ràng buộc

### Kết quả kiểm tra repository

- TV3-18 đã được commit tại HEAD hiện tại; latest full-feature review trong handoff kết luận **PASS**, không còn P0/P1.
- Backend có `POST /api/v1/attempts/{id}/writing-hints`, ownership/Practice/status guards, language resolution, quota, persisted replay và `Retry-After`.
- Frontend chưa có hints API, types, hook hoặc panel.
- `WorkspacePage` đã có Practice feedback/retry, autosave và submission controller.
- `EssayRenderer` chỉ phụ trách editor/word count; không đưa request logic vào renderer.
- `PracticeQuestionFeedback` hiện hiển thị thông báo ESSAY chưa hỗ trợ kiểm tra tức thì.
- Frontend không nhận `User.targetLanguage` trong auth response hoặc workspace. Backend phải tiếp tục resolve preference.
- Danh mục frontend hiện có tám ngôn ngữ trong `SUPPORTED_LANGUAGES`; không tạo danh mục riêng chỉ gồm en/vi/fr.
- Request deadline hiện tại của `boundedAttemptRequest` là 10 giây. Gemini mặc định 30 giây, cấu hình tối đa 120 giây: hints không thể dùng nguyên deadline 10 giây.

### Planning verification đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Focused frontend | 8 files / 232 tests PASS |
| Lint | Exit 0; 0 errors, 28 baseline warnings |
| Build | PASS; baseline large-bundle warning |
| `git diff --check` | Exit 0 |
| Git state | Không có tracked changes; untracked `.codex/`, `backend/Exam_Template.xlsx` |

Không chạy full frontend, backend hoặc live Gemini trong lượt planning. Evidence PASS của TV3-18 lấy từ handoff, không phải backend verification mới.

### Quyết định đã chốt

1. Panel thu gọn nằm **dưới từng ESSAY**; mở panel không tự gọi API.
2. Ngôn ngữ học mặc định dùng preference backend; vẫn có bộ chọn rõ ngôn ngữ.
3. Ngôn ngữ gợi ý mặc định theo ngôn ngữ học; có thể đổi riêng.
4. Có “Tạo gợi ý mới”, nhưng phải xác nhận khả năng dùng thêm quota.
5. “Thử lại” dùng **requestId và payload cũ**; “Tạo mới” dùng UUID mới.
6. Không polling, tự retry, gọi khi focus hoặc gọi khi mount.
7. Deadline hints là **150.000 ms**; các API hiện có giữ **10.000 ms**.

### Global Constraints

- Chỉ thay frontend exam feature và hai tài liệu TV3-19.
- Không sửa backend, schema, dependency, shared Axios interceptor, router/auth hoặc danh mục ngôn ngữ hiện có.
- Không gửi essay, answers, prompt, userId, model hoặc API key.
- Không thêm chấm bài, essay feedback, autofill, dịch đề hoặc chỉnh sửa nội dung bài viết.
- Không thay autosave, submit, restore, draft lifecycle hoặc objective Practice feedback.
- Không đọc/ghi/xóa `exam_draft_*` từ hints logic; không persist hints/requestId vào storage.
- Không log request/response thô, nội dung hints, essay hoặc token.
- Backend là nguồn quyết định quyền, quota, ngôn ngữ và kết quả; UI guard không thay thế backend guard.
- Giữ toàn bộ uncommitted/untracked work; không rebase, commit hoặc push.

### Review Focus

1. Retry sau timeout không tạo UUID mới hoặc tự gọi lại.
2. Response cũ sau route/part/hydration change không sửa context mới.
3. Hints đang chạy không khóa editor; submit phải dừng chờ hints ngay lập tức.
4. HTTP 429 quota khác cooldown; HTTP 409 pending khác attempt đã kết thúc.
5. Ngôn ngữ hiển thị lấy từ response, không gắn nhãn theo dropdown khi đang hiển thị bộ hints cũ.

## 2. Contract, hành vi và acceptance criteria

### Frontend API

```ts
interface WritingHintsRequest {
  partId: number;
  questionId: string;
  requestId: string;
  learningLanguage?: string | null;
  hintLanguage?: string | null;
}

interface WritingHintsResponse {
  attemptId: number;
  partId: number;
  questionId: string;
  requestId: string;
  learningLanguage: string;
  hintLanguage: string;
  generatedAt: string;
  outline: Array<{ title: string; points: string[] }>;
  vocabulary: Array<{
    term: string;
    definition: string;
    explanation: string;
    example: string;
  }>;
  limitations: string[];
}

generateWritingHints(
  attemptId: number,
  req: WritingHintsRequest,
  options?: { signal?: AbortSignal }
): Promise<WritingHintsResponse>;
```

Axios path giữ convention hiện tại: `/v1/attempts/<id>/writing-hints`.

### Normalization

- Attempt/part ID: positive Java integer; question ID: string không blank/edge whitespace, tối đa 128 UTF-16 code units, khớp backend validator.
- UUID chuẩn; request được đóng băng sau khi chuẩn bị POST.
- Khi chọn “Theo preference backend”/“Theo ngôn ngữ học”, **bỏ field tương ứng khỏi payload**, không gửi chuỗi rỗng.
- Response phải có envelope thành công và data; bốn IDs phải khớp request.
- Language tags phải hợp lệ, canonical; hỗ trợ alias `eng/vie/fra`, region/script như `fr-CA`, `zh-Hant`.
- Explicit language phải khớp response sau canonicalization. Hint language bị bỏ qua phải bằng resolved learning language.
- Backend-resolved language không bị từ chối chỉ vì chưa có label trong frontend catalog; hiển thị canonical tag khi thiếu label, không fallback sang English.
- Kiểm tra ISO timestamp có timezone, shape và các giới hạn TV3-18: outline 2–8 sections/1–6 points; vocabulary 5–10 items; limitations 0–5.
- Giới hạn text khớp backend: title/term 200; point/definition/explanation/limitation 1.000; example 2.000. Vocabulary term không trùng sau trim/case-fold.
- Projection chỉ giữ field công khai; deep-copy arrays/objects. Không trim, dịch hoặc sửa nội dung generated text.
- Không áp giới hạn 32 KiB của **provider output** lên toàn response envelope có thêm metadata.
- Contract lỗi dùng thông báo cố định; không đưa backend message/raw payload lên UI.

### Hook interface

```ts
interface WritingHintsLanguageSelection {
  learningLanguage: string | null;
  hintLanguage: string | null;
}

interface WritingHintsFailure {
  kind:
    | 'pending' | 'rate-limited' | 'quota'
    | 'language' | 'context' | 'access'
    | 'ended' | 'conflict' | 'contract' | 'request';
  message: string;
  action: 'retry' | 'change-language' | 'reload' | 'none';
  retryAt: number | null;
}

interface QuestionWritingHints {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  data: WritingHintsResponse | null;
  error: WritingHintsFailure | null;
  lastSelection: WritingHintsLanguageSelection | null;
}

interface WritingHintsController {
  busy: boolean;
  retryAfterSeconds: number | null;
  blockedError: WritingHintsFailure | null;
  getHints(questionId: string): QuestionWritingHints;
  generate(questionId: string, selection: WritingHintsLanguageSelection): Promise<void>;
  retry(questionId: string): Promise<void>;
  suspend(): void;
}

useWritingHints(options: {
  workspace: WorkspaceResponse | null;
  partId: number | null;
  questions: readonly Question[];
  isLocked: () => boolean;
}): WritingHintsController;
```

### Điều phối và lifecycle

- Một controller cho workspace; tối đa một hints request đang được client chờ.
- Trước request, kiểm tra live workspace/store context, `PRACTICE`, `IN_PROGRESS`, part thuộc section WRITING, selected question là ESSAY, section chưa locked và submission chưa khóa.
- Không dùng `partId ?? 1` của page làm fallback cho hints; ID/member không xác định hoặc trùng phải fail closed.
- Mutex đặt trước await và trước tạo UUID; gọi lặp không tạo thêm POST.
- Operation lưu immutable payload/UUID. Retry luôn dùng operation đó, kể cả preference backend hoặc dropdown đã đổi.
- Muốn đổi language của operation phải tạo operation mới qua xác nhận; không thay payload dưới UUID cũ.
- Thành công lưu trong memory theo attempt/context/part/question. Edit essay không invalidate hints vì request không phụ thuộc essay.
- Đổi part hủy client wait, giữ operation cũ trong cùng context để quay lại có thể retry cùng UUID; response late bị bỏ qua.
- Đổi attempt, authoritative hydration hoặc unmount xóa state context cũ và abort request.
- Metadata refresh không đổi context revision thì không xóa hints.
- `suspend()` vô hiệu hóa flight ngay, không chờ Gemini. Không sửa answers hoặc ngăn submit.
- Sau submit manual thất bại và workspace vẫn hợp lệ, có thể retry hints thủ công; không tự resume request.
- Abort không phải rollback/refund. Không bảo đảm idempotency xuyên reload vì requestId không được persist.

### Phân loại lỗi

| Trường hợp | Hành vi UI |
|---|---|
| HTTP 409 / business code 1604 | Đang xử lý; giữ UUID, chờ `Retry-After`, sau đó cho retry thủ công |
| HTTP 429 / business code 1606 | Cooldown; khóa hints actions đến mốc retry, không tự gửi lại |
| HTTP 429 / business code 429 (`QUOTA_EXCEEDED`) | Hạn mức không khả dụng/đã hết; không hiển thị số lượt còn lại hoặc countdown giả; chặn hints đến reload |
| HTTP 422 / business code 1607–1608 | Yêu cầu sửa lựa chọn language; không English fallback |
| HTTP 409 / business code 1605 | Conflict request; không tự đổi UUID để bypass; yêu cầu reload |
| HTTP 409 khác | Attempt đã kết thúc/hết hạn hoặc conflict chưa xác định; chặn hints, yêu cầu reload; không navigate result |
| HTTP 401/403 | Xóa hints context cũ, chặn requests; giữ shared auth behavior |
| HTTP 404, 422 context/validation, 413 | Không lặp payload lỗi; yêu cầu reload hoặc chỉnh language theo mã cụ thể |
| HTTP 502/503/504, network, client timeout | Thông báo cố định, retry thủ công cùng UUID |
| Frontend contract error | Không render malformed data; cho retry cùng UUID |

`Retry-After` đọc từ error headers, hỗ trợ delta-seconds hợp lệ. Thiếu/sai header ở code 1604/1606 dùng backoff 10 giây; đây chỉ là UI backoff, không thay server policy. Timer chỉ cập nhật thời gian chờ, không gọi HTTP.

### Acceptance criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | Panel chỉ xuất hiện cho ESSAY thuộc Writing Practice; Mock/objective/terminal context không gửi hints |
| AC-02 | Request chỉ chứa IDs, UUID và optional languages; response identity/shape được normalize |
| AC-03 | Đủ tám ngôn ngữ hiện có; backend default và hint override đúng; không English fallback |
| AC-04 | Một client flight; retry cùng payload/UUID, tạo mới có xác nhận; không application auto-retry/polling |
| AC-05 | Hiển thị đầy đủ outline, vocabulary và limitations bằng text an toàn; không biến hints thành bài mẫu/điểm chấm |
| AC-06 | Route, part, hydration, StrictMode và submit không nhận stale completion hoặc stuck busy |
| AC-07 | Loading/error/quota/retry và confirmation truy cập được bằng bàn phím, screen reader; responsive không che editor |
| AC-08 | Hints không sửa answers/version/draft; full frontend tests/build PASS, không thêm lint warning và thay đổi ngoài scope |

## 3. Subtasks triển khai

Thứ tự: `19-01 → 19-02 → 19-03 → 19-04 → 19-05 → 19-06`. Các task có liên quan; mỗi task có RED/GREEN và review gate riêng.

### TV3-19-01 — Typed contract, normalizer và fixtures

**Sửa:** `frontend/src/features/exam/types/api.types.ts`.

**Tạo:** `frontend/src/features/exam/api/writingHintsContract.ts`, `frontend/src/features/exam/__tests__/writingHintsContract.test.ts`, `frontend/src/features/exam/__tests__/fixtures/writingHints.ts`.

**Interfaces:**

```ts
validateWritingHintsRequest(attemptId: number, req: WritingHintsRequest): WritingHintsRequest;
normalizeWritingHints(data: unknown, expected: WritingHintsRequest & { attemptId: number }): WritingHintsResponse;
createWritingHintsRequestId(): string;
class WritingHintsContractError extends Error {}
```

- [x] Tạo fixtures envelope/response en, vi, fr theo DTO thật; đối chiếu fixtures localized của TV3-18.
- [x] Viết tests IDs/UUID/question ID boundaries, optional languages, malformed/wrong identity response.
- [x] Thêm tests tám base languages, aliases, region/script, unsupported syntax, vocabulary 4/5/10/11 và text boundaries.
- [x] Chạy RED; implement types, validator, projection, canonicalization và deep-copy.
- [x] Tạo UUID bằng Web Crypto; không dùng `Math.random`, timestamp hoặc fallback giả. Nếu không tạo được UUID, báo lỗi an toàn và không gọi API.
- [x] Chạy GREEN; assert input không mutate và unknown private fields không vào projection.

```ts
expect(normalizeWritingHints(raw, expected)).toMatchObject({
  attemptId: 42, partId: 30, questionId: 'writing-task-1', hintLanguage: 'vi',
});
expect(normalized).not.toHaveProperty('prompt');
expect(normalized).not.toHaveProperty('correctAnswer');
```

**Test:** `npm test -- src/features/exam/__tests__/writingHintsContract.test.ts`

**Acceptance:** AC-02, AC-03, AC-05.

### TV3-19-02 — Bounded hints API và safe error mapping

**Sửa:** `frontend/src/features/exam/api/attemptApi.ts`, `frontend/src/features/exam/__tests__/attemptApi.test.ts`.

**Tạo:** `frontend/src/features/exam/utils/writingHintsErrors.ts`, `frontend/src/features/exam/__tests__/writingHintsErrors.test.ts`.

```ts
classifyWritingHintsError(error: unknown, nowMs: number): WritingHintsFailure;
```

- [x] Viết tests exact endpoint/body, invalid input không gọi HTTP, envelope lỗi và normalizer.
- [x] Viết deferred tests không settle, external abort, late response và timer/listener cleanup.
- [x] Test error mapping tách HTTP status khỏi business code, gồm hai loại 429 và các loại 409.
- [x] Chạy RED; thêm optional timeout cho private `boundedAttemptRequest`, default giữ 10.000 ms cùng semantics.
- [x] Implement `generateWritingHints` với deadline promise, Axios timeout/signal 150.000 ms; deadline tính cả interceptor queue.
- [x] Construct payload allowlist; omit default language fields, normalize response trước trả về hook.
- [x] Map lỗi sang fixed UI copy; parse `Retry-After` từ AxiosHeaders/plain headers. Không hiển thị `error.message` backend.
- [x] Chạy GREEN và toàn bộ API regression hiện có.

```ts
expect(postBody).toEqual({ partId: 30, questionId: 'writing-task-1', requestId: expectedRequestId });
expect(postBody).not.toHaveProperty('essay');
expect(postBody).not.toHaveProperty('answer');
expect(postConfig.timeout).toBe(150_000);
```

**Test:** `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts`

**Acceptance:** AC-02, AC-04; hints bounded, các API autosave/submit/result/review/feedback giữ deadline cũ.

### TV3-19-03 — Scoped hints controller và idempotent retry

**Tạo:** `frontend/src/features/exam/hooks/useWritingHints.ts`, `frontend/src/features/exam/__tests__/useWritingHints.test.tsx`.

- [ ] Viết tests guards, double generate, hai ESSAY cùng bấm, frozen payload và retry UUID.
- [ ] Thêm deferred tests part switch, A → B → A, same-ID hydration, StrictMode và late finally.
- [ ] Chạy RED; implement live context, synchronous mutex, flight identity/generation và AbortController.
- [ ] Đọc Redux chỉ để kiểm tra attempt/context revision/lock; không đọc essay hoặc invalidate theo edits.
- [ ] Kiểm tra part/section membership và lock trực tiếp từ workspace, không dùng Mock-only page lock.
- [ ] Lưu state theo composite identity; cùng questionId ở hai part không collision.
- [ ] Retry dùng immutable operation; generate mới tạo UUID mới sau guards/mutex.
- [ ] Backoff pending/rate-limit áp dụng cho hints actions của controller; quota/access/ended block theo bảng lỗi.
- [ ] Permission/ended/conflict xóa hints context không còn được phép hiển thị. Network lỗi khi tạo mới giữ bộ hints trước cùng cảnh báo chưa cập nhật.
- [ ] Part switch hủy client wait, giữ operation cùng context để manual retry. `suspend()`/old finally chỉ giải phóng flight tương ứng.
- [ ] Attempt/context revision/unmount clear state; metadata refresh và essay edits không clear. Chạy GREEN.

```ts
await controller.generate(questionId, selection); // Timeout do test điều khiển.
await controller.retry(questionId);
expect(firstRequest.requestId).toBe(secondRequest.requestId);
expect(secondRequest).toEqual(firstRequest);
expect(httpCalls).toHaveLength(2); // Hai thao tác thủ công.
```

**Test:** `npm test -- src/features/exam/__tests__/useWritingHints.test.tsx`

**Acceptance:** AC-01, AC-03, AC-04, AC-06.

### TV3-19-04 — Panel Writing hints và confirmation

**Tạo:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx`, `frontend/src/features/exam/__tests__/WritingHintsPanel.test.tsx`.

Component nhận task identity/number, question state, busy/disabled/backoff và callbacks; không tự gọi API.

- [ ] Viết rendered tests collapsed/idle/loading/ready/error/backoff và keyboard confirmation; chạy RED.
- [ ] Tạo disclosure bằng button, `aria-expanded`, `aria-controls` và `useId`.
- [ ] Dùng native selects có label “Ngôn ngữ học” và “Ngôn ngữ gợi ý”. Import read-only `SUPPORTED_LANGUAGES`; không sao chép catalog hoặc sửa vocab feature.
- [ ] Defaults lần đầu: “Theo ngôn ngữ học đã lưu” / “Theo ngôn ngữ học”. Khi quay lại task, phục hồi selection của operation trước.
- [ ] “Tạo gợi ý” chỉ chạy sau click. “Thử lại” giữ operation/payload cũ.
- [ ] “Tạo gợi ý mới” hoặc đổi language của operation hiện có phải qua confirmation inline có nút xác nhận/hủy.
- [ ] Render outline bằng headings/lists, vocabulary bằng cards/definition lists, limitations đầy đủ.
- [ ] Gắn `lang` theo response cho generated content; labels lấy resolved response, không theo dropdown hiện tại.
- [ ] Render React text; không dùng `HtmlContent`, markdown renderer hoặc `dangerouslySetInnerHTML`.
- [ ] Loading dùng thông báo ngắn `role="status"`, lỗi `role="alert"`; không đưa toàn bộ hints dài vào live region.
- [ ] Giữ amber/slate và Lucide; `min-w-0`, wrap text, mobile controls xếp dọc; không dùng scroll pane cố định.
- [ ] Chạy GREEN với text dài, HTML-like strings, vi/fr và response thiếu label.

Copy chính: “Gợi ý Writing”; “Đang tạo gợi ý. Có thể tiếp tục viết bài.”; “Gợi ý tham khảo, không phải điểm chấm hoặc bài viết mẫu.”; “Tạo mới thành công sẽ dùng thêm một lượt trong hạn mức.”; “Yêu cầu trước có thể đã hoàn tất trên máy chủ.”; “Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.”

```ts
expect(generate).not.toHaveBeenCalled(); // Chỉ mở panel.
expect(document.querySelector('script')).toBeNull();
expect(screen.getByRole('button', { name: /xác nhận tạo gợi ý mới/i })).toBeEnabled();
```

**Test:** `npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx`

**Acceptance:** AC-03–05, AC-07.

### TV3-19-05 — Workspace integration, submit và section gates

**Sửa:** `frontend/src/features/exam/pages/WorkspacePage.tsx`.

**Tạo:** `frontend/src/features/exam/__tests__/WorkspaceWritingHints.test.tsx`.

**Cập nhật fixtures/mocks khi cần:** `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`, `frontend/src/features/exam/__tests__/WorkspacePractice.test.tsx`.

- [ ] Viết page tests đúng vị trí panel, nhiều ESSAY, Mock/objective/non-Writing không có controls; chạy RED.
- [ ] Khởi tạo một `useWritingHints` trước conditional returns; pass actual selected part và synchronous `submission.isLocked`.
- [ ] Render panel dưới ESSAY editor, ngoài editor fieldset. Hint loading không disable textarea hoặc autosave.
- [ ] Chỉ thay notice của `PracticeQuestionFeedback` cho Writing ESSAY; ESSAY ngoài Writing giữ notice cũ.
- [ ] Không sửa `EssayRenderer`, `QuestionRenderer`, Practice feedback/retry controller hoặc answer reducer.
- [ ] Không dùng ID fallback để enable hints; React key chứa attempt/context/part/question.
- [ ] Hiển thị global blocked error một lần cùng action phù hợp, tách khỏi objective feedback.
- [ ] Gọi `writingHints.suspend()` trước manual/timeout submit và trước cả hai callback `submission.retry()` của overlay.
- [ ] Giữ synchronous store lock guard để mọi submit path vô hiệu hóa request. Reload dùng authoritative flow hiện có.
- [ ] Chạy GREEN và workspace regressions.

```ts
expect(textarea).toBeEnabled(); // Hints đang loading.
expect(events).toEqual(['suspend', 'submit']);
expect(hintsApi).not.toHaveBeenCalled(); // Mock Test.
```

**Test:** `npm test -- src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/EssayRenderer.test.tsx`

**Acceptance:** AC-01, AC-05–08; không hồi quy objective feedback, editor, locks hoặc submit.

### TV3-19-06 — Integration regression và bàn giao

**Tạo:** `frontend/src/features/exam/__tests__/writingHintsWorkspaceContract.test.tsx`.

**Tài liệu cập nhật:** `docs/superpowers/plans/ndt/TV3-19-plan.md`, `docs/superpowers/plans/ndt/TV3-19-handoff.md`.

- [ ] Tests dùng page, hints hook, API, normalizer và answer reducer thật; chỉ mock HTTP/browser APIs.
- [ ] GET Practice workspace → mở panel → chọn language → POST hints → render localized response.
- [ ] Assert payload allowlisted; không direct Gemini request, workspace/exam lookup bổ sung hoặc essay payload.
- [ ] Edit essay trong hints flight → response không overwrite essay, dirty state hoặc server version.
- [ ] Network timeout → retry thủ công cùng UUID → backend replay cùng response/generatedAt; không tự phát thêm request.
- [ ] Thành công → xác nhận tạo mới → UUID mới; hủy confirmation không gửi POST.
- [ ] Pending/cooldown có countdown nhưng hết countdown không tự gọi HTTP; quota không có remaining-count giả.
- [ ] Same questionId ở hai part, part switch, authoritative rehydrate, A → B → A không nhận stale response.
- [ ] Hints pending → submit → request vô hiệu hóa; submit giữ `finalAnswers` contract và không chờ hints.
- [ ] Draft giữ nguyên; hints không dispatch answer mutation hoặc persist.
- [ ] Kiểm tra UI 375/768/1280 px và keyboard bằng browser với mocked HTTP; không tạo attempt/quota/live Gemini. Thiếu browser evidence phải ghi rõ.
- [ ] Chạy focused/full frontend, lint, build, diff check. Append task evidence, AC/TC mapping, residual risks và yêu cầu review toàn feature.

```ts
expect(retryBody).toEqual(firstBody);
expect(newBody.requestId).not.toBe(firstBody.requestId);
expect(textarea).toHaveValue(latestEssay);
expect(localStorage.getItem('exam_draft_42')).toBe(originalDraft);
```

**Focused regression:**

```powershell
npm test -- src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/writingHintsWorkspaceContract.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
```

**Acceptance:** AC-01–08; integration evidence không chỉ dựa trên mocked hints hook.

## 4. Ma trận kiểm thử và Definition of Done

| TC | Loại | Kịch bản | Tiền điều kiện | Bước | Dữ liệu | Kết quả |
|---|---|---|---|---|---|---|
| TC_19_01 | Happy | Tạo hints | Practice Writing active | Mở panel, click tạo | Hai sections, 5–10 từ | Đủ nội dung backend |
| TC_19_02 | Language | Default/override | Preference backend có hoặc thiếu | Default rồi chọn override | vi, en→fr, tám codes | Không fallback giả; đúng labels |
| TC_19_03 | Boundary | IDs/text/counts | Chuẩn bị request/response | Thử cận biên | ID 0/1/max/max+1; vocab 4/5/10/11 | Reject đúng, không mutate |
| TC_19_04 | Negative | Malformed identity | POST đã gửi | Trả sai metadata | Sai UUID/part/qid, invalid shape | Contract error, không render |
| TC_19_05 | Security | Mock/non-Writing | Workspace không đủ điều kiện | Gọi controller/click | Mock, objective, locked | Không hints POST |
| TC_19_06 | Concurrency | Double/two-task click | Task hợp lệ | Click đồng thời | Hai ESSAY | Một client flight |
| TC_19_07 | Retry | Timeout/replay | Có operation cũ | Timeout, retry | UUID/payload cũ | Không tạo key mới |
| TC_19_08 | Quota | Cooldown và hết quota | API từ chối | Trả 1606 hoặc quota | Retry-After/missing quota | Hai UX khác nhau, không auto HTTP |
| TC_19_09 | Conflict | Pending/ended/conflict | Request đã gửi | Trả các 409 | 1604/1605/generic409 | Đúng action; không result redirect |
| TC_19_10 | State | Edit trong flight | Hints pending | Gõ essay, resolve | Unicode/new essay | Editor/answers giữ nguyên |
| TC_19_11 | Race | Route/hydration/part | Request cũ pending | Đổi context rồi settle | A→B→A, cùng qid | Late completion bị bỏ qua |
| TC_19_12 | Lifecycle | StrictMode/unmount | Flight hoặc backoff | Cleanup/replay | Late reject/finally | Không request tự động/stuck busy |
| TC_19_13 | Submit | Initial và retry submit | Hints pending | Submit/retry | MANUAL/TIMEOUT_CLIENT | Hints không cản submit |
| TC_19_14 | Regenerate | Tạo mới | Có operation trước | Hủy/xác nhận | Language mới/cũ | Hủy: 0 POST; xác nhận: UUID mới |
| TC_19_15 | Security | Permission/XSS | Có hints trước | 403 hoặc HTML-like text | Script/URL-like string | Clear unauthorized data; text không execute |
| TC_19_16 | UX | Keyboard/mobile | Panel/error/confirmation | Tab, Enter, resize | Label dài, vi/fr | Accessible, không che editor |
| TC_19_17 | Integrity | Draft/autosave | Draft khác essay/backend | Tạo/retry hints | Existing draft/version | Hints không sửa lifecycle |
| TC_19_18 | Transport | Deadline/abort | HTTP không settle | Advance 150s/abort | Interceptor-like queue | Promise kết thúc, cleanup đúng |

### Final verification

Tại `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

Tại repository root:

```powershell
git diff --check
git status --short
```

**Definition of Done:**

- Tất cả AC/TC có evidence; các phần chưa chạy phải ghi rõ.
- Full frontend tests/build PASS; không phát sinh lint warning mới so với baseline được kiểm tra lại.
- Không gọi live Gemini hoặc dùng quota thật trong verification.
- Không có mock hints production, English fallback, auto retry/polling, autofill hoặc hints persistence.
- API cũ giữ payload/deadline/behavior; backend, shared Axios và dependency không đổi.
- Browser evidence chứng minh layout và keyboard; fixture/schema tests không được mô tả là semantic language validation của model thật.
- Handoff append đầy đủ RED/GREEN, files, commands/results và risks.
- Dừng chờ review toàn feature; không commit/push.
