# TV3-MULTILINGUAL Completion — Handoff

## 2026-10-21 — Codex Executor — Initialized

- Plan: `TV3-MULTILINGUAL-completion-plan.md`.
- Baseline: `b016894`, branch `feature/TV3-multilingual-completion`; working tree clean.
- Planning evidence: backend 122 PASS; frontend 6 files / 81 PASS; `git diff --check` PASS.
- Implementation evidence at initialization: none.
- User decision: new submissions for `LANGUAGE_PRACTICE` and non-English exams, including NLTV, use generic Writing rubric `0–10` after feature enablement; historical jobs/results remain unchanged and no old NLTV attempt is regraded.
- Contract decisions: Dictionary v2 uses nested `definition`, `schemaVersion: 2`, singular `example/exampleTranslation`; v1 stays compatible. PostgreSQL isolated integration and browser/IME are required gates.

| Task | Status | Dependency |
|---|---|---|
| ML-C00 | IN_PROGRESS | — |
| ML-07A | PLANNED | ML-C00 |
| ML-07B | PLANNED | ML-07A |
| ML-07C | PLANNED | ML-07A, ML-07B |
| ML-07D | PLANNED | ML-07B |
| ML-08A | PLANNED | ML-C00 |
| ML-08B | PLANNED | ML-08A |
| ML-08C | PLANNED | ML-08A |
| ML-08D | PLANNED | ML-08A–C |
| ML-09A | PLANNED | ML-08D |
| ML-09B | PLANNED | ML-09A, ML-10A |
| ML-10A | PLANNED | ML-C00 |
| ML-10B | PLANNED | ML-10A |
| ML-10C | PLANNED | ML-09B, ML-10A/B, ML-07C/D |
| ML-11A | PLANNED | ML-07–10 |
| ML-11B | PLANNED | ML-08D, ML-11A |
| ML-11C | PLANNED | ML-11A/B |

`ML-FULL-01` remains open until the whole feature has been reviewed against AC-01–12. This handoff is append-only; the original multilingual and NLTV history is preserved.

## Executor notes

- Rechecked current baseline and repository state before changes.
- Before each task, append `IN_PROGRESS`; after completion append files, exact test commands/results and AC mapping.
- Do not commit/push or use the application database. Generic grading is feature-flagged off by default.
- Stop only at approved security/persistence/product-contract conflicts; record precise evidence.

## 2026-10-21 — ML-C00 — IMPLEMENTED

- Files: completion plan/handoff created; main handoff appended; corrected fixture in `PracticeDictionaryV2ContractIT`.
- RED: strengthened contract assertion expecting `definition.schemaVersion=2`; the first run failed because the mocked fixture serialized `1`.
- GREEN: corrected mock fixture to `2`; final focused run `.\mvnw.cmd '-Dtest=PracticeDictionaryV2ContractIT' test` — **2 PASS, 0 failures/errors/skips**.
- AC: compatibility contract fixture now matches actual v2 response. No production behavior changed.

## 2026-10-21 — ML-07A — IMPLEMENTED

- Files: shared learning-language catalog and parity tests; Vocab re-export; Hints request canonicalization; strict workspace language-context projection; accessible explanation-language selector and tests.
- RED/GREEN: changed legacy alias expectations (`fre`, `ger`, `chi`) and observed Hints contract fail; after the shared catalog update, focused tests pass. A malformed policy/source/duplicate language list now normalizes to unavailable `languageContext` while keeping workspace readable.
- Verification: `npx vitest run src/core/i18n/__tests__/learningLanguages.test.ts src/features/exam/__tests__/ExplanationLanguageSelect.test.tsx src/features/exam/__tests__/writingHintsContract.test.ts src/features/exam/__tests__/attemptApi.test.ts --maxWorkers=2` — **4 files / 255 tests PASS**.
- AC: AC-01, AC-02, AC-06. No profile API call added.
- Contract ruling recorded in SDD ledger: valid server-configured BCP 47 response tags remain displayable; explicit selection catalog is limited to the default eight languages.

## 2026-10-21 — ML-07B — IMPLEMENTED

