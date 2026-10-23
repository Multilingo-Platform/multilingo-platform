# NLTV-EXAM-INGESTION — Nạp đề NLTV mẫu vào hệ thống

**Ngày:** 2026-10-20  
**Trạng thái:** IN PROGRESS  
**Baseline:** `ffd329f`, branch `feature/TV3-00-contract-audit`.

## Mục tiêu và nguồn

Chuẩn hóa workbook NLTV thành bundle `ExamDatasetBundle` schema v2, seed có chủ đích và dùng được qua Practice/Mock, autosave/resume, submit, result/review. Không thêm DB schema, endpoint hay dependency.

Workbook `backend/Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu.xlsx`, SHA-256 `b93b2d2cf13d8139faeabc133c271deec555f12368125e059fb54e9ce167f224`, có 9 Part, 27 nhóm, 107 câu/yêu cầu: 105 objective + 2 essay. Counts theo Part: `15/14/14/12/16/24/10/1/1`. Nguồn có 5 audio thiếu, F97 đã điền đáp án chính tả, và một ảnh HTML ở F107.

Mã dataset `nltv-sample-test-1`, version `1`, exam code `NLTV-SAMPLE-T1-V1`, type `NLTV`, language `vi`. Ba section LISTENING/READING/WRITING, mỗi section 60 phút; Mock tổng 180 phút. File runtime dùng hậu tố `.v2.json` cho schema bundle v2.

## Quy tắc dữ liệu

- Câu hỏi định danh bằng `(partNumber, question_id)`; `q_001` có thể lặp giữa các Part. Group ID ổn định `nltv-p<part>-g<ordinal>`.
- `MULTIPLE_CHOICE` một đáp án → `SINGLE_CHOICE`; `WRITING_ESSAY` → `ESSAY`; options/key/explanation ở canonical question.
- Part 7 giữ 10 blank khách quan nhưng public passage chỉ chứa marker trống. F97 chỉ được sửa bằng phép thay chính xác `(n) <answer key>` sau khi khớp đúng một occurrence cho cả 10 đáp án; lỗi thì dừng.
- Essay key null; metadata `min_words` là 120 và 200. Không dùng mô tả trong ô key làm bài mẫu.
- Năm Reading passage giữ cấp group. Ảnh F107 chuyển sang `shared_media`, bỏ thẻ ảnh khỏi prompt HTML.
- Workspace/start không trả answer key, explanation hoặc đoạn chính tả đã điền. Attempt lịch sử không bị sửa.

## Tasks tuần tự

### NLTV-01 — Khóa nguồn và audit

- Tạo `docs/datasets/nltv-sample-test-1-source-audit.md`, fixture `backend/src/test/resources/datasets/official-source/nltv-sample-test-1.xlsx`, và `NltvWorkbookAuditTest`.
- Xác minh checksum, sheets/headers, 107 rows, Part/group counts, IDs và answer keys. Lập ô nguồn → canonical IDs; audit F97/F107 và audio thiếu.
- Nghiệm thu: workbook gốc không đổi, audit tái lập được.

### NLTV-02 — Parser v2 và preview

- Tạo `NltvExcelV2ExamParser`, `NltvExamSourceProfile`, tests; nối dispatch trong `ExamParserService` theo metadata `NLTV`.
- Resolve merged cells theo group/part, kiểm tra formula/error/header, map canonical request, giữ passage group, áp dụng hiệu chỉnh theo checksum. Không tải URL/audio.
- Thiếu audio trả issue và `canPublish=false`; preview/import vẫn cho lưu draft.
- Nghiệm thu: 105 objective, 2 essays, đúng 9 Part và không lộ F97.

### NLTV-03 — Normalizer, publication gate, duration

- Thêm `NltvPublicationValidator`; tích hợp `ExamContentNormalizer`, `ExamPublicationValidator`, `ExamDatasetBundle`, `AdminExamServiceImpl`.
- Validate shape/count/options/key/group/media/essay metadata ở create/update/publish/export. Thêm duration NLTV 180; section 60/60/60. Không đổi semantics cho exam type khác.
- Nghiệm thu: draft lưu được nhưng mọi đường publish bị chặn khi audio thiếu hoặc dữ liệu lỗi.

