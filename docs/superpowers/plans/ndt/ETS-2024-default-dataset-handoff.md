# ETS 2024 default dataset — Handoff

## 2026-10-13 — Executor — IN_PROGRESS

Baseline `3dee084`, branch `feature/TV3-00-contract-audit`. Giữ `.codex/`, `backend/Exam_Template.xlsx`, TV3-20 plan/handoff đang untracked.
Spec: user-approved plan trong `ETS-2024-default-dataset-plan.md`.

Pre-flight: parser output → normalized request → builder round-trip → export/seed phải dùng chung contract; published-only start không thay đổi resume/review.

Ruling: thực hiện trên feature branch hiện tại, không tạo worktree/commit để giữ checkout và uncommitted work người dùng.
Ruling: Task 5 thiếu nội dung do người biên tập cung cấp. Triển khai export/seed infrastructure nhưng không tạo approved ETS runtime bundle, không nạp DB thật; audit ghi rõ blocker.
Ruling: ledger/handoff được giữ trong repository vì không commit và không xóa evidence khi kết thúc.

| Task | Status |
|---|---|
| 01 Parser v2 | IN_PROGRESS |
| 02 Persistence/publication | PENDING |
| 03 Published-only start | PENDING |
| 04 Builder | PENDING |
| 05 Content approval | BLOCKED_CONTENT |
| 06 Seed/integration | PENDING |

## 2026-10-13 — Executor — Tasks 01–04 IMPLEMENTED; 06 IN_PROGRESS

- 01: POI v2 parser, merged cells, stable IDs, preview response; legacy parsers giữ riêng. RED: workbook v2 bị từ chối; GREEN: 8 tests parser PASS.
- 02: preview endpoint, canonical TOEIC answers và publication gate create/update/PATCH. RED: invalid published create/PATCH được phép và language sai; GREEN: parser/publication/controller/service 24 tests PASS.
- 03: published-only snapshot khi createAttempt, không fallback; resume/review không đổi. RED: draft tạo attempt được; GREEN: 35 tests gồm adapter, immutable keys và review contract PASS.
- 04: backend preview thay browser parser v2, canonical/editor mapping, nút lưu nháp, loading/error có role, DOMPurify preview. RED: chưa có mapping và UI không có thông báo lỗi; GREEN: 5 tests mapping/import PASS, frontend build PASS.
- 06: export bundle, source/checksum, classpath opt-in runner, stable code/no overwrite; đang kiểm chứng security và transaction H2.
- Test skeleton seed lần đầu chưa compile vì thiếu module; không coi đây là behavioral RED. Integration tiếp theo đã phát hiện lỗi fixture/security thật để xử lý.

### Hiệu chỉnh phân tích nguồn

POI và đối chiếu sharedStrings.xml chứng minh `44` là index của chuỗi rỗng, không phải nội dung ô. Phân tích ban đầu trong yêu cầu bị sai ở điểm này. Giữ nguyên file, không thay answer key. Thực tế thiếu 66 answers, 200 explanations, 49 group contexts; Part 2 D trống nên có ba option ID. Part 1–2 được giữ option ID với text trống vì audio đọc lựa chọn. Không áp dụng quy tắc xóa số 44 toàn hệ thống.

### Rulings bổ sung

- Export kiểm tra cấu trúc đầy đủ ETS 7 Part/200 câu và đưa `approvalReference=null`; người biên tập phải ghi reference phê duyệt trước khi đóng gói. Seed từ chối bundle chưa có approval reference. Reference là ghi nhận của admin, không chứng minh pháp lý hoặc độ chính xác.
- Partial TOEIC hợp lệ vẫn được biên tập/xuất bản; yêu cầu đủ 200 câu chỉ áp dụng dataset ETS hoàn chỉnh.
- PATCH không tự migrate đề legacy: cần lưu lại canonical trước khi xuất bản, tránh validation trên bản normalize nhưng grading đọc bản cũ.
- Không chạy GenerateTemplateTest, không seed DB thật, không tải media.

## 2026-10-13 — Executor — SOFTWARE IMPLEMENTED / BLOCKED_CONTENT

Hạ tầng Tasks 01–04 và 06 đã triển khai, kiểm chứng focused. Task 05 chỉ có audit và exporter; việc hoàn thiện/phê duyệt nội dung và runtime bundle vẫn bị chặn. Không tuyên bố toàn bộ dataset PASS.

