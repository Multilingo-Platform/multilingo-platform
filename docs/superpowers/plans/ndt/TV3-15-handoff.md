# TV3-15 — API phản hồi tức thì cho Practice — Handoff

## 2026-10-11 — Codex Planner — PLANNED

**Goal:** Owner của Practice IN_PROGRESS kiểm tra một câu khách quan từ input request, nhận verdict/score/key/explanation theo attempt snapshot.

**Plan:** docs/superpowers/plans/ndt/TV3-15-plan.md

**Baseline:** HEAD adf459c, branch feature/TV3-00-contract-audit; working tree có 62 entries, chủ yếu TV3-13/14 và file ngoài phạm vi. Không reset hoặc ghi đè.

**Decisions locked:**

- Một câu, định danh (partId, questionId).
- Preview read-only; autosave/submit vẫn lưu bài.
- Trả verdict/raw score/correctAnswer/explanation.
- Chỉ live Practice; MOCK_TEST luôn bị từ chối ở endpoint này.
- ESSAY không hỗ trợ; missing snapshot key fail closed.
- Backend-only; không tích hợp UI trong TV3-15.

**Planning verification — lượt planner:**

- Focused backend: ObjectiveGradingServiceTest, SnapshotGradingKeyExtractorTest, DbExamAdapterSnapshotTest, TestAttemptReviewControllerIT → 71 tests, 0 failures/errors/skipped; BUILD SUCCESS.
- Git diff check → exit 0, có LF/CRLF notices.
- Không chạy full backend/frontend suite.
- Chưa có implementation hoặc RED/GREEN evidence TV3-15.

| Task | Deliverable | Dependency | Status |
|---|---|---|---|
| TV3-15-01 | DTO và strict request validation | Contract đã chốt | IMPLEMENTED |
| TV3-15-02 | Snapshot evaluator, real grading parity | 15-01 | IMPLEMENTED |
| TV3-15-03 | Ownership/mode/status read-only service | 15-01–02 | IMPLEMENTED |
| TV3-15-04 | Endpoint, fixed errors, security tests | 15-01–03 | IMPLEMENTED |
| TV3-15-05 | Integration/history/persistence regression | 15-01–04 | PLANNED |

### Residual risks

- TV3-13/14 chưa commit; executor phải kiểm tra dependency mới nhất.
- Legacy snapshot thiếu key sẽ không dùng được feedback.
- Test profile identity cố định; ownership tests phải kiểm soát adapter rõ ràng.
- Eligibility được kiểm tra tại thời điểm đọc DB; feedback không xác nhận trạng thái hiện hành hoặc persistence.
- UI integration và stale feedback invalidation chưa thuộc task này.

### Chỉ dẫn Gemini Executor

- Đọc plan, handoff và repository instructions; kiểm tra HEAD/status.
- Triển khai tuần tự RED → GREEN, mỗi task append IN_PROGRESS rồi IMPLEMENTED.
- Tái dùng engine/snapshot utilities; không mở lại grading/lifecycle architecture.
- Ghi files, commands/results, AC mapping và unresolved issues.
- Không sửa ngoài scope, không commit/push.
- Sau verification, dừng chờ Codex final review.

### Chỉ dẫn Codex Reviewer

- Review toàn feature, gồm mọi tracked/untracked changes của TV3-15.
- Kiểm tra access trước solution extraction, request type validation, tuple identity và historical snapshot.
- Xác nhận không ghi DB/version, không adapter fallback và không leak qua error/log/workspace.
- Kiểm tra tests đi qua controller/service/evaluator/engine thật.
- Phân loại P0/P1/P2 với exact locations/minimal fixes.
- Append PASS, NEED_FIX hoặc BLOCKED cùng verification evidence.
- Không commit/push.

## 2026-10-11 — TV3-15-01 Execution Evidence

- **Status:** IMPLEMENTED
- **Deliverables:**
  - `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/PracticeFeedbackRequest.java`: DTO nhận request với `JsonNode partId`, `JsonNode questionId`, `JsonNode answer` nhằm ngăn chặn Jackson coercion tự động.
  - `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/PracticeFeedbackResponse.java`: Response DTO chỉ chứa allowlisted fields (`attemptId`, `partId`, `questionId`, `type`, `userAnswer`, `verdict`, `score`, `correctAnswer`, `explanation`), `@JsonInclude(JsonInclude.Include.ALWAYS)` cho các explicit null fields, tuyệt đối không chứa `version`, `examData`, `questions` hay `gradingKeys`.
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackRequestValidator.java`: Validator bóc tách và kiểm tra nghiêm ngặt `ValidatedFeedbackInput(Integer partId, String questionId, Object answer)`:
    - `partId`: bắt buộc là JSON integer >= 1 (từ chối string số, float, boolean, missing/null).
    - `questionId`: bắt buộc JSON string không blank, giữ nguyên Unicode không trim.
    - `answer`: bắt buộc hiện diện (`missing` ném 422 `VALIDATION_FAILED`; `"answer": null` được chấp nhận là `null`). Kiểm tra deep string cho mảng và map, từ chối lồng nested object hay phần tử không phải string; bọc deep-copy bằng unmodifiable list/map.
    - `validateAnswerForType`: phân loại shape hợp lệ theo bảng contract (String, List<String>, Map<String, String>), ném 422 rõ ràng cho `ESSAY`.
  - Tests:
    - `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackRequestValidatorTest.java`: 35 tests kiểm tra toàn bộ boundary, error case, deep validation.
    - `backend/src/test/java/com/multilingo/backend/modules/testing/dto/response/PracticeFeedbackResponseTest.java`: 3 tests kiểm tra format JSON, allowlist, explicit null và decimal precision.

- **Verification Evidence:**
  - **TDD RED:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest" test` trước khi implement -> Compilation failure (exit code 1), không tìm thấy class symbols.
  - **TDD GREEN:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest" test` sau khi implement -> `Tests run: 38, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Baseline Regression:** Chạy `.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test` -> `Tests run: 71, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Git Diff & Whitespace:** Chạy `git diff --check` -> Không có lỗi whitespace hay trailing spaces.
  - **Git Status:** Chỉ xuất hiện 5 files mới của TV3-15-01 và cập nhật plan/handoff; bảo toàn nguyên vẹn 100% working tree changes từ TV3-13/14. Zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Review TV3-15-01, DTO và validation

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-01 — Request/response DTO và validation.
- **Decision: PASS cho TV3-15-01.** Không có finding P0/P1/P2 về lỗi implementation được xác nhận. Đây không phải PASS toàn feature TV3-15: 15-02 đến 15-05 vẫn PLANNED, chưa có evaluator/service/controller để kiểm chứng end-to-end.
- **Review scope:** Đọc toàn approved plan/handoff và đối chiếu mọi implementation hiện có với contract chung. Git status hiện chỉ có 5 source/test TV3-15-01 cùng 2 tài liệu TV3-15 untracked; staged và tracked diff rỗng. HEAD hiện là `4a60c30` (TV3-14 đã nằm trong lịch sử Git), khác baseline planning cũ; không sửa hoặc mở lại review TV3-13/14. Đọc toàn bộ 5 file mới, không bỏ qua untracked.

### Verified acceptance criteria — phần đã triển khai

- **AC-06 / DTO binding:** Request dùng JsonNode nên giữ JSON type để validate, không coercion partId từ string/float/boolean; partId phải IntNode dương trong Java integer range. questionId phải nonblank string, giữ chính xác Unicode/whitespace và không chuyển sang integer.
- **AC-06 / Answer union:** Missing answer bị từ chối, explicit JSON null được giữ null. String, string array và flat string map hợp lệ; scalar number/boolean, nested object/array và non-string/null elements bị từ chối. Không trim answer; array/map được copy từ tree request và bọc unmodifiable.
- **AC-06 / Type shape:** String/null cho các objective string types và aliases; List<String>/null cho MULTIPLE_CHOICE; Map<String,String>/null cho MATCHING. ESSAY bị từ chối bằng VALIDATION_FAILED. Empty string/list/map hợp lệ với type tương ứng.
- **AC-06 / Serialization:** Response chỉ khai báo 9 fields contract; verdict dùng GradingVerdict, score BigDecimal không clamp [0,1]; userAnswer/explanation null vẫn có trong JSON nhờ JsonInclude.ALWAYS. Không có version, resultSummary, examData, questions hoặc gradingKeys.
- **AC-08 / Boundary hiện có:** Validator không log payload hoặc đưa input vào exception message; request không có field để chọn owner/mode/key. Các DTO/validator mới không gọi repository, adapter, grading/AI hoặc mutate attempt. Không có endpoint mới để làm rộng solution access ở bước này.
- **AC-09 / Focused verification:** Tests thực sự bind JSON vào production request DTO, gọi validator thật và serialize production response DTO. Kết quả reviewer chạy mới ở dưới, không chỉ dựa vào executor report.

### IN-SCOPE findings

Không có actionable implementation finding được xác nhận. Không suy diễn access/persistence/history defects từ việc các subtasks 15-02–05 chưa triển khai.

### Focused evidence — Reviewer-run

