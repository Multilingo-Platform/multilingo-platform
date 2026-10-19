# TV3-22 — Regression và bàn giao toàn bộ TV3

**Ngày:** 2026-10-18
**Trạng thái:** GATE PASS (re-FIX TV3-22-06 vòng 2 ngày 2026-10-19, sau full-feature review R-01–R-04) — AC-01–AC-09 PASS theo evidence Broad/Focused mới nhất; dừng chờ Codex re-review.
**Baseline:** HEAD `5b3442efffb7c098b86eb1833408a1903b5d21ff`, branch `feature/TV3-00-contract-audit`, working tree sạch.

**Mục tiêu:** Kiểm chứng tích hợp toàn bộ luồng TV3-04–21 và TOEIC Workspace Fixes R1, từ chọn đề đến làm bài, lưu/khôi phục, nộp bài, chấm Writing, xem kết quả/đáp án, Practice feedback và bàn giao vận hành.

**Phạm vi nghiệm thu đã chốt:** Toàn bộ TV3 + TOEIC R1; AI provider giả; PostgreSQL thử nghiệm riêng. Không gọi Gemini thật hoặc dùng database đang phục vụ người dùng.

**Kiến trúc kiểm chứng:** Regression frontend qua router/store/API normalizer thật; backend qua Spring MVC/service/repository thật và provider giả; PostgreSQL chạy riêng với schema ngẫu nhiên; browser smoke dùng fixture/API có kiểm soát.

## 1. Baseline, bằng chứng và ràng buộc

### Repository và lần chạy baseline

| Kiểm tra | Kết quả ngày 2026-10-18 |
|---|---|
| HEAD/branch/status | `5b3442e`, `feature/TV3-00-contract-audit`, working tree sạch |
| Frontend mặc định `npm test` | 84/85 files PASS; 1.587/1.588 tests PASS. Timeout 5 giây tại `ToeicWorkspaceContract.test.tsx:334` ở Mock audio contract test |
| Mock audio contract riêng | `npx vitest run src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx` — 1 file / 19 tests PASS |
| Frontend rerun `npx vitest run --maxWorkers=2` | 85 files / 1.588 tests PASS; 136.37 giây |
| Frontend lint | Exit 0; 56 warnings hiện có, cần so sánh theo file với baseline trước khi kết luận có cảnh báo mới |
| Frontend build | PASS; có cảnh báo bundle chính lớn |
| Backend focused regression | 180 tests PASS, 0 failure/error/skip |
| `git diff --check` | PASS |
| PostgreSQL riêng / browser smoke | Chưa chạy trong baseline |

Lần chạy Vitest mặc định timeout nhưng suite lỗi chạy riêng và toàn bộ frontend chạy lại với 2 workers đều PASS. Đây là flake cần điều tra và ổn định; không được che bằng cách tăng timeout toàn cục hoặc bỏ assertion.

### Nguồn và phạm vi

- Đối chiếu plan/handoff `TV3-04` đến `TV3-21`, quyết định đã chốt và hiện trạng source code. TV3-20 hiện có trạng thái `FIXED — chờ full-feature re-review`; không giả định đã có final PASS. TV3-21 có final review PASS.
- Bao gồm TOEIC Workspace Fixes R1: Part 1 render sáu câu/ảnh, Part 2 render 25 câu, mock audio theo server timeline, nhãn lựa chọn rỗng trong review.
- Bundle `backend/Exam_Template.xlsx` phải giữ nguyên SHA-256 `2A9045FE5FAB8562ED675D1EA9991CD476DB32910A5C6507636869FADD8781B8`.
- Những quyết định từng được duyệt trong handoff trước tiếp tục có hiệu lực; TV3-22 không tự đổi API, sản phẩm hay chính sách dữ liệu.

### Ràng buộc triển khai

