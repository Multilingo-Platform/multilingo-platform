# TV3-10 — Handoff / Execution Ledger

Plan: `docs/superpowers/plans/ndt/TV3-10-plan.md`. Append-only.

## 2026-10-10 — Codex Planner — PLANNED

**Summary:** Đã rà soát mã nguồn thực tế và hoàn thành phỏng vấn kiến trúc 6 nhánh theo `/grill-me`. Kế hoạch triển khai chia thành 5 subtasks chi tiết độc lập bao phủ Engine chấm điểm thuần domain (`ObjectiveGradingServiceImpl`), bộ chuẩn hóa chuỗi nâng cao (whitespace collapse, TFNG/YNNG shorthand), hỗ trợ mảng đáp án chấp nhận cho FILL_IN/DIAGRAM, tích hợp các dạng câu canonical mới (MATCHING_FEATURES, MATCHING_HEADINGS, MAP_LABELING), và kiểm thử tích hợp Adapter DB. Chưa triển khai mã nguồn.

**Dependencies:** Kế thừa `content-data-schema.md` (M00-01) và `DbGradingAdapter`.

**Decisions đã thống nhất:**
1. **Phạm vi loại câu:** Hỗ trợ đủ 10 loại câu canonical trong `content-data-schema.md` (SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN, FILL_IN_THE_BLANK, MATCHING_FEATURES, MATCHING_HEADINGS, MAP_LABELING, DIAGRAM_LABELING, ESSAY) + bảo toàn tương thích ngược cho `MATCHING` (legacy).
2. **Scoring MULTIPLE_CHOICE:** All-or-Nothing (1.0 điểm khi đúng 100% tập đáp án, 0.0 điểm khi thiếu hoặc sai; trống là BLANK 0.0 điểm).
3. **Chuẩn hóa FILL_IN & DIAGRAM:** Chuẩn hóa nghiêm ngặt (trim + toLowerCase(Locale.ROOT) + thu gọn khoảng trắng thừa `\s+` -> `" "`), so khớp với bất kỳ phần tử nào trong mảng đáp án chấp nhận (`correct_answer` array hoặc `alternates`).
4. **MATCHING_FEATURES, HEADINGS & MAP:** Chấm đơn lẻ theo từng câu hỏi độc lập (1.0 điểm/câu), hỗ trợ string hoặc array đáp án chấp nhận.
5. **Chuẩn hóa TFNG & YNNG:** Hỗ trợ linh hoạt cả viết tắt (`T`, `F`, `NG` / `Y`, `N`, `NG`) lẫn viết đầy đủ (`TRUE`, `FALSE`, `NOT GIVEN` / `YES`, `NO`, `NOT GIVEN`).

**Subtasks:**
- TV3-10-01: String Normalization Engine Enhancement (Whitespace Collapse & TFNG/YNNG Shorthands) (IN_PROGRESS)
- TV3-10-02: Accepted Answers Array Support for FILL_IN_THE_BLANK & DIAGRAM_LABELING (PLANNED)
- TV3-10-03: Canonical Types Dispatch for MATCHING_FEATURES, MATCHING_HEADINGS & MAP_LABELING (PLANNED)
- TV3-10-04: MULTIPLE_CHOICE & Legacy MATCHING Robustness Guard (PLANNED)
- TV3-10-05: Multi-Group Canonical Exam Integration & Full Regression (PLANNED)

## 2026-10-10 — Gemini Executor — TV3-10-01 — IN_PROGRESS
Bắt đầu triển khai Subtask 1: String Normalization Enhancement. Chuẩn bị viết test RED trong `ObjectiveGradingServiceTest.java`.

## 2026-10-10 — Codex — REFACTOR DEFERRED / CHỜ EXECUTOR

Đã đọc toàn bộ plan/handoff và kiểm tra engine, adapter, các tests liên quan trên HEAD `54eda97`. Handoff hiện chưa có IMPLEMENTED cho toàn bộ subtasks hoặc Codex findings; các files grading chưa có Git diff so với HEAD. Không coi trạng thái PLANNED/IN_PROGRESS là implementation hoàn tất để refactor hoặc nghiệm thu.

