# OFFICIAL-EXAMS — Handoff

## 2026-10-17 — Codex — IN_PROGRESS

**Mục tiêu:** Đưa Cambridge IELTS 20 Test 1 và ETS 2024 Test 1 thành bộ dữ liệu versioned, seed/publish có kiểm soát, dùng được qua luồng thi và xem kết quả.

**Baseline:** `9797bbb076ddbf1270bd8470018c965e4e534cfe`, branch `feature/TV3-00-contract-audit`; working tree sạch lúc bắt đầu. Đang dùng checkout hiện tại, không tạo commit hoặc push.

**Nguồn và checksum:** IELTS `1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1`; ETS completed `990f8aa1d8190302e469aa021c50ea30e3a65817b4db698c30d47463c08a7fde`; ETS supplemental `b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1`.

**Planning evidence đã có:** Đã kiểm tra workbook, mã nguồn và local PostgreSQL chỉ đọc ở lượt lập plan. Local DB chỉ có mini TOEIC; attempt 8 snapshot có tên IELTS Mock Test - Full, khác mô tả ETS. Không sửa/seed DB đó. Tài liệu UC hiện có chỉ mô tả UC001–UC006, không có Use Case nhập/publish đề; `docs/md/DATABASE_SPECIFICATION.md` xác nhận exams→sections→parts và attempts→attempt_answers, dữ liệu nội dung trong JSONB.

**Quyết định đã chốt:** versioned JSON + PostgreSQL; IELTS explanation được thiếu và hiển thị “Chưa có giải thích”; member 2 cập nhật bằng bundle version mới; cặp IELTS được chấm đúng từng ô, đảo thứ tự chấp nhận, không chấm trùng; seed và publish explicit opt-in.

**Task status:**

| Task | Kết quả | Trạng thái |
|---|---|---|
| OFFICIAL-01 | Source audit/provenance | IMPLEMENTED |
| OFFICIAL-02 | Excel parsers + canonical mapping | IMPLEMENTED |
| OFFICIAL-03 | Publication validators + bundles | IMPLEMENTED |
| OFFICIAL-04 | IELTS paired grading + Practice | IMPLEMENTED |
| OFFICIAL-05 | Admin builder/frontend/workspace | IMPLEMENTED |
| OFFICIAL-06 | Two dataset bundles + media audit | BLOCKED — source/media/rights approval evidence incomplete; no bundle emitted |
| OFFICIAL-07 | Opt-in seed/publish | IMPLEMENTED — opt-in only; runtime bundles absent |
| OFFICIAL-08 | Integration/regression/final evidence | PARTIAL — H2/frontend regression PASS; PostgreSQL and browser media checks not run |

**Review risks:** no answer-key-derived listening clues in student workspace; `44` handling only under source checksum; group 7/8 TOEIC passage boundary; IELTS Writing Task 1 image must be structured media for TV3-20; historical attempt snapshots stay immutable; paired grading must share submit/Practice evaluator; media/rights cannot be marked approved without evidence.

**Release blocker discovered during implementation:** Cambridge workbook cells `F42`, `F46`, `F51`, `F56`, `F69`, `F74`, and `F79` contain inserted non-source text (`thread: dongan.signs ...`) inside the Stress and Elms passages. Exact source checksum confirms it is present in the supplied workbook. Documented in `docs/datasets/official-exams-source-audit.md`; no text has been guessed or removed. Do not create/publish the official IELTS bundle until a clean workbook or verified correction is supplied. The parser implementation can proceed independently.

**Operational limit:** Implement seed/publish code and isolated tests only. Never run seed/publish against the developer PostgreSQL configured at localhost:5434. No actual public release in this implementation turn.

**Executor notes:** Follow tasks OFFICIAL-01→08 in order, test-first; append files, RED/GREEN and test evidence as tasks complete. Do not modify or delete old ETS plan/handoff history. No commit/push. Stop after implementation verification and report changed files, tests and any remaining human content/media approval.

## Implementation log — 2026-10-17

### OFFICIAL-01 — IMPLEMENTED

- Added source audit at `docs/datasets/official-exams-source-audit.md` and immutable test fixture copies of the two user workbooks under `backend/src/test/resources/datasets/official-source/`.
- Added `OfficialExamWorkbookAuditTest`: confirms all three checksums, workbook dimensions, 82 IELTS prompts/80 objective keys/2 essays, the five paired answer sets, blank explanations, TOEIC 200 prompt/key/explanation rows, answer-derived clue marker, missing Group 8 cells, and supplemental passage/options match.
- Verification: `.\mvnw.cmd '-Dtest=OfficialExamWorkbookAuditTest' test` → **4 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**.
- Test was corrected to read the supplemental workbook with `InputStream`. An initial `WorkbookFactory.create(File)` test read caused Apache POI to rewrite the tracked workbook on close; the original clean HEAD copy was restored immediately and its SHA-256 rechecked as `b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1`. The final test run uses only read-only streams and leaves it unchanged.
- Source findings: IELTS has 80 objective answer keys and two essays (not 82 answer keys); TOEIC completed source has 49 explicit group markers and clue-bearing F33:F99 blocks. The detailed cells/counts are in the audit document.
- No implementation code, database, or original workbook was changed. No commit/push.

### OFFICIAL-02 — IMPLEMENTED

- Added `IeltsExcelV2ExamParser` and source-hash-bound `OfficialExamSourceProfile`; `ExamParserService` now dispatches IELTS/TOEIC v2 workbooks by the metadata certificate type while retaining the legacy parser path.
- TOEIC correction applies only to the exact completed-source checksum: placeholder `44` cells are blanked at audited columns, the answer-key-derived clue block is removed, Part 2 gets only A–C, and the missing Group 8/passage for questions 165–167 is restored from the hash-audited supplemental workbook.
- IELTS mapping creates 9 canonical Parts, 80 objective items + 2 essays, stable IDs, correct Reading order, structured Writing media, answer-group metadata for the five two-slot questions, and accepts missing explanations. H-to-option-ID capacity is tested even though the checked workbook itself reaches seven nonempty options.
- Extended `ExamContentNormalizer` to clone/normalize IELTS builder requests and lift legacy `metadata.options`/keys without altering IELTS question-type or paired-answer semantics; TOEIC legacy normalization remains guarded to the TOEIC path.
- RED evidence: completed TOEIC source first failed because the prompt-number parser rejected `Question 135:`; IELTS normalizer test first failed because IELTS requests were returned without canonical projection. Corrected the delimiter and normalizer, then reran green.
- Verification: `.\mvnw.cmd '-Dtest=OfficialExamWorkbookAuditTest,ExamContentNormalizerTest,IeltsExcelV2ExamParserTest,ExcelV2ExamParserTest,ExamParserServiceTest' test` → **19 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**.
- Source gate: seven Cambridge cells (`F42`, `F46`, `F51`, `F56`, `F69`, `F74`, `F79`) contain unrelated inserted text inside Reading passages. Exact cell locations are locked in the audit test/document. No source text was altered or guessed; official IELTS release remains blocked pending a clean workbook or verified correction.
- No PostgreSQL writes, commits, or pushes.

### OFFICIAL-03 — IMPLEMENTED

