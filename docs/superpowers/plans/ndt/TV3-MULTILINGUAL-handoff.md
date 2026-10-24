# TV3-MULTILINGUAL — Handoff

### 2026-10-20 — Codex Executor — IN_PROGRESS

**Baseline:** `ffd329fed2ba49480ffcdbe756ebc548e26b3b84`, branch `feature/TV3-00-contract-audit`; working tree clean before execution.  
**Approved decisions:** eight learning languages; TV3 UI vi/en; source language from immutable attempt snapshot; explanation language selected by learner/default native; generic non-English Writing rubric; generic exam type `LANGUAGE_PRACTICE`.  
**Planning evidence:** backend 113 focused tests PASS; frontend 112 focused tests PASS; `git diff --check` PASS (per approved plan).  
**Implementation evidence:** started; no implementation tests run in this execution yet.

### 2026-10-20 — ML-01 — IMPLEMENTED

**Files:** Added `TestingLanguageProperties`, `TestingLanguageConfiguration`, `AttemptLanguageResolver`, and `AttemptLanguageContextResponse`; updated `LearningLanguageAdapter`/`DbLearningLanguageAdapter`, moved the catalog bean out of `WritingHintsConfiguration`, wired language context and `TV3_LANG_V1` stamp into new attempt snapshots/workspace, and added resolver/config/workspace tests.

**RED evidence:** Initial `AttemptLanguageResolverTest` run failed compilation because the planned resolver and properties types did not yet exist.  
**GREEN evidence:** `cd backend; .\mvnw.cmd '-Dtest=AttemptLanguageResolverTest,TestAttemptWorkspaceResponseTest,WritingHintsPropertiesTest,LearningLanguageCatalogTest' test` — 50 tests, 0 failures/errors/skips; BUILD SUCCESS. Existing test logs contain expected grading-failure fixture stack traces; they did not fail the suite.  
**Coverage:** alias `eng`, region/script tags, native-language default, unsupported-native fallback to source, missing/conflicting snapshot tags, new/legacy supported-language configuration, workspace language context, new-attempt policy stamp.  
**AC mapping:** AC-01 and workspace metadata portion of AC-02.  
**Residual:** AI operation enforcement, persisted explanation-language choice, and metadata on result/review remain in ML-05/08/09. `TestAttemptServiceImpl` keeps constructor overloads for manually constructed tests; Spring uses the resolver-aware constructor.

### 2026-10-20 — ML-02 — IMPLEMENTED

**Files:** Added generic publication validator; routed generic validation through admin create/update/publish gates; canonicalized language tags for generic requests; included section durations in generic exam duration; added language filter to the published library query and `examLanguage` to library/learner-structure projections.

**RED evidence:** `LanguagePracticePublicationValidatorTest` initially failed compilation because the planned validator did not exist.  
**GREEN evidence:** `cd backend; .\mvnw.cmd '-Dtest=LanguagePracticePublicationValidatorTest,AdminExamServiceImplTest,ExamContentNormalizerTest,StudentExamLanguageFilterTest,LearnerExamStructureServiceTest,TestAttemptWorkspaceResponseTest' test` — 33 tests, 0 failures/errors/skips; BUILD SUCCESS. `StudentExamLanguageFilterIT` — 1 test PASS on the isolated H2 test profile, proving `zh` includes `zh-*` and unpublished rows stay excluded.  
**Coverage:** generic valid publish, unsupported language, SPEAKING rejection, invalid answer key, admin save gate/duration, alias normalization, learner structure language, direct attempt snapshot/start, region/script library query.  
**AC mapping:** AC-03 and source-language projection portion of AC-02.  
**Residual:** `OfficialCatalogPostgresIT` was skipped because its PostgreSQL prerequisite is unavailable. A combined regression invocation also reached `OfficialExamsContractIT` and errored in existing TOEIC bundle parsing at `parseToeicBundle`; it was not reproduced on baseline, so it remains unclassified and requires follow-up.

### 2026-10-20 — ML-03 — IN_PROGRESS

Beginning builder/library/start UI and type normalization. No ML-03 production implementation recorded yet.

| Task | Status | Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IN_PROGRESS | Inspecting current catalog, adapters and workspace path. |
| ML-02 Generic exam backend | PLANNED | — |
| ML-03 Builder/library/start | PLANNED | — |
| ML-04 Unicode/length/objective grading | PLANNED | — |
| ML-05 Hints snapshot policy | PLANNED | — |
| ML-06 Dictionary v2/ledger | PLANNED | — |
| ML-07 FE AI/Flashcard | PLANNED | — |
| ML-08 Multilingual Writing grading | PLANNED | — |
| ML-09 Result/review/Diff history | PLANNED | — |
| ML-10 TV3 UI vi/en | PLANNED | — |
| ML-11 Integration/browser/handoff | PLANNED | — |

### 2026-10-20 — ML-06 — verification update

**Latest verification:** From `backend/`, `./mvnw.cmd '-Dtest=DictionaryLookupV2RequestValidatorTest,DictionaryLookupV2OutputParserTest,DictionaryLookupTransactionCoordinatorTest,PracticeDictionaryContractIT,PracticeDictionaryControllerIT' test` — **21 tests PASS**, 0 failures/errors/skips. This includes Spring application-context startup with both dictionary controllers and existing v1 HTTP contract regressions. `DictionaryLookupTransactionCoordinatorTest` now verifies request fingerprints distinguish v1/v2 and explicit/default language intent.

**Residual:** This remains `IN_PROGRESS`; there is not yet a v2 end-to-end HTTP success test exercising authenticated ownership, language snapshot resolution, AI fake, persisted replay, failed-request retry after profile change, or isolated PostgreSQL migration/concurrency. The current test command uses H2 and mocks for existing v1 contracts, so it does not prove those properties.

### 2026-10-20 — ML-06 — IN_PROGRESS

**Files added/changed so far:** Added v2 request/response DTOs, strict language-aware request validator, neutral output parser, multilingual prompt factory/generator, `/api/v2/attempts/{id}/dictionary-lookups` controller/service; added nullable `context_json` ledger field and migration `V20261020180000__add_dictionary_language_context.sql`; extended the existing dictionary coordinator to reserve/refund through the same quota/lease/idempotency flow, fingerprint v2 meaning-language intent, freeze resolved source/meaning languages in the ledger, and replay v2 payloads without v1 field names.

**RED/GREEN evidence:** `DictionaryLookupV2RequestValidatorTest` initially exposed a source-language validation issue and then passed. Latest command from `backend/`: `./mvnw.cmd '-Dtest=DictionaryLookupV2RequestValidatorTest,DictionaryLookupV2OutputParserTest,DictionaryLookupTransactionCoordinatorTest,PracticeDictionaryContractIT,PracticeDictionaryControllerIT' test` — **20 tests PASS**, 0 failures/errors/skips. Spring H2 context starts with the v2 beans; v1 controller contracts continue to pass. No Gemini provider or PostgreSQL user database used.

**AC mapping:** Partial AC-06 and AC-11: request contract, neutral output parsing, frozen language context, v1 compatibility and shared quota workflow are implemented. No PostgreSQL concurrency/recovery evidence yet.

**Remaining before ML-06 can be marked IMPLEMENTED:** Add focused v2 service/controller contract tests (ownership, source language from snapshot, replay with profile change, UUID conflict across language intent, provider failure/refund), exercise the new migration on isolated PostgreSQL, tighten parser trailing-token handling, and complete request validation edge cases. ML-07 frontend v2 API/hook/popover/Flashcard work has not started.

### Current execution status — 2026-10-20 (append-only)

| Task | Status | Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 focused backend tests PASS |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 isolated H2 integration test PASS |
| ML-03 Builder/library/start | IMPLEMENTED | 174 focused frontend tests PASS; TS build PASS |
| ML-04 Unicode/length/objective grading | IN_PROGRESS | 119 backend + 32 frontend focused tests PASS; result/job `lengthMetric` wiring remains |
| ML-05 Hints snapshot policy | IMPLEMENTED | 42 unit tests + 16 H2 contract tests PASS |
| ML-06 Dictionary v2/ledger | IN_PROGRESS | 20 focused backend tests PASS; PostgreSQL and v2 service contract gaps remain |
| ML-07 FE AI/Flashcard | PLANNED | — |
| ML-08 Multilingual Writing grading | PLANNED | — |
| ML-09 Result/review/Diff history | PLANNED | — |
| ML-10 TV3 UI vi/en | PLANNED | — |
| ML-11 Integration/browser/handoff | PLANNED | — |

### 2026-10-20 — ML-04 — IN_PROGRESS (partial implementation)

Added `WritingLengthCounter` on the backend and `writingLength.ts` on the frontend. Integrated the counter into essay entry UI, added `lang` to the essay textarea, and suppressed implicit 150/250-word defaults for `LANGUAGE_PRACTICE` while preserving explicit prompt/metadata requirements. Added snapshot-scoped NFC comparison for objective free-text grading; raw answers remain unchanged. Practice feedback propagates the attempt's `TV3_LANG_V1` stamp into its transient grading snapshot.

**RED/GREEN evidence:** `WritingLengthCounterTest` and `writingLength.test.ts` first failed because implementations were absent. An initial Java focused run found an incorrect test expectation for Korean (the approved character-count policy is only `zh`/`ja`); corrected the assertion. GREEN: backend `WritingLengthCounterTest,SnapshotGradingKeyExtractorTest,ObjectiveGradingServiceTest,AttemptGradingInputFactoryTest,PracticeFeedbackEvaluatorTest` — 119 tests PASS. Frontend `writingLength.test.ts,EssayRenderer.multilingual.test.tsx,examPartUtils.test.ts,QuestionRenderer.test.tsx` — 32 tests PASS; `npx tsc -b --pretty false` PASS.

**Remaining in ML-04:** expose/persist `lengthMetric` for AI writing jobs and result/review, confirm NFC behavior across complete submit and Practice HTTP contract, and expand language fixtures/IME coverage. Task stays IN_PROGRESS.

### 2026-10-20 — ML-05 — IMPLEMENTED

New Writing Hints requests now resolve source language from attempt snapshot, reject an explicit learning-language mismatch, and resolve explanation language as explicit choice → supported user native language → source language. The resolved policy and source language are frozen in the existing request context JSON; successful replay and failed retry continue to use frozen ledger context. No migration was needed because the existing JSON context column stores this state.

**RED/GREEN evidence:** Added resolver tests before implementation for snapshot source, native preference, mismatch and unsupported native fallback. GREEN: `WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest` — 42 tests PASS. `WritingHintsContractIT` — 16 tests PASS on isolated H2 after updating old target-language expectations to the approved snapshot/native policy. No external provider was called.

**AC mapping:** AC-02, AC-06, AC-11 replay behavior. `WRITING_HINTS_SUPPORTED_LANGUAGES` compatibility remains intact through ML-01 configuration.

### Current execution status — 2026-10-20 (append-only update)

| Task | Status | Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 focused backend tests PASS |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 isolated H2 integration test PASS |
| ML-03 Builder/library/start | IMPLEMENTED | 174 focused frontend tests PASS; TS build PASS |
| ML-04 Unicode/length/objective grading | IN_PROGRESS | 119 backend + 32 frontend focused tests PASS; lengthMetric result/job wiring remains |
| ML-05 Hints snapshot policy | IMPLEMENTED | 42 unit tests + 16 H2 contract tests PASS |
| ML-06 Dictionary v2/ledger | PLANNED | — |
| ML-07 FE AI/Flashcard | PLANNED | — |
| ML-08 Multilingual Writing grading | PLANNED | — |
| ML-09 Result/review/Diff history | PLANNED | — |
| ML-10 TV3 UI vi/en | PLANNED | — |
| ML-11 Integration/browser/handoff | PLANNED | — |

**Constraints:** no real provider, user database, source content change, commit or push. Preserve legacy contracts/results, answers, autosave/resume, deadlines, locks, ownership and quota semantics.

**Execution note:** The approved implementation plan was supplied in the user message; these repository documents initialize its task register and execution evidence. No production implementation evidence is claimed until focused tests have run.

### 2026-10-20 — ML-03 — IMPLEMENTED