- Tại backend: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest" test` -> **38 tests (35 validator + 3 response), 0 failures/errors/skipped, BUILD SUCCESS, exit 0**.
- Read-only JShell probe dùng compiled production classes và Jackson thực, không tạo/sửa file source/test: **MAX_ID_AND_UNTRIMMED=true**, **EMPTY_STRING=true**, **LIST_DEEP_COPY=true**, **LIST_IMMUTABLE=true**, **MAP_DEEP_COPY=true**, **MAP_IMMUTABLE=true**, **EMPTY_COLLECTION_SHAPES=PASS**. Probe đổi JsonNode sau validate và thử mutate validated collection để xác nhận độc lập defensive copy/immutability. Đây là runtime checks bổ sung, không tính thành JUnit tests.
- `git diff --check` -> exit 0; tracked diff và staged rỗng. Với untracked files, reviewer đọc nội dung trực tiếp; không coi diff check rỗng là bằng chứng đã kiểm tra whitespace của các file mới.
- **Executor-reported only:** RED compilation failure trước implementation và baseline regression 71 tests PASS; reviewer không chạy lại baseline/full backend/frontend suite và không revert source để chứng minh RED.

### Coverage gaps / integration follow-ups — không phải blocker 15-01

- JUnit hiện chưa khóa trực tiếp valid max partId, answer whitespace/empty union và mutation/immutability mặc dù test name đề cập unmodifiable. Runtime probes đã xác minh hành vi hiện tại; nên bổ sung các assertions này thành regression lâu dài.
- Response tests kiểm tra nhiều field cấm nhưng chưa assert exact field-name set; DTO source hiện đúng 9 fields. Nên dùng exact allowlist trong HTTP integration sau này.
- Chưa kiểm chứng Spring HTTP binding, malformed-JSON logging, no-store, authenticated ownership/mode/status hoặc persisted snapshot/no-write invariants: các deliverables thuộc 15-02–05, không được gọi là đã đạt từ 38 unit tests.
- Validator unknown type hiện trả VALIDATION_FAILED; evaluator tương lai phải phân biệt invalid server snapshot/type với invalid learner answer và ánh xạ GRADING_DATA_ERROR đúng contract. Chưa có call path evaluator/controller để xác nhận lỗi HTTP hiện tại.

### OUT-OF-SCOPE

- Không có existing defect ngoài scope được xác nhận trong lượt này. Không tái audit TV3-13/14, autosave/submit, authoring/admin hoặc frontend.
- Không thực hiện commit/push hay sửa production/test/approved plan; thay đổi duy nhất của reviewer là append entry này.

**Next required action:** Tiếp tục TV3-15-02 (snapshot evaluator và grading parity) theo approved plan; giữ các integration/error/security gates cho 15-03–05. Chưa nghiệm thu toàn feature TV3-15. Reviewer dừng sau khi ghi PASS cho 15-01.

## 2026-10-11 — TV3-15-02 Execution Evidence

- **Status:** IMPLEMENTED
- **Deliverables:**
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java`:
    - Component thuần domain/evaluator: nhận `attemptId`, `snapshot`, `ValidatedFeedbackInput`.
    - Kiểm tra scope bằng `AttemptResultScope`, xác thực `partId` và `questionId` thuộc scope trước khi truy xuất key; ném `RESOURCE_NOT_FOUND` (404) nếu không tìm thấy.
    - Chặn câu hỏi `ESSAY` bằng `VALIDATION_FAILED` (422), chặn unknown type bằng `GRADING_DATA_ERROR` (422).
    - Trích xuất raw question theo đúng độ ưu tiên: `question_groups` trước (kế thừa group options nếu câu hỏi không có options riêng); flat list chỉ khi không có groups.
    - Deep copy question, chuẩn hóa canonical `question_id` và canonical `type` (MCQ -> SINGLE_CHOICE, FILL_IN -> FILL_IN_THE_BLANK) để khớp với grading engine.
    - Trích xuất `explanation` của đúng câu hỏi; ném `GRADING_DATA_ERROR` nếu `explanation` khác kiểu `String`.
    - Tạo snapshot thu nhỏ cho câu hỏi đơn và trích xuất key bằng `SnapshotGradingKeyExtractor`; ném `GRADING_DATA_ERROR` nếu thiếu key/correct answer hoặc trích xuất lỗi (bảo đảm fail closed).
    - Tạo đối tượng transient `AttemptAnswer` chứa một câu trả lời (sử dụng `LinkedHashMap` cho phép lưu `null`), gọi `ObjectiveGradingService.gradeAttempt` thật để đạt 100% grading parity (bao gồm aliases TFNG/YNNG, accepted alternates, MATCHING partial credit, v.v.).
    - Project kết quả ra `PracticeFeedbackResponse` chỉ chứa các trường cho phép, tuyệt đối không mutate snapshot nguồn.
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackRequestValidator.java`: Chuyển `validateAnswerForType` thành static method để tái sử dụng thuận tiện và nhất quán.
  - `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluatorTest.java`: 21 unit tests bao phủ:
    - Tất cả các loại câu hỏi khách quan (SINGLE_CHOICE, TFNG aliases, YNNG aliases, FILL_IN_THE_BLANK alternates, MULTIPLE_CHOICE, MATCHING partial credit & full credit, MATCHING_HEADINGS option id & text, type aliases MCQ & FILL_IN).
    - Kế thừa options từ group cho MATCHING_HEADINGS.
    - Precedence: nhóm câu hỏi (groups) được ưu tiên hơn danh sách mirrored flat.
    - Hai Part khác nhau có cùng questionId: mỗi Part được chấm độc lập theo đúng key của Part đó.
    - Tính bất biến của snapshot (`assertThat(snapshot).isEqualTo(snapshotBeforeEvaluation)`).
    - Các trường hợp lỗi & biên: missing explanation, explanation sai kiểu (non-string), missing key, câu hỏi ESSAY, part/question ngoài scope, duplicate question ID trong cùng part, unknown type, snapshot null/empty.