- Không thay đổi contract/API, schema/migration, nghiệp vụ, autosave/submit/grading, quota, media policy hoặc dependency để làm regression xanh. Nếu regression xác nhận defect thì dừng gate liên quan, ghi finding có vị trí và đề xuất fix riêng.
- Không gọi Gemini, Cloudinary/CDN hoặc provider thật từ automation. Dùng fake provider/fetcher và media server giả.
- PostgreSQL chỉ dùng database thử nghiệm riêng có thể xóa/tạo lại; không dùng database local hoặc staging đang chứa dữ liệu người dùng.
- Không seed/publish bộ đề vào môi trường dùng thật; không bật các feature flag production.
- Backend broad suite loại `GenerateTemplateTest` vì test này ghi đè workbook. Ghi rõ đây là broad suite có loại test ghi file, không gọi là full suite nguyên bản.
- Chạy Maven tuần tự, không chạy nhiều Spring context test đồng thời trên cùng database.
- Lưu log/report/screenshot vào thư mục evidence bị Git ignore; che token, essay và nội dung đáp án trong log chia sẻ.
- Giữ mọi thay đổi có sẵn; không rebase, commit hoặc push.

## 2. Acceptance criteria

| AC | Điều kiện nghiệm thu |
|---|---|
| AC-01 | Có ma trận traceability bao phủ TV3-04–21, TOEIC R1, contract và test owner; mỗi acceptance/risk có bằng chứng hoặc trạng thái blocker rõ ràng. |
| AC-02 | Luồng attempt end-to-end dùng đúng dữ liệu backend: start → workspace → edit/autosave → submit → result/review; version chỉ lấy từ server, response stale không đổi context mới. |
| AC-03 | Practice, wrong-answer retry, hints và feedback tuân thủ scope/permission, không chấm/lưu sai dữ liệu; provider giả không tạo network call thật. |
| AC-04 | Writing pipeline kiểm tra submission snapshot → grading job → persisted feedback → Result UI/Diff; retry, quota, stale lease, lỗi provider và visual path có regression. |
| AC-05 | Ownership, live-attempt restrictions, route/part scope, answer-key secrecy và lịch sử snapshot được kiểm tra bằng HTTP/security pipeline thực. |
| AC-06 | Các PostgreSQL contract test được yêu cầu chạy trên database riêng thật; không skip; schema cleanup chỉ xóa schema do test tạo. |
| AC-07 | TOEIC R1: Part 1 có sáu nhóm/câu và ảnh đồng thời; Part 2 có đủ 25 câu; palette, flag/answer và Practice retry đúng; Mock playback theo timeline server; review rỗng vẫn có nhãn A–D/A–C. |
| AC-08 | Frontend full suite, lint, build và backend broad suite hoàn tất; lint không tăng warning theo path/count so với baseline đã ghi; flaky test có nguyên nhân và kết quả ổn định. |
| AC-09 | Handoff có lệnh chạy, kết quả, artifacts, giới hạn còn lại và final review toàn feature; không để P0/P1 chưa xử lý mà vẫn ghi PASS. |

## 3. Kế hoạch subtasks

Dependency tuần tự: `22-01 → 22-02 → 22-03 → 22-04 → 22-05 → 22-06`. Mỗi task ghi `IN_PROGRESS`, thực hiện test trước implementation nếu có sửa harness, ghi evidence sau khi chạy và không lấn sang production fix ngoài scope.

### TV3-22-01 — Ma trận regression và runner có lưu evidence

**Tạo:**

- `docs/testing/TV3-22-regression-matrix.md`
- `scripts/testing/run-tv3-regression.ps1`

**Sửa:**

- `.gitignore` chỉ khi cần để bỏ qua thư mục evidence runtime; không bỏ qua plan/handoff.

**Các bước:**

