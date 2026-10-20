# TV3-22 — Handover tổng hợp Regression & Bàn giao TV3

**Tài liệu:** `docs/testing/TV3-22-handover.md`  
**Ngày lập:** 2026-10-19  
**Task:** TV3-22-06 — Final gate, tài liệu và yêu cầu review toàn feature  
**HEAD:** `5b3442efffb7c098b86eb1833408a1903b5d21ff`  
**Nhánh:** `feature/TV3-00-contract-audit`  
**Workbook SHA-256:** `2A9045FE5FAB8562ED675D1EA9991CD476DB32910A5C6507636869FADD8781B8`  
**Trạng thái gate:** **PASS** — Broad 5/5 step PASS trên `.superpowers/tv3-22/20261019_083720Z/` (runner exit 0; frontend full có Vitest audit `VERIFIED_PASS` theo fix R-02), Focused PASS `.superpowers/tv3-22/20261019_083529Z/`. Vòng PASS này đi sau re-FIX G-01/G-02 (vòng 1) và re-FIX R-01–R-04 theo full-feature re-review (vòng 2). Chờ Codex re-review.

---

## 1. Kết luận điều hành

TV3-22 đã hoàn tất regression và tài liệu: focused gate, broad gate, frontend full suite, lint, PostgreSQL thật trên cluster tạm và browser smoke đều có evidence. **Final gate PASS** sau hai vòng re-FIX theo review:

1. ~~**G-01/G-02 (vòng 1)**~~ **đã xử lý:** hai test legacy cập nhật theo snapshot/grading contract; fixture review khai báo type wire `ExamReviewResponse`; broad backend **1.887/0/0/31** và `npm run build` PASS.
2. ~~**R-01–R-04 (vòng 2 — full-feature re-review)**~~ **đã xử lý:** ma trận traceability viết lại theo approved plan với 76 đường dẫn kiểm chứng tồn tại (R-01); Vitest audit áp dụng cho cả Broad `npm test` + 10 probes PASS (R-02); test snapshot immutability thực sự đột biến nested question trước submit (R-03); số screenshot bàn giao ghi 73 referenced + 9 unreferenced và docs đồng bộ (R-04).

Tất cả là test/tooling/documentation changes — không production behavior/API/schema change. Ba finding browser F-01–F-03 vẫn là P2 residual out-of-scope.

---

## 2. Phạm vi đã bàn giao

| Task | Deliverable | Trạng thái |
|---|---|---|
| TV3-22-01 | Traceability matrix, regression runner, evidence an toàn | IMPLEMENTED |
| TV3-22-02 | Backend lifecycle/access/grading/snapshot regression | IMPLEMENTED |
| TV3-22-03 | Frontend lifecycle, result/review/feedback, TOEIC R1 | IMPLEMENTED (reviewer PASS) |
| TV3-22-04 | PostgreSQL regression trên database riêng | IMPLEMENTED (reviewer PASS) |
| TV3-22-05 | Browser smoke responsive/accessibility | IMPLEMENTED (3 P2 findings) |
| TV3-22-06 | Final gate, README/matrix/handover, review request | **PASS (chờ final review)** |

Tài liệu liên quan:

- `docs/testing/TV3-22-regression-matrix.md` — traceability và kết quả gate.
- `docs/testing/TV3-22-browser-smoke.md` — browser evidence, mock boundary và checklist staging.
- `docs/superpowers/plans/ndt/TV3-22-handoff.md` — lịch sử thực thi/review theo subtask.
- `backend/src/main/java/com/multilingo/backend/modules/testing/README.md` — README module đã cập nhật theo code hiện tại.

---

## 3. Kết quả gate

### 3.1. Bảng tổng hợp