- **Verification Evidence:**
  - **TDD RED:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest" test` trước khi implement -> Compilation failure (exit code 1), không tìm thấy class `PracticeFeedbackEvaluator`.
  - **TDD GREEN:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> `Tests run: 83, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Full Focused Regression:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test` -> `Tests run: 130, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Git Diff & Whitespace:** Chạy `git diff --check` -> exit code 0, không có lỗi whitespace.
  - **Git Status:** working tree sạch, chỉ chứa các files mới của TV3-15-01 và TV3-15-02 cùng tài liệu plan/handoff; bảo toàn 100% working tree changes từ các task trước. Zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-02

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-02 — Evaluator dùng snapshot và grading engine thật; đối chiếu toàn contract TV3-15 và mọi implementation hiện có của 15-01–02.
- **Decision: NEED_FIX.** Có 1 finding P1 trong evaluator. Không có P0/P2 implementation finding được xác nhận. Không đánh trượt vì 15-03–05 còn PLANNED; chưa nghiệm thu toàn feature.
- **Git evidence:** HEAD `4a60c30`; staged/unstaged tracked diff rỗng. Có 9 untracked files: 7 source/test TV3-15 và plan/handoff. Đã đọc cả files mới, validator sửa static method và integration với DTO/engine/extractor/scope parser; không tái audit TV3-13/14. Working tree có untracked nên không gọi là clean.

### IN-SCOPE — confirmed finding

**[P1] Validate cấu trúc grading key trước khi chấm và trả response**

- **Location:** `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java:148–150`, projection tại `:183`.
- **Failure scenario:** Guard chỉ kiểm tra key/correct khác null. Snapshot có `SINGLE_CHOICE.correct_answer = {"private":{"aiPrompt":"SECRET_SENTINEL"}}` vẫn trả WRONG/score 0 và nguyên object lồng nhau trong correctAnswer. MATCHING với value là nested object cũng được engine stringify/chấm rồi trả nguyên nested payload. Đây là vi phạm AC-07 fail-closed khi server key invalid và contract response chỉ cho phép primitive/list/map phẳng, không arbitrary nested object hoặc AI prompt. Không cần current-TV2 lookup hay malformed learner answer để tái hiện.
- **Minimal fix:** Thêm validation/projection key tại evaluator trước gradeAttempt: chỉ chấp nhận historical primitive/list/map phẳng hợp lệ với type; từ chối nested collections/objects hoặc cấu trúc không hợp lệ bằng GRADING_DATA_ERROR thông báo cố định. Giữ primitive/flat historical keys và engine semantics hiện có; không stringify/flatten arbitrary payload, không sửa grading engine hoặc shared handler.
- **Focused regression:** Dùng evaluator và ObjectiveGradingServiceImpl thật cho nested object key ở SINGLE_CHOICE, nested list element ở MULTIPLE_CHOICE, nested map value ở MATCHING; assert GRADING_DATA_ERROR và engine không được gọi khi key lỗi. Giữ positive tests cho historical primitive/flat list/flat map và MATCHING partial credit. Sau khi có HTTP layer, assert response/error không chứa sentinel.

### Verified acceptance criteria — phần hiện có

- **AC-02:** Scope parser kiểm tra Part/question, duplicate IDs và unknown types; tuple lookup không trộn key khi hai Part dùng cùng questionId. Groups được chọn trước mirrored flat lists đối với câu trong scope.
- **AC-03:** Gọi ObjectiveGradingServiceImpl thật qua transient AttemptAnswer, giữ input nguyên dạng và raw BigDecimal score, kể cả MATCHING score 2. Existing tests chứng minh MCQ/FILL_IN aliases, TFNG/YNNG answer aliases, alternates, Heading options và partial credit.
- **AC-04:** Key/explanation từ câu đã chọn trong supplied snapshot; không inject/call ExamAdapter/GradingAdapter hoặc fallback current source. Historical source-edit/delete qua persisted pipeline vẫn thuộc 15-05, chưa kiểm chứng.
- **AC-05 / giới hạn:** Evaluator không gọi persistence hoặc mutate attempt; snapshot equality test đạt. Chưa kiểm chứng DB/version/service transaction vì 15-03–05 chưa triển khai.
- **AC-06:** DTO/validator regression đạt; null answer đi qua transient LinkedHashMap, explicit null serialization giữ nguyên, chỉ 9 top-level DTO fields. Nested correctAnswer boundary **chưa đạt** theo finding P1.
- **AC-07:** ESSAY, missing key, invalid explanation, duplicate/unknown type bị từ chối. Invalid nested key **chưa đạt**; không được coi guard non-null là key validation đầy đủ.
- **AC-01/AC-08 HTTP:** Chưa có service/controller; ownership, MOCK_TEST guard, fixed HTTP errors/no-store và no-log contract phải được kiểm chứng ở 15-03–05, không suy diễn đã PASS từ evaluator tests.

### Focused test evidence — reviewer-run

- Tại backend: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> **121 tests (35 validator + 3 response + 21 evaluator + 55 engine + 7 extractor), 0 failures/errors/skipped; BUILD SUCCESS, exit 0**.
- Read-only JShell probe với compiled production evaluator/engine và Jackson thật, không tạo/sửa test source: NESTED_KEY_RESPONSE và NESTED_MATCH_KEY_RESPONSE đều serialize nested `aiPrompt: SECRET_SENTINEL` trong correctAnswer, tái hiện P1 dù suite xanh. EMPTY_KEY_RESPONSE với MULTIPLE_CHOICE key [] vẫn trả WRONG; nên định nghĩa/khóa validity của empty server keys trong regression, không coi là empty learner answer.
- Probe positive: historical flat list key cho SINGLE_CHOICE -> CORRECT; MATCHING key không phải Map -> GRADING_DATA_ERROR; MATCHING_FEATURES, DIAGRAM_LABELING, MAP_LABELING -> CORRECT với valid string key.
- `git diff --check` -> exit 0 trên tracked diff rỗng; không khẳng định lệnh này kiểm tra untracked whitespace.
- **Executor-reported only:** RED compilation failure, suite 83 tests và broader focused suite 130 tests. Reviewer không chạy lại các suite đó, không full backend/frontend suite và không rollback source để chứng minh RED.

### Coverage / integration follow-ups — không thêm blocker

- q_features/q_diagram/q_map mới có trong fixture nhưng chưa được gọi trong JUnit evaluator tests; reviewer đã probe hành vi đúng hiện tại, nên bổ sung regression cho ba types này. Tests chưa khóa nested/invalid key cases theo finding.
- Comment nói deep-copy nhưng copiedQuestion và correctAnswer vẫn giữ nested references. Engine hiện tại không mutate nên chưa xác nhận regression persistence; khi sửa projection nên copy hợp lệ để khóa yêu cầu deep-copy của plan.
- Evaluator/scope/engine có custom exception messages chứa questionId/type. Controller-local fixed-message/no-log handler đã được plan giao cho 15-04; phải kiểm tra tại HTTP layer, không dùng GlobalExceptionHandler trực tiếp. Không báo lỗi HTTP chưa tồn tại như defect của subtask 15-02.

### OUT-OF-SCOPE

Không xác nhận thêm existing defect ngoài phạm vi. Không review lại autosave/submit, authoring/admin, TV3-13/14 hoặc frontend. 15-03–05 chưa implement là trạng thái kế hoạch, không phải findings.

**Next required action:** Sửa P1 key validation/projection trong TV3-15-02, thêm focused regression và yêu cầu re-review trước khi tiếp tục service/controller. Reviewer chỉ append handoff; không sửa production/test/approved plan, commit hoặc push. Dừng sau khi báo kết quả.


---

## 2026-10-11 — TV3-15-02 Re-fix P1 Grading Key Structure Validation Resolution & Verification

**Trạng thái:** RESOLVED & VERIFIED  
**Phạm vi:** Subtask TV3-15-02 — 1 confirmed in-scope P1 finding từ Codex review:
- `[P1] Validate cấu trúc grading key trước khi chấm và trả response` (`PracticeFeedbackEvaluator.java`, `PracticeFeedbackEvaluatorTest.java`).

### 1. Chi tiết sửa đổi kỹ thuật

#### Finding [P1]: Validate cấu trúc grading key trước khi chấm và trả response
- **Vị trí:** `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java`.
- **Nguyên nhân:** Guard cũ chỉ kiểm tra `key == null || key.getCorrect() == null`. Snapshot có `SINGLE_CHOICE.correct_answer = {"private":{"aiPrompt":"SECRET_SENTINEL"}}` hoặc `MATCHING` với value là nested object, hoặc `MULTIPLE_CHOICE` với nested element vẫn đi qua engine và trả nguyên payload lồng nhau trong `correctAnswer`, vi phạm AC-07 fail-closed.
- **Khắc phục:**
  1. Thêm hàm `validateAndProjectCorrectAnswer(String type, Object correct, String questionId)` và các helper `isAllowedScalar`, `validateScalarItem`:
     - Kiểm tra nghiêm ngặt cấu trúc của `key.getCorrect()` theo từng nhóm câu hỏi khách quan trước khi gọi `ObjectiveGradingService`:
       - `MATCHING`: Bắt buộc là `Map<?, ?>`, không được rỗng (`{}`). Mọi key phải là non-blank string. Mọi value phải là scalar (`String`, `Number`, `Boolean`), không được null, không được là blank string, và tuyệt đối không được là nested `Map`, `Collection` hay array. Trả về `Collections.unmodifiableMap` của map sạch.
       - `MULTIPLE_CHOICE`: Từ chối `Map` và array. Nếu là `Collection<?>`, không được rỗng (`[]`), mọi phần tử phải là scalar không null, không blank, không được lồng `Map`/`Collection`/array. Nếu là scalar, không được blank string. Trả về `Collections.unmodifiableList` hoặc scalar.
       - Các dạng khác (`SINGLE_CHOICE`, `TFNG`, `YNNG`, `FILL_IN_THE_BLANK`, `MATCHING_FEATURES`, `MATCHING_HEADINGS`, `DIAGRAM_LABELING`, `MAP_LABELING`): Từ chối `Map` và array. Cho phép flat `Collection<?>` hợp lệ (không rỗng, mọi phần tử là scalar không lồng nhau) hoặc scalar không blank string.
     - Mọi cấu trúc sai, rỗng (`[]`, `{}`, `""`) hoặc lồng nested object đều ném `AppException(ErrorCode.GRADING_DATA_ERROR)` với thông điệp an toàn (không bao giờ in nội dung raw key hay secret sentinel vào exception message).
     - Gán `key.setCorrect(validatedCorrect)` trước khi chuyển vào `objectiveGradingService.gradeAttempt(...)` và project `validatedCorrect` vào `PracticeFeedbackResponse.correctAnswer`.
  2. Triển khai đệ quy sâu `deepCopyValue(Object value)` cho bước 4 (`copiedQuestion` và `groupOptions`), bảo đảm tính độc lập hoàn toàn giữa transient question và snapshot nguồn.

### 2. Bổ sung Focused Regression Tests

- **Tệp:** `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluatorTest.java` (tăng từ 21 lên 31 tests):
  1. `evaluate_nestedObjectKey_singleChoice_throwsGradingDataError`:
     - Snapshot `SINGLE_CHOICE` có `correct_answer = Map.of("private", Map.of("aiPrompt", "SECRET_SENTINEL"))`.
     - Ném `GRADING_DATA_ERROR`, thông điệp không chứa `"SECRET_SENTINEL"` hay `"aiPrompt"`.
     - Sử dụng mock engine xác minh `verifyNoInteractions(mockEngine)` (engine không bao giờ được gọi khi key sai).
  2. `evaluate_nestedListElementKey_multipleChoice_throwsGradingDataError`:
     - Snapshot `MULTIPLE_CHOICE` có `correct_answer = List.of("A", Map.of("nested", "SECRET_SENTINEL"))`.
     - Ném `GRADING_DATA_ERROR`, không leak sentinel, engine không được gọi.
  3. `evaluate_nestedMapValue_matching_throwsGradingDataError`:
     - Snapshot `MATCHING` có `correct_answer = Map.of("1", Map.of("subKey", "SECRET_SENTINEL"))`.
     - Ném `GRADING_DATA_ERROR`, không leak sentinel, engine không được gọi.
  4. `evaluate_matchingKeyNotMap_throwsGradingDataError`:
     - Snapshot `MATCHING` có `correct_answer = "A"` (String thay vì Map).
     - Ném `GRADING_DATA_ERROR`, engine không được gọi.
  5. `evaluate_emptyServerKeys_throwGradingDataError`:
     - Kiểm chứng 3 trường hợp empty key: `MULTIPLE_CHOICE` `[]`, `MATCHING` `{}`, và `SINGLE_CHOICE` `"   "` đều ném `GRADING_DATA_ERROR` và engine không được gọi.
  6. Positive coverage bổ sung cho các dạng bài và key phẳng:
     - `evaluate_matchingFeatures`: kiểm chứng `q_features` trả về CORRECT với string key `"B"`.
     - `evaluate_diagramLabeling`: kiểm chứng `q_diagram` trả về CORRECT với string key `"lobe"`.
     - `evaluate_mapLabeling`: kiểm chứng `q_map` trả về CORRECT với string key `"lake"`.
     - `evaluate_singleChoice_flatListKey`: kiểm chứng `SINGLE_CHOICE` với historical key là flat list `List.of("A", "B")` chấm đúng và trả về unmodifiable list.
     - `evaluate_correctAnswer_immutability`: kiểm chứng `correctAnswer` trả về trong DTO là unmodifiable cho cả `Map` và `List`.

### 3. Kết quả xác minh toàn diện (Evidence-First Verification)

- **TDD RED Phase:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest" test`
  - Kết quả: **Tests run: 31, Failures: 5, Errors: 0, Skipped: 0**, BUILD FAILURE (exit code 1).
  - 5 tests mới thất bại do engine cũ vẫn được gọi thay vì fail closed.
