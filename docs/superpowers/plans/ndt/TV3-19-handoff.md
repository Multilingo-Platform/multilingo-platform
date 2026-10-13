# TV3-19 — Writing hints UI — Handoff

## 2026-10-13 — Codex Planner — PLANNED

**Feature:** Writing hints UI.

**Plan:** `docs/superpowers/plans/ndt/TV3-19-plan.md`.

**Repository baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`.

**Dependency:** TV3-18 đã commit; latest full-feature handoff PASS.

**Implementation evidence:** Chưa triển khai; chưa có RED/GREEN cho TV3-19.

### Planning verification

- Focused frontend: 8 files / 232 tests PASS.
- `npm run lint`: exit 0, 0 errors, 28 baseline warnings.
- `npm run build`: PASS; baseline large-bundle warning.
- `git diff --check`: exit 0.
- Không chạy full frontend, backend hoặc live Gemini.

### Preserved working tree

- `.codex/` và `backend/Exam_Template.xlsx` chưa tracked, được giữ nguyên.
- Khi ghi tài liệu, tracked source không thay đổi.

### Task status

| Task | Deliverable | Dependency | Status |
|---|---|---|---|
| TV3-19-01 | Types, normalizer, UUID, fixtures | TV3-18 | IMPLEMENTED |
| TV3-19-02 | Bounded API, safe errors/backoff | 19-01 | IMPLEMENTED |
| TV3-19-03 | Scoped controller, replay/retry | 19-01–02 | PLANNED |
| TV3-19-04 | Panel và confirmation | 19-03 | PLANNED |
| TV3-19-05 | Workspace/submit integration | 19-03–04 | PLANNED |
| TV3-19-06 | Integration, verification, handoff | 19-01–05 | PLANNED |

### Decisions locked

- Panel thu gọn bên dưới từng ESSAY.
- Backend language default; người học có thể chọn ngôn ngữ học và ngôn ngữ gợi ý riêng.
- Tạo mới sau operation có sẵn cần confirmation; retry giữ UUID/payload cũ.
- Hints deadline 150 giây; không polling, application auto-retry, autofill hoặc storage persistence.
- Hints state không sửa answers, autosave, draft hoặc submit contract.

### Residual risks

- Client abort không hủy chắc chắn provider call, không bảo đảm refund.
- Reload/unmount mất requestId trong memory; không bảo đảm exactly-once xuyên reload hoặc nhiều tab.
- API không cung cấp remaining quota hoặc frontend language-catalog endpoint; không suy đoán các dữ liệu này.
- Shared auth interceptor có thể replay transport request; UUID/payload phải giữ nguyên, không sửa interceptor.
- Model semantic language/quality cần staging validation; frontend không thể chứng minh bằng schema.
- Backend feature có thể đang disabled hoặc chưa provision quota; UI phải xử lý lỗi thật, không tạo fallback.
- P2 race-test follow-up của TV3-18 nằm ngoài TV3-19.

### Chỉ dẫn Executor

- Chỉ triển khai khi có yêu cầu riêng; kiểm tra lại HEAD, dirty state và dependency.
- Đọc plan/handoff/repository instructions; thực hiện tuần tự RED → GREEN.
- Mỗi task append `IN_PROGRESS` rồi `IMPLEMENTED`, kèm files, evidence và AC mapping.
- Không refactor backend, auth, vocab, editor hoặc Practice feedback ngoài các điểm tích hợp đã nêu.
- Không commit/push; hoàn tất verification rồi dừng chờ review.

### Chỉ dẫn Reviewer

- Review toàn bộ sáu subtasks và integration, không chỉ task cuối.
- Kiểm tra exact payload, UUID reuse, timeout/backoff, language labels, stale guards và mọi submit path.
- Xác minh integration tests dùng API/normalizer/hook/reducer thật.
- Phân loại P0/P1/P2 với exact locations/minimal fixes.
- Append `PASS`, `NEED_FIX` hoặc `BLOCKED` cùng verification evidence; phân biệt baseline warnings và regression.

---

## 2026-10-13 — TV3-19-01 Execution Evidence

- **Subtask:** TV3-19-01 — Typed contract, normalizer và fixtures.
- **Status:** IMPLEMENTED.
- **Tập tin tạo mới / chỉnh sửa:**
  - `frontend/src/features/exam/types/api.types.ts` (Chỉnh sửa: thêm interfaces `WritingHintsOutlineSection`, `WritingHintsVocabularyItem`, `WritingHintsRequest`, `WritingHintsResponse`).
  - `frontend/src/features/exam/__tests__/fixtures/writingHints.ts` (Tạo mới: fixtures en, vi, fr, request mẫu và helper envelope).
  - `frontend/src/features/exam/api/writingHintsContract.ts` (Tạo mới: `createWritingHintsRequestId` bằng Web Crypto randomUUID, `canonicalizeLanguageTag` cho 8 ngôn ngữ chuẩn BCP 47 + ISO-639-3 aliases + region/script, `validateWritingHintsRequest`, `normalizeWritingHints`, `WritingHintsContractError`).
  - `frontend/src/features/exam/__tests__/writingHintsContract.test.ts` (Tạo mới: 34 tests kiểm thử toàn diện boundaries, canonicalization, deep copy, projection, unknown field filtering và language rules).
  - `docs/superpowers/plans/ndt/TV3-19-plan.md` & `docs/superpowers/plans/ndt/TV3-19-handoff.md` (Chỉnh sửa: cập nhật trạng thái và checklist sang IMPLEMENTED).

- **Chi tiết Acceptance Criteria (AC):**
  - **AC-02 (Minimal request & normalized identity):** `validateWritingHintsRequest` chỉ chấp nhận và đóng băng `partId`, `questionId`, `requestId` và optional `learningLanguage`/`hintLanguage`. `normalizeWritingHints` kiểm chứng nghiêm ngặt cả 4 IDs (`attemptId`, `partId`, `questionId`, `requestId`), lọc bỏ hoàn toàn các trường nhạy cảm/không công khai (`prompt`, `correctAnswer`, `score`, v.v.).
  - **AC-03 (Supported languages & non-English):** Hỗ trợ đầy đủ 8 ngôn ngữ cơ sở (`en`, `vi`, `ko`, `zh`, `ja`, `fr`, `de`, `es`), ánh xạ các alias ISO 639-3 (`eng`, `vie`, `fra`, `fre`, `deu`, `ger`, `spa`, `kor`, `zho`, `chi`, `jpn`), bảo toàn sub-tags region/script (`fr-CA`, `zh-Hant`, `en-US`), từ chối cú pháp không hợp lệ/không hỗ trợ mà không fallback sang English.
  - **AC-05 (Output schema & boundaries):** Chuẩn hóa và xác thực nghiêm ngặt outline (2–8 sections, 1–6 points/section), vocabulary (5–10 items, term unique sau trim/case-fold, độ dài trường chuẩn TV3-18), limitations (0–5 items). Deep copy toàn bộ mảng và đối tượng, không làm biến đổi (mutate) dữ liệu đầu vào, không trim làm sai lệch văn bản do LLM sinh ra.

- **Kết quả kiểm thử thực tế (Verification Evidence):**
  1. **TDD Red Phase:**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/writingHintsContract.test.ts`
     - Kết quả: Thất bại do chưa tồn tại module `../api/writingHintsContract`.
  2. **TDD Green Phase (Subtask Unit Tests):**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/writingHintsContract.test.ts`
     - Kết quả: **34 tests PASS**, thời gian 4.36s (1 test file passed).
  3. **Focused Contract Regression Suite:**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/attemptApi.test.ts`
     - Kết quả: **372 tests PASS** (5 test files passed, 0 failures, 0 errors).
  4. **Linting Check:**
     - Lệnh chạy: `npm run lint`
     - Kết quả: **0 errors, 28 baseline warnings** (đúng bằng baseline planning, 0 warning mới được thêm vào).
  5. **Build Verification:**
     - Lệnh chạy: `npm run build`
     - Kết quả: **Exit code 0**, build thành công trong 4.01s.
  6. **Whitespace & Git Scope Check:**
     - Lệnh chạy: `git diff --check`
     - Kết quả: Exit code 0 (sạch sẽ, không trailing whitespace).
     - `git status --short`: Đúng các tệp tin trong scope TV3-19-01; bảo toàn các tệp tin ngoài phạm vi (`.codex/`, `backend/Exam_Template.xlsx`).
     - Zero git commit, zero git push. Dừng chờ review.

---

## 2026-10-13 — Codex Reviewer: TV3-19-01 re-review

- **Agent:** Codex Reviewer
- **Reviewed subtask:** TV3-19-01 — Typed contract, normalizer và fixtures; latest Execution Evidence **IMPLEMENTED**. Review đúng gate 19-01 và direct TV3-18 DTO/language/validator dependencies, không yêu cầu 19-02–06 triển khai sớm.
- **Decision:** **NEED_FIX** — Có **4 P1** về required contract validation; không có confirmed P0. Thêm **3 P2** non-blocking về timestamp, localized fixture và edge-whitespace parity.
- **Git baseline/scope:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Tracked diff chỉ thêm 33 lines WritingHints types vào `api.types.ts`. Đọc trực tiếp untracked `writingHintsContract.ts`, test và fixtures; plan/handoff thuộc documentation scope. Giữ nguyên `.codex/` và `backend/Exam_Template.xlsx`; không chạy backend hoặc ghi workbook. Reviewer không sửa production/tests/approved plan, chỉ append entry này, không commit/push.

### Verified acceptance criteria

- **AC-02 PARTIAL:** Request projection chỉ giữ IDs/UUID/optional languages, omit null/undefined languages, canonical lowercase UUID, positive Java integer checks và Object.freeze, không mutate input. Types khớp public backend DTO. Response đối soát bốn IDs, deep-copy và projection bỏ private fields đúng cho valid expected request, nhưng success-envelope validation còn thiếu (P1-04), question ID edge whitespace chưa hoàn toàn khớp Java (P2-03).
- **AC-03 NOT MET:** Tám base languages/aliases và common region/script examples có tests; explicit language mismatch được reject. Tuy nhiên valid backend-resolved language ngoài UI catalog bị reject (P1-01), omitted hintLanguage không được đối soát với resolved learningLanguage (P1-02), malformed script/region sequence lại được accept (P1-03).
- **AC-05 PARTIAL:** Outline/vocabulary/limitations shape/count/text caps, duplicate term, safe error messages, public-only deep-copy và verbatim text giữ đúng paths được inspect/test. Không áp provider-output 32 KiB cap lên toàn response. Timestamp có timezone nhưng invalid calendar date bị accept (P2-01); fixture vi chưa đúng ALL-fields language contract TV3-18 (P2-02).
- **Security/scope:** Không HTTP/Gemini call, storage, Redux mutation, essay payload, raw logging, HTML rendering hoặc backend/auth/dependency change trong implementation gate này. Web Crypto UUID không có Math.random/timestamp fallback; unsupported crypto trả fixed contract error. Actual API/no-store/access/race/rendering thuộc subtasks sau, không dùng việc chưa triển khai chúng để bác 19-01.

### IN-SCOPE — confirmed actionable findings

1. **P1-01 — Normalizer từ chối language hợp lệ do backend resolve ngoài catalog UI.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:108–109`, dùng chung bởi response checks tại `:249–262`.
   - **Scenario:** Request bỏ cả language fields; backend catalog được cấu hình thêm `it` và persisted preference là `it`. Valid 200 envelope với learningLanguage=hintLanguage=it bị ném `WritingHintsContractError` thay vì được giữ canonical tag để UI fallback label. Probe production function xác nhận rejection. Đây là vi phạm explicit approved rule tại `TV3-19-plan.md:123`, không phải yêu cầu mở rộng catalog frontend/backend.
   - **Minimal fix:** Tách canonical BCP47 syntax validation khỏi UI catalog membership. Normalizer phải nhận syntactically valid backend-resolved tags không có label, vẫn đối soát explicit request languages; không thêm English fallback hoặc sửa danh mục hiện có.
   - **Focused regression:** Omitted/default request + valid 200 response it/it hoặc pt-BR/pt-BR được accept; malformed tags vẫn reject; explicit requested language mismatch vẫn reject. Không chỉ test tám hardcoded mã.

2. **P1-02 — Hint language bị bỏ qua không được kiểm tra bằng resolved learning language.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:264–272`.
   - **Scenario:** Expected learningLanguage=en, hintLanguage omitted; response learningLanguage=en/hintLanguage=vi vẫn được accept. Bỏ cả hai fields cũng accept en/vi. Probe xác nhận cả hai paths, trong khi approved rule (`TV3-19-plan.md:122`) yêu cầu omitted hint bằng response resolved learning language. Test mang tên defaults tại `writingHintsContract.test.ts:257` chỉ cung cấp response đã bằng nhau nên không phát hiện mismatch.
   - **Minimal fix:** Nếu expected.hintLanguage absent/null thì bắt buộc canonicalHintLang === canonicalLearningLang, không tự sửa response hoặc gán nhãn lại. Giữ explicit override hợp lệ.
   - **Focused regression:** Omitted hint với explicit learning và omitted cả hai: matching pair accept, mismatching pair reject; explicit en→vi override vẫn accept.

3. **P1-03 — Canonicalizer chấp nhận BCP47 sai thứ tự hoặc lặp script/region.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:113–127`.
   - **Scenario:** Loop chỉ kiểm tra hình dạng từng segment, không kiểm tra grammar toàn tag. `en-US-US`, `zh-Hant-Hans`, `en-US-Latn`, `en-123-456` đều được validateWritingHintsRequest accept/canonicalize rồi có thể gửi đến backend; Java Locale.Builder thật reject tất cả. Response metadata có các tags này cũng được normalizer accept. Common fr-CA/zh-Hant examples GREEN không chứng minh strict canonical BCP47.
   - **Minimal fix:** Validate toàn tag với grammar primary → optional single script → optional single region, reject variant/extension/private-use theo contract; hoặc dùng standards parser/canonicalizer rồi áp v1 restrictions. Giữ alias normalization và canonical casing, không thêm dependency hoặc đổi backend.
   - **Focused regression:** Bốn tags trên reject ở request/response; fr-CA, zh-Hant, zh-Hans-CN và numeric region hợp lệ vẫn accept, canonicalization stable.

4. **P1-04 — Thiếu strict success-envelope gate.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:216–224`.
   - **Scenario:** `{code:'403', data: validResponse}`, code=null hoặc missing code đều được accept; direct DTO không có envelope cũng accept. Probe xác nhận cả bốn cases. Chỉ numeric code !=200 bị reject; malformed error envelope có valid-looking data vượt required success-envelope check của `TV3-19-plan.md:120`. Current test line 192 còn chủ động coi no-envelope payload là positive case trái contract.
   - **Minimal fix:** Require actual success envelope (numeric code===200 và present object data) trước projection; reject missing/wrong-typed/error code và raw DTO. Điều chỉnh direct-payload positive test; nếu cần data-only helper nội bộ thì tách rõ khỏi public response normalizer, không làm API gate trở nên optional.
   - **Focused regression:** Numeric 200 + valid object data accept; code 403, '200', '403', null/missing, missing/null data và raw DTO reject. Không render data từ non-success/malformed envelope.

5. **P2-01 — Date.parse rollover nhận ngày lịch không tồn tại.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:45–48`.
   - **Scenario:** generatedAt=`2026-02-30T00:00:00Z` được regex và Date.parse accept, rồi projection giữ nguyên impossible date. Existing invalid-date tests chỉ dùng arbitrary string/no-timezone. Không ảnh hưởng quota/provider hoặc IDs nên phân loại P2.
   - **Minimal fix / regression:** Validate calendar components/leap year và time ranges trước Date.parse, giống rule date validation đã có trong exam contracts, không tự normalize rollover. Reject Feb30/non-leap Feb29/hour24; accept actual leap date, fractional seconds và valid timezone offsets.

6. **P2-02 — Fixture hintLanguage=vi còn term/example tiếng Anh.**
   - **Exact location:** `frontend/src/features/exam/__tests__/fixtures/writingHints.ts:128–131` và các items tương tự tới `:155`.
   - **Scenario:** validWritingHintsVi đặt language vi nhưng cả năm terms/examples là English; tests còn assert ubiquitous như localized positive data. Approved 19-01 yêu cầu đối chiếu localized TV3-18 fixtures; backend prompt contract yêu cầu ALL generated fields theo hintLanguage, backend vi fixture dùng term/example tiếng Việt. Fixture hiện tại có thể làm future UI integration ghi nhãn vi trên nội dung English mà tests vẫn GREEN. Đây không phải đề xuất frontend semantic language detector.
   - **Minimal fix / regression:** Dùng vi term/example thật, đối chiếu backend fixture; assert projection bảo toàn từng field của localized fixtures, không chỉ tags/counts. Giữ English fixture cho en và explicit language override tests; không mô tả schema tests là live-model semantic verification.

7. **P2-03 — JS trim không phủ hết edge whitespace mà Java validator từ chối.**
   - **Exact location:** `frontend/src/features/exam/api/writingHintsContract.ts:153–157`.
   - **Scenario:** questionId=`\u001ctask` được frontend validator accept; Java Character.isWhitespace(U+001C)=true nên backend reject ở body validation. Probe TS và JShell xác nhận mismatch với requirement parity (`TV3-19-plan.md:117`). Invalid boundary input có thể đi qua frontend guard và chỉ fail ở HTTP; chưa có actual API ở 19-01, không khẳng định đã phát request.
   - **Minimal fix / regression:** Edge whitespace predicate khớp Java isWhitespace/isSpaceChar, reject thay vì trim/đổi ID. Cover U+001C–U+001F ở đầu/cuối và valid Unicode question IDs, max128 UTF-16 code units. Không sửa backend validator.

### Focused test evidence — independently verified

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/writingHintsContract.test.ts
```