| Gate | Command / phạm vi | Kết quả | Evidence |
|---|---|---|---:|
| Focused | `run-tv3-regression.ps1 -Gate Focused` | **PASS** — backend 199, frontend 130; 0 failure/error/skip | `.superpowers/tv3-22/20261019_083529Z/` |
| Backend broad | `mvnw.cmd clean test -Dtest=*,!GenerateTemplateTest` | **PASS** — 1.887 run / 0 failures / 0 errors / 31 skipped; `PASS_WITH_DOCUMENTED_SKIPS` | `.superpowers/tv3-22/20261019_083720Z/01_backend_broad.log` |
| Frontend full | `npm test -- --maxWorkers=2` | **PASS** — 86 files / 1.597 tests; manifest `AuditVerdict=VERIFIED_PASS`, TestsRun 1597, Skipped 0 (audit Vitest áp dụng cho `npm test` — R-02) | `.superpowers/tv3-22/20261019_083720Z/02_frontend_full.log` |
| Frontend lint | `npm run lint` | **PASS** — exit 0; 56 warnings, bằng baseline tổng | `.superpowers/tv3-22/20261019_083720Z/03_frontend_lint.log` |
| Frontend build | `npm run build` | **PASS** — exit 0, `tsc -b` + `vite build` | `.superpowers/tv3-22/20261019_083720Z/04_frontend_build.log` |
| PostgreSQL | `run-tv3-regression.ps1 -Gate Postgres` | **PASS** — 25 + 5 tests; 0 skip | `.superpowers/tv3-22/20261019_033618Z/` |
| Hygiene | `git diff --check`, workbook hash pre/post run | **PASS** — exit 0; hash khớp baseline; manifest+summary đầy đủ | `.superpowers/tv3-22/20261019_083720Z/05_git_diff_check.log` |

Không cộng số test giữa các gate: focused, broad, frontend full và PostgreSQL là các lần chạy/phạm vi khác nhau. Broad chạy trọn 5 step trong runner, runner exit 0; Vitest audit được enforce trên cả Focused (`npx vitest`) và Broad (`npm test`) cùng 10 regression probes in-memory (`-RunVitestAuditProbes`). Các vòng gate cũ (20261019_032920Z NEED_FIX, 043833Z PASS vòng 1) và các lần trung gian FAIL từ môi trường đều lưu trong handoff để truy vết.

### 3.2. Backend broad

- Lệnh thực tế: `.\mvnw.cmd clean test "-Dtest=*,!GenerateTemplateTest"`.
- Kết quả Maven: `Tests run: 1887, Failures: 0, Errors: 0, Skipped: 31`, `BUILD SUCCESS`.
- 31 skip nằm trong 10 lớp allowlist do runner kiểm tra khớp (fail-closed) gồm: 6 TV3 PG suites qua `TV3_PG_TEST_URL` (24 tests), `AttemptListeningPlaybackPostgresIT` (4), `ListeningPlaybackStartConcurrencyPostgresIT` (1), `OfficialCatalogPostgresIT` (1), `ETSWorkbookAuditTest` opt-in `ets.source` (1); PostgreSQL được chạy riêng ở mục 3.3. Any skip khác bị từ chối `REJECTED_UNEXPECTED_SKIPPED_TESTS`.
- `GenerateTemplateTest` bị loại rõ khỏi broad vì test ghi workbook mẫu.

Hai failure thời điểm lần chạy đầu (đã xử lý trong re-FIX 2026-10-19):

| Test | Trước khi fix | Sau khi fix |
|---|---|---|
| `SubmissionServiceTest.gradeAttempt_withWriting_statusAiGrading` | `GRADING_FAILED` (expected `AI_GRADING`) | PASS — fixture tạo attempt: ESSAY có `prompt` không rỗng, section resolve `skill: WRITING`, essay >10 từ được autosave để job READY freeze; bật `writingGradingProperties.setEnabled(true)` cho `AI_GRADING` (restore trong `finally`). |
| `ResultFinalizationServiceTest.finalize_sectionWithEssay_triggersAiGrading` | `COMPLETED` (expected `AI_GRADING`) | PASS — fixture giữ nguyên snapshot keys gốc (`examLanguage=en`) bằng cách copy `attempt.getExamSnapshot()` và chỉ thay `sections`; section resolve WRITING + autosave như trên. |

### 3.3. PostgreSQL

- Cluster PostgreSQL **17.9** tạo tạm trên loopback, ba database riêng: `tv3_regression_test`, `tw03_playback_test`, `tw04_playback_test`.
- Không dùng database local/staging/người dùng; cluster và data đã dừng/xóa sau chạy.
- TV3 suites: **25 tests, 0 failure/error/skip** — `ResultScorePrecisionPostgresIT`, `ExamReviewPostgresIT`, `WritingHintPostgresIT`, `WritingHintPostgresTransactionIT`, `WritingGradingPostgresIT`, `WritingGradingPostgresTransactionIT`.
- Playback suites: **5 tests, 0 failure/error/skip** — `AttemptListeningPlaybackPostgresIT`, `ListeningPlaybackStartConcurrencyPostgresIT`.
- Evidence: `.superpowers/tv3-22/20261019_033618Z/` (`01_postgres_tv3_suites.log`, `02_postgres_playback_suites.log`, manifest, summary).

### 3.4. Frontend full/lint/build