| Task | Trạng thái cuối | Evidence |
|---|---|---|
| 01 Parser v2 | IMPLEMENTED | POI fixtures và test đọc workbook thật: 7 Part/50 nhóm/200 câu, checksum khớp |
| 02 Persistence/publication | IMPLEMENTED | Draft structure gate, create/update/PATCH publication gate, preview không ghi DB; real method security |
| 03 Published-only start | IMPLEMENTED | Draft bị từ chối; published tạo attempt; không fallback; attempt cũ tiếp tục dùng snapshot |
| 04 Builder | IMPLEMENTED | Mapping, backend preview, edit/save/reload, option mutation, rich-text safety và legacy importer regression |
| 05 Content approval | BLOCKED_CONTENT | Thiếu 66 keys/200 explanations/49 contexts; media và quyền sử dụng chưa xác minh; chưa tạo runtime JSON |
| 06 Seed/integration | IMPLEMENTED_INFRASTRUCTURE | Opt-in false, approval/checksum/full-shape gate, idempotency/no overwrite/rollback/race H2; chưa chạy PostgreSQL |

### Files thay đổi

Backend production (đường dẫn tương đối từ repository):

- `backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/`: mới `ExamImportPreviewResponse.java`, `ExamDatasetBundle.java`.
- `backend/src/main/java/com/multilingo/backend/modules/exam/service/`: mới `ExcelV2ExamParser.java`, `ExamContentNormalizer.java`, `ExamPublicationValidator.java`, `DefaultExamDatasetService.java`; sửa `ExamParserService.java`, `AdminExamService.java`, `impl/AdminExamServiceImpl.java`.
- `backend/src/main/java/com/multilingo/backend/modules/exam/controller/AdminExamController.java`: preview/export và handler access-denied có phạm vi controller, không sửa shared security.
- `backend/src/main/java/com/multilingo/backend/config/DefaultExamDatasetRunner.java` và `backend/src/main/resources/application.properties`: classpath runner opt-in, mặc định tắt.
- `backend/src/main/java/com/multilingo/backend/modules/testing/`: sửa `adapter/ExamAdapter.java`, `adapter/impl/DbExamAdapter.java`, `adapter/impl/FixtureExamAdapter.java`, `service/impl/TestAttemptServiceImpl.java`; chỉ published-only start và section order, không sửa grading/submit/resume contracts.

Backend tests:

- Mới trong `backend/src/test/java/com/multilingo/backend/modules/exam/service/`: `ExcelV2Fixture.java`, `ExcelV2ExamParserTest.java`, `ExamPublicationFlowTest.java`, `DefaultExamDatasetServiceTest.java`, `ExamDatasetIntegrationTest.java`, `ETSWorkbookAuditTest.java`.
- Mới `backend/src/test/java/com/multilingo/backend/modules/exam/controller/ExamImportSecurityTest.java` và `backend/src/test/java/com/multilingo/backend/modules/testing/service/DraftAttemptAccessTest.java`.
- Sửa `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/impl/DbExamAdapterSnapshotTest.java` và `backend/src/test/java/com/multilingo/backend/modules/testing/service/ReviewSnapshotPersistenceTest.java`.

Frontend:

- Mới `frontend/src/features/exams/utils/examContentMapping.ts`.
- Sửa `frontend/src/features/exams/pages/admin/ExamBuilder.tsx`, `ExamBuilderPage.tsx`, `frontend/src/components/common/RichTextEditor.tsx`.
- Mới trong `frontend/src/features/exams/__tests__/`: `ExamContentMapping.test.ts`, `ExamBuilderImport.test.tsx`, `ImportedRichTextSafety.test.tsx`, `ExamBuilderRoundTrip.test.tsx`.

Tài liệu: plan/handoff này và `docs/datasets/ets-2024-test-1-source-audit.md`. Không thêm dependency, schema migration hoặc bundle ETS runtime chưa duyệt.

### Review và các sửa lỗi đã xác nhận

Fresh reviewer `ets_dataset_review` kiểm tra toàn phạm vi, gồm file untracked, theo `executing-plans`. Kết luận cuối **APPROVED đối với hạ tầng phần mềm**, không có P0/P1/P2 còn mở trong review đó. Reviewer không tự chạy Maven/npm; evidence dưới đây do executor chạy. Đây không phải phê duyệt nội dung ETS.