Người dùng đã chọn **“Chờ executor hoàn tất”** sau câu hỏi làm rõ. Vì vậy dừng sửa/refactor; không tạo regression tests hoặc thay production code trong lượt này. File duy nhất được ghi là append vào handoff này; giữ nguyên toàn bộ dirty/untracked work TV3-09 và TV3-10.

Verification đã khởi chạy trước câu trả lời: tại `backend`, `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest" test` → **44 tests PASS, 0 failures/errors/skips, exit0**, kết thúc 22:39 (+07). Engine32, adapter12; đây chỉ là baseline tests hiện có, không chứng minh các yêu cầu TV3-10 còn thiếu đã đạt. `git diff --check` exit0. Không chạy full suite, commit hoặc push.

**Next action:** Executor hoàn tất và append evidence cho TV3-10-01–05; sau đó mới tiếp tục yêu cầu refactor/final review. Chưa có reviewer PASS, chưa sửa hoặc phân loại findings mới trong lượt này. Không tự triển khai phần còn thiếu hoặc thiết lập theo dõi tự động.

## 2026-10-10 — Gemini Executor — TV3-10 — IMPLEMENTED & VERIFIED

### 1. Triển khai hoàn tất 5/5 Subtasks (TDD Red-Green):
- **TV3-10-01 (String Normalization):**
  - Cập nhật `normalize(Object)` thu gọn khoảng trắng thừa: `.replaceAll("\\s+", " ")`.
  - Cập nhật `normalizeTFNG(Object)` và `normalizeYNNG(Object)` hỗ trợ viết tắt: `t`/`true`, `f`/`false`, `ng`/`not_given`, `y`/`yes`, `n`/`no`.
  - Đã kiểm chứng RED (8 test failures) $\rightarrow$ GREEN (`ObjectiveGradingServiceTest` 45 tests PASS).
- **TV3-10-02 (Array Accepted Answers for FILL_IN & DIAGRAM):**
  - Cập nhật `gradeFillIn` kiểm tra `key.getCorrect() instanceof Collection<?> coll`, duyệt từng phần tử và so khớp `userAns.equals(normalize(opt))`.
  - Loại bỏ hoàn toàn lỗi so khớp với `toString()` của List.
  - Đã kiểm chứng RED (2 test failures) $\rightarrow$ GREEN (`ObjectiveGradingServiceTest` 47 tests PASS).
- **TV3-10-03 (Canonical Types Dispatch):**
  - Mở rộng `OBJECTIVE_TYPES` bổ sung `MATCHING_FEATURES` và `MATCHING_HEADINGS`.
  - Dispatch các loại câu canonical `SINGLE_CHOICE`, `MATCHING_FEATURES`, `MATCHING_HEADINGS`, `MAP_LABELING`, `FILL_IN_THE_BLANK`, `DIAGRAM_LABELING` về `gradeFillIn`.
  - Đã kiểm chứng RED (2 `GRADING_DATA_ERROR` errors) $\rightarrow$ GREEN (`ObjectiveGradingServiceTest` 50 tests PASS).
- **TV3-10-04 (MULTIPLE_CHOICE & MATCHING Robustness Guard):**
  - Gia cố `gradeMultipleChoice`: lọc các phần tử null/rỗng trong câu trả lời học viên (`normalize(item) != null`); trả `BLANK` khi rỗng; hỗ trợ `key.getCorrect()` cả `Collection<?>` lẫn đối tượng đơn lẻ.
  - Gia cố `gradeMatching`: kiểm tra `key.getCorrect() instanceof Map<?, ?>`, nếu sai kiểu ném `AppException(ErrorCode.GRADING_DATA_ERROR)`; xử lý an toàn khi học viên gửi câu trả lời không phải Map.
  - Đã kiểm chứng RED (3 errors, 1 failure) $\rightarrow$ GREEN (`ObjectiveGradingServiceTest` 55 tests PASS).
