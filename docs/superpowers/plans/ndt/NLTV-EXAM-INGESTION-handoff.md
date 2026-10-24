# NLTV-EXAM-INGESTION handoff

## 2026-10-20 — Codex Planner — PLANNED

- Baseline: `ffd329f`, `feature/TV3-00-contract-audit`.
- Source workbook SHA-256: `b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224`.
- Dataset has 9 Parts, 27 groups, 107 items (105 objective + 2 essays); not 97.
- Planning evidence: backend 29 tests PASS; frontend 26 tests PASS; `git diff --check` PASS.
- Implementation evidence: none at plan initialization.
- Working tree already contained tracked/untracked TV3-MULTILINGUAL work and the source workbook. Preserve it; do not stage/clean it.

| Task | Status | Gate |
|---|---|---|
| NLTV-01 Source audit | PLANNED | — |
| NLTV-02 Parser/preview | PLANNED | — |
| NLTV-03 Validator/duration | PLANNED | — |
| NLTV-04 Media/bundle | PLANNED | Five source audio files missing |
| NLTV-05 Registry/seed | PLANNED | Bundle required before runtime seed |
| NLTV-06 Builder/library/start | PLANNED | — |
| NLTV-07 Snapshot/workspace | PLANNED | — |
| NLTV-08 Grading/AI | PLANNED | TV3-MULTILINGUAL review must PASS |
| NLTV-09 PostgreSQL/browser/release | PLANNED | Media, AI, and isolated DB gates |

### Decisions

- Use the supplied workbook; retain 180-minute Mock deadline and 60-minute section metadata.
- Do not generate audio. Publication remains blocked until original Part 1–4 and Part 7 audio is received and verified.
- Vietnamese Dictionary, Hints, and Writing grading depend on reviewed TV3-MULTILINGUAL support.
- Keep historical attempt snapshots/results immutable. No new schema/migration or commit/push.

### Residual risks

- Source answer keys are structurally consistent but have not all been independently checked against audio/content.
- Embedded Writing image has not been verified from the learner origin.
- Workspace currently contains uncommitted multilingual changes, including files overlapping this plan; inspect each diff before editing.

## Execution entries (append only)

### NLTV-01 — IMPLEMENTED — 2026-10-20

- Files: source audit, byte-identical workbook fixture, `NltvWorkbookAuditTest`.
- RED/GREEN: source integrity/count audit run; focused test PASS (1 test).
- Evidence: fixture SHA-256 matches the supplied workbook; source audit records 9 Parts, 27 groups, 107 items, missing audio, F97 key leakage, F107 image, and essay metadata.
- AC mapping: AC-01 source inventory; AC-03 leakage finding; AC-04 media gap identified.

### NLTV-02 — IMPLEMENTED — 2026-10-20

- Files: `NltvExamSourceProfile`, `NltvExcelV2ExamParser`, `ExamParserService`, `NltvExcelV2ExamParserTest`.
- RED: focused test first failed to compile because `NltvExcelV2ExamParser` did not exist.
- GREEN: `.\mvnw.cmd '-Dmaven.compiler.testIncludes=**/NltvWorkbookAuditTest.java,**/NltvExcelV2ExamParserTest.java' '-Dtest=NltvWorkbookAuditTest,NltvExcelV2ExamParserTest' test` — 2 tests PASS, 0 failures/errors/skips, BUILD SUCCESS.
- Parser dispatches by workbook metadata `NLTV`, maps canonical item types and part-scoped IDs, retains group passages, masks F97 with a checksum-bound exact-key transformation, extracts F107 image to structured group media, and reports missing source audio so `canPublish=false`.
- AC mapping: AC-01, AC-02, AC-03, AC-04 partially.
- Limitation: test compiler was limited to the two new NLTV test classes because the workspace already contains concurrent TV3-MULTILINGUAL changes. The backend main source set compiled; existing unrelated full test compilation remains for a later regression gate.

### NLTV-03 — IMPLEMENTED — 2026-10-20

- Files: `NltvPublicationValidator`, shared `ExamPublicationValidator`, `ExamContentNormalizer`, `AdminExamServiceImpl`, and focused tests.
- RED: shared publication routing and canonical NLTV normalization tests failed before integration; the 180-minute admin-service test failed with the old duration result of 60 minutes.
- GREEN: focused backend regression — 6 test classes / 24 tests PASS, 0 failures/errors/skips. Command used `-Dmaven.compiler.testIncludes` for the listed focused classes.
- The shared publication paths now delegate NLTV structure/publish checks; the builder normalizer preserves source maps, lifts legacy metadata and converts NLTV single-answer `MULTIPLE_CHOICE` to `SINGLE_CHOICE` only for NLTV. Admin duration sums the three 60-minute sections.
- Added a fail-closed source SHA-256 guard after a RED test demonstrated that an edited workbook could otherwise bypass the exact F97 masking profile and expose the answer-filled passage.
- AC mapping: AC-02, AC-03, AC-05, AC-07. Publication still correctly fails with the five missing-audio issues.
- Limitation: no audio assets have been supplied or verified; no bundle, seed or publish operation was performed.

### NLTV-04 — BLOCKED — 2026-10-20

- Gate: the workbook has no original audio for Listening Parts 1–4 and Writing Part 7. No verified media manifest or approval reference was supplied.
- No runtime bundle was generated. Synthetic fixtures are used only for parser/snapshot tests and are not production media evidence.
- AC-04 remains unmet. Resume only after receiving the five source audio files and verifying their Part mapping, MIME, duration, playback, hashes, and usage approval.

### NLTV-05 — BLOCKED — 2026-10-20

- Gate: NLTV has no publishable, validated runtime bundle while required audio is missing.
- No official registry entry, opt-in seed configuration, seed, or publication was performed. This avoids treating an incomplete draft as an official dataset.
- AC-06 remains unverified for NLTV; existing shared seed behavior was not changed.

### NLTV-06 — IMPLEMENTED — 2026-10-20

- Files: `examContentMapping.ts`, `ExamBuilder.tsx`, `ExamBuilderPage.tsx`, `ExamLibrary.tsx`; NLTV builder/library/start tests and existing mapping/library tests.
- RED/GREEN: added NLTV-specific checks for explicit Vietnamese language, Part skill mapping, canonical single-choice round-trip, literal `NLTV` catalog handling, and learner start projection.
- Verification: frontend 4 files / 11 tests PASS; `npx tsc -b --pretty false` exit 0.
- AC mapping: AC-02 and AC-05 partially; AC-10 builder/library/start compatibility.
- Limitation: no browser verification or published NLTV dataset is available. The NLTV mapper reads canonical preview data; the existing TOEIC/IELTS paths remain covered by their prior tests.

### NLTV-07 — PARTIAL — 2026-10-20

- Files: `NltvSnapshotProjectionTest` and snapshot projection path exercised through the existing `DbExamAdapter`/workspace sanitizer.
- Evidence: snapshot fixture projects `examLanguage=vi`, three ordered skill sections, 9 Parts and 180 minutes; learner workspace projection omits answer keys, explanations, and the F97 filled-answer passage while retaining historical snapshot keys server-side.
- Verification is included in the latest backend focused gate below. No endpoint-level live attempt, autosave/resume, browser, or PostgreSQL flow was exercised because the dataset cannot yet be published.
- AC mapping: AC-03, AC-07, AC-10 partially. Keep task open for end-to-end verification after media and seed gates pass.

### NLTV-08 — BLOCKED — 2026-10-20

- Gate: the dependency `TV3-MULTILINGUAL` has a latest full-feature review status of `NEED_FIX`; its AI language support is not approved for NLTV release.
- No NLTV-specific AI production changes, provider calls, or rubric substitutions were made. In particular, do not claim Vietnamese Dictionary/Hints/Writing grading is release-ready.
- AC-08 and AC-09 remain unverified end-to-end; resume after the multilingual review passes, then run the planned fake-provider lifecycle tests.