- Added code-owned `OfficialExamDatasetRegistry` for the two stable keys/codes, source checksums, canonical section/Part counts and explanation status. Added IELTS-specific publication validation while preserving TOEIC validation and schema-v1 bundle compatibility.
- Added schema-v2 bundle export/validation with checksum, provenance, additional source metadata and `PARTIAL`/`COMPLETE` explanation state. Seed validation rejects missing approval references, unknown dataset versions, changed checksums, published requests and content outside the registered shape.
- `AdminExamServiceImpl` now normalizes and validates IELTS at the same create/update/publish boundaries as TOEIC, uses total section duration, and routes stable official codes through the registered exporter. Existing arbitrary exam codes keep the schema-v1 exporter.
- Actual Cambridge workbook test initially found its metadata title includes the editorial suffix “(Chưa giải thích)”, which did not match the registered canonical title. The exact-source profile now normalizes that known title only when the workbook checksum matches; this is documented in the source audit and asserted by the parser test. No passage content was changed.
- IELTS publication allows missing explanations, but rejects missing/invalid answer keys, passage/media, malformed paired-answer metadata, noncanonical `MULTIPLE_CHOICE`, invalid single-choice answer shape, and the known unverified inserted passage text. Added service-flow coverage proving the partial-explanation policy is enforced at persistence/publish boundary.
- RED/GREEN: the workbook-to-validator regression first failed on the editorial title mismatch; after checksum-bound title normalization it reported only the expected `SOURCE_CONTENT_UNVERIFIED` gate. Tightened answer/type validation with focused negative tests.
- Verification: `.\mvnw.cmd '-Dtest=OfficialExamDatasetRegistryTest,IeltsAcademicPublicationValidatorTest,ExamDatasetBundleV2Test,OfficialExamWorkbookAuditTest,ExamContentNormalizerTest,IeltsExcelV2ExamParserTest,ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,DefaultExamDatasetServiceTest' test` → **40 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**. SDD task 3 test log is recorded under the plan workspace.
- No DB writes, original workbook edits, commit, or push. Cambridge official publication remains blocked by the seven unverified source cells listed above.

### OFFICIAL-04 — IMPLEMENTED

- Preserved `answer_group` metadata through snapshot extraction, DB grading adapter and attempt grading input. Added deterministic paired-answer grading for the two `DISTINCT_UNORDERED` members: order does not matter, duplicate selections are not double-counted, blank/partial answers retain per-slot verdicts, and malformed/inconsistent group metadata is rejected.
- Practice feedback accepts an optional `groupAnswers` object for a paired question, requires exactly both member IDs and an anchor answer consistent with that object, verifies both questions are in the same part, and returns ordered `groupResults` with each member's current answer, verdict, score, correct answer and explanation. Independent-question behavior remains compatible; feedback is not persisted and `MOCK_TEST` remains blocked.
- Submit grading uses the same pair evaluator. Integration coverage verifies a paired Practice response does not mutate storage, Mock Test is forbidden, and submitting the two answers persists per-question `CORRECT` flags and awards two points. `AttemptReviewMapper` already consumes the per-question grading results/flags, so no review mapper change was needed.
- Added actual-workbook grading count regression: Cambridge has 80 objective slots and ETS has 200, using parser output → grading key extraction → objective grading. The Cambridge data issue remains a source-release blocker; this test does not approve that workbook for publication.
- RED/GREEN: focused tests were expanded for reversed ordering, partial credit, duplicate choices, blanks, invalid group membership/metadata, Practice scope/anchor validation, exact pair response and persisted submit flags. A first focused Practice run exposed an over-broad `SINGLE_CHOICE` requirement for independent questions; narrowed that guard to paired requests and reran green.
- Verification: `cd backend; .\\mvnw.cmd '-Dtest=IeltsAnswerGroupEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbGradingAdapterTest,AttemptGradingInputFactoryTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackEvaluatorTest,OfficialExamGradingCountTest,PairedPracticeFeedbackContractIT' test` → **171 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**. H2-backed integration tests used the isolated `test` profile; no developer PostgreSQL writes.
- No commit/push. Frontend integration can proceed independently of source-content release; the seven unverified Cambridge source cells block creation/publication of the IELTS official bundle, not the remaining implementation tasks.

### OFFICIAL-05 — IMPLEMENTED

- Official IELTS Academic and TOEIC L&R import paths now use backend `/import/preview`; other legacy certificate imports remain on their existing client path. Editing an existing official IELTS or TOEIC request uses the same canonical mapper.
- Added canonical ↔ editor mapping that preserves original Part number, section skill/duration, group/Part context, structured media, stable IDs, canonical option IDs, explanations and `answer_group`. Canonical option IDs/text and answer keys round-trip without emitting question `metadata.options`; paired answer keys remain arrays while the editor treats the paired slots as a shared answer set. TOEIC audio-only Part 2 retains A–C labels.
- Official save now rebuilds sections from canonical section metadata (with TOEIC/IELTS Part-number defaults for newly created official layouts) instead of guessing skill from audio presence. Writing essay type maps between editor `WRITING_ESSAY` and canonical `ESSAY`; IELTS stays `en` and draft state stays unpublished.
- `WorkspacePage` explicitly carries public `answer_group` metadata into the Practice hook. The hook sends the two current values in stable group order, validates and projects the two member responses to their respective question cards, invalidates both on either answer change, and includes both members in wrong-answer retry. Response normalization rejects missing/extra/mismatched pair values and disagreement between the top-level anchor and its group result. Independent Practice payloads remain unchanged.
- Missing explanation text is shown as “Chưa có giải thích” in review and Practice.
- RED/GREEN evidence: new mapping tests first failed because imported section metadata was dropped; pair API/hook tests first failed because group request/response was ignored; explanation tests first failed on the prior generic wording. After implementation, builder import/round-trip, strict pair contract, hook invalidation/retry, WorkspacePage integration and explanation UI tests passed.
- Verification: 10 focused files → **353 tests PASS**; `npm run build` PASS (existing large-bundle advisory); `npm run lint` exit 0 (repository has pre-existing warnings; no unrelated cleanup performed). No IELTS/TOEIC data was seeded or published.
- No commit/push.

### OFFICIAL-06 — BLOCKED

- Added `docs/datasets/official-exams-media-audit.md` and `OfficialExamDatasetTest`. Tests re-parse the supplied workbooks and verify the dataset shape, placeholder/clue gates, and rejection of a dataset without approval evidence.
- Evidence: `OfficialExamDatasetTest` → **2 tests PASS**. The audit records 8 audio URLs + 15 image references, all pending actual playback/render, MIME, CORS, part-assignment, and rights review. No external media requests were made.
- Cambridge remains blocked by the exact source cells `F42`, `F46`, `F51`, `F56`, `F69`, `F74`, `F79`, containing unrelated `thread: dongan.signs ...` text. No source text was altered or guessed.
- **No runtime bundle JSON was generated** and neither dataset has an approval reference. Therefore official seed/release cannot be completed yet. This is a content/source gate, not a parser-code failure.

### OFFICIAL-07 — IMPLEMENTED

- Added explicit `exam.default-dataset.publish-approved=false`; runner uses a fixed two-resource classpath allowlist. Dataset seed remains disabled by default. Identical content is skipped; mismatched content conflicts; all bundles validate before writes in one transaction.
- Publishing occurs only when the independent publish flag is explicitly enabled. The legacy dev mock seeder has a separate opt-in and is disabled whenever official seed is enabled.
- Added isolated tests for runner paths/flags, mock-seeder gating, first seed/re-run/conflict/rollback/concurrent-code behavior, and explicit publish of an identical draft.
- Verification: Task7 test run → **15 tests PASS**, no failures/errors/skips. H2 only. No developer PostgreSQL writes; no official bundle exists to seed.