- **TV3-10-05 (Multi-Group Canonical Integration Test & Full Regression):**
  - Thêm integration test `loadPartKeys_extractsAllCanonicalTypesAcrossGroups_andGradesCorrectlyWithObjectiveEngine` trong `DbGradingAdapterTest.java`: đề thi đa sections (READING, LISTENING, WRITING) với nhiều `question_groups` chứa đủ 10 loại câu canonical; chấm điểm qua domain engine `ObjectiveGradingServiceImpl` đạt điểm số và tổng hợp chính xác (9/9 correct, 7.0 Reading, 2.0 Listening).
  - Toàn bộ suite kiểm thử hoàn tất GREEN:
    - `ObjectiveGradingServiceTest`: 55 tests PASS, 0 failures, 0 errors.
    - `DbGradingAdapterTest`: 13 tests PASS, 0 failures, 0 errors.
    - `SubmissionServiceTest`: 8 tests PASS, 0 failures, 0 errors.
    - Tổng cộng: 76 tests PASS, exit code 0.

### 2. Verification Evidence:
- **Command 1:** `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest" test` (cwd: `backend`) $\rightarrow$ **68 tests PASS, 0 failures, 0 errors, exit 0**.
- **Command 2:** `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest,SubmissionServiceTest" test` (cwd: `backend`) $\rightarrow$ **76 tests PASS, 0 failures, 0 errors, exit 0**.
- **Command 3:** `git diff --check` $\rightarrow$ exit code 0 (no whitespace / syntax errors).

### 3. Files Modified (TV3-10 Scope):
- `backend/src/main/java/com/multilingo/backend/modules/testing/grading/impl/ObjectiveGradingServiceImpl.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/grading/ObjectiveGradingServiceTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapterTest.java`
- `docs/superpowers/plans/ndt/TV3-10-handoff.md`

Tất cả các thay đổi trước đó được bảo toàn nguyên vẹn. Không commit, không push. Sẵn sàng cho Codex Reviewer kiểm tra.

## 2026-10-10 — Codex Reviewer — TV3-10 FULL FEATURE REVIEW — NEED_FIX

**Agent:** Codex Reviewer. **Reviewed scope:** TV3-10-01–05, toàn bộ feature theo approved plan, không chỉ subtask mới nhất. **Decision:** NEED_FIX — một P1 trong scope; không xác nhận P0/P2 bổ sung.

### Phạm vi và Git evidence

- HEAD `54eda97`; staged trống. Đã đọc plan/handoff, toàn bộ diff engine và hai test suites grading, cùng production adapter/DTO/submission call sites cần thiết để đối chiếu contracts.
- TV3-10 thay đổi ObjectiveGradingServiceImpl.java, ObjectiveGradingServiceTest.java và DbGradingAdapterTest.java; plan/handoff TV3-10 là untracked. DbGradingAdapter production không đổi; cần kiểm tra vì đây là nguồn key của engine.
- Các frontend dirty files, LearnerExamStructureControllerIT.java, ba untracked grace/submit-concurrency tests và docs TV3-09 thuộc công việc khác. Đã nhận diện qua Git inventory và ledger; không audit correctness hoặc sửa các file đó.

### IN-SCOPE — R1 [P1] Ánh xạ option ID của MATCHING_HEADINGS trước khi chấm

- **Exact location:** `backend/src/main/java/com/multilingo/backend/modules/testing/grading/impl/ObjectiveGradingServiceImpl.java:116–118` — dispatch MATCHING_HEADINGS về gradeFillIn chỉ so sánh chuỗi trực tiếp. Nguồn key: `DbGradingAdapter.java:136–142` chỉ giữ correct_answer/alternates, không ánh xạ options.
- **Concrete scenario:** Theo `docs/ndt/contracts/content-data-schema.md` §2.4, correct_answer của MATCHING_HEADINGS là text đầy đủ; ví dụ options `[{id:"i",text:"A history of transport"},{id:"ii",text:"Modern transport"}]`, correct_answer `"A history of transport"`. QuestionRenderer.tsx:65–73 dùng MatchingRenderer; MatchingRenderer.tsx:23 gửi opt.id, nên người học chọn đúng heading gửi `"i"`. Engine mới so `"i"` với text và chấm WRONG/0. Type trước đó không được hỗ trợ; hỗ trợ mới vẫn chưa chấm đúng canonical question qua payload UI hiện có. Đây là thiếu correctness của TV3-10-03/05, không phải yêu cầu redesign frontend.
- **Minimal required fix:** Trong DbGradingAdapter, riêng MATCHING_HEADINGS, đối chiếu correct heading text với options để thêm ID tương ứng vào accepted key/alternates, vẫn giữ text và các accepted alternatives đã có. Engine tiếp tục pure domain và hỗ trợ key text/ID/array như plan. Không cần đổi schema, learner response hoặc frontend contract.
- **Focused regression:** Thêm canonical adapter → actual engine test có options ID khác text và correct_answer dạng text; userAnswer gửi ID như frontend. Chọn đúng ID phải CORRECT/1, sai ID WRONG/0, bỏ trống BLANK/0; giữ test accepted text/array/alternates. Test hiện tại `loadPartKeys_extractsAllCanonicalTypesAcrossGroups_andGradesCorrectlyWithObjectiveEngine` không cung cấp options và gửi text `"Paragraph III"`, nên không phủ mismatch này.
- **Independent reproduction:** JShell dùng compiled ObjectiveGradingServiceImpl/DTO/entity, không sửa file; key MATCHING_HEADINGS `"A history of transport"`, rawAnswer `"i"` → `UI_ID_VERDICT=WRONG, SCORE=0`; cùng key, rawAnswer bằng text → `TEXT_VERDICT=CORRECT, SCORE=1`. Đối chiếu adapter và renderer xác nhận các giá trị này xuất hiện trên đường thực tế. Đây là domain reproduction, không phải live HTTP/PostgreSQL E2E.