- **Observed:** exit 0, **1 file / 34 tests PASS**, duration **3.28s**, start **14:44:45** ngày 2026-10-13. Tests import production normalizer/validator/UUID helper và fixtures; không mock implementation đang review.
- Read assertions: thiếu negative omitted-hint mismatch, configurable backend language, full grammar, success-envelope shape/type/code và calendar rollover; 5 vocabulary positive có nhưng không có 10-item positive assertion dù execution entry claim boundary coverage toàn diện. GREEN hiện tại không phủ nhận confirmed probes hoặc đồng nghĩa AC-02/03 đã đủ.
- **Independent read-only probes:** Node 24.14.1 `--experimental-strip-types --input-type=module`, import exact source `.ts` và fixture qua stdin/-e, không tạo/sửa files. Configured it response bị reject; hai implicit hint mismatches được accept; bốn malformed BCP47 requests được accept; string/null/missing envelope code và no-envelope DTO được accept; Feb30 timestamp và U+001C question boundary được accept. Probe exit 0 là completion của diagnostic script, không phải regression PASS.
- JShell dùng Java Locale.Builder xác nhận bốn malformed tags đều reject và U+001C là whitespace; không chạy backend tests, provider hoặc DB. Dùng `systematic-debugging` để tách input từng case và xác nhận source branch/root cause trước khi đề xuất minimal fixes; không triển khai sửa.
- **Executor-reported only:** 34 tests/4.36s, focused 5 files/372 tests, lint 0 errors/28 baseline warnings, build exit0/4.01s và RED missing module. Reviewer không rerun 372/lint/build/full frontend và không gọi chúng là independently verified results.
- `git diff --check` trước append exit 0; kiểm tra lại sau append cùng whitespace check untracked source/test/fixture và handoff. Reviewer giữ nguyên source/tests/plan, không commit/push.

### OUT-OF-SCOPE / next required action

- 19-02 transport/deadline/error mapping, 19-03 hook races/retry, 19-04 panel/accessibility, 19-05 workspace/submit và 19-06 rendered integration/browser/full frontend verification còn PLANNED. Không coi chúng là thiếu implementation/blockers của gate 19-01; không sửa existing Axios/interceptor/auth/Redux/autosave/draft.
- TV3-18 P2 race-test follow-up và known other TV3/backend defects không audit lại hoặc biến thành TV3-19-01 findings. `.codex/`/untracked workbook được bảo toàn; không gọi live Gemini/quota.
- **Next required action:** Sửa tối thiểu P1-01–04 và thêm focused negative regressions; nên xử lý P2-01–03 cùng contract/fixture pass. Rerun focused suite, append execution evidence rồi re-review 19-01 trước tiếp gate 19-02. Reviewer dừng sau ghi entry và báo cáo; không tự sửa implementation hoặc approved plan.

## 2026-10-13 — Codex Fixer: TV3-19-01 re-FIX sau Codex re-review

- **Agent:** Codex Fixer.
- **Scope:** SUBTASK TV3-19-01 — Typed contract, normalizer và fixtures; chỉ xử lý 4 P1 + 3 P2 đã xác nhận trong Codex re-review mới nhất. Không có P0.
- **Status:** **FIXED — sẵn sàng re-review**, không phải reviewer PASS. Gate 19-02 chưa bắt đầu.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Giữ nguyên thay đổi types sẵn có, approved plan, `.codex/`, workbook và các file ngoài phạm vi. Lưu bản trước sửa tại `%TEMP%\tv3-19-01-fix-baseline\` để đối chiếu diff.

### Findings đã xử lý

| Finding | Root cause và sửa tối thiểu | Focused regression |
| --- | --- | --- |
| P1-01 | Response dùng allowlist UI nên loại ngôn ngữ backend hợp lệ. Tách parser cú pháp khỏi kiểm tra membership: response/expected matching dùng parser; public request canonicalizer giữ catalog tám ngôn ngữ hiện có. Không mở rộng catalog; label fallback và canonical metadata được giữ. | `it`, `pt-BR` accept với default request; explicit unknown-language matching accept và mismatch reject. |
| P1-02 | Bỏ hintLanguage chỉ bỏ kiểm tra matching. Khi expected hint absent/null, bắt buộc resolved hint bằng resolved learning language. | Hai trường hợp omitted hint/omitted cả hai: matching accept, mismatch reject; explicit en→vi vẫn accept. |
| P1-03 | Loop segment không kiểm tra thứ tự/số lượng. Parser kiểm tra toàn tag theo primary → optional single script → optional single region; giữ aliases/casing, reject variants/extensions/private-use. | Bốn tags review reject ở request và response; valid script, region, numeric region và casing accept. |
| P1-04 | Gate success tùy chọn và cho phép raw DTO. Public normalizer bắt buộc object envelope có numeric code===200 và object data trước projection. | Error/string/null/missing code, missing/null/array data và raw DTO reject; numeric 200 accept. Các test body đều đi qua envelope thật. |
| P2-01 | Date.parse tự rollover ngày/thời gian sai. Kiểm tra ngày theo tháng/năm nhuận, giờ/phút/giây và offset trước Date.parse; không đổi timestamp. | Feb30, non-leap Feb29, 1900, April31, hour24 và invalid time/offset reject; leap2000/2024, fractional seconds và valid offsets được giữ nguyên. |
| P2-02 | Fixture vi chứa nội dung Anh. Đồng bộ toàn bộ generated fields với `backend/src/test/resources/fixtures/writing-hints-vi.json`; không thêm semantic detector. | Literal vi terms/examples và projection toàn bộ generated fields của en/vi/fr được assert; deep-copy và vocabulary 10-item boundary vẫn được kiểm tra. |
| P2-03 | JS trim không tương đương Java edge whitespace. Predicate khớp Character.isWhitespace/isSpaceChar ở đầu/cuối; reject thay vì trim, giữ UTF-16 max128. | U+001C–U+001F và space separators ở hai đầu reject; Unicode/emoji IDs, boundary128 và valid interior characters/FEFF giữ parity. |

### Files sửa trong lần re-FIX

- `frontend/src/features/exam/api/writingHintsContract.ts`: parser/gates/date/ID corrections trên; không đổi transport hoặc public DTO types.
- `frontend/src/features/exam/__tests__/writingHintsContract.test.ts`: focused regressions, sửa direct-DTO positive trái contract, tổng **90 tests**.
- `frontend/src/features/exam/__tests__/fixtures/writingHints.ts`: localized vi fixture.
- `docs/superpowers/plans/ndt/TV3-19-handoff.md`: append entry này, giữ lịch sử.

### Verification — thực chạy bởi Fixer

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/writingHintsContract.test.ts
npm test -- src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/attemptApi.test.ts
npm run lint
npm run build
```

- **RED trước sửa production/fixture:** focused suite exit1, **30 failed / 59 passed**, start **15:01:12**, duration **4.34s**; lỗi assertion tái hiện các nhóm findings, không phải lỗi setup/module. Log `%TEMP%\tv3-19-01-red.log`.
- **GREEN sau sửa:** focused suite exit0, **89/89**, start **15:05:14**, duration **3.82s**. Log `%TEMP%\tv3-19-01-green.log`. Sau đó bổ sung explicit unknown-language mismatch negative, nâng focused suite lên 90.
- **Final regression:** exit0, **5 files / 428 tests PASS** (90 writing-hints + 338 existing), start **15:07:56**, duration **7.82s**, ngày 2026-10-13. Log `%TEMP%\tv3-19-01-regression.log`. Import production implementation; không mock parser/normalizer đang sửa.
- **Final lint:** exit0, **0 errors / 28 warnings baseline**, không có warning ở writing-hints files. Warning mới do control-character regex đã được sửa bằng numeric ranges, không suppress. Log `%TEMP%\tv3-19-01-lint.log`.
- **Final build:** exit0, `tsc -b && vite build`, Vite **2.23s**; còn warning chunk >500kB baseline. Log `%TEMP%\tv3-19-01-build.log`.
- **Diff/whitespace:** `git diff --check` exit0 trước append; kiểm tra lại sau append và đối chiếu ba source/test/fixture files với baseline. Không commit/push.

### AC / giới hạn / next action

- **AC-02:** request IDs/UUID/optional languages, response identity/shape, strict grammar, calendar timestamp và success envelope được kiểm tra qua production contract.
- **AC-03:** giữ catalog tám ngôn ngữ; backend-resolved metadata ngoài catalog hợp lệ được accept; default hint, explicit override/matching và localized fixtures được kiểm tra, không thêm English fallback.
- **AC-05 (phần gate-01):** projection bảo toàn đầy đủ outline/vocabulary/limitations, deep-copy và shape/cap regressions đã chạy. Chưa xác minh UI rendering/text safety; phần đó thuộc các gate panel/integration sau, không thay thế rendered/browser/full frontend verification.
- Không còn confirmed in-scope findings chưa xử lý trong entry review này. Chưa xác minh semantic language của live-model output; đó là giới hạn staging, không phải frontend semantic-detector requirement. Không gọi provider/quota, backend/DB, không sửa 19-02–06 hoặc approved plan.
- **Next required action:** Codex Reviewer re-review TV3-19-01 trên diff và regression evidence này trước gate 19-02. Fixer dừng để re-review.

## 2026-10-13 — Codex Reviewer: TV3-19-01 re-review sau re-FIX

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-19-01 — Typed contract, normalizer và fixtures; đối chiếu approved plan, entry re-FIX và toàn bộ thay đổi thuộc gate này, gồm files untracked. Không nghiệm thu toàn feature TV3-19.
- **Decision:** **PASS**.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Tracked diff chỉ thêm public WritingHints types tại `frontend/src/features/exam/types/api.types.ts:242`; đọc trực tiếp normalizer, focused tests và fixtures untracked. Không sửa production code, tests hoặc approved plan.

### IN-SCOPE — kết quả đối soát findings

Không còn confirmed P0/P1/P2 trong phạm vi được review. Bảy findings của review trước đã đóng:

| Finding trước | Vị trí hiện tại và bằng chứng đóng |
| --- | --- |
| P1-01 — loại backend language ngoài UI catalog | `frontend/src/features/exam/api/writingHintsContract.ts:243`: response dùng parser cú pháp độc lập với catalog. Tests accept `it`/`pt-BR` cho default, reject mismatch explicit; probe độc lập xác nhận explicit `pt-BR` matching. |
| P1-02 — hint mặc định không khớp learning | `frontend/src/features/exam/api/writingHintsContract.ts:263`: omitted/null hint bắt buộc bằng resolved learning; negative cho omitted hint/cả hai/null và positive explicit en→vi đều chạy. |
| P1-03 — grammar script/region sai | `frontend/src/features/exam/api/writingHintsContract.ts:117`: chỉ một primary, optional script rồi optional region. Regression reject bốn chuỗi sai trước ở cả request/response, giữ tags script/region/numeric region hợp lệ. |
| P1-04 — success envelope tùy chọn | `frontend/src/features/exam/api/writingHintsContract.ts:219`: bắt buộc numeric code 200 và object data. Tests reject error/string/null/missing code, missing/null/array data và raw DTO; body tests vẫn đi qua public envelope gate thật. |
| P2-01 — timestamp rollover | `frontend/src/features/exam/api/writingHintsContract.ts:52`: kiểm tra calendar/leap year/time/offset trước Date.parse; tests ngày không tồn tại/hour24 reject, leap/fractional/timezone hợp lệ giữ nguyên. |
| P2-02 — fixture vi chứa generated content Anh | `frontend/src/features/exam/__tests__/fixtures/writingHints.ts:88`: đối chiếu trực tiếp outline/vocabulary/limitations với localized fixture TV3-18; tests assert terms/examples tiếng Việt và bảo toàn mọi generated field en/vi/fr. |
| P2-03 — question-ID edge whitespace khác Java | `frontend/src/features/exam/api/writingHintsContract.ts:39` và `:159`: predicate khớp Character.isWhitespace/isSpaceChar; regressions U+001C–U+001F/space separators hai đầu, Unicode/emoji và 128 UTF-16 units chạy trực tiếp production validator. |

### Verified acceptance criteria

- **AC-02 — đạt phần gate-01:** typed DTO khớp backend; IDs/UUID, optional-language omission, request allowlist/freeze, numeric-success envelope, identity matching, timestamp và shape/text/count bounds. Không đọc/gửi essay, answer, owner hoặc private fields; projection chỉ giữ public fields.
- **AC-03 — đạt phần gate-01:** tám base languages, aliases/casing/script/region; backend-resolved tag ngoài catalog hợp lệ; explicit matching và default hint equality, không English fallback.
- **AC-05 — đạt phần gate-01:** giữ nguyên generated text, đầy đủ outline/vocabulary/limitations và deep-copy; không áp provider-output 32 KiB lên envelope. Chưa đánh giá rendering/XSS của panel vì gate-04 chưa triển khai.
- Không phát hiện refactor, dependency/backend/shared API changes hoặc persistence ngoài scope. UUID dùng Web Crypto, thiếu hỗ trợ báo lỗi cố định; errors không lấy backend message/raw payload.

### Focused verification — Reviewer thực chạy

- Tại `frontend/`: `npm test -- src/features/exam/__tests__/writingHintsContract.test.ts` — **exit0, 1 file / 90 tests PASS**, start **15:27:21**, duration **14.34s**, ngày 2026-10-13. Tests import implementation production; không mock normalizer/parser/validator.
- Node stdin probes import `.ts` production trực tiếp (`node --experimental-strip-types --input-type=module -e ...`), không tạo/sửa file — **exit0, 5/5 nhóm PASS**: positive Java ID 1/max; request allowlist/freeze/default omission; explicit unknown-catalog matching; definition/explanation 1001 reject; mọi text/count ở max, envelope >32 KiB, không mutate input và deep-copy hai chiều.
- `git diff --check` — **exit0**. Với bốn files normalizer/test/fixture/handoff untracked, kiểm tra sau append bằng `git -c core.autocrlf=false -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --no-index --check -- NUL <file>` — **không có whitespace diagnostics**. Lần kiểm tra không cấu hình `cr-at-eol` báo CR của các dòng CRLF là trailing whitespace; không phải finding chức năng. Không coi ordinary tracked diff là đã bao phủ untracked content.
- **Chỉ do Fixer báo cáo, không chạy lại trong review:** RED 30 failed/59 passed; regression 5 files/428 tests PASS; lint 0 errors/28 baseline warnings; build PASS. Không dùng các kết quả đó làm bằng chứng Reviewer đã thực chạy. Không chạy full frontend/backend suite, browser, DB hoặc provider/quota thật.

### OUT-OF-SCOPE / giới hạn và next action

- `.codex/` và `backend/Exam_Template.xlsx` là thay đổi ngoài gate, giữ nguyên; không audit hoặc xác nhận tính đúng đắn.
- TV3-19-02–06 (transport/error mapping, hook/race, panel, workspace và integration/browser verification) chưa triển khai; không phải blocker của gate-01. Semantic language của live-model output không được chứng minh bằng fixtures và không thuộc frontend semantic-detector requirement.
- **Next required action:** có thể triển khai TV3-19-02 theo approved plan; gate-01 không cần fix thêm. Reviewer chỉ append entry này, không commit/push; dừng sau báo cáo.

---

## 2026-10-13 — TV3-19-02 Execution Evidence