### OFFICIAL-08 — PARTIAL VERIFICATION

- Added `OfficialExamsContractIT`: parses the actual completed ETS source into a test-only bundle, exercises isolated seed → published library → Part 5 attempt/workspace → submit/result/review, proves workspace solution/clue sanitization, 30/30 score, publish gate after unpublish, and historical answer/explanation snapshot stability. Test-only bundle uses no runtime resource and no approval claim.
- Added `OfficialCatalogPostgresIT`, gated to the exact dedicated database `official_exams_test` via `OFFICIAL_EXAM_POSTGRES_TEST_URL`; the task run skipped it because that variable was not configured. It was not pointed at the developer DB.
- Added frontend `OfficialExamWorkspaceContract.test.tsx` for canonical paired-answer-group → editor mapping → Practice request with both current slot values.
- Backend focused plan selection: **72 tests, 0 failures, 0 errors, 1 skipped** (`OfficialCatalogPostgresIT`). Frontend focused official contract: **1 test PASS**; broader feature focused selection: **6 files / 22 tests PASS**; full frontend suite: **79 files / 1,427 tests PASS**.
- `npm run build`: PASS after adding explicit fixture typing to the new test; existing large-bundle advisory remains. `npm run lint`: exit 0, **49 warnings** reported; new contract test has no lint warning and reported warnings in touched existing components are on unchanged lines. Browser checks for media/mobile were not performed because no approved media/content release is available.
- No commit/push. The implementation is not a release: no runtime bundles were emitted, no data was loaded into PostgreSQL, and Cambridge remains blocked.

### Final status — PARTIAL / RELEASE BLOCKED

Code tasks OFFICIAL-01–05 and OFFICIAL-07 are implemented; their focused tests pass. OFFICIAL-06 is blocked on authoritative Cambridge corrections and real media/content/rights approvals. OFFICIAL-08 has H2 and frontend evidence but lacks dedicated PostgreSQL/browser-media evidence. The two exams have **not** been established as official system datasets. Required next inputs are a clean/verified Cambridge source and documented media/content/rights approvals; then generate both versioned bundles, run the gated PostgreSQL/browser checks, and request final review. No database write, commit, or push occurred.

## Codex review fixes — 2026-10-17

**Trạng thái:** `FIXED — chờ Codex re-review`; không có release approval.

### Findings đã xác nhận và sửa

| Mức | Phát hiện | Sửa tối thiểu |
|---|---|---|
| P1 | Practice nhận `groupAnswers` đúng nhưng response backend cũng phát `groupAnswers`, trong khi frontend contract đòi `groupResults`; mọi feedback câu ghép bị từ chối khi normalize. | Đổi field response/Builder sang `groupResults`; request vẫn giữ `groupAnswers`. Cập nhật unit + controller contract assertions. |
| P1 | Publication validator áp dụng profile Cambridge 9 Part/82 câu cho mọi `IELTS_ACADEMIC`, chặn đề IELTS thông thường. | Validator chung chỉ quản lý TOEIC như trước; Cambridge structure/publish gate chỉ chạy với code đăng ký `IELTS-CAMBRIDGE-20-T1-V1`. Bundle v2 gọi validator theo registry dataset key. |
| P2 | Preview Cambridge có thể báo publishable dù source chứa ghi chú chưa xác minh; không chỉ rõ vị trí. | Với đúng checksum Cambridge đã audit, parser phát issue cho từng ô marker thực tế; preview chạy validator Cambridge cho đúng source profile. Regression cố định bảy vị trí `Exam Template!F42/F46/F51/F56/F69/F74/F79`. Không sửa nội dung nguồn. |
| P2 | Bundle shape không kiểm tra tổng group count và ranh giới Part 7 Group 7/8; question count đúng vẫn có thể che việc gán sai câu 165–167. | Kiểm tra group count theo registry và khóa q164 vào Group 7, q165–167 vào Group 8 có passage. Thêm tests đổi ranh giới và thêm group nhưng giữ nguyên số câu/checksum mới. |

### RED/GREEN và verification

- RED Practice response: `PairedPracticeFeedbackContractIT#practiceReturnsBothPairedSlotsWithoutPersistingAndMockTestRemainsBlocked` xác nhận trước sửa JSON có `groupAnswers`, thiếu `groupResults`.
- RED validator scope: `IeltsAcademicPublicationValidatorTest#ordinaryIeltsAcademicExamDoesNotUseTheCambridgeOfficialDatasetProfile` xác nhận trước sửa đề IELTS thông thường bị chặn bởi Cambridge profile.
- RED bundle shape: `ExamDatasetBundleV2Test` trước sửa có 2 regression thất bại, cho phép đổi ranh giới q165 và tăng group count mà vẫn validate.
- GREEN focused backend theo command OFFICIAL-08 trong plan: **73 tests, 0 failures, 0 errors, 1 skipped**; skip là `OfficialCatalogPostgresIT` vì `OFFICIAL_EXAM_POSTGRES_TEST_URL` chưa cấu hình. `BUILD SUCCESS`.
- GREEN frontend regression: `npm test -- src/features/exams/__tests__ src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx` → **6 files / 22 tests PASS**.
- `git diff --check` → exit 0; chỉ báo line-ending notices cho `ExamDatasetBundle.java` và test mapping frontend.
- Không chạy PostgreSQL developer DB; không chạy full suite trong lượt sửa review này. Full frontend suite/build/lint evidence ở mục OFFICIAL-08 là từ lần verify implementation trước đó; frontend production code không đổi trong sửa review này.

**Re-review scope:** kiểm tra lại bốn findings trên và integration Practice/publish/preview/bundle. **Final review chưa chạy sau các fix.** Giữ trạng thái tổng thể `PARTIAL / RELEASE BLOCKED`: OFFICIAL-06 vẫn chờ Cambridge correction và media/content/rights approval; OFFICIAL-08 vẫn thiếu dedicated PostgreSQL/browser-media evidence. Không phát sinh runtime bundles, DB writes, commit hoặc push.

### Follow-up P2 fixes — 2026-10-17

Reviewer re-check xác nhận bốn findings trước đã kín, đồng thời nêu hai P2 liền kề; cả hai đã được xác nhận bằng test đỏ rồi sửa:

- **P2 — Phân bố group IELTS:** `IeltsAcademicPublicationValidator` nay kiểm tra đúng số nhóm cho từng Part từ registry (`GROUP_COUNTS`), không chỉ tổng 19; sai số nhóm bị xem là lỗi cấu trúc. Test giữ nguyên 19 nhóm toàn cục và số câu/Part nhưng chuyển phân bố P1/P2; RED trước sửa, GREEN sau sửa.
- **P2 — Identity mã ETS:** create/update draft và publish qua admin nay buộc `examCode` đã đăng ký khớp type/title/language trong registry. Test dùng mã `TOEIC-ETS-2024-T1-V2` với type IELTS; RED trước sửa, GREEN cho cả create và status publish sau sửa.

Verification cập nhật sau hai fix:

- `ExamPublicationFlowTest#registeredToeicCodeCannotBeSavedOrPublishedWithAnIeltsIdentity` và `IeltsAcademicPublicationValidatorTest#enforcesRegisteredGroupCountPerPartEvenWhenGlobalCountIsUnchanged` → **2 tests PASS**.
- Backend focused plan selection → **74 tests, 0 failures, 0 errors, 1 skipped**, `BUILD SUCCESS`; skipped là dedicated PostgreSQL test do thiếu `OFFICIAL_EXAM_POSTGRES_TEST_URL`.
- Frontend focused official regression đã chạy sau bốn fix đầu → **6 files / 22 tests PASS**; không có frontend code thay đổi trong follow-up P2.
- `git diff --check` sau cập nhật handoff exit 0; chỉ có line-ending notices hiện hữu cho `ExamDatasetBundle.java` và test mapping frontend.

**Review state:** chờ reviewer xác nhận cả sáu findings đã xử lý. Trạng thái phát hành vẫn `PARTIAL / RELEASE BLOCKED` như trên; không tạo bundles hoặc ghi database.

### Follow-up P1 fix — Registered ETS publish shape — 2026-10-17

Re-review xác định thêm một P1: admin có thể publish bằng mã ETS đã đăng ký khi request thiếu câu, vì publication path mới kiểm tra validator TOEIC tổng quát chứ chưa áp dụng shape chính xác của dataset.

- Thêm `ExamDatasetBundle.requireRegisteredShape(...)`; admin publish và official bundle export cùng dùng registry shape gate trước khi chấp nhận dữ liệu.
- Thêm `ExamPublicationFlowTest#registeredToeicCodeCannotPublishARequestMissingAQuestion`, loại `q_200` khỏi request mang mã ETS ổn định và xác nhận không có ghi dữ liệu.
- RED trước sửa: test thất bại vì không ném lỗi khi publish request thiếu câu. GREEN sau sửa: test đơn lẻ **1 PASS**.
- Backend focused plan selection chạy lại sau fix: **75 tests, 0 failures, 0 errors, 1 skipped**, `BUILD SUCCESS`; skip là `OfficialCatalogPostgresIT` do chưa cấu hình `OFFICIAL_EXAM_POSTGRES_TEST_URL`.
- Chưa re-review P1 mới nhất tại thời điểm ghi mục này. Giữ trạng thái `PARTIAL / RELEASE BLOCKED`; không tạo bundle runtime, ghi database, commit hoặc push.

### Final Codex re-review — 2026-10-17

**Kết luận review code:** `PASS`; reviewer xác nhận không còn P0/P1/P2 trong phạm vi các fix. Verdict bao gồm Practice response field, publication validator scope, preview source-cell issues, bundle shape/Group 7–8, Cambridge per-Part group mapping, identity mã ETS, và regression test publish thiếu `q_200`.

- Regression test TOEIC dùng workbook completed thật; baseline vượt qua `requireRegisteredShape`. Sau khi chỉ bỏ `q_200`, validator publish chung vẫn chấp nhận nhưng registered shape gate và admin publish từ chối; repository không ghi exam.
- Group counts IELTS đã được đổi sang thứ tự canonical: nguồn Part 5/6/7 (Reading Passage 3/1/2) được sắp thành canonical Part 7/5/6; phân bố canonical đúng là `1/3/4/1/2/3/3/1/1`. Source audit ghi cả phân bố gốc và canonical.
- Focused validator/bundle tests sau mapping: **14 tests PASS**. Backend focused plan selection sau mọi fix: **75 tests, 0 failures, 0 errors, 1 skipped**; skip là dedicated `OfficialCatalogPostgresIT` vì chưa cấu hình `OFFICIAL_EXAM_POSTGRES_TEST_URL`.
- Regression riêng cho missing `q_200`: **1 test PASS**. Frontend official feature focused: **6 files / 22 tests PASS** (frontend production code không đổi trong các fix review cuối). Trước đó full frontend: **79 files / 1,427 tests PASS**; lint exit 0 với 49 warnings; build PASS.
- `git diff --check` exit 0; còn cảnh báo line-ending CRLF hiện hữu. Không có PostgreSQL developer DB write, runtime bundle, commit hoặc push.

**Trạng thái cuối:** phần implementation trong phạm vi review `PASS`; phát hành hai đề vẫn `PARTIAL / RELEASE BLOCKED` do Cambridge có text chưa xác minh tại bảy ô đã ghi trong source audit và media/content/rights chưa được duyệt. Khi có workbook Cambridge sạch hoặc xác nhận nội dung chính xác cho các ô đó, có thể tiếp tục bước hoàn thiện bundle; hiện không cần sửa workbook.

### User-verified Cambridge Elms passage correction — 2026-10-17

Chủ dự án cung cấp nguyên văn passage “Bring elms to Britain”. Đã đối chiếu nội dung attachment với resource sau khi chuẩn hóa xuống dòng/khoảng trắng: nội dung khớp. Attachment SHA-256 là `B412F154A891A868E4E88C7CCEA6C1398DA620F225A68253E734F21189821512`; resource `backend/src/main/resources/datasets/source-corrections/cambridge-ielts-20-test-1/elms-to-britain.txt` có SHA-256 `83F8882FF7153D564E3B1F56A3623734C13D5D52E9AFDECF492BFDB020FB4C57` do cách trình bày khoảng trắng khác.

- Bổ sung correction vào canonical Reading Passage 2 / Part 6, chỉ khi workbook khớp chính xác checksum Cambridge đã audit; workbook gốc không bị sửa.
- Parser preview không còn báo F69, F74, F79 là nội dung chưa xác minh sau khi correction được áp dụng. Test checksum khác xác nhận marker nguồn còn nguyên và correction không bị áp dụng nhầm.
- RED/GREEN: assertion mới ban đầu thất bại vì passage canonical còn `dongan.signs`; sau correction, parser kiểm tra đầy đủ tiêu đề và các đoạn A–G từ user source. Sửa assertion test checksum khác để kiểm tra marker hỏng thay vì cấm tiêu đề vốn có trong workbook.
- `IeltsExcelV2ExamParserTest`: **6 tests PASS**. Backend focused official-exams regression command trong plan: **76 tests, 0 failures, 0 errors, 1 skipped**, `BUILD SUCCESS`; skip là `OfficialCatalogPostgresIT` vì chưa cấu hình `OFFICIAL_EXAM_POSTGRES_TEST_URL`.

**Trạng thái phát hành hiện tại:** vẫn `PARTIAL / RELEASE BLOCKED`. Các ô `F42`, `F46`, `F51` (Stress) và `F56` (Kākāpō) chưa có nội dung gốc được xác minh; kiểm tra media/content/rights cũng chưa hoàn tất. Không tạo bundle runtime, không ghi database, không commit/push. Cần tiếp tục xác minh bốn ô còn lại trước khi tạo bundle IELTS và xin final review.

## 2026-10-17 — Codex Reviewer — Full-feature re-review

- **Agent:** Codex Reviewer
- **Scope:** Toàn bộ OFFICIAL-01–08, source audit và media audit; đối chiếu plan, toàn bộ tracked diff so với HEAD `9797bbb`, cùng production code/tests/resources/docs chưa được track. Staged diff rỗng; 47 tracked files thay đổi. Không giới hạn review ở correction Elms hoặc các findings cũ.
- **Decision: NEED_FIX.** Xác nhận hai P1 và hai P2 bên dưới. Các test hiện có đều xanh nhưng chưa bao phủ các counterexample đã tái hiện. Chưa thể nghiệm thu toàn feature hoặc phát hành hai dataset; các gate nội dung/media/bundle/PostgreSQL vẫn chưa hoàn tất.