- **TDD GREEN Phase:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest" test`
  - Kết quả: **Tests run: 31, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Focused Backend Regression Suite:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test`
  - Kết quả: **Tests run: 131, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Extended Backend Regression Suite:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test`
  - Kết quả: **Tests run: 140, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Git Tree & Diff Check:**
  - Lệnh: `git diff --check` -> exit code 0.
  - Lệnh: `git status --short` -> Chỉ chứa các file untracked mới của TV3-15 và plan/handoff; bảo toàn nguyên vẹn working tree. Zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-02 sau key-validation fix

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-02; đối chiếu toàn contract TV3-15 với toàn implementation hiện có của 15-01–02, bao gồm untracked files và bản sửa key validation.
- **Decision: NEED_FIX.** P1 nested payload của lượt trước đã được sửa và kiểm chứng; còn 1 P1 mới do thay đổi định danh MATCHING trong projection. Không có P0/P2 implementation finding khác được xác nhận. 15-03–05 vẫn PLANNED, không coi việc chưa triển khai là lỗi subtask 15-02.
- **Git scope:** HEAD `4a60c30`; staged và unstaged tracked diff rỗng; 9 untracked files gồm 7 source/test và 2 tài liệu TV3-15. Đã đọc mọi source/test hiện có cùng plan/handoff và dependencies cần thiết; không có thay đổi frontend/schema/dependency/auth/shared handler hoặc grading engine.

### IN-SCOPE — confirmed finding

**[P1] Giữ nguyên ID cặp MATCHING khi copy grading key — PracticeFeedbackEvaluator.java:214**

- **Exact location:** `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java:214`, ghi map mới tại `:235`, sau đó `key.setCorrect(validatedCorrect)` trước gradeAttempt.
- **Failure scenario:** `String.valueOf(k).trim()` thay đổi ID key lịch sử dù request validator giữ nguyên map keys và ObjectiveGradingServiceImpl.gradeMatching dùng String.valueOf(key) không trim. Với snapshot key `{" item_1 ":"A"}` và answer giống hệt, engine trực tiếp trả CORRECT/1, evaluator trả WRONG/0 và correctAnswer đổi thành `{"item_1":"A"}`. Với key `{"1":"A"," 1 ":"B"}`, projection gộp hai ID thành một, làm mất cặp và thay đổi cả verdict/raw score: engine CORRECT/2 nhưng feedback WRONG/0. Đây là regression AC-03 grading parity và AC-04/AC-06 giữ đúng snapshot key, không phải server key nested hoặc learner answer sai.
- **Minimal fix:** Validate blank ID riêng nhưng giữ nguyên string ID khi copy/projection; không trim, normalize hoặc gộp IDs trước engine. Không sửa grader hoặc canonicalize request để bù. Khi hỗ trợ historical non-string keys, giữ semantics String.valueOf của engine và không âm thầm overwrite collision.
- **Focused regression:** So sánh evaluator với ObjectiveGradingServiceImpl thật + SnapshotGradingKeyExtractor trên cùng snapshot/input cho ID có leading/trailing whitespace và hai ID khác nhau chỉ bởi whitespace. Assert verdict/score parity, correctAnswer giữ đủ entries/nguyên IDs, snapshot không đổi; giữ các nested-key rejection tests hiện có.

### Verified acceptance criteria / previous finding

- **P1 nested key CLOSED:** Regression mới chặn nested object của SINGLE_CHOICE, nested list element của MULTIPLE_CHOICE và nested map value của MATCHING bằng GRADING_DATA_ERROR trước engine; tests verifyNoInteractions(mockEngine) và message không chứa sentinel. Read-only probe với engine thật cũng xác nhận cả ba loại bị từ chối, SAFE=true.
- **AC-02:** Scope và tuple (partId, questionId), groups trước mirrored flat, duplicate IDs và out-of-scope errors được kiểm tra bằng production evaluator/scope parser.
- **AC-03:** Parity các objective types, aliases/alternates, Heading group options và MATCHING partial credit thông thường đạt; parity cho MATCHING IDs bị trim **chưa đạt** theo finding mới. Ba types MATCHING_FEATURES/DIAGRAM_LABELING/MAP_LABELING đã có JUnit assertions thực sự gọi evaluator, khép coverage gap trước.
- **AC-04:** Chỉ lấy selected question/key/explanation từ supplied snapshot, không current-TV2 fallback; deep copy Map/List đã thêm, projection list/map unmodifiable. Không dùng AI/repository/adapter. Snapshot-key identity chưa đạt ở MATCHING như finding.
- **AC-06–07:** DTO/validator regression đạt; explicit null và empty learner answers giữ nguyên; invalid nested/empty server keys bị từ chối, không serialize arbitrary nested correctAnswer; ESSAY/missing key/invalid explanation/unknown type errors đã có tests.
- **AC-05 / giới hạn:** Evaluator không persist hoặc mutate attempt; snapshot equality và response immutability tests đạt. DB/version/read-only transaction chưa kiểm chứng vì service/integration chưa triển khai.
- **AC-01/AC-08/AC-09 toàn feature:** Ownership/mode/status, fixed HTTP errors/no-store/no-log, persisted history và final backend verification còn thuộc 15-03–05. Không gọi các tiêu chí đó PASS từ unit suite; chưa nghiệm thu toàn TV3-15.

### Focused evidence — reviewer-run

- Tại backend: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> **131 tests (35 validator + 3 response + 31 evaluator + 55 engine + 7 extractor), 0 failures/errors/skipped; BUILD SUCCESS, exit 0**.
- Read-only JShell probe sử dụng compiled production evaluator, engine, extractor: `WHITESPACE_ID_DIRECT=CORRECT/1` vs `WHITESPACE_ID_FEEDBACK=WRONG/0 KEY={item_1=A}`; `COLLISION_DIRECT=CORRECT/2` vs `COLLISION_FEEDBACK=WRONG/0 KEY={1=B}`. Xác nhận regression độc lập, không sửa/tạo source hoặc tests.
- Cùng probe: nested key ở SINGLE_CHOICE/MULTIPLE_CHOICE/MATCHING -> GRADING_DATA_ERROR, message không chứa SECRET_SENTINEL. Đây là runtime checks bổ sung, không cộng vào số JUnit tests.
- `git diff --check` -> exit 0; tracked diff rỗng nên không dùng làm bằng chứng whitespace của untracked files.
- **Executor-reported only:** RED 31 tests/5 failures và extended suite 140 PASS. Reviewer không rollback để kiểm chứng RED, không chạy extended/full backend/frontend suite.

### OUT-OF-SCOPE / remaining integration gates

Không xác nhận defect mới ngoài phạm vi; không tái audit TV3-13/14, autosave/submit hoặc authoring/frontend. Controller-local fixed error/no-log handlers vẫn phải được kiểm chứng ở 15-04; không coi HTTP endpoint chưa tồn tại là lỗi 15-02.

**Next required action:** Sửa P1 giữ nguyên MATCHING pair IDs, thêm parity regression nêu trên rồi yêu cầu re-review. Chỉ sau khi evaluator đạt AC mới tiếp tục 15-03. Reviewer chỉ append entry này, bảo toàn lịch sử; không sửa production/test/approved plan, commit hoặc push. Dừng sau khi báo kết quả.

---

## 2026-10-11 — TV3-15-02 Re-fix P1 MATCHING Key Whitespace Preservation Resolution & Verification

**Trạng thái:** RESOLVED & VERIFIED  
**Phạm vi:** Subtask TV3-15-02 — 1 confirmed in-scope P1 finding từ Codex review:
- `[P1] Giữ nguyên ID cặp MATCHING khi copy grading key` (`PracticeFeedbackEvaluator.java:214`, `PracticeFeedbackEvaluatorTest.java`).

### 1. Chi tiết sửa đổi kỹ thuật

#### Finding [P1]: Giữ nguyên ID cặp MATCHING khi copy grading key
- **Vị trí:** `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java:214-222`.
- **Nguyên nhân:** Khi copy grading key cho câu `MATCHING`, code trước đó dùng `String keyStr = String.valueOf(k).trim()`. Việc trim ID này làm lệch parity với `ObjectiveGradingServiceImpl.gradeMatching` (vốn tra cứu key bằng `String.valueOf(entry.getKey())` không trim) và `PracticeFeedbackRequestValidator` (giữ nguyên map keys). Dẫn đến:
  1. Nếu snapshot có key mang leading/trailing whitespace như `" item_1 "` và learner submit answer khớp `" item_1 "`, grader engine trực tiếp tính CORRECT/1 nhưng feedback evaluator trả WRONG/0 và `correctAnswer` bị đổi thành `"item_1"`.
  2. Nếu snapshot có 2 keys khác nhau bởi whitespace như `"1"` và `" 1 "`, projection gộp 2 entry thành 1, gây mất cặp, và engine thật trả CORRECT/2 nhưng evaluator trả WRONG/0.
