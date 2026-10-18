# Đưa Cambridge IELTS 20 Test 1 và ETS 2024 Test 1 thành đề chính thức

Ngày: 2026-10-17  
Trạng thái: IMPLEMENTATION PARTIAL — RELEASE BLOCKED  
Baseline: `9797bbb076ddbf1270bd8470018c965e4e534cfe`, branch `feature/TV3-00-contract-audit`.

## Mục tiêu và quyết định

Đề chính thức là bộ dữ liệu có phiên bản trong repository, seed được vào PostgreSQL, publish sau gate nội dung, và dùng xuyên suốt library → start → workspace → grading → result/review. Giữ fixture nhỏ hiện có cho tests.

Chọn luồng: nguồn Excel có checksum → parser/chuẩn hóa → validator → hai JSON bundle → seed opt-in → publish tường minh. Không sửa workbook gốc, không sửa lịch sử attempt, không tự sinh đáp án/lời giải, không quy đổi raw score, không commit/push.

Nguồn:

| File | SHA-256 | Nội dung đã xác minh |
|---|---|---|
| `E:/Downloads/Cambridge_Ielts_20_Test_1_(Chưa_giải_thích).xlsx` | `1427bd88ff54e59d695bc2b3b02bfbe301e0658a3a76b79bfb3f650461402ee1` | 9 Part, 19 nhóm, 82 dòng; 80 khách quan + 2 Writing; 5 cặp hai ô; 80 explanation rỗng; 4 audio + 4 ảnh |
| `E:/Downloads/ETS_2024_Test_1_completed.xlsx` | `990f8aa1d8190302e469aa021c50ea30e3a65817b4db698c30d47463c08a7fde` | 7 Part, 49 nhóm hiện có, 200 câu; 200 answer/explanation; placeholder `44`; context đáp án suy ra ở Part 3–4; passage 165–167 cần phục hồi |
| `backend/ETS_2024_Test_1 (có giải thích).xlsx` | `b3abb7c09150f4f04022af1a96f3b3e335766d9daa1bdd4a4b217b301a76c3d1` | Nguồn phụ: passage F166 và options/keys cho câu 165–167 khớp nguồn completed |

Quyết định đã chốt: lưu JSON phiên bản + PostgreSQL; cho phép IELTS chưa có explanation và UI ghi “Chưa có giải thích”; member 2 hoàn thiện sau bằng version bundle mới; năm cặp IELTS chấm đúng từng ô, không phụ thuộc thứ tự và không tính trùng.

IELTS: code `IELTS-CAMBRIDGE-20-T1-V1`, key `cambridge-ielts-20-test-1`, type `IELTS_ACADEMIC`, 9 Part, 80 câu khách quan + 2 ESSAY. Thời lượng Listening/Reading/Writing 30/60/60 phút. Canonical order Reading Passage 1/2/3; IDs `l_001…l_040`, `r_001…r_040`, `w_001…w_002`.

TOEIC: code `TOEIC-ETS-2024-T1-V2`, key `ets-2024-test-1`, type `TOEIC_LR`, 7 Part, 200 câu, thời lượng Listening/Reading 45/75 phút; IDs `q_001…q_200`.

Quy tắc chuyển đổi: MULTIPLE_CHOICE một đáp án → SINGLE_CHOICE tại biên import/editor; WRITING_ESSAY → ESSAY; MATCHING_INFORMATION → MATCHING_FEATURES giữ instructions/options; options `{id,text}` và `correct_answer`/`explanation` ở cấp câu hỏi. Chỉ xử lý placeholder `44` theo profile/checksum và ô nguồn. Loại context `ANSWER-KEY-DERIVED CLUES`; không coi đó là transcript. Phục hồi group 8 TOEIC từ nguồn phụ, câu 164 ở email group 7. IELTS passage ở cấp Part; ảnh chuyển thành structured `shared_media`, đặc biệt Writing Task 1 không giữ `<img>` trong context.

Paired-answer metadata công khai:

```json
{"answer_group":{"id":"listening-17-18","mode":"DISTINCT_UNORDERED","question_ids":["l_017","l_018"]}}
```

Mỗi thành viên giữ cùng correct-answer set trong private grading snapshot. Chấm theo declared question order: A/E hoặc E/A = 2; A/B = 1; A/A = 1; blank = unanswered. Practice dùng cùng evaluator, yêu cầu đúng hai member ID, trả kết quả cho cả hai; workspace không bao giờ lộ keys/explanations.

## Tasks tuần tự

### Task 1: OFFICIAL-01 — Audit nguồn và provenance

Files: tạo `docs/datasets/official-exams-source-audit.md`, `backend/src/test/java/com/multilingo/backend/modules/exam/service/OfficialExamWorkbookAuditTest.java`.