### IN-SCOPE — confirmed findings

**OFFICIAL-RR-F1 — P1: Registry shape gate ETS v2 chỉ đếm câu, không khóa canonical question IDs.**

- **Location:** `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/ExamDatasetBundle.java:176–179`, trong `validateRegisteredShape`; admin publish cũng gọi gate này qua `AdminExamServiceImpl.requirePublishable`.
- **Scenario/evidence:** Parse workbook ETS completed thật, chỉ đổi `q_200` thành `noncanonical_replacement` trong RAM, giữ nguyên số Part/group/câu. `exportOfficial(..., ets-2024-test-1, TEST-ONLY)` và `bundle.validate()` vẫn chấp nhận. Validator TOEIC chung chỉ kiểm tra ID không trùng/rỗng; boundary gate chỉ khóa q164–167. Vì vậy mã ETS chính thức có thể publish/export khi không còn đủ identity `q_001…q_200` theo plan. Schema v1 vốn kiểm tra chuỗi ID canonical trong `requireLegacyComplete`.
- **Minimal fix:** Kiểm tra ID theo thứ tự canonical trong từng Part của registered ETS v2, cùng với counts hiện có; áp dụng chung tại export/validate/admin publish.
- **Regression:** Baseline workbook thật phải pass; rename `q_200` hoặc hoán đổi ID qua Part mà vẫn giữ counts/checksum mới phải bị từ chối tại bundle và admin publish, trước repository write.

**OFFICIAL-RR-F2 — P1: Import mới làm mất checksum cần cho legacy bundle export.**

- **Location:** `backend/src/main/java/com/multilingo/backend/modules/exam/service/ExcelV2ExamParser.java:66–68` đã bỏ lưu `import_source_sha256`, trong khi `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/ExamDatasetBundle.java:49–52` vẫn đọc field đó để tạo `source.sha256` cho schema v1.
- **Scenario/evidence:** Parse ETS completed thật rồi gọi `exportForCode(request, TOEIC-RANDOM)` như luồng exam mang mã admin không đăng ký: bundle v1 trả `source.sha256=null`. Tạo bản copy chỉ bổ sung approval reference vẫn bị `validateLegacy()` từ chối. Đây là regression của luồng import → legacy export → approve → seed, không phải lỗi source/media approval đang thiếu.
- **Minimal fix:** Bảo toàn checksum import để exporter v1 đọc được, hoặc truyền provenance tương ứng vào exporter; không điền checksum của registry cho một source khác.
- **Regression:** Import workbook qua API/parser, export exam có code không đăng ký, xác nhận source hash đúng SHA-256 upload; sau bổ sung approval, bundle vẫn round-trip/validate được.

**OFFICIAL-RR-F3 — P2: Ô thứ hai của cặp câu bị treo checking khi request feedback thất bại.**

- **Location:** `frontend/src/features/exam/hooks/usePracticeFeedback.ts:478–481` đặt cả hai member thành `checking`, nhưng các nhánh lỗi tại `666–714` chỉ cập nhật `[questionId]` của anchor.
- **Scenario/evidence:** Chạy hook production với React Testing Library/Redux/JSDOM, chỉ thay API bằng rejected promise lỗi mạng. Sau `check(l_017)` hoàn tất: `busy=false`, l_017 là `error`, l_018 vẫn `checking` với data/error null. UI của l_018 tiếp tục spinner và nút disabled cho tới khi retry anchor hoặc sửa đáp án. Timeout/contract error đi qua cùng kiểu cập nhật thiếu member.
- **Minimal fix:** Kết thúc trạng thái request cho toàn bộ `questionIds` trong các nhánh lỗi, giữ thông điệp/retry policy tương ứng.
- **Regression:** Reject request cặp bằng network/timeout/contract error; sau settle không member nào còn `checking`, và retry thành công cập nhật cả hai.

**OFFICIAL-RR-F4 — P2: Media audit chưa cập nhật trạng thái correction Elms.**

- **Location:** `docs/datasets/official-exams-media-audit.md:23` vẫn liệt kê F69/F74/F79 là nội dung chưa xác minh cần sửa, trái với source audit và entry correction mới nhất.
- **Minimal fix:** Phân biệt bảy marker còn trong workbook gốc với bốn ô canonical còn BLOCKED (`F42/F46/F51/F56`); dẫn chiếu correction Elms đã xác minh. Giữ nguyên gate media/rights đang thiếu, không đánh dấu release approved.

### Acceptance criteria và giới hạn toàn feature

| AC | Kết quả review |
|---|---|
| AC-01 | Chưa hoàn tất: không có hai runtime JSON bundles, chưa tái tạo official datasets trong PostgreSQL riêng; F2 còn phá legacy export portability. |
| AC-02 | Đã xác minh parser/count grading: ETS 200; IELTS 82 gồm 80 objective + 2 ESSAY. Không đồng nghĩa dữ liệu đã được phát hành. |
| AC-03 | Canonical types/options/media/pair metadata có regression; registered ETS identity gate còn F1. |
| AC-04 | Evaluator chung cho submit/Practice, đảo thứ tự/duplicate/blank và persisted flags có tests; frontend error lifecycle còn F3. |
| AC-05 | Focused workspace/Practice/review tests đi qua production code, kiểm tra solution/clue sanitization và chặn MOCK_TEST; không xác nhận P0/data exposure mới. |
| AC-06 | IELTS missing explanation policy và nhãn “Chưa có giải thích” có backend/frontend evidence. |
| AC-07 | Boundary q164–167 và canonical Reading order có regression. Correction Elms chỉ áp dụng với workbook hash đã audit, toàn Part 6 không còn marker; F42/F46/F51/F56 và kiểm tra media/content/rights vẫn chưa giải quyết. |
| AC-08 | H2 tests xác minh seed opt-in, explicit publish, idempotency/conflict/rollback/concurrent unique-code race. Dedicated PostgreSQL test vẫn skip; chưa có evidence trên PostgreSQL. |
| AC-09 | Builder import/canonical mapping và Workspace paired payload tests PASS; không thay thế browser/media/mobile verification. |
| AC-10 | Integration tests xác minh grading/review giữ snapshot lịch sử khi current exam bị sửa/unpublish. |

Thiếu runtime bundles, media approval, dedicated PostgreSQL/browser-media evidence và Writing Task 1 → grader-mock integration evidence vẫn là phần chưa hoàn tất trong scope plan, không được chuyển thành out-of-scope hoặc coi là đã PASS.

### Verification — reviewer-run, output mới

1. Backend focused command trong plan (thêm `-q`):
   `./mvnw.cmd '-Dtest=OfficialExam*,OfficialExamsContractIT,OfficialCatalogPostgresIT,IeltsExcelV2ExamParserTest,IeltsAnswerGroupEvaluatorTest,PairedPracticeFeedbackContractIT,ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,DefaultExamDatasetServiceTest,ExamDatasetIntegrationTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT' test -q`
   → exit 0; Surefire reports **76 tests, 0 failures/errors, 1 skipped**. Skip duy nhất: `OfficialCatalogPostgresIT` do chưa bật dedicated DB environment gate; các integration khác chạy H2/test profile.