- P1: xóa/thêm option làm lệch option ID và answer key. Sửa mutation nguyên tử, dịch/clear selected index, không tái sử dụng ID đang tồn tại; regression mapping PASS.
- P2: media câu legacy bị mất khi canonicalize. Giữ fallback metadata.media; regression PASS.
- P2: importer non-TOEIC bị thay thế ngoài phạm vi. Giữ nhánh legacy khi metadata ghi rõ loại non-TOEIC; test workbook thật trong bộ nhớ PASS.
- P2: metadata type trống bị default thành IELTS, bypass TOEIC backend preview. RED: test blank-type workbook thất bại; GREEN: dispatch kiểm tra raw nonblank type trước normalization.
- P2: DB snapshot không giữ section order. Sắp theo orderIndex rồi ID; reversed-repository-order regression PASS.
- Kiểm tra cuối phát hiện test snapshot cũ mock đường đọc unrestricted. RED `ReviewSnapshotPersistenceTest`: RESOURCE_NOT_FOUND; cập nhật fixture published-only, assert never gọi unrestricted path; GREEN trong focused suite. Không thay production để làm test cũ PASS.

### Final verification

Chạy tại `backend`:

```powershell
.\mvnw.cmd '-Dtest=ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,AdminExamServiceImplTest,AdminExamControllerTest,DraftAttemptAccessTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,TestAttemptServiceTest,ExamReviewContractIT,DefaultExamDatasetServiceTest,ExamDatasetIntegrationTest,ExamImportSecurityTest,ETSWorkbookAuditTest,ReviewSnapshotPersistenceTest,ExamAdapterVersionCaptureTest' '-Dets.source=E:/Downloads/ETS_2024_Test_1 (1).xlsx' test
```

Kết quả: **74 tests, 0 failures, 0 errors, 0 skipped, BUILD SUCCESS**, hoàn tất 23:28:49 +07:00. Workbook source chỉ được đọc. Integration dùng H2 in-memory riêng; unique violation trong race test là nhánh được kiểm chứng, không phải suite failure. Có warning unchecked Java generics, JVM agent/H2/framework; không coi đây là lỗi test.

Chạy tại `frontend`:

```powershell
npm test -- src/features/exams/__tests__
npm run lint
npm run build
```

- Focused: **5 files / 20 tests PASS**, hoàn tất lượt cuối 23:28:50 +07:00.
- Lint: exit 0, 0 errors, **28 warnings hiện hữu** tại baseline checkout này; gồm 3 fast-refresh warnings của builder và warnings ngoài phạm vi. Không dùng số 25 của baseline planning cũ làm bằng chứng hiện tại.
- Build: exit 0; warning bundle lớn vẫn còn. Không sửa unrelated warnings.
- Root `git diff --check`: exit 0, không có lỗi whitespace. Không chạy full backend/frontend suite hoặc GenerateTemplateTest.

### AC mapping

| AC | Evidence phần mềm | Giới hạn |
|---|---|---|
| 01 | Actual workbook audit và merged/header/ID parser tests | Chưa xác nhận chất lượng nội dung 200 câu |
| 02 | Preview cell/question issues; import unpublished; invalid draft structure rejected | Lưu DB thật chưa thực hiện |
| 03 | Canonical option IDs; round-trip; DB submit/review giữ key B và explanation lịch sử | Keys của nguồn ETS còn thiếu/chưa được duyệt |
| 04 | Publication flow gate, real method security, draft attempt rejection | Không xuất bản đề nguồn |
| 05 | Real builder/page mapping qua mock HTTP: GET → edit → single PUT → GET reload; IDs/context/media/source hash giữ nguyên | Chưa kiểm tra thủ công trên browser/database thật |
| 06 | Disabled runner, checksum/approval rejection, skip equivalent, conflict/rollback, concurrent unique-code test H2 | Chưa có approved runtime bundle; chưa chạy PostgreSQL smoke |
| 07 | DB integration edit/unpublish sau attempt rồi submit/review; workspace không lộ key/explanation; immutable-key/review regression | Không thay semantics snapshot của attempt cũ |
| 08 | Formula bị từ chối, DOMPurify malicious HTML test, safe error text; parser không gọi media network | Không kiểm tra khả năng truy cập hoặc nội dung URL |