Ghi checksum, sheet/cell mapping, part/group/counts, merged-cell boundaries, năm cặp IELTS, thứ tự canonical Reading và từng hiệu chỉnh TOEIC. Test POI đọc workbook nguồn, cố định checksum và kiểm tra invariant; đổi nguồn phải fail cho đến khi audit được cập nhật. Không sửa workbook.

Test: `.\mvnw.cmd '-Dtest=OfficialExamWorkbookAuditTest' test`. AC: provenance rõ, không suy đoán.

### Task 2: OFFICIAL-02 — Parser và canonical normalization

Sửa `backend/src/main/java/com/multilingo/backend/modules/exam/service/ExamParserService.java`, `ExcelV2ExamParser.java`, `ExamContentNormalizer.java`. Tạo `IeltsExcelV2ExamParser.java`, `OfficialExamSourceProfile.java`, `backend/src/test/java/com/multilingo/backend/modules/exam/service/IeltsExcelV2ExamParserTest.java`.

Dispatch theo metadata type; đọc header TOEIC 16 cột và IELTS 20 cột/A–H; xử lý merged cells theo scope; IDs/order ổn định; map options/keys/types/sections; source profile chỉ áp dụng khi checksum khớp. Preview chỉ tạo draft/issues theo sheet/cell/question; không evaluate formula/tải media.

Test: `.\mvnw.cmd '-Dtest=IeltsExcelV2ExamParserTest,ExcelV2ExamParserTest,ExamParserServiceTest' test`. Bao phủ count 200/82, 8 options, missing header, formula/error cell, group boundary, multi-answer và Writing image. AC: canonical không còn metadata-only options.

### Task 3: OFFICIAL-03 — Publication validator và versioned bundles

Sửa `ExamPublicationValidator.java`, `ExamDatasetBundle.java`, `AdminExamServiceImpl.java`. Tạo `IeltsAcademicPublicationValidator.java`, `OfficialExamDatasetRegistry.java` trong `backend/src/main/java/com/multilingo/backend/modules/exam/`.

Hỗ trợ IELTS mà không phá ETS schema v1; bundle v2 cho hai registry keys, provenance và explanation state PARTIAL/COMPLETE. Gate create/update/publish/export; kiểm tra IDs, answer/options, pair metadata, passage/media/counts. Thiếu IELTS explanation được phép; missing answer/passage không được.

Tests: `ExamPublicationFlowTest`, `DefaultExamDatasetServiceTest`, validator/bundle tests mới. AC: chỉ nội dung đủ điều kiện được publish; schema v1 vẫn đọc được.

### Task 4: OFFICIAL-04 — Paired grading và Practice contract

Sửa `GradingKey.java`, `SnapshotGradingKeyExtractor.java`, `DbGradingAdapter.java`, `AttemptGradingInputFactory.java`, `ObjectiveGradingServiceImpl.java`, `PracticeFeedbackRequest.java`, `PracticeFeedbackResponse.java`, `PracticeFeedbackRequestValidator.java`, `PracticeFeedbackEvaluator.java` dưới `backend/src/main/java/com/multilingo/backend/modules/testing/`.

Tạo `IeltsAnswerGroupEvaluator.java`, `IeltsAnswerGroupEvaluatorTest.java`, `PairedPracticeFeedbackContractIT.java` dưới testing packages.

Đưa answer_group qua grading snapshot; evaluate cả cặp ổn định; Practice cần đúng hai IDs cùng scope/options và trả verdict/score cho cả hai, không ghi DB, giữ chặn MOCK_TEST. Review dùng flags persisted. Câu độc lập giữ nguyên.

Test gồm đảo thứ tự, partial credit, duplicate, blank, invalid/off-scope IDs; IELTS raw 80, TOEIC 200. AC: submit và Practice thống nhất.

### Task 5: OFFICIAL-05 — Builder/frontend canonical round-trip

Sửa `frontend/src/features/exams/utils/examContentMapping.ts`, `frontend/src/features/exams/pages/admin/ExamBuilder.tsx`, `ExamBuilderPage.tsx`, `frontend/src/features/exam/types/exam.types.ts`, `api.types.ts`, `api/practiceFeedbackContract.ts`, `hooks/usePracticeFeedback.ts`, `pages/WorkspacePage.tsx`.

IELTS/TOEIC dùng backend preview; mapper giữ part IDs, durations, media, answer_group và keys; không quay lại `metadata.options`; paired feedback invalidate cả cặp; labels audio-only A–D/A–C; thiếu explanation có nhãn đúng.

Tests mới dưới `frontend/src/features/exams/__tests__/` cho mapping/import/save/reload; cập nhật `frontend/src/features/exam/__tests__/` cho Practice/workspace. AC: editor round-trip canonical.