- **Subtask:** TV3-19-02 — Bounded hints API và safe error mapping.
- **Dependency:** TV3-19-01 (PASS trong Codex re-review).
- **Status:** IMPLEMENTED.
- **Tập tin tạo mới / chỉnh sửa:**
  - `frontend/src/features/exam/types/api.types.ts` (Chỉnh sửa: thêm interface `WritingHintsFailure` với action, kind, retryAt, message).
  - `frontend/src/features/exam/utils/writingHintsErrors.ts` (Tạo mới: `classifyWritingHintsError(error, nowMs): WritingHintsFailure`, parser `parseRetryAfter` hỗ trợ plain headers và AxiosHeaders 1–3600s, fallback 10s cho mã 1604/1606, mapping an toàn tách biệt HTTP status và business code 1604–1609, 100% fixed safe UI copy không phản chiếu backend error message hay stack trace).
  - `frontend/src/features/exam/__tests__/writingHintsErrors.test.ts` (Tạo mới: 23 unit tests kiểm thử toàn diện mọi mã HTTP status, business codes 1604/1605/1606/1607/1608/1609/429, Retry-After header parsing và fallback).
  - `frontend/src/features/exam/api/attemptApi.ts` (Chỉnh sửa: thêm optional `timeoutMs` vào private `boundedAttemptRequest` với giá trị mặc định `WRITE_TIMEOUT_MS = 10_000`, export `HINTS_TIMEOUT_MS = 150_000` và `WritingHintsContractError`, triển khai `generateWritingHints(attemptId, req, options)` với pre-validation, strict payload allowlist loại bỏ essay/answer/extra properties, Axios timeout 150s, deadline promise 150s và response normalization).
  - `frontend/src/features/exam/__tests__/attemptApi.test.ts` (Chỉnh sửa: thêm 30 unit tests cho `generateWritingHints` kiểm thử endpoint, timeout, payload allowlist, fail-fast input validation, response error envelope, HTTP error preservation, 150s whole-request deadline cancellation, external AbortSignal cleanup và caller mutation immutability).
  - `docs/superpowers/plans/ndt/TV3-19-plan.md` & `docs/superpowers/plans/ndt/TV3-19-handoff.md` (Chỉnh sửa: hoàn thành checklist TV3-19-02, cập nhật status table sang IMPLEMENTED).

- **Chi tiết Acceptance Criteria (AC):**
  - **AC-02 (Bounded API & allowlist payload):** Request POST `/v1/attempts/:id/writing-hints` chỉ gửi `partId`, `questionId`, `requestId` và optional language fields (`learningLanguage`, `hintLanguage`). Tuyệt đối không gửi `essay`, `answer`, `prompt`, `correctAnswer` hoặc bất kỳ trường nào ngoài allowlist. Phản hồi được chuẩn hóa nghiêm ngặt bằng `normalizeWritingHints`.
  - **AC-04 (Bounded timeout & deadline isolation):** API gợi ý sử dụng deadline 150.000 ms (`HINTS_TIMEOUT_MS`), bao gồm cả thời gian chờ trong hàng đợi interceptor. Các API hiện có (`autosaveAnswers`, `submitAttempt`, `getAttemptResult`, `getAttemptReview`, `checkPracticeAnswer`) giữ nguyên deadline `WRITE_TIMEOUT_MS = 10_000` mặc định không bị ảnh hưởng. Dọn dẹp sạch sẽ timer và AbortSignal listener khi settle hoặc cancel.

- **Kết quả kiểm thử thực tế (Verification Evidence):**
  1. **TDD Red Phase:**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/attemptApi.test.ts`
     - Kết quả: 30 tests thất bại do `generateWritingHints is not a function`.
  2. **TDD Green Phase (Unit & Error Mapping):**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts`
     - Kết quả: **251 tests PASS** (3 test files passed: attemptApi.test.ts 138/138, writingHintsErrors.test.ts 23/23, writingHintsContract.test.ts 90/90).
  3. **Contract Regression Suite:**
     - Lệnh chạy: `npm test -- --run src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/reviewContract.test.ts`
     - Kết quả: **230 tests PASS** (3 test files passed, 0 failures, 0 errors).
  4. **Linting Check:**
     - Lệnh chạy: `npm run lint`
     - Kết quả: exit code 0, 0 errors, 28 baseline warnings (không phát sinh warning mới).
  5. **TypeScript & Build Verification:**
     - Lệnh chạy: `npm run build`
     - Kết quả: exit code 0, Vite build hoàn tất trong 3.34s.
  6. **Whitespace & Diff Integrity:**
     - Lệnh chạy: `git diff --check`
     - Kết quả: exit code 0, không có trailing whitespace hay newline lỗi.

## 2026-10-13 — Codex Reviewer: TV3-19-02 re-review

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-19-02 — Bounded hints API và safe error mapping, latest entry IMPLEMENTED; dependency gate-01 đã PASS. Đọc approved plan, handoff, staged/unstaged diff và files untracked thuộc scope. Đây không phải nghiệm thu toàn feature.
- **Decision:** **NEED_FIX** — còn **1 P1**, thêm **1 P2** non-blocking; không có confirmed P0.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Review thay đổi `attemptApi.ts`, phần `WritingHintsFailure` mới trong types, tests API và hai files errors untracked; giữ nguyên work gate-01, plan và mọi file ngoài scope.

### Verified acceptance criteria

- **AC-02 — đạt phần gate-02:** POST đúng `/v1/attempts/<id>/writing-hints`; validate trước HTTP; payload chỉ IDs/UUID/optional canonical languages, omit defaults; capture request độc lập với caller mutation; dùng normalizer production thật trước trả data. Không gửi essay/answer/private fields, không ghi Redux/draft/storage hoặc log payload.
- **AC-04 — đạt phần bounded transport:** Axios timeout và promise deadline 150.000 ms, bao gồm transport/interceptor không settle; external abort/pre-aborted signal, late settlement và timer/listener cleanup. Default private helper và config API cũ vẫn 10.000 ms; focused API regression chạy lại.
- **Safe error mapping — chưa đạt đầy đủ:** status và numeric business code được tách; pending/conflict/ended, cooldown/quota, language/access và transient errors có fixed copy, không phản chiếu message backend. Context recovery action sai (P1); valid server backoff dài bị thay đổi (P2).
- Không thêm application retry/polling, UUID mới, backend/shared Axios/auth/dependency changes. Hook/UI access guards và single-flight mutex thuộc gates sau, không phải blocker hiện tại.

### IN-SCOPE — confirmed actionable findings

**P1-01 — Context/validation errors không cung cấp action reload theo contract.**

- **Vị trí:** `frontend/src/features/exam/utils/writingHintsErrors.ts:128`, `:135`, `:153` (HTTP 422 code 1609, 422 validation khác, và HTTP 413).
- **Failure scenario:** backend trả 422/1609 do snapshot context không khả dụng, 422/422 validation hoặc 413/1611. Classifier trả `kind: context, action: none`, trái bảng lỗi approved plan yêu cầu reload cho 404/422 context-validation/413 (chỉ 1607–1608 đổi language). Consumer dựa vào action không nhận được bước phục hồi, dù không được lặp payload lỗi. Không cần chờ UI triển khai để xác định contract trả về sai.
- **Minimal fix:** trả `action: reload` và fixed message hướng dẫn tải lại cho ba nhánh trên; giữ 1607/1608 `change-language`, không retry payload lỗi hoặc thay UUID.
- **Focused regression:** sửa assertions đang khóa behavior sai tại `frontend/src/features/exam/__tests__/writingHintsErrors.test.ts:179`, `:195`, `:225`; assert 422/1609, 422/422, 413/1611 và 404 đều reload, retryAt null, không chứa backend sentinel; 422/1607–1608 vẫn change-language.

**P2-01 — Parser tự áp trần 3.600 giây, rút ngắn Retry-After hợp lệ thành 10 giây.**

- **Vị trí:** `frontend/src/features/exam/utils/writingHintsErrors.ts:32`, `:41`.
- **Failure scenario:** `Retry-After: 7200` trong HTTP 429/1606 bị coi invalid và `retryAt = nowMs + 10_000`. Backend cho cấu hình `testing.writing-hints.min-interval` bằng Duration (`WritingHintsProperties.java:17`, `application.properties:52`) và trả số giây còn lại qua controller, không có contract trần một giờ. Nếu cấu hình cooldown dài, client mở lại actions sớm hơn policy máy chủ; backend vẫn chặn nên không phải bypass quota/security.
- **Minimal fix:** parse delta-seconds dạng số nguyên với arithmetic hữu hạn/an toàn cho retryAt; không tự thay giá trị hợp lệ >3.600 bằng fallback ngắn. Fallback 10 giây chỉ cho missing/malformed header theo plan.
- **Focused regression:** dùng plain headers và AxiosHeaders thật cho 3.600/3.601/7.200, assert giữ server delay; giữ negative/malformed/overflow cases. Thay assertion coi mọi giá trị >3.600 là invalid tại `frontend/src/features/exam/__tests__/writingHintsErrors.test.ts:335`.

### Focused verification — Reviewer thực chạy

- Tại `frontend/`: `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts` — **exit0, 3 files / 251 tests PASS** (138 API + 23 errors + 90 contract), start **16:03:33**, duration **6.93s**, ngày 2026-10-13.
- Tests import API/helper/normalizer/classifier production; chỉ mock shared HTTP client và thời gian cho deadline cases. Tests PASS không chứng minh bảng lỗi đúng vì các assertions 422/413 đang yêu cầu `none`; header tests cũng khóa trần một giờ chưa được plan chấp thuận.
- Node stdin + Vite `ssrLoadModule` đọc classifier production, không sửa source/test: **exit0**, tái hiện action `none` cho 422/1609, 422/422, 413 (nhánh chỉ xét status), trong khi 422/1607 đúng change-language và 404 đúng reload. Message không chứa sentinel. Với **AxiosHeaders thật**, header `7200` cho delay **10s**, `25` cho **25s**, malformed cho fallback **10s**. Đây là diagnostic output, không phải một regression suite PASS cho yêu cầu đang sai.
- `git diff --check` — **exit0**; warning LF→CRLF ở `attemptApi.ts` không phải functional finding. Kiểm tra whitespace CRLF-aware riêng files errors/handoff untracked sau append.
- **Chỉ Executor báo cáo, không độc lập chạy lại:** RED 30 tests fail, regression contracts 230 PASS, lint 0 errors/28 baseline warnings, build PASS. Không chạy full frontend/backend suites, browser, DB, live provider hoặc quota thật.

### OUT-OF-SCOPE / next required action

- `.codex/`, `backend/Exam_Template.xlsx` và work gate-01 được giữ nguyên, không chuyển thành findings gate-02. Shared auth refresh/replay là behavior hiện có được plan yêu cầu giữ; không mở rộng audit hoặc sửa interceptor.
- TV3-19-03–06 còn PLANNED: scoped hook, UUID retry operations, UI, workspace integration và browser/full regression chưa được nghiệm thu; không dùng phần chưa triển khai để reject gate-02.
- **Next required action:** sửa P1-01 và regression expectations, nên xử lý P2-01 cùng đợt; chạy focused API/errors/contract tests rồi yêu cầu re-review trước gate-03. Reviewer chỉ append handoff; không sửa code/tests/approved plan, commit hoặc push; dừng sau báo cáo.

## 2026-10-13 — Codex Fixer: TV3-19-02 re-FIX sau Codex re-review

- **Agent:** Codex Fixer.
- **Scope:** TV3-19-02 — Bounded hints API và safe error mapping; chỉ sửa **P1-01 + P2-01** đã xác nhận trong review mới nhất. Không có P0.
- **Status:** **FIXED — sẵn sàng re-review**, chưa phải reviewer PASS. Không bắt đầu gate 19-03.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Các thay đổi API/types/tests sẵn có và files untracked được ghi nhận trước sửa. Bản sao classifier/test/handoff và SHA256 manifest lưu tại `%TEMP%\tv3-19-02-fix-baseline-20261013-163426\`.

### Findings / root causes / corrections

1. **P1-01 — Context/validation recovery action sai:** nhánh HTTP 422/1609, 422 validation khác và 413 trả `action: none`, dù approved error table yêu cầu reload. Đổi đúng ba nhánh sang `action: reload`, thêm hướng dẫn tải lại trong fixed UI copy, giữ `retryAt: null`. Giữ 404 reload và 422/1607–1608 change-language; không retry payload lỗi, không đổi UUID hoặc phản chiếu backend message.
   - Regression cập nhật assertions trước đây khóa behavior sai, kiểm tra 422/1609, 422/422, 413/1611 và 404 có reload + hướng dẫn tải lại + retryAt null; backend sentinel không xuất hiện trong message. Hai language codes vẫn change-language và không lộ sentinel.
2. **P2-01 — Retry-After bị áp trần một giờ ngoài contract:** cả numeric/string parser loại mọi giá trị >3600 và fallback 10 giây. Backend min-interval là configurable Duration; controller trả remaining seconds, không có trần một giờ. Bỏ cap 3600, chỉ nhận số nguyên dương an toàn và kiểm tra phép nhân milliseconds/cộng nowMs đều nằm trong miền safe integer. Truyền nowMs vào private parser để kiểm tra tổng trước khi tạo retryAt; không thêm trần policy mới.
   - Regression dùng plain string/numeric headers và **AxiosHeaders thật** cho 3600/3601/7200/999999 và biên tổng safe integer, ở cả pending 409/1604 và cooldown 429/1606. Missing/malformed/negative/nonfinite/unsafe seconds, multiplication overflow và addition overflow vẫn fallback 10 giây. Assertions dùng các mốc retryAt tính độc lập, không gọi helper production để tính expected.

### Files sửa / refactoring

- `frontend/src/features/exam/utils/writingHintsErrors.ts`: hai corrections trên; chỉ bổ sung nowMs cho private parser để kiểm tra arithmetic an toàn. Không refactor ngoài fix.
- `frontend/src/features/exam/__tests__/writingHintsErrors.test.ts`: cập nhật error recovery assertions, thay get-method double bằng AxiosHeaders thật, thêm backoff boundary/overflow regressions; tổng **54 tests**.
- `docs/superpowers/plans/ndt/TV3-19-handoff.md`: append entry này, bảo toàn lịch sử.

Không sửa `attemptApi.ts`, API tests, public types, normalizer/fixtures gate-01, approved plan, shared Axios/auth, backend, dependencies hoặc work của gates khác. Kiểm tra SHA256 các files có sẵn ngoài ba paths trên so với manifest trước sửa.

### Verification — Fixer thực chạy

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/writingHintsErrors.test.ts
npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/reviewContract.test.ts
npm run lint
npm run build
```

- **RED trước sửa production:** exit1, **15 failed / 39 passed**, start **16:35:17**, duration **2.41s**. Các assertion thất bại đúng vì action none và server delays >3600 bị thay bằng fallback; không phải lỗi setup/module. Log `%TEMP%\tv3-19-02-red.log`.
- **GREEN focused:** exit0, **54/54 tests**, start **16:35:42**, duration **1.82s**. Log `%TEMP%\tv3-19-02-green.log`.
- **Final related regression:** exit0, **6 files / 512 tests PASS** (138 API + 54 errors + 90 writing-hints contract + 230 existing contracts), start **16:36:59**, duration **4.80s**, ngày 2026-10-13. Log `%TEMP%\tv3-19-02-regression.log`. Classifier/normalizer là implementation production; API suite chỉ mock HTTP boundary/time theo tests hiện có.
- **Final lint:** exit0, **0 errors / 28 baseline warnings**, không có warning mới ở writing-hints files. Log `%TEMP%\tv3-19-02-lint.log`.
- **Final build:** exit0, `tsc -b && vite build`, Vite **2.15s**; còn chunk >500kB warning baseline. Log `%TEMP%\tv3-19-02-build.log`. Build đầu phát hiện TS2345 ở constructor AxiosHeaders trong test mới với null/undefined; đã dùng empty AxiosHeaders cho missing headers và rerun regression/lint/build trên test đã sửa.
- **Diff/whitespace:** `git diff --check` exit0 trước append; CRLF-aware no-index whitespace check classifier/test so với baseline không có diagnostics. Kiểm tra lại cả handoff sau append, prefix lịch sử và SHA256 ngoài scope. Warning LF→CRLF của `attemptApi.ts` là Git line-ending warning ở file có sẵn; file này không bị sửa trong lần fix.

### AC / remaining / next required action