- Files: added typed Dictionary v2 request/definition/response, strict v2 normalizer, and v2 API function; existing v1 function and endpoint remain available.
- RED/GREEN: v2 API test failed before the function existed; added exact path, nested schema and identity/language tests.
- Verification: three focused Vitest files — **14 tests PASS**; `npx tsc -b --pretty false` — **PASS**.
- AC: AC-06, AC-11. Both versions share 40-second bounded transport; v2 has no v1 fallback.

## 2026-10-21 — ML-07C — IMPLEMENTED

- Files: Dictionary selection now validates source language against immutable workspace snapshot, supports one-character/CJK selections and code-point-safe context; Practice popup requires explicit lookup, uses V2 response and renders as text; Hints now treats source language as read-only and resolves omitted explanation language from frozen workspace metadata. Workspace passes account identity into dictionary/hints operation scope.
- RED/GREEN: updated old English-only/learning-language-editable fixtures; focused suite initially exposed missing account identity in the shared test store and stale expected mock meaning. The test store now includes the auth reducer and fixtures match the mock response.
- Verification: focused frontend group (Dictionary, Flashcard, Hints, selector, API/contract/selection tests) — **10 files / 207 tests PASS**; `npx tsc -b --pretty false` — **PASS**.
- AC: AC-02, AC-06, AC-10, AC-11. Mock/locked requests remain blocked; no auto-lookup on popup open.

## 2026-10-21 — ML-07D — IMPLEMENTED

- Files: `dictionaryFlashcardApi.ts`, `DictionaryFlashcardForm.tsx` and focused tests now use the returned V2 definition language pair, restrict deck choices to the authenticated owner/private matching pair, and preserve source passage as the saved example.
- RED/GREEN: converted the former hard-coded `en/vi` test contract to V2; verified stale operation identity and API payload using the same request result.
- Verification: included in the focused frontend group above — **10 files / 207 tests PASS**; `npx tsc -b --pretty false` — **PASS**.
- AC: AC-07, AC-11. PostgreSQL read-back/concurrency remains for ML-11B; no live user deck was modified.

## 2026-10-21 — ML-08A — IMPLEMENTED

- Files: added server-owned `WritingRubricPolicy`/`WritingRubricRegistry`, versioned context/result codecs, and a default-off `testing.writing-grading.multilingual-enabled` flag. English and generic policy mapping is derived from exam type + canonical snapshot language.
- RED/GREEN: registry test first failed to compile because the policy type did not exist; context/result codec tests likewise showed missing codecs. Implemented only the policy/codec layer; existing job flow is not yet wired to it and remains for ML-08B–D.
- Verification: `.\mvnw.cmd '-Dtest=WritingRubricRegistryTest,WritingGradingContextCodecTest,WritingGradingResultCodecTest' test` — **6 PASS, 0 failures/errors/skips**; prior English grading regressions `WritingGradingGeneratorTest,WritingGradingOutputParserTest,WritingGradingPromptFactoryTest` — **59 PASS, 0 failures/errors/skips**.
- AC: rubric discriminator, legacy unversioned context/result recognition, safe rejection of unknown/mismatched new metadata. Generic execution remains disabled and is not yet claimed complete.

## 2026-10-21 — Codex Executor — ML-08B–D / ML-09A–B / ML-10A — IMPLEMENTED WITH REMAINING FEATURE GATES