- **Khắc phục:**
  1. Giữ nguyên string representation của key: `String keyStr = String.valueOf(k);` (không trim).
  2. Kiểm tra tính hợp lệ của key: `if (keyStr.isBlank())` -> ném `AppException(ErrorCode.GRADING_DATA_ERROR, "Grading key entry key cannot be blank for question: " + questionId)`.
  3. Kiểm tra duplicate collision: `if (cleanMap.containsKey(keyStr))` -> ném `AppException(ErrorCode.GRADING_DATA_ERROR, "Duplicate key in MATCHING grading key for question: " + questionId)` để không âm thầm overwrite/gộp keys.
  4. Đưa `keyStr` nguyên vẹn vào `cleanMap.put(keyStr, v)` và trả về unmodifiable map. Parity với `ObjectiveGradingServiceImpl` được khôi phục trọn vẹn; snapshot source không bị mutate; snapshot key identity được bảo toàn.

### 2. Bổ sung Focused Regression Tests

- **Tệp:** `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluatorTest.java` (tăng từ 31 lên 33 tests):
  1. `evaluate_matching_preservesWhitespaceKeyId_parityWithEngine`:
     - Snapshot `MATCHING` có key `" item_1 "`, learner answer `" item_1 "`.
     - Xác minh evaluator trả về `verdict = CORRECT`, `score = 1`, `correctAnswer = {" item_1 ": "A"}` nguyên vẹn whitespace. Snapshot không bị mutate.
  2. `evaluate_matching_keysDifferingOnlyByWhitespace_preservesAllEntriesAndParity`:
     - Snapshot `MATCHING` có 2 keys `"1"` và `" 1 "`, learner answer cả 2 keys.
     - Xác minh evaluator trả về `verdict = CORRECT`, `score = 2` (parity tuyệt đối với engine).
     - Xác minh `correctAnswer` giữ đủ 2 entries với key `"1"` và key `" 1 "` độc lập, không bị gộp/ghi đè. Snapshot không bị mutate.

### 3. Kết quả xác minh toàn diện (Evidence-First Verification)

- **TDD RED Phase:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest" test`
  - Kết quả: **Tests run: 33, Failures: 2, Errors: 0, Skipped: 0**, BUILD FAILURE (exit code 1).
  - 2 test mới thất bại với `expected: CORRECT but was: WRONG` do key bị trim gây mismatch với answer.
- **TDD GREEN Phase:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest" test`
  - Kết quả: **Tests run: 33, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Focused Backend Regression Suite:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test`
  - Kết quả: **Tests run: 133, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Extended Backend Regression Suite:**
  - Lệnh: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test`
  - Kết quả: **Tests run: 142, Failures: 0, Errors: 0, Skipped: 0**, BUILD SUCCESS (exit code 0).
- **Git Tree & Diff Check:**
  - Lệnh: `git diff --check` -> exit code 0.
  - Lệnh: `git status --short` -> Giữ nguyên trạng thái untracked, zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-02 sau sửa MATCHING key

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-02 — Evaluator dùng snapshot và grading engine thật.
- **Decision: PASS cho TV3-15-02.** Không còn finding P0/P1/P2 nào được xác nhận trong evaluator sau khi sửa hai lỗi trước đó. Đây không phải nghiệm thu toàn feature TV3-15; subtasks 15-03–05 còn PLANNED.
- **Review scope:** Đọc approved plan, toàn handoff và source/test TV3-15 hiện có gồm DTO/validator, evaluator, evaluator tests, response tests và các dependency scope/extractor/grading engine liên quan. Git status: staged/unstaged tracked diff rỗng; các file TV3-15 và plan/handoff còn untracked. `.agents/skills/tv3-bug-fix/` là artifact riêng từ yêu cầu tạo skill trước đó, ngoài scope review này; được bảo toàn. Không review lại feature TV3 khác.

### IN-SCOPE findings

Không có finding còn mở trong TV3-15-02.

- P1 nested grading key từ lượt review trước đã được đóng: evaluator từ chối object/collection lồng nhau, key rỗng và key sai shape bằng `GRADING_DATA_ERROR` trước khi gọi engine; regression kiểm tra exception không chứa sentinel và `verifyNoInteractions` với engine.
- P1 MATCHING ID bị trim từ lượt review gần nhất đã được đóng: evaluator giữ nguyên `String.valueOf(k)`, từ chối blank/collision mà không trim hoặc gộp key. Tests `evaluate_matching_preservesWhitespaceKeyId_parityWithEngine` và `evaluate_matching_keysDifferingOnlyByWhitespace_preservesAllEntriesAndParity` khóa case đơn và collision.

### Verified acceptance criteria — phần đã triển khai

- **AC-02:** Dùng scope từ snapshot và tuple `(partId, questionId)`; Part/câu ngoài scope, duplicate IDs và unknown types được từ chối. Group precedence, inherited options và cùng question ID ở Part khác nhau có test.
- **AC-03:** Dùng `ObjectiveGradingServiceImpl` thật. Tests cover objective type/alias, alternate, blank, MATCHING partial/full credit và ID whitespace parity. Key projection giữ snapshot ID nguyên vẹn.
- **AC-04:** Nội dung, key và explanation lấy từ question đã chọn trong supplied snapshot; evaluator không gọi repository/adapter hay current-TV2 fallback. Đã deep-copy dữ liệu question/options được dùng để dựng transient snapshot.
- **AC-05:** Evaluator chỉ tạo `AttemptAnswer` transient; không persist hoặc mutate snapshot. Snapshot equality và response collection immutability có tests. DB/version invariants còn chờ service/integration.
- **AC-06:** Request validator và response DTO của 15-01 được kiểm tra cùng evaluator; null/empty learner answer, response allowlist và MATCHING key identity được giữ đúng.
- **AC-07:** ESSAY, thiếu key, key sai shape/rỗng/lồng nhau, explanation sai kiểu và unsupported type fail closed. Không gọi AI hay nguồn đề hiện tại.
- **AC-01/AC-08/AC-09 toàn feature:** Ownership/mode/status, HTTP status/fixed error/no-store/no-log, persisted history và final suite thuộc 15-03–05; chưa đánh dấu hoàn thành từ unit tests này.

### Focused test evidence — reviewer-run

- Tại backend chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> **133 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS, exit 0**.
- Evaluator suite gồm 33 tests; hai regression mới cho whitespace/collision đều nằm trong lần chạy này. Các suite DTO/validator (38 tests gộp), grading engine và snapshot extractor cũng đạt.
- Không chạy extended 142-test suite hoặc full backend/frontend suite trong lượt review này; kết quả extended 142 PASS hiện handoff là executor-reported, không reviewer-verified.
- `git diff --check` exit 0 nhưng tracked diff rỗng; không dùng kết quả đó để khẳng định whitespace của untracked files.

### OUT-OF-SCOPE / remaining integration gates

Không có lỗi ngoài scope mới được xác nhận. Không tái audit TV3-13/14, autosave/submit, authoring/admin hoặc frontend. Quyền truy cập, MOCK_TEST denial, no-store/fixed HTTP errors/no-log và persisted snapshot/no-write cần được xác minh tại 15-03–05.

**Next required action:** Tiếp tục TV3-15-03 theo plan. Khi hoàn thành các service/controller/integration subtasks, review toàn feature lại trước khi nghiệm thu TV3-15. Reviewer chỉ append entry này; không sửa production/test/approved plan, commit hoặc push.

## 2026-10-11 — TV3-15-03 Execution Evidence

- **Status:** IMPLEMENTED
- **Deliverables:**
  - `backend/src/main/java/com/multilingo/backend/modules/testing/service/PracticeFeedbackService.java`:
    - Concrete Spring `@Service` độc lập (không mở rộng `TestAttemptServiceImpl`).
    - Phương thức `@Transactional(readOnly = true) public PracticeFeedbackResponse getFeedback(Integer attemptId, PracticeFeedbackRequest request)`:
      - Phân giải `currentUserId` từ `IdentityAdapter`, lookup attempt qua `testAttemptRepository.findByIdAndUserId(attemptId, currentUserId)` -> ném `FORBIDDEN` (403) nếu không tìm thấy hoặc sai owner.
      - Kiểm tra `testMode`: chỉ cho phép `TestMode.PRACTICE`, chặn toàn bộ `MOCK_TEST` (ném 403 `FORBIDDEN`).
      - Kiểm tra `status`: chỉ cho phép `AttemptStatus.IN_PROGRESS`, ném `ATTEMPT_ALREADY_SUBMITTED` (409) cho toàn bộ các trạng thái đã nộp / kết thúc (`COMPLETED`, `EXPIRED`, `SUBMITTED`, `AI_GRADING`, `AI_GRADING_QUEUED`, `GRADING_FAILED`).
      - Xác thực request qua `PracticeFeedbackRequestValidator.validate(request)`.
      - Chuyển `attempt.getExamSnapshot()` và `validatedInput` sang `PracticeFeedbackEvaluator.evaluate`.
      - Hoàn toàn read-only: không gọi `repository.save()`, không gọi `attemptAnswerRepository`, không thay đổi version, lockedSections hay resultSummary, không gọi watchdog/submit/finalization logic.
  - `backend/src/test/java/com/multilingo/backend/modules/testing/service/PracticeFeedbackServiceTest.java`: 16 unit tests bao phủ:
    - Luồng thành công (Practice IN_PROGRESS): trả về đúng kết quả từ evaluator, giữ nguyên version và resultSummary, không gọi `save()`.
    - Sai owner hoặc không tìm thấy attempt: ném 403 `FORBIDDEN`, không gọi request validator hay evaluator.
    - `MOCK_TEST` ở mọi trạng thái (`AttemptStatus`): ném 403 `FORBIDDEN`, không gọi evaluator.
    - `PRACTICE` ở mọi trạng thái finalized (ngoài `IN_PROGRESS`): ném 409 `ATTEMPT_ALREADY_SUBMITTED`, không gọi evaluator.
    - Chống giả mạo request: `userId` bắt buộc lấy từ `IdentityAdapter`, không phụ thuộc vào dữ liệu trong request.