- **AC-02:** error recovery đúng các HTTP/business code context-validation và language, fixed copy không phản chiếu backend payload; API endpoint/allowlist/normalization regressions vẫn PASS.
- **AC-04:** giữ server backoff hợp lệ mà không rút xuống 10 giây; fallback chỉ cho header thiếu/sai/không thể tính an toàn. API deadline 150s, external cancellation/cleanup và deadline 10s của các API cũ được kiểm tra qua API suite hiện có; không đổi transport.
- Không còn confirmed in-scope P0/P1/P2 chưa xử lý từ review này. Không chạy full frontend/backend suite, browser, DB, live provider/quota: đây là focused gate-02 fix; master request không yêu cầu full suite, gates UI/integration sau chưa triển khai. Không claim live cooldown policy đã được kiểm thử end-to-end.
- Không commit/push, không sửa approved plan hoặc tự gán PASS.
- **Next required action:** Codex Reviewer re-review TV3-19-02 trên diff và evidence này trước gate 19-03. Fixer dừng để re-review.

## 2026-10-13 — Codex Reviewer: TV3-19-02 re-review sau re-FIX

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-19-02 — Bounded hints API và safe error mapping; đối chiếu approved plan, latest re-FIX entry, staged/unstaged diffs và files untracked liên quan. Dependency TV3-19-01 đã PASS; đây không phải nghiệm thu toàn feature.
- **Decision:** **PASS**.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Đọc diff API/types/API tests và trực tiếp classifier/errors tests untracked. Không sửa code, tests, approved plan hoặc work ngoài scope.

### IN-SCOPE — findings và verified acceptance criteria

- **P1-01 trước — CLOSED:** `frontend/src/features/exam/utils/writingHintsErrors.ts:134`, `:141`, `:159` trả `action: reload`, `retryAt: null` và fixed copy hướng dẫn tải lại cho 422/1609, 422 validation khác và 413. Tests không còn assert behavior sai; probes xác nhận 404 cũng reload, 422/1607–1608 vẫn change-language và không lộ backend sentinel.
- **P2-01 trước — CLOSED:** `frontend/src/features/exam/utils/writingHintsErrors.ts:33`, `:45` bỏ cap 3.600 giây; kiểm tra safe integer cho seconds, milliseconds và tổng retryAt. Plain string/numeric headers và AxiosHeaders thật giữ server delays 3.600/3.601/7.200/999.999 ở cả pending/cooldown; malformed/overflow vẫn fallback 10s.
- **Confirmed findings còn lại:** không có P0/P1/P2 actionable trong scope được review; không có fix bổ sung bắt buộc.
- **AC-02 — đạt phần gate-02:** đúng endpoint/DTO; validate trước HTTP; payload allowlist, omitted defaults, captured identity không bị caller mutation; normalizer production kiểm tra envelope/response trước trả data. HTTP errors được giữ cho classifier; fixed UI copy không lấy raw backend message hoặc stack.
- **AC-04 — đạt phần gate-02:** Axios timeout/promise deadline 150.000 ms, kể cả transport/interceptor không settle; external/pre-aborted signals, late settlement và timer/listener cleanup. APIs cũ giữ default 10.000 ms; mapping phân biệt HTTP/business codes, pending/conflict/ended, cooldown/quota, language/context/access và transient errors, giữ Retry-After hợp lệ. Không thêm application auto-retry/polling hoặc UUID mới.
- Không có backend/shared Axios/auth/dependency changes hoặc answer/Redux/draft/storage mutation trong thay đổi gate-02. Single-flight controller, retry operation và UI clearing chưa thuộc gate này.

### Focused verification — Reviewer thực chạy

- Tại `frontend/`: `npm test -- src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts` — **exit0, 3 files / 282 tests PASS** (138 API + 54 errors + 90 contract), start **16:40:19**, duration **2.40s**, ngày 2026-10-13. Tests import implementation production; API suite chỉ mock HTTP boundary/time, errors suite dùng cả AxiosHeaders thật.
- Node stdin với Vite `ssrLoadModule` import classifier production, không tạo/sửa source/test — **exit0, 43/43 cases PASS**: 6 context/language recovery cases; 24 server-delay/plain/AxiosHeaders cases; 10 malformed/overflow fallback cases; 3 HTTP/business-code isolation cases. Assertions kiểm tra exact actions/retryAt và không lộ sentinel, không mock classifier.
- `git diff --check` — **exit0**. Kiểm tra riêng classifier/errors tests/handoff untracked bằng CRLF-aware no-index whitespace check sau append; warning LF→CRLF của tracked `attemptApi.ts` không phải functional finding.
- **Chỉ Fixer báo cáo, không chạy lại trong review:** RED 15 failed/39 passed; related regression 6 files/512 PASS; lint 0 errors/28 baseline warnings; build PASS. Không coi các kết quả đó là Reviewer-run evidence. Không chạy full frontend/backend suite, browser, DB hoặc live provider/quota.

### OUT-OF-SCOPE / next required action

- Giữ nguyên `.codex/`, `backend/Exam_Template.xlsx`, dependency gate-01 và work khác; không audit hoặc biến chúng thành blockers gate-02. Shared auth refresh/replay là behavior hiện có được plan yêu cầu giữ, không mở rộng review interceptor.
- TV3-19-03–06 còn PLANNED: scoped hook/race/retry operations, UI, workspace và integration/browser/full verification chưa được nghiệm thu; không phải lỗi của subtask đã hoàn thành.
- **Next required action:** có thể triển khai TV3-19-03 theo approved plan; gate-02 không cần fix thêm. Reviewer chỉ append entry này, giữ lịch sử; không commit/push và dừng sau báo cáo.

## 2026-10-13 — Codex Implementer: TV3-19-03 IN_PROGRESS

- **Agent:** Codex Implementer.
- **Task/subtask:** TV3-19-03 — Scoped hints controller và idempotent retry.
- **Status:** IN_PROGRESS.
- **Scope:** chỉ tạo `useWritingHints.ts`, `useWritingHints.test.tsx` và append handoff; không sửa approved plan, API/contract gates 01–02, UI hoặc workspace integration.
- **Prerequisites:** latest Reviewer TV3-19-02 PASS; gate-01 PASS. Baseline HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`, staged rỗng; existing tracked/untracked work được giữ nguyên. SHA256 manifest và bản sao lịch sử handoff lưu tại `%TEMP%/tv3-19-03-baseline-20261013/`.
- **Execution:** inline với executing-plans, test-driven-development và verification-before-completion; approved plan/handoff là brief/ledger. User yêu cầu focused verification và stop for review, không commit/push; không full suite/backend test hoặc tự review/đánh dấu PASS toàn feature.
- **Next action:** tests guards/mutex/immutable retry/lifecycle trước production logic, RED → GREEN, focused regressions và append kết quả.

## 2026-10-13 — Codex Implementer: TV3-19-03 IMPLEMENTED

- **Agent:** Codex Implementer.
- **Task/subtask:** TV3-19-03 — Scoped hints controller và idempotent retry.
- **Status:** **IMPLEMENTED — chờ Codex Reviewer**, chưa phải review PASS hoặc nghiệm thu toàn feature.
- **Approved plan:** `docs/superpowers/plans/ndt/TV3-19-plan.md`, riêng mục 19-03; dependency gates 19-01 và 19-02 có latest Reviewer PASS.
- **Baseline:** HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`, staged rỗng. Không commit/push, rebase, stage hoặc tạo workspace khác; giữ nguyên dirty/untracked work theo yêu cầu.

### Implementation summary / files

- **Tạo `frontend/src/features/exam/hooks/useWritingHints.ts`:** public interfaces đúng plan; state/operations chỉ trong memory, keyed theo part/question dưới attempt + Redux context revision. Dùng API/normalizer/classifier production của gates 01–02; không thêm implementation transport khác.
- Guards kiểm tra live workspace/store: persisted workspace identity khớp Redux, Practice/IN_PROGRESS, positive Java IDs, selected ESSAY tồn tại duy nhất trong snapshot Writing part, section/part/question membership không trùng, section chưa locked và synchronous submission/store lock. Đọc canonical grouped snapshot trước flat compatibility view theo convention WorkspacePage, chỉ dùng recorded IDs; không fallback ID theo ordering.
- Mutex ref được đặt trước UUID/await; double generate hoặc hai ESSAY cạnh tranh chỉ tạo một UUID/POST. Operation chứa frozen validated payload/selection; retry giữ payload/UUID kể cả caller đổi selection hoặc preference được backend resolve. Generate thủ công mới dùng UUID mới; confirmation UI thuộc 19-04.
- Lifecycle dùng flight object identity + context epoch và AbortController. Subscription Redux phát hiện hydration/attempt change/lock ngay; layout synchronization xử lý route/part/metadata/section/terminal status. Part switch và suspend hủy client wait, giữ operation trong context để retry thủ công. Attempt/hydration/unmount xóa operations/state; stale catch/finally không sửa hoặc giải phóng flight mới. Không tự resume sau unlock/submit failure.
- Backoff pending/cooldown áp dụng toàn controller; timer chỉ cập nhật countdown, không gửi HTTP. Quota/context/access/ended/conflict block đến authoritative hydration/reload; access/ended/conflict xóa hints cũ. Language lỗi yêu cầu operation mới, không replay payload lỗi hoặc fallback English. Network/contract failure cho retry cùng operation; tạo mới thất bại giữ bộ hints trước và error, labels vẫn theo response cũ.
- **Tạo `frontend/src/features/exam/__tests__/useWritingHints.test.tsx`:** **64 tests**, dùng hook/API/normalizer/classifier/answer reducer thật; chỉ mock HTTP boundary, spy UUID/storage và điều khiển fake timers/deferred promises. Kiểm tra request payload thực tại HTTP boundary và state công khai, không mock hints controller.
- **Append `docs/superpowers/plans/ndt/TV3-19-handoff.md`:** IN_PROGRESS và entry IMPLEMENTED này; lịch sử cũ giữ nguyên byte prefix.

### Verification — Implementer thực chạy

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/useWritingHints.test.tsx
npm test -- src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/usePracticeFeedback.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
npm run lint
npm run build
```

- **RED:** interface-only inactive scaffold, exit1, **39 failed / 25 passed**, start **16:59:14**, duration **2.12s**. Failures do chưa có generation/retry/lifecycle/error behavior và không có expected HTTP request; một số dependent assertions không đọc được HTTP call chưa tồn tại. Không phải module/setup lỗi. Guard no-POST cases trên scaffold tự pass nên chỉ được chứng minh bằng GREEN khi generation hoạt động. Log `%TEMP%/tv3-19-03-red.log`.
- **GREEN focused:** exit0, **64/64 tests**, start **17:01:02**, duration **2.19s**. Log `%TEMP%/tv3-19-03-green.log`.
- **Final related regression:** exit0, **8 files / 414 tests PASS**, start **17:03:54**, duration **10.12s**. Bao gồm 64 hook + 282 hints API/errors/contract + 68 Practice feedback/workspace/autosave-submit/resume tests. Part A→B→A test được tăng cường để flight mới bắt đầu trước khi old hook finally settle. Log `%TEMP%/tv3-19-03-regression.log`.
- **Final lint:** exit0, **28 baseline warnings / 0 errors**, không có warning ở hook/test mới. Lần đầu có warning về ref trong effect cleanup; đã đưa context cleanup vào callback và rerun lint/regressions/build. Log `%TEMP%/tv3-19-03-lint.log`.
- **Final build:** exit0, `tsc -b && vite build`; Vite **1.21s**. Còn bundle >500 kB warning baseline. Log `%TEMP%/tv3-19-03-build.log`.
- **Integrity:** `git diff --check` và CRLF-aware no-index whitespace checks hai files mới + appended handoff; SHA256 toàn bộ baseline paths ngoài handoff không đổi, approved plan/API/types/classifier/tests gates trước giữ nguyên. Handoff history byte prefix được đối chiếu với bản sao `%TEMP%/tv3-19-03-baseline-20261013/handoff.md`. Staged vẫn rỗng. LF→CRLF warnings của Git là line-ending warnings, không phải whitespace errors.

### Acceptance criteria / TC mapping / limits

- **AC-01 — đạt phần controller:** TC_19_05 guards Practice/Writing/ESSAY, terminal/lock/identity/membership; không POST hoặc UUID nếu guard không đạt.
- **AC-03 — đạt phần controller:** TC_19_02 defaults omit optional fields, explicit tám languages, resolved response languages và language errors; không fallback English. Catalog/selects/labels UI thuộc 19-04.
- **AC-04 — đạt phần controller:** TC_19_06/07/08/09, một client flight, immutable same-UUID retry, manual new UUID, pending/cooldown/quota phân biệt, countdown hết không HTTP. Confirmation thuộc 19-04.
- **AC-06 — đạt phần controller:** TC_19_11/12/13, route/part A→B→A, cùng questionId ở hai parts, attempt A→B→A, same-ID hydration, StrictMode, late settlement/finally, unmount, synchronous submission/store/section locks và suspend/manual retry sau unlock. Submit-page callbacks thuộc 19-05.
- **Related integrity/security:** TC_19_04/10/15/17/18 malformed response không publish; permission/ended/conflict clear; metadata refresh/essay A→B→A không invalidate hints; Redux answers/version và local/session storage không bị hints đọc/ghi/xóa; deadline API thật 150s, cancellation settle ngay khi HTTP double chưa settle.
- **Deviations / blockers:** không thay approved contract/architecture, không còn blocker trong scope 19-03. Các lựa chọn implementation nhỏ dùng convention hiện có; không replanning. User yêu cầu focused tests nên không chạy full frontend/backend suites; không browser/DB/live Gemini/quota thật, không claim UI/integration semantic evidence. Gates 19-04–06 chưa triển khai.
- **Next required action:** **Codex Reviewer review TV3-19-03** trên hai files mới, approved plan và evidence này. Implementer dừng tại gate này; không tự gán review PASS hoặc bắt đầu 19-04.

## 2026-10-13 — Codex Reviewer: TV3-19-03 re-review

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-19-03 — Scoped hints controller và idempotent retry; latest matching execution IMPLEMENTED, dependencies 19-01/02 có Reviewer PASS. Đối chiếu approved plan, handoff, staged/unstaged diff, đọc toàn bộ hook và focused tests untracked cùng production call paths liên quan. Không nghiệm thu toàn feature.
- **Decision:** **PASS**.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`; staged rỗng. Thay đổi mới của gate-03 là `frontend/src/features/exam/hooks/useWritingHints.ts` và `frontend/src/features/exam/__tests__/useWritingHints.test.tsx`; tracked API/types/API tests thuộc gates trước được phân biệt, không coi là phát sinh của hook. Reviewer chỉ append handoff, không sửa code/tests/approved plan.

### IN-SCOPE — findings / verified acceptance criteria

- **Confirmed findings:** không có P0/P1/P2 actionable trong scope đã review; không có fix bắt buộc.
- **AC-01 — đạt phần controller:** `frontend/src/features/exam/hooks/useWritingHints.ts:85` kiểm tra live workspace/store identity, Practice/IN_PROGRESS, positive Java IDs, selected ESSAY và recorded snapshot membership duy nhất, section Writing/chưa locked, submission/store lock. Không dùng ordering hoặc part-ID fallback để cấp quyền. Tests negative kiểm tra không tạo UUID/POST và positive chứng minh generation hoạt động; grouped canonical snapshot được đối chiếu với convention WorkspacePage.
- **AC-03 — đạt phần controller:** optional defaults bị omit bởi validated request; tám explicit languages và resolved response metadata được giữ; invalid language không gửi HTTP hoặc fallback English. Generated text/labels cũ không bị relabel theo selection mới khi request mới thất bại. UI catalog/selects thuộc gate-04.
- **AC-04 — đạt phần controller:** `frontend/src/features/exam/hooks/useWritingHints.ts:212` đặt mutex trước UUID/await; double generate/hai ESSAY chỉ một client flight. Operation/payload/selection frozen tại `:233`; retry giữ payload/UUID qua timeout, cancellation và caller-selection change; generate mới tạo UUID mới. Pending/cooldown backoff áp dụng toàn controller, timer chỉ cập nhật countdown; quota/context/access/ended/conflict block theo classifier. Không auto-retry/polling/storage persistence; confirmation UI thuộc gate-04.
- **AC-06 — đạt phần controller:** context key dùng workspace attempt + Redux attempt/contextRevision tại `:121`; store subscription/layout synchronization và flight identity/epoch checks tại `:246`, `:253` loại stale success/error/finally. Part A→B→A giữ operation cho manual retry, khác part cùng questionId không collision; attempt/hydration/unmount clear, StrictMode không tự POST. Suspend/store/submission/section lock invalidates flight, unlock không auto-resume. Metadata refresh và essay edits không clear hints.
- **Security/integrity:** HTTP boundary dùng API/normalizer/classifier production của gates 01–02, không đọc/gửi essay từ controller; access/ended/conflict clear hints tại `:257`. Tests malformed response không publish; answers/version và draft/local/session storage không bị hints đọc/ghi/xóa. Không thêm backend, auth, dependency, editor hoặc Practice feedback changes.