**Files:** Added generic builder mapper and tests; updated `ExamBuilder.tsx`/`ExamBuilderPage.tsx` to edit and save `LANGUAGE_PRACTICE` with explicit language, skill and duration; added typed exam-language metadata and API normalization for workspace/start structure; added library language filter and correct generic exam classification; added builder/library/start regression tests.

**RED/GREEN evidence:** `ExamContentMapping.test.ts` was added before mapper implementation and confirmed the missing generic mapper. Focused GREEN command from `frontend/`: `npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/attemptApi.test.ts --maxWorkers=2` — 6 files, 174 tests PASS. `npx tsc -b --pretty false` — PASS. `git diff --check` — PASS (one Git LF/CRLF advisory only).

**Coverage:** Generic editor round-trip retains language/section/part/group; source-language filter is sent to the library API; generic cards are not mislabeled NLTV; start page displays normalized language and uses backend-provided skill/part structure; conflicting language aliases become unavailable metadata without blocking legacy workspace load.

**AC mapping:** AC-01, AC-02, AC-03; frontend portion of AC-10 remains in ML-10.

**Residual:** Browser/manual visual review not performed. ML-03 is complete for the current language-practice contract; no claim of end-to-end grading or AI language support yet.

### Current execution status — 2026-10-20

| Task | Status | Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 focused backend tests PASS |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 isolated H2 integration test PASS |
| ML-03 Builder/library/start | IMPLEMENTED | 174 focused frontend tests PASS; TS build PASS |
| ML-04 Unicode/length/objective grading | PLANNED | — |
| ML-05 Hints snapshot policy | PLANNED | — |
| ML-06 Dictionary v2/ledger | PLANNED | — |
| ML-07 FE AI/Flashcard | PLANNED | — |
| ML-08 Multilingual Writing grading | PLANNED | — |
| ML-09 Result/review/Diff history | PLANNED | — |
| ML-10 TV3 UI vi/en | PLANNED | — |
| ML-11 Integration/browser/handoff | PLANNED | — |

### 2026-10-20 — Codex Reviewer — FULL FEATURE RE-REVIEW — NEED_FIX

**Phạm vi:** Toàn bộ TV3-MULTILINGUAL theo plan được duyệt trong yêu cầu triển khai, bản plan trong repository và toàn bộ handoff. Review tại HEAD `ffd329fed2ba49480ffcdbe756ebc548e26b3b84`; kiểm tra 55 tracked files có diff và 32 untracked files, bao gồm production, tests, migration và tài liệu. Staged diff rỗng. Đã đọc `GEMINI.md` và skill `tv3-code-review`. Review chỉ append entry này; không sửa production, tests hoặc plan.

**Quyết định duy nhất cho toàn feature: NEED_FIX.** Có 4 P1 và 4 P2 được xác nhận; không có P0 được xác nhận. Feature cũng chưa triển khai hết: ML-04/06 còn một phần và ML-07–11 chưa có deliverables tương ứng. Các phần chưa làm được ghi ở mục readiness bên dưới, không dùng thay cho bằng chứng bug hoặc phủ nhận riêng các focused tests đã PASS.

#### Findings trong phạm vi

1. **ML-R01 — P1 — Publication cho phép answer key rỗng/sai shape.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/exam/service/LanguagePracticePublicationValidator.java:128–129`, `validateQuestion`. Với `FILL_IN_THE_BLANK`, chỉ kiểm tra khác null nên `correct_answer: []`, `""` hoặc object vẫn được xuất bản; TFNG/YNNG/matching cũng bỏ qua token/options hợp lệ. Reviewer gọi trực tiếp validator với fill-in key `[]`: `issues=[]`. Câu này không có đáp án đúng có thể dùng để chấm. **Sửa tối thiểu:** kiểm tra key theo canonical question type (string không rỗng/danh sách alternate strings hợp lệ; TFNG/YNNG token hợp lệ; matching key thuộc options) tại publication gate. **Regression:** create/update/publish từ chối từng malformed key, giữ draft theo chính sách, key hợp lệ vẫn grade được. AC-03/04.

2. **ML-R02 — P1 — Chấp nhận `WRITING_ESSAY` nhưng không canonicalize trước khi lưu.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/exam/service/LanguagePracticePublicationValidator.java:21,130`; đường liên quan `ExamContentNormalizer.java:20–24`. Generic normalizer trả nguyên question type; validator cho phép alias này. Reviewer xác nhận `WRITING_ESSAY` không answer key vẫn có `issues=[]`. Tuy nhiên `AttemptResultScope.WRITING_TYPES` chỉ có `ESSAY` (`AttemptResultScope.java:20`), và `QuestionRenderer.tsx:98` chỉ render `ESSAY`: đề đã publish có câu không làm/chốt đúng luồng được. **Sửa tối thiểu:** generic JSON chỉ nhận type canonical `ESSAY`, hoặc chuyển alias sang `ESSAY` ở normalizer trước validation/persistence. **Regression:** JSON import → publish → workspace textarea → submit nhận đúng essay, alias không thể tồn tại trong snapshot mới. AC-03/12.

3. **ML-R03 — P1 — Dictionary v2 từ chối từ CJK nằm trong câu không có dấu cách.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/DictionaryLookupContextReader.java:78,169–176`; v2 gọi đường này tại `DictionaryLookupTransactionCoordinator.java:97`. `containsTerm` đòi biên không phải Unicode letter ở cả hai đầu nên chọn `水` trong `水は必要です。` bị lỗi context dù selection/context đều tồn tại trong snapshot; chọn toàn câu lại thành công. Reviewer tái hiện bằng lớp production và v2 validator, không provider/quota. **Sửa tối thiểu:** dùng policy theo source language; với zh/ja cho phép substring đã kiểm chứng trong passage và boundary Unicode hợp lệ, giữ policy từ Latin của v1. **Regression:** lookup một ký tự/từ nằm giữa câu Nhật/Trung không khoảng trắng qua service/controller thật với provider giả, đồng thời context ngoài snapshot vẫn bị chặn trước quota/provider. AC-06.

4. **ML-R04 — P1 — Generic builder bỏ alternate answer khi save/reload.** Vị trí: `frontend/src/features/exams/utils/examContentMapping.ts:237–247`, `toLanguagePracticeRequest`. Mapper xóa toàn bộ `metadata` nhưng chỉ chuyển options/correct answer/explanation/answer_group; `metadata.alternates` mà cả `DbGradingAdapter` và `SnapshotGradingKeyExtractor` hỗ trợ bị mất. Reviewer chạy mapper thật với fill-in `correct_answer: 'café', metadata.alternates: ['cafe']`: payload save không còn alternate. Chỉ mở rồi lưu đề đã làm thay đổi tập đáp án đúng cho attempt mới. **Sửa tối thiểu:** project các metadata grading/constraint được hỗ trợ sang canonical fields (đặc biệt `alternates`) trước khi loại metadata; không copy mù grading/private fields sang workspace. **Regression:** canonical import → editor → save/reload → Practice/submit vẫn chấp nhận alternate và giữ constraints/media cần thiết. AC-03/04, ML-03 round-trip.

5. **ML-R05 — P2 — Builder gộp các section khác nhau theo skill/duration.** Vị trí: `frontend/src/features/exams/utils/examContentMapping.ts:200–205`, `toLanguagePracticeRequest`; `toEditorParts:71–88` không giữ section identity. Backend generic cho phép hai Reading sections riêng, mỗi section có Part 1; round-trip gộp chúng thành một section với part numbers `[1,1]`, rồi publication validator từ chối. Reviewer chạy mapper thật xác nhận kết quả `[[1,1]]`. **Sửa tối thiểu:** giữ stable section identity trong editor và group theo identity khi save; chỉ group theo skill/duration cho parts mới có ý định thuộc cùng section. **Regression:** hai section cùng skill/duration, cùng Part number, save/reload giữ cấu trúc. AC-03, ML-03.

6. **ML-R06 — P2 — FE/BE đếm ký tự CJK khác nhau.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/testing/util/WritingLengthCounter.java:16`; đối chiếu `frontend/src/features/exam/utils/writingLength.ts:14`. Java `Character.isLetterOrDigit` bỏ Unicode Letter_Number/Other_Number còn JS `\p{N}` đếm chúng. Reviewer chạy production utilities với `漢①Ⅷ`: backend trả 1, frontend trả 3. **Sửa tối thiểu:** dùng cùng tập Unicode categories L/N và cùng policy whitespace trên hai bên. **Regression:** shared literal fixtures chứa số khoanh tròn, số La Mã, supplementary letters/numbers và whitespace biên; cùng value/unit/policyVersion. AC-05.

