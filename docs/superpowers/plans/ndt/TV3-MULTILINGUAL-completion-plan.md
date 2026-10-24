# TV3-MULTILINGUAL Completion — Hoàn tất ML-07–11

**Ngày:** 2026-10-21  
**Trạng thái:** IMPLEMENTED — final full-feature review PASS (2026-10-23)
**Baseline:** `b016894`, `feature/TV3-multilingual-completion`; working tree sạch khi bắt đầu.

## Mục tiêu và nguyên tắc

Hoàn thiện Dictionary/Flashcard/Hints, Writing grading, result/review/Diff và UI Việt/Anh cho `en, vi, ko, zh, ja, fr, de, es`. Đây là phần tiếp nối approved plan; không làm lại ML-01–06. Giữ snapshot và kết quả lịch sử; UI locale độc lập với ngôn ngữ đề/AI; không tự dịch đề; giữ quyền attempt, quota, lease, autosave, deadline, section lock và answer restore. Không thêm dependency, không gọi Gemini thật trong test, không seed/publish database ứng dụng, không commit/push.

Quyết định đã duyệt: bài nộp mới của `LANGUAGE_PRACTICE` và mọi đề ngoài English, gồm NLTV, dùng `WRITING_GENERIC_V1` / `PRACTICE_0_10` sau khi bật flag. Đề English hiện có giữ rubric 0–9. Job/kết quả cũ không đổi và không auto-regrade.

Dictionary v2 hiện có trả `data.definition` với `schemaVersion: 2`, `example` và `exampleTranslation`. Frontend phải giữ v1 tương thích nhưng chuyển luồng mới sang v2. Source language luôn lấy từ attempt snapshot; explanation/feedback language là lựa chọn explicit, rồi native hợp lệ, rồi source. Job mới đóng băng policy và ngôn ngữ.

## Baseline verification

- Backend: 122 tests PASS trên sáu lớp Dictionary v2/Writing grading; chưa chạy PostgreSQL hoặc broad suite.
- Frontend: 6 files / 81 tests PASS trên Dictionary, Flashcard, Hints, Writing feedback và length.
- `git diff --check`: PASS; chưa có browser/provider thật.

## Tasks

Mỗi thay đổi hành vi theo RED → GREEN → REFACTOR; trước task append `IN_PROGRESS`, sau task append files, lệnh/kết quả và AC mapping vào handoff. Không ghi RED giả cho behavior đã đúng.

### Task 1 — ML-C00: Baseline, compatibility fixtures và tài liệu

- Tạo completion plan/handoff; append link và trạng thái hiện hành vào handoff gốc mà không sửa lịch sử.
- Tạo fixture legacy English job/result, NLTV `UNAVAILABLE`, Dictionary v1 và v2 thực (`definition.schemaVersion=2`). Sửa fixture mocked schema sai trong `PracticeDictionaryV2ContractIT`.
- Ghi nhận suite failures nền nếu có; không coi ML-01–06 đã đạt lifecycle chỉ từ handoff.
- AC: có trạng thái và fixture phân biệt legacy với schema mới.

### Task 2 — ML-07A: Catalog ngôn ngữ và selector

- Tạo `frontend/src/core/i18n/learningLanguages.ts`, `features/exam/components/practice/ExplanationLanguageSelect.tsx` và tests.
- Vocab re-export catalog; Hints contract dùng canonicalizer khớp backend (tám ngôn ngữ, ISO3 alias được backend chấp nhận, region/script hợp lệ; từ chối `english/chi/fre/ger`, underscore và tag sai).
- Validate workspace `languageContext`; lỗi metadata chỉ vô hiệu hóa thao tác AI, không khóa workspace. Source read-only, không gọi profile API.
- Files chính: `features/vocab/types/vocab.types.ts`, `features/exam/api/writingHintsContract.ts`, `features/exam/api/attemptApi.ts`.
- Tests: `learningLanguages.test.ts`, `ExplanationLanguageSelect.test.tsx`, `writingHintsContract.test.ts`, `attemptApi.test.ts`.
- AC: 01, 02, 06.