- ML-08B: `feedbackLanguage` is optional at submit; manual submission freezes the selected value in the existing single-flight request, while server-timeout finalization does not trust a client choice. The workspace confirmation dialog now exposes a supported-language selector from snapshot `languageContext`; changing attempt resets the selection. Backend resolves/validates language before finalization and enqueuer freezes source/feedback/rubric/length/prompt metadata in schema-versioned context/input hash.
- ML-08C/D: generic 0–10 parser/prompt policy, server-calculated overall, English-only short-essay rule, nonempty CJK essays reaching provider path, generic empty essay system result, worker/coordinator schema codecs, and default-off multilingual grading flag are implemented. The lease integration assertion was corrected to calculate from effective test properties; production lease calculation was not changed.
- ML-09A/B: result summary now reads persisted grading jobs for the authenticated attempt and exposes a score only when a version-2 result passes the server-owned rubric codec. Legacy/no-job/pending/failed/malformed results remain without score. Result DTO includes rubric, score unit, feedback language and length metric. Frontend validates the rubric/unit/max tuple, permits 10 only for `WRITING_GENERIC_V1`, renders generic practice score distinctly from IELTS band, and translates the Writing summary through the new `exam` namespace. Generic feedback mapping uses the frozen result policy; historic unversioned English mapping remains legacy.
- ML-10A: added/registers English and Vietnamese `exam` namespaces and a key-parity test. This is only the namespace foundation; broad migration of TV3 pages/components/error messages (ML-10B/10C) is not complete.
- RED/GREEN note: ML-09 generic score test first exposed no job-aware summary projection; mapper and job input were added. Generic frontend contract test initially used the wrong envelope shape; corrected the test fixture to the real direct `WritingFeedbackResponse` shape. No provider or production database calls were made.
- Backend evidence: `.\mvnw.cmd '-Dtest=WritingRubricRegistryTest,WritingGradingContextCodecTest,WritingGradingResultCodecTest,WritingGradingEnqueuerTest,WritingGradingContextReaderTest,WritingGradingOutputParserTest,WritingGradingPromptFactoryTest,WritingGradingGeneratorTest,WritingGradingTransactionCoordinatorTest,WritingGradingTransactionCoordinatorIT' test` — **121 PASS, 0 failures/errors/skips**. `.\mvnw.cmd '-Dtest=WritingFeedbackContractIT,ResultSummaryContractIT,SubmitAttemptImmutableKeysTest,TestAttemptGracePeriodTest' test` — **103 PASS, 0 failures/errors/skips**. Lease test alone — **1 PASS**.
- Frontend evidence: focused submit/result/API run — **6 files / 279 PASS**; rubric/result/i18n run — **3 files / 129 PASS**; a preceding overlap run — **4 files / 136 PASS**. `npx tsc -b --pretty false` PASS; `npm run lint` exit 0 with existing warnings; `npm run build` PASS with existing large-chunk warning.
- Remaining work: ML-10B and ML-10C broad TV3 UI translation/accessibility/locale-switch regression; ML-11A lifecycle fake-provider integration; ML-11B isolated PostgreSQL migration/replay/concurrency evidence; ML-11C browser/IME smoke, matrix and final full-feature review. PostgreSQL test credentials were not configured/used; browser and real IME were not tested. Do not mark feature complete or enable multilingual grading for learners until those gates pass.
- Status: ML-08A–D implemented with focused evidence; ML-09A–B implemented with focused evidence; ML-10A namespace foundation only; ML-10B/C and ML-11A–C remain PLANNED.
- Additional regression found and fixed: `WritingFeedbackMapper` previously validated v2 result metadata and then attempted to deserialize the full persisted map into provider `WritingGrade`, which rejected internal `schemaVersion`/rubric fields and returned `MALFORMED_FEEDBACK`. It now returns the strict parser's allowlisted `WritingGrade` projection after independently validating persisted score/diff integrity. `WritingFeedbackMultilingualMapperTest` verifies a short Japanese essay receives a real generic 10/10 result instead of the English <=10-word short-circuit.
- Verification of this narrow fix: `.\mvnw.cmd '-Dtest=WritingFeedbackContractIT,WritingFeedbackMultilingualMapperTest' test` — **86 PASS, 0 failures/errors/skips**; legacy English compatibility preserved.

## 2026-10-21 — Final verification refresh

- After the last result-contract/i18n changes: `npx vitest run src/features/exam/__tests__/examI18n.test.tsx src/features/exam/__tests__/writingFeedbackContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/WritingResultSummary.test.tsx src/features/exam/__tests__/SubmitConfirmModal.test.tsx --maxWorkers=2` — **4 files / 132 PASS**; `npx tsc -b --pretty false` and `npm run build` — **PASS**.
- Added `docs/testing/TV3-MULTILINGUAL-matrix.md` and `docs/testing/TV3-MULTILINGUAL-browser-smoke.md` to separate collected evidence from required gates. Browser/IME, isolated PostgreSQL and provider language quality remain NOT VERIFIED.
- `git diff --check` was rerun after source and documentation edits: exit 0; only LF/CRLF working-copy warnings. No database, provider, CDN, commit or push was used.