2. Backend bổ sung các suite trực tiếp bị thay đổi nhưng không có trong selection trên:
   `./mvnw.cmd '-Dtest=IeltsAcademicPublicationValidatorTest,ExamDatasetBundleV2Test,ExamContentNormalizerTest,DefaultExamDatasetRunnerTest,MockDataSeederConditionTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbGradingAdapterTest,AttemptGradingInputFactoryTest' test -q`
   → exit 0; **183 tests, 0 failures/errors/skips**. Tổng hai lượt: **258 PASS, 1 SKIP**.
3. Frontend:
   `npx vitest run src/features/exams/__tests__ src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx src/features/exam/__tests__/usePracticeFeedback.test.tsx src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/PracticeFeedbackUI.test.tsx src/features/exam/components/review/__tests__/ExplanationBox.test.tsx --reporter=dot`
   → exit 0; **12 files / 357 tests PASS**.
4. Read-only in-memory probes: JShell với production parser/bundle classes tái hiện F1/F2; Node + TypeScript transpile/React Testing Library/Redux/JSDOM với production hook tái hiện F3. Không thêm/sửa test files hoặc production files. Đây là counterexamples ngoài coverage hiện có, không phải các tests đỏ đã được commit.
5. `Get-FileHash`: hai workbook test fixtures khớp SHA-256 trong source audit; correction Elms resource khớp `83f8882ff7153d564e3b1f56a3623734c13d5d52e9afdecf492bfdb020fb4c57`. JShell kiểm tra toàn contentData Part 6 sau parse không còn `dongan.signs`. Việc đối chiếu attachment gốc với correction vẫn là executor/user-reported evidence trong entry trước, không phải lần đối chiếu attachment mới của reviewer.
6. `git diff --check` exit 0; chỉ có line-ending notices hiện hữu. Không chạy full backend/frontend, build/lint hoặc browser media trong lượt review này. Full frontend 1.427 tests/build/lint ở các entry trước là evidence cũ của executor, không phải output mới.

### OUT-OF-SCOPE và next action

- Không mở rộng audit hoặc xác nhận defect ngoài feature. Không đưa các lỗi TV3 cũ không liên quan thành blocker.
- Sửa F1/F2 và thêm focused regression; xử lý F3/F4. Sau đó re-review code. Hoàn tất nguồn Cambridge còn bốn ô, phê duyệt media/content/rights, tạo hai bundle, chạy dedicated PostgreSQL và browser/IELTS Writing integration trước nghiệm thu full feature.
- Lượt này chỉ append handoff; không sửa production/tests/approved plan, không seed/publish trên DB developer, không sửa workbook, không commit/push.


## 2026-10-17 — Codex Fixer — OFFICIAL-RR-F1–F4 re-FIX

**Trạng thái: FIXED / READY FOR RE-REVIEW cho bốn findings đã xác nhận.** Chưa phải nghiệm thu hoặc phê duyệt phát hành toàn feature.

### Findings, nguyên nhân và sửa đổi

| Finding | Sửa và regression |
|---|---|
| **F1 — P1, ETS v2 canonical IDs** | `ExamDatasetBundle` bổ sung kiểm tra tuần tự đầy đủ `q_001`–`q_200` qua các Part canonical, dùng chung tại export/validate/admin publish cùng registered shape gate hiện có. Test parse workbook ETS completed thật: baseline pass; đổi `q_200`, hoán đổi ID qua Part hoặc trong cùng Part vẫn giữ counts và tính lại checksum đều bị từ chối. Admin published-create chặn rename/cross-Part swap trước mọi repository write. |
| **F2 — P1, legacy source checksum** | `ExcelV2ExamParser` bảo toàn `import_source_sha256` từ SHA-256 upload do parser service tính, để exporter schema v1 đọc được; không thay bằng checksum registry. Test dùng cả workbook ETS thật và workbook synthetic hợp lệ khác checksum: import qua production parser → `exportForCode(..., TOEIC-RANDOM)` → đối chiếu hash byte upload → thêm approval trong test → JSON round-trip → validate thành công. |
| **F3 — P2, paired feedback error lifecycle** | Các nhánh lỗi trước đây chỉ cập nhật anchor dù cả hai member đã vào `checking`. Hook nay kết thúc trạng thái cho toàn bộ `questionIds` ở cả sáu nhánh lỗi, giữ nguyên thông điệp và retry/block policy. Chín regression: network, timeout, contract và HTTP 400/401/403/404/409/422; kiểm tra cả hai đang checking trước reject, cả hai hết checking/busy sau settle; retry từ member thứ hai cập nhật cả cặp, các lỗi bị block không gửi thêm request. |
| **F4 — P2, media audit Elms** | Media audit nay phân biệt bảy marker trong workbook gốc với bốn ô canonical còn BLOCKED (`F42/F46/F51/F56`), ghi nhận correction Elms `F69/F74/F79` chỉ áp dụng với workbook hash đúng profile và dẫn source audit. Source audit hiện đã ghi đúng correction nên được giữ nguyên. Không thay đổi approval media/rights. |

**Files thay đổi trong lượt fix:**

- `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/ExamDatasetBundle.java`
- `backend/src/main/java/com/multilingo/backend/modules/exam/service/ExcelV2ExamParser.java`
- `backend/src/test/java/com/multilingo/backend/modules/exam/service/ExamDatasetBundleV2Test.java`
- `backend/src/test/java/com/multilingo/backend/modules/exam/service/ExamPublicationFlowTest.java`
- `frontend/src/features/exam/hooks/usePracticeFeedback.ts`
- `frontend/src/features/exam/__tests__/usePracticeFeedback.test.tsx`
- `docs/datasets/official-exams-media-audit.md`
- `docs/superpowers/plans/ndt/OFFICIAL-EXAMS-handoff.md` (append only)

### RED/GREEN — output mới của fixer

- **F1 RED:** ba ca bundle và hai ca admin thất bại với `Expecting code to raise a throwable`; canonical IDs sai vẫn được chấp nhận trước sửa.
- **F2 RED:** `ExamDatasetBundleV2Test#legacyExportPreservesUploadedChecksumAndValidatesAfterApproval` → **2 failures, 0 errors**, cả hai source hash nhận `null` thay vì SHA-256 upload. Case nguồn khác dùng workbook synthetic hợp lệ, không sửa workbook nguồn.
- **F3 RED:** `npm test -- src/features/exam/__tests__/usePracticeFeedback.test.tsx` → **9 failed / 43 passed**; member thứ hai còn checking hoặc bị xóa về idle ở nhánh auth. Sau sửa: **52/52 PASS**.
- **Backend GREEN mục tiêu:** `.\mvnw.cmd '-Dtest=ExamDatasetBundleV2Test,ExamPublicationFlowTest' test` → **22 tests, 0 failures/errors/skips**, `BUILD SUCCESS`.
- Tổng cộng thêm **16 regression cases**: 7 backend và 9 frontend; production parser/bundle/admin service/hook thật, chỉ mock repository/HTTP boundary phù hợp.

### Regression và verification — output mới của fixer

Backend gộp selection focused trong plan và selection bổ sung của reviewer (không chạy `GenerateTemplateTest`):

```powershell
.\mvnw.cmd '-Dtest=OfficialExam*,OfficialExamsContractIT,OfficialCatalogPostgresIT,IeltsExcelV2ExamParserTest,IeltsAnswerGroupEvaluatorTest,PairedPracticeFeedbackContractIT,ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,DefaultExamDatasetServiceTest,ExamDatasetIntegrationTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT,IeltsAcademicPublicationValidatorTest,ExamDatasetBundleV2Test,ExamContentNormalizerTest,DefaultExamDatasetRunnerTest,MockDataSeederConditionTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbGradingAdapterTest,AttemptGradingInputFactoryTest' test
```