### Task 3 — ML-07B: Dictionary v2 API/normalizer

- Giữ `lookupPracticeDictionary` v1; thêm `lookupPracticeDictionaryV2` và `dictionaryLookupV2Contract.ts`.
- Gọi `/v2/attempts/{id}/dictionary-lookups` đúng một lần, deadline 40s, abort/timer cleanup; không fallback v1.
- Validate envelope, identity, `definition.schemaVersion===2`, cặp ngôn ngữ, giới hạn, nullable IPA/POS và đúng tên `example/exampleTranslation`.
- Tests: request path, v1 response rejection, sai requestId/part/document/language/schema, timeout/late response.
- Files: `api/dictionaryLookupApi.ts`, `types/api.types.ts`; test mới `dictionaryLookupV2Contract.test.ts`.
- AC: 06, 11.

### Task 4 — ML-07C: Dictionary/Hints workspace UI

- Sửa hook, selection util, popup, Hints panel/hook và `WorkspacePage.tsx`.
- Selection 1–80 Unicode code points; max 5 từ với ngôn ngữ phân tách bằng khoảng trắng; zh/ja theo code points. Context cắt theo code points và không cắt surrogate.
- Request đóng băng UUID + language pair; retry chưa rõ kết quả dùng lại intent. Đổi context/ngôn ngữ/account/attempt/submit vô hiệu hóa response cũ; không tự gọi AI khi đổi locale/ngôn ngữ.
- Hints source read-only từ snapshot; popup plain React text, có `lang`, loading/error/retry và keyboard controls.
- Tests gồm `水`, `a`, `I`, 80/81 code points, same-language, A→B→A, double-click, account switch, submit pending, Mock/locked.
- Files: `hooks/usePracticeDictionary.ts`, `utils/dictionarySelection.ts`, `components/practice/PracticeDictionaryPopover.tsx`, `WritingHintsPanel.tsx`, `hooks/useWritingHints.ts`, `pages/WorkspacePage.tsx`.
- AC: 02, 06, 10, 11.

### Task 5 — ML-07D: Flashcard theo cặp ngôn ngữ

- Derive `targetLanguage` từ `definition.learningLanguage`, `sourceLanguage` từ `meaningLanguage`.
- Chỉ chọn deck private của owner, pair khớp canonical script/region; tạo/lưu meaning + source context; fence response cũ theo owner/request/pair.
- Giữ duplicate code 1210, single-flight, timeout chưa xác nhận và lỗi không làm mất lookup.
- Files: `api/dictionaryFlashcardApi.ts`, `DictionaryFlashcardForm.tsx`; tests hiện có mở rộng.
- AC: 07, 11.

### Task 6 — ML-08A: Rubric registry và codec

- Tạo `WritingRubricPolicy`, `WritingRubricRegistry`, `WritingGradingContextCodec`, `WritingGradingResultCodec` trong packages hiện tại.
- English hiện hữu → `WRITING_EN_V1/BAND_0_9/max9`; generic/non-English mới → `WRITING_GENERIC_V1/PRACTICE_0_10/max10`; English `LANGUAGE_PRACTICE` cũng generic.
- Flag `testing.writing-grading.multilingual-enabled=false`; context schema 2 bắt buộc policy đầy đủ. Không version tiếp tục legacy; unknown/mismatch fail closed trước quota/provider.
- Giữ constructors cũ; result codec kiểm tra metadata persisted độc lập provider.
- Sửa `WritingGradingContext`, `WritingGrade`, `WritingGradingProperties`, application properties.
- Tests: `WritingRubricRegistryTest`, `WritingGradingContextCodecTest`, `WritingGradingResultCodecTest`.
- AC: 05, 08, 11.

### Task 7 — ML-08B: Feedback language khi submit

