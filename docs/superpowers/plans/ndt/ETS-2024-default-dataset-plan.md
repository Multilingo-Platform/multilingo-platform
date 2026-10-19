# Import ETS 2024 Test 1 và chuẩn hóa bộ dữ liệu mặc định

Ngày: 2026-10-13. Baseline: `3dee084`, `feature/TV3-00-contract-audit`.

## Spec được duyệt

Excel → parser/validation → draft DB → biên tập → validated JSON bundle → opt-in seed.
Excel gốc: `E:/Downloads/ETS_2024_Test_1 (1).xlsx`, SHA-256 `5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce`.
Nguồn có 7 Part, 50 nhóm, 200 câu. Kiểm tra POI khi triển khai sửa lại phân tích ban đầu: `44` là shared-string index trỏ tới chuỗi rỗng, không phải giá trị ô. Thực tế thiếu 66 đáp án, 200 giải thích và 49 context. Part 1–2 có lựa chọn đọc qua audio, nên giữ option ID kể cả khi text trống; Part 2 chỉ có ba lựa chọn vì D trống.
Không tự bổ sung nội dung, xác nhận đáp án hoặc đưa dữ liệu chưa duyệt vào runtime datasets.

## Tasks

### Task 1: Parser Excel v2
- [x] POI fixtures và tests RED/GREEN: merged cells, headers, Part/Group boundaries, IDs, formula rejection; regression parser legacy.
- [x] `ExcelV2ExamParser`, `ExamImportPreviewResponse`; giữ parser legacy riêng.
- [x] Metadata TOEIC_LR/en, Listening 45/Reading 75, Part 1–7, SINGLE_CHOICE và option ID.
- [x] Preview đủ câu và vị trí lỗi, không tải media hoặc ghi DB; kiểm chứng trực tiếp workbook gốc.

### Task 2: Nháp và publication gate
- [x] Preview API ADMIN/CONTENT_CREATOR; import trả ID như cũ, Excel v2 luôn unpublished.
- [x] `ExamContentNormalizer`, `ExamPublicationValidator`; canonicalize TOEIC builder khi lưu.
- [x] Transaction, duration/order; gate create/update/PATCH publish và structure gate cho nháp.
- [x] Tests publication flow, normalizer, access control và rollback H2.

### Task 3: Published-only start
- [x] ExamAdapter published snapshot method; Db adapter kiểm tra published.
- [x] createAttempt không fallback bypass; fixture chỉ dev/test.
- [x] Tests draft rejected, published accepted, existing attempts unaffected, no solution leaks.

### Task 4: Builder round-trip
- [x] Excel v2 dùng preview backend; canonical/editor mapping, stable IDs/media; giữ importer non-TOEIC.
- [x] Nháp, loading, issues theo cell/question; không HTML interpolation hoặc solution logs.
- [x] DOMPurify ở preview rich text; focused tests và build; edit/save/reload round-trip qua HTTP mock.

### Task 5: Content approval và bundle
- [x] Source audit giữ checksum và danh sách ô cần sửa.
- [ ] Human editor hoàn thiện answers/context/explanations, Part 2 options và media/rights.
- [x] Export canonical bundle có version/checksum, không DB IDs/token/attempt; kiểm chứng bằng dữ liệu tổng hợp.
- [ ] Chỉ thêm `datasets/exams/ets-2024-test-1.v1.json` sau khi nội dung đạt gate.

### Task 6: Opt-in seed và integration
- [x] `DefaultExamDatasetService`, `DefaultExamDatasetRunner`, enabled=false mặc định.
- [x] Classpath bundles, stable code, atomic writes; skip identical, conflict without overwrite.
- [x] Seed unpublished; tests checksum, repeated/concurrent seed, rollback H2.
- [x] Real DB adapter/snapshot/grading/review regression trên H2; PostgreSQL smoke chưa chạy.

Trạng thái cuối: phần mềm Tasks 01–04 và hạ tầng 06 đã kiểm chứng; Task 05 **BLOCKED_CONTENT**. Chưa có runtime ETS bundle và không tuyên bố bộ đề đã hoàn chỉnh. Evidence chi tiết trong handoff.

## Acceptance criteria

AC-01 đủ Part/Group/questions, deterministic IDs/order.
AC-02 draft-only, content issues located.
AC-03 option ID keys, consistent grading/review.
AC-04 invalid publish and draft attempt start rejected.
AC-05 editor round-trip preserves context/solutions/media.
AC-06 opt-in atomic idempotent non-overwriting seed.
AC-07 workspace solution-safe and historical snapshots immutable.
AC-08 no formula/HTML execution or backend media downloads.

## Verification và constraints

RED → GREEN từng task; focused backend, DbExamAdapterSnapshotTest, SubmitAttemptImmutableKeysTest, ExamReviewContractIT; frontend tests/lint/build; git diff --check.
Không chạy GenerateTemplateTest vì ghi workbook. PostgreSQL chỉ disposable test DB.
Không sửa dependencies/schema, engine chấm, autosave/submit contracts, existing attempts; không commit/push; giữ uncommitted/untracked work.
Task 5 cần nguồn nội dung bổ sung, không được đánh dấu hoàn tất chỉ bằng tests phần mềm.