→ **266 tests: 265 PASS, 1 SKIP, 0 failures/errors; BUILD SUCCESS**. Skip là `OfficialCatalogPostgresIT` do environment gate `OFFICIAL_EXAM_POSTGRES_TEST_URL` chưa bật; các integration khác dùng test profile/H2.

Frontend:

- `npm test -- src/features/exam/__tests__/usePracticeFeedback.test.tsx` → **1 file / 52 tests PASS**.
- `npm test` → **79 files / 1.436 tests PASS**, exit 0. Còn cảnh báo jsdom `HTMLMediaElement.pause()`.
- `npm run lint` → exit 0, **49 warnings** ngoài hai file frontend sửa trong lượt này.
- `npm run build` → exit 0 (TypeScript + Vite); còn cảnh báo chunk lớn hơn 500 kB.
- `git diff --check` → exit 0; chỉ có notices LF/CRLF hiện hữu. So sánh SHA-256 với manifest trước sửa xác nhận chỉ tám file liệt kê trên thay đổi; giữ nguyên source audit, workbook nguồn/test fixtures, correction resource, approved plan và các thay đổi có sẵn khác. Handoff giữ nguyên toàn bộ nội dung cũ và chỉ append.

**Giới hạn và bước tiếp:** full backend suite, dedicated PostgreSQL, browser/media/mobile và Writing Task 1 → grader-mock integration chưa chạy trong lượt fix này. Nội dung Cambridge còn `F42/F46/F51/F56`, media/content/rights approval, hai runtime bundles và evidence nghiệm thu còn thiếu như reviewer đã ghi; giữ **PARTIAL / RELEASE BLOCKED**, không chuyển các phần này ra ngoài scope plan hoặc coi là PASS. Không seed/publish trên DB developer, không sửa workbook, không commit/push. **Dừng chờ re-review F1–F4.**

## 2026-10-17 — Codex Reviewer — Full-feature re-review sau re-FIX F1–F4

- **Agent:** Codex Reviewer
- **Scope:** Toàn feature OFFICIAL-01–08 theo approved plan; source/media audit, staged/unstaged changes và untracked production code/tests/resources/docs. Baseline vẫn là HEAD `9797bbb`; staged diff rỗng, 47 tracked files có thay đổi. Đối chiếu lại luồng parser/normalizer → publication/bundle/seed → grading/Practice → builder/workspace và historical snapshot, cùng các thay đổi mới sau review trước.
- **Decision: BLOCKED — toàn feature.** Bốn findings code/documentation trước đã được đóng; không xác nhận P0/P1/P2 mới hoặc còn mở trong phần implementation đã review. Tuy nhiên AC-01, AC-07 và evidence nghiệm thu OFFICIAL-06/OFFICIAL-08 vẫn thiếu, nên chưa thể kết luận toàn feature đạt nghiệm thu.

### Findings cũ — xác nhận đã đóng

| Finding | Kết quả re-review |
|---|---|
| **F1 — P1** | `ExamDatasetBundle.java:185–187,198–214`: registered ETS shape gate gọi `validateToeicQuestionIds`, kiểm tra tuần tự đủ q_001–q_200. Regression dùng workbook thật và giữ counts/checksum mới xác minh rename, cross-Part swap và within-Part swap bị từ chối tại export/validate; admin published-create bị chặn trước repository write. |
| **F2 — P1** | `ExcelV2ExamParser.java:67`: lưu lại SHA-256 upload vào provenance mà exporter v1 đang đọc. Regression đi qua parser service thật với workbook ETS và workbook synthetic khác checksum; xác nhận hash upload, bổ sung approval trong test rồi JSON round-trip/validate thành công. Không lấy checksum registry thay cho checksum upload. |
| **F3 — P2** | `usePracticeFeedback.ts:586–589` và các nhánh catch: `failedMembers` kết thúc trạng thái cho toàn bộ questionIds, giữ retry/block policy. Chín regression network/timeout/contract/HTTP kiểm tra cả hai member trước và sau reject, busy reset, retry từ member thứ hai hoặc bị chặn theo policy. |
| **F4 — P2** | `official-exams-media-audit.md:23–24`: phân biệt đúng bảy marker còn trong workbook gốc với bốn ô canonical chưa xác minh, dẫn correction Elms và giữ nguyên gate media/rights. Source audit và handoff hiện thống nhất. |

Các test mới thực sự gọi production parser/bundle/admin service/hook; mocks giới hạn ở repository hoặc API boundary phù hợp với từng test. Không chỉ kiểm tra fixture hoặc test name.

### Acceptance criteria — toàn feature

- **AC-02–06:** Parser/grading counts 200 và 82 (80 objective + 2 ESSAY), canonical types/options/IDs, paired grading không tính trùng, Practice response và published-only/access gates liên quan, workspace không lộ solution/clue, missing-explanation policy có regression. F1/F2/F3 không còn là blocker code.
- **AC-09–10:** Builder/canonical round-trip, payload cặp hiện tại, invalidation/retry và snapshot grading/review sau edit/unpublish có evidence production-path từ các suite liên quan; không thấy scope expansion mới trong lượt fix.
- **AC-01 — chưa hoàn tất:** Vẫn không có `datasets/exams/cambridge-ielts-20-test-1.v1.json` hoặc `ets-2024-test-1.v2.json` trong runtime resources. Chưa chứng minh hai official bundles tái tạo database như mục tiêu plan.
- **AC-07 — chưa hoàn tất:** Canonical Reading order, correction Elms và q164–167 boundary có regression; `official-exams-source-audit.md:37` vẫn xác nhận F42/F46/F51/F56 chưa có nguồn chính xác. `official-exams-media-audit.md:11–24` vẫn chưa có playback/render/MIME/CORS/content/rights approval cho 8 audio và 15 ảnh.
- **AC-08 — evidence một phần:** H2 xác minh opt-in, idempotency/conflict/rollback/concurrent-code behavior; dedicated PostgreSQL test vẫn bị environment gate skip tại `OfficialCatalogPostgresIT.java:35–36`. Không coi H2 là PostgreSQL evidence.
- **OFFICIAL-08 — evidence còn thiếu:** Browser media/mobile và Writing Task 1 structured media → grader-mock integration theo `OFFICIAL-EXAMS-plan.md:101` chưa có kết quả nghiệm thu. Đây là yêu cầu còn lại trong scope, không phải defect ngoài scope hoặc một hạng mục đã hoàn thành.

### Verification — reviewer-run trong lượt này

Backend focused:

```powershell
.\mvnw.cmd '-Dtest=ExamDatasetBundleV2Test,ExamPublicationFlowTest,IeltsExcelV2ExamParserTest,IeltsAcademicPublicationValidatorTest,ExamDatasetIntegrationTest,DefaultExamDatasetServiceTest,OfficialExamDatasetTest,OfficialExamWorkbookAuditTest,OfficialExamDatasetRegistryTest,OfficialExamsContractIT,OfficialCatalogPostgresIT,IeltsAnswerGroupEvaluatorTest,OfficialExamGradingCountTest,PairedPracticeFeedbackContractIT' test -q
```

- **Exit 0; 14 classes, 63 tests: 62 PASS / 1 SKIP, 0 failures/errors** theo Surefire reports mới. Skip duy nhất là `OfficialCatalogPostgresIT`; `OFFICIAL_EXAM_POSTGRES_TEST_URL` không được cấu hình. Các integration chạy H2/test profile; không ghi DB developer.

