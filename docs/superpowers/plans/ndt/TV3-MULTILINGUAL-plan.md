# TV3-MULTILINGUAL — Đa ngôn ngữ cho luồng thi, Practice và AI

**Ngày:** 2026-10-20  
**Trạng thái:** IN_PROGRESS  
**Baseline:** `ffd329f`, branch `feature/TV3-00-contract-audit`.

## Mục tiêu

Hỗ trợ `en, vi, ko, zh, ja, fr, de, es` xuyên suốt TV3. UI hỗ trợ Việt/Anh; ngôn ngữ đề lấy từ snapshot attempt; ngôn ngữ giải thích do người học chọn, mặc định native language hợp lệ rồi đến ngôn ngữ đề. Bổ sung `LANGUAGE_PRACTICE`, Unicode-aware grading/length, Dictionary v2, AI Hints/grading đa ngôn ngữ và feedback lịch sử có rubric discriminator.

Không tự dịch nội dung đề, không sửa kết quả lịch sử, không đưa UI locale vào grading/quyền, không thêm dependency/Speaking, không gọi provider thật trong automated tests, không commit/push.

## Thiết kế chính

- Tách `uiLocale`, `examLanguage` và explanation/feedback language.
- Chuẩn hóa language tag bằng `LearningLanguageCatalog`; không suy ngôn ngữ từ title hoặc audio.
- Snapshot cũ thiếu language vẫn mở core workspace/result/review; AI operation mới fail closed.
- Giữ nguyên contract Hints/Dictionary v1 và job Writing tiếng Anh cũ. Dictionary v2 đóng băng language intent/resolution cùng request ledger.
- `LANGUAGE_PRACTICE` dùng rubric generic `WRITING_GENERIC_V1` (0–10); tiếng Anh hiện có giữ thang/rubric 0–9.
- NFC chỉ dùng trên bản sao so sánh; essay, answer, passage và UTF-16 offsets giữ nguyên.
- Không thay autosave/resume, ownership, quota reservation/refund, deadline, section locks hoặc lịch sử attempt.

## Tasks và thứ tự

Mỗi task theo RED → GREEN → REFACTOR; trước task append `IN_PROGRESS`, sau task append `IMPLEMENTED` cùng files, commands/results và AC mapping.

1. **ML-01 — Language policy/snapshot metadata.** `LearningLanguageCatalog`, testing config/adapters, `WorkspaceResponse`, `TestAttemptServiceImpl`, properties. Tạo shared testing language config, resolver, response context và tests. AC-01/02.
2. **ML-02 — Backend `LANGUAGE_PRACTICE`.** Publication validator, normalizer/admin service, learner library/structure DTO/service/controller/repository. Validate generic content and explicit skills; add language filter. AC-03.
3. **ML-03 — Builder/library/start FE.** Admin builder/mapping, exam library, APIs/types/start picker. Preserve language and require generic skill/duration explicitly. AC-02/03.
4. **ML-04 — Unicode/length/objective grading.** Backend counters/normalizer/grading input/evaluator/summary; FE length utility and renderers. Keep raw text; NFC compare copy; CJK character metric. AC-04/05.
5. **ML-05 — Writing Hints snapshot policy.** Resolver/coordinator/prompt/resources/tests. New operations use attempt source and selected/native explanation; old ledger replay remains frozen. AC-02/06/11.
6. **ML-06 — Dictionary v2/ledger.** Add v2 DTO/controller/service/parser/prompt and nullable ledger `context_json` migration; freeze language policy and preserve v1. AC-06/07/11.
7. **ML-07 — FE AI/Flashcards.** Shared language definitions, selectors, v2 API/normalizer, workspace/Hints/Dictionary/Flashcard components; scope/race/owner checks. AC-06/07/10.
8. **ML-08 — Writing grading.** Rubric policy/registry, submit feedbackLanguage, immutable job context and generic prompt/parser; retain legacy English jobs. AC-05/08/11.
9. **ML-09 — Result/review/Diff history.** Add rubric/language/length metadata, discriminate score validation, preserve historical text/offsets and compatibility. AC-08/09.
10. **ML-10 — TV3 UI i18n vi/en.** Add exam locale resources and migrate TV3 pages/components/hooks/utilities; locale changes preserve workspace/async state. AC-10/12.
11. **ML-11 — Lifecycle integration/handoff.** Provider-fake backend and real FE pipeline tests, separate PostgreSQL gate, browser/IME matrix, final evidence. AC-01–12.

Dependencies: `01→02→03`; `01→04,05,06`; `03,04,05,06→07`; `01,04→08→09`; `03,07,09→10→11`.

## Acceptance criteria

AC-01 eight language tags canonicalized with script/region; no unsupported-English fallback. AC-02 attempt snapshot source and independent explanation/UI language. AC-03 generic exams publish/list/start. AC-04 Unicode objective grading is consistent across Practice/submit. AC-05 CJK length policy. AC-06 Dictionary/Hints scoped to correct languages/context. AC-07 Flashcards use correct owner/language pair. AC-08 Writing rubric/score discriminator. AC-09 historical Diff/Highlight offsets and data preserved. AC-10 UI vi/en changes without losing state. AC-11 replay/quota/job language frozen. AC-12 security, accessibility and lifecycle regression-free.

## Verification

Run task-focused commands from the task checklist. At feature gate: backend `.\mvnw.cmd '-Dtest=*,!GenerateTemplateTest' test` (describe as broad suite excluding workbook writer, not original full suite); frontend `npx vitest run --maxWorkers=2`, `npx tsc -b --pretty false`, `npm run lint`, `npm run build`; PostgreSQL tests only against isolated test DB, and skips are not passes. Finish with `git diff --check` and `git status --short`. Do not call real Gemini in automated tests.