- [ ] Lập ma trận traceability: TV3-04–21/R1 → AC → suite/test class → gate → evidence path.
- [ ] Ghi baseline, test suite đã có, contract test nào tích hợp thật và suite nào chỉ unit/mock; không mô tả mock test là end-to-end.
- [ ] Runner nhận `-Gate Focused|Broad|Postgres`, lưu timestamp, HEAD, command, exit code và stdout/stderr vào `.superpowers/tv3-22/<timestamp>/`.
- [ ] Không ghi env values/token/password; chỉ ghi tên biến và trạng thái đã cấu hình.
- [ ] Gate Postgres thất bại nếu thiếu URL/credential, test bị skip hoặc không có test nào thực sự chạy.
- [ ] Runner trả exit code khác 0 khi một command lỗi; không tự retry hoặc thay kết quả lỗi bằng lần chạy sau.
- [ ] Kiểm tra path evidence nằm trong thư mục bị ignore và workbook hash không đổi.

**Lệnh kiểm tra:** `pwsh -NoProfile -File scripts/testing/run-tv3-regression.ps1 -Gate Focused`.

**Nghiệm thu:** AC-01, AC-08, AC-09; evidence có thể tái lập và không rò rỉ bí mật.

### TV3-22-02 — Backend lifecycle, quyền truy cập và snapshot

**Tạo:**

- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/Tv3LifecycleContractIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/Tv3AccessContractIT.java`

**Mở rộng khi cần, không chép lại coverage đã có:**

- `backend/src/test/java/com/multilingo/backend/modules/testing/service/WritingGradingLifecycleIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/SubmitAttemptImmutableKeysTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/ListeningPlaybackContractIT.java`

**Các bước:**

- [ ] Dùng fixture nhỏ, deterministic gồm objective, essay và section IDs không liên tục; tạo qua repository/test fixture hiện có.
- [ ] Đi qua HTTP/security → service → repository thật: tạo attempt, lấy workspace, PUT answers B, GET resume/result thích hợp, POST finalAnswers C và xác nhận result/review phản ánh snapshot đã chốt.
- [ ] Assert workspace/start không trả correct answer, explanation hoặc grading key; user khác không đọc/sửa attempt; live attempt bị chặn ở result/review theo contract.
- [ ] Assert part sai, attempt sai scope và practice trên Mock bị từ chối; request bị từ chối không để lại mutation/job/quota side effect ngoài contract.
- [ ] Kiểm tra sửa/unpublish exam sau khi tạo attempt không đổi prompt/options/answer/explanation snapshot của attempt cũ.
- [ ] Dùng fake provider/fetcher để kiểm tra grading text, visual 0/1/2 ảnh, quota, idempotency, retry, stale lease và partial failure; mở rộng test hiện có thay vì tạo pipeline giả thứ hai.
- [ ] Kiểm tra Hints/Practice scope và quyền qua HTTP endpoint nếu existing suites chưa chứng minh đầy đủ.
- [ ] Dùng `CustomUserDetails` và security filter thực để dựng identity; không dựa vào `WithMockUser("42")` nếu production adapter không diễn giải username thành user ID.
- [ ] Giữ nguyên mọi hành vi đã chốt của deadline/grace. Backend hiện chưa enforce `baseVersion` submit; test không được khẳng định chống ghi đè multi-tab.

**Lệnh focused:**

```powershell
cd backend
.\mvnw.cmd '-Dtest=Tv3LifecycleContractIT,Tv3AccessContractIT,WritingGradingLifecycleIT,SubmitAttemptImmutableKeysTest,ListeningPlaybackContractIT' test
```

**Nghiệm thu:** AC-02–05; assertions đi qua HTTP/service/repository thật và provider giả.

### TV3-22-03 — Frontend lifecycle từ picker đến review/feedback

**Tạo:**

- `frontend/src/features/exam/__tests__/tv3LifecycleContract.test.tsx`
- `frontend/src/features/exam/__tests__/fixtures/tv3Regression.ts`

**Mở rộng:**

- `frontend/src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx`
- `frontend/src/features/exam/__tests__/writingFeedbackPageContract.test.tsx`
- `frontend/src/features/exam/__tests__/autosaveSubmitContract.test.tsx`

**Các bước:**

- [ ] Dùng router, pages, hooks, Redux/store, API clients và normalizers thật; chỉ mock HTTP, clock, localStorage và browser media boundary.
- [ ] Kiểm tra picker chọn attempt mới; GET workspace hydrate answers/version từ server, local draft không merge vào Redux.
- [ ] Deferred PUT: gửi snapshot B, người dùng sửa thành C, submit chờ PUT hiện tại; POST đúng một lần với `baseVersion` response và `finalAnswers=C`, không PUT preflush.
- [ ] Kiểm tra network error/409/1601, timeout, MANUAL/TIMEOUT_CLIENT, stale route A→B→A, double-click và StrictMode; không false-success navigation, không đổi reason retry.
- [ ] Sau submit thành công, Result GET là nguồn dữ liệu; review GET theo part và feedback Writing tải đúng scope. Refresh 403/malformed xóa dữ liệu cũ theo contract.
- [ ] Kiểm tra Practice feedback/hints: ID, answer scope, retry/reload và trạng thái quota/error; không gọi trong Mock khi bị cấm.
- [ ] Kết hợp regression R1: sáu câu Part 1, 25 câu Part 2 đồng thời; palette cuộn tới câu; trả lời/flag không mất; tập câu retry giữ đúng filter.
- [ ] Mock playback chỉ dùng fake media/server timeline; xác minh start/reload theo vị trí server và một media element; không gọi CDN.
- [ ] Review options rỗng hiện ID, không tự đánh dấu radio; giữ HTML-like text an toàn.
- [ ] Điều tra timeout baseline tại `ToeicWorkspaceContract.test.tsx:334`: xác định nguyên nhân chờ/test setup và sửa harness tối thiểu nếu có bằng chứng. Không tăng timeout toàn cục, không xóa assertion hoặc giảm coverage.

**Lệnh focused:**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/tv3LifecycleContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx src/features/exam/__tests__/writingFeedbackPageContract.test.tsx --maxWorkers=2
```