### Task 6: OFFICIAL-06 — Bundle artifacts và media audit

Tạo `backend/src/main/resources/datasets/exams/cambridge-ielts-20-test-1.v1.json`, `ets-2024-test-1.v2.json`, `docs/datasets/official-exams-media-audit.md`, `backend/src/test/java/com/multilingo/backend/modules/exam/service/OfficialExamDatasetTest.java`.

Bundle tạo từ canonical data đã kiểm tra, không từ DB snapshot lỗi; checksum canonical; IELTS explanation PARTIAL. Kiểm tra 8 audio + 15 ảnh: tải/MIME/playback-render/CORS/Part và xác nhận bằng người; ghi approval reference. Không để lọt answer clues, `metadata.options`, placeholder `44`, DB IDs.

AC: đủ 82/200 câu, không placeholder/leak. Media chưa xác minh hoặc quyền chưa rõ phải ghi BLOCKED và không đánh dấu dataset publish-approved.

### Task 7: OFFICIAL-07 — Opt-in seed và publish

Sửa `DefaultExamDatasetService.java`, `DefaultExamDatasetRunner.java`, `MockDataSeeder.java`, `backend/src/main/resources/application.properties`.

Seed disabled mặc định; publish-approved false. Validate cả bundle trước transaction; stable code; same checksum skip; khác checksum conflict; atomic rollback; mock seeder có flag riêng và không tranh chấp. Publish chỉ khi được bật rõ ràng và gate duyệt đạt. Old mini/invalid exams chỉ unpublish bằng code/fingerprint đã xác minh tại target DB; không hardcode ID/attempt.

Tests trên DB thử nghiệm riêng: disabled, first run, repeat, conflict, second-bundle failure, rollback, publish, concurrent seed. Không chạy trên DB developer hiện hữu. AC: atomic/idempotent/non-overwriting.

### Task 8: OFFICIAL-08 — Integration regression và handoff

Tạo `backend/src/test/java/com/multilingo/backend/modules/exam/service/OfficialExamsContractIT.java`, `OfficialCatalogPostgresIT.java`, `frontend/src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx`. Cập nhật plan/handoff.

Kiểm tra seed→library→start→workspace→submit→result/review; exact counts; no solution/clue leak; Practice chỉ PRACTICE; historical snapshot bất biến khi source sửa/unpublish; Writing Task 1 structured media qua grader mock; browser media/mobile kiểm tra. Chạy focused backend, focused+full frontend, lint/build, `git diff --check`; ghi AC/test evidence và residual issues.

## AC / regression gates

AC-01 hai bundle tái tạo DB; AC-02 counts 200 và 82 (80 objective+2 Writing); AC-03 canonical schema; AC-04 paired score/no duplicate; AC-05 no answer leak; AC-06 missing explanation policy; AC-07 media/passage/group boundaries; AC-08 atomic/idempotent/no overwrite; AC-09 builder roundtrip; AC-10 immutable historical attempts.

Không chạy `GenerateTemplateTest` (ghi workbook). PostgreSQL verification chỉ dùng DB/schema thử nghiệm riêng. Không ghi vào DB developer hiện tại. Không commit/push.

## Lệnh nghiệm thu cuối

Backend focused:

```powershell
.\mvnw.cmd '-Dtest=OfficialExam*,OfficialExamsContractIT,OfficialCatalogPostgresIT,IeltsExcelV2ExamParserTest,IeltsAnswerGroupEvaluatorTest,PairedPracticeFeedbackContractIT,ExcelV2ExamParserTest,ExamParserServiceTest,ExamPublicationFlowTest,DefaultExamDatasetServiceTest,ExamDatasetIntegrationTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT' test
```

Frontend:

```powershell
npm test -- src/features/exams/__tests__ src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx
npm test
npm run lint
npm run build
```

Root: `git diff --check`, `git status --short`. Chỉ báo PASS khi có output mới.

## Execution status — 2026-10-17

OFFICIAL-01–05 đã triển khai; OFFICIAL-07 đã triển khai với seed/publish mặc định tắt; OFFICIAL-08 có regression H2/frontend nhưng chưa đủ điều kiện nghiệm thu toàn bộ. OFFICIAL-06 bị BLOCKED: không tạo runtime JSON bundle nào vì Cambridge có bảy ô nguồn chứa văn bản không xác minh (`F42`, `F46`, `F51`, `F56`, `F69`, `F74`, `F79`), còn media/playback/CORS/quyền sử dụng chưa được kiểm tra. Vì vậy không thể công bố hai bộ đề là “chính thức” trong lượt này. Xem evidence và test results trong `OFFICIAL-EXAMS-handoff.md`.