### Focused test evidence — Reviewer thực chạy

- Tại `frontend/`: `npm test -- src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts` — **exit0, 4 files / 346 tests PASS** (64 hook + 138 API + 54 errors + 90 contract), start **17:18:35**, duration **3.98s**, ngày 2026-10-13.
- Đã đọc assertions và mocks: hook/API/normalizer/classifier/answer reducer thật, chỉ mock HTTP boundary, spy UUID/storage, fake timers và deferred promises. Assertions kiểm tra payload thực và public state; không dùng mocked controller để chứng minh lifecycle. Part A→B→A có flight mới trước old hook finally; stale transport settle không giải phóng flight mới. Guard tests trên inactive scaffold trước đó không được dùng làm bằng chứng độc lập; GREEN positive/negative hiện tại đã chạy.
- `git diff --check` — **exit0**. Kiểm tra riêng hai files hook/test và handoff untracked bằng CRLF-aware no-index whitespace check sau append; ordinary tracked diff không bao phủ untracked. Warning LF→CRLF ở `attemptApi.ts` không phải functional finding.
- **Chỉ Implementer báo cáo, không Reviewer chạy lại:** RED 39 failed/25 passed, related regression 8 files/414 PASS, lint 0 errors/28 baseline warnings, build PASS. Không chạy full frontend/backend suite, browser, DB hoặc live provider/quota; không suy diễn semantic language hoặc UI end-to-end evidence từ fixtures/hook tests.

### OUT-OF-SCOPE / next required action

- `.codex/`, `backend/Exam_Template.xlsx`, work gates 01–02 và các behavior hiện có của shared auth/WorkspacePage giữ nguyên; không audit hoặc biến chúng thành blockers gate-03. Guard hints không thay thế backend ownership/quota authorization.
- TV3-19-04–06 chưa triển khai: confirmation/rendered accessibility, workspace submit callbacks và integration/browser/full verification cần review riêng. Checkbox gate-03 trong approved plan vẫn unchecked, nhưng latest IMPLEMENTED entry và code/test evidence xác định được scope hoàn thành; Reviewer không sửa plan.
- **Next required action:** có thể triển khai TV3-19-04 theo approved plan; gate-03 không cần fix thêm. Preserve toàn bộ lịch sử; không commit/push; dừng sau báo cáo.

## 2026-10-13 — Codex Implementer: TV3-19-04 IN_PROGRESS

- **Agent:** Codex Implementer.
- **Task/subtask:** TV3-19-04 — Panel Writing hints và confirmation.
- **Status:** IN_PROGRESS.
- **Scope:** chỉ tạo `WritingHintsPanel.tsx`, `WritingHintsPanel.test.tsx` và append handoff; không tích hợp WorkspacePage hoặc sửa hook/API/catalog.
- **Prerequisites:** latest Reviewer TV3-19-03 **PASS**, dependency gates 19-01/02 **PASS**. Baseline HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`, staged rỗng; dirty/untracked code/docs hiện có được bảo toàn. Hash manifest + bản sao handoff tại `%TEMP%/tv3-19-04-baseline-20261013/`.
- **Execution:** `tv3-plan-executor`, TDD, UI styling và ui-ux-pro-max; UX result: visible keyboard focus, role=alert for errors; React guidance: controlled native inputs/selects with associated labels. Approved plan mục 19-04 là authority. User yêu cầu focused tests và stop for review; không commit/push.
- **Next action:** viết rendered/accessibility/confirmation/safe-text tests trước component, chạy RED → GREEN rồi kiểm tra diff/whitespace và append evidence.

## 2026-10-13 — Codex Implementer: TV3-19-04 IMPLEMENTED

- **Agent:** Codex Implementer.
- **Task/subtask:** TV3-19-04 — Panel Writing hints và confirmation.
- **Status:** **IMPLEMENTED — chờ Codex Reviewer**, chưa phải review PASS/feature PASS.
- **Prerequisites:** latest Reviewer TV3-19-03 PASS; gates 19-01/02 PASS. HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`, staged rỗng. Không commit/push, sửa approved plan hoặc triển khai 19-05.

### Implementation summary / files

- **Tạo `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx`:** component presentational thuần, chỉ gọi callbacks từ parent, không import API/hook. Disclosure là native button dùng `useId`, `aria-expanded`, `aria-controls`; controlled panel có sẵn trong DOM và dùng hidden khi đóng để disclosure target luôn tồn tại. Giao diện co giãn, xếp controls dọc trên mobile, wrap text, focus ring rõ.
- Hai native selects có label gắn trực tiếp và dùng read-only `SUPPORTED_LANGUAGES` hiện có. Lần đầu để trống theo backend / theo ngôn ngữ học; `lastSelection` của operation được khôi phục khi mount hoặc đổi operation. Mở panel/chọn language không tự POST.
- `Thử lại` chỉ chạy callback retry operation cũ. Tạo lần đầu chỉ sau click; với operation/dataset có sẵn, tạo mới hoặc đổi ngôn ngữ mở inline confirmation có role=group, nút xác nhận/hủy và copy quota/pending; hủy phục hồi lựa chọn của operation cũ. Pending/cooldown hiển thị thời gian và chặn action tới khi hết; quota/context/access/ended/conflict disable tạo mới; language lỗi vẫn cho đổi lựa chọn qua confirmation.
- Render outline thành headings/lists, vocabulary bằng definition list, limitations đầy đủ. Content đặt `lang` theo hint language của response; hai label language lấy response/catalog match chính xác, nếu thiếu label hiện canonical tag. Hiển thị cảnh báo hints không phải bài mẫu/điểm chấm. Tất cả model text dùng React text nodes; không dùng HTML/Markdown injection. `role=status` chỉ chứa copy loading ngắn; lỗi dùng `role=alert`; panel controls giữ được khi loading.
- **Tạo `frontend/src/features/exam/__tests__/WritingHintsPanel.test.tsx`:** 14 rendered tests cho collapsed/expanded, 8 catalog languages, defaults, click-only generation, loading, errors, countdown, retry callback, confirmation/hủy, labels/resolved `lang`, text dài/HTML-like input và layout/button disabled semantics. HTTP/API/hook không được mock/import bởi component.
- **Append `docs/superpowers/plans/ndt/TV3-19-handoff.md`:** entry IN_PROGRESS và entry IMPLEMENTED này; giữ lịch sử review 19-01/02/03 nguyên vẹn.

### Verification — Implementer thực chạy

```powershell
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/usePracticeFeedback.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
npm run lint
npm run build
```

- **RED:** trước component, Vitest không resolve module panel; sau khi có khung component, **14 tests FAIL** vì chưa có UI. RED hành vi tiếp theo tái hiện regression disclosure thiếu target, confirmation thiếu accessible group và quota vẫn mở create action (mỗi case **1 failed / 13 passed**); đã sửa theo contract và rerun.
- **GREEN focused:** exit0, **14/14 tests**, start **17:28:23**, duration **2.31s**; lặp lại sau các fix role/blocks tiếp tục **14/14**. Evidence cuối dùng regression rộng bên dưới.
- **Final related regression:** tại `frontend/`, exit0 **9 files / 428 tests PASS**, start **17:30:32**, duration **6.44s**. Bao gồm panel, hook, hints API/errors/contract, Practice feedback, workspace contract, autosave-submit và resume. Log `%TEMP%/tv3-19-04-final-regression.log`.
- **Final lint:** exit0, **0 errors / 28 baseline warnings**, **0 warnings mới ở WritingHintsPanel**. Log `%TEMP%/tv3-19-04-final-lint.log`.
- **Final build:** exit0, `tsc -b && vite build`, Vite **871ms**; giữ baseline large-bundle warning (~1,996 kB). Log `%TEMP%/tv3-19-04-final-build.log`.
- **Whitespace/preservation:** kiểm tra cuối `git diff --check` exit0; SHA256 baseline worktree paths, gồm TV3-19-03 hook/tests/API/types và work `.codex/`/`backend/Exam_Template.xlsx`, giữ nguyên. Chỉ thêm panel, panel tests và append handoff trong subtask này. Cảnh báo LF→CRLF của Git không phải lỗi whitespace. Không chạy full frontend/backend, browser viewport hoặc live Gemini/quota.

### Acceptance criteria / remaining / next action

- **AC-03:** đạt phần UI language selection: tám ngôn ngữ đúng catalog, defaults omit qua callback, resolved language labels lấy từ response và fallback canonical tag.
- **AC-04:** đạt phần UI dispatch: retry callback riêng giữ operation cũ; create mới không tự gửi, phải click và xác nhận khi có operation; cancel không gọi callback; pending/cooldown countdown không trigger HTTP. Retry/idempotency chính thuộc hook 19-03 đã Reviewer PASS.
- **AC-05:** outline, vocabulary, limitations hiển thị đầy đủ dưới dạng text; text dài wrap, HTML-like strings không tạo script/img/b/svg active node; response language gắn lên vùng generated content; copy phân biệt hints với bài mẫu/chấm điểm.
- **AC-07:** native controls/labels/buttons, disclosure ARIA, nhóm confirmation accessible, visible focus states, status/loading và alert/error semantics. Không có browser keyboard/375–1280 viewport evidence ở subtask này; browser check thuộc 19-06.
- **Blockers/deviations:** không có blocker trong panel scope; chưa tích hợp WorkspacePage, ESSAY placement, global errors hoặc submit callbacks (19-05). Không sửa catalog, hook, API, dependencies hoặc behavior ngoài plan.
- **Next required action:** Codex Reviewer review 19-04 trên panel + rendered tests, approved plan và entry này. Dừng để review; không bắt đầu 19-05.

## 2026-10-13 — Codex Reviewer: TV3-19-04 re-review — NEED_FIX

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-19-04 — Panel Writing hints và confirmation; đối chiếu approved plan, entry IMPLEMENTED và dependencies 19-01/02/03. Đây là quyết định cho subtask 19-04, không phải nghiệm thu toàn feature.
- **Decision:** **NEED_FIX** — còn một P1 in-scope đã tái hiện; không phát hiện P0 trong phạm vi review.
- **Git evidence:** HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`; staged rỗng. Đã kiểm tra unstaged API/types/API tests của gates trước và đọc trực tiếp panel/tests untracked. Hai file mới của 19-04 là `WritingHintsPanel.tsx` và `WritingHintsPanel.test.tsx`; `.codex/` và `backend/Exam_Template.xlsx` là work có sẵn, không audit/chỉnh sửa.

### Verified acceptance criteria

- **AC-03:** tám choices lấy từ catalog hiện có, defaults để backend resolve, callback nhận lựa chọn explicit; labels của hints lấy từ response và fallback canonical tag, không English fallback. Có P2 về giữ lựa chọn trong lúc chờ, bên dưới.
- **AC-04 (panel scope):** mở/chọn language không gọi callback; tạo lần đầu phải click; operation có sẵn phải xác nhận; hủy không gọi generate; retry dùng callback riêng không gửi selection mới. Busy/backoff/blocked disable actions; countdown không tự request. UUID/mutex thuộc hook 19-03, không do panel tạo.
- **AC-05:** outline/vocabulary/limitations được render đầy đủ bằng React text; không HTML/Markdown injection, không mutation answers/version/draft/storage, không thêm API calls. Generated content có response `lang`, hints cũ vẫn lấy labels từ response cũ, có disclaimer không phải bài mẫu/điểm chấm.
- **AC-07:** disclosure button có useId/ARIA target luôn tồn tại; native labelled selects/buttons, confirmation có accessible name, focus-visible styles; short loading status và error alert tách khỏi hints dài. Responsive classes phù hợp phạm vi component. **Chưa đạt thông báo quota khi còn hints cũ: F19-04-01.**

### IN-SCOPE findings

1. **F19-04-01 — P1: Hints cũ che mất thông báo lỗi đã được phân loại an toàn.**
   - **Location:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:212–214`.
   - **Scenario:** tạo hints thành công, rồi xác nhận tạo mới nhưng backend trả HTTP 429/code 429. Hook giữ bộ trước và trả `kind: quota` (hook lines 254–262). Panel chỉ hiện “Chưa tạo được bộ gợi ý mới. Đang hiển thị bộ trước.”; thông báo hết/chưa có quota hoàn toàn biến mất, trong khi create bị khóa và không có retry/countdown/action giải thích. Cùng nhánh cũng giấu lý do language error HTTP 422/1607–1608. Vi phạm error/quota UX của AC-07 và bảng phân loại lỗi trong plan.
   - **Minimal fix:** luôn hiển thị `state.error.message` đã qua safe classifier; khi `state.data` có sẵn, bổ sung cảnh báo bộ trước, không dùng cảnh báo này để thay thế lý do lỗi. Không hiển thị raw backend message hoặc thêm số quota giả.
   - **Regression:** render prior data + quota failure thật từ classifier, assert alert chứa thông báo quota cùng cảnh báo bộ trước, create disabled/no retry/no countdown. Thêm prior data + language failure, assert lý do sửa lựa chọn vẫn hiện và generate chỉ chạy sau confirmation.

2. **F19-04-02 — P2: Completion ghi đè lựa chọn ngôn ngữ đang sửa.**
   - **Location:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:114–123`.
   - **Scenario:** operation en/en đang loading, select vẫn enabled; người học chọn fr cho lần tạo tiếp theo. Khi cùng operation hoàn tất, hook tạo object `lastSelection` mới nhưng cùng en/en (hook lines 241/249/262). Effect phụ thuộc object identity chạy lại và đổi select từ fr về en. Completion hoặc error của operation cũ không nên xóa lựa chọn mới ở control đang cho phép chỉnh sửa.
   - **Minimal fix:** đồng bộ selection theo thay đổi thực của operation/language values, không theo mỗi object copy khi đổi phase; giữ local draft đã sửa khi cùng operation settle. Không thay frozen retry payload.
   - **Regression:** loading → sửa select → ready/error với `lastSelection` mới nhưng cùng values; lựa chọn mới còn nguyên, không tự generate; confirm tạo mới dùng lựa chọn mới, retry vẫn là callback operation cũ.

### Focused verification — Reviewer independently ran

```powershell
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/writingHintsErrors.test.ts
git diff --check
```

- **Tests:** tại `frontend/`, exit0, **3 files / 132 tests PASS**, start **18:04:08**, duration **2.95s**. Panel có 14 rendered cases sử dụng component production; hook/error tests kiểm tra dependency production. PASS hiện tại không bao phủ hai scenarios trên: quota test chỉ có `data: null`, loading test không sửa select rồi settle cùng operation.
- **Read-only reproduction:** Node + Vite module loader + jsdom/React Testing Library render component production và dùng classifier thật; không thêm/sửa file test. Prior data + quota/language đều trả `safeMessageVisible: false`, alert chỉ là cảnh báo bộ trước; cùng operation en/en loading → chọn fr → ready cho `before: fr`, `after: en`. Cả diagnostic commands exit0.
- **Whitespace:** tracked `git diff --check` exit0; kiểm tra hai file untracked bằng `git diff --no-index --check -- NUL <file>` không có whitespace diagnostics (exit1 là file mới khác NUL, không phải lỗi whitespace). Có baseline LF→CRLF warning của API file.
- **Reported only:** Implementer báo 428 related tests PASS, lint 0 errors/28 baseline warnings, build PASS và RED/GREEN. Reviewer không chạy lại lint/build, không xác nhận RED lịch sử. Keyboard test hiện gọi `.focus()` và `.click()` thủ công; không phải bằng chứng browser Tab/Enter thực.
- Không chạy full frontend/backend, browser viewport, live Gemini, quota thật hoặc request tới external services.

### OUT-OF-SCOPE / next action

- Workspace placement/guards/global error/submit wiring là 19-05; browser 375/768/1280, keyboard thật và end-to-end regression là 19-06. Không dùng các phần chưa triển khai này làm blocker của 19-04.
- Không xác nhận thêm defect ở backend TV3-18, autosave, resume, objective feedback hoặc work không liên quan; không mở rộng audit.
- **Next required action:** sửa P1 F19-04-01 và bổ sung focused regression; khuyến nghị sửa P2 F19-04-02 trong cùng panel scope, sau đó yêu cầu re-review 19-04. Reviewer chỉ append entry này, không sửa code/tests/approved plan, không commit/push; dừng sau báo cáo.

## 2026-10-13 — Codex Fixer: TV3-19-04 re-FIX sau Codex re-review

- **Agent:** Codex Fixer.
- **Scope:** SUBTASK TV3-19-04 — Panel Writing hints và confirmation; chỉ xử lý **F19-04-01 (P1)** và **F19-04-02 (P2)** trong review NEED_FIX mới nhất. Không có P0.
- **Status:** **FIXED — sẵn sàng re-review**, chưa phải Reviewer PASS. Không triển khai gate 19-05.
- **Baseline:** HEAD `57280d1`, branch `feature/TV3-00-contract-audit`, staged rỗng. Work API/types/tests và files untracked có sẵn được giữ nguyên; bản sao panel/test/handoff và SHA256 manifest tại `%TEMP%/tv3-19-04-fix-baseline-20261013-181152/`.
- **Skills:** tv3-bug-fix, receiving-code-review, systematic-debugging, TDD và verification-before-completion; thêm ui-ux-pro-max cho UI error recovery. Focused UX search `error message recovery alert --domain ux` trả đúng Feedback/Error Recovery và Accessibility/Error Messages: giữ lý do lỗi cùng bước phục hồi trong role=alert, không mở rộng design hoặc scope.

### Findings / root causes / corrections

1. **F19-04-01 — P1: prior hints che lý do lỗi.** Nhánh render dùng conditional thay safe error message bằng cảnh báo bộ trước khi có data. Sửa alert luôn render `state.error.message` qua React text, và thêm cảnh báo bộ trước thành đoạn riêng khi có data. Không lấy raw backend message, không thêm quota/countdown giả hoặc đổi classifier/action gates.
   - Regression dùng **classifier production thật** cho prior data + HTTP 429/code429: alert hiện lý do quota và cảnh báo bộ trước; create disabled, không retry/countdown, không gọi callbacks và không lộ sentinel backend.
   - Với prior data + HTTP 422/code1607 và1608: lý do sửa language vẫn hiện; chọn language không generate, click create chỉ mở confirmation, confirm mới gọi generate đúng selection; labels/lang của hints cũ vẫn theo response cũ.
2. **F19-04-02 — P2: completion ghi đè local language draft.** Effect phụ thuộc object identity của lastSelection; hook copy cùng values khi ready/error nên effect lại reset selects. Đồng bộ theo hasOperation và hai language values thực, không theo object copy/phase. Giữ local draft khi operation với cùng values settle; vẫn phục hồi lựa chọn khi values thực thay đổi. Không sửa frozen payload/retry behavior trong hook.
   - Regression loading en/en → người học chọn fr/vi → ready hoặc error với lastSelection object mới cùng en/en: selects giữ fr/vi, không tự generate/retry; error retry gọi callback cũ không truyền selection mới; confirm tạo mới mới dùng fr/vi. Generated content vẫn lang en.
   - Positive regression khi operation language values đổi sang de/default-hint: controls phục hồi de/default, không tự gọi generate. Existing cancel-confirmation test tiếp tục phục hồi selection operation trước.

### Files sửa / refactoring

- `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx`: hai corrections trên, không đổi props hoặc layout/transport.
- `frontend/src/features/exam/__tests__/WritingHintsPanel.test.tsx`: thêm **6 focused rendered cases**, tổng **20 tests**; component/classifier production thật, callbacks là spies ở ranh giới presentational.
- `docs/superpowers/plans/ndt/TV3-19-handoff.md`: append entry này, giữ lịch sử.

Không refactor ngoài fix, không thêm abstraction/dependency; hook/API/classifier/catalog/types, WorkspacePage, approved plan, `.codex/` và workbook giữ nguyên theo SHA256 baseline.

### Verification — Fixer thực chạy

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/usePracticeFeedback.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
npm run lint
npm run build
```