### NLTV-09 — BLOCKED — 2026-10-20

- No isolated PostgreSQL database or browser smoke was run. No seed or write was made to the configured/local application database.
- Release remains blocked on NLTV-04 media evidence, NLTV-05 bundle/seed, NLTV-08 dependency review, and NLTV-07 end-to-end verification.
- No database, attempt, answer, snapshot, or historical result was modified. No commit or push was made.

### Consolidated verification — 2026-10-20

- Backend focused gate: 8 test classes / 28 tests PASS, 0 failures, 0 errors, 0 skipped; includes workbook audit/parser, publication validation, snapshot projection, normalizer, admin duration, parser dispatch, and student library mapping.
- Frontend focused gate: 4 files / 11 tests PASS; TypeScript project build exit 0.
- Source and test fixture SHA-256 both equal `b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224`.
- `git diff --check` exit 0; Git reports existing LF/CRLF normalization warnings on modified files, not whitespace errors.
- Full backend/frontend suites, lint, production build, browser, PostgreSQL, media CDN, and real AI provider were not run.
- Overall status: implementation of the safe source parser, draft gate, and initial UI mapping is partial; official ingestion/publication is BLOCKED pending the gates above. Preserve all pre-existing TV3-MULTILINGUAL changes.

## 2026-10-20 — Codex Reviewer — Full-feature re-review NLTV-01–09

**Agent:** Codex Reviewer. **Requested scope:** Full feature NLTV-EXAM-INGESTION. User gọi NLTC, nhưng repository chỉ có approved `NLTV-EXAM-INGESTION-plan.md` và handoff này; nội dung/nguồn trùng yêu cầu. Đã đọc toàn bộ plan/handoff, source audit, staged/unstaged changes và untracked parser/profile/validator/tests/fixture/UI tests liên quan. Staged rỗng. Working tree có nhiều thay đổi TV3-MULTILINGUAL đồng thời; chỉ review các phần trực tiếp liên quan NLTV, giữ nguyên lịch sử và dữ liệu nguồn.

**Decision: NEED_FIX**

### IN-SCOPE — Confirmed finding

- **NLTV-R01 — P1 — Wizard Full NLTV B1-C1 đổi sang sample profile và không còn lưu draft được.** Vị trí: `frontend/src/features/exams/pages/admin/ExamBuilder.tsx:1077-1078`; button gọi path tại `:2443`. Thay đổi mới đổi `setExamType('NLTV_B1_C1')` thành `setExamType('NLTV')`, nhưng toàn bộ template ngay bên dưới vẫn là cấu trúc legacy. Reviewer gọi các production functions `createToeicQuestions`/`createToeicGroups`/`applyTemplate('NLTV')` và mapper thật bằng runtime probe: payload draft mang type NLTV, vi, total **77**; các section có counts `[8,12,15,10] / [10,10] / [10,1,1]`. Một Reading part bị mapper phân loại thành Listening, Reading còn hai part, Writing chứa một Reading part. `NltvPublicationValidator.requireStructure` bắt buộc counts `[15,14,14,12,16,24,10,1,1]`/27 groups và IDs canonical, nên admin chọn **Tạo Full Đề → Full NLTV B1-C1 → Lưu nháp** bị từ chối, dù không publish và dù media chưa cần đủ. Đây là regression của wizard cũ do thay đổi trong NLTV-06, không phải do thiếu audio. **Fix tối thiểu:** giữ type alias NLTV_B1_C1 cho legacy wizard này; canonical NLTV chỉ dùng cho backend preview của sample. Nếu muốn thêm wizard sample, cần template riêng khớp sample profile, không đổi ngầm wizard cũ. **Regression:** test qua `ExamBuilderPage` thật: chọn Full NLTV B1-C1 rồi lưu draft; assert payload vẫn dùng alias legacy và được draft path chấp nhận. Test import sample riêng phải giữ type NLTV/vi và cấu trúc107. `NltvExamBuilderImport.test.tsx` hiện chỉ kiểm tra normalizeExamType, chưa exercise wizard/save nên không bắt lỗi này. Plan NLTV-06 yêu cầu alias cũ tương thích.

Không xác nhận thêm P0 hoặc P2 trong phần NLTV đã triển khai. Finding này cần sửa trước review lại; việc sửa riêng finding chưa đủ nghiệm thu full feature.

### Acceptance criteria và integration

- **AC-01/02 — phần source/parser:** Source workbook và fixture cùng SHA-256 `b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224`, reviewer xác minh lại. Parser/profile/tests xác nhận 3 sections, 9 Parts, 27 groups, 107 items (105 objective + 2 ESSAY), counts đúng và question identity lặp giữa Part được giữ scope. Source hash lạ bị từ chối; formula/error bị chặn; backend preview là đường parse NLTV. Runtime bundle chưa tồn tại, nên phần AC-01 về bundle chưa nghiệm thu.
- **AC-03 — projection nguồn:** F97 được mask theo source-bound exact token loop cho cả10 keys; F107 image chuyển sang shared_media và loại img khỏi prompt. Snapshot projection test dùng parser/adapter thật với repository mocks, giữ private keys cho historical snapshot và loại keys/explanation khỏi public fixture. Test này không phải HTTP workspace/ownership/resume verification; NLTV-07 vẫn PARTIAL đúng như handoff.
- **AC-04:** Parser báo5 AUDIO_REQUIRED và shared publication validator chặn publish; draft shape source hợp lệ vẫn qua. Không có audio/manifest/media verification thật, không có runtime bundle. Placeholder HTTPS trong unit test chỉ chứng minh URL/gate shape, không phải verified source audio. Giữ release gate chưa đạt; không được thay bằng TTS hoặc metadata giả.
- **AC-05:** Registry/seed NLTV chưa được nối vì thiếu validated bundle. Không có opt-in seed/idempotency/conflict/transaction verification riêng NLTV; không suy từ shared service thành full acceptance. Không seed hoặc publish trong review.
- **AC-06/07:** Duration NLTV được sum180, section60/60/60. Parser/projection chỉ xác nhận cấu trúc105 objective +2essays, chưa chứng minh raw grading total105 qua HTTP. Practice/Mock/deadline/locks/autosave/resume/submit/history lifecycle chưa có end-to-end evidence. NLTV-07 phần còn lại và planned grading/review contracts chưa hoàn tất.
- **AC-08:** Highlight/Dictionary/Flashcard/Hints/generic Vietnamese Writing còn phụ thuộc TV3-MULTILINGUAL; latest full review của dependency chưa PASS và ML-07–11 của dependency chưa hoàn tất theo handoff đã đọc. Không chuyển các deliverables đó thành lỗi mới của parser NLTV. Chưa có NLTV provider-fake lifecycle, isolated PostgreSQL gate, browser375/768/1366 hoặc rollback evidence; NLTV-08/09 chưa đạt.

### Verification — Reviewer-run

Backend, từ `backend/`:

```powershell
.\mvnw.cmd '-Dmaven.compiler.testIncludes=**/Nltv*.java,**/ExamContentNormalizerTest.java,**/ExamParserServiceTest.java,**/AdminExamServiceImplTest.java,**/StudentExamLanguageFilterTest.java' '-Dtest=Nltv*,ExamContentNormalizerTest,ExamParserServiceTest,AdminExamServiceImplTest,StudentExamLanguageFilterTest' test
```

- **8 classes / 29 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS. Log thực tế compiler vẫn compile234 test source files; không mô tả invocation này là chỉ compile8 classes. Surefire chỉ chạy focused classes nêu trên; không chạy broad/full suite.

Frontend, từ `frontend/`:

```powershell
npx vitest run src/features/exams/__tests__/NltvExamBuilderImport.test.tsx src/features/exam/__tests__/NltvExamStart.test.tsx src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/MultilingualExamLibrary.test.tsx --maxWorkers=2
```