7. **ML-R07 — P2 — Hints kiểm tra alias ngôn ngữ trước canonicalization.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingHintTransactionCoordinator.java:368–374`, `readSnapshotExamLanguage`. Snapshot có `examLanguage='en', exam_language='eng'` được `AttemptLanguageResolver` coi hợp lệ nhưng helper Hints so sánh raw strings và trả null, làm request mới bị LANGUAGE_REQUIRED. **Sửa tối thiểu:** dùng chung snapshot language resolver/canonical comparison; giữ frozen context cho replay/retry. **Regression:** cả hai alias tương đương có region/script được nhận, alias thực sự mâu thuẫn vẫn chặn trước reserve/provider. AC-01/02/06.

8. **ML-R08 — P2 — Workspace FE nhận một alias hợp lệ khi alias còn lại invalid.** Vị trí: `frontend/src/features/exam/api/attemptApi.ts:109–113,149`; logic tương tự ở `api/examApi.ts:19–26`. `languageConflict` chỉ true khi cả hai normalize thành non-null. Reviewer gọi normalizer production với `{examLanguage:'en', exam_language:'it'}` và nhận canonical `en`; backend resolver trả metadata invalid/null cho cùng dữ liệu. FE cũng chấp nhận underscore/sai thứ tự subtags mà Java catalog từ chối. **Sửa tối thiểu:** thống nhất canonical tag policy; nếu hai trường hiện diện, bất kỳ trường invalid hoặc canonical khác nhau phải làm metadata unavailable. **Regression:** valid+invalid alias, wrong type, underscore, sai thứ tự script/region, alias tương đương và thiếu metadata; core legacy workspace vẫn mở. AC-01/02.

#### Readiness và integration toàn feature

- AC-01/02 mới có policy/backend projection và một phần FE; ML-R07/08 còn vi phạm canonical contract. Không có lựa chọn explanation language xuyên suốt UI/job.
- AC-03 có backend/builder/library/start nhưng ML-R01/02/04/05 làm publication/round-trip chưa đạt. Không có lifecycle integration 8 ngôn ngữ.
- AC-04 có NFC comparison copy và unit coverage; chưa có full Practice→submit HTTP evidence theo plan.
- AC-05 có hai counter nhưng ML-R06 và phần `lengthMetric` job/result/review còn thiếu.
- AC-06/07: Hints policy đã đổi; Dictionary v2 backend một phần, ML-R03; FE Dictionary vẫn gọi v1 và Flashcard vẫn theo contract en→vi. ML-07 chưa triển khai.
- AC-08/09: generic rubric registry/prompt, submit `feedbackLanguage`, persisted rubric discriminator, feedback/result/review/Diff metadata và surrogate-boundary tests của ML-08/09 chưa triển khai. Writing context reader hiện vẫn guard `en`; đây là công việc plan còn thiếu, không báo thành regression của task đã hoàn tất.
- AC-10: namespace `exam` vi/en, locale switch giữ state và i18n toàn TV3 của ML-10 chưa triển khai.
- AC-11: ledger v2 đã thêm context nhưng chưa có v2 HTTP success/replay/refund integration hoặc PostgreSQL concurrency/recovery evidence. Các test v1 với mock service không chứng minh pipeline v2.
- AC-12: mới có focused regression; browser/IME/mobile, lifecycle thật với provider giả, PostgreSQL riêng và matrix/handoff ML-11 chưa có. Không thể tuyên bố nghiệm thu toàn feature từ các test hiện tại.

Handoff hiện có nhiều bảng trạng thái cũ nối tiếp nhưng không theo trình tự triển khai (bảng cuối vẫn ghi ML-04/05/06 PLANNED). Review này căn cứ mã thực tế và entries implementation cụ thể: ML-01/02/03/05 đã có implementation; ML-04/06 một phần; ML-07–11 chưa có. Executor cần append một bảng trạng thái hiện hành sau khi sửa, giữ lịch sử cũ.

#### Evidence do reviewer tự chạy

- Backend tại `backend/`: `.\mvnw.cmd '-Dtest=LanguagePracticePublicationValidatorTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingLengthCounterTest' test` — **39 tests PASS; 0 failure/error/skip**, BUILD SUCCESS.
- Frontend tại `frontend/`: `npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts --maxWorkers=2` — **4 files / 168 tests PASS**.
- Runtime probes không tạo/sửa source files: JShell gọi lớp production chứng minh CJK selection bị chặn, empty-key/essay-alias publication được nhận và backend length=1; Node transpile/invoke utilities thực chứng minh mất alternates, merge section `[1,1]`, frontend length=3 và valid+invalid language alias được nhận.
- `git diff --check` — exit 0; chỉ LF/CRLF advisories. Không chạy full/broad suites, provider thật, browser hoặc PostgreSQL trong lượt review này. Test PASS hiện hữu không bao phủ các failure scenarios nêu trên.
- Những số test trong entries executor trước đây là reported evidence; không cộng dồn hoặc diễn giải chúng thành reviewer-run verification.

#### Ngoài phạm vi / vấn đề có sẵn

Không xác nhận thêm defect ngoài phạm vi. Warning `UserMapper.phone`, cảnh báo Java agent/unchecked operations và vấn đề TOEIC bundle/PostgreSQL đã được executor ghi trước đó không được dùng làm findings của review này. Không chạy lại audit dataset hoặc test ghi workbook.

**Bước tiếp theo:** Sửa ML-R01–04 trước, thêm focused regression cho từng repro; xử lý ML-R05–08 và hoàn tất các deliverables còn thiếu theo dependency của approved plan. Chạy các gates còn thiếu trên môi trường thử nghiệm, append evidence rồi yêu cầu re-review toàn feature. Chưa đủ điều kiện PASS/phát hành. Không commit/push trong lượt review.


### 2026-10-20 — TV3-MULTILINGUAL RE-FIX (ML-R01 to ML-R08) — IMPLEMENTED

**Baseline:** `ffd329fed2ba49480ffcdbe756ebc548e26b3b84`, branch `feature/TV3-00-contract-audit`.  
**Phạm vi:** Sửa toàn bộ 8 findings được xác nhận trong Codex Review (`ML-R01` đến `ML-R08`), bổ sung regression tests tập trung cho từng finding, xác minh build và test suites. Không refactor ngoài phạm vi, không commit, không push.

#### Danh sách và kết quả xử lý findings:

1. **ML-R01 (P1) — Publication answer key validation:**
   - **Xử lý:** Tại `LanguagePracticePublicationValidator.java`, bổ sung kiểm tra nghiêm ngặt cho từng canonical question type:
     - `FILL_IN_THE_BLANK`: bắt buộc chuỗi không rỗng hoặc danh sách không rỗng trong đó mọi phần tử là chuỗi không rỗng (`ANSWER_INVALID`).
     - `TRUE_FALSE_NOT_GIVEN`: token bắt buộc thuộc `{"TRUE", "FALSE", "NOT GIVEN", "NOT_GIVEN"}`.
     - `YES_NO_NOT_GIVEN`: token bắt buộc thuộc `{"YES", "NO", "NOT GIVEN", "NOT_GIVEN"}`.
     - `MATCHING_FEATURES` / `MATCHING_INFORMATION`: yêu cầu tối thiểu 2 options có ID duy nhất, và đáp án phải tương ứng với option ID hợp lệ.
   - **Regression tests:** `LanguagePracticePublicationValidatorTest` bổ sung `rejectsMalformedFillInTheBlankAnswerKeys`, `acceptsValidFillInTheBlankAnswerKeys`, `validatesTfngAndYnngTokensStrictly`, và `validatesMatchingOptionsAndAnswer`.

2. **ML-R02 (P1) — `WRITING_ESSAY` alias canonicalization:**
   - **Xử lý:**
     - Tại `LanguagePracticePublicationValidator.java`: giới hạn `ESSAY_TYPES = Set.of("ESSAY")` (chỉ chấp nhận canonical type `ESSAY` ở publication gate).
     - Tại `ExamContentNormalizer.java`: bỏ nhánh return sớm khi gặp `LANGUAGE_PRACTICE` để traverse sections/parts/groups/questions; chuẩn hóa `"WRITING_ESSAY"` thành canonical `"ESSAY"`, nâng `metadata.alternates` lên canonical `alternates`.
   - **Regression tests:** `LanguagePracticePublicationValidatorTest.rejectsWritingEssayAliasAtPublicationGate` và `ExamContentNormalizerTest.normalizesLanguagePracticeWritingEssayToCanonicalEssayAndLiftsAlternates`.

3. **ML-R03 (P1) — Dictionary v2 CJK term lookup in unspaced text:**
   - **Xử lý:** Tại `DictionaryLookupContextReader.java`, bổ sung snapshot language context cho reader. Trong hàm `containsTerm`: nếu snapshot language là CJK (`zh`, `ja`) hoặc selection chứa CJK codepoints, kiểm tra substring match trong canonical context mà không đòi hỏi non-letter word boundary ở hai đầu. Vẫn giữ nguyên Latin word boundary check cho các ngôn ngữ khác và chặn context ngoài snapshot trước quota/provider.
   - **Regression tests:** `DictionaryLookupContextReaderTest.acceptsCjkSubstringWithinUnspacedSentenceInSnapshot` kiểm tra `水` trong `水は必要です。` thành công, đồng thời từ ngoài context tiếp tục bị từ chối.

4. **ML-R04 (P1) — Generic builder drops `alternates` answer on save/reload:**
   - **Xử lý:** Tại `frontend/src/features/exams/utils/examContentMapping.ts` (`toLanguagePracticeRequest` và `toOfficialExamRequest`), giữ lại `alternates: canonical.alternates ?? metadata.alternates` trước khi loại bỏ `metadata`.
   - **Regression tests:** `ExamContentMapping.test.ts` bổ sung `preserves alternates in language practice builder round-trip`.

5. **ML-R05 (P2) — Builder merges sections of identical skill/duration:**
   - **Xử lý:** Tại `frontend/src/features/exams/utils/examContentMapping.ts`:
     - Trong `toEditorParts`: lưu giữ định danh section qua `section_id: section.id ?? section.section_id ?? ('sec_' + sectionIndex)`.
     - Trong `toLanguagePracticeRequest`: gom nhóm sections theo section identity `id:${sectionId}` khi có sẵn thay vì chỉ dùng `skill:${skillType}_${durationMinutes}`, tránh gộp các sections riêng biệt có cùng skill/duration thành `[1, 1]`.
   - **Regression tests:** `ExamContentMapping.test.ts` bổ sung `preserves separate section identity for multiple sections of the same skill and duration`.

6. **ML-R06 (P2) — CJK character length counting discrepancy:**
   - **Xử lý:**
     - Tại `WritingLengthCounter.java`: thay `Character::isLetterOrDigit` bằng `isLetterOrNumber(cp)` (kiểm tra `Character.isLetter(cp)` hoặc các types `DECIMAL_DIGIT_NUMBER`, `LETTER_NUMBER`, `OTHER_NUMBER`) để đồng bộ với regex JS `[\p{L}\p{N}]/u` (`漢①Ⅷ` -> 3 ký tự ở cả BE và FE).
     - Tại `frontend/src/features/exam/utils/writingLength.ts`: chuẩn hóa regex tách từ Latin sang `/[\s\p{Z}]+/u`.
   - **Regression tests:** `WritingLengthCounterTest` và `writingLength.test.ts` bổ sung test case fixture dùng chung `漢①Ⅷ`.

7. **ML-R07 (P2) — Hints raw string alias check before canonicalization:**
   - **Xử lý:**
     - Tại `WritingHintLanguageResolver.java`: bổ sung `resolveSnapshotExamLanguage(Map<String, Object> snapshot)` dùng `LearningLanguageCatalog.findNormalized` để resolve canonical tag.
     - Tại `WritingHintTransactionCoordinator.java`: cập nhật `readSnapshotExamLanguage` chuẩn hóa canonical tag qua `LearningLanguageCatalog.findNormalized` trên cả camelCase và snake_case, chấp nhận alias tương đương (`en` và `eng`) và trả null khi mâu thuẫn hoặc không hợp lệ.
   - **Regression tests:** `WritingHintLanguageResolverTest.resolvesSnapshotExamLanguageCanonicalAliasesAndDetectsConflicts`.

8. **ML-R08 (P2) — Frontend workspace accepts valid alias when other is invalid:**
   - **Xử lý:** Tại `frontend/src/features/exam/api/attemptApi.ts` và `examApi.ts`:
     - Chặn các ký tự không hợp lệ (`_`, `*`, `--`, leading/trailing `-`) và kiểm tra nghiêm ngặt thứ tự subtags theo chuẩn BCP 47 (`language[-script][-region]`).
     - Khi cả hai trường `examLanguage` và `exam_language` cùng tồn tại: bắt buộc cả hai là string hợp lệ và chuẩn hóa về cùng một canonical tag; nếu một trong hai invalid hoặc khác nhau thì trả về `null` (metadata unavailable).
   - **Regression tests:** `attemptApi.test.ts` và `examApi.test.ts` bổ sung test cases bao phủ alias valid+invalid (`en`+`it`), underscore (`en_US`), sai thứ tự subtag (`en-US-Latn`), sai kiểu dữ liệu (`123`), và alias tương đương (`en`+`eng`).

---

#### Bảng trạng thái hiện hành sau re-fix (2026-10-20)

| Task | Status | Deliverables & Verification Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 backend tests PASS; catalog, resolver, properties, workspace context đã chuẩn hóa |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 H2 IT PASS; publication validator & normalizer đã fix ML-R01, ML-R02 |
| ML-03 Builder/library/start | IMPLEMENTED | 179 focused frontend tests PASS; TS build PASS; mapper đã fix ML-R04, ML-R05, ML-R08 |
| ML-04 Unicode/length/objective grading | IN_PROGRESS | 119 backend + 32 frontend tests PASS; length counter đã fix ML-R06; NFC grading copy |
| ML-05 Hints snapshot policy | IMPLEMENTED | 43 unit tests + 16 H2 IT PASS; resolver đã fix ML-R07, frozen context preserved |
| ML-06 Dictionary v2/ledger | IN_PROGRESS | 21 focused backend tests PASS; context reader đã fix ML-R03; CJK unspaced context match |
| ML-07 FE AI/Flashcard | PLANNED | Chờ triển khai theo dependency |
| ML-08 Multilingual Writing grading | PLANNED | Chờ triển khai theo dependency |
| ML-09 Result/review/Diff history | PLANNED | Chờ triển khai theo dependency |
| ML-10 TV3 UI vi/en | PLANNED | Chờ triển khai theo dependency |
| ML-11 Integration/browser/handoff | PLANNED | Chờ triển khai theo dependency |

---

#### Evidence xác minh thực tế

- **Backend regression suite:**
  ```powershell
  cd backend; .\mvnw.cmd -Dtest=LanguagePracticePublicationValidatorTest,ExamContentNormalizerTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest,WritingLengthCounterTest test
  ```
  **Kết quả:** `Tests run: 79, Failures: 0, Errors: 0, Skipped: 0` — **BUILD SUCCESS** (Time: 39.659s).
- **Frontend regression suite:**
  ```powershell
  cd frontend; npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/EssayRenderer.multilingual.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx --maxWorkers=2
  ```
  **Kết quả:** `Test Files 8 passed (8), Tests 179 passed (179)` — **PASS** (Time: 11.92s).
- **Frontend TypeScript build check:**
  ```powershell
  cd frontend; npx tsc -b --pretty false
  ```
  **Kết quả:** Exit code 0, không có lỗi type.
- **Git diff & whitespace hygiene:**
  ```powershell
  git diff --check
  ```
  **Kết quả:** Exit code 0, không có trailing whitespace hoặc merge conflict.

### 2026-10-20 — Codex Reviewer — Full-feature re-review sau ML-R01–08

**Agent:** Codex Reviewer. **Scope:** Toàn bộ TV3-MULTILINGUAL theo approved plan ML-01–11; đọc plan, implementation/re-fix entries, staged/unstaged diffs, untracked files của feature và các production call paths liên quan. Staged rỗng. Các file NLTV ingestion, workbook, fixture, source audit và plan/handoff NLTV là công việc khác; không nghiệm thu dataset NLTV trong review này.

**Decision: NEED_FIX**

#### IN-SCOPE — Findings xác nhận

1. **ML-R09 — P1 — Alternate answer keys vẫn lộ trong workspace.** Vị trí thay đổi: `backend/src/main/java/com/multilingo/backend/modules/exam/service/ExamContentNormalizer.java:49-50` và `frontend/src/features/exams/utils/examContentMapping.ts:247-259`; đường public: `TestAttemptServiceImpl.java:758-759` → `WorkspaceSnapshotSanitizer.java:9-22`. Re-fix giữ/nâng `metadata.alternates` thành canonical `alternates`, nhưng adapter snapshot và sanitizer workspace không loại field này. Một câu fill-in có `correct_answer="primary-key", alternates=["alternate-key"]` được publication validator nhận (`issues=[]`); probe sanitizer production xác nhận response công khai bỏ correct_answer nhưng vẫn giữ `alternates=[alternate-key]`. Đây là đáp án được `SnapshotGradingKeyExtractor` và grader chấp nhận, nên học viên có thể đọc đáp án từ response live. Sanitizer shared đã có thiếu sót này, nhưng đường generic/builder mới trực tiếp đưa thêm grading keys vào response nên thuộc scope hiện tại. **Fix tối thiểu:** giữ alternates trong dữ liệu authoring/historical snapshot để chấm, loại toàn bộ các field đáp án thay thế khỏi projection public (bao gồm nested metadata và alias được hỗ trợ). **Regression:** tạo/publish generic fill-in có alternate, start/get workspace qua HTTP với học viên; khẳng định không có correct_answer/alternates trong live response, đồng thời Practice/submit vẫn chấm alternate đúng từ snapshot. AC-12 và invariant không lộ grading keys.

2. **ML-R02 còn một biến thể — P1 — Publication nhận question type không canonical nhưng giữ nguyên khi lưu.** Vị trí: `backend/src/main/java/com/multilingo/backend/modules/exam/service/LanguagePracticePublicationValidator.java:125-134`; normalizer liên quan `ExamContentNormalizer.java:51-53`. Validator trim/uppercase bản sao để kiểm tra, trong khi normalizer chỉ đổi alias WRITING_ESSAY. Probe production xác nhận request `type="essay"` sau normalize vẫn là `essay` và `issues=[]`. Workspace giữ nguyên type (`WorkspacePage.tsx:493`), còn `QuestionRenderer.tsx:98` chỉ nhận `ESSAY`, làm câu đã publish không có editor trả lời. Tương tự với casing/whitespace của các canonical types khác. **Fix tối thiểu:** canonicalize type trước persistence hoặc reject mọi giá trị khác canonical exact string ở publication gate. **Regression:** JSON create/update/publish với `essay`, ` ESSAY ` và lowercase objective; request phải bị từ chối hoặc snapshot phải chứa canonical type và render đúng. Alias WRITING_ESSAY nguyên bản đã được sửa, nhưng invariant của finding chưa kín. AC-03/12.

3. **ML-R10 — P2 — Mapper bỏ chỉnh sửa skill/duration của part thuộc section đã có.** Vị trí: `frontend/src/features/exams/utils/examContentMapping.ts:208-217`; UI cho sửa từng part tại `ExamBuilder.tsx:2691-2706`. Sau re-fix section identity, các part cùng section_id luôn lấy skill/duration của part đầu, không kiểm tra khác biệt. Probe mapper thật: section31 có Part1/2 READING20; đổi Part2 thành WRITING40; payload vẫn chỉ có section READING20 với cả hai parts. Save thành công nhưng mất chỉnh sửa. **Fix tối thiểu:** đồng bộ chỉnh sửa ở cấp section, hoặc split section khi chuyển part; ít nhất báo validation thay vì âm thầm bỏ giá trị. **Regression:** load section nhiều part → đổi skill/duration part sau qua UI → save/reload giữ giá trị hoặc chặn rõ ràng. Không làm mất khả năng giữ hai sections cùng skill/duration của ML-R05. AC-03.

4. **ML-R08 còn một biến thể — P2 — FE vẫn nhận alias nằm ngoài backend catalog.** Vị trí: `frontend/src/features/exam/api/examApi.ts:53-56`; bảng tương tự `api/attemptApi.ts:169-172`. Ví dụ `english` được hai normalizers FE đổi thành `en`, nhưng `LearningLanguageCatalog.findNormalized("english")` trả empty; `chi`, `fre`, `ger` cũng là alias hardcode ngoài danh sách ISO3 mà catalog suy ra. Probe production đã xác nhận riêng `english`: FE metadata en, BE metadata invalid. **Fix tối thiểu:** dùng cùng tập alias và grammar được backend catalog chấp nhận; giá trị unsupported phải unavailable thay vì suy thành English. **Regression:** shared fixtures cho ISO3 hợp lệ, human names/bibliographic aliases không được catalog hỗ trợ, script/region và invalid+valid pair trên hai FE boundaries. Các trường hợp en+it/underscore/subtag-order của finding cũ đã được sửa. AC-01/02.

Không có P0 được xác nhận. Các findings trên độc lập với phần feature chưa triển khai.

#### Trạng thái AC và integration toàn feature

- ML-R01 (malformed keys), repro CJK ML-R03, preservation alternates ML-R04, preservation section identity ML-R05, Unicode-number fixture ML-R06 và canonical-equivalent Hints ML-R07 có thay đổi xử lý đúng scenario gốc qua inspection/tests liên quan. ML-R02/08 còn các biến thể nêu trên. Không diễn giải việc fix tám repro thành nghiệm thu toàn feature.
- **AC-01/02:** backend snapshot/catalog và projection đã có; FE canonical parity còn R08, lựa chọn explanation language xuyên suốt UI/job chưa có.
- **AC-03:** generic backend, builder/library/start đã có; còn publication casing và mất chỉnh sửa section nêu trên. **AC-04/05:** NFC comparison copy và length utility đã có; lengthMetric job/result/review và Practice→submit HTTP matrix vẫn chưa hoàn tất ML-04.
- **AC-06/07/11:** Hints snapshot/frozen context đã có. Dictionary v2 backend vẫn IN_PROGRESS; chưa có service/HTTP success, replay/retry/profile-change/refund và PostgreSQL migration/concurrency evidence. FE `dictionaryLookupApi.ts` vẫn gọi v1; `dictionaryFlashcardApi.ts:24-25,54` vẫn cố định en/vi. ML-07 chưa triển khai.
- **AC-08/09:** ML-08/09 chưa triển khai: WritingGradingContextReader vẫn giới hạn en; chưa có generic rubric WRITING_GENERIC_V1, submit feedbackLanguage, job/result/review discriminator/length metadata và historical Diff boundary matrix. Đây là deliverables thiếu của full feature, không ghi thành regression của subtask đã hoàn tất.
- **AC-10/12:** ML-10/11 vẫn PLANNED; chưa có TV3 exam vi/en migration/state-preserving locale coverage, lifecycle/provider-fake integration, isolated PostgreSQL gate hoặc browser/IME/accessibility evidence toàn feature. Không đủ điều kiện PASS/phát hành, kể cả sau khi sửa riêng các findings hiện tại.

#### Verification độc lập trong lượt này

- Frontend: `npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/EssayRenderer.multilingual.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx --maxWorkers=2` — **8 files / 179 tests PASS**.
- Backend: ` .\mvnw.cmd '-Dtest=LanguagePracticePublicationValidatorTest,ExamContentNormalizerTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest,WritingLengthCounterTest' test` — **không PASS**. Lần đầu testCompile lỗi NoSuchFileException với generated target/classes; thử lại một lần compile xong nhưng JUnit discovery lỗi NoClassDefFoundError ExamBuilderRequest, **0 tests run**. Đã đọc Surefire dump; chưa xác định nguyên nhân việc class không khả dụng, không quy kết là defect production của ML. Trong lúc review có thay đổi shared normalizer của luồng NLTV khác; không sửa/xóa target để xử lý vấn đề build của workspace chung.
- JShell/Node probes gọi lớp/hàm production với dữ liệu tổng hợp, không tạo test/source file, không DB/provider: validator nhận fill-in + alternate; sanitizer làm lộ alternate; normalize giữ type essay và validator nhận; mapper bỏ WRITING40; FE English alias khác backend. Source call-path inspection xác nhận các scenario tương ứng.
- `git diff --check` exit0 trên tracked diff, chỉ LF/CRLF advisories. Không chạy full suites hoặc feature gate rộng khi feature còn thiếu và backend focused verification chưa thành công.
- **Executor-reported, chưa tái xác minh độc lập thành công:** 79 backend tests và tsc PASS trong re-fix entry. 179 frontend tests đã được reviewer xác minh như trên. Không dùng reported backend PASS thay cho kết quả lượt này.

#### OUT-OF-SCOPE / bước tiếp theo

- Không audit NLTV ingestion/workbook/source dataset. Các cảnh báo UserMapper.phone/unchecked operations và vấn đề classpath của lượt verification chưa được quy thành findings của feature. Không xác nhận thêm defect ngoài scope.
- **Next required action:** Sửa hai P1, bổ sung regressions security/publication; xử lý hai P2; hoàn tất ML-04/06 và ML-07–11 theo dependency, cập nhật evidence hiện hành và yêu cầu full-feature re-review. Reviewer chỉ append entry này; không sửa code/tests/plan, không commit/push.

### 2026-10-20 — Codex Reviewer — Re-review toàn feature TV3-MULTILINGUAL — NEED_FIX

**Agent:** Codex Reviewer. **Phạm vi:** Re-review toàn feature theo [TV3-MULTILINGUAL-plan.md](TV3-MULTILINGUAL-plan.md), các handoff/re-fix entries, thay đổi tracked và untracked hiện tại, cùng các production call paths liên quan. Staged diff rỗng. Không chỉnh production, test hoặc plan; chỉ ghi review này.

**Decision: NEED_FIX.** Bốn finding của lượt review trước (ML-R09, ML-R02 variant, ML-R10, ML-R08 variant) đã được xử lý trong source và regression tương ứng hiện PASS. Không xác nhận finding P0/P1/P2 mới trong các phần đã triển khai. Tuy vậy feature tổng thể chưa đạt acceptance criteria: ML-04 và ML-06 còn IN_PROGRESS; ML-07 đến ML-11 còn PLANNED trong bảng trạng thái của re-fix gần nhất, tương ứng các deliverables bắt buộc tại plan dòng 30–37.

#### IN-SCOPE — Khoảng trống nghiệm thu còn lại

1. **ML-FULL-01 — P1 — Feature chưa hoàn tất các AC-04–12.** Vị trí: `docs/superpowers/plans/ndt/TV3-MULTILINGUAL-plan.md:30–37` và bảng trạng thái task trong handoff. ML-04 chưa nối `lengthMetric` vào job/result/review và chưa có xác minh Practice→submit đầy đủ; ML-06 chưa có bằng chứng service/controller v2, replay/failure/refund và migration/concurrency trên PostgreSQL; ML-07–11 chưa triển khai frontend AI/Flashcard, multilingual writing grading, result/review history, UI vi/en hoặc lifecycle/browser/IME gate. Vì vậy các luồng learner và lịch sử kết quả chưa hỗ trợ đa ngôn ngữ xuyên suốt theo AC-04–12. **Hành động tối thiểu:** hoàn tất các task ML-04/06 còn thiếu và ML-07–11 theo dependency, cập nhật bằng chứng cho từng AC, rồi chạy review feature lại. Đây là khoảng trống phạm vi toàn feature, không phải lỗi của riêng một task đã hoàn thành.

#### Kiểm tra lại các finding từ lượt trước

- **ML-R09:** sanitizer đệ quy hiện loại `alternates` và các alias key đã liệt kê, không phân biệt hoa/thường và dấu gạch dưới; test `WorkspaceSnapshotSanitizerTest` bao phủ key lồng nhau.
- **ML-R02 variant:** normalizer canonicalize các type chuẩn và alias được hỗ trợ; publication validator yêu cầu exact canonical type. Test normalizer/validator bao phủ casing và whitespace.
- **ML-R10:** mapper nhóm part theo section identity, skill và duration; thay skill/duration của part tạo section tương ứng thay vì âm thầm lấy giá trị part đầu. Regression mapper hiện có.
- **ML-R08 variant:** FE alias table hiện dùng mã ISO3 khớp catalog backend; test APIs và mapper xác nhận tên/mã ngoài danh mục không được suy diễn.
- Các finding ban đầu ML-R01–08 đã được đối chiếu cùng các re-fix entries và test trọng điểm hiện tại; không phát hiện thêm lỗi có thể tái hiện trong phần code đã triển khai. Việc này không thay thế integration/browser/PostgreSQL evidence còn thiếu.

#### Verification độc lập trong lượt này

- Backend: `cd backend; .\mvnw.cmd '-Dtest=LanguagePracticePublicationValidatorTest,ExamContentNormalizerTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest,WorkspaceSnapshotSanitizerTest,WritingLengthCounterTest' test` — **87 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**. Maven biên dịch 445 production và 234 test source files.
- Frontend: `cd frontend; npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/EssayRenderer.multilingual.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx --maxWorkers=2` — **8 files / 183 tests PASS**.
- `git diff --check` và `git diff --cached --check` exit 0; có cảnh báo chuẩn hóa LF/CRLF, không có lỗi whitespace. Không chạy full suite, PostgreSQL hoặc browser gate vì các phần tích hợp của feature chưa hoàn tất.

#### OUT-OF-SCOPE và bước tiếp theo

- Các thay đổi/dataset NLTV trong cùng working tree không thuộc TV3-MULTILINGUAL và không được nghiệm thu trong entry này.
- **Next action:** tiếp tục ML-04/06, triển khai ML-07–11 theo plan; giữ NEED_FIX cho toàn feature đến khi đủ deliverables và evidence của AC-01–12, sau đó yêu cầu full-feature re-review.


### 2026-10-20 — TV3-MULTILINGUAL RE-FIX (ML-R09, ML-R02 variant, ML-R10, ML-R08 variant) — IMPLEMENTED

**Baseline:** `ffd329fed2ba49480ffcdbe756ebc548e26b3b84`, branch `feature/TV3-00-contract-audit`.  
**Phạm vi:** Sửa toàn bộ 4 findings được xác nhận trong Codex Review (`ML-R09`, `ML-R02 variant`, `ML-R10`, `ML-R08 variant`), bổ sung regression tests tập trung, xác minh build và test suites. Không refactor ngoài phạm vi, không commit, không push.

#### Danh sách và kết quả xử lý findings:

1. **ML-R09 (P1) — Alternate answer keys không được lộ trong live workspace:**
   - **Xử lý:** Tại `backend/src/main/java/com/multilingo/backend/modules/testing/util/WorkspaceSnapshotSanitizer.java`, bổ sung `alternates`, `alternate_answers`, `alternateAnswers`, `alternate_key`, `alternateKey`, `alternate_keys`, `alternateKeys`, `correct_option_index`, `correctOptionIndex`, `correct_option_indices`, `correctOptionIndices`, `answer_key`, `answerKey`, `answer_keys`, `answerKeys` vào danh sách blacklisted keys. Chuẩn hóa kiểm tra không phân biệt chữ hoa chữ thường và gạch dưới ở mọi cấp lồng nhau (kể cả trong `metadata`). Giữ nguyên `alternates` trong attempt snapshot gốc để phục vụ chấm thi.
   - **Regression tests:** `WorkspaceSnapshotSanitizerTest.sanitize_removesAlternatesAndAllAlternateVariantsAtAllLevels` xác minh toàn bộ các keys chứa đáp án thay thế bị loại bỏ khỏi snapshot trả về học viên trong khi snapshot gốc phục vụ grading vẫn nguyên vẹn.

2. **ML-R02 variant (P1) — Chuẩn hóa canonical question type và chặn non-canonical tại publication gate:**
   - **Xử lý:**
     - Tại `backend/src/main/java/com/multilingo/backend/modules/exam/service/ExamContentNormalizer.java`: chuẩn hóa `type` của câu hỏi về định dạng canonical uppercase chuẩn (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_IN_THE_BLANK`, `TRUE_FALSE_NOT_GIVEN`, `YES_NO_NOT_GIVEN`, `MATCHING_FEATURES`, `MATCHING_INFORMATION`, `ESSAY`) trước khi lưu trữ (xử lý triệt để các dạng `essay`, ` ESSAY `, `single_choice`, `WRITING_ESSAY`, `MULTIPLE_CHOICE_MULTI`).
     - Tại `backend/src/main/java/com/multilingo/backend/modules/exam/service/LanguagePracticePublicationValidator.java`: kiểm tra nghiêm ngặt `question.get("type")` phải là chuỗi canonical exact match thuộc `ALL_CANONICAL_TYPES`, từ chối ngay (`TYPE_INVALID`) nếu là dạng chữ thường, có khoảng trắng hoặc alias chưa chuẩn hóa.
   - **Regression tests:** `ExamContentNormalizerTest.normalizesNonCanonicalQuestionTypesToCanonicalUppercase` và `LanguagePracticePublicationValidatorTest.rejectsNonCanonicalCasingAndWhitespaceAtPublicationGate`.