- **RED trước sửa production:** exit1, **5 failed / 15 passed**, start **18:12:01**, duration **2.41s**. Ba quota/language assertions thất bại vì chỉ có cảnh báo bộ trước; hai settle assertions thất bại vì fr bị đổi thành en. Không phải module/setup error. Log `%TEMP%/tv3-19-04-fix-red.log`.
- **GREEN focused:** exit0, **20/20 tests**, start **18:12:26**, duration **2.52s**. Log `%TEMP%/tv3-19-04-fix-green.log`.
- **Related regression:** exit0, **9 files / 434 tests PASS**, start **18:12:58**, duration **7.75s**, ngày 2026-10-13. Bao gồm 20 panel + 64 hook + 282 hints API/errors/contract + 68 Practice feedback/workspace/autosave-submit/resume cases. Log `%TEMP%/tv3-19-04-fix-regression.log`.
- **Lint:** exit0, **0 errors / 28 baseline warnings**, không có warning WritingHintsPanel. Log `%TEMP%/tv3-19-04-fix-lint.log`.
- **Build:** exit0, `tsc -b && vite build`, Vite **944ms**; còn chunk >500kB warning baseline. Log `%TEMP%/tv3-19-04-fix-build.log`.
- **Integrity:** `git diff --check` exit0 trước append; no-index CRLF-aware whitespace checks panel/test so với bản trước sửa không có diagnostics. Kiểm tra lại sau append gồm handoff, lịch sử prefix và SHA256 ngoài scope; staged vẫn rỗng. Git LF→CRLF warning ở API file có sẵn không phải functional finding hoặc thay đổi của fix.

### Acceptance / remaining / next action

- **AC-03:** draft language đang sửa không bị cùng operation settle xóa; operation values thực thay đổi vẫn restore, generated-content labels/lang giữ response metadata.
- **AC-04:** không tự dispatch; quota chặn create, language correction/new generation vẫn qua confirmation; retry chỉ gọi callback operation cũ. UUID/frozen payload do hook gate-03 quản lý, không tạo/sửa trong panel.
- **AC-05:** hints trước vẫn hiển thị; error và generated content dùng React text; existing full-content/HTML-like regressions tiếp tục PASS.
- **AC-07:** safe classified reason và cảnh báo bộ trước cùng nằm trong role=alert, giải thích quota/language failure thay vì che lý do; native controls/disclosure/confirmation semantics giữ nguyên.
- Không còn confirmed in-scope P0/P1/P2 chưa xử lý từ review này. Chưa kiểm tra browser Tab/Enter thật, viewport375/768/1280, live quota/provider hoặc end-to-end page integration; các phần đó thuộc gates19-05/06. Không chạy full frontend/backend suite theo master request giới hạn focused verification; không claim rendered jsdom là browser evidence.
- Không sửa approved plan, không commit/push hoặc tự gán Reviewer PASS.
- **Next required action:** Codex Reviewer re-review TV3-19-04 trên diff, focused regressions và evidence này trước gate19-05. Fixer dừng để re-review.

## 2026-10-13 — Codex Reviewer: TV3-19-04 re-review sau FIX — PASS

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-19-04 — Panel Writing hints và confirmation. Đối chiếu approved TV3-19 plan, latest IMPLEMENTED/FIXED entries, review NEED_FIX trước và current staged/unstaged/untracked files. Chỉ nghiệm thu subtask này, không phải toàn feature TV3-19.
- **Decision:** **PASS** — F19-04-01/P1 và F19-04-02/P2 đã đóng; không còn confirmed in-scope P0/P1/P2 trong phạm vi kiểm tra.
- **Git/scope:** staged rỗng; tracked API/types/API tests là work gates trước. Đọc trực tiếp panel/tests untracked và so sánh no-index với bản trước fix tại `%TEMP%/tv3-19-04-fix-baseline-20261013-181152/`. Production diff chỉ có hai corrections đã yêu cầu, tests thêm sáu cases. Kiểm tra SHA256 manifest cho thấy chỉ panel, panel tests và handoff thay đổi; approved plan, hook/API/classifier/catalog và work ngoài scope giữ nguyên. Prefix lịch sử handoff trước fix còn nguyên sau chuẩn hóa CRLF/LF.

### Findings được kiểm chứng lại / acceptance criteria

- **F19-04-01 — CLOSED:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:212–215` luôn render classified safe error message bằng React text và thêm cảnh báo bộ trước riêng. Quota với prior data hiện đúng lý do, create disabled, không retry/countdown giả; language failures 1607/1608 hiện lý do và chỉ generate sau confirmation. Regression assert backend sentinel không xuất hiện.
- **F19-04-02 — CLOSED:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:109–124` đồng bộ theo hasOperation/language values thay vì object identity. Loading → chọn fr/vi → cùng operation ready/error giữ local selection; đổi operation values thực vẫn restore; cancel vẫn phục hồi operation selection. Không sửa frozen retry payload/hook.
- **AC-03 (panel):** tám ngôn ngữ từ catalog read-only, defaults backend/same-learning, explicit selection đúng; labels/lang lấy response, fallback canonical tag; giữ local draft khi completion cùng operation.
- **AC-04 (panel):** mở/chọn language không dispatch; create lần đầu cần click, regenerate cần xác nhận/hủy; retry callback riêng không nhận dropdown payload mới; busy/backoff/blocked actions giữ nguyên và không auto request.
- **AC-05:** outline/vocabulary/limitations đầy đủ, React text không HTML/Markdown execution; response metadata và disclaimer giữ nguyên; panel không gọi API, mutation answers/version/draft/storage hoặc log payload.
- **AC-07 (component):** native labelled controls, disclosure useId/ARIA/hidden target, confirmation accessible name, visible focus classes; short loading status và classified error alert tách khỏi long hints. Responsive classes không đổi; không coi jsdom là bằng chứng browser/viewport thực.

### Verification — Reviewer independently ran

```powershell
npm test -- src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/writingHintsErrors.test.ts
git diff --check
```

- **Focused tests:** tại `frontend/`, exit0, **3 files / 138 tests PASS**, start **18:35:27**, duration **2.78s**. Gồm **20 panel + 64 hook + 54 error-classifier** tests. Đọc assertions xác nhận production panel/classifier thật; callbacks là spies đúng ranh giới presentational, không mock implementation đang được review.
- **Whitespace:** tracked `git diff --check` exit0; no-index CRLF-aware checks hai files untracked không có diagnostics (exit1 do file mới khác NUL). Cảnh báo LF→CRLF API có sẵn không phải finding.
- **Reported only:** Fixer báo RED 5 failed/15 passed, GREEN 20/20, related 434 tests PASS, lint 0 errors/28 baseline warnings và build PASS. Reviewer không chạy lại RED, lint/build hoặc nhóm regression rộng đó.
- Skills `tv3-code-review` giữ review theo plan/gate; checklist/search UX của `ui-ux-pro-max` xác nhận safe error recovery và role=alert; `verification-before-completion` yêu cầu evidence mới trước quyết định PASS. Không redesign hoặc sửa implementation.

### OUT-OF-SCOPE / next required action

- TV3-19-05 Workspace placement/access gates/global errors/submit wiring và TV3-19-06 page integration, browser Tab/Enter thật, viewport375/768/1280/full verification vẫn cần triển khai và review riêng; không phải blocker của 19-04.
- Không phát hiện thêm defect ngoài scope; không audit backend TV3-18, autosave/resume/objective feedback, `.codex/` hoặc workbook có sẵn. Không chạy full frontend/backend, live Gemini/quota hoặc external services.
- **Next required action:** có thể triển khai TV3-19-05 theo approved plan. Reviewer chỉ append entry này; không sửa code/tests/plan, không commit/push. Dừng sau báo cáo.

## 2026-10-13 — Codex Implementer: TV3-19-05 — IN_PROGRESS