## 2026-10-21 — Continued execution — ML-10B/C and ML-11 — IN_PROGRESS

- User explicitly requested continued implementation through the whole feature. Kept existing completion changes and branch `feature/TV3-multilingual-completion`.
- Locale RED: `examLocaleSwitch.test.tsx` reproduced unchanged Vietnamese editor placeholder and submit dialog after switching to English. GREEN: real editor/submit selector retain DOM identity, raw composing text and language choice; focused UI group **27 PASS**.
- Migrating TV3 start/workspace/Practice/result/review labels to `exam` namespace, translating classified errors at render time and adding the existing language switcher to workspace. Locale stays outside request/hydration identities.
- Consumer regressions reproduced dropped Writing length metrics, ignored public schema versions and rejection of generic empty SYSTEM results. Fixes underway; same integration check exposed legacy `wordCount` incorrectly containing character count.
- First broad backend gate: **2057 run, 14 failures, 2 errors, 40 skipped**. Failures include missing catalog wiring in isolated grading configuration, outdated Hints fixtures missing snapshot language, summary assertions expecting null after new versioned grading, and a pre-existing official bundle fixture gate. Each is being investigated; no assertions are removed to hide failures.
- First broad frontend gate: **1734 run, 25 failures**. The findings include locale-source collisions and lost JSX whitespace, stale English-only selection fixtures, and existing builder alias compatibility checks. Corrections and rerun pending.
- Created disposable PostgreSQL container `tv3-multilingual-test-20261021`, database `tv3_multilingual_test`, published only on loopback port 50892. Application database at port 5434 was not accessed. The initial reserved-port container never started and was removed before creating this one.

## 2026-10-22 — Codex Executor — ML-10B/C + ML-11A/B/C — IMPLEMENTED, final review pending

- This final verification entry supersedes the earlier interim `IN_PROGRESS`/failing broad-suite snapshots below; those entries remain unchanged as execution history. Latest broad reruns are the successful counts recorded here and in `docs/testing/TV3-MULTILINGUAL-matrix.md`.
- ML-10B/C: completed the `exam` namespace migration across TV3 start/workspace/practice/result/review controls and error presentation. UI locale is independent from snapshot source language and explanation language; locale changes do not key/remount the workspace or alter request identities. Builder/library generic-language labels and legacy NLTV type normalization remain compatible.
- ML-11A: added end-to-end lifecycle contracts using real page/hooks/reducers/normalizers and backend services/coordinators with fake Gemini/media. Covered eight learning-language fixtures across Vietnamese/English UI, including Dictionary v2, Flashcard, Hints, generic Writing scoring, historical unavailable jobs, ownership/scope, stale operation and locale-switch behavior.
- ML-11B: created a disposable PostgreSQL 17 cluster bound only to `127.0.0.1:50892`, with a separate UTF-8 database `tv3_multilingual_test`. The first run used Windows-1252 and failed while storing Japanese fixture text; this was test-environment encoding, not an application failure. Recreated only that disposable database as UTF-8 and reran successfully. `MultilingualTv3LifecycleIT,MultilingualDictionaryPostgresIT,MultilingualWritingPostgresIT`: **15 PASS, 0 failures/errors/skips**. Tests cover real repositories/transaction proxies, dictionary idempotency/refund/replay, migration context, and writing worker claim/fencing. The application database on port 5434 was not contacted.
- ML-11C browser smoke: isolated Vite runtime + Playwright/Chrome + intercepted fake APIs. Verified Japanese passage at 1366/768/375 px, keyboard Tab focus, simulated composition events (explicitly not native IME), selection of `水`, mocked ja→vi Dictionary v2 popup, private Flashcard save UI, switch to English UI, and Japanese writing text with combining mark/emoji and character count. Screenshots: `output/playwright/tv3-ja-desktop.png`, `output/playwright/tv3-ja-mobile.png`; detailed record: `docs/testing/TV3-MULTILINGUAL-browser-smoke.md`. Physical IME, audio playback, and live Gemini quality remain NOT VERIFIED.
- Verification: backend broad suite `.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test` — **2,069 tests; 0 failures/errors; 47 skipped; BUILD SUCCESS**. This deliberately excludes the workbook-writing test and is not the original full suite. Frontend `npx vitest run --maxWorkers=2` — **117 files / 1,753 tests PASS**; `npx tsc -b --pretty false` PASS; `npm run lint` exit 0 with repository warnings; `npm run build` PASS with large-chunk warning. Root `git diff --check` and `git diff --cached --check` PASS (only existing LF/CRLF warnings).
- Feature flags remain safe-by-default; no real provider call, production seed, app database write, commit, or push occurred. Generic multilingual grading was not enabled for learners.
- Residual rollout gates: human evaluation of actual AI quality by language, physical Japanese/Korean/Chinese IME, and remaining browser cases enumerated in the browser-smoke record. Automated fake-provider tests do not certify model quality.
- AC mapping: AC-01/02 covered by catalog/snapshot/policy and lifecycle tests; AC-03 by existing generic-language publication/start regressions; AC-04/05 by Unicode grading/length tests; AC-06/07 by Dictionary v2/Hints/Flashcard lifecycle and isolated PostgreSQL tests; AC-08/09 by rubric/result/review/Diff Unicode tests; AC-10/12 by locale/i18n, autosave/submit, ownership and workspace regression. Full feature verdict awaits independent review below.