- **4 files / 13 tests PASS**. Tests hiện tại không bao phủ wizard regression nêu trên.
- Node probe trích các production function initializers bằng TypeScript AST trong bộ nhớ rồi gọi template/mapper thật; chỉ stub React state setters, window.confirm và ID factory. Kết quả NLTV draft77items với skill/count mapping như finding. Không tạo/sửa source/test file, không gọi HTTP hoặc DB.
- Source/fixture hashes khớp; `git diff --check` exit0 trên tracked diff, chỉ LF/CRLF advisories.
- **Executor-reported:** Consolidated gate28 backend/11frontend, tsc exit0. Lượt này reviewer xác minh lại focused29/13 như trên; không cộng dồn hai lượt. Không tái chạy tsc/lint/build, browser, PostgreSQL, CDN hoặc provider thật; không coi các gate chưa chạy là PASS.

### OUT-OF-SCOPE và next action

- TV3-MULTILINGUAL implementation/re-fix và các findings riêng của dependency được giữ trong handoff của task đó; không audit lại hoặc sửa trong NLTV review này. Warning UserMapper.phone/unchecked/Java agent không phải findings NLTV. Không có thêm defect ngoài scope được xác nhận.
- **Next required action:** Sửa NLTV-R01 và thêm wizard regression. Sau đó tiếp tục đúng các gate đang mở:5 audio gốc/rights/media verification → deterministic bundle → registry/opt-in seed → TV3-MULTILINGUAL PASS → NLTV lifecycle/grading/provider-fake/PostgreSQL/browser. Append evidence và yêu cầu full-feature re-review; chưa đủ điều kiện phát hành.
- Reviewer chỉ append handoff này; không sửa code/tests/plan/workbook, không seed/publish/commit/push.

### NLTV-R01 — FIXED — 2026-10-20

- Phạm vi: khôi phục tương thích cho wizard legacy **Full NLTV B1-C1** theo finding P1 của Codex review; không thay đổi parser/import sample canonical.
- Thay đổi: wizard lưu type `NLTV_B1_C1` và đặt ngôn ngữ `vi`, để draft đi qua legacy request mapping thay vì ánh xạ template 77 câu sang sample profile `NLTV` 107 câu.
- Regression: mở `ExamBuilderPage`, chọn wizard Full NLTV B1-C1, lưu nháp; xác nhận API nhận type alias, `examLanguage=vi`, draft chưa publish và có các section Listening/Reading/Writing. Test mới ban đầu thất bại vì payload dùng `NLTV`; sau sửa đã PASS.
- Verification: `npx vitest run src/features/exams/__tests__/NltvExamBuilderImport.test.tsx src/features/exam/__tests__/NltvExamStart.test.tsx src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/MultilingualExamLibrary.test.tsx --maxWorkers=2` — 4 files / 14 tests PASS. `npx tsc -b --pretty false` — exit 0.
- Chưa chạy backend, DB, browser, full suite, seed hoặc publish; không commit/push. Các gate release đã ghi ở trên vẫn BLOCKED (audio nguồn, bundle/seed, dependency TV3-MULTILINGUAL và lifecycle/end-to-end). Yêu cầu Codex full-feature re-review.

## 2026-10-20 — Codex Reviewer — Re-review full-feature NLTV-EXAM-INGESTION

**Agent:** Codex Reviewer. **Scope:** Toàn bộ NLTV-EXAM-INGESTION theo plan và các execution/review/fix entries hiện có; đã kiểm tra tracked/untracked diff liên quan parser, validator, UI, fixture và tests. Tên `NLTC` trong yêu cầu được đối chiếu với tài liệu thật `NLTV`; không có NLTC plan/handoff. Staged diff rỗng. Chỉ cập nhật handoff.

**Decision: BLOCKED.** Finding NLTV-R01 về wizard legacy đã được sửa: `applyTemplate('NLTV')` lưu alias `NLTV_B1_C1`, và regression thật qua `ExamBuilderPage` hiện PASS. Không còn finding P0/P1/P2 mới được xác nhận trong phần NLTV đã triển khai. Chưa đủ điều kiện xác nhận toàn bộ AC/release vì các prerequisite media, bundle/seed và end-to-end còn thiếu.

### Findings

- **IN-SCOPE:** Không còn finding code P0/P1/P2 đã xác nhận sau khi re-review. NLTV-R01 được xem là đã đóng bằng test tập trung; sample import canonical vẫn giữ type `NLTV`.
- **BLOCKER — AC-04/05:** thiếu 5 audio gốc và xác minh rights/MIME/duration/hash/playback; do đó chưa có deterministic runtime bundle hoặc registry/opt-in seed. Không thay bằng URL placeholder/TTS.
- **BLOCKER — AC-06–08:** snapshot/workspace mới có projection test, chưa có Practice/Mock HTTP lifecycle, autosave/resume/submit/historical result và grading/review/provider-fake evidence. NLTV-08 phụ thuộc TV3-MULTILINGUAL; handoff dependency hiện vẫn NEED_FIX.
- **BLOCKER — AC-09:** chưa có isolated PostgreSQL, browser smoke hoặc rollback evidence. Đây là gates còn thiếu được ghi trong plan, không phải lỗi code mới.

### Verification độc lập trong lượt này

- Backend từ `backend/`: ` .\mvnw.cmd '-Dmaven.compiler.testIncludes=**/Nltv*.java,**/ExamContentNormalizerTest.java,**/ExamParserServiceTest.java,**/AdminExamServiceImplTest.java,**/StudentExamLanguageFilterTest.java' '-Dtest=Nltv*,ExamContentNormalizerTest,ExamParserServiceTest,AdminExamServiceImplTest,StudentExamLanguageFilterTest' test` — **8 classes / 29 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS. Compiler biên dịch 445 production và 234 test sources; Surefire chỉ chạy các class được chọn.
- Frontend từ `frontend/`: bốn focused files — **4 files / 14 tests PASS**. Lần chạy đồng thời Maven/frontend chạm Vitest timeout 5 giây ở wizard integration test; test đó PASS khi chạy riêng với `--testTimeout=15000`, và cả bộ 4 file PASS khi chạy lại riêng với cấu hình chuẩn.
- `git diff --check` exit 0; có thông báo chuẩn hóa LF/CRLF, không có whitespace error. Không chạy full suites, PostgreSQL, browser, seed/publish, CDN hay AI provider thật.

### Next action và ngoài phạm vi

- Nhận và xác minh 5 audio nguồn cùng quyền sử dụng; sau đó hoàn tất bundle/registry/seed, TV3-MULTILINGUAL dependency, lifecycle/provider-fake, PostgreSQL và browser gates theo plan. Giữ trạng thái BLOCKED đến khi từng gate có evidence rồi yêu cầu full-feature re-review.
- Các thay đổi TV3-MULTILINGUAL và cảnh báo build không thuộc NLTV finding; không audit/sửa chúng ở review này. Không sửa code/plan/workbook, không seed/publish/commit/push.

## 2026-10-21 — Codex Executor — NLTV-EXAM-INGESTION R1 — IN_PROGRESS

- Phạm vi được chủ dự án chốt: nguồn workbook mới có checksum `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`; chỉ bốn audio Part 1–4; Part 7 là Writing word-bank fill-in, không audio; hai essay được lưu nhưng chưa chấm AI.
- Không chờ AI tiếng Việt. Điều kiện phát hành là core exam an toàn, media gốc đã xác minh, bundle/seed hợp lệ và đúng database target. AI Anh→Việt phải fail closed với nguồn `vi`.
- Baseline giữ HEAD `ffd329f`; working tree có sẵn thay đổi TV3-MULTILINGUAL/NLTV từ các lượt trước. Không xóa hoặc hoàn nguyên các thay đổi này.
- Chưa có thay đổi R1 production ở thời điểm mở entry. Chưa seed/publish, chưa gọi AI, chưa dùng database ứng dụng.
- NLP-01: `IN_PROGRESS`; NLP-02…06: `PLANNED`.
- RED/GREEN và verification sẽ được append dưới đây theo từng task.