### Acceptance criteria, security và integration

- **TV3-10-01:** Đạt trong scope đã duyệt: trim/lowercase Locale.ROOT/collapse ASCII whitespace; TFNG T/F/NG và YNNG Y/N/NG chuẩn hóa riêng.
- **TV3-10-02:** Đạt: duyệt accepted Collection thay vì List.toString; vẫn nhận scalar/alternates, WRONG/BLANK không tăng score.
- **TV3-10-03:** MATCHING_FEATURES/MAP_LABELING và dispatch các types đã có; MATCHING_HEADINGS chưa đạt production contract vì R1. Không lấy việc không ném unknown type làm bằng chứng chấm đúng heading.
- **TV3-10-04:** Đạt: MULTIPLE_CHOICE lọc null/empty an toàn, set equality giữ All-or-Nothing, thiếu/thừa đáp án vẫn WRONG. MATCHING legacy giữ partial score và kiểm tra Map key, không cast user input không phải Map; không xác nhận regression mới.
- **TV3-10-05:** Real DbGradingAdapter + real engine test đa groups/sections giữ accepted arrays, bỏ ESSAY và assert score/count/sectionScores. Test đạt nhưng thiếu canonical heading ID case; chưa đủ nghiệm thu toàn feature.
- DTO/API/database contracts không bị đổi. Engine không gọi repository/API bên ngoài, không thêm log đáp án/key; learner WorkspaceResponse/sanitization path không bị sửa. Không xác nhận data exposure mới. Không yêu cầu thêm auth/controller tests cho pure domain diff này.

### Focused test verification — độc lập

- Chạy tại backend: `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest,SubmissionServiceTest" test` → exit 0, BUILD SUCCESS, **76 tests PASS, 0 failures/errors/skips** (engine 55, adapter 13, submission 8). Kết thúc **22:53:02 ngày 2026-10-10 (+07)**, total time 29.935 giây.
- Grading tests thực sự gọi production engine; adapter tests mock repositories nhưng gọi actual adapter và engine, không mock kết quả chấm. Submission regression dùng Spring/H2; không coi là PostgreSQL concurrency evidence.
- RED/GREEN lịch sử executor báo trong ledger chưa được tái thực hiện bằng cách sửa/revert code; kết quả GREEN ở trên được reviewer chạy độc lập. Full backend suite không chạy theo phạm vi focused review.
- `git diff --check` exit 0, không có whitespace error; thông báo LF/CRLF ở frontend ngoài scope không phải grading failure. Suite xanh hiện tại không phủ R1.

### OUT-OF-SCOPE follow-ups

- TV3-09 grace/concurrency/frontend hard lock và thay đổi controller test có sẵn: bảo toàn, không dùng làm TV3-10 blocker và không đưa ra findings mới từ lượt review này.
- TV3-11 result/review UI, TV3-12 AI essay grading, migrations và full repository audit không thuộc review. R1 sửa tại grading key adapter trong scope đã duyệt, không cần mở rộng các task này.