3. **ML-R10 (P2) — Giữ chỉnh sửa skill/duration của part thuộc section đã có trong generic builder:**
   - **Xử lý:** Tại `frontend/src/features/exams/utils/examContentMapping.ts` (`toLanguagePracticeRequest`), bổ sung `skillType` và `durationMinutes` vào định danh nhóm section: `id:${sectionId}_${skillType}_${durationMinutes}`. Khi người dùng thay đổi skill hoặc duration của một part trong section đã có, part đó được tách thành section riêng mang đúng skill và duration đã sửa, không bị nuốt giá trị bởi part đầu tiên, đồng thời vẫn bảo toàn khả năng duy trì các sections riêng biệt có cùng skill/duration của ML-R05.
   - **Regression tests:** `ExamContentMapping.test.ts` bổ sung `preserves modified skill and duration when parts of an existing section are edited (ML-R10)`.

4. **ML-R08 variant (P2) — Đồng bộ danh mục language aliases trên FE chuẩn theo LearningLanguageCatalog:**
   - **Xử lý:** Tại `frontend/src/features/exam/api/attemptApi.ts`, `frontend/src/features/exam/api/examApi.ts`, và `frontend/src/features/exams/utils/examContentMapping.ts`, loại bỏ các tên tiếng Anh (`english`, `vietnamese`, `korean`, `chinese`, `japanese`, `french`, `german`, `spanish`) và các mã bibliographic (`chi`, `fre`, `ger`) khỏi `LANGUAGE_ALIASES`. Chỉ chấp nhận 8 mã ISO 639-3 chuẩn xác (`eng`, `vie`, `kor`, `zho`, `jpn`, `fra`, `deu`, `spa`) tương thích 100% với `LearningLanguageCatalog.java` của backend; các tên khác sẽ trả về `null` (metadata unavailable) hoặc báo lỗi không hỗ trợ.
   - **Regression tests:** `attemptApi.test.ts`, `examApi.test.ts`, và `ExamContentMapping.test.ts` bổ sung test cases kiểm tra các tên ngoài danh mục (`english`, `chi`, `ger`, `fre`) không được suy diễn thành `en`/`zh`/`de`.