- Thêm optional `feedbackLanguage`; validate sau ownership/idempotency, trước mutation. Source từ snapshot; feedback explicit/native/source.
- Context/hash đóng băng source, feedback, rubric, length/prompt policy; submit lặp giữ receipt/job cũ.
- `TIMEOUT_SERVER` dùng default và bỏ finalAnswers/lựa chọn client theo semantics hiện có.
- FE đóng băng lựa chọn trong submission flight; retry chưa xác nhận giữ lựa chọn.
- Files: `SubmitAttemptRequest`, `TestAttemptServiceImpl`, `AttemptLanguageResolver`, `WritingGradingEnqueuer`, `WritingGradingContextReader`, FE attempt API/hook/page.
- Test mới `MultilingualWritingSubmissionIT`: invalid không mutate, duplicate, profile đổi, timeout, flag off vẫn lưu essay chưa chấm.
- AC: 02, 08, 11, 12.

### Task 8 — ML-08C: Prompt/parser và length policy

- Tạo `writing-grading-generic-v1.txt` và English multilingual-feedback template.
- Parser theo policy server, criteria `TR/CC/LR/GRA`, half-step, max, source/feedback language; server tính average `HALF_UP`, không tin score/rubric model.
- English giữ <=10 từ legacy. Generic chỉ empty/Unicode whitespace thành SYSTEM score 0 `EMPTY_ESSAY`; CJK có nội dung qua provider. Không bịa AI feedback.
- Giữ multimodal raw-text preflight trước fetch, encode ảnh sau fetch.
- Sửa prompt factory/parser/generator; tests tương ứng cho score 9/9.5/10, language, empty, CJK.
- AC: 05, 08.

### Task 9 — ML-08D: Worker/persistence/retry

- Coordinator/worker đọc context mới qua codec, dùng policy đã đóng băng, persist versioned results; legacy format giữ decoder cũ.
- Giữ lock order, lease fencing, refund, provider ngoài transaction. Retry/recovery không đọc profile/live exam.
- Test late completion, retry, image generic với fake fetch/provider, unsupported/empty không fetch/reserve.
- Files: `WritingGradingTransactionCoordinator`, `WritingGradingWorker` và tests.
- AC: 08, 11, 12.

### Task 10 — ML-09A: Backend result/review lịch sử

- DTO/mapper feedback, summary, result, review công khai rubric/version/source+feedback language/scoreUnit/max/lengthMetric.
- Đọc grading jobs một lần; map theo `(partId, questionId)`. `DONE` và score chỉ từ persisted result qua codec; status khác score null.
- Result/review lấy ngôn ngữ từ snapshot; không dùng live exam/profile. Giữ legacy output, `wordCount`, raw objective riêng và không regrade.
- Files: `WritingFeedbackMapper`, `AttemptResultSummaryMapper`, response DTOs, result/review mapping `TestAttemptServiceImpl`.
- Test mới `MultilingualWritingFeedbackContractIT` và mapper/summary regression.
- AC: 08, 09.

### Task 11 — ML-09B: Frontend result/review/Diff

- Normalizer phân biệt legacy/new discriminator và kiểm tra rubric/unit/max tuple; generic không hiện IELTS band.
- UI dùng `lengthMetric`, legacy fallback `wordCount`; review một feedback panel mỗi Part có essay, đúng language.
- Giữ raw text/CRLF/NFD/UTF-16; bổ sung Nhật/Hàn/Trung/emoji. Highlight/Diff từ chối range cắt surrogate, không normalize passage.
- Files: writing/result/review contracts, writing result components, `ExamReviewPage`, presentation util, highlight utils/tests.
- Test mới `multilingualWritingFeedbackContract.test.tsx`.
- AC: 05, 08, 09.

### Task 12 — ML-10A: i18n namespace và message model

- Thêm `locales/vi/exam.json`, `locales/en/exam.json`, `features/exam/i18n/examMessages.ts`, đăng ký namespace trong `i18n.ts`.
- Async state lưu kind/code/params; translate lúc render. Dùng error map cố định, không hiển thị raw backend message.
- Test key parity, interpolation và plural.
- AC: 10.

### Task 13 — ML-10B: Workspace/start/status i18n