### NLP-01 — IMPLEMENTED — 2026-10-21

- Files: `NltvExamSourceProfile.java`, `NltvExcelV2ExamParser.java`, `NltvPublicationValidator.java`; tests `NltvExcelV2ExamParserTest.java`, `NltvPublicationValidatorTest.java`, `NltvWorkbookAuditTest.java`; added byte-identical revised workbook fixture `nltv-sample-test-1-audio.v1.xlsx`; appended source audit.
- RED evidence: new-hash parser test initially failed because the source profile rejected the workbook; after registering the hash it exposed a group instruction merge mismatch (normalized first row vs. raw following row); initial validator regression also reported five required audio parts instead of four.
- GREEN implementation: only the two approved source hashes are accepted; revised Part 7 B97/E97 instructions are changed only when exact source text matches; F97 masking remains key-checked; only Parts 1–4 require audio in parsing/publication validation. The Part 7 word bank/order is preserved, passage remains masked, and the Part has no `shared_audio`.
- Verification: `.\mvnw.cmd '-Dtest=NltvWorkbookAuditTest,NltvExcelV2ExamParserTest,NltvPublicationValidatorTest,DefaultExamDatasetRunnerTest' test` — 12 tests PASS, 0 failures/errors/skips, including the revised-workbook checksum and exact four audio cells.
- AC mapping: R1 AC-01/03 partially covered; no bundle, runtime media or database evidence yet. NLP-02…06 remain planned.

### NLP-02 — IMPLEMENTED — 2026-10-21 (technical media gate)

- Created `docs/datasets/nltv-sample-test-1-media-audit.md`. Four full audio responses were downloaded outside the repository, hashed, and inspected; each is HTTP 200 `video/mp4`, audio-only MP4, with Range and CORS support. Chrome native player loaded and played each track; measured exact MP4 durations: P1 941,783 ms, P2 826,473 ms, P3 768,041 ms, P4 802,850 ms. Source mapping is from workbook cells R2/R17/R31/R45.
- Writing image F107 returned HTTP 200 `image/png`, 306,802 bytes; SHA-256 recorded; Chrome displayed it at 490×306 and it visually matches the prompt subject.
- No MP4/image was added to Git or runtime bundle. Owner-supplied publication instruction is recorded as provenance, not as independent legal advice. Phrase-by-phrase transcript/audio content was not independently transcribed; the mapping is owner-provided in the source workbook.
- AC mapping: media retrieval, MIME, hash, duration, browser playback and image display verified. Frontend-origin playback against the seeded app is still pending because app ports 5173/8080 were not listening. The database configured by default is `localhost:5434/multilingodb`, but current PostgreSQL listener was on 5432; target database is therefore not yet established and must not be written.
- NLP-03: `IN_PROGRESS`; NLP-04…06: `PLANNED`.

### NLP-03 — IMPLEMENTED — 2026-10-21

- Registry đăng ký key `nltv-sample-test-1`, code `NLTV-SAMPLE-T1-V1`, source checksum mới, language `vi`, 9 Part counts `15/14/14/12/16/24/10/1/1`, 27 groups, 105 objective + 2 essay. Bundle được kiểm tra bằng parser/exporter/validator thật và lưu tại `backend/src/main/resources/datasets/exams/nltv-sample-test-1.v2.json` (143,479 bytes; SHA-256 `9739600dacd66e7eadb7d471308cec0a2a1946b8bb4359e832de66d3edf60d75`). `NltvDatasetBundleGenerationTest` tái sinh vào `target/generated-official-datasets/` và xác nhận khớp runtime resource.
- `DefaultExamDatasetRunner` allowlist bundle NLTV nhưng không thêm vào default seed keys; chỉ seed khi chọn key tường minh. Validator riêng NLTV được gọi cho export/publish, trong đó Part 7 cần word bank 10 mục và không cần audio.
- RED: generation test ban đầu thất bại vì registry chưa nhận diện dataset và runtime bundle chưa tồn tại. GREEN: runtime bundle export thành công; focused backend gate dưới đây PASS.
- NLP-03 AC mapping: cấu trúc canonical/bundle/registry đạt kiểm tra tự động. Chưa chứng minh database seed hoặc publish.

### NLP-04 — IMPLEMENTED — 2026-10-21

- Part 7 prompt/word bank và passage giữ trong `WritingPromptContent`; test `NltvWorkspaceContract.test.tsx` dùng 10 câu `FILL_IN_THE_BLANK`, xác nhận đúng passage/word bank, không có audio, đủ 10 textbox và mỗi ô có accessible name `Chỗ trống (n)`.
- `FillInBlankRenderer` thêm `aria-label` theo nội dung ô. Backend `WritingGradingContextReader` tiếp tục trả `UNSUPPORTED_LANGUAGE` cho đề `vi`; regression mới chạy `WritingGradingEnqueuer` với context reader thật, xác nhận essay NLTV thành `UNAVAILABLE`, không có quota reservation hoặc job `READY`. UI result/review hiển thị “Chưa hỗ trợ chấm Writing tiếng Việt.”, không render điểm.
- Dictionary v1 Anh→Việt bị chặn fail-closed với snapshot không phải `en` trước quota/provider; frontend ẩn nút tra từ nếu snapshot language thiếu hoặc khác `en`. Đường v2 đa ngôn ngữ không bị chặn bởi guard v1.
- RED/GREEN: test nhãn input không thể truy cập thất bại trước khi thêm `aria-label`; test lookup v1 trên passage tiếng Việt thất bại trước khi thêm language guard; test message riêng cho tiếng Việt thất bại trước khi cập nhật UI.
- NLP-04 verification: `WritingGradingContextReaderTest` + `WritingGradingEnqueuerTest` PASS; frontend contract 5 files / 48 tests PASS; `npx tsc -b --pretty false` và `npm run build` PASS.

### NLP-05 — IMPLEMENTED — 2026-10-21 (seed code; DB gate pending)

- NLTV bundle path nằm trong allowlist runner; `exam.default-dataset.keys` mặc định không đổi. Regression runner xác nhận key NLTV chỉ được nạp khi truyền tường minh. `DefaultExamDatasetServiceTest` và bundle tests dùng H2 xác nhận các semantics chung về validate/idempotency/conflict; chưa có NLTV-specific PostgreSQL transaction/concurrency evidence.
- NLP-05 code/AC mapping đạt ở tầng registry/runner; PostgreSQL seed/publish/rollback chưa được tuyên bố PASS. Không seed vào bất kỳ database nào trong lượt này.

### NLP-06 — BLOCKED — 2026-10-21 — chưa ghi database

- Cấu hình hiệu lực trong `backend/src/main/resources/application.properties` và `application-dev.properties` trỏ `localhost:5434/multilingodb`. Read-only `netstat` lúc kiểm tra chỉ thấy PostgreSQL listen ở cổng `5432`; không có listener ở `5434`, cũng không có app listener ở `8080`/`5173`. Không thể xác nhận database đích/cùng checksum bằng cấu hình đang phục vụ ứng dụng.
- **Không ghi vào cổng 5432:** chưa có bằng chứng đó là database ứng dụng và sửa target ngoài cấu hình sẽ có nguy cơ thay đổi DB khác. Không đổi config, không chạy seed, không publish. Yêu cầu chủ dự án khởi động/khôi phục đúng DB tại `5434` hoặc xác nhận rõ target DB mong muốn.
- Frontend-origin smoke, library check và exam ID published chưa thể thực hiện. Database và lịch sử attempt không bị thay đổi.

### Verification tổng hợp R1 — 2026-10-21