### NLTV-04 — Media và bundle tái lập

- Tạo `docs/datasets/nltv-sample-test-1-media-audit.md`, manifest bổ sung, `NltvDatasetBundleTool` và tests. Bundle đích: `backend/src/main/resources/datasets/exams/nltv-sample-test-1.v2.json`.
- Nhận/xác minh 5 audio gốc, đúng Part; kiểm tra ảnh Writing. Manifest ghi URL, checksum, MIME, duration, approval reference. Tool nhận explicit source/media/output và không truy cập mạng.
- Nghiệm thu: deterministic bundle, đúng source hash và đủ media.
- **Release gate BLOCKED:** chưa có audio gốc; không dùng TTS hoặc metadata giả.

### NLTV-05 — Registry và seed opt-in

- Sửa `OfficialExamDatasetRegistry`, `DefaultExamDatasetRunner`, cấu hình runtime và tests. Đăng ký key/code/version/source/counts; path bundle là allowlist code-owned.
- Giữ seed tắt mặc định và giữ danh sách seed đang dùng; test skip/conflict/rollback/idempotency.
- Nghiệm thu: seed có chủ đích, không ghi đè; bundle được kiểm tra toàn bộ trước transaction ghi.

### NLTV-06 — Builder, library, start

- Sửa canonical mapping, `ExamBuilder`, `ExamBuilderPage`, `ExamLibrary`, `StudentExamServiceImpl` và tests.
- Giữ literal `NLTV`, language `vi`, skills/duration tường minh; backend preview là nguồn parse; round-trip IDs/media/options/keys/explanations/min_words.
- Nghiệm thu: đề nháp không hiển thị hoặc khởi chạy cho học viên; alias cũ vẫn tương thích.

### NLTV-07 — Snapshot và workspace

- Sửa có mục tiêu `DbExamAdapter`, `TestAttemptServiceImpl`, `WorkspacePage`, `WritingPromptContent`, `examPartUtils`; thêm workspace contract tests.
- Snapshot có language/section name/skill. Kiểm tra audio, năm passage, 10 fill-ins, hai essay, word limits, locks 180 phút và autosave/resume. Không lộ solutions.
- Nghiệm thu: cả Practice và Mock dùng snapshot đúng; không sửa autosave/submit contracts.

### NLTV-08 — Grading, review và AI tiếng Việt

- Thêm `NltvGradingReviewContractIT` và `NltvPracticeAiContractIT`; chỉ sửa production nếu regression chứng minh lỗi riêng NLTV.
- Verify 105 objective (gồm 10 dictation), IDs theo Part, 2 essay, submitted-only review, quyền và snapshot lịch sử. Dictionary/Flashcard/Hints/generic writing dùng code TV3-MULTILINGUAL đã review, qua provider giả.
- **Dependency gate BLOCKED** cho đến khi TV3-MULTILINGUAL PASS. Không quy đổi thành bậc năng lực.

### NLTV-09 — PostgreSQL, browser, handoff

- Thêm PostgreSQL contract và `docs/testing/NLTV-EXAM-INGESTION-smoke.md`; cập nhật audit/handoff.
- Dùng DB thử nghiệm `official_exams_test`; smoke 375/768/1366px; ghi PASS/FAIL/SKIP và residual risks. Rollback bằng unpublish, không xóa attempts.
- Nghiệm thu: không đánh dấu release PASS nếu audio, DB hoặc dependency AI chưa đạt.

## Acceptance criteria

1. Bundle có đúng 3 sections, 9 Part, 27 group, 107 rows và counts `15/14/14/12/16/24/10/1/1`.
2. Canonical types/options/keys hợp lệ; ID trùng giữa Part không va chạm.
3. F97 không lộ answers; workspace/start không lộ answer keys/explanations.
4. Audio và ảnh được xác minh, đúng scope; thiếu audio không thể publish.
5. Seed mặc định off, idempotent, atomic, không ghi đè.
6. Practice/Mock, deadline, section locks, autosave/resume/submit và historical snapshots giữ đúng behavior.
7. Raw objective total là 105; essays chỉ vào writing grading.
8. Highlight/Dictionary/Hints/Flashcard tuân thủ scope và language policy đã duyệt.

## Verification