**Next required action:** Sửa R1 tại grading-key extraction, bổ sung regression canonical heading text → submitted option ID, chạy lại ba focused suites và append FIXED/evidence trước re-review. Review chỉ append handoff, không sửa production/tests/approved plan, commit hoặc push. Dừng sau báo cáo.


## 2026-10-10 — FIX R1 [P1] Resolution & Verification Ledger

### 1. Scope & Action Summary
Đã xử lý triệt để finding R1 [P1] từ Codex Review:

| Finding | Mức độ | Hành động thực hiện | File thay đổi |
|---|---|---|---|
| **R1** | P1 | Bổ sung phương thức `resolveMatchingHeadingsOptions` tại `DbGradingAdapter`: Đối chiếu heading text trong `correct_answer` (và `alternates`) với danh sách `options` (tại cấp câu hỏi hoặc kế thừa từ `group`). Bổ sung `id` của option tương ứng vào `alternates` của `GradingKey`, đồng thời bảo toàn text gốc và các accepted alternatives sẵn có. Chuẩn hóa chuỗi khi so khớp tuân thủ nghiêm ngặt trim + toLowerCase(Locale.ROOT) + whitespace collapse `\s+ -> " "`. | `backend/src/main/java/.../DbGradingAdapter.java` |

---

### 2. Focused Regression Test (TDD Red-Green)
- **Tệp:** `backend/src/test/java/.../DbGradingAdapterTest.java`
- **Method:** `loadPartKeys_matchingHeadings_mapsOptionIdToAcceptedKey_andGradesCorrectlyWithSubmittedId` (`TC_GRD_ADP_HEAD_01`).
- **Kịch bản kiểm chứng:**
  - Mock exam có câu hỏi `MATCHING_HEADINGS` với `correct_answer = "A history of transport"`, `alternates = ["History of transport"]`, `options` gồm `id = "i" / text = "A history of transport"`, `id = "ii" / text = "Modern transport systems"`.
  - **Red Phase:** Khi chưa sửa `DbGradingAdapter`, test fail tại line 390 với `AssertionError: Expecting List to contain ["i", "History of transport"] but could not find ["i"]`.
  - **Green Phase:** Sau khi cập nhật adapter, test PASS cả 5 kịch bản thông qua actual domain engine `ObjectiveGradingServiceImpl`:
    1. Học viên gửi option ID `"i"` (payload từ `MatchingRenderer` UI) $\rightarrow$ `CORRECT / 1.0`.
    2. Học viên gửi text đầy đủ `"A history of transport"` $\rightarrow$ `CORRECT / 1.0`.
    3. Học viên gửi alternate text `"History of transport"` $\rightarrow$ `CORRECT / 1.0`.
    4. Học viên gửi sai option ID `"ii"` $\rightarrow$ `WRONG / 0.0`.
    5. Học viên bỏ trống `""` $\rightarrow$ `BLANK / 0.0`.

---

### 3. Verification Evidence (Bằng chứng thực nghiệm)

1. **Focused Grading & Submission Test Suites:**
   - Lệnh: `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest,SubmissionServiceTest" test` (cwd `backend`)
   - Kết quả: **77 tests run, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS, exit 0**.
     - `ObjectiveGradingServiceTest`: 55/55 tests PASS.
     - `DbGradingAdapterTest`: 14/14 tests PASS (tăng 1 test regression mới).
     - `SubmissionServiceTest`: 8/8 tests PASS.

2. **Bảo toàn các suites liên quan (TV3-09):**
   - Lệnh: `.\mvnw.cmd "-Dtest=TestAttemptSubmitConcurrencyIT,TestAttemptSchedulerSubmitConcurrencyIT,TestAttemptGracePeriodTest,TestAttemptResumeConcurrencyIT,TestAttemptResumeControllerIT" test` (cwd `backend`)
   - Kết quả: **22/22 tests PASS, 0 failures, 0 errors, exit 0**.

3. **Code Quality Gates & Diff Check:**
   - `git diff --check`: **exit 0**, không có lỗi whitespace hay conflict marker.
   - Không commit, không push. Dừng lại chờ Codex Re-review theo đúng quy trình.