## 2026-10-22 — Codex Executor — ML-FULL-01 — REVIEW PENDING

- Requested independent review of the complete implementation against the approved completion plan, main handoff, all tracked and untracked changes, and AC-01–12.
- No final PASS is recorded until review findings are resolved or explicitly ruled out with evidence.

## 2026-10-22 — Codex Executor — ML-11C supplemental async-state regression

- Added regression for locale switching while autosave HTTP is in flight: held the real frontend lifecycle mock response pending, switched locale, asserted editor identity/raw text and single PUT were preserved, then resolved the response. The lifecycle test runs across 8 source languages × 2 UI locales.
- Added an `AudioPlayer` + real `LanguageSwitcher` regression: while simulated playback is active at 18.25s, switching locale preserves the same audio element, source, position and active playback state.
- Verification: `npx vitest run src/features/exam/__tests__/examLocaleSwitch.test.tsx src/features/exam/__tests__/multilingualTv3LifecycleContract.test.tsx --maxWorkers=2` — **2 files / 19 tests PASS**.
- Native OS IME remains unverified. At the user's request I attempted to attach to the running Chrome with Computer Use; the helper stopped safely because it could not determine the current browser URL with confidence, so no UI input was sent. Simulated composition tests are not claimed as native IME evidence. This remains the only validation blocker to full-feature acceptance, separate from the live-provider quality gate required before learner rollout.

## 2026-10-22 — Independent full-feature review — BLOCKED

- Reviewer inspected the approved completion plan/handoff and the full tracked/untracked implementation against AC-01–12. **No production code defect or P0/P1/P2 code finding was identified.** Diff and cached-diff checks pass.
- Review initially identified missing 768px, keyboard, autosave-in-flight and active-audio locale evidence. Executor added the 768px Playwright check and keyboard focus smoke plus focused regressions for autosave-in-flight and active AudioPlayer state; **2 files / 19 tests PASS**. Pending submit remains covered by existing locale regression.
- Final verdict remains **BLOCKED on native OS IME validation**: approved ML-11C requires real Japanese, Chinese and Korean IME testing separately from simulated composition. Computer Use could not confidently identify the current browser URL and stopped without sending input. This is a validation-only blocker; not an implementation defect.
- Actual Gemini language quality is a separate rollout gate, not claimed by fake-provider tests. No learner release should be inferred from implementation/test completion alone.
- This verdict supersedes `ML-FULL-01 — REVIEW PENDING` above; prior progress/failure entries remain preserved as historical records.

## 2026-10-22 — User-requested native IME smoke retry — BLOCKED