Backend focused: `.\mvnw.cmd '-Dtest=Nltv*,ExamParserServiceTest,OfficialExamDatasetRegistryTest,ExamDatasetBundleV2Test,DefaultExamDatasetServiceTest,DefaultExamDatasetRunnerTest,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest,ExamReviewContractIT,PracticeFeedbackContractIT' test`.

Broad backend: `.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test` (không gọi đây là full suite nguyên bản; loại test ghi workbook). Frontend: focused NLTV tests, `npx vitest run --maxWorkers=2`, `npx tsc -b --pretty false`, `npm run lint`, `npm run build`. Root: `git diff --check`, `git status --short`. PostgreSQL skip không được tính PASS; automated tests không gọi Gemini/CDN.

Không commit hoặc push. Giữ mọi thay đổi có sẵn trước task.

## Revision R1 — Bốn audio gốc và phát hành không chấm AI Writing (2026-10-21)

Revision này thay thế các giả định phát hành tương ứng ở kế hoạch ban đầu, không sửa lịch sử.

- Nguồn mới `Đề_thi_Đánh_giá_Năng_lực_Tiếng_Việt_(NLTV)_Mẫu (1).xlsx`, SHA-256 `e155c3b007cd5f51cf5a73f8652e7d7274aa4a4953cf0c552b05c670a3582d13`, được chủ dự án cung cấp để nạp. Giữ fixture nguồn cũ và chỉ chấp nhận hai checksum đã đăng ký.
- Chỉ Part 1–4 cần bốn audio gốc. Part 7 là bài Writing dùng word bank để điền 10 chỗ trống, không có audio. Hiệu chỉnh hai hướng dẫn Part 7 chỉ khi checksum và nội dung nguồn khớp; giữ nguyên word bank và khóa đáp án ở snapshot riêng.
- Phân bố giữ nguyên 3 sections, 9 Parts, 27 nhóm, 107 mục: `15/14/14/12/16/24/10/1/1`; objective 105, essay 2; mỗi section 60 phút, Mock 180 phút.
- Phát hành trước khi có AI Writing tiếng Việt: lưu nguyên văn hai essay; không gọi Gemini, không reserve quota, điểm AI là `null` và UI nêu rõ chưa hỗ trợ chấm Writing tiếng Việt. Không chờ Dictionary/Hints/Writing AI đa ngôn ngữ; thao tác AI Anh→Việt bị chặn trên đề nguồn `vi`.
- Chỉ tạo bundle runtime sau khi xác minh đủ bốn audio Part 1–4, ảnh Writing, nội dung/Part mapping và quyền dùng nguồn. HTTP 206/MIME không tự nó chứng minh phát được hay ánh xạ đúng Part.
- Seed/publish chỉ đúng `NLTV-SAMPLE-T1-V1`, bằng lựa chọn key tường minh; seed mặc định vẫn tắt và không đổi danh sách bundle mặc định. Kiểm tra DB hiệu lực và mã/checksum trước ghi; giữ nguyên attempts và dữ liệu lịch sử.

### R1 — Các task triển khai

1. **NLP-01:** đăng ký checksum mới, bỏ yêu cầu audio Part 7, sửa instruction theo nguồn đã xác nhận; RED/GREEN parser và validator.
2. **NLP-02:** xác minh bốn audio Part 1–4 và ảnh Writing; ghi hash/MIME/duration/playback/Part mapping; asset tạm ngoài repo.
3. **NLP-03:** đăng ký NLTV trong registry/bundle v2, build canonical bundle tái lập ở target rồi xác nhận runtime bundle khớp.
4. **NLP-04:** regression Part 7 word bank/10 blanks và hai essay chưa chấm; bảo đảm không phát sinh AI request/quota cho language `vi`.
5. **NLP-05:** allowlist bundle và PostgreSQL regression seed/publish idempotent, đúng đề.
6. **NLP-06:** xác định DB ứng dụng bằng cấu hình/process read-only; nếu trùng code/checksum rules, seed và publish riêng NLTV, kiểm tra library/browser; nếu DB/mã xung đột hoặc media gate thiếu thì dừng trước ghi.

Không commit/push. Mỗi task ghi RED/GREEN, files, tests, AC và blocker vào handoff append-only.