- Chuyển nhãn ở Workspace/Start, palette/timer/save/submit/time-up/overlay/scope và hook messages; tái sử dụng `LanguageSwitcher`.
- Locale không vào request identity/hydration key/reset effects; không remount editor/audio.
- Date/number theo UI locale; server deadline/timezone giữ nguyên.
- Tests: locale đổi khi answer dirty, IME composing, autosave/audio/submit pending.
- AC: 10, 12.

### Task 14 — ML-10C: Practice/result/review và controls

- Chuyển nhãn trên các page/component TV3 thực tế, error helpers, feedback/dictionary/highlight/review/result; chỉ generic labels library/builder thuộc luồng này.
- Dịch status/loading/error/accessibility labels; giữ nguyên nội dung đề/AI/options/token.
- Locale đổi không gọi lại AI, tạo UUID hoặc xóa state; tests mobile/keyboard.
- AC: 07, 09, 10, 12.

### Task 15 — ML-11A: Lifecycle provider fake

- Backend `MultilingualTv3LifecycleIT`, FE `multilingualTv3LifecycleContract.test.tsx` dùng service/page/hooks/reducer/normalizer thật, chỉ fake Gemini/media và mock HTTP/browser.
- Cover 8 languages × 2 UI locales, publish→library→start→autosave→resume→submit→worker→result/review; Practice Dictionary/Flashcard/Hints/retry; Mock AI blocks; ownership/lock/stale/profile/history.
- NLTV new generic, old job stays `UNAVAILABLE`; legacy English jobs unchanged.
- AC: 01–12.

### Task 16 — ML-11B: PostgreSQL integration

- Tạo `MultilingualDictionaryPostgresIT` và `MultilingualWritingPostgresIT`; DB riêng `tv3_multilingual_test`, `TV3_PG_TEST_URL/USER/PASSWORD`, UUID schema, strict database-name guard.
- Apply existing `V20261020180000__add_dictionary_language_context.sql`; do not duplicate migration.
- Test real repository/transaction proxies: UUID/quota races, replay/profile change, recovery/refund, JSONB rubric context/results, worker lease fencing/late completion.
- Missing DB is SKIP, not PASS. Never target application DB.
- AC: 06, 08, 11, 12.

### Task 17 — ML-11C: Browser, verification, handoff

- Add `docs/testing/TV3-MULTILINGUAL-matrix.md`, `TV3-MULTILINGUAL-browser-smoke.md`.
- Test 375/768/1366px, keyboard, real Japanese/Chinese/Korean IME separately from simulated composition, Vietnamese typing, selection/Diff, pending UI state.
- Record all PASS/FAIL/SKIP, AC map, residual risks; request whole-feature review. Do not close `ML-FULL-01` before that review.
- AC: 01–12.

## Acceptance criteria

AC-01 canonicalize eight language tags, preserve valid region/script and fail closed. AC-02 source from attempt snapshot and explanation/UI language independent. AC-03 generic exam publication/list/start remains compatible. AC-04 Unicode objective Practice/submit consistency. AC-05 CJK length and rubric. AC-06 scoped multilingual Dictionary/Hints. AC-07 owner and language-pair Flashcards. AC-08 discriminated Writing rubric and historical results. AC-09 historical Diff/Highlight offsets. AC-10 UI vi/en state-preserving locale switch. AC-11 frozen replay/quota/job policy. AC-12 security/accessibility/autosave/resume/submit/lock regression.

## Verification

Run focused suites after each task. Final backend broad gate: `.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test` (broad suite excluding workbook writer, not original full suite). PostgreSQL tests run separately against isolated test DB; skipped tests are not PASS. Frontend: `npx vitest run --maxWorkers=2`, `npx tsc -b --pretty false`, `npm run lint`, `npm run build`. Root: `git diff --check`, `git diff --cached --check`, `git status --short`. No real Gemini/CDN calls in automated tests.

## Rollout

Deploy backend legacy/new readers → migrate Dictionary on staging → deploy FE v2/i18n → fake/provider, PostgreSQL and browser gates → enable generic multilingual grading on staging. Learner release requires language quality review; fake provider tests do not establish Gemini quality. Rollback by disabling new flags while retaining decoders/results. Never delete jobs, mutate snapshots or regrade history.