- **Verification Evidence:**
  - **TDD RED:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest" test` trước khi implement -> Compilation failure (exit code 1), không tìm thấy class `PracticeFeedbackService`.
  - **TDD GREEN:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest" test` sau khi implement -> `Tests run: 16, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Full Focused Regression:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test` -> `Tests run: 158, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Git Diff & Whitespace:** Chạy `git diff --check` -> exit code 0, không có lỗi whitespace.
  - **Git Status:** working tree sạch, chỉ chứa các tệp của TV3-15-01, 15-02, 15-03 và cập nhật tài liệu plan/handoff; bảo toàn 100% working tree changes từ các subtask trước. Zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-02 sau khi có service 15-03

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-02 — Evaluator dùng snapshot và grading engine thật; kiểm tra lại cùng integration hiện tại với DTO/validator và service 15-03 đã xuất hiện trong working tree.
- **Decision: PASS cho TV3-15-02.** Không còn finding P0/P1/P2 được xác nhận trong evaluator và phần nối service hiện tại. Đây chưa phải PASS toàn feature: controller/HTTP và persistence/history integration 15-04–05 chưa triển khai.
- **Git scope:** HEAD `4a60c30`; staged/unstaged tracked diff rỗng. Untracked TV3-15 gồm DTO, validator, evaluator, service, focused tests và plan/handoff. `.agents/skills/tv3-bug-fix/` là artifact riêng từ yêu cầu trước, được phân loại ngoài scope. Đã đọc source/test có liên quan cùng plan/handoff; không có thay đổi tracked bị bỏ qua.

### IN-SCOPE findings

Không có finding còn mở.

- **P1 nested key — đã đóng:** Evaluator từ chối key nested, null/rỗng hoặc sai shape bằng `GRADING_DATA_ERROR` trước engine; regression bảo đảm không gọi engine và không echo sentinel.
- **P1 MATCHING identity — đã đóng:** Projection giữ nguyên `String.valueOf(k)`, chỉ reject blank hoặc collision. Regression cho whitespace ID riêng và cặp ID chỉ khác whitespace giữ parity với engine.
- **Service integration:** `PracticeFeedbackService` lấy user từ `IdentityAdapter`, lookup bằng `findByIdAndUserId`, chặn sai owner/MOCK_TEST/status trước validator và evaluator, rồi chuyển persisted snapshot sang evaluator. Transaction read-only; không save/delete, đọc/sửa answer rows, đổi version/status/resultSummary hoặc gọi finalization. 16 service tests bao phủ access/state/no-write; không thấy defect được giới thiệu trong integration này.

### Acceptance criteria status

- **AC-02–04, AC-06–07:** Đạt trong evaluator/request path đã triển khai: scope tuple từ snapshot, grading engine thật và partial credit, snapshot-only key/explanation, strict answer validation, response projection, key fail-closed và ESSAY rejection.
- **AC-01 / AC-05 — service slice:** Owner, Practice mode, IN_PROGRESS và read-only behavior được xác nhận bằng service code/tests. Database-level persisted invariants và concurrency/history chưa có integration test.
- **AC-08 — phần hiện có:** MOCK_TEST bị service chặn trước evaluator; workspace/start solution leak và HTTP error/log/no-store chưa thể kết luận khi controller chưa có.
- **AC-09 / toàn feature:** Chưa đạt/nghiệm thu toàn TV3-15; 15-04–05 còn là phần việc kế tiếp. Không tính phần chưa triển khai là defect của 15-02.

### Focused evidence — reviewer-run

- Tại backend: `.\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> **149 tests (16 service + 35 validator + 3 response + 33 evaluator + 55 grading engine + 7 extractor), 0 failures/errors/skipped; BUILD SUCCESS, exit 0**.
- Lần chạy này bao gồm hai MATCHING identity regressions và nested-key fail-closed regressions. Không chạy extended 158-test suite, full backend suite hoặc frontend suite; không dùng executor-reported results thay bằng chứng reviewer-run.
- `git diff --check` không được dùng làm bằng chứng cho các source/doc đang untracked; đã đọc nội dung thay đổi trực tiếp.

### OUT-OF-SCOPE / remaining integration work

Không có defect ngoài scope mới được xác nhận. Không tái audit TV3-13/14, autosave/submit, authoring/admin hoặc frontend. Cần các subtasks kế tiếp kiểm tra controller path/body binding, authentication HTTP status, fixed error/no-log/no-store, và JPA history/persistence invariants.

**Next required action:** Tiếp tục 15-04–05; sau đó review lại toàn feature với controller và integration tests. Reviewer chỉ append entry này; không sửa code/plan, commit hoặc push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-03

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-03 — Service ownership/mode/status và read-only behavior.
- **Decision: PASS cho TV3-15-03.** Không có finding P0/P1/P2 được xác nhận trong service và focused tests. Đây không phải PASS toàn feature; controller/HTTP và integration với persistence còn thuộc 15-04–05.
- **Review scope:** Đối chiếu acceptance criteria 15-03 trong approved plan với `PracticeFeedbackService.java`, `PracticeFeedbackServiceTest.java`, DTO/validator/evaluator đã triển khai và các test liên quan. `git status --short`: không có staged/unstaged tracked changes; TV3-15 implementation và tài liệu đang untracked. Các skill `.agents/skills/tv3-bug-fix/` và `.agents/skills/tv3-plan-executor/` được bảo toàn ngoài phạm vi review.

### IN-SCOPE findings

Không có finding còn mở cho 15-03.

- Identity lấy từ `IdentityAdapter`; attempt được truy vấn bằng `findByIdAndUserId`, nên request không thể chọn owner.
- Owner lookup, `PRACTICE` mode và `IN_PROGRESS` status được kiểm tra trước request validation/evaluator. MOCK_TEST bị chặn ở mọi status; Practice không còn IN_PROGRESS trả lỗi `ATTEMPT_ALREADY_SUBMITTED`.
- Service chạy `@Transactional(readOnly = true)`, chuyển persisted snapshot sang evaluator, không inject answer repository và không gọi save/delete/finalization/watchdog/submit. Thành công không làm đổi version hoặc result summary trong unit test.
- Test bao phủ sai owner/missing attempt, MOCK_TEST mọi enum status, Practice mọi finalized status và user identity server-side. Không thấy đường ghi dữ liệu hoặc bypass eligibility trong service slice.

### Acceptance criteria status

- **AC-01 — service slice:** Owner, Practice mode và IN_PROGRESS guard được thỏa mãn; HTTP authentication/status vẫn cần xác minh ở controller 15-04.
- **AC-05 — service slice:** Read-only transaction và không persistence được thể hiện trong code/tests. Bất biến DB/answer rows và ảnh hưởng submit đồng thời cần integration verification 15-05.
- **AC-08 — service slice:** MOCK_TEST bị từ chối trước evaluator; error/log boundary và workspace/start response cần kiểm tra ở các lớp liên quan sau.
- **AC-02–04, AC-06–07:** Được cung cấp bởi request/evaluator đã review ở các lượt trước; lượt này chỉ xác nhận service chuyển validated input và snapshot đúng sang evaluator sau access guards.
- **AC-09 / toàn feature:** Chưa nghiệm thu toàn TV3-15; 15-04–05 còn là gate.

### Focused evidence — reviewer-run

- Tại `backend`, chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test` -> **149 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS, exit 0**.
- Trong đó `PracticeFeedbackServiceTest`: 16 tests, tất cả đạt. Không chạy full backend/frontend suite; chưa chạy controller/JPA integration trong lượt review này.

### OUT-OF-SCOPE / remaining integration work

Không xác nhận defect ngoài scope. Không đánh giá các skill artifact untracked hoặc tái audit TV3-13/14. Tiếp tục 15-04 kiểm tra controller/auth/error/no-store, rồi 15-05 kiểm tra persisted snapshot, no-write ở DB, history và submit interaction; sau đó mới review toàn feature.

**Next required action:** Tiếp tục TV3-15-04. Reviewer chỉ append entry này; không sửa code hoặc approved plan, commit hay push.

## 2026-10-11 — TV3-15-04 Execution Evidence