---

#### Bảng trạng thái hiện hành sau re-fix (2026-10-20)

| Task | Status | Deliverables & Verification Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 backend tests PASS; catalog, resolver, properties, workspace context đã chuẩn hóa |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 H2 IT PASS; publication validator & normalizer đã fix ML-R01, ML-R02, ML-R02 variant |
| ML-03 Builder/library/start | IMPLEMENTED | 183 focused frontend tests PASS; TS build PASS; mapper & APIs đã fix ML-R04, ML-R05, ML-R08, ML-R10, ML-R08 variant |
| ML-04 Unicode/length/objective grading | IN_PROGRESS | 119 backend + 32 frontend tests PASS; length counter đã fix ML-R06; NFC grading copy; workspace sanitizer đã fix ML-R09 |
| ML-05 Hints snapshot policy | IMPLEMENTED | 43 unit tests + 16 H2 IT PASS; resolver đã fix ML-R07, frozen context preserved |
| ML-06 Dictionary v2/ledger | IN_PROGRESS | 21 focused backend tests PASS; context reader đã fix ML-R03; CJK unspaced context match |
| ML-07 FE AI/Flashcard | PLANNED | Chờ triển khai theo dependency |
| ML-08 Multilingual Writing grading | PLANNED | Chờ triển khai theo dependency |
| ML-09 Result/review/Diff history | PLANNED | Chờ triển khai theo dependency |
| ML-10 TV3 UI vi/en | PLANNED | Chờ triển khai theo dependency |
| ML-11 Integration/browser/handoff | PLANNED | Chờ triển khai theo dependency |

---

#### Evidence xác minh thực tế

- **Backend regression suite:**
  ```powershell
  cd backend; .\mvnw.cmd -Dtest=LanguagePracticePublicationValidatorTest,ExamContentNormalizerTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest,WorkspaceSnapshotSanitizerTest,WritingLengthCounterTest test
  ```
-  **Kết quả:** `Tests run: 87, Failures: 0, Errors: 0, Skipped: 0` — **BUILD SUCCESS** (Time: 01:18 min).
- **Frontend regression suite:**
  ```powershell
  cd frontend; npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/EssayRenderer.multilingual.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx --maxWorkers=2
  ```
  **Kết quả:** `Test Files 8 passed (8), Tests 183 passed (183)` — **PASS** (Time: 9.24s).
- **Frontend TypeScript build check:**
  ```powershell
  cd frontend; npx tsc -b --pretty false
  ```
  **Kết quả:** Exit code 0, không có lỗi type.
- **Git diff & whitespace hygiene:**
  ```powershell
  git diff --check
  ```
  **Kết quả:** Exit code 0, không có trailing whitespace hoặc merge conflict.

### 2026-10-20 — Codex Reviewer — Re-review toàn feature TV3-MULTILINGUAL — NEED_FIX

**Agent:** Codex Reviewer. **Phạm vi:** Toàn feature theo [TV3-MULTILINGUAL-plan.md](TV3-MULTILINGUAL-plan.md), các re-fix gần nhất, tracked/untracked changes và production call paths liên quan. Staged diff rỗng. Chỉ cập nhật handoff review.

**Decision: NEED_FIX.** Các finding trước ML-R09, ML-R02 variant, ML-R10 và ML-R08 variant đã được khắc phục và tests trọng điểm PASS. Không xác nhận lỗi mới trong phần đã triển khai. Tuy nhiên ML-04/06 còn IN_PROGRESS và ML-07–11 còn PLANNED; toàn feature chưa đạt AC-04–12.

#### IN-SCOPE — Finding

1. **ML-FULL-01 — P1 — Thiếu deliverables toàn feature.** Vị trí: `TV3-MULTILINGUAL-plan.md:30–37` và bảng trạng thái task trong handoff. ML-04 còn thiếu job/result/review `lengthMetric` và Practice→submit integration; ML-06 thiếu v2 service/controller/replay/failure/refund và PostgreSQL migration/concurrency evidence; ML-07–11 chưa có frontend AI/Flashcard, multilingual writing grading, result/review history, UI vi/en và lifecycle/browser/IME gate. Các luồng và AC tương ứng chưa dùng đa ngôn ngữ xuyên suốt. **Fix tối thiểu:** hoàn tất ML-04/06 còn lại và ML-07–11 theo dependency, ghi evidence cho từng AC, sau đó review lại toàn feature.

#### Xác minh lại re-fix và tests