Frontend focused:

```powershell
npx vitest run src/features/exams/__tests__ src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx src/features/exam/__tests__/usePracticeFeedback.test.tsx src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/attemptApi.test.ts src/features/exam/__tests__/practiceFeedbackContract.test.ts src/features/exam/__tests__/PracticeFeedbackUI.test.tsx src/features/exam/components/review/__tests__/ExplanationBox.test.tsx --reporter=dot
```

- **Exit 0; 12 files / 366 tests PASS**, gồm toàn bộ 52 hook tests và regression cả independent/paired behavior.
- `Get-FileHash`: hai workbook fixtures và correction Elms resource tiếp tục khớp source audit. Không thay đổi workbook hoặc correction resource.
- `git diff --check`: exit 0; chỉ có LF/CRLF notices hiện hữu. Không chạy lại full backend/frontend, build/lint hoặc browser trong lượt reviewer này.
- **Fixer-reported, không phải reviewer-run mới:** combined backend 265 PASS/1 SKIP; full frontend 1.436 PASS; lint exit 0/49 warnings; build exit 0. Evidence này được giữ riêng với các focused outputs ở trên.

### OUT-OF-SCOPE và next required action

- Không xác nhận defect ngoài feature và không mở rộng sang audit khác. Các gate nguồn/media/artifacts/PostgreSQL/integration nêu trên vẫn là phần chưa hoàn tất của feature.
- Hoàn thiện nguồn được xác minh cho bốn ô Cambridge; lấy media/content/rights approval; tạo hai versioned bundles; chạy dedicated PostgreSQL, browser/media/mobile và Writing Task 1 → grader-mock integration. Sau khi có đầy đủ evidence, yêu cầu full-feature review lại. Không cần mở lại F1–F4 trừ khi có regression mới.
- Reviewer chỉ append entry này, giữ nguyên lịch sử handoff; không sửa production/tests/approved plan, không seed/publish trên DB developer, không commit/push. Dừng sau báo cáo.


## 2026-10-17 — Codex Fixer — Đối chiếu lại yêu cầu re-FIX F1–F4 sau re-review

- Đã đọc entry mới nhất `Full-feature re-review sau re-FIX F1–F4` (bắt đầu dòng 316). Reviewer xác nhận đóng cả hai P1 và hai P2, không có P0/P1/P2 mới hoặc còn mở trong implementation đã review. Verdict BLOCKED áp dụng cho nghiệm thu toàn feature.
- Đối chiếu trực tiếp working tree: registered ETS gate vẫn kiểm tra đầy đủ thứ tự q_001–q_200; parser giữ checksum upload mà exporter legacy đọc; cả sáu nhánh lỗi hook cập nhật toàn bộ paired members; source/media audit thống nhất ba ô Elms đã hiệu chỉnh và bốn ô canonical chưa xác minh. Các regression bổ sung trong lượt fix trước vẫn có tại bundle/admin publication và hook tests.
- Không phát hiện finding đã xác nhận cần sửa thêm trong bốn mục được yêu cầu. Lượt này chỉ append handoff; không thêm test trùng hoặc sửa code/source audit đang đúng. Giữ nguyên công việc có sẵn và toàn bộ lịch sử handoff.
- Không chạy lại tests/build/lint trong lượt đối chiếu này vì không có thay đổi implementation/test hoặc counterexample mới. Evidence mới nhất do **reviewer chạy**, không phải fixer chạy lại: backend 62 PASS / 1 SKIP (PostgreSQL chưa cấu hình); frontend focused 366 PASS. RED/GREEN và 16 regression cases của fixer nằm ở entry trước.
- Giữ **PARTIAL / RELEASE BLOCKED**: F42/F46/F51/F56 cần nguồn chính xác; media/content/rights approval, hai runtime bundles, dedicated PostgreSQL, browser/media/mobile và Writing Task 1 → grader-mock integration vẫn chưa hoàn tất. Đây là các yêu cầu còn lại trong scope plan, không phải bốn defect đã đóng. Không tự suy đoán nguồn hoặc cấp approval.
- Verification lượt này: đối chiếu code/tests/docs và `git diff --check`; xác nhận chỉ handoff thay đổi so với đầu lượt. Không commit/push hoặc ghi DB developer. **Dừng chờ re-review; chỉ mở lại F1–F4 khi có regression mới được xác nhận.**


## 2026-10-17 — Codex — TOEIC-only seed/publish theo yêu cầu chủ dự án

- Chủ dự án xác nhận có quyền sử dụng nội dung và media, đồng thời yêu cầu nạp/xuất bản ETS 2024 trước; Cambridge IELTS để sau. Chỉ chọn approval cho TOEIC; không tạo, nạp hoặc publish IELTS.
- Thêm chọn dataset bằng `EXAM_DEFAULT_DATASET_KEYS` với allowlist khóa cố định; mặc định cũ vẫn chọn cả hai dataset và seed vẫn tắt. Test xác nhận chỉ nạp bundle TOEIC, khóa ngoài allowlist bị từ chối trước khi gọi service.
- Tạo runtime bundle `backend/src/main/resources/datasets/exams/ets-2024-test-1.v2.json` từ workbook completed đã audit checksum; bundle validate và JSON round-trip. Approval reference trong bundle: `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17`. SHA-256 bundle `89D5ACE3A384919B52B57767A7C45219943A06369B23362C6334CC43E435C233`, 221,027 bytes.
- Verification focused: `DefaultExamDatasetRunnerTest`, `OfficialToeicBundleGenerationTest`, `DefaultExamDatasetServiceTest`, `ExamDatasetIntegrationTest`, `ExamPublicationFlowTest` → **24 tests PASS, 0 failures/errors/skips**. Test compile có một mapper warning sẵn có; runtime hiển thị các cảnh báo thư viện hiện hữu.
- Seed được chạy một lần trên cấu hình PostgreSQL local hiện có (`localhost:5434/multilingodb`) với seed/publish bật và key duy nhất `ets-2024-test-1`; tiến trình dừng sau xác minh.
- PostgreSQL read-only verification sau seed: exam ID `2`, code `TOEIC-ETS-2024-T1-V2`, `ETS 2024 Test 1`, `published=true`, type `TOEIC_LR`, duration 120 phút, 2 sections, 7 parts, 200 câu. Per-Part: `6/25/39/30/30/16/54`.
- Integrity query sau khi seed xác nhận cả 200 câu là `SINGLE_CHOICE`, có `options` dạng object chuẩn; không câu nào còn `metadata.options`.
- Đề mini `TOEIC_MOCK_01` vẫn published và giữ 47 attempt hiện có; không unpublish/đổi dữ liệu. Không có row `IELTS-CAMBRIDGE-20-T1-V1`; không chạm attempt 8 hoặc dữ liệu lịch sử.
- `git diff --check` exit 0; chỉ có LF/CRLF notices hiện hữu. Không commit/push.
- Giới hạn còn lại: xác minh audio ở mức tải/playback kỹ thuật; chưa nghe đối chiếu nội dung lời thoại. 11 ảnh đã tải/render và giữ nguyên; media không bị chỉnh sửa. Handoff này ghi nhận phát hành TOEIC theo yêu cầu, không đổi verdict BLOCKED của nghiệm thu toàn bộ feature gồm IELTS.