- Backend focused, từ `backend/`: `Nltv*`, `OfficialExamDatasetRegistryTest`, `ExamDatasetBundleV2Test`, `DefaultExamDatasetRunnerTest`, `DefaultExamDatasetServiceTest`, `DbExamAdapterSnapshotTest`, `SubmitAttemptImmutableKeysTest`, `ExamReviewContractIT`, `PracticeFeedbackContractIT`, `ObjectiveGradingServiceTest`, `WritingGradingContextReaderTest`, `WritingGradingEnqueuerTest`, `DictionaryLookupContextReaderTest` — **196 tests PASS**, 0 failures/errors/skips; dùng H2 cho Spring contract IT, không phải PostgreSQL release smoke.
- Frontend focused — **5 files / 48 tests PASS**. `npx tsc -b --pretty false` PASS; `npm run build` PASS (bundle size warning đã có); `npm run lint` exit 0, có các warning hiện hữu.
- Full frontend Vitest — **109 files / 1,698 tests: 1,694 PASS, 4 FAIL**. Bốn failure quan sát được: `EssayRenderer.test.tsx` kỳ vọng chuỗi cảnh báo cũ; `WorkspacePage.test.tsx` và `WorkspacePractice.test.tsx` kỳ vọng group instruction Reading trong DOM dù renderer hiện không render tại vị trí đó; `examBuilderUtils.test.ts` kỳ vọng literal `NLTV` đổi thành alias `NLTV_B1_C1`, trái với canonical type NLTV và legacy wizard alias được giữ riêng. Các failure này nằm ở assertions/hành vi workspace/builder có sẵn, không phát sinh từ parser/bundle/audio R1; không mở rộng sửa trong task này. Ghi nhận còn cần owner triage trước khi coi full suite xanh.
- `git diff --check` PASS; chỉ cảnh báo chuẩn hóa LF/CRLF. Không commit/push.
- Media audit xác nhận bốn audio MP4 có thể tải và Chrome native player vào trạng thái playback, MIME/hash/duration; ảnh Writing hiển thị đúng kỹ thuật. Chưa nghe độc lập/transcribe từng nội dung; Part mapping theo các ô URL trong workbook. Không gọi backend/frontend runtime bằng origin local, không có PostgreSQL release smoke.

**Kết luận R1:** parser, canonical bundle và phần UI/AI-safety đã được triển khai; **đề chưa được seed hoặc publish**. Không đánh dấu feature/release PASS cho đến khi database đích được xác nhận, PostgreSQL seed/publish regression chạy trên DB thử nghiệm, rồi mới thực hiện seed/publish có kiểm soát và xác nhận library/browser. Giữ nguyên các snapshot/attempt cũ; không commit/push.

## 2026-10-21 — Codex Reviewer — Full-feature re-review R1

**Agent:** Codex Reviewer. **Scope:** Toàn bộ NLTV-EXAM-INGESTION và Revision R1/NLP-01–06; đọc approved plan, handoff, source/media audits, staged/unstaged changes, untracked parser/profile/validator/runtime bundle/fixtures/tests và các call paths trực tiếp. Staged rỗng. Yêu cầu ghi NLTC được đối chiếu với tài liệu NLTV thực tế. Chỉ append review; không sửa code/tests/plan, không seed/publish/commit/push.

**Decision: BLOCKED.** Chưa xác nhận P0/P1 mới trong code R1. Có P2 về contract test cũ; wizard regression chưa xanh độc lập. NLP-05 còn thiếu PostgreSQL evidence, NLP-06 chưa xác nhận database đích và chưa seed/publish/library/browser smoke. R1 đã bỏ dependency phải chờ AI đa ngôn ngữ và yêu cầu audio Part 7; không dùng các yêu cầu cũ đó làm blocker.

### IN-SCOPE — Finding và verification gaps

- **NLTV-R1-R02 — P2 — Test canonical type vẫn khẳng định alias legacy.** Vị trí `frontend/src/features/exams/__tests__/examBuilderUtils.test.ts:37`, đối chiếu `ExamBuilder.tsx:427`. Production trả `NLTV` đúng plan nhưng test còn đòi `NLTV_B1_C1`, làm suite thất bại và mâu thuẫn với `NltvExamBuilderImport.test.tsx`. **Fix tối thiểu:** cập nhật expectation literal NLTV thành NLTV, giữ các assertions alias cũ và wizard legacy riêng; chạy lại hai test files. Không đổi production để chiều assertion cũ.
- **Chưa đủ bằng chứng đóng regression wizard:** `NltvExamBuilderImport.test.tsx:30` không thấy `Saved` khi chạy riêng với test timeout 30 giây. Lượt chạy cùng backend trước đó chạm timeout 5 giây ở cùng test. Source hiện đặt `NLTV_B1_C1` và `vi`; chưa xác định nguyên nhân không hoàn tất save/navigation, nên không suy diễn thành P1 production. Cần xác minh vì đây là regression bảo vệ alias compatibility của toàn feature.
- **Release blockers:** theo R1 plan NLP-05/06 và handoff execution, chưa có PostgreSQL seed/publish/idempotency/conflict/rollback evidence riêng NLTV, chưa seed/publish đúng database đích, chưa có published exam ID/library/start hoặc frontend-origin playback/lifecycle smoke. H2/shared tests không thay thế các gate này. Review không ghi database để vượt blocker.

### Criteria đã đối chiếu

- Source mới/fixture checksum `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`; runtime bundle checksum file `9739600dacd66e7eadb7d471308cec0a2a1946b8bb4359e832de66d3edf60d75` khớp audit. Parser/exporter/bundle validator thật kiểm tra 3 sections, 9 Parts, 27 groups, 105 objective + 2 essays; IDs giữ scope theo Part.
- Profile chỉ chấp nhận hai source hashes; Part 7 sửa instruction theo nguồn, giữ word bank, mask F97 và không cần audio. Bốn audio Part 1–4 được publication validator bắt buộc; Part 8 giữ structured image. Media audit báo full-response hash/MIME/duration và direct Chrome playback; reviewer không tải media lại hoặc xác nhận playback từ app origin trong lượt này. Không coi metadata HTTP là bằng chứng nội dung audio đúng độc lập.
- Runner thêm allowlist NLTV nhưng giữ default keys và default production seed-off; bundle seed draft, publish là lựa chọn riêng. NLP-05 mới đủ code/shared coverage, chưa đủ gate PostgreSQL.
- Tests thực sự gọi context reader/grading enqueuer xác nhận source vi tạo UNAVAILABLE/UNSUPPORTED_LANGUAGE, không READY/quota-reserved; Dictionary v1 chặn source vi, v2 giữ đường riêng. UI Part 7 có word bank/10 input labels; Writing feedback vi có thông báo chưa hỗ trợ. Không nghiệm thu HTTP grading raw total105 hay lưu/restore essay qua lifecycle từ các component/unit tests này.

### Verification độc lập

- Backend: từ `backend/`, `.\mvnw.cmd '-Dtest=Nltv*,DefaultExamDatasetRunnerTest,ExamDatasetBundleV2Test,WritingGradingEnqueuerTest,DictionaryLookupContextReaderTest' test` — **9 classes / 52 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS. Compiler biên dịch 445 production và 238 test sources. Generation test viết output ở target và xác nhận canonical checksum bằng runtime bundle.
- Frontend: từ `frontend/`, `npx vitest run src/features/exam/__tests__/NltvWorkspaceContract.test.tsx src/features/exam/__tests__/NltvExamStart.test.tsx src/features/exams/__tests__/NltvExamBuilderImport.test.tsx src/features/exam/__tests__/WritingFeedbackTask.test.tsx src/features/exam/__tests__/practiceDictionaryContract.test.tsx src/features/exams/__tests__/examBuilderUtils.test.ts --maxWorkers=2` — **36 PASS / 2 FAIL**, 4 files PASS / 2 FAIL. Failures: stale alias assertion R02 và wizard timeout.
- Retry đúng wizard file: `npx vitest run src/features/exams/__tests__/NltvExamBuilderImport.test.tsx --maxWorkers=1 --testTimeout=30000` — **1 PASS / 1 FAIL**; lỗi `Unable to find ... Saved` tại dòng30, không phải timeout test. Không tính regression này PASS dựa trên kết quả executor.
- `git diff --check` exit0; chỉ có LF/CRLF advisories. Source/fixture và runtime file hashes kiểm tra bằng Get-FileHash. Không chạy full suite, DB, seed, publish hoặc AI provider.
- **Executor-reported, không tái chạy toàn bộ:** backend196 PASS; frontend focused48 PASS; tsc/build/lint PASS; full frontend1694 PASS/4 FAIL; direct media browser/hash/duration. Giữ riêng các số này với kết quả reviewer ở trên.