- Full suite: **86/86 files, 1.597/1.597 tests PASS**; stderr có cảnh báo jsdom `HTMLMediaElement.pause()` không implement, không phải test failure.
- Lint: **exit 0, 56 warnings**. Tổng bằng baseline 56; không có warning mới làm tăng tổng.
- Build: **PASS exit 0** (`tsc -b` + `vite build`) sau khi fixture review tại `tv3LifecycleContract.test.tsx` khai báo type wire `ExamReviewResponse` cho `lifecycleReview`/`lifecycleEmptyOptionReview` (`frontend/src/features/exam/__tests__/fixtures/tv3Regression.ts`). Không thay đổi test driver; test này cũng PASS trong focused (130) và full (1.597).

---

## 4. Findings

| ID | Mức | Vị trí | Tác động | Đề xuất fix |
|---|---|---|---|---|
| F-01 | P2 | `frontend/src/features/exam/components/workspace/WorkspaceFrame.tsx:33` | Instruction bị clip với token cực dài không khoảng trắng; nội dung thường PASS. | `overflow-wrap:anywhere` + `min-w-0`; regression browser. |
| F-02 | P2 | `frontend/src/features/exam/components/result/writing/WritingFeedbackTask.tsx:34` | Horizontal scroll khi label Writing cực dài. | `min-w-0`/`max-w-full` cho wrapper/header. |
| F-03 | P2 | `frontend/src/features/exam/components/review/PartReviewContent.tsx:135` | Header review mở rộng quá viewport với title cực dài. | `min-w-0` cho header + wrap/ellipsis cho `h2`. |

**G-01/G-02 (vòng 1) và R-01–R-04 (vòng 2) đã xử lý** — chi tiết fix và fresh evidence: `docs/superpowers/plans/ndt/TV3-22-handoff.md` (mục re-FIX TV3-22-06 vòng 1 và vòng 2); Broad `20261019_083720Z`, Focused `20261019_083529Z`. Vòng 2 gồm: viết lại ma trận traceability theo approved plan (R-01), Vitest audit cho `npm test` + probes `-RunVitestAuditProbes` (R-02), siết test snapshot immutability đột biến deep nested content (R-03), đồng bộ số screenshot và evidence Broad/Focused (R-04). Vòng 1 cũng gồm tooling runner: parser Surefire chấp nhận `[WARNING]/[ERROR]`, skip audit gate-aware fail-closed (allowlist 10 lớp/31 skips), tail-print StrictMode fix. No production behavior/API/schema/dependency change.

Không có P0/P1 production runtime được xác nhận trong TV3-22-06. F-01–F-03 chỉ tái hiện với stress probe token cực dài; text dài tự nhiên, Unicode và HTML-like đã PASS.

---

## 5. Acceptance criteria

| AC | Trạng thái | Bằng chứng / giới hạn |
|---|---|---|
| AC-01 | **PASS** | Ma trận traceability TV3-04–21 + R1, test owner và evidence path. |
| AC-02 | **PASS** | Backend/frontend lifecycle, autosave, submit, result/review; focused gate. |
| AC-03 | **PASS** | Practice feedback/Hints contract, quota/idempotency, fake provider. |
| AC-04 | **PASS** | Writing snapshot → job → persisted feedback → UI/Diff; PG grading suites. |
| AC-05 | **PASS** | Ownership/live-attempt/snapshot/answer-key tests ở HTTP/security thật. |
| AC-06 | **PASS** | PostgreSQL 17.9 riêng, 3 DB, 30 test, 0 skip. |
| AC-07 | **PASS** | TOEIC R1 + browser smoke 4 viewport; 3 P2 residual. |
| AC-08 | **PASS** | Broad 5/5 step PASS (`20261019_083720Z`, runner exit 0): broad backend 1.887/0/0/31 `PASS_WITH_DOCUMENTED_SKIPS`; frontend full 1.597 với Vitest audit `VERIFIED_PASS` (R-02); lint exit 0; build exit 0. |
| AC-09 | **PASS** | Handover + review request đầy đủ; matrix/handover đồng bộ evidence mới (R-01/R-04); chờ Codex re-review. |

---

## 6. Hygiene và file scope

- `git diff --check`: **exit 0**, không có whitespace error; Git chỉ cảnh báo LF→CRLF cho `ToeicWorkspaceContract.test.tsx`.
- `git status --short`: chỉ các file TV3-22 đang được handoff, gồm test/docs/runner; không có thay đổi production ngoài phạm vi.
- Workbook `backend/Exam_Template.xlsx`: SHA-256 khớp baseline `2A9045FE...8781B8`.
- Không commit, không push.
- `.superpowers/` và evidence browser/PG nằm trong vùng ignore; không chứa secret/token/password.