**Nghiệm thu:** AC-02–04, AC-07; test chứng minh hành vi tích hợp qua pipeline thật, không mock hook đang được kiểm tra.

### TV3-22-04 — PostgreSQL regression riêng và sửa test harness

**PostgreSQL tests hiện có cần chạy:**

- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/ResultScorePrecisionPostgresIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/ExamReviewPostgresIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingHintPostgresIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingHintPostgresTransactionIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingGradingPostgresIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WritingGradingPostgresTransactionIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/repository/AttemptListeningPlaybackPostgresIT.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/ListeningPlaybackStartConcurrencyPostgresIT.java`

**Sửa harness nếu test RED xác nhận thiếu prerequisite:**

- `backend/src/test/resources/fixtures/writing-hints-pg-prerequisites.sql`
- `backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingHintPostgresIT.java`

**Các bước:**

- [ ] Cấp database thử nghiệm riêng cho TV3 PG suites; giữ biến `TV3_PG_TEST_URL`, `TV3_PG_TEST_USER`, `TV3_PG_TEST_PASSWORD` và kiểm tra test dùng schema ngẫu nhiên/cleanup sở hữu.
- [ ] Chạy 6 test `TV3_PG_TEST_*` trước; chạy 2 test playback với database riêng `TW03_POSTGRES_TEST_*` và `TW04_POSTGRES_TEST_*` vì TW-04 test có thể `deleteAll` và `ddl-auto=create-drop`.
- [ ] Không dùng cùng database giữa TW03/TW04 hoặc database local `multilingodb`.
- [ ] Nếu Writing Hints test thất bại do migration V20261012100000 yêu cầu bảng có trước migration, bổ sung `user_study_stats` và `daily_study_logs` vào fixture/schema baseline của test với đúng cột V1; không sửa migration hoặc bỏ migration.
- [ ] Chạy lại Spring proxy/transaction tests để chứng minh rollback/commit thực tế.
- [ ] Không cho phép trạng thái “SKIPPED vì thiếu URL” được tính là PASS; báo blocker có tên biến thiếu nhưng không in credentials.

**Lệnh:**

```powershell
cd backend
.\mvnw.cmd '-Dtest=ResultScorePrecisionPostgresIT,ExamReviewPostgresIT,WritingHintPostgresIT,WritingHintPostgresTransactionIT,WritingGradingPostgresIT,WritingGradingPostgresTransactionIT' test
.\mvnw.cmd '-Dtest=AttemptListeningPlaybackPostgresIT,ListeningPlaybackStartConcurrencyPostgresIT' test
```

**Nghiệm thu:** AC-05, AC-06; tất cả test được thực thi trên PostgreSQL thử nghiệm, không skip, không đụng dữ liệu người dùng.

### TV3-22-05 — Browser smoke và kiểm tra khả năng truy cập

**Tạo:**

- `docs/testing/TV3-22-browser-smoke.md`

**Công cụ:** Browser/Playwright đã có trong môi trường. Không thêm package hoặc sửa app chỉ để chụp ảnh.

**Các bước:**

- [ ] Chạy frontend local với fixture/API mock có kiểm soát; không tạo attempt thật, gọi provider thật hoặc tải audio từ CDN.
- [ ] Kiểm tra viewport 375, 768, 1366 và 1920 px: picker, workspace, Part 1/2, audio sticky, palette, result/review và Writing Diff.
- [ ] Dùng keyboard-only cho điều hướng, lựa chọn, flag, disclosure, retry và Diff-View; ghi focus không bị sticky header che.
- [ ] Kiểm tra trạng thái loading/error/empty/unavailable và text dài/Unicode/HTML-like text không tràn hoặc thực thi.
- [ ] Lưu screenshot/console report vào evidence directory ignore; ghi viewport, route và fixture ID.
- [ ] Ghi riêng smoke có mock với backend HTTP integration; nếu không có staging/PG credentials, không tuyên bố xác minh deployment thật.
- [ ] Bổ sung checklist staging cho người vận hành: dùng attempt thử, xác minh playback và quyền truy cập; không dùng attempt lịch sử hay dữ liệu người dùng.

**Nghiệm thu:** AC-07–09; có evidence browser rõ ràng và phân biệt với test DOM.

### TV3-22-06 — Gate toàn bộ, cập nhật tài liệu và yêu cầu review

> **Cập nhật re-FIX (2026-10-19):** G-01/G-02 và P2 đã được sửa theo Codex Review 2026-10-19 (chỉ test/docs/runner). Broad gate chạy trọn 5 step trong runner và **PASS** với `PASS_WITH_DOCUMENTED_SKIPS` (`.superpowers/tv3-22/20261019_043833Z/`, runner exit 0, manifest+summary); Focused gate PASS strict không skip (`.superpowers/tv3-22/20261019_044236Z/`). AC-08/AC-09 chuyển **PASS**. Chi tiết: `TV3-22-handoff.md`, mục "re-FIX IMPLEMENTED" TV3-22-06. Dừng chờ final review; không commit/push.
>
> **Cập nhật re-FIX vòng 2 (2026-10-19) sau full-feature re-review:** R-01 matrix đối chiếu approved plan + path-check script (76 paths, 0 miss); R-02 runner Vitest audit cho `npm test` + probes `-RunVitestAuditProbes` (10/10 PASS) → Broad frontend `02_frontend_full AuditVerdict=VERIFIED_PASS` tại `20261019_083720Z`; R-03 `Tv3LifecycleContractIT` siết snapshot test (4/4 PASS, focused `20261019_083529Z`); R-04 dispositions docs. AC-01–AC-09 PASS; dừng chờ re-review; không commit/push. Chi tiết: `TV3-22-handoff.md`, mục "re-FIX #2 IMPLEMENTED" TV3-22-06.

**Tạo:**

- `docs/testing/TV3-22-handover.md`

**Cập nhật:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/README.md`
- `docs/testing/TV3-22-regression-matrix.md`
- `docs/superpowers/plans/ndt/TV3-22-plan.md`
- `docs/superpowers/plans/ndt/TV3-22-handoff.md`