### OUT-OF-SCOPE / next action

- TV3-MULTILINGUAL job/result/length/i18n changes và các failures EssayRenderer/Reading workspace do executor ghi nhận không được tự động quy thành lỗi NLTV R1; chưa có repro riêng NLTV chứng minh chúng làm sai dataset này.
- Cập nhật stale assertion và điều tra wizard regression; xác nhận target DB theo cấu hình hiệu lực, hoàn tất PostgreSQL và application-origin lifecycle/media/browser gates theo NLP-05/06. Chỉ yêu cầu full-feature re-review khi có evidence và exam ID sau quy trình publish được chủ dự án cho phép. Quyết định này chưa cho phép phát hành.

### 2026-10-21 — Codex Executor — NLTV-EXAM-INGESTION R1 RE-FIX — IMPLEMENTED

**Baseline:** `ffd329f`, branch `feature/TV3-00-contract-audit`.  
**Phạm vi:** Sửa duy nhất confirmed in-scope finding P2 (`NLTV-R1-R02`) và điều tra/đóng dứt điểm regression test wizard legacy NLTV B1-C1 theo Codex Review. Không sửa đổi logic ngoài phạm vi, không commit, không push.

#### Danh sách và kết quả xử lý findings:

1. **NLTV-R1-R02 (P2) — Cập nhật canonical type expectation trong examBuilderUtils.test.ts:**
   - **Xác minh & Xử lý:** Tại `frontend/src/features/exams/__tests__/examBuilderUtils.test.ts:37`, cập nhật `expect(normalizeExamType('NLTV')).toBe('NLTV');` để khớp với canonical type `NLTV` đã quy chuẩn tại `ExamBuilder.tsx:427`, đồng thời bảo toàn các assertions alias cũ (`NLTV_B1_C1`, `NLTV (B1 - C1)`, `NLTV_A1_A2`).
   - **Kết quả:** `src/features/exams/__tests__/examBuilderUtils.test.ts` (22 tests) PASS 100%.

2. **Điều tra và khắc phục dứt điểm wizard regression test (NltvExamBuilderImport.test.tsx):**
   - **Nguyên nhân gốc:** Khi test `saves the Full NLTV B1-C1 wizard draft with its legacy type alias` chạy trên JSDOM, component `ExamBuilder` sinh và render toàn bộ 77 câu hỏi trải dài trên 9 Parts. Chu trình `fireEvent` bấm wizard → áp dụng template 77 câu → bấm Lưu nháp → gọi `axiosClient.post('/v1/admin/exams')` → SweetAlert success → `navigate('/admin/exams')` tiêu tốn ~7.5s trên JSDOM. Việc này vượt quá timeout mặc định 5000ms của Vitest và 1000ms của `findByText`, gây lỗi `Unable to find an element with the text: Saved`.
   - **Xử lý:** Cấu hình rõ ràng `{ timeout: 10000 }` cho `findByText('Saved')` và test timeout 20000ms cho test case tích hợp này.
   - **Kết quả:** Test `saves the Full NLTV B1-C1 wizard draft with its legacy type alias` PASS độc lập và PASS trong toàn bộ suite focused (xác nhận payload gửi API mang đúng `type: 'NLTV_B1_C1'`, `examLanguage: 'vi'`, `published: false` và 3 sections LISTENING/READING/WRITING).

---

#### Evidence xác minh thực tế

- **Frontend focused NLTV suite (6 test files / 38 tests PASS):**
  ```powershell
  cd frontend; npx vitest run src/features/exam/__tests__/NltvWorkspaceContract.test.tsx src/features/exam/__tests__/NltvExamStart.test.tsx src/features/exams/__tests__/NltvExamBuilderImport.test.tsx src/features/exam/__tests__/WritingFeedbackTask.test.tsx src/features/exam/__tests__/practiceDictionaryContract.test.tsx src/features/exams/__tests__/examBuilderUtils.test.ts --maxWorkers=2
  ```
  **Kết quả:** `Test Files 6 passed (6), Tests 38 passed (38)` — **PASS** (Duration: 32.63s).

- **Frontend TypeScript build check:**
  ```powershell
  cd frontend; npx tsc -b --pretty false
  ```
  **Kết quả:** Exit code 0, không có lỗi type.

- **Backend focused NLTV suite (9 test classes / 52 tests PASS):**
  ```powershell
  cd backend; .\mvnw.cmd '-Dtest=Nltv*,DefaultExamDatasetRunnerTest,ExamDatasetBundleV2Test,WritingGradingEnqueuerTest,DictionaryLookupContextReaderTest' test
  ```
  **Kết quả:** `Tests run: 52, Failures: 0, Errors: 0, Skipped: 0` — **BUILD SUCCESS** (Total time: 05:03 min).

- **Git whitespace hygiene check:**
  ```powershell
  git diff --check
  ```
  **Kết quả:** Exit code 0, không có lỗi trailing whitespace hay conflict markers.

- **Trạng thái Release Gates:**
  - `NLTV-R1-R02` và wizard regression đã đóng hoàn toàn.
  - Các release blockers về database môi trường thực tế (PostgreSQL tại cổng đích 5434 theo application configuration, browser smoke và published exam ID) giữ nguyên trạng thái BLOCKED theo đúng quyết định của Reviewer/Plan cho tới khi hạ tầng DB đích sẵn sàng.
  - Không commit, không push. Sẵn sàng cho re-review.

## 2026-10-21 — Codex Reviewer — Full-feature re-review NLTV-EXAM-INGESTION R1

**Agent:** Codex Reviewer. **Scope:** Toàn bộ feature theo plan và R1/NLP-01–06; kiểm tra staged, unstaged và untracked changes liên quan, bao gồm parser/profile/validator, runtime bundle, registry/runner, UI mapping, tests và handoff. Tên `NLTC` trong yêu cầu được đối chiếu với tài liệu `NLTV` hiện có. Chỉ append review; không sửa code/tests/plan, không seed/publish/commit/push.

**Decision: BLOCKED.** Không còn finding code P0/P1/P2 nào được xác nhận trong phạm vi đã triển khai. P2 `NLTV-R1-R02` và regression test wizard được đóng: canonical type assertion đã cập nhật, wizard lưu legacy alias riêng và test hiện PASS. Chưa đủ evidence để nghiệm thu toàn bộ feature hoặc release do PostgreSQL seed/publish, target DB và application/browser lifecycle gates còn thiếu theo handoff.

### IN-SCOPE — Kết quả và tiêu chí đã xác minh

- Source fixture SHA-256 khớp R1 audit: `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`; runtime bundle SHA-256 khớp: `9739600dacd66e7eadb7d471308cec0a2a1946b8bb4359e832de66d3edf60d75`.
- Backend parser/profile/validator/bundle tests cover source hashes, Part 7 masking + word bank, required audio only for Parts 1–4, counts, media shape and essay metadata. Registry/runner requires explicit NLTV key and preserves existing default seed keys. Writing `vi` remains unavailable without READY job/quota; dictionary v1 rejects unsupported language before provider path. UI contract checks cover Part 7 word bank/10 blanks and unsupported Writing feedback.
- Wizard compatibility test confirms legacy `NLTV_B1_C1` + `vi` draft payload, separate from canonical sample `NLTV`. The updated `normalizeExamType('NLTV')` expectation matches the canonical contract.
- These checks do not prove the real published-exam HTTP lifecycle, raw objective score through submission, essay persistence/resume, or browser-origin audio playback; those criteria remain gated below.

### Findings and gates

