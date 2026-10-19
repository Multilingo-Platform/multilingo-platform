# Cambridge IELTS 20 Test 1 — Nạp và xuất bản vào database

**Ngày:** 2026-10-19  
**Trạng thái:** PLANNED  
**Baseline:** 5b3442efffb7c098b86eb1833408a1903b5d21ff, branch feature/TV3-00-contract-audit.

## Mục tiêu

Đưa workbook backend/Cambridge_Ielts_20_Test_1_(Full_giải_thích).xlsx thành dataset IELTS Academic có phiên bản, seed được vào PostgreSQL và xuất bản qua catalog. Dữ liệu làm bài, chấm, review và Writing phải lấy từ snapshot canonical; không thay đổi attempts lịch sử.

Dataset phát hành:

| Trường | Giá trị |
|---|---|
| datasetKey | cambridge-ielts-20-test-1 |
| version | 2 |
| examCode | IELTS-CAMBRIDGE-20-T1-V2 |
| type/language | IELTS_ACADEMIC / en |
| Cấu trúc | Listening 4 part, Reading 3 passage, Writing 2 task |
| Câu hỏi | 80 objective + 2 essay |
| Thời lượng | Listening 30, Reading 60, Writing 60 phút |
| Giải thích | Đủ 82/82 từ workbook; không sinh bằng AI |

## Kết quả khảo sát và ràng buộc

Nguồn có SHA-256 d00af9a50c325b85d22cbdcdc2a8205a42da0d2bbe0587985e53575fb4ce549d. Workbook có 3 sheet, 20 cột ở sheet Exam Template, 9 part, 19 group và 82 dòng câu hỏi. Reading đã ở thứ tự Passage 1, 2, 3; có 4 audio và 4 ảnh Cloudinary. Có 5 cặp IELTS chọn hai đáp án (10 dòng), 2 Writing essay, và explanation đầy đủ.

Parser hiện tại đã chạy được workbook nhưng trả 81 câu, một ID_INVALID, 24 MEDIA_DUPLICATE và validator cấu trúc không đạt vì profile chỉ nhận source cũ. Nguyên nhân cần sửa là mapping Reading cũ 3→1→2, ID collision, media merged-cell trùng lặp và ESSAY làm mất explanation.

Working tree đang có thay đổi của các task khác, gồm workbook nguồn đang staged và thay đổi TV3-22. Executor phải giữ nguyên chúng. PostgreSQL mặc định localhost:5434/multilingodb hiện không xác minh được trong lượt lập kế hoạch; không được tự chuyển sang database khác.

### Quyết định

- Giữ Cambridge V1 trong registry để tương thích; thêm V2 là version hiện hành.
- V2 yêu cầu đủ explanation; V1 vẫn giữ chính sách PARTIAL.
- Giữ ID canonical l_001..l_040, r_001..r_040, w_001..w_002; Reading canonical là Passage 1 → 2 → 3.
- Mỗi thành viên cặp dùng SINGLE_CHOICE, giữ answer_group mode DISTINCT_UNORDERED; evaluator tính tối đa một điểm cho mỗi ô và không tính lặp đáp án.
- Writing explanation là dữ liệu review, không đưa vào prompt chấm AI.
- Media chỉ được xác nhận VERIFIED sau khi kiểm tra HTTP/MIME/hash và browser playback/render; nếu không kiểm tra được thì BLOCKED, không tạo metadata giả.
- Seed mặc định tắt, atomic, idempotent và không ghi đè code khác. Publish chỉ khi cờ được bật rõ ràng.

## Acceptance criteria

- AC-01: Parser nhận đúng workbook mới, 9 part, 19 group, 82 câu; ID và thứ tự ổn định.
- AC-02: Canonical có 80 objective + 2 essay, options ở cấp câu hỏi, answer key ở correct_answer, không còn metadata.options.
- AC-03: Reading context của Passage 1/2/3 và media/group boundary không bị trộn; 5 cặp trả đúng metadata và chấm đúng thứ tự.
- AC-04: Cả 82 explanation được bảo toàn; không đoán nội dung và không gửi explanation vào AI grading.
- AC-05: Workspace/start/review chỉ lộ dữ liệu công khai; answer key/explanation không xuất hiện trong workspace live; attempt cũ giữ snapshot.
- AC-06: Bundle schemaVersion 2 có checksum/provenance, không có database ID, token, placeholder hoặc context lộ đáp án.
- AC-07: Seed tắt không ghi; seed bật tạo đúng một exam, chạy lại bỏ qua cùng checksum, checksum khác trả conflict và không overwrite.
- AC-08: Chỉ exam V2 đã qua validator mới publish; catalog hiển thị đúng 9 part và 150 phút; TOEIC và fixture cũ không hồi quy.
- AC-09: Media được xác minh độc lập; browser mở được audio/hình đúng part và Writing Task 1 dùng structured media.
- AC-10: Backend focused tests, PostgreSQL test riêng, frontend contract tests, build/lint và git diff --check có evidence; không commit/push.