### Remaining issues và bàn giao

- **BLOCKED_CONTENT:** cần nguồn đáp án, lựa chọn, passage/context, giải thích đã được đối chiếu và người có thẩm quyền xác nhận quyền sử dụng. Không tự suy ra/sinh nội dung để vượt gate.
- Chưa có `backend/src/main/resources/datasets/exams/ets-2024-test-1.v1.json`; seed mặc định false, không nạp database hiện tại.
- PostgreSQL smoke, browser/keyboard kiểm tra thủ công và các trường hợp negative ngoài focused fixtures chưa được xác nhận. H2 không đủ để tuyên bố mọi hành vi PostgreSQL đã kiểm chứng.
- Seed đồng thời có thể khiến bên thua nhận unique-code conflict; không tự retry. Transaction và unique constraint ngăn trùng/partial writes; người vận hành có thể chạy lại rõ ràng.
- Checksum/approvalReference chỉ kiểm soát bundle, không chứng minh nội dung đúng hoặc quyền xuất bản; HTTPS syntax không chứng minh media hoạt động.
- Giữ nguyên untracked `.codex/`, `backend/Exam_Template.xlsx`, TV3-20 docs. `backend/ETS_2024_Test_1.xlsx` xuất hiện trong lúc làm việc, không do executor tạo; đã giữ nguyên, không đưa vào runtime/ghi đè.
- Tài liệu được kiểm tra bằng `vietnamese-tech-writing`; cảnh báo NUM004 cho địa chỉ ô M2 là false positive, giữ nguyên địa chỉ đối chiếu.

Không commit/push, không sửa workbook gốc, không triển khai runtime dataset hoặc tạo attempt trên môi trường thật. Dừng sau bàn giao; phần mềm sẵn sàng cho final review, nội dung cần bổ sung trước khi đóng gói.

## 2026-10-13 — Full-feature re-review

- Agent: Codex Reviewer.
- Phạm vi: toàn feature ETS 2024 default dataset, Tasks 01–06; theo `tv3-code-review`, approved plan và handoff hiện tại.
- Decision: **BLOCKED** đối với nghiệm thu toàn feature. Chưa xác nhận lỗi code P0/P1/P2 còn mở; kết quả test phần mềm không thay thế content approval hoặc runtime bundle.
- Baseline: HEAD `3dee084b34fd3d787de49b3ffe0258ff31b979ce`. Đã kiểm tra staged (rỗng), unstaged (14 file tracked thay đổi) và các file untracked liên quan: parser/DTO/validator/seed, tests backend/frontend, mapping và source audit. Không áp dụng baseline cũ của các review TV3 khác.

### Acceptance criteria và integration đã kiểm chứng

| AC | Kết quả trong phạm vi evidence hiện có |
|---|---|
| 01 | Workbook gốc và parser fixtures xác nhận 7 Part / 50 nhóm / 200 câu, IDs/order, merged cells và header validation; DB adapter giữ section order. |
| 02 | Preview không ghi DB, lỗi có vị trí ô/question; Excel v2 nhập unpublished, nháp bị từ chối nếu sai cấu trúc. |
| 03 | Mapping dùng option ID, giữ lựa chọn audio text trống/Part 2 A–C; tests thêm/xóa option và production grading/review giữ key lịch sử. Chưa xác nhận đáp án ETS đúng. |
| 04 | Create/update/PATCH có publication gate; endpoint preview/export có method-security tests; start dùng published snapshot, không fallback unrestricted. |
| 05 | Component/page thật qua HTTP mock: load → edit → single save → reload, giữ IDs/context/explanation/media/source hash; nhánh importer non-TOEIC được giữ. Chưa kiểm chứng browser/database thật. |
| 06 | Seed mặc định tắt, đọc classpath cố định; kiểm tra checksum/approval, unpublished, repeat skip, conflict không ghi đè, rollback và unique-code race trên H2. Chưa có approved bundle và chưa chạy PostgreSQL smoke. |
| 07 | Integration qua DB adapter, snapshot và grading/review thật trên H2: sửa/unpublish đề không đổi attempt cũ; workspace không trả key/explanation. |
| 08 | Từ chối formula/error cell; DOMPurify loại script/event handler/javascript URL ở preview; lỗi import dùng text cố định, parser không tải media. |