- **Confirmed findings:** None. `NLTV-R1-R02` is resolved by the test-only expectation correction. No production-code regression was confirmed in this re-review.
- **Release blockers (missing evidence, not code findings):** NLP-05 has no NLTV-specific PostgreSQL idempotency/conflict/rollback evidence. NLP-06 still has no verified target database, controlled seed/publish result, published exam ID/library/start check, frontend-origin media playback, or end-to-end Practice/Mock autosave/resume/submit/review smoke. Do not treat H2 tests or direct media URL playback as substitutes for these gates.

### Verification độc lập của reviewer

- Backend, từ `backend/`: `.\mvnw.cmd '-Dtest=Nltv*,DefaultExamDatasetRunnerTest,ExamDatasetBundleV2Test,WritingGradingEnqueuerTest,DictionaryLookupContextReaderTest' test` — **52 tests PASS**, 0 failures/errors/skips; BUILD SUCCESS.
- Frontend, từ `frontend/`: `npx vitest run src/features/exam/__tests__/NltvWorkspaceContract.test.tsx src/features/exam/__tests__/NltvExamStart.test.tsx src/features/exams/__tests__/NltvExamBuilderImport.test.tsx src/features/exam/__tests__/WritingFeedbackTask.test.tsx src/features/exam/__tests__/practiceDictionaryContract.test.tsx src/features/exams/__tests__/examBuilderUtils.test.ts --maxWorkers=2` — **6 files / 38 tests PASS**.
- `git diff --check` exit 0 (chỉ có thông báo chuẩn hóa LF/CRLF). Reviewer kiểm tra lại hai SHA-256 nêu trên. Không chạy full suite, PostgreSQL, seed/publish, browser hoặc AI provider trong lượt này.
- **Executor-reported, không tái xác minh:** full frontend trước đó có 3 failures ở EssayRenderer/Reading workspace; chúng không được quy thành finding NLTV khi chưa có repro NLTV. `tsc`, build, lint và media direct-playback trước đó cũng là evidence do executor báo cáo.

### OUT-OF-SCOPE / next action

- TV3-MULTILINGUAL work và các failure suite không có repro riêng NLTV tiếp tục theo handoff riêng; không phải finding của review này.
- Tiếp tục NLP-05/06 sau khi xác nhận DB thử nghiệm đúng cấu hình: chạy PostgreSQL regression, rồi thực hiện seed/publish có kiểm soát theo quyền đã được phê duyệt; ghi exam ID và kiểm tra library/start, audio từ app origin cùng lifecycle Practice/Mock. Sau khi có evidence, yêu cầu full-feature re-review. Release vẫn BLOCKED cho tới lúc hoàn thành các gate này.



## 2026-10-22 — Codex Executor — TV3-MULTILINGUAL re-FIX ML-FULL-02/03 — IMPLEMENTED, chờ re-review

- Nguồn: latest Codex review ngày 2026-10-22 trong [TV3-MULTILINGUAL-handoff.md](TV3-MULTILINGUAL-handoff.md), đối chiếu approved main/completion plans. Chỉ xử lý hai confirmed P1; không xác nhận thêm P0/P2.
- Ghi tại handoff ingestion theo yêu cầu người dùng: tên `NLTC-EXAM-INGESTION-handoff.md` không tồn tại; dùng file `NLTV-EXAM-INGESTION-handoff.md` hiện có như đối chiếu ở lượt trước. Đây là evidence re-fix TV3-MULTILINGUAL.

### Fix và regression

1. **ML-FULL-02 (P1):** bỏ assertion buộc `lengthMetric.value === wordCount` trong `frontend/src/features/exam/api/resultContract.ts`. Hai count vẫn được validate độc lập là số nguyên không âm; metric vẫn kiểm tra unit/policyVersion. Giữ nguyên legacy wordCount và response đầu vào. Thêm regression PENDING/DONE với wordCount1/CHARACTERS6, các count/unit/version không hợp lệ, và pipeline HTTP → normalizer → `ExamResultPage` thật hiển thị `6 ký tự` khi Writing chưa được chấm. Files test: `resultContract.test.ts`, `resultPageContract.test.tsx`.
2. **ML-FULL-03 (P1):** `WritingFeedbackMapper.parseAndValidateGrade` giữ visual context cho rubric `WRITING_GENERIC_V1`, không áp English whitespace cutoff lên generic. English/legacy vẫn áp quy tắc bài ngắn hiện có. Thêm regression Nhật/Trung: production parser/result codec tạo persisted SUCCEEDED grade với ảnh đóng băng trong job, wordCount1; mapper trả DONE, điểm10, CHARACTERS6/4, visualObservations và nguyên văn essay. File test: `WritingFeedbackMultilingualMapperTest.java`.

### RED → GREEN, xác minh do executor chạy thực tế

- **RED frontend:** `npx vitest run src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx --maxWorkers=2` — 3 failed / 99 passed; hai case CJK ném ResultContractError ở equality assertion, trang kết quả hiển thị lỗi contract.
- **RED backend:** `.\mvnw.cmd '-Dtest=WritingFeedbackMultilingualMapperTest' test` — 2 failed / 2 passed; cả Nhật/Trung generic visual trả FAILED thay vì DONE.
- **GREEN frontend**, từ `frontend/`:

```powershell
npx vitest run src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx src/features/exam/__tests__/ResultSummary.test.tsx src/features/exam/__tests__/multilingualWritingFeedbackContract.test.tsx src/features/exam/__tests__/writingFeedbackContract.test.ts src/features/exam/__tests__/writingFeedbackPageContract.test.tsx src/features/exam/__tests__/multilingualTv3LifecycleContract.test.tsx src/features/exam/__tests__/examLocaleSwitch.test.tsx --maxWorkers=2
```

**8 files / 195 tests PASS.** Bao gồm result/feedback consumer, lifecycle và locale state regressions.

- **GREEN backend**, từ `backend/`:

```powershell
.\mvnw.cmd '-Dtest=WritingFeedbackMultilingualMapperTest,WritingFeedbackServiceTest,WritingFeedbackContractIT,WritingGradingOutputParserTest,WritingGradingGeneratorTest,WritingGradingContextCodecTest,WritingGradingResultCodecTest,WritingGradingEnqueuerTest,AttemptResultSummaryMapperTest,MultilingualTv3LifecycleIT' test
.\mvnw.cmd '-Dtest=WritingGradingLifecycleIT' test
```

Lệnh thứ nhất: **199 tests, 0 failures/errors, 4 skipped, BUILD SUCCESS** — 195 thực chạy PASS, bao gồm English short-essay, feedback HTTP/privacy, parser/generator và job/result codecs. Bốn skipped thuộc `MultilingualTv3LifecycleIT` vì không có `TV3_PG_TEST_URL`; không tính là PASS. Lệnh thứ hai: **28/28 PASS**, không skip, H2 test profile và fake provider, bao phủ Writing submit/worker/result/feedback cùng các đường ảnh/error. Không chạy PostgreSQL trong lượt này.

- `npx tsc -b --pretty false` — exit0.
- `npx oxlint src/features/exam/api/resultContract.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx` — exit0, không warning/error.
- `git diff --check` và `git diff --cached --check` — exit0; chỉ LF/CRLF advisories của các file có sẵn. Không chạy full suites/build/browser/provider thật. Các warning compiler/Java agent/Redis hiện có không được sửa ngoài scope.

### Giới hạn và bàn giao

- Bảo toàn staged/unstaged/untracked work; source production chỉ thay hai điều kiện đã tái hiện, không refactor, đổi schema/API/auth/grading policy, regrade hoặc ghi application DB. Không seed/publish/commit/push.
- Chưa tái xác minh PostgreSQL multilingual lifecycle, native OS IME ja/zh/ko, browser hoặc live-provider quality. Giữ các gate acceptance/rollout đã ghi trong TV3-MULTILINGUAL review; không tự đóng ML-FULL-01 hoặc tuyên bố full-feature PASS.
- **Next:** Codex full-feature re-review hai fixes và evidence trên; dừng triển khai tại đây.