Cross-check cuối cùng:

```powershell
git diff --check
git status --short
Get-FileHash backend/Exam_Template.xlsx -Algorithm SHA256
```

---

## 7. Cách chạy lại

### 7.1. Focused

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/testing/run-tv3-regression.ps1 -Gate Focused
```

### 7.2. Frontend full/lint/build

```powershell
cd frontend
npm test -- --maxWorkers=2
npm run lint
npm run build
```

### 7.3. Backend broad

```powershell
cd backend
.\mvnw.cmd clean test "-Dtest=*,!GenerateTemplateTest"
```

### 7.4. PostgreSQL gate

Tạo cluster/database tạm, đặt các biến sau trong shell (không ghi giá trị thật vào tài liệu), rồi chạy:

```powershell
$env:TV3_PG_TEST_URL="jdbc:postgresql://127.0.0.1:<port>/<tv3_db>"
$env:TV3_PG_TEST_USER="<user>"
$env:TV3_PG_TEST_PASSWORD="<password>"
$env:TW03_POSTGRES_TEST_URL="jdbc:postgresql://127.0.0.1:<port>/<tw03_db>"
$env:TW03_POSTGRES_TEST_USER="<user>"
$env:TW03_POSTGRES_TEST_PASSWORD="<password>"
$env:TW04_POSTGRES_TEST_URL="jdbc:postgresql://127.0.0.1:<port>/<tw04_db>"
$env:TW04_POSTGRES_TEST_USER="<user>"
$env:TW04_POSTGRES_TEST_PASSWORD="<password>"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/testing/run-tv3-regression.ps1 -Gate Postgres
```

Không dùng database production/staging/người dùng. Dừng và xóa cluster tạm sau khi lấy evidence.

---

## 8. Browser smoke và staging

Browser smoke dùng frontend thật + Playwright API mock, không tạo attempt thật, không gọi Gemini/provider/CDN audio. Kết quả: **200 PASS / 6 WARN / 0 FAIL**, 49 scenario, 206 assertion, **73 screenshot được `summary.json` tham chiếu** tại `.superpowers/tv3-22/20261019_093840Z/browser/` (thư mục còn 9 PNG không được tham chiếu do harness tái dùng output directory của các lần chạy trước; chỉ tính screenshot trong manifest của cùng lượt chạy).

Checklist staging đầy đủ nằm trong `docs/testing/TV3-22-browser-smoke.md`, mục 7. Tóm tắt điều kiện tối thiểu:

- Dùng staging URL/build/commit và feature flag đã xác nhận; migration chỉ trên staging/test DB.
- Chuẩn bị exam test có Part 1 listening, Part 2 đủ 25 câu, ít nhất một Writing task; hai tài khoản owner/non-owner.
- Kiểm tra picker → workspace → autosave/resume → submit → result/review → Writing feedback/Diff; keyboard-only và 375/768/1366/1920 px.
- Kiểm tra audio thật (Range/CORS/timeline), quyền owner, answer-key secrecy và không false-success.
- Ghi screenshot/HAR đã redact token, console, attempt ID; xóa/đánh dấu attempt thử sau kiểm tra.
- Dừng và báo blocker nếu thấy P0/P1 (lộ answer key, sai quyền, audio không phát, false-success, sai attempt).

Mock smoke **không** chứng minh deployment/staging, PostgreSQL production, provider thật, audio CDN thật hoặc full WCAG/screen-reader.

---

## 9. Yêu cầu final review

Đề nghị Codex final reviewer:

1. Xác nhận re-FIX vòng 2 TV3-22-06 (R-01–R-04) đúng tinh thần full-feature review 2026-10-19: matrix đối chiếu approved plan và path existence; runner audit + probes; test snapshot immutability siết; docs đồng bộ.
2. Kiểm tra các tài liệu `TV3-22-handover.md`, `TV3-22-regression-matrix.md`, `TV3-22-browser-smoke.md` và README module khớp code hiện tại.
3. Xác nhận phạm vi thay đổi chỉ gồm test/docs/runner TV3-22; không có production behavior/API/schema/dependency change.
4. Xác nhận workbook SHA-256 bất biến (runner verify pre/post run), không commit/push, và các mức PASS của AC-08/AC-09 có evidence phù hợp (Broad `20261019_083720Z`, Focused `20261019_083529Z`).
5. Đánh giá F-01–F-03 là P2 residual risk chấp nhận được hay cần fix trước khi bàn giao.

**Dừng ở đây để review.** Không commit, không push.