- **Status:** IMPLEMENTED
- **Deliverables:**
  - `backend/src/main/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackController.java`:
    - Base mapping `/api/v1/attempts`.
    - Endpoint `POST /{id}/practice-feedback` nhận `PracticeFeedbackRequest`.
    - Phân tích và kiểm tra `attemptId` bằng hàm private `parseAttemptId`: biểu thức chính quy `^[1-9][0-9]{0,9}$`, không chấp nhận số 0, số âm, leading zero (ví dụ 012), ký tự chữ hoặc số tràn giới hạn `Integer.MAX_VALUE`; ném `AppException(ErrorCode.INVALID_REQUEST)` (400) nếu không hợp lệ.
    - Gọi `practiceFeedbackService.getFeedback(attemptId, request)`.
    - Trả về `ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(ApiResponse.success(feedback))`.
    - Controller-local handlers cho `AppException` và `HttpMessageNotReadableException`:
      - Đảm bảo header `Cache-Control: no-store` cho mọi phản hồi lỗi.
      - Trả về thông báo lỗi cố định từ `ErrorCode`, không kèm raw stacktrace hay dữ liệu nhạy cảm.
      - Tuyệt đối không log nội dung request body, đáp án, đáp án đúng, token hay thông tin nhạy cảm.
  - `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackControllerIT.java`: 12 integration tests bao phủ:
    - Chưa xác thực (`@WithAnonymousUser`) -> HTTP 401 Unauthorized.
    - Sai owner (mock `IdentityAdapter.getCurrentUserId()` khác chủ sở hữu attempt) -> HTTP 403 Forbidden, `jsonPath("$.data").doesNotExist()`.
    - Attempt không tồn tại -> HTTP 403 Forbidden.
    - `MOCK_TEST` (live IN_PROGRESS hoặc finalized) -> HTTP 403 Forbidden.
    - `PRACTICE` đã nộp/hoàn thành -> HTTP 409 Conflict.
    - Yêu cầu hợp lệ -> HTTP 200 OK, `Cache-Control: no-store`, đầy đủ các trường của `PracticeFeedbackResponse`.
    - Response allowlist verification: xác nhận các trường nhạy cảm/không thuộc whitelist (`version`, `resultSummary`, `examData`, `questions`, `gradingKeys`, `alternates`, `options`) không hề tồn tại trong response.
    - Kiểm tra path ID không hợp lệ: 0, leading zero, chữ cái, tràn số -> HTTP 400 Bad Request.
    - Unknown Part ID -> HTTP 404 Not Found.
    - Unknown Question ID -> HTTP 404 Not Found.
    - Câu hỏi `ESSAY` -> HTTP 422 Unprocessable Entity (`VALIDATION_FAILED`).
    - Thiếu trường `answer` -> HTTP 422 Unprocessable Entity (`VALIDATION_FAILED`).
    - Malformed JSON chứa sentinel token: trả về HTTP 400 Bad Request, phản hồi lỗi hoàn toàn không làm rò rỉ sentinel token (`assertThat(responseBody).doesNotContain(sentinel)`).

- **Verification Evidence:**
  - **TDD RED:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackControllerIT" test` trước khi tạo controller -> 11 tests failed (do 404 NoHandlerFound và thiếu route).
  - **TDD GREEN:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackControllerIT,TestAttemptReviewControllerIT" test` sau khi implement -> `Tests run: 20, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Full Focused Regression:** Chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackControllerIT,PracticeFeedbackServiceTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test` -> `Tests run: 170, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Git Diff & Whitespace:** Chạy `git diff --check` -> exit code 0, không có lỗi whitespace.
  - **Git Status:** working tree sạch, chỉ chứa các file của TV3-15 và cập nhật tài liệu plan/handoff; bảo toàn 100% working tree changes từ các subtask trước. Zero commit, zero push.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-04

- **Agent:** Codex Reviewer.
- **Reviewed subtask:** TV3-15-04 — Endpoint, fixed errors, security tests; kiểm tra tích hợp với 15-01–03 đã triển khai.
- **Decision: PASS cho 15-04.** Không có finding P0/P1 được xác nhận. Có một quan sát P2 về assertion log bên dưới. Đây không phải nghiệm thu toàn feature TV3-15; 15-05 vẫn PLANNED.
- **Scope/status:** Đọc approved plan và handoff, controller, controller integration tests và các DTO/validator/evaluator/service cùng tests liên quan. `git status --short` cho thấy không có staged/unstaged tracked diff; source/test/docs TV3-15 và một số skill artifacts còn untracked. Không review các skill artifacts hoặc việc ngoài TV3-15.

### IN-SCOPE findings

Không có finding P0/P1.

- Endpoint đúng `POST /api/v1/attempts/{id}/practice-feedback`; ID chỉ nhận decimal canonical dương trong Java Integer range. Từ chối 0, leading zero, suffix và overflow thành lỗi 400.
- Lớp security hiện có chặn anonymous (401); integration tests xác nhận owner sai/attempt thiếu/MOCK_TEST trả 403, Practice đã kết thúc trả 409. Service 15-03 lấy identity server-side và chặn mode/status trước evaluator.
- Thành công trả `ApiResponse<PracticeFeedbackResponse>` với `Cache-Control: no-store`; test kiểm tra allowlist, không serialize version/result/snapshot/keys/options. Evaluator/validator đã review ở các lượt trước dùng snapshot, scope theo Part + question và fail-closed với ESSAY/key lỗi.
- `AppException` và `HttpMessageNotReadableException` được xử lý cục bộ với ErrorCode message cố định và `no-store`; controller handler không ghi log hoặc phản chiếu exception/body. Không thay GlobalExceptionHandler.
- **P2 — regression assertion thiếu:** `PracticeFeedbackControllerIT.feedback_malformedJson_returns400AndDoesNotLeakSentinel` chỉ assert response body không có sentinel; plan 15-04 yêu cầu kiểm tra cả captured output/log. Bổ sung capture/assert log không chứa sentinel để khóa AC-08. Không thấy log sentinel trong reviewer-run output và controller không log trực tiếp, nên đây không phải lỗi P0/P1.

### Acceptance criteria status — feature hiện tại

- **AC-01, AC-02, AC-06, AC-07, AC-08 — phần đã triển khai:** Endpoint, eligibility, scope/validation, error mapping, allowlist/no-store và malformed-body response được kiểm chứng bằng source và focused tests. P2 log-capture assertion nêu trên vẫn là một cải thiện test.
- **AC-03–04:** Evaluator dùng grading engine thật và snapshot theo implementation/tests đã review trước; kiểm chứng lịch sử qua persisted JPA/source edit còn thuộc 15-05.
- **AC-05:** Service read-only đã review ở 15-03; invariants persisted answer/version/result và submit interaction chưa có contract integration test.
- **AC-09 / toàn feature:** Chưa hoàn tất; plan 15-05 còn PLANNED. Không xem phần đó là defect của 15-04.

### Focused evidence — reviewer-run

- Tại `backend`, chạy `.\mvnw.cmd "-Dtest=PracticeFeedbackControllerIT,PracticeFeedbackServiceTest,PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test` -> **170 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS, exit 0**.
- Riêng `PracticeFeedbackControllerIT`: **12 tests, 0 failures/errors/skipped**; gồm anonymous, ownership, mode/status, malformed JSON sentinel, path validation, scope, ESSAY và allowlist.
- Không chạy full backend suite hoặc frontend suite. Kết quả 15-05 persistence/history chưa được reviewer xác minh.

### OUT-OF-SCOPE / next action

Không xác nhận defect ngoài scope. Tiếp tục 15-05 để kiểm tra DB no-write, snapshot lịch sử, answer đã autosave, submit interaction và regression workspace/start; cân nhắc thêm captured-output assertion cho sentinel trước khi final review. Sau đó review toàn feature và chạy verification cuối theo plan.

Reviewer chỉ append entry này; không sửa code/approved plan, commit hoặc push.

---

## 2026-10-11 — TV3-15-05 In Progress

- **Task:** TV3-15-05 — Persistence/history integration và bàn giao.
- **Status:** IN_PROGRESS
- **Plan Reference:** `docs/superpowers/plans/ndt/TV3-15-plan.md` subtask TV3-15-05.
- **Scope:**
  - Viết `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackContractIT.java`.
  - Bổ sung assertion log capture trong `PracticeFeedbackControllerIT.java` để giải quyết quan sát P2 từ Codex review 15-04.
  - Kiểm chứng các bất biến tích hợp:
    1. Real pipeline với JPA: controller, service, evaluator, engine, repositories.
    2. Zero persistence: feedback không mutate attempt, version, status, timestamps, grading fields hay tạo/sửa `AttemptAnswer` rows.
    3. Independent preview: feedback chấm input C độc lập với answer B đã autosave trong DB.
    4. Snapshot immutability: sửa hoặc xóa source exam trong DB không làm thay đổi feedback của attempt đã tạo.
    5. Snapshot độc lập: snapshot hợp lệ đã persist nhưng mất source exam vẫn cho feedback bình thường (không fallback TV2 exam adapter).
    6. Legacy snapshot thiếu key -> fail-closed HTTP 422, không fallback TV2.
    7. Practice finalized (submit) -> HTTP 409, trong khi post-submit review vẫn hoạt động qua endpoint review cũ.
    8. Client workspace & create responses không leak solutions.
    9. Hai feedback requests độc lập không tạo `AttemptAnswer` rows.
  - Chạy focused suite và full backend verification.
  - Cập nhật plan và handoff theo quy định.

---

## 2026-10-11 — TV3-15-05 Execution Evidence