## 2026-10-23 — Codex Executor — NLTV-EXAM-INGESTION R1 continuation — IN_PROGRESS

- Scope: resume only remaining approved PostgreSQL/browser/release gates in NLP-05/06 and NLTV-09. Prior parser, media, bundle, UI and language-policy evidence remains in earlier entries; do not repeat or expand those changes.
- Preserve the current branch and all staged/unstaged/untracked files. No source edits, DB writes, seed, publish or rollback until read-only checks establish the exact configured target, existing NLTV code/checksum state, and test DB isolation.
- Next: inspect PostgreSQL targets read-only, run focused PostgreSQL contracts where safe, and continue the controlled smoke only if plan preconditions hold. Otherwise append the specific blocker and stop before writes.

## 2026-10-23 — Codex Executor — NLTV-EXAM-INGESTION R1 continuation — BLOCKED

- Scope: complete the remaining database/browser gates without modifying unrelated TV3-MULTILINGUAL work. No production or test source changes were made in this continuation.
- Backend focused command from `backend/`: `..\mvnw.cmd '-Dtest=Nltv*,ExamParserServiceTest,OfficialExamDatasetRegistryTest,ExamDatasetBundleV2Test,DefaultExamDatasetServiceTest,DefaultExamDatasetRunnerTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT' test` — **75 tests; 0 failures/errors; 3 skipped; BUILD SUCCESS**. The three skips were enabled/run separately below. Frontend focused command for six NLTV files — **42/42 PASS**.
- PostgreSQL: `NltvDatasetPostgresIT` on `official_exams_test` — **3/3 PASS** (draft/explicit publish/idempotency/catalog/conflict rollback). Post-test read-only check: 0 exams, 0 sections, 0 parts.
- Read-only app DB preflight at configured `localhost:5434/multilingodb`, PostgreSQL 16.15: `NLTV-SAMPLE-T1-V1`, ID **4**, already published; type `NLTV`, language `vi`, duration 180. All nine Parts have approved source SHA `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`; counts match `15/14/14/12/16/24/10/1/1`. At preflight there were 7 attempts and 31 answers. Existing `smoke.md` from 2026-10-21 records a different DB history through attempt #77/72 historical rows; preserve both records and reconcile the state. No seed/publish/unpublish or existing-attempt mutation was performed.
- Browser recheck: catalog, exam detail and start page rendered; start screenshots at 375/768/1366 px are in `output/playwright/NLTV-EXAM-INGESTION-20261023/`. Workspace Practice opened at 375 px with document width 375. UI created Practice attempt **88** and loaded its workspace. On reload, workspace/profile requests returned 502. Do not delete attempt 88; final DB status could not be verified.
- At `2026-10-23 16:50:23 +07`, Docker showed `multilingo-postgres` exited cleanly (0) and logs recorded an administrator shutdown; the existing backend/proxy stopped responding. Did not restart because the shutdown owner is unknown. Cleared local browser storage/cookies and closed the browser. No submission or AI grading call occurred in this partial smoke.
- Appended current recheck to `docs/testing/NLTV-EXAM-INGESTION-smoke.md`. `git diff --check` was run after these additions; see final status below.
- **BLOCKER:** reconcile the changed app DB attempt history, then have its owner restore PostgreSQL/backend. Re-read attempt 88 and complete Practice autosave/resume/submit/review and Mock/browser gates. Do not mark NLP-06/NLTV-09 or release PASS until then. Stop for review.

### Correction — test command path

Trong entry ngay trên, đường dẫn Maven được ghi nhầm thành `..\mvnw.cmd`. Lệnh thực tế đã chạy từ thư mục `backend/` là `./mvnw.cmd '-Dtest=Nltv*,ExamParserServiceTest,OfficialExamDatasetRegistryTest,ExamDatasetBundleV2Test,DefaultExamDatasetServiceTest,DefaultExamDatasetRunnerTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT' test` (PowerShell: ` .\mvnw.cmd ...`). Kết quả giữ nguyên: 75 tests, 0 failures/errors, 3 skipped, BUILD SUCCESS. `git diff --check` exit 0; chỉ có cảnh báo chuẩn hóa LF/CRLF.

## 2026-10-23 — Codex Executor — NLTV-EXAM-INGESTION R1 continuation after user authorization — IMPLEMENTED / STOP FOR REVIEW

- Người dùng xác nhận PostgreSQL bị tắt có chủ đích và yêu cầu tiếp tục. Container `multilingo-postgres` đã healthy trên cổng 5434; backend smoke tạm thời dùng schema `validate`, Flyway/seeder/scheduler/dispatcher/provider đều không chạy.
- Chỉ nối tiếp PostgreSQL/browser gates. Không sửa source/test, không seed/publish/unpublish, không sửa attempt cũ, không xóa dữ liệu. Published exam ID 4 vẫn là `NLTV-SAMPLE-T1-V1`, type `NLTV`, language `vi`, 180 phút; chín Part và checksum nguồn R1 giữ đúng. DB có 87 attempts trước lượt này; trong đó exam ID 4 có 7 attempts/31 answers. Hai attempt smoke mới được giữ nguyên; không xóa hay rollback.
- Practice attempt **88**: reload/resume khôi phục câu đã autosave (1 answer); submit và result/review tải được. Hai Writing jobs `UNAVAILABLE` do policy `MULTILINGUAL_GRADING_DISABLED`, 0 quota reservation, 0 lần thử/provider dispatch; không có điểm Writing. Attempt cuối `GRADING_FAILED` theo state resolver hiện hữu khi gặp UNAVAILABLE.
- Mock attempt **89**: đủ 55 câu Listening được autosave. Đồng hồ 180 phút khởi chạy; chuyển sang Reading hiện confirmation “không thể quay lại”, chấp nhận chuyển đã khóa section Listening ID 8; nút quay lại Listening bị disabled. Submit/result/review tải được. Attempt còn đúng hai Writing jobs unavailable, 0 quota reservation; status tổng hợp `GRADING_FAILED`. Attempt giữ `locked_sections=[8]`.
- Playback: trang review phát audio Part 1 trong browser smoke; `currentTime` tiến đến khoảng 8.15s, `readyState=4`, không có media error. Báo cáo smoke 2026-10-21 trước đó ghi nhận cả bốn audio Part 1–4 phát và xác minh thời lượng/mapping. Responsive evidence trước lượt này gồm start page ở 375/768/1366 px và Practice workspace 375 px không tràn ngang; Mock/review ở viewport 1280 px cũng không tràn.
- Kết quả focused hiện có: backend 75 tests, 0 failures/errors, 3 PostgreSQL skips (ba test được chạy riêng `NltvDatasetPostgresIT` và PASS 3/3 trên `official_exams_test`); frontend 6 files / 42 tests PASS. Không chạy lại vì source không đổi.
- Đối chiếu lịch sử: entry trước ghi “7 attempts/31 answers” là số riêng exam ID 4, còn smoke 2026-10-21 ghi 72 historical rows (IDs ≤72) và các smoke #73–77; phạm vi khác nhau, không có bằng chứng mâu thuẫn. Sau lượt này tổng DB là 89 attempts và exam ID 4 có 9 attempts. Không sửa/xóa lịch sử.
- Giới hạn: với hai essay để trống trong lượt smoke này, result summary hiển thị trạng thái tổng hợp `Chấm bài thất bại`/`Chấm Writing thất bại` và chưa có điểm; đây là mapping `UNAVAILABLE` hiện hữu, không phải lỗi gọi AI. Smoke 2026-10-21 với essay đã nhập ghi nhận UI “Chưa hỗ trợ chấm Writing tiếng Việt.” Không có provider call/quota reservation trong lượt này. Raw content/answer keys không được chép vào handoff.
- `git diff --check` chạy sau khi append; không commit/push. Dừng tại đây để review; không tuyên bố release PASS ngoài phạm vi evidence trên.