## 2026-10-10 — Codex Reviewer — TV3-10 FULL FEATURE RE-REVIEW — PASS

**Agent:** Codex Reviewer. **Reviewed subtask/feature:** TV3-10-01–05, toàn bộ feature theo approved plan. **Decision:** PASS — không còn finding P0/P1/P2 được xác nhận trong scope.

### Phạm vi review

- Đọc lại approved plan và ledger này, gồm implementation và FIX R1 mới nhất. Kiểm tra diff TV3-10 trong engine, DbGradingAdapter, unit/integration tests; đối chiếu DTO, submission call site, canonical schema và matching renderer.
- Staged diff trống. Các untracked liên quan đến TV3-10 là plan/handoff; untracked concurrency tests và frontend changes thuộc TV3-09, được giữ ngoài đánh giá TV3-10.
- R1 lần trước đã được sửa trong `DbGradingAdapter.resolveMatchingHeadingsOptions`: tìm option theo text hoặc ID, đưa ID khớp vào accepted alternatives và giữ nguyên correct text/alternates. Options cấp group được kế thừa cho question nếu question chưa có options.

### Findings và acceptance criteria

- **R1 [P1] — CLOSED:** Với `correct_answer="A history of transport"`, option `i`/text tương ứng được map vào key; payload UI `i` được chấm CORRECT/1.0. Text và alternate vẫn CORRECT; ID option sai là WRONG/0.0; blank là BLANK/0.0. Regression mới đi từ adapter thật qua objective engine thật.
- **TV3-10-01 — PASS:** Chuẩn hóa case/whitespace và shorthand T/F/NG, Y/N/NG được triển khai và unit-tested.
- **TV3-10-02 — PASS:** FILL_IN/DIAGRAM hỗ trợ accepted answer dạng Collection hoặc scalar/alternates; đáp án sai và blank không được tính đúng.
- **TV3-10-03 — PASS:** Canonical types được dispatch; Matching Headings giờ nhận cả text và ID mà frontend gửi. Adapter integration phủ matching option ID.
- **TV3-10-04 — PASS:** MULTIPLE_CHOICE giữ All-or-Nothing và lọc null/rỗng; legacy MATCHING giữ map/partial score, xử lý user answer sai kiểu an toàn.
- **TV3-10-05 — PASS:** Multi-group/multi-section adapter → engine integration xác minh keys, mảng accepted answers, bỏ qua ESSAY và tổng hợp score/count/section. Test mới bổ sung case MATCHING_HEADINGS canonical.
- Contracts DTO/result, pure-domain boundary và learner response không bị thay đổi trong TV3-10; không phát hiện data exposure hoặc regression bảo mật mới. Không có thay đổi schema/migration.
- Không xác nhận thêm P0/P1/P2. Không yêu cầu refactor hoặc style-only changes.

### Verification độc lập

- Chạy tại backend: `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,DbGradingAdapterTest,SubmissionServiceTest" test` → **77 tests PASS, 0 failures/errors/skips, BUILD SUCCESS, exit 0**. Objective grading 55/55, adapter 14/14, submission 8/8; kết thúc 23:12:20 ngày 2026-10-10 (+07), total time 29.970 giây.
- Regression mới `loadPartKeys_matchingHeadings_mapsOptionIdToAcceptedKey_andGradesCorrectlyWithSubmittedId` chạy trong adapter suite và gọi production grading engine. Reported RED/GREEN trong executor ledger đối chiếu với source; reviewer xác minh GREEN bằng test độc lập, không revert implementation để chạy RED.
- `git diff --check` exit 0; chỉ có cảnh báo LF/CRLF trên frontend files ngoài scope. Không chạy full backend suite hoặc PostgreSQL E2E; không dùng suite TV3-09 thay cho verification của TV3-10.

### OUT-OF-SCOPE follow-ups

- TV3-09 backend grace/concurrency, frontend hard-lock changes và controller test change được giữ nguyên; không xác nhận lại trong review này.
- TV3-11 result/review UI, TV3-12 essay AI grading, migrations và full repository audit vẫn ngoài scope.

**Next required action:** TV3-10 đạt PASS theo acceptance criteria đã duyệt; có thể bàn giao. Không sửa code/plan, commit hoặc push. Dừng sau báo cáo.