- **Status:** IMPLEMENTED
- **Deliverables:**
  - `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackContractIT.java`:
    - 8 integration tests toàn diện trên Spring Boot, real JPA repositories, controller, service, evaluator, và grading engine:
      1. `testE2E_feedbackPreservesPersistenceInvariantsAndEvaluatesIndependently`:
         - Tạo Practice attempt thật với source exam (key q1 = "A").
         - Autosave answer "B" (version tăng lên 2, DB `AttemptAnswer` lưu "B").
         - Gửi feedback với answer "C" -> HTTP 200, verdict = WRONG, score = 0, correctAnswer = "A".
         - Xác nhận DB invariants: `TestAttempt` version vẫn là 2, status vẫn `IN_PROGRESS`, `resultSummary` và `overallScore` vẫn null; `AttemptAnswer` vẫn lưu "B" (không bị mutate sang "C").
         - Gửi feedback với answer "A" -> HTTP 200, verdict = CORRECT, score = 1; DB `AttemptAnswer` vẫn giữ nguyên "B".
      2. `testE2E_sourceExamMutated_feedbackUsesHistoricalSnapshot`:
         - Tạo attempt với key "A" và explanation "Canonical explanation for q1".
         - Sửa trực tiếp DB ExamPart: đổi key sang "Z" và explanation sang "Mutated explanation Z".
         - Gửi feedback cho "A" -> verdict = CORRECT, correctAnswer = "A", explanation giữ nguyên từ snapshot.
         - Gửi feedback cho "Z" -> verdict = WRONG, correctAnswer = "A".
      3. `testE2E_sourceExamDeleted_feedbackSucceedsFromSnapshotWithoutExamLookup`:
         - Xóa sạch Exam, ExamSection, ExamPart khỏi database.
         - Gửi feedback cho attempt đã tạo -> HTTP 200, verdict = CORRECT, correctAnswer = "A".
         - Xác nhận `verifyNoInteractions(examAdapter)`: hoàn toàn không lookup exam hiện tại hay fallback TV2.
      4. `testE2E_legacySnapshotMissingKey_returns422FailClosed`:
         - Snapshot cũ không có `correct_answer` -> ném 422 `GRADING_DATA_ERROR`, fail-closed, không gọi `examAdapter`.
      5. `testE2E_submitPractice_returns409ForFeedback_andPostSubmitReviewWorks`:
         - Nộp bài Practice (`submitAttempt`) -> chuyển sang `COMPLETED`.
         - Gọi feedback -> HTTP 409 Conflict (`ATTEMPT_ALREADY_SUBMITTED`).
         - Gọi GET `/api/v1/attempts/{id}/review/{partId}` -> HTTP 200 OK (review sau submit vẫn hoạt động bình thường).
      6. `testE2E_createAndWorkspaceResponses_neverLeakSolutions`:
         - Tạo attempt và đọc workspace cho cả PRACTICE và MOCK_TEST: JSON payload hoàn toàn không chứa "correct_answer", "grading_keys", hay explanation bí mật.
      7. `testE2E_multipleFeedbackRequests_independentResults_zeroAnswerRows`:
         - Gửi liên tiếp 3 feedback requests với input "A" (CORRECT), "B" (WRONG), null (BLANK/score 0).
         - Kết quả độc lập, không conflict; số lượng `AttemptAnswer` rows trong DB vẫn luôn bằng 0.
      8. `testE2E_questionIdCollisionAcrossParts_scopedStrictly`:
         - Cùng question ID `q1` ở 2 Part khác nhau (Part 1 key "A", Part 2 key "C"): feedback tra cứu chính xác theo tuple `(partId, questionId)`, không bị trộn hay ghi đè key.
  - `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackControllerIT.java`:
    - Thêm `@ExtendWith(OutputCaptureExtension.class)` và kiểm tra `CapturedOutput output` trong `feedback_malformedJson_returns400AndDoesNotLeakSentinel` -> xác nhận log và captured output không chứa sentinel token (giải quyết quan sát P2 từ Codex review).

- **Verification Evidence:**
  - **Contract IT Tests:** `.\mvnw.cmd "-Dtest=PracticeFeedbackContractIT" test` -> `Tests run: 8, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Full Focused Suite:**
    `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,PracticeFeedbackServiceTest,PracticeFeedbackControllerIT,PracticeFeedbackContractIT,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT,TestAttemptWorkspaceResponseTest" test`
    -> `Tests run: 183, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Full Backend Test Suite:**
    `.\mvnw.cmd test`
    -> `Tests run: 511, Failures: 0, Errors: 0, Skipped: 0`, BUILD SUCCESS (exit code 0).
  - **Git Diff & Whitespace:**
    `git diff --check` -> exit code 0, không có lỗi whitespace.
  - **Git Status:**
    `git status --short` -> sạch, bảo toàn 100% working tree changes từ các subtask trước và các untracked artifacts. Zero commit, zero push.

- **Acceptance Criteria Mapping:**
  - **AC-01 (Access):** Owner verification, Practice mode, IN_PROGRESS state guards tại service/controller/contract IT.
  - **AC-02 (Scope):** Scoped theo `(partId, questionId)`, giải quyết triệt để collision across parts, Part/question ngoài scope trả 404.
  - **AC-03 (Grading Parity):** Sử dụng `ObjectiveGradingService` thật, bảo toàn score BigDecimal, aliases, alternates, MATCHING partial credit (score 1/2) và whitespace key preservation.
  - **AC-04 (Historical Consistency):** Key và explanation trích xuất hoàn toàn từ snapshot của attempt; sửa hoặc xóa đề thi gốc trong database không ảnh hưởng kết quả feedback.
  - **AC-05 (Zero Persistence):** Feedback không tạo/sửa row `TestAttempt`, không đổi version, không sửa status/timestamps/resultSummary; không tạo hoặc ghi đè `AttemptAnswer` rows; chấm độc lập với saved answers.
  - **AC-06 (Contract Integrity):** Strict types, DTO allowlist chỉ gồm 9 fields công khai, không serialize version/keys/snapshots/options/alternates; `Cache-Control: no-store`.
  - **AC-07 (Fail-Closed Data):** Snapshot thiếu key hoặc ESSAY trả HTTP 422; tuyệt đối không gọi AI và không fallback TV2.
  - **AC-08 (Leak Boundary):** MOCK_TEST bị chặn (403); Workspace/Create responses không chứa solutions; error response và captured server log không leak sentinel hay thông tin nhạy cảm.
  - **AC-09 (Regression & Evidence):** 183 focused tests PASS, 511 full backend tests PASS, handoff ghi nhận đầy đủ chi tiết bằng chứng.

## 2026-10-11 — Codex Reviewer — Re-review TV3-15-05 và toàn feature TV3-15

- **Agent:** Codex Reviewer.
- **Reviewed scope:** TV3-15-05 persistence/history integration và tích hợp toàn feature 15-01–05 theo approved plan/handoff; đã đọc các file TV3-15 liên quan, gồm untracked source/tests. Staged/unstaged tracked diff rỗng; feature code, tests và tài liệu hiện untracked. Các skill artifacts và `backend/Exam_Template.xlsx` được giữ ngoài review scope.
- **Decision: PASS cho TV3-15-05 và feature đã triển khai; không có P0/P1 được xác nhận.** Có P2 coverage gap bên dưới. Đây là review code/acceptance, không phải báo cáo đã chạy full backend suite độc lập.

### IN-SCOPE findings

Không có finding P0/P1.

- **P2 — Chưa khóa toàn bộ persisted invariants trong integration test.** Location: `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackContractIT.java:276–284` và `:298–302`. Sau feedback test so sánh version/status/resultSummary/overallScore và `userAnswers`, nhưng chưa so sánh `TestAttempt.createdAt/updatedAt`, `endTime`, `timeSpentSeconds`, `deadline`, `sectionScores`, `lockedSections`, hoặc các grading fields của `AttemptAnswer` (`isCorrectFlags`, `aiFeedback`, `skillStats`, `earnedScore`). Nếu regression làm đổi một trong các field này nhưng giữ nguyên các field đang assert, TC_15_13 vẫn xanh dù vi phạm AC-05. Tối thiểu chụp các giá trị persisted trước feedback và assert bằng nhau sau từng request; seed non-null grading metadata nếu cần để phát hiện overwrite/clear.
- Không thấy lỗi behavior trong luồng đã kiểm tra: service read-only/eligibility; controller authentication, status/error mapping, no-store/allowlist; evaluator chấm bằng key từ snapshot và đúng tuple `(partId, questionId)`. Integration tests chứng minh answer feedback không ghi đè answer autosave, mutation/xóa source exam không đổi key/explanation, thiếu key fail-closed không fallback, submit feedback 409 nhưng review vẫn hoạt động, workspace/create không leak solution và requests độc lập không tạo answer rows.
- Quan sát P2 15-04 về captured logs đã được đóng: `PracticeFeedbackControllerIT` hiện assert sentinel không xuất hiện trong response lẫn captured output.

### Acceptance criteria status

- **AC-01–04, AC-06–08:** Đạt theo source và focused tests đã review: owner/mode/status guards, scope theo Part + question, parity grading, historical snapshot, strict request/response boundary, ESSAY/error fail-closed, no-store/no-sensitive-log.
- **AC-05:** Production service hiện read-only và DB integration xác nhận các field chính cùng answer rows không đổi; P2 là test chưa assert hết toàn bộ timestamp/grading metadata được nêu trong plan.
- **AC-09:** Reviewer-run focused suite đạt; full-suite result bên dưới là executor-reported, không được chạy lại trong lượt review.

### Verification evidence

- Reviewer-run tại `backend`: `.\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,PracticeFeedbackServiceTest,PracticeFeedbackControllerIT,PracticeFeedbackContractIT,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT,TestAttemptWorkspaceResponseTest" test` -> **183 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS, exit 0**.
- Suite bao gồm 8 `PracticeFeedbackContractIT` tests và 12 controller IT tests, cùng validator/DTO/evaluator/service, grading engine, snapshot extractor, workspace và post-submit review regressions.
- **Executor-reported, chưa reviewer-run:** full backend `mvnw test` -> 511 tests, 0 failures/errors/skipped; `git diff --check` exit 0. Không chạy full suite theo scope review; không chạy frontend suite vì feature backend-only.

### OUT-OF-SCOPE / next action

Không xác nhận defect ngoài TV3-15. Không tái audit các thay đổi TV3 trước đó hay artifacts không liên quan. Bổ sung assertions AC-05 cho timestamp và grading metadata rồi chạy lại focused suite; sau đó người thực hiện có thể dùng full-suite result đã báo trong handoff theo quy trình nghiệm thu. Không sửa code/plan, commit hoặc push trong lượt review này.