## Phạm vi không đổi

Không sửa schema/migration, endpoint submit/autosave, review contract chung, TOEIC bundle, mock fixture, dependency, provider Gemini thật hoặc database người dùng. Không chạy GenerateTemplateTest vì test này ghi workbook.

## Subtasks triển khai tuần tự

### CIP-01 — Audit workbook và provenance

Files:

- Tạo docs/datasets/cambridge-ielts-20-test-1-v2-source-audit.md.
- Tạo fixture backend/src/test/resources/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx.
- Tạo backend/src/test/java/com/multilingo/backend/modules/exam/service/CambridgeIeltsFullSourceAuditTest.java.

Các bước:

1. Sao chép fixture bằng byte, ghi SHA-256 và filename; không sửa workbook gốc.
2. Kiểm tra sheet/header/merged cells, 9 part, 19 group, 82 row, 80 objective, 2 essay, 82 explanation.
3. Lập bảng row nguồn → question ID canonical; ghi 5 answer group và các URL media.
4. Đối chiếu Reading context theo nội dung, giữ thứ tự mới; ghi thay đổi so với nguồn cũ chỉ để provenance.
5. Ghi rõ explanation Writing là hướng dẫn nguồn, không phải điểm hoặc model answer.

Tests: hash thay đổi, thiếu row, trùng answer group, answer ngoài options, merged boundary, Unicode và media count. Chạy:
~~~powershell
.\mvnw.cmd '-Dtest=CambridgeIeltsFullSourceAuditTest,OfficialExamWorkbookAuditTest' test
~~~

Gate: Audit có provenance đầy đủ và test không phụ thuộc mạng.

### CIP-02 — Parser IELTS V2 và chuẩn hóa canonical

Files sửa:

- backend/src/main/java/com/multilingo/backend/modules/exam/service/OfficialExamSourceProfile.java
- backend/src/main/java/com/multilingo/backend/modules/exam/service/IeltsExcelV2ExamParser.java
- backend/src/main/java/com/multilingo/backend/modules/exam/service/ExamParserService.java
- backend/src/test/java/com/multilingo/backend/modules/exam/service/IeltsExcelV2ExamParserTest.java

File tạo:

- backend/src/test/java/com/multilingo/backend/modules/exam/service/CambridgeIeltsFullImportTest.java

Các bước:

1. Dispatch theo metadata IELTS_ACADEMIC, không suy skill từ audio.
2. Dùng nhãn passage/group khai báo trong workbook để map Passage 1/2/3; không dùng mapping source-index cũ.
3. Sinh ID theo part canonical và kiểm tra unique/order: l_001..l_040, r_001..r_040, w_001..w_002.
4. Resolve merged cells theo scope. Media giống nhau trong merged group là một giá trị hợp lệ; media khác nhau cùng scope tạo issue rõ cell/question.
5. Chuyển MULTIPLE_CHOICE/multi-slot theo profile thành canonical type, giữ options ID và answer set; tạo answer_group cho 5 cặp.
6. Giữ correct_answer và explanation ở cấp question; ESSAY không có answer key nhưng giữ explanation.
7. Chỉ áp dụng correction cũ cho old source hash; source hash mới không dùng correction ngầm.

Tests: preview 82 câu không issue; IDs, passage order, pairs, 8 media URL, explanation essay, missing header/formula/error cell và old-source regression. Chạy:
~~~powershell
.\mvnw.cmd '-Dtest=IeltsExcelV2ExamParserTest,CambridgeIeltsFullImportTest,ExamParserServiceTest' test
~~~

Gate: counts=9/19/82, canPublish=true chỉ sau validator, không còn ID_INVALID hoặc duplicate media giả.

### CIP-03 — Registry, bundle schema V2 và publication gate

Files sửa:

- backend/src/main/java/com/multilingo/backend/modules/exam/service/OfficialExamDatasetRegistry.java
- backend/src/main/java/com/multilingo/backend/modules/exam/service/IeltsAcademicPublicationValidator.java
- backend/src/main/java/com/multilingo/backend/modules/exam/dto/response/ExamDatasetBundle.java
- backend/src/main/java/com/multilingo/backend/modules/exam/service/impl/AdminExamServiceImpl.java
- backend/src/main/java/com/multilingo/backend/config/DefaultExamDatasetRunner.java

Tests sửa/tạo: OfficialExamDatasetRegistryTest, IeltsAcademicPublicationValidatorTest, ExamDatasetBundleV2Test, ExamPublicationFlowTest, DefaultExamDatasetRunnerTest.

Các bước:

1. Registry giữ V1 và thêm V2 với source hash mới, COMPLETE, expected shape và approval reference.
2. find(datasetKey) trả V2; findByExamCode/export vẫn tìm được V1.
3. Thêm overload export nhận version; exportForCode dùng version của definition, không mặc định nhầm V1.
4. Validator kiểm tra sections/duration, part/group counts, ID order, options/answers, pair metadata, passage, audio và structured Writing image.
5. V2 bắt buộc 82 explanation nonblank; V1 giữ policy cũ. Unknown dataset/hash/version, thiếu passage hoặc answer ngoài options đều fail.
6. Kiểm tra bundle không có DB ID, attempt data, token hoặc raw answer key trong public request.

Tests: V1 regression, V2 valid, missing explanation, wrong hash, wrong pair, duplicate ID, schema v1 export.
~~~powershell
.\mvnw.cmd '-Dtest=OfficialExamDatasetRegistryTest,IeltsAcademicPublicationValidatorTest,ExamDatasetBundleV2Test,ExamPublicationFlowTest,DefaultExamDatasetRunnerTest' test
~~~

Gate: Không có đường publish nào bỏ qua validator.

### CIP-04 — Bundle runtime và media verification

Files:

- Tạo backend/src/main/resources/datasets/exams/cambridge-ielts-20-test-1.v2.json.
- Tạo docs/datasets/cambridge-ielts-20-test-1-v2-media-audit.md.
- Tạo scripts/datasets/BuildCambridgeIeltsBundle.java.
- Tạo backend/src/test/java/com/multilingo/backend/modules/exam/service/CambridgeIeltsDatasetTest.java.
- Append docs/datasets/official-exams-source-audit.md và docs/datasets/official-exams-media-audit.md khi được phép.

Các bước:

1. Build từ canonical parser/export, không copy dữ liệu DB lỗi.
2. Dùng stable object-key sort, giữ array order, ghi checksum canonical và approval reference đã xác nhận quyền sử dụng.
3. Kiểm tra 4 audio và 4 image: HTTP status, MIME, size, SHA-256, CORS và browser playback/render; ghi timestamp/phương pháp. Không lưu binary media vào Git.
4. Kiểm tra Writing Task 1 image là structured media, không nhúng img vào prompt text.
5. Verify toàn bộ 82 question, answer/options, explanation và không có marker lộ đáp án, placeholder 44 hoặc DB ID.

Tests: parse bundle, deterministic checksum, counts, exact IDs, media references, no secret/answer leakage, source-to-bundle semantic comparison. Nếu media thật không tải/đo được, giữ BLOCKED với bằng chứng; không fake hash.

Gate: Chỉ copy bundle đã validate vào runtime resources; TOEIC bundle hash không đổi.

### CIP-05 — Grading, review và frontend regression

Files backend:

- Tạo backend/src/test/java/com/multilingo/backend/modules/exam/service/CambridgeIeltsCatalogContractIT.java.
- Mở rộng OfficialCatalogPostgresIT, WritingGradingLifecycleIT, ExamReviewContractIT, IeltsAnswerGroupEvaluatorTest nếu thiếu coverage.

File frontend:

- Tạo frontend/src/features/exam/__tests__/CambridgeIeltsWorkspaceContract.test.tsx.

Các bước:

1. Seed draft → catalog không hiển thị; publish → catalog có đúng code V2.
2. Start workspace qua API thật và kiểm tra sanitized payload không có correct_answer/explanation.
3. Chấm 80 objective; kiểm tra pair A/E, E/A, A/B, A/A và unanswered theo evaluator dùng chung.
4. Review hiển thị 82 explanation; Writing không có verdict objective/score giả.
5. Gửi Writing Task 1 có structured image và Task 2 text qua fake provider; assert prompt không chứa explanation.
6. Sửa hoặc unpublish exam sau khi tạo attempt; snapshot, grading key và review attempt cũ không đổi.
7. Frontend test dùng page/hook/reducer/normalizer thật, chỉ mock HTTP/browser APIs; không thêm production code nếu chưa có defect được xác nhận.

Tests: backend contract trên PostgreSQL riêng official_exams_test; frontend focused contract, typecheck và build. H2 không được gọi là bằng chứng snapshot production.

Gate: Catalog → start → workspace → submit → result/review chạy xuyên suốt cho cả 9 part.

### CIP-06 — Seed PostgreSQL đích ở trạng thái draft

Files:

- Tạo docs/datasets/cambridge-ielts-20-test-1-v2-release.md.
- Sửa DefaultExamDatasetRunner/DefaultExamDatasetService chỉ khi test chứng minh thiếu version hoặc allowlist.

Các bước:

1. Xác định datasource thật bằng host/port/schema và fingerprint readonly; không tự chuyển từ port 5434 sang 5432.
2. Kiểm tra code/count/checksum TOEIC và attempts hiện hữu, không dump essay/answer vào log.
3. Chạy một process với:
~~~text
EXAM_DEFAULT_DATASET_ENABLED=true
EXAM_DEFAULT_DATASET_KEYS=cambridge-ielts-20-test-1
EXAM_DEFAULT_DATASET_PUBLISH_APPROVED=false
EXAM_MOCK_DATA_ENABLED=false
~~~
4. Seed trong transaction; code chưa có tạo mới, checksum trùng bỏ qua, checksum khác conflict; không ghi đè hoặc xóa attempts.
5. Verify 3 sections, 9 parts, 19 groups, 82 questions, 82 explanations, 150 phút và canonical digest.
6. Dừng process seed sau verification, không bật mặc định trong repository.

Gate: Nếu database đích không truy cập được, ghi BLOCKED trong handoff/release doc; không thử database khác và không dùng SQL bypass.

### CIP-07 — Publish và smoke test bàn giao

Files: cập nhật CAMBRIDGE-IELTS-20-T1-PUBLISH-handoff.md và release doc; không sửa lịch sử handoff cũ.

Các bước:

1. Chạy publication path hiện có với admin/content creator; đặt publish approved sau khi tất cả gate đạt.
2. Kiểm tra catalog chỉ trả V2, không tự unpublish TOEIC/mock nếu chưa có fingerprint xác nhận.
3. Browser smoke ở 375/1366 px: Listening audio, Reading passages, paired answers, Writing image, keyboard focus và review explanation.
4. Tạo attempt test mới, submit, kiểm tra result/review; không dùng attempt lịch sử của người dùng.
5. Chạy seed lần hai để chứng minh idempotency; test rollback bằng unpublish code V2, giữ exam/attempt/snapshot.
6. Append evidence, AC mapping, checksum, DB exam ID, timestamp và residual risks; dừng chờ final review.

## Ma trận kiểm thử

| TC | Kịch bản | Kết quả bắt buộc | Task |
|---|---|---|---|
| CIP-T01 | Workbook mới | 9/19/82 và 82 explanation | 01–02 |
| CIP-T02 | Reading order | Passage 1/2/3, IDs r001–r040 | 01–02 |
| CIP-T03 | Hash/profile | Hash sai bị chặn; V1 regression giữ nguyên | 02–03 |
| CIP-T04 | Merged media | Media giống nhau dedupe; khác nhau tạo issue | 02 |
| CIP-T05 | Pair grading | Đảo thứ tự đúng; duplicate không cộng hai lần | 02,05 |
| CIP-T06 | Essay | Hai task giữ explanation, không có correct key | 02,05 |
| CIP-T07 | Security | Workspace không lộ key/explanation | 05 |
| CIP-T08 | Seed | Disabled/no write, first create, rerun skip, conflict rollback | 03,06 |
| CIP-T09 | History | Edit/unpublish không đổi snapshot attempt cũ | 05–06 |
| CIP-T10 | Media | 4 audio/4 image đúng part và dùng được | 04,07 |
| CIP-T11 | Frontend | 9 part, pair, passage, Writing image render đúng | 05,07 |
| CIP-T12 | Regression | TOEIC, fixtures, autosave/submit/result không đổi | 03,05,07 |

## Lệnh verification

Backend focused:
~~~powershell
.\mvnw.cmd '-Dtest=CambridgeIeltsFullSourceAuditTest,CambridgeIeltsFullImportTest,CambridgeIeltsDatasetTest,CambridgeIeltsCatalogContractIT,IeltsExcelV2ExamParserTest,IeltsAcademicPublicationValidatorTest,OfficialExamDatasetRegistryTest,ExamDatasetBundleV2Test,ExamPublicationFlowTest,DefaultExamDatasetRunnerTest,DefaultExamDatasetServiceTest,ExamReviewContractIT,IeltsAnswerGroupEvaluatorTest,WritingGradingLifecycleIT' test
~~~

PostgreSQL test riêng:
~~~powershell
.\mvnw.cmd '-Dtest=OfficialCatalogPostgresIT' test
~~~

Frontend:
~~~powershell
npx vitest run src/features/exam/__tests__/CambridgeIeltsWorkspaceContract.test.tsx src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx src/features/exams/__tests__/ExamContentMapping.test.ts src/features/exams/__tests__/ExamBuilderRoundTrip.test.tsx --maxWorkers=2
npx tsc -b --pretty false
npm run build
~~~

Root:
~~~powershell
git diff --check
git status --short
~~~

## Definition of Done

Tất cả AC có evidence; bundle V2 được review và checksum ổn định; seed/publish PostgreSQL riêng thành công hoặc ghi rõ blocker; browser smoke chứng minh hành vi thật; TOEIC/attempt lịch sử không đổi; không có secret hoặc answer leak; mọi thay đổi nằm trong phạm vi kế hoạch; không commit/push.