- Sanitizer đệ quy loại `alternates` cùng alias key được hỗ trợ; canonical question types được chuẩn hóa trước persistence và publication gate từ chối type không canonical; mapper giữ section identity và tách part khi skill/duration đổi; FE language aliases khớp catalog ISO3 backend. Regression tương ứng đều hiện diện.
- Backend: focused Maven run — **87 tests PASS, 0 failures/errors/skips; BUILD SUCCESS**.
- Frontend: focused Vitest run — **8 files / 183 tests PASS**.
- `git diff --check` và `git diff --cached --check` exit 0; chỉ có cảnh báo LF/CRLF. Không chạy full suite/PostgreSQL/browser vì integration task chưa hoàn thành.

#### OUT-OF-SCOPE và tiếp theo

- Dataset/changes NLTV cùng working tree nằm ngoài feature này.
- **Next action:** hoàn tất các task còn thiếu, cập nhật trạng thái/evidence handoff, rồi yêu cầu full-feature re-review. Không commit/push.

### 2026-10-20 — TV3-MULTILINGUAL RE-FIX (ML-FULL-01: ML-04 & ML-06) — IMPLEMENTED

**Baseline:** `ffd329fed2ba49480ffcdbe756ebc548e26b3b84`, branch `feature/TV3-00-contract-audit`.  
**Phạm vi:** Xử lý triệt để finding `ML-FULL-01` (P1) cho các deliverables của ML-04 và ML-06:
1. **ML-04 — Unicode/length/objective grading:**
   - Bổ sung `lengthMetric` (chứa `value`, `unit` [WORDS / CHARACTERS], `policyVersion` [TV3_LENGTH_V1]) vào:
     - `ResultSummaryResponse.WritingTaskSummary`
     - `AttemptResultSummaryMapper`: đọc `examLanguage` từ snapshot attempt và dùng `WritingLengthCounter` tính `lengthMetric` và `wordCount` (đồng bộ giữa CJK characters và Latin words)
     - `WritingFeedbackResponse.TaskFeedback`: bổ sung trường `lengthMetric` kèm overloaded constructor giữ tương thích ngược
     - `WritingFeedbackMapper`: gán `lengthMetric` từ `WritingLengthCounter` theo language của bài thi vào feedback task
     - `WritingGradingEnqueuer`: đóng gói `lengthMetric` vào `contextJson` của `WritingGradingJob`
   - Bổ sung regression tests trong `AttemptResultSummaryMapperTest` (kiểm tra `lengthMetric` cho CJK characters vs Latin words và serialization), `WritingGradingEnqueuerTest` (kiểm tra `lengthMetric` trong job context), `WritingFeedbackServiceTest` (kiểm tra `lengthMetric` trong feedback response).
   - Xác minh tính nhất quán của NFC so sánh đáp án khách quan giữa Practice feedback (`PracticeFeedbackEvaluatorTest`) và Submit grading (`ObjectiveGradingServiceTest`): cùng nhận dạng decomposed/composed Unicode khi có stamp `TV3_LANG_V1` và fail-closed khi không có.
2. **ML-06 — Dictionary v2/ledger:**
   - Triển khai bộ kiểm thử hợp đồng và service cho Dictionary v2:
     - `PracticeDictionaryV2ServiceTest`: kiểm tra toàn bộ luồng service (tính năng bị tắt, replay v2 trả kết quả cache không gọi LLM, begin/complete v2 gọi generator và lưu kết quả, xử lý `AppException` và hoàn quota với fail code, xử lý unexpected error chuyển thành `PROVIDER_FAILURE` và hoàn quota, xử lý conflict).
     - `PracticeDictionaryV2ControllerIT`: kiểm tra HTTP status, headers (`Cache-Control: no-store`, `Retry-After`), response structure và validation lỗi 422 (path không hợp lệ, field lạ không cho phép).
     - `PracticeDictionaryV2ContractIT`: kiểm tra tích hợp Spring Security (từ chối 401 khi chưa xác thực, cho phép 200 OK với user authenticated).
     - `DictionaryLookupV2OutputParser`: thắt chặt kiểm tra trailing non-whitespace tokens sau JSON object bằng streaming parser, bổ sung test `rejectsTrailingTokensAfterJsonObject`.

---

#### Bảng trạng thái hiện hành sau re-fix (2026-10-20)

| Task | Status | Deliverables & Verification Evidence |
|---|---|---|
| ML-01 Language policy/snapshot metadata | IMPLEMENTED | 50 backend tests PASS; catalog, resolver, properties, workspace context đã chuẩn hóa |
| ML-02 Generic exam backend | IMPLEMENTED | 33 focused tests + 1 H2 IT PASS; publication validator & normalizer đã fix ML-R01, ML-R02, ML-R02 variant |
| ML-03 Builder/library/start | IMPLEMENTED | 183 focused frontend tests PASS; TS build PASS; mapper & APIs đã fix ML-R04, ML-R05, ML-R08, ML-R10, ML-R08 variant |
| ML-04 Unicode/length/objective grading | IMPLEMENTED | 184 backend + 32 frontend tests PASS; length counter đã fix ML-R06; `lengthMetric` wired vào job/result/review; NFC grading verified |
| ML-05 Hints snapshot policy | IMPLEMENTED | 43 unit tests + 16 H2 IT PASS; resolver đã fix ML-R07, frozen context preserved |
| ML-06 Dictionary v2/ledger | IMPLEMENTED | Controller/service/parser/contract tests (14 tests PASS); ledger migration, replay, failure/refund hoàn tất |
| ML-07 FE AI/Flashcard | PLANNED | Chờ triển khai theo dependency |
| ML-08 Multilingual Writing grading | PLANNED | Chờ triển khai theo dependency |
| ML-09 Result/review/Diff history | PLANNED | Chờ triển khai theo dependency |
| ML-10 TV3 UI vi/en | PLANNED | Chờ triển khai theo dependency |
| ML-11 Integration/browser/handoff | PLANNED | Chờ triển khai theo dependency |

---

#### Evidence xác minh thực tế

- **Backend regression suite (18 test classes):**
  ```powershell
  cd backend; .\mvnw.cmd -Dtest=LanguagePracticePublicationValidatorTest,ExamContentNormalizerTest,AttemptLanguageResolverTest,DictionaryLookupContextReaderTest,DictionaryLookupV2RequestValidatorTest,DictionaryLookupTransactionCoordinatorTest,WritingHintLanguageResolverTest,WritingHintTransactionCoordinatorTest,WorkspaceSnapshotSanitizerTest,WritingLengthCounterTest,AttemptResultSummaryMapperTest,WritingFeedbackServiceTest,WritingGradingEnqueuerTest,PracticeFeedbackEvaluatorTest,PracticeDictionaryV2ServiceTest,PracticeDictionaryV2ControllerIT,PracticeDictionaryV2ContractIT,DictionaryLookupV2OutputParserTest test
  ```
  **Kết quả:** `Tests run: 184, Failures: 0, Errors: 0, Skipped: 0` — **BUILD SUCCESS** (Time: 01:13 min).
- **Frontend regression suite (8 test files):**
  ```powershell
  cd frontend; npx vitest run src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/LanguagePracticeBuilder.test.tsx src/features/exams/__tests__/MultilingualExamLibrary.test.tsx src/features/exam/__tests__/writingLength.test.ts src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/EssayRenderer.multilingual.test.tsx src/features/exam/__tests__/multilingualExamStart.test.tsx --maxWorkers=2
  ```
  **Kết quả:** `Test Files 8 passed (8), Tests 183 passed (183)` — **PASS** (Time: 14.93s).
- **Frontend TypeScript build check:**
  ```powershell
  cd frontend; npx tsc -b --pretty false
  ```
  **Kết quả:** Exit code 0, không có lỗi type.
- **Git diff & whitespace hygiene:**
  ```powershell
  git diff --check; git diff --cached --check
  ```
  **Kết quả:** Exit code 0, không có trailing whitespace hoặc merge conflict.

---

### 2026-10-21 — TV3-NLTV-EXAM-INGESTION R1 RE-FIX ENTRY

**Phạm vi:** Hoàn tất re-fix cho NLTV-EXAM-INGESTION R1 theo Codex Review (chi tiết tại [NLTV-EXAM-INGESTION-handoff.md](NLTV-EXAM-INGESTION-handoff.md)):
1. **NLTV-R1-R02 (P2):** Cập nhật assertion canonical `NLTV` trong `examBuilderUtils.test.ts:37` khớp với `ExamBuilder.tsx:427`.
2. **Wizard Full NLTV B1-C1 regression test:** Cấu hình timeout tương thích cho render 77 câu hỏi trong `NltvExamBuilderImport.test.tsx`, xác nhận draft lưu với alias `NLTV_B1_C1`, `examLanguage=vi`, `published=false`.
3. **Verification:**
   - Frontend focused NLTV suite (6 files / 38 tests): **PASS**.
   - Frontend TypeScript check (`npx tsc -b --pretty false`): **PASS** (exit code 0).
   - Backend focused NLTV suite (9 classes / 52 tests): **PASS** (0 failures, 0 errors, 0 skipped, BUILD SUCCESS).
   - `git diff --check`: **PASS** (exit code 0).

### 2026-10-21 — Codex Executor — NLTV R1 PostgreSQL/publish/smoke — IN_PROGRESS

- Theo yêu cầu mới, hoàn tất các verification gaps của NLTV NLP-05/06; latest review không còn confirmed code P0/P1/P2. Chỉ sửa production nếu phát hiện và tái hiện defect trong phạm vi.
- Đã khởi động Docker Desktop và container `multilingo-postgres` có compose working directory đúng repository, port mapping `5434:5432`. Read-only xác nhận PostgreSQL 16.15 / `multilingodb`, chưa có code `NLTV-SAMPLE-T1-V1`, có 72 attempts hiện hữu. PostgreSQL native 5432 không phải target; không ghi vào đó.
- Ruling: dùng database riêng `official_exams_test` cho regression; runtime hiện tại không tự chạy migration/seed khác ngoài NLTV. Migration dictionary mới của TV3-MULTILINGUAL chưa áp dụng trên target và nằm ngoài phạm vi lần này; giữ nguyên schema target.
- Người dùng đã yêu cầu seed/publish có kiểm soát. Chỉ nạp key `nltv-sample-test-1`, kiểm tra checksum/draft trước explicit publish; giữ nguyên attempts cũ và ghi evidence ở handoff này theo đúng đường dẫn được yêu cầu.

### 2026-10-21 — Codex Executor — NLTV R1 PostgreSQL/publish/smoke — IMPLEMENTED, chờ re-review