**Các bước:**

- [x] Cập nhật README theo code hiện tại: submit/result/review, Practice feedback, Hints, Writing worker, Gemini/image config và feature flags. Xóa câu lỗi thời nói TV3-20 chưa nối grading nếu code đã chứng minh ngược lại.
- [x] Thực hiện focused gates, sau đó broad backend/frontend, lint/build và diff check; không cộng số test giữa các lần chạy thành một tổng giả. **Kết quả: focused/full/lint PASS; broad backend và build FAIL. Sau re-FIX 2026-10-19: broad và build PASS toàn bộ.**
- [x] Backend broad suite dùng `-Dtest=*,!GenerateTemplateTest`; ghi rõ exclusions và số PASS/FAIL/SKIP. PostgreSQL suites báo riêng. **Kết quả: re-gate 1.887 run / 0 fail / 0 error / 31 skip (`PASS_WITH_DOCUMENTED_SKIPS`, 10 lớp allowlist); PG riêng 30 pass / 0 skip.**
- [x] Frontend full suite chạy `npm test -- --maxWorkers=2`; chạy lint/build riêng; đối chiếu warning theo đường dẫn với baseline 56. **Kết quả: full 1.597 PASS; lint 56 warning; sau re-FIX build PASS exit 0.**
- [x] Xác minh workbook SHA-256 không đổi và `git status` chỉ có file được plan cho phép. **Kết quả: hash khớp; file scope TV3-22.**
- [x] Cập nhật từng task bằng files, commands, số lượng test, exit code, AC mapping, browser/PG evidence và blocker. **Kết quả: handoff + `TV3-22-handover.md`.**
- [x] Rà soát toàn bộ TV3-04–21 + R1, ghi findings P0/P1/P2, ngoài phạm vi và trạng thái TV3-20 full-feature review. **Kết quả: G-01/G-02 gate blockers; F-01–F-03 P2; không có P0/P1 production runtime.**
- [x] Chỉ ghi `PASS` khi AC có bằng chứng, PostgreSQL gate chạy thật, broad gates đạt theo tiêu chí và không còn P0/P1; nếu thiếu điều kiện ghi `BLOCKED` hoặc `NEED_FIX`. **Kết quả: sau re-FIX, `PASS` cho AC-08/AC-09; chỉ còn F-01–F-03 P2 residual.**
- [x] Dừng sau khi handoff yêu cầu Codex final review toàn feature; không commit/push. **Kết quả: đã dừng chờ review.**