Đã đối chiếu call paths và test assertions, không chỉ dựa vào tên test hoặc kết luận reviewer/executor trước. `ui-ux-pro-max` được dùng để kiểm tra trạng thái import/lưu và thao tác bàn phím trong phần builder thay đổi; không mở rộng thành audit giao diện toàn repository.

### IN-SCOPE — Findings và điều kiện chưa đủ nghiệm thu

- **P0/P1/P2 code findings:** không có finding mới đủ bằng chứng trong thay đổi được review. Các lỗi option mutation, legacy media/importer, blank-type dispatch và section ordering từng ghi trong handoff có sửa tương ứng và regression tests pass.
- **BLOCKED_CONTENT, không phân loại thành lỗi code:** `ETS-2024-default-dataset-plan.md:36–40,66` và `docs/datasets/ets-2024-test-1-source-audit.md:19–25,37`. Nguồn thiếu 66 answer key (L136:L201), 200 explanation (M2:M201), 49 context cấp nhóm và lựa chọn cho 66 câu cuối (H136:K201); media/rights chưa được người có thẩm quyền xác nhận. Vì vậy chưa có `backend/src/main/resources/datasets/exams/ets-2024-test-1.v1.json` (reviewer kiểm tra đường dẫn: không tồn tại).
- Hành động tối thiểu để mở gate: human editor bổ sung/đối chiếu nội dung từ nguồn được phép, xác nhận media và quyền sử dụng; lưu nháp, đạt publication/export validation, ghi approval reference rồi mới thêm bundle. Không sinh đáp án/giải thích hoặc bật seed để vượt điều kiện này.
- Giới hạn xác nhận, không phải finding P2: H2 race không chứng minh PostgreSQL; round-trip HTTP mock không chứng minh browser thật; checksum/approvalReference không chứng minh chất lượng đáp án hoặc quyền sử dụng; HTTPS syntax không chứng minh media truy cập được.

### Focused verification — Reviewer chạy độc lập

Backend, tại `backend`:

```powershell
.\mvnw.cmd '-Dtest=ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,AdminExamServiceImplTest,AdminExamControllerTest,DraftAttemptAccessTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,TestAttemptServiceTest,ExamReviewContractIT,DefaultExamDatasetServiceTest,ExamDatasetIntegrationTest,ExamImportSecurityTest,ETSWorkbookAuditTest,ReviewSnapshotPersistenceTest,ExamAdapterVersionCaptureTest' '-Dets.source=E:/Downloads/ETS_2024_Test_1 (1).xlsx' test
```

- **74 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS**, hoàn tất 2026-10-13 23:36:28 +07:00. Database integration dùng H2 in-memory; không seed DB đang sử dụng. Source audit test thực sự chạy, không bị skip.
- Đọc độc lập SHA-256 workbook gốc: `5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce`, khớp plan/audit.

Frontend, tại `frontend`: `npm test -- src/features/exams/__tests__` — **5 files / 20 tests PASS**, bắt đầu 23:35:47 +07:00, duration 6.27s. Tests gọi production parser/mapping/service/controller/component theo loại test; external HTTP được mock trong component round-trip.

Root `git diff --check`: exit 0. Lint/build PASS ở entry trước là **executor-reported**, reviewer không chạy lại và không dùng chúng làm bằng chứng độc lập. Không chạy full suite, GenerateTemplateTest, PostgreSQL smoke, browser/keyboard thủ công hoặc gọi media URL.

### OUT-OF-SCOPE và bàn giao

- Giữ nguyên `.codex/`, `backend/Exam_Template.xlsx`, `backend/ETS_2024_Test_1.xlsx`, TV3-20 plan/handoff; không audit hoặc quy thành blocker của feature này. Không có defect ngoài phạm vi mới được xác nhận.
- Không thay production code, tests, approved plan, workbook, runtime dataset hoặc cấu hình seed; chỉ append review này. Không commit/push.
- Next required action: hoàn tất content approval và bundle của Task 05; sau đó chạy focused verification với bundle đã duyệt, PostgreSQL disposable smoke và browser round-trip khi có môi trường phù hợp, rồi yêu cầu full-feature re-review. Chưa được đánh dấu toàn feature PASS.