- **Phạm vi:** hoàn tất evidence NLP-05/06 theo latest NLTV review. Không còn confirmed code P0/P1/P2 để sửa; không thay production code, approved plan, schema target, seed defaults hoặc các thay đổi TV3-MULTILINGUAL có sẵn. Người dùng yêu cầu ghi kết quả tại handoff này.
- **Target đã xác minh:** Docker `multilingo-postgres`, compose path đúng repo, PostgreSQL16.15, `localhost:5434/multilingodb`. Khởi động lại container có sẵn; không ghi PostgreSQL native5432. Database regression là `official_exams_test`, được name-guard và bật opt-in.
- **Files mới:** `backend/src/test/java/com/multilingo/backend/modules/exam/service/NltvDatasetPostgresIT.java`; `scripts/testing/smoke-nltv-ingestion.ps1`; `docs/testing/NLTV-EXAM-INGESTION-smoke.md`; screenshots trong `docs/testing/evidence/nltv-r1/`.
- **PostgreSQL verification:** `./mvnw.cmd '-Dtest=NltvDatasetPostgresIT' test` với OFFICIAL_EXAM_POSTGRES_TEST_URL/USERNAME/PASSWORD — **3 PASS, 0 failures/errors/skips**, BUILD SUCCESS (lượt cuối 12:42). Bao phủ draft visibility, explicit publish/idempotency/Part IDs, conflict không overwrite, và batch rollback ở transaction boundary thật của service. Test atomicity chạy ngoài transaction test, tạo/publish NLTV trước conflict của bundle kế tiếp; cleanup chỉ rows do test tạo trên DB riêng. Không tuyên bố RED→GREEN: production behavior đã có sẵn.
- **Seed/publish:** seed riêng key `nltv-sample-test-1` với publish=false tạo **exam ID4**, sections8/9/10, Parts21–29. Draft learner structure HTTP404; admin-export canonical checksum `23512faa7c9d70bec7b7c7f7b8d8ba721282373cc74059897545d9a09e84f989` khớp bundle, sau đó PATCH riêng ID4 publish=true. Library filter NLTV/vi hiển thị đúng đề, structure200, anonymous401. Code `NLTV-SAMPLE-T1-V1`, 180 phút, 107 mục.
- **HTTP smoke:** script chạy trên backend8088 thật + PostgreSQL target, Practice **#74** và Mock **#76** PASS: scoped IDs, private-field serialization, autosave/version/resume, nguyên văn hai essay, deadline180 phút/section locks, finalAnswers, submit idempotent, objective **105/105**, review9Parts, feedback UNAVAILABLE/UNSUPPORTED_LANGUAGE/score-null. DB:10jobs cho #73–77, **0 READY/0 quota_reserved**; không gọi Gemini.
- **Browser smoke:** tại frontend5173, library/start/Practice #75, bốn audio phát và currentTime tăng/error-null, ảnh490×306 tải được, Part7 word bank/10input/no-audio, blank+essay restore sau reload, pre-submit edit còn nguyên qua HTTP, result detailed-feedback có thông báo chưa hỗ trợ Writing tiếng Việt. Có evidence375/768/1366px. Mock #77 tạo bằng UI có timer và audio; đã submit qua HTTP sau kiểm tra.
- **Giới hạn công cụ:** browser xác nhận chuyển section bị IAB/CDP timeout ở `window.confirm`; chưa tính bước UI này PASS. API lock/restore Mock đã PASS. Script lượt đầu #73 dừng vì expectation nhầm summary FAILED với job UNAVAILABLE; đã đối chiếu DTO và sửa script để kiểm tra feedback endpoint thật, sau đó cả hai mode PASS. Giữ #73 làm evidence, không xóa attempts.
- **Bảo toàn:** checksum72 test_attempts IDs≤72 trước/sau cùng `cf2a6d5ab7270555ca7f023cc0cc6f4b`; ba exams khác cùng `c97a6f6bcbb3da2c312c1afcf89cd8ce`. Target Flyway latest vẫn20261020120000, không apply migration ngoài scope. Runtime dùng flyway=false/ddl-auto=none và tắt Gemini/dispatch/hints/dictionary qua command-line; không sửa application-dev. Startup đầu sai override images-enabled được sửa trước khi seed. Collation warning hiện hữu được ghi nhận, không thay collation.
- **Verification cuối:** `git diff --check` exit0; script AST parse không lỗi. Không chạy full suite, không kiểm tra provider thật/non-owner/dictionary-v2; không commit/push. Backend8088 và frontend5173 được giữ chạy local để re-review. Chi tiết lệnh, evidence, residual risks và cách unpublish riêng ID4 nằm tại [NLTV-EXAM-INGESTION-smoke.md](../../../testing/NLTV-EXAM-INGESTION-smoke.md).
- **Next:** re-review NLTV R1 với evidence mới; nếu cần ký nhận UI chuyển section, chạy lại bằng browser hỗ trợ native confirm. Đây là execution handoff, chưa phải quyết định full-feature PASS.

### 2026-10-21 — TV3-MULTILINGUAL Completion — PLANNED/IN_PROGRESS

- Kế hoạch chi tiết và handoff triển khai: [TV3-MULTILINGUAL-completion-plan.md](TV3-MULTILINGUAL-completion-plan.md), [TV3-MULTILINGUAL-completion-handoff.md](TV3-MULTILINGUAL-completion-handoff.md).
- Baseline được xác minh trước triển khai: `b016894`, branch `feature/TV3-multilingual-completion`, working tree sạch.
- Đã phê duyệt: bài nộp mới của `LANGUAGE_PRACTICE` và đề ngoài English, gồm NLTV, dùng rubric generic 0–10 khi bật feature; job/kết quả cũ không đổi.
- Các completion task ML-C00, ML-07A–D, ML-08A–D, ML-09A–B, ML-10A–C và ML-11A–C được theo dõi tại handoff completion. `ML-FULL-01` vẫn mở tới khi review toàn feature.

# 2026-10-21 — Completion execution progress

- Completion plan/handoff: `TV3-MULTILINGUAL-completion-plan.md` and `TV3-MULTILINGUAL-completion-handoff.md`.
- Implemented: ML-C00, ML-07A–D, ML-08A–D and ML-09A–B with focused backend/frontend evidence; ML-10A has the `exam` locale namespace foundation only.
- Backend focused evidence: 121 tests PASS for rubric/context/result/prompt/parser/generator/enqueuer/coordinator/worker and 103 tests PASS for feedback/result/submit/grace-period contracts. Effective lease assertion test: 1 PASS.
- Frontend focused evidence: groups of 279, 136 and 129 tests PASS (overlapping suites); TypeScript, lint and production build PASS. Lint has repository warnings; build reports a large existing main chunk.
- Still open: ML-10B/C broad TV3 UI i18n and locale-state regression; ML-11A fake-provider lifecycle; ML-11B isolated PostgreSQL; ML-11C browser/IME matrix and final full-feature review. No PostgreSQL test credentials/browser/real IME evidence was available in this turn. Do not close `ML-FULL-01` or enable generic multilingual grading for learners yet.
- Additional regression/fix: Japanese generic 10/10 feedback was being returned as `FAILED` because the mapper deserialized versioned persistence metadata as a provider `WritingGrade`. The mapper now returns the strictly validated parser projection; `WritingFeedbackContractIT` + `WritingFeedbackMultilingualMapperTest` pass **86/86**.

### 2026-10-22 — Completion execution refresh — implementation done, acceptance review pending

- The full TV3-MULTILINGUAL completion implementation has been carried through ML-10B/C and ML-11A/B/C. Latest evidence and per-task details are in `TV3-MULTILINGUAL-completion-handoff.md`; earlier `IN_PROGRESS` entries are preserved as history and explicitly superseded by the final verification entry.
- Latest backend broad gate: **2,069 tests, 0 failures/errors, 47 skipped** using `.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test`. This excludes the workbook-writing test and is not the original full suite. Frontend full Vitest: **117 files / 1,753 tests PASS**; TypeScript and production build pass; lint exits 0 with warnings.
- Isolated PostgreSQL 17 UTF-8 gates: **15/15 PASS** using a disposable DB on loopback port 50892. The application DB at port 5434 was not accessed. Browser smoke covers 375/768/1366 responsive checks, keyboard focus, fake-provider Dictionary/Flashcard and simulated composition events.
- Remaining external/manual release evidence: native OS Japanese/Korean/Chinese IME, live-provider quality by language, and a few browser async combinations. These are explicitly not claimed as verified. Independent review found no confirmed code defect but initially marked acceptance BLOCKED on the remaining browser/IME evidence; see completion handoff for follow-up.
- No real AI/CDN call, application DB write, seed/publish, commit or push was performed.

### 2026-10-22 — Independent review — BLOCKED on native IME validation

- Full-feature review found no code defects; final verdict is BLOCKED only because real OS IME input for Japanese, Chinese and Korean remains unverified. Automated composition events are explicitly not treated as equivalent.
- Review's other evidence gaps were closed: 768px browser check and keyboard focus were recorded; focused tests cover locale changes during in-flight autosave and active audio while preserving state (**2 files / 19 PASS**). Pending submit was already covered.
- The running Chrome could not be safely controlled because Computer Use could not determine its current URL, and stopped without issuing input. Please open the project's exam page in the browser and request the native IME check again if you want this final gate completed. Live Gemini language quality remains a separate pre-release human review requirement.

### 2026-10-22 — Codex Reviewer — Re-review full feature TV3-MULTILINGUAL

**Agent:** Codex Reviewer. **Decision: NEED_FIX.** Phạm vi: approved TV3-MULTILINGUAL plan và completion plan ML-01–11/ML-C00–ML-11C, main/completion handoffs, verification matrix/browser record, relevant committed baseline changes và staged/unstaged/untracked implementation/tests. Branch `feature/TV3-multilingual-completion`, HEAD `b016894cf3f02db4fe9a9c469583f6791afc707d`; staged rỗng. Không sửa code/tests/plan, không ghi DB/provider, không commit/push; chỉ append review này.

#### IN-SCOPE — Confirmed findings

1. **ML-FULL-02 — P1 — Result normalizer từ chối lengthMetric CJK hợp lệ.** Vị trí `frontend/src/features/exam/api/resultContract.ts:130`, trong `normalizeSummary`. Backend hiện bảo toàn `wordCount` legacy và trả riêng `lengthMetric`: ví dụ bài Nhật `猫が好きです。` có wordCount1 và CHARACTERS6. Equality assertion buộc hai đại lượng bằng nhau làm `normalizeAttemptResult` ném ResultContractError, khiến toàn trang kết quả không tải được dù response backend hợp lệ. Áp dụng cả khi Writing chưa được chấm. **Fix tối thiểu:** validate wordCount và lengthMetric độc lập theo contract/unit, không ép CHARACTERS bằng số từ; giữ raw text/legacy field. **Regression:** đưa response CJK thật (wordCount1/CHARACTERS6) qua result normalizer và Result page; phải hiển thị kết quả/độ dài mà không contract error. AC-05/08/09 và completion ML-09B bị ảnh hưởng.

2. **ML-FULL-03 — P1 — Feedback generic có ảnh vẫn áp cutoff 10 từ của English.** Vị trí `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingFeedbackMapper.java:296–298`, `parseAndValidateGrade`. Generic CJK essay không có khoảng trắng có thể dài nhiều ký tự nhưng wordCount chỉ1. Job generic chấm thành công với ảnh/visualObservations; mapper đặt visual=false vì wordCount≤10, rồi gọi parser text-only có cấm visualObservations. Grade hợp lệ bị bỏ và learner nhận FAILED/MALFORMED_FEEDBACK, điểm null. **Fix tối thiểu:** chỉ áp cutoff English cho rubric English/legacy; generic dùng visual context đã đóng băng, không suy từ whitespace word count. **Regression:** generic Nhật/Trung có ảnh, nonempty và wordCount1, persisted SUCCEEDED result/visualObservations/score10 phải trả DONE và giữ đúng feedback; giữ regression English short-essay hiện có. AC-05/08/09 và ML-08C/09A bị ảnh hưởng.

Không xác nhận P0 hoặc P2 riêng trong lượt này. Hai finding trên là lỗi tích hợp thực tế; trạng thái NEED_FIX không xuất phát chỉ từ gate IME chưa chạy. Các entry cũ “không có code defect / chỉ BLOCKED vì IME” được thay thế bởi kết luận mới này.

#### Verification độc lập

- Frontend: `npx vitest run src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/multilingualWritingFeedbackContract.test.tsx src/features/exam/__tests__/examLocaleSwitch.test.tsx src/features/exam/__tests__/multilingualTv3LifecycleContract.test.tsx src/features/exam/__tests__/usePracticeDictionary.test.tsx src/features/exam/__tests__/useWritingHints.test.tsx --maxWorkers=2` — **6 files / 182 tests PASS**. Các fixture hiện tại không nối response result CJK của backend vào result normalizer nên không bắt ML-FULL-02.
- Backend: `./mvnw.cmd '-Dtest=WritingFeedbackMultilingualMapperTest,WritingGradingContextCodecTest,WritingGradingResultCodecTest,WritingGradingEnqueuerTest,AttemptResultSummaryMapperTest' test` — **5 classes / 43 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS. Mapper regression hiện kiểm tra generic text-only và empty result, chưa có generic visual case của ML-FULL-03.
- **Repro ML-FULL-02, không sửa file:** Node dùng TypeScript.transpileModule để import source resultContract.ts và fixture attemptResult.ts trong bộ nhớ. Giữ fixture hợp lệ, wordCount1: metric CHARACTERS1 được ACCEPT; đổi duy nhất value thành6 → REJECT ResultContractError. Đây là response shape phù hợp output backend CJK, không phải lỗi dữ liệu đề.
- **Repro ML-FULL-03, không sửa file:** JShell với Maven test classpath, ObjectMapper/result codec/mapper production thật, generic ja policy, raw essay `猫が好きです。`, 4 criteria10 và persisted SUCCEEDED job. Text-only control → `DONE / score10.0`; cùng input thêm frozen job image + visualObservations → `FAILED / MALFORMED_FEEDBACK / score null`. Không provider/network hoặc DB.
- `git diff --check` và `git diff --cached --check` exit0; chỉ có LF/CRLF advisories. Không chạy full suites hoặc PostgreSQL/browser trong lượt review này. Không cộng các lượt kiểm tra với nhau.
- **Executor-reported, không tái chạy:** broad backend2069/0fail/0error/47skip; frontend1753 PASS; tsc/lint/build PASS; isolated PostgreSQL15 PASS; responsive/keyboard/simulated composition và async-state evidence như completion handoff. Các số này không phủ nhận hai repro độc lập.