- Scope: Workspace integration, submit và section gates theo approved plan; dependency 19-04 đã Reviewer PASS. Chỉ sửa WorkspacePage, tạo focused page tests và append handoff.
- Branch `feature/TV3-00-contract-audit`, HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`; staged rỗng. Đã lưu SHA256 manifest các thay đổi có sẵn và bản WorkspacePage/handoff tại thư mục `%TEMP%/tv3-19-05-baseline-*` (pointer `%TEMP%/tv3-19-05-baseline-path.txt`).
- Thực hiện inline bằng tv3-plan-executor/executing-plans và TDD. Giữ nguyên corrections đã review ở panel/hook/API; không sửa approved plan, renderer, reducer hoặc objective controllers. Không commit/push; dừng tại review gate 19-05.

## 2026-10-13 — Codex Implementer: TV3-19-05 — IMPLEMENTED

- **Subtask:** Workspace integration, submit và section gates. Chỉ nghiệm thu implementation 19-05; chưa phải Reviewer PASS hoặc whole-feature PASS.
- **Files changed:** `frontend/src/features/exam/pages/WorkspacePage.tsx`; tạo `frontend/src/features/exam/__tests__/WorkspaceWritingHints.test.tsx` (**24 page tests**); append handoff này. Không cần sửa fixtures/mocks của WorkspacePage.test hoặc WorkspacePractice.test.
- **Dependency/scope:** latest 19-04 re-review PASS. Không sửa panel fixes, hints hook/API/normalizer/classifier, EssayRenderer, QuestionRenderer, objective feedback/retry controllers, answer reducer, catalog hoặc approved plan. Giữ nguyên tất cả work trước task, không stage/commit/push/rebase.

### Implementation / acceptance mapping

- **AC-01:** một hints controller trước mọi conditional return; dùng canonical ID của currentPart đang được chọn, không dùng fallback `partId ?? 1`. UI kiểm tra Practice/IN_PROGRESS, Writing snapshot, IDs part/section hợp lệ và duy nhất, question IDs có thật và duy nhất. Mock/objective/non-Writing/terminal/missing/duplicate identity không có hints controls; hook thật vẫn là guard cuối cùng trước HTTP.
- **AC-05:** mỗi Writing ESSAY có panel dưới editor, ngoài fieldset; callbacks theo question ID riêng, toàn bộ response content tiếp tục dùng panel đã review. ESSAY ngoài Writing giữ notice cũ; objective controls dùng controller riêng.
- **AC-06:** truyền đúng function `submission.isLocked` để đọc khóa tại thời điểm action; `writingHints.suspend()` chạy trước manual submit, timeout submit và cả hai overlay submission.retry callbacks. Không await hints, không thay barrier/finalAnswers/submit controller. React key gồm attempt/contextRevision/part/question; part switch hoặc authoritative hydrate remount disclosure/local selection. Retry panel chỉ chuyển questionId đến hints.retry, không chuyển lựa chọn dropdown mới.
- **AC-07:** global blocked reason hiển thị một role=alert, không lặp trong từng panel; reload action chỉ khi classifier yêu cầu và gọi handleReload authoritative hiện có. Quota không có reload/countdown giả. Error vẫn hiện khi đổi sang part không có câu hỏi; các hints controls bị khóa nhưng objective feedback tách biệt. Khóa section Practice áp dụng trực tiếp cho panel, độc lập editor lock semantics hiện có.
- **AC-08 (subtask):** hints loading không khóa textarea hoặc gọi autosave.pauseAndWait; edit essay vẫn cập nhật answers/dirty state và giữ version. Không thêm hints persistence, payload essay, logging hoặc answer mutation. Full-suite/browser evidence thuộc 19-06.

### Verification — commands actually run

Tại `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/EssayRenderer.test.tsx
npm test -- src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
npm run build
npm run lint
```

- **RED:** trước page wiring, page tests 11 failed/8 passed xác nhận thiếu panel/hook/global alert và thứ tự suspend trước manual/timeout submit. Sau wiring, hai fixture/assertion lỗi (immutable snapshot memo và savedAnswers hydration shape) được sửa theo code hiện có, không sửa production để chiều test. Bổ sung IDs thiếu/trùng quan sát RED trước guard; bổ sung empty-part global alert quan sát RED **1 failed/23 passed** trước khi đưa banner ra ngoài nhánh có questions. Các lỗi query nhãn/hidden controls và TS typing trong tests đã sửa; không dùng chúng làm evidence behavior RED.
- **Final focused GREEN:** **4 files / 80 tests PASS**, exit0, start **18:53:43**, duration **6.96s**; gồm 24 tests mới và 56 workspace/editor regressions.
- **Final related regressions:** **5 files / 110 tests PASS**, exit0, start **18:54:45**, duration **4.92s**; gồm hook64 + panel20 + existing workspace/submit/resume contracts26. Tổng hai final commands **9 files / 190 tests PASS**. Trước corrections cuối đã chạy một command 9 files/189 tests PASS; final evidence dùng hai commands trên.
- **Build:** lần đầu phát hiện test typings và danh sách IDs implicit any; sửa within scope. Final `tsc -b && vite build` exit0, 2179 modules, Vite build915ms; có existing bundle-size advisory (>500kB), không đổi bundling.
- **Lint:** final exit0, **0 errors / 28 existing warnings**; không warning mới trong code thêm hoặc tests mới. WorkspacePage vẫn có warnings cũ ở unused import, optional chaining và highlight dependency, không mở rộng scope để sửa.
- **Test boundaries:** page/panel/renderers, Redux answer reducer và objective controllers thật; mock hints/workspace/submission/timer/autosave boundaries để kiểm tra wiring, IDs, locks và event ordering. Nhóm hook/contract regressions chạy implementation thật theo tests có sẵn. Không coi page wiring tests này là HTTP end-to-end; test toàn page + hints hook/API/normalizer thật và browser vẫn thuộc 19-06.
- **Integrity:** `git diff --check` exit0; CRLF-aware no-index whitespace checks test mới/handoff không diagnostics (exit1 do có diff). SHA256 manifest **16 existing files**, ngoài handoff **0 unexpected changes**; handoff byte prefix trước task còn nguyên. Staged rỗng, HEAD không đổi. Baseline `%TEMP%/tv3-19-05-baseline-20261013-184644/`; logs RED/GREEN/build/lint được giữ cùng baseline để review.

### Remaining / next required action

- Không còn known in-scope implementation blocker. Chưa chạy full frontend/backend suite, browser keyboard/375/768/1280 hoặc live provider/quota; không claim evidence ngoài focused scope. Gate19-06 chưa triển khai.
- **Next required action:** Codex Reviewer review TV3-19-05 đối chiếu diff và 24 page tests, đặc biệt canonical ID gates, global blocked alert, panel key/placement và suspend trước bốn submit paths. Implementer dừng để review; không tự dispatch reviewer hoặc tiếp tục 19-06.

## 2026-10-13 — Codex Reviewer: TV3-19-05 re-review — PASS

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-19-05 — Workspace integration, submit và section gates; latest matching execution IMPLEMENTED, dependency 19-04 Reviewer PASS. Đối chiếu approved plan/handoff, tracked diff và test untracked, cùng hints/submission production call paths trực tiếp liên quan. Không nghiệm thu toàn feature.
- **Decision:** **PASS** — không có confirmed in-scope P0/P1/P2 hoặc missing requirement thuộc gate 19-05 sau kiểm tra.
- **Git/scope:** HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch `feature/TV3-00-contract-audit`, staged rỗng. Thay đổi 19-05 là WorkspacePage (60 insertions/3 deletions), test mới WorkspaceWritingHints và append handoff. API/types/API tests và các hints files là dependencies gates trước. So SHA256 manifest 16 files tại `%TEMP%/tv3-19-05-baseline-20261013-184644/`: chỉ handoff đổi trong các files có sẵn; lịch sử handoff trước task giữ nguyên byte prefix. Không audit `.codex/` hoặc workbook.

### Verified acceptance criteria / production contracts

- **AC-01:** `WorkspacePage.tsx:336–361` dùng canonical `currentPart.id`, không dùng fallback editor `partId ?? 1`; gate Practice/IN_PROGRESS, Writing section, positive Java IDs, unique part/section/question identities. Panels chỉ gắn vào ESSAY đủ điều kiện. Một useWritingHints chạy trước early returns, nhận activeWorkspace, actual part, normalized questions và function submission.isLocked; hook còn kiểm tra snapshot membership, persisted workspace status/mode, live Redux lock trước API.
- **AC-05:** `WorkspacePage.tsx:1126–1165` đặt panel dưới từng editor, ngoài fieldset; giữ notice ESSAY ngoài Writing và objective feedback controller riêng. Không sửa renderers, response normalizer hoặc thêm HTML/model content rendering vào page; dùng panel đã review.
- **AC-06:** `WorkspacePage.tsx:420–426, 1405–1428` gọi suspend trước manual/timeout submit và cả hai overlay retry calls, không await hints; giữ autosave barrier/finalAnswers/submission controller. Panel key tại line1139 gồm attempt/contextRevision/part/question, nên authoritative hydration và part switch remount local UI state. Hints hook đọc synchronous store lock và invalidate flight identity; retry callback chỉ nhận question ID, không dropdown payload mới.
- **AC-07:** `WorkspacePage.tsx:991–1002, 1142–1147` hiển thị global classified blocked reason một lần bằng React text/role=alert, kể cả empty part; không lặp alert trong mỗi panel. Reload chỉ khi action=reload, dùng handleReload authoritative hiện có với dirty/saving guards. Quota không có countdown/số lượt giả. Practice section lock áp dụng riêng cho hints controls; objective feedback không phụ thuộc hints block. Native reload button có focus-visible/disabled semantics.
- **AC-08 (gate scope):** hints busy không khóa textarea hoặc pause autosave; page test chứng minh edit cập nhật answers/isDirty và giữ version. Không thêm hints storage/logging/payload essay, không sửa editor/reducer/autosave/submit behavior ngoài suspend wiring. Full-feature acceptance còn chờ gate19-06.

### IN-SCOPE findings

- **P0/P1:** không có finding xác nhận trong phạm vi review.
- **P2:** không có observation actionable mới; không đề xuất refactoring/style-only changes.

### Focused verification — Reviewer independently ran

```powershell
npm test -- src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/EssayRenderer.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
git diff --check
```

- **Observed:** tại `frontend/`, exit0, **9 files / 190 tests PASS**, start **19:01:22**, duration **7.39s**, ngày 2026-10-13. Bao gồm 24 page cases mới; guards/missing/duplicate IDs, per-question callback, locks, editor integrity, single global alert, hydration/part remount và suspend→submit/retry ordering được assert trên WorkspacePage/panel/renderers/Redux reducer thật.
- **Test boundaries:** tests mới mock useWritingHints/useWorkspace/useAutosave/useAttemptSubmission/useExamTimer/API để kiểm tra page wiring; không chứng minh full HTTP pipeline. Nhóm hook/panel và workspace/autosave-submit/resume contracts chạy production implementations tương ứng theo test setup đã đọc. Không coi callback spies là bằng chứng backend authorization hoặc actual HTTP response.
- **Whitespace:** tracked git diff --check exit0; CRLF-aware no-index check test untracked không có diagnostics (exit1 vì file khác NUL). Baseline LF→CRLF warning của API không phải finding.
- **Reported only:** Implementer báo RED hành vi, hai final commands 80+110 tests PASS, build PASS và lint 0 errors/28 baseline warnings. Reviewer không chạy lại RED/build/lint; không claim kết quả này là verification độc lập.
- Skills tv3-code-review giới hạn review theo approved gate; ui-ux-pro-max checklist/search error recovery/role=alert áp dụng cho banner web, không redesign; verification-before-completion yêu cầu fresh test evidence trước PASS.

### OUT-OF-SCOPE / next action

- TV3-19-06 còn phải kiểm tra page + hints hook/API/normalizer thật với mocked HTTP, stale completion/submit integration, browser Tab/Enter/375–1280 viewport và final frontend verification. Các phần này không phải blocker của gate19-05.
- Không xác nhận defect ngoài scope; giữ existing Practice editor/section-lock semantics và backend/authoring/admin APIs, không audit lại autosave/resume hoặc work không liên quan. Không chạy full frontend/backend, live Gemini/quota hoặc gửi external messages.
- **Next required action:** có thể triển khai TV3-19-06 theo approved plan, rồi yêu cầu full-feature review. Reviewer chỉ append entry này, không sửa code/tests/plan, không commit/push; dừng sau báo cáo.

## 2026-10-13 — Codex Implementer: TV3-19-06 — IN_PROGRESS

- Dependency 19-05 đã Reviewer PASS. Scope: tạo writingHintsWorkspaceContract.test.tsx dùng production page/hook/API/normalizer/reducer và mocked HTTP/browser; final verification và append handoff. Không sửa approved plan theo master instruction; checklist completion ghi tại handoff.
- HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch feature/TV3-00-contract-audit, staged rỗng. SHA256 manifest và handoff baseline tại `%TEMP%/tv3-19-06-baseline-20261013-190557/`.
- Giữ nguyên dependencies/dirty files; inline TDD/verification-before-completion. Gate19-06 explicitly yêu cầu full frontend sau focused, nên sẽ chạy; không backend/live provider. Browser verification dùng mocked HTTP nếu runtime khả dụng, ghi rõ nếu thiếu evidence. Không commit/push, dừng để review toàn feature.

## 2026-10-13 — Codex Implementer: TV3-19-06 — IMPLEMENTED

- **Agent / status:** Codex Implementer, TV3-19-06 Integration regression và bàn giao — IMPLEMENTED, chờ independent full-feature review. Không tự gán Reviewer PASS.
- **Files:** tạo `frontend/src/features/exam/__tests__/writingHintsWorkspaceContract.test.tsx` (**17 integration tests**), append handoff. Không sửa production hoặc approved plan. Master instruction cấm sửa approved plan khi chưa có Planner authorization, nên completion/evidence được ghi ở handoff thay vì đánh dấu checklist plan.
- **Prerequisite:** 19-05 latest re-review PASS. Các gates01–05 là implementation đã review, regression này dùng lại toàn bộ, không viết lại code.
- **Boundaries:** chỉ mock shared HTTP client ở ranh giới transport và browser APIs (timers, scroll, localStorage spy). WorkspacePage, useWorkspace, useWritingHints, useAutosave, useAttemptSubmission, API projection/deadline/normalizers/classifier, panel/renderers và Redux reducer đều thật. Không mock hints hook hoặc submission/answer behavior.

### Integration evidence / AC–TC mapping

| AC / TC | Evidence |
|---|---|
| AC-01 / TC_19_05 | Persisted Mock/non-Writing/locked Practice contexts không hints POST; page/hook regressions còn bao phủ objective/terminal/invalid or duplicate IDs. |
| AC-02 / TC_19_03–04 | GET workspace → explicit en/vi → POST đúng endpoint, chỉ IDs/UUID/optional languages, deadline150000; không extra workspace/exam/provider lookup. Malformed UUID response bị normalizer reject, không render. Existing contract/API tests giữ ID/text/count/language boundaries. |
| AC-03 / TC_19_01–02 | Backend defaults bỏ language fields, resolved vi không English fallback; override en→vi render đầy đủ localized vocabulary/limitations/lang; confirmed fr request dùng fixture fr. Eight catalog languages/aliases/region/script covered by existing focused contract/panel tests. |
| AC-04 / TC_19_06–09,14,18 | Timeout đúng150s abort signal, không auto retry; manual retry cùng immutable payload/UUID dù dropdown đã đổi; mocked replay giữ original generatedAt/content. Regenerate cần confirmation, hủy không POST, xác nhận UUID mới. Pending1604/rate1606 countdown hết không dispatch, quota không countdown/remaining-count giả. Single-flight/two-task mutex do existing hook tests kiểm chứng. |
| AC-05 / TC_19_01,15 | Full response vocabulary cuối/limitations hiện trên page; HTML/script/javascript-like strings là text inert. 403 sau prior success xóa hints và chỉ hiện safe reason, không raw backend sentinel. |
| AC-06 / TC_19_11–13 | Same questionId giữa parts30/31 cách ly; switch abort, old completion/finally không render hoặc mở khóa flight mới, quay lại retry operation cũ. Route A→B→A, authoritative reducer rehydrate và real conflict→reload GET xóa context cũ, fresh UUID; không result redirect vì hints conflict. StrictMode/unmount abort và consume late rejection. |
| AC-07 / TC_19_08–09,14,16 | Browser Chrome thật với mocked HTTP: Tab/Enter mở disclosure từ editor, đi qua hai language selects, tạo hints, confirmation/cancel; cancel0 POST, confirm1 POST/UUID mới. Viewports375/768/1280, localized vi/fr và quota alert có screenshots; no horizontal document overflow, panel trong viewport, editor enabled. Residual narrow-select observation bên dưới cần Reviewer đánh giá. |
| AC-08 / TC_19_10,13,17 | Hints-only state bằng toàn bộ Redux snapshot trước request, Storage.setItem không gọi, existing exam_draft_42 giữ nguyên, không PUT. Edit trong flight giữ essay/dirty/version sau response và normal autosave PUT v7→v8. Pending hints bị cancel ngay trước manual submit, POST finalAnswers/baseVersion7/deadline10000 không chờ hints; submit failure unlock, overlay retry cùng body, late hints không render và submit thành công mới redirect. |

- Không dùng test-side frozen/generated payload để thay production contract. HTTP fixture replay mô phỏng backend response/generatedAt; không claim kiểm chứng actual backend idempotency hoặc semantic chất lượng ngôn ngữ model thật.
- TIMEOUT_CLIENT và cả hai overlay suspend-order paths đã được gate19-05/page/submission regressions kiểm chứng; Practice workspace thật có deadline=null nên không dựng fixture Practice có timeout sai contract chỉ để ép integration path.
- Tests mới GREEN ngay trên implementation có sẵn (**16/16**, sau bổ sung conflict reload và submit retry **17/17**). Không claim behavior RED và không tạo lỗi giả: gate này thêm integration regression, không đổi production behavior. Build đầu tiên phát hiện test envelope data type unknown, đã thêm typed data vào test fixture return; đây là typing correction, không production defect.

### Verification — actually run at frontend/

```powershell
npm test -- src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/writingHintsWorkspaceContract.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx
npm test
npm run lint
npm run build
```

- **Final focused:** exit0, **10 files / 433 tests PASS**, start **19:17:58**, duration **9.65s** (2026-10-13). Integration17 plus existing416. Initial focused command432 PASS trước bổ sung case cuối.
- **Final full frontend:** exit0, **65 files / 1234 tests PASS**, start **19:16:07**, duration **38.68s**. Initial full1233 PASS trước bổ sung case cuối. Existing jsdom HTMLMediaElement.pause not-implemented notices không fail tests; không sửa unrelated test environment.
- **Final lint:** exit0, **0 errors / 28 existing warnings**, không warning của test mới hoặc tăng baseline. No production changes để phát sinh warning mới.
- **Final build:** exit0, tsc -b/Vite, 2179 modules, **2.56s Vite build**. Existing >500kB bundle advisory giữ nguyên; không đổi bundling/dependencies.
- **Integrity:** tracked git diff --check exit0; new untracked test no-index CRLF-aware whitespace check không diagnostics (exit1 vì file mới). Manifest **18 existing files**, ngoài append handoff **0 unexpected changes**; plan/hook/panel/API/WorkspacePage và dirty/untracked work giữ nguyên. Staged rỗng, HEAD không đổi. Handoff trước task giữ nguyên byte prefix, kiểm tra sau final append.

### Browser evidence / residual observation

- Skill `playwright` áp dụng cho browser verification; CLI cached runtime, không thêm dependency. Local Vite127.0.0.1:5196 và Chrome session tv3-19-06 dùng exact local `/api/**` routing: workspace/hints được fulfill từ fixtures, mọi API khác abort, không tạo actual attempt/provider/quota hoặc gọi backend8088. Browser/source không thay code để bypass auth hoặc expose model data.
- **Observed:** native Tab/Enter disclosure + language controls + generate + confirmation/cancel PASS; mocked create requests allowlisted, cancel không POST, confirmed regeneration đổi UUID. Native select arrow keys chọn en/vi; actual fr fixture cũng render. Quota429 hiển thị đúng một safe global alert, create disabled và textarea enabled.
- **Layout:** widths1280/768/375, document.scrollWidth lần lượt1280/768/375; disclosure bounds752–930 /102–418 /90–325 đều nằm trong viewport. Chụp editor và hints riêng vì workspace dùng internal scroll; hints không overlay/disable editor. Đã xem screenshots375 hints/fr/quota, 768 và1280 editor.
- **Residual observation cho Reviewer:** ở default desktop split50/50 + sidebar, vùng editor/panel1280 khá hẹp; selected language text trong hai native selects bị cắt ngắn, mặc dù labels/response metadata wrap, dropdown mở có full options và không overflow/overlap. Xem editor-1280.png/fr-1280.png. Gate06 chỉ tạo regression/handoff, nên không tự redesign panel hoặc split layout đã review; cần Reviewer đánh giá đây có phải UX finding actionable hay không. Không claim browser UX hoàn hảo.
- **Artifacts:** `%TEMP%/tv3-19-06-baseline-20261013-190557/` giữ browser setup/check/extra scripts, logs, 10 screenshots (editor/hints375/768/1280, fr375/768/1280, quota375), snapshot/console ở playwright-cli-artifacts. Task-created .playwright-cli folder được xác minh paths/timestamps và chuyển khỏi repo vào baseline; browser session và Vite task đã đóng. Initial scratch route pattern trùng module path gây ERR_FAILED, đã sửa exact API URL rồi reload; error ban đầu không phải production defect.
- Không test bằng live Gemini/quota, không semantic model evaluation, không chạy human screen reader hoặc mọi trình duyệt. Browser evidence dùng synthetic fixtures; unit/accessibility assertions không thay cho manual assistive-technology audit.

### Handoff / next required action

- Implementation gates01–06 có evidence; full frontend/build pass và existing work nguyên vẹn. Approved plan giữ nguyên theo master constraint. Không thêm production fix, schema/backend/dependency changes; không stage/commit/push/rebase.
- **Next required action:** Codex Reviewer review **toàn feature TV3-19**, đối chiếu plan, append-only handoff, current dirty/untracked files và integration/browser evidence. Đánh giá residual narrow-select observation, không coi IMPLEMENTED là final PASS. Implementer dừng tại review gate.

## 2026-10-13 — Codex Reviewer: TV3-19-06 — PASS

- **Agent:** Codex Reviewer. **Reviewed scope:** re-review TV3-19-06 — Integration regression và bàn giao; không thay thế full-feature review TV3-19.
- **Decision: PASS.** Không xác nhận P0/P1 trong scope gate19-06. Required integration/regression và verification evidence đáp ứng approved acceptance; P2 UI follow-up bên dưới không chặn gate này.
- **Change boundary:** HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch feature/TV3-00-contract-audit, staged rỗng. Đã kiểm tra tracked unstaged diff và đọc untracked TV3-19 files liên quan. Gate19-06 chỉ thêm `writingHintsWorkspaceContract.test.tsx` và handoff; manifest 18 baseline files cho thấy chỉ handoff thay đổi, approved plan và production/prior tests giữ nguyên. Không audit `.codex/` hoặc workbook unrelated.

### Verified acceptance criteria / integration

- **AC-01/02/03/05:** real WorkspacePage → hooks → API/normalizer → panel/Redux pipeline; tests mới chỉ mock shared HTTP transport và browser APIs. Practice/Writing/locked gates, allowlisted POST/no essay or provider fields, response identity rejection, omitted backend-default languages, explicit en/vi/fr, full localized content, inert HTML-like text và safe 403/quota handling có assertions trên production behavior. Tám ngôn ngữ và boundary validation được kiểm tra bởi focused contract/API/panel tests hiện có.
- **AC-04/06:** bounded 150s timeout/abort; manual retry giữ immutable UUID/payload dù dropdown thay đổi; regenerate cần confirmation, cancel không POST; pending/rate-limit countdown không auto-dispatch. Same-qid/different-part, route A→B→A, authoritative rehydration/conflict reload, StrictMode/unmount và late rejection/finally được kiểm tra. HTTP replay fixture không chứng minh backend idempotency thật.
- **AC-07:** đã đọc browser setup/check/extra scripts và logs, xem screenshots desktop1280, tablet768 và mobile375. Exact local API routing, native keyboard disclosure/selects/generate/confirmation, cancel0 POST/new-UUID confirm, localized content/quota và no document overflow có saved evidence; editor không bị che hoặc disable bởi hints. Reviewer không rerun browser hoặc human screen-reader audit. Residual select truncation được ghi riêng bên dưới, không claim UX hoàn hảo.
- **AC-08:** hints-only giữ toàn bộ Redux snapshot, không PUT/Storage.setItem hoặc sửa existing draft. Edit trong flight giữ essay/dirty/version rồi normal autosave v7→v8; pending hints bị suspend/abort trước manual submit mà không chờ, finalAnswers/baseVersion/deadline đúng, submission retry giữ payload và chỉ success mới redirect. TIMEOUT_CLIENT/overlay ordering được bổ sung bởi focused production page/submission regression, không dựng Practice deadline trái contract.
- **Coverage:** 17 integration cases mới bổ sung vào các focused suites tương ứng TC_19_01–18; không coi test names, mocked hook callbacks hoặc fixture metadata assertion đơn lẻ là proof của actual backend authorization/model quality.

### Findings

- **IN-SCOPE:** không có confirmed P0/P1/P2 được giới thiệu bởi gate19-06; không có required regression/handoff fix.
- **OUT-OF-SCOPE của gate19-06, TV3-19 UI follow-up — [P2] F19-06-01:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:172` dùng viewport breakpoint `sm:grid-cols-2`, dù panel nằm trong editor pane hẹp. Saved `editor-1280.png` với sidebar/default split50/50 cho thấy cả select en/vi chỉ hiển thị “Tiếng”, khó xác nhận ngôn ngữ trước request tiêu thụ quota; mobile375 một cột đọc được. Đây là panel behavior từ gate19-04, không phải regression mới của gate19-06; native dropdown vẫn có đầy đủ options, nên không nâng thành P1.
  - **Minimal fix:** stack hai controls khi actual panel width hẹp (container breakpoint hoặc một cột); không redesign sidebar/split layout.
  - **Regression:** browser1280/default sidebar+split và narrow editor pane, chọn en/vi/fr/default rồi kiểm tra selected language phân biệt được khi dropdown đóng, keyboard vẫn dùng được và không che editor/overflow. Saved artifacts tại `%TEMP%/tv3-19-06-baseline-20261013-190557/`.
- Không xác nhận defect unrelated khác. Existing lint/bundle advisories, backend quota/idempotency/provider semantics, live model language quality và full-feature sign-off không thuộc gate regression frontend này; không mở rộng audit hoặc gọi live services.

### Focused verification / evidence boundaries

- **Reviewer-run:** tại `frontend/`, `npm test -- src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/writingHintsErrors.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/useWritingHints.test.tsx src/features/exam/__tests__/WritingHintsPanel.test.tsx src/features/exam/__tests__/WorkspaceWritingHints.test.tsx src/features/exam/__tests__/writingHintsWorkspaceContract.test.tsx src/features/exam/__tests__/practiceWorkspaceContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/resumeContract.test.tsx` — **exit0, 10 files / 433 tests PASS**, start **19:21:49**, duration **8.33s**, 2026-10-13.
- **Reviewer-run:** `npm run build` exit0 (tsc -b/Vite, 2179 modules); `npm run lint` exit0, **0 errors / 28 existing warnings**, không warning ở integration test mới. Existing >500kB advisory không phải gate19-06 regression.
- **Reported/saved evidence, không rerun:** full frontend **65 files / 1234 tests PASS** (start19:16:07, duration38.68s); đã đọc final log và browser scripts/logs/screenshots. Không chạy full frontend/backend, actual backend/provider/quota hoặc gửi external messages.
- **Integrity:** tracked `git diff --check` exit0; CRLF-aware no-index whitespace check test mới không diagnostics (exit1 do file mới). Manifest baseline chỉ handoff khác; handoff trước implementation giữ nguyên byte prefix. Review chỉ append handoff, không sửa production/tests/approved plan, stage/commit/push.
- **Skills:** `tv3-code-review` giới hạn quyết định theo requested gate và phân tách reported/reviewer evidence; `verification-before-completion` yêu cầu fresh focused/build/lint trước PASS; `ui-ux-pro-max` checklist cùng `systematic-debugging` hỗ trợ đối chiếu screenshot/source cho P2 (search UX không có match đặc thù nên không dùng làm rule citation).

### Next required action

- TV3-19-06 được PASS; có thể yêu cầu full-feature review TV3-19 riêng. Xử lý F19-06-01 trong UI follow-up theo phạm vi được giao, không coi đây là production fix đã được thực hiện. Reviewer dừng sau ghi nhận và báo cáo.

## 2026-10-13 — Codex Reviewer: TV3-19 FULL FEATURE re-review — PASS

- **Agent:** Codex Reviewer.
- **Reviewed scope:** toàn bộ TV3-19 Writing hints UI, gates19-01–06; approved plan, latest matching IMPLEMENTED/FIXED/PASS entries và current staged/unstaged/untracked changes. Đây là full-feature decision, không chỉ kế thừa PASS của gate19-06.
- **Decision: PASS.** Không xác nhận P0/P1 còn mở trong feature. AC-01–08 đạt theo code và evidence bên dưới; một P2 UX không chặn nghiệm thu được giữ làm follow-up, không claim UI hoàn hảo.
- **Git boundary:** HEAD `57280d1f5272ad4e5c9b4f278beb77c9d7ef93ec`, branch feature/TV3-00-contract-audit; staged rỗng. Tracked diff gồm API/types/WorkspacePage/API tests; đọc trực tiếp untracked normalizer/classifier/hook/panel/fixtures và regression tests. Tất cả code changes thuộc frontend exam feature; backend/shared Axios/auth/router/catalog/dependencies không đổi. Đọc backend DTO/controller/request validator hiện có chỉ để đối chiếu frontend contract, không audit lại TV3-18.

### Acceptance criteria — verified across all six gates

| AC | Kết quả / bằng chứng |
|---|---|
| AC-01 | PASS: page dùng canonical part/section/question identity, không fallback editor ID; hook kiểm tra live store/attempt, persisted Practice/IN_PROGRESS, unique snapshot membership, WRITING/ESSAY, section/submission locks trước POST. Controls chỉ thay notice Writing ESSAY; objective và ESSAY ngoài Writing giữ luồng cũ. |
| AC-02 | PASS: exact `/v1/attempts/:id/writing-hints`, allowlist IDs/UUID/optional languages, omit defaults, positive Java integer/UTF-16 question-ID bounds, Web Crypto UUID; response code200/data, four identities, timestamp, language/shape/text/count bounds và public deep-copy projection. Không gửi essay/answers/user/provider fields hoặc extra exam lookup. |
| AC-03 | PASS: panel import tám catalog languages read-only; request aliases/region/script canonicalized, backend defaults và explicit override đối soát; backend-resolved tag ngoài catalog không bị loại/fallback English. Labels/generated-content lang dựa response; edited selection sống qua same-operation completion, cancel phục hồi operation selection. |
| AC-04 | PASS: synchronous mutex trước UUID/await; operation/payload immutable, retry cùng UUID dù dropdown thay đổi; new operation cần confirmation và cancel0 POST. Whole-request/Axios deadline150000ms bao gồm stalled transport/interceptor wait; APIs cũ vẫn10000ms. 409 pending/conflict/ended và429 cooldown/quota phân biệt; timer chỉ redraw, không application polling/auto-retry. |
| AC-05 | PASS: outline/vocabulary/limitations đầy đủ, React text không HTML/Markdown execution; allowlist loại private fields, fixed error copy không đưa raw backend message lên UI. Prior hints giữ khi transient failure, classified reason vẫn hiện; access/ended/conflict clear unauthorized/stale data. Không grading/autofill/essay mutation hoặc payload logging mới. |
| AC-06 | PASS: per-part/question memory trong attempt/context epoch; part switch abort wait nhưng giữ operation retry, route/hydration/unmount clear context; metadata refresh/essay edits không invalidate. Identity-checked completion/finally không cập nhật/unlock flight mới. Initial manual/timeout submit và hai overlay retry suspend ngay, không chờ hints; store lock chặn captured callbacks. |
| AC-07 | PASS với P2 bên dưới: native labelled selects/buttons, disclosure ARIA/hidden target, short status/alert, inline labelled confirmation và focus styles. Saved Chrome keyboard/layout evidence375/768/1280 không che/disable editor hoặc document overflow. Không coi jsdom/synthetic content là human screen-reader hoặc mọi trình duyệt verification. |
| AC-08 | PASS: hints hook không dispatch answer mutation hoặc đọc/ghi/xóa draft/storage; integration giữ full Redux snapshot/draft, edit trong flight giữ dirty/version, normal autosave và finalAnswers/baseVersion/submission retry giữ contract. Full frontend/build/lint verification mới thành công, không thay backend/shared code/dependencies. |

- **Test quality / coverage:** contract/error tests import production implementations; API/hook tests mock HTTP/time, không mock normalizer/controller đang được kiểm tra. Panel tests dùng component thật với callbacks spies; WorkspaceWritingHints page tests mock hooks để kiểm tra wiring, không được dùng riêng làm end-to-end proof. 17 writingHintsWorkspaceContract cases dùng page/hints/workspace/autosave/submission hooks/API/normalizer/reducer thật, chỉ mock transport/browser APIs. Combined suites bao phủ TC_19_01–18, including negative boundaries, gates, private-field projection/XSS, timeout/retry, two-task mutex, same-qid parts, A→B→A/hydration, locks/StrictMode, editor integrity và submit failure/retry.
- **Previous corrections:** gate19-01 language/default equality/grammar/envelope/timestamp/whitespace và gate19-02 context recovery/Retry-After corrections còn hiện trong production và tests; F19-04-01/P1 classified error masking và F19-04-02/P2 selection overwrite vẫn CLOSED. Không phát hiện scope expansion hoặc required feature behavior thiếu.

### IN-SCOPE findings

- **P0/P1:** không có confirmed finding còn mở.
- **[P2] F19-06-01 — retained, nay IN-SCOPE toàn feature:** `frontend/src/features/exam/components/practice/WritingHintsPanel.tsx:172` dùng `sm:grid-cols-2` theo viewport thay vì chiều rộng actual panel. Với browser1280/sidebar/default split50/50, saved `editor-1280.png` cho thấy hai select en/vi chỉ còn “Tiếng”, khó kiểm tra language trước thao tác tạo hints có dùng quota. Mobile375 một cột đọc được; native dropdown vẫn có full options và selection/payload đúng, nên không nâng thành P1. Không tạo finding trùng với gate19-06.
  - **Minimal fix:** chuyển hai language controls thành một cột khi panel hẹp (container-width breakpoint hoặc stack luôn); không redesign workspace/sidebar/split ratio.
  - **Focused regression:** browser1280/default split/sidebar và editor pane hẹp; chọn en/vi/fr/default, đóng dropdown rồi kiểm tra selected language phân biệt được, Tab/Enter hoạt động, không overflow/che editor.
  - **Evidence boundary:** reviewer đọc source và xem ảnh đã lưu; không rerun actual browser trong lượt này. P2 được xác nhận từ artifact cùng source hash, không claim đã sửa.

### OUT-OF-SCOPE / limitations

- `.codex/`, `backend/Exam_Template.xlsx`, 28 existing lint warnings và large-bundle advisory không do TV3-19 gây ra; không đưa thành blockers hoặc audit/fix unrelated files.
- Backend ownership/quota/ledger/provider semantics của TV3-18, shared auth refresh/replay và các defects attempt/autosave đã biết không bị thay đổi bởi diff này. Không xác nhận defect mới ngoài scope; UI guard không được mô tả là thay thế backend authorization.
- HTTP fixtures chứng minh frontend contract/orchestration/rendering, không chứng minh actual backend replay/quota, semantic language quality của Gemini thật, human screen-reader usability hoặc cross-browser completeness. Browser initial ERR_FAILED do scratch mock route trùng module đã được sửa exact local API route; subsequent429 là mocked quota, không phải production finding.
- Approved plan checklist gates03–06 còn chưa tick theo prior no-plan-edit constraint; latest handoff có IMPLEMENTED/evidence cho cả sáu gate, nên không coi bookkeeping này là missing implementation.

### Verification — independently run in this review

```powershell
# frontend/
npm test
npm run build
npm run lint
# repository root
git diff --check
git status --short
```

- **Full frontend:** exit0, **65 files / 1234 tests PASS**, start **19:30:37**, duration **36.18s**, ngày2026-10-13. Approved plan explicitly yêu cầu final full frontend verification; không chạy full backend. Bao gồm tất cả focused TV3-19 và existing workspace/autosave-submit/resume/objective regressions. Existing jsdom media pause notices không fail tests.
- **Build:** exit0, tsc -b/Vite,2179 modules, Vite919ms; existing >500kB chunk advisory.
- **Lint:** exit0, **0 errors / 28 existing warnings**, không warning mới ở normalizer/classifier/hook/panel/tests.
- **Saved/reported browser evidence, không rerun:** đọc setup/check logs, native Tab/Enter disclosure/select/create/confirmation/cancel và allowlisted requests; no-overflow/editor-enabled375/768/1280; xem editor1280 và localized fr375 screenshots. Browser artifacts: `%TEMP%/tv3-19-06-baseline-20261013-190557/`. Không mở live backend/provider/quota hoặc external service.
- **Integrity:** tracked diff check exit0; CRLF-aware no-index checks **13 untracked feature files/docs**, không whitespace diagnostics. SHA256 manifest18 baseline files chỉ handoff khác, production/test/plan vẫn khớp saved browser baseline. Append bảo toàn byte prefix handoff trước review; không production/test/plan edits, staging/commit/push/rebase.
- **Skills applied:** `tv3-code-review` yêu cầu cross-gate acceptance và phân tách in/out-of-scope; `verification-before-completion` yêu cầu fresh final suite/build/lint; `ui-ux-pro-max` giới hạn web controls/error/accessibility review, không redesign; `systematic-debugging` đối chiếu source/desktop-vs-mobile artifact để xác định viewport breakpoint là nguyên nhân P2. UX search recommendations không được biến thành repository-specific rule hoặc speculative finding.

### Next required action

- TV3-19 full feature **PASS**, không có required P0/P1 fix/re-review. Có thể tiếp tục task TV3 tiếp theo khi được giao; F19-06-01 là UI follow-up không chặn. Không tự sửa P2 hoặc thay đổi approved plan. Reviewer dừng sau append và báo cáo.