- Re-read the current TV3-MULTILINGUAL review and plan. The two confirmed P1 findings from the latest review are already fixed and independently re-reviewed; the only remaining acceptance blocker is native OS IME validation.
- Preflight found only `en-US` and `vi-VN` installed. Windows capability inspection requires Administrator elevation, which this session does not have. Chrome's local debugging endpoint returns HTTP 404 and no frontend is listening on port 5173, so there is no identified TV3 exam page to focus. No text was entered and no OS settings were changed.
- Evidence and exact commands/outcomes are recorded in `docs/testing/TV3-MULTILINGUAL-browser-smoke.md`. Native ja/zh/ko smoke remains unverified; simulated composition is not substituted.
- The requested `NLTC-EXAM-INGESTION-handoff.md` does not exist in this repository. This TV3-specific outcome is recorded here and in the TV3 browser-smoke record. Do not request final feature re-review as if the IME acceptance gate had passed; resume after the three OS IMEs and the project exam page are available.

## 2026-10-23 — User-requested native IME retry — BLOCKED

- The user supplied the live authenticated app URL. A one-skill Writing Practice attempt was opened for the available Cambridge IELTS 20 Test 1; attempt 87 is on `/attempts/87` and remains unsubmitted. The language-practice library filter returned no exams, so this available fixture has English source language.
- Windows inventory lists Japanese `ja-JP` (`LpCab`), Chinese `zh-CN` (`BasicTyping`), and Korean `ko-KR` (`BasicTyping`). Native desktop capture then failed twice (`FrameArrived timed out`, `window capture timed out`); no native key input occurred.
- This is still a validation blocker rather than an implementation finding. Do not treat DOM keyboard entry or Unicode paste as native IME evidence. Do not request final full-feature re-review until real IME input for all three languages is observed.
- No production code or tests changed in this retry. `NLTC-EXAM-INGESTION-handoff.md` remains absent; this update is recorded in the feature-specific TV3 handoffs.

## 2026-10-23 — User-performed native IME smoke — PASS, final review requested

- The user reports completing ja/zh/ko input on the TV3 Writing textarea in attempt 87. Attached screenshots show Japanese IME candidates including `こんにちは`, Chinese Pinyin candidates including `你好`, and committed Korean `안녕하세요` in the editor.
- Japanese and Chinese captures show candidate popups still open; their committed end state is user-reported, while Korean committed text is visible. The workspace uses Cambridge IELTS 20 Test 1 with English source language, so this is evidence for native IME input in the Writing control only. It does not verify generic-language grading or real-provider quality.
- Attempt 87 remains unsubmitted. No source code or tests changed. Request final full-feature review against the plan, previous P1 fixes, and this manual evidence; reviewer should note the screenshot limitation for ja/zh.

### 2026-10-23 — Completion status reconciliation

- Đối chiếu toàn bộ completion plan với implementation, smoke-test record và final independent review: **ML-C00, ML-07A–D, ML-08A–D, ML-09A–B, ML-10A–C, ML-11A–C đều IMPLEMENTED**. Bảng PLANNED ở đầu file là snapshot lúc khởi tạo; lịch sử này được giữ nguyên.
- Final full-feature review trong `TV3-MULTILINGUAL-handoff.md` kết luận **PASS**, AC-01–12 đạt và không còn finding P0/P1/P2. Reviewer chạy lại 102 frontend tests, 26 backend tests và `git diff --check`; broad suites, PostgreSQL và browser evidence trước đó được dẫn chiếu từ các entry cũ, không được tính là chạy lại trong final review.
- Smoke ja/zh/ko đã được ghi nhận cho textarea Writing thật ở attempt 87; ảnh ja/zh chụp khi candidate popup còn mở, trạng thái commit cuối là người dùng xác nhận. Attempt chưa nộp.
- Không còn subtask triển khai hoặc kiểm thử nghiệm thu kỹ thuật đang mở. Human review chất lượng Gemini theo từng ngôn ngữ vẫn là **rollout gate riêng**, không phải subtask kỹ thuật chưa hoàn thành; chưa bật feature flag hay khẳng định chất lượng provider.