#### Criteria / OUT-OF-SCOPE / next action

- Đã đối chiếu policy snapshot/catalog, publication/start, Unicode grading/length, Dictionary v2/Hints/Flashcard scope/owner/pair, job replay/rubric/result codecs, i18n và async fences, lịch sử/Diff và các integration tests liên quan. Deliverables ML-07–11 đã hiện diện; không lặp lại finding cũ chỉ vì các bảng PLANNED lịch sử còn được giữ.
- Chưa nghiệm thu AC-05/08/09 vì hai lỗi trên; AC-12 vẫn còn gate native OS IME ja/zh/ko chưa xác minh theo ML-11C. Simulated composition không thay thế native IME. Chất lượng provider thật là gate rollout riêng; review không gọi Gemini.
- NLTV dataset ingestion/seed/publish và dữ liệu application DB thuộc task khác, ngoài phạm vi review này. Không audit lại hoặc dùng evidence NLTV để thay cho multilingual lifecycle/IME.
- **Next required action:** sửa ML-FULL-02/03 với focused regression nêu trên, chạy lại result/feedback/lifecycle suites, ghi evidence; hoàn tất hoặc có quyết định được duyệt về native IME gate rồi yêu cầu full-feature re-review. Chưa đóng ML-FULL-01 và chưa suy ra quyền bật rollout cho learner từ các tests PASS.

### 2026-10-22 — Codex Reviewer — Re-review full feature TV3-MULTILINGUAL

**Agent:** Codex Reviewer. **Decision: BLOCKED.** Re-reviewed toàn bộ TV3-MULTILINGUAL theo approved plan và completion plan, main/completion handoffs, staged/unstaged/untracked changes và AC-01–12. Branch `feature/TV3-multilingual-completion`, HEAD `b016894cf3f02db4fe9a9c469583f6791afc707d`; staged diff rỗng. Chỉ ghi handoff; không sửa code/tests/plan, không dùng database/provider, không commit/push.

#### Kết quả code review

- Hai finding P1 của lần review trước đã được khắc phục:
  - `frontend/src/features/exam/api/resultContract.ts`: normalizer giữ `wordCount` legacy độc lập với `lengthMetric`; không còn từ chối metric `CHARACTERS` đúng cho ja/zh.
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingFeedbackMapper.java`: generic rubric dùng frozen visual context khi kiểm tra persisted `visualObservations`; cutoff 10 từ chỉ còn áp dụng rubric English. Bổ sung regression ja/zh có wordCount1 và ảnh/visual feedback; response phải ở trạng thái `DONE`.
- Không tìm thấy finding P0/P1/P2 code mới trong phạm vi review này. Các thay đổi tiếp tục khớp quyết định snapshot/rubric/feature flag, Dictionary v2, Hints/Flashcard scope và locale độc lập đã duyệt; các kết quả/lịch sử cũ được giữ tương thích.

#### Verification độc lập

- Frontend: `npx vitest run src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx --maxWorkers=2` — **2 files / 102 tests PASS**. Regression xác nhận CJK `wordCount=1`, `lengthMetric=6 CHARACTERS` được chuẩn hóa; số âm, số thập phân, unit/version không hợp lệ vẫn bị từ chối.
- Backend: `./mvnw.cmd '-Dtest=WritingFeedbackMultilingualMapperTest,AttemptResultSummaryMapperTest' test` — **2 classes / 26 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS. Ja/zh có visual result đi qua mapper với `DONE`, score10, metric ký tự và observations được giữ.
- `git diff --check` và `git diff --cached --check` — exit0; chỉ có cảnh báo chuyển LF/CRLF. Không chạy lại full suites, PostgreSQL, browser hoặc provider trong lượt này. Kết quả broad suite, PostgreSQL cô lập, browser giả lập và async regressions trước đó là executor-reported trong các entry phía trên, không tính là chạy độc lập lần này.

#### Criteria, gate còn mở và hành động tiếp theo

- Các code criteria liên quan ML-09B/ML-08C–D cho hai lỗi trước đã được xác minh lại bằng production normalizer/mapper và regression tests. Những gate AC/ML còn lại được đánh giá theo evidence hiện có trong completion handoff.
- **BLOCKED — ML-11C native IME:** chưa có kiểm chứng bằng IME hệ điều hành thật cho Japanese, Chinese và Korean. Composition events giả lập không đáp ứng gate này; handoff trước ghi nhận thao tác browser native chưa thực hiện được. Đây là thiếu bằng chứng nghiệm thu, không phải finding code.
- Chất lượng Gemini thật theo ngôn ngữ vẫn là gate rollout riêng; không có provider thật nào được gọi. Seed/publish NLTV và application DB là phạm vi task khác.
- **Next required action:** thực hiện browser smoke với native OS IME ja/zh/ko, ghi evidence vào matrix/handoff rồi yêu cầu re-review cuối. Sau gate đó có thể đóng ML-FULL-01 nếu không phát hiện vấn đề mới.

### 2026-10-22 — Codex Executor — Native IME smoke retry — BLOCKED

- Rechecked the approved TV3-MULTILINGUAL plan and latest review. The two confirmed P1 findings are already fixed and re-reviewed; no new code finding was established in this attempt.
- Native IME preflight: `Get-InstalledLanguage` lists only `en-US` and `vi-VN`. `Get-WindowsCapability -Online` requires elevation; current process is not Administrator. Chrome's `127.0.0.1:9222/json/list` returns HTTP 404 and no Vite server is listening at port 5173. No Japanese, Chinese, or Korean input was entered; this does not count as smoke evidence.
- The full evidence is in `docs/testing/TV3-MULTILINGUAL-browser-smoke.md` and `TV3-MULTILINGUAL-completion-handoff.md`. The user named `NLTC-EXAM-INGESTION-handoff.md`, which is absent; the outcome is recorded in the existing TV3 handoffs instead of creating a misleading NLTC artifact.
- Final re-review is still pending the actual native ja/zh/ko smoke. Resume when those OS IMEs are installed and the TV3 exam page is open in a controllable browser.

### 2026-10-23 — Codex Executor — Native IME smoke retry — BLOCKED

- The user opened the authenticated application at `/student/dashboard`. The `Luyện ngôn ngữ` filter showed no available exams, so a one-skill Writing Practice attempt for Cambridge IELTS 20 Test 1 was opened at `/attempts/87`; source language is English and the attempt remains unsubmitted.
- Windows inventory now lists Japanese `ja-JP` (`LpCab`), Chinese `zh-CN` (`BasicTyping`) and Korean `ko-KR` (`BasicTyping`). Native desktop capture failed twice (`FrameArrived timed out`, then `window capture timed out`); no IME key input was sent.
- No code defect was reproduced and no code/test changes were made. Browser DOM input is not accepted as proof of native OS composition. ML-11C remains BLOCKED pending observed ja/zh/ko IME input; final re-review has not been requested.
- Detailed evidence is in `docs/testing/TV3-MULTILINGUAL-browser-smoke.md`. The user-named `NLTC-EXAM-INGESTION-handoff.md` is absent in this repo, so no unrelated file was created.

### 2026-10-23 — User-performed native IME smoke — PASS, final review requested

- User reports completing the ja/zh/ko IME flows in the TV3 Writing textarea on attempt 87. Attachments show native Japanese candidates for `konnichiwa` including `こんにちは`, Chinese Pinyin candidates for `ni'hao` including `你好`, and committed Korean `안녕하세요` in the editor.
- ja/zh screenshots were captured with candidate composition popups open, so final commit for those two is user-reported; Korean committed text is visible. Attempt 87 is Cambridge IELTS 20 Test 1 (English source), left unsubmitted. This validates the Writing field's native CJK input path only, not generic grading/provider quality.
- No code finding was reproduced and no code/test files changed. Request final full-feature review against AC-01–12 and the latest fixed P1 findings, retaining the evidence caveat above.

### 2026-10-23 — Codex Reviewer — Final full-feature re-review TV3-MULTILINGUAL

**Agent:** Codex Reviewer. **Decision: PASS.** Re-reviewed TV3-MULTILINGUAL against the approved plan and completion plan, current handoffs, relevant tracked/staged/unstaged/untracked changes, and AC-01–12. Branch `feature/TV3-multilingual-completion`, HEAD `b016894cf3f02db4fe9a9c469583f6791afc707d`; staged diff rỗng. Review chỉ đọc; không thay đổi code/test/plan, không ghi database, không gọi provider, không commit/push.

#### Kết quả và findings

- Hai P1 đã báo ở review trước vẫn được khắc phục:
  - `frontend/src/features/exam/api/resultContract.ts`: `wordCount` legacy và `lengthMetric` được chuẩn hóa độc lập; CJK `CHARACTERS` không còn bị so bằng số từ. Regression mới giữ nguyên `wordCount=1`, metric 6 ký tự và từ chối các metric sai.
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingFeedbackMapper.java`: validation generic rubric dùng frozen visual context; cutoff 10 từ English không còn làm hỏng feedback generic có ảnh. Regression ja/zh xác nhận feedback có visual observations trả `DONE`, score10, đúng rubric/language/length.
- Không phát hiện finding P0/P1/P2 mới trong các code path và integration liên quan. **AC-01–12: đạt theo implementation/tests/evidence trong plan và handoffs**; không dùng các bảng trạng thái PLANNED lịch sử làm blocker sau khi deliverables đã được bổ sung.

#### Verification độc lập trong lần re-review này

- Frontend: `npx vitest run src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx --maxWorkers=2` — **2 files / 102 tests PASS**.
- Backend: `./mvnw.cmd '-Dtest=WritingFeedbackMultilingualMapperTest,AttemptResultSummaryMapperTest' test` — **2 classes / 26 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS.
- Native IME smoke được đối chiếu tại `docs/testing/TV3-MULTILINGUAL-browser-smoke.md`: người dùng báo đã hoàn tất ja/zh/ko trong textarea Writing thật của attempt 87; ảnh ja/zh cho thấy native candidate/composition popup (konnichiwa→こんにちは, Pinyin ni'hao→你好), còn Korean `안녕하세요` đã commit và nhìn thấy trong editor. Hai ảnh ja/zh chụp trước khi đóng popup, nên trạng thái commit cuối của chúng là user-reported, không nhìn thấy trực tiếp. Với giới hạn này, bằng chứng đáp ứng smoke native input theo ML-11C; nó chỉ xác nhận nhập liệu, không xác nhận grading.
- `git diff --check` và `git diff --cached --check` — exit0; có cảnh báo LF/CRLF. Không chạy lại broad suites/PostgreSQL/browser trong lần này; kết quả đó đã được executor ghi tại các entry trước, không tính là reviewer-run hôm nay.

#### Gate và bàn giao

- Cambridge IELTS 20 Test 1 trên attempt 87 có examLanguage English; do đó smoke trên không được xem là bằng chứng cho grading đa ngôn ngữ hay chất lượng Gemini. Human review chất lượng provider theo ngôn ngữ vẫn là gate rollout riêng, không phải finding code của review.
- Seed/publish NLTV, exam IDs của NLTV và application database thuộc task khác; không ảnh hưởng quyết định TV3-MULTILINGUAL.
- Entry này supersedes quyết định **BLOCKED** ở review trước về native IME. Có thể đóng `ML-FULL-01` về mặt review kỹ thuật; không suy ra feature flag generic phải bật hoặc learner rollout được phép khi chưa hoàn tất human review provider.