**Lệnh cuối:**

```powershell
cd backend
.\mvnw.cmd clean '-Dtest=*,!GenerateTemplateTest' test
cd ../frontend
npm test -- --maxWorkers=2
npm run lint
npm run build
cd ..
git diff --check
git status --short
Get-FileHash backend/Exam_Template.xlsx -Algorithm SHA256
```

**Nghiệm thu:** AC-01, AC-08, AC-09; báo cáo đúng evidence và dừng chờ final review.

## 4. Ma trận kiểm thử bắt buộc

| TC | Khía cạnh | Kịch bản | Kết quả mong đợi | Task |
|---|---|---|---|---|
| TC_TV3_22_01 | Happy path | Chọn đề → start → workspace → autosave → submit → result/review | Dữ liệu và status theo backend; không dùng mock result | 02, 03 |
| TC_TV3_22_02 | Race | Edit C trong khi PUT snapshot B pending rồi submit | Một PUT, một POST; POST dùng version được server xác nhận và C | 03 |
| TC_TV3_22_03 | Negative | Submit timeout/409/1601/401; timeout retry | Không false-success; giữ đúng reason và draft policy | 02, 03 |
| TC_TV3_22_04 | Boundary | Deadline ngay trước/sau, autosave interval, grace boundary | Áp dụng đúng server time/grace; không giả định client rollback | 02, 03 |
| TC_TV3_22_05 | Security | User khác đọc/sửa attempt; review khi attempt IN_PROGRESS | Bị từ chối; không lộ answer/explanation; không mutation | 02 |
| TC_TV3_22_06 | Integrity | Sửa exam hoặc unpublish sau khi tạo attempt | Attempt snapshot và kết quả/review cũ không đổi | 02 |
| TC_TV3_22_07 | Practice | Objective feedback, wrong-answer retry, Mock restriction | Scope đúng; Practice không ghi attempt answers | 02, 03 |
| TC_TV3_22_08 | Quota/idempotency | Hints/feedback repeated request và quota cạn | Không tạo job/charge trùng; safe error | 02, 03 |
| TC_TV3_22_09 | AI/media | Writing text và 0/1/2 ảnh; provider/fetcher lỗi, retry, stale lease | Persisted outcome hợp lệ; không có network provider thật | 02 |
| TC_TV3_22_10 | Boundary | Essay rỗng, Unicode/emoji, 8.000/8.001 chars | Giữ nguyên text và đúng giới hạn contract | 02, 03 |
| TC_TV3_22_11 | State/race | Result/feedback refresh 403/malformed; route A→B→A | Xóa/giữ dữ liệu đúng error contract; response stale bị bỏ | 03 |
| TC_TV3_22_12 | PostgreSQL | Transaction, uniqueness, precision, review, hints, grading, playback timeline | Chạy trên DB riêng thật; không skip; rollback/constraints đúng | 04 |
| TC_TV3_22_13 | UI regression | TOEIC Part 1 sáu câu/ảnh, Part 2 đủ 25 câu, cuộn và palette | Mọi câu hiện đồng thời; answer/flag và retry filter đúng | 03, 05 |
| TC_TV3_22_14 | Mock audio | Profile verified, start, reload, concurrent start | Timeline theo server, chỉ một playback session hợp lệ | 02, 03, 05 |
| TC_TV3_22_15 | Review integrity | Options A–D/A–C có text rỗng; answer rỗng/null/array | Hiện nhãn; không chọn/đánh đúng giả | 03, 05 |
| TC_TV3_22_16 | Accessibility | Keyboard, alert/status, small viewport, essay dài | Focus/label/status dùng được; không che nội dung | 05 |
| TC_TV3_22_17 | Hygiene | Full suite/lint/build/report/workbook hash | Exit code, warnings, exclusions và file scope được ghi chính xác | 01, 06 |

## 5. Definition of Done

- AC-01–09 được ánh xạ tới test/evidence, hoặc có blocker ghi rõ; không suy rộng từ unit test sang end-to-end.
- Frontend regression ổn định khi chạy có giới hạn workers; timeout baseline được giải thích bằng nguyên nhân và test vẫn giữ sức kiểm chứng.
- Backend broad regression chạy với `GenerateTemplateTest` bị loại rõ ràng; PostgreSQL regression chạy riêng, không skip.
- Provider AI và fetcher được giả lập; không có gọi dịch vụ bên ngoài.
- README/handoff phản ánh hành vi code hiện tại; các giới hạn baseVersion, timeout/grace, abort và media được nêu đúng.
- Không phát sinh thay đổi ngoài phạm vi hoặc thay đổi hash workbook.
- Final review toàn bộ TV3 + TOEIC R1 được yêu cầu; không commit/push.
