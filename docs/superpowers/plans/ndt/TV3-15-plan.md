# TV3-15 — API phản hồi tức thì cho Practice — Implementation Plan

> **Executor:** dùng executing-plans, triển khai tuần tự theo RED → GREEN; đọc plan, handoff và repository instructions trước khi sửa. Không commit hoặc push.

**Ngày:** 2026-10-11  
**Trạng thái:** PLANNED  
**Baseline:** HEAD adf459c, branch feature/TV3-00-contract-audit.

**Goal:** Người học đang luyện tập có thể kiểm tra một câu khách quan và nhận phản hồi từ backend, sử dụng snapshot của attempt mà không thay đổi bài làm đã lưu.

**Architecture:** PracticeFeedbackController → PracticeFeedbackService → PracticeFeedbackEvaluator → ObjectiveGradingService. Service kiểm tra owner/mode/status; evaluator lấy đúng câu và key từ snapshot server, chấm bằng engine hiện có rồi trả DTO giới hạn theo câu.

**Tech stack:** Java 21, Spring Boot 3.3.4, Spring Security, Jackson, JPA, JUnit 5, Mockito, MockMvc, H2.

**Spec:** Yêu cầu TV3-15 và các quyết định đã chốt trong hội thoại:

1. Kiểm tra một câu, định danh bằng partId + questionId.
2. Chỉ kiểm tra đáp án trong request; không ghi DB hoặc tăng version.
3. Trả verdict, raw score, correct answer và explanation.
4. ESSAY không thuộc phạm vi chấm tức thì.

**Tài liệu đích:**

- docs/superpowers/plans/ndt/TV3-15-plan.md
- docs/superpowers/plans/ndt/TV3-15-handoff.md

## 1. Phạm vi và repository findings

### VERIFIED — Hiện trạng

- Chưa có endpoint Practice feedback.
- TestAttemptController đang cung cấp create/workspace/autosave/submit/result/review.
- getAttemptReview từ chối attempt IN_PROGRESS; không thay đổi guard này để phục vụ Practice.
- ObjectiveGradingService.gradeAttempt(...) là pure grading function, hỗ trợ các dạng câu khách quan hiện tại.
- Verdict của engine là CORRECT, WRONG, BLANK.
- MATCHING có partial credit: score bằng số cặp đúng; verdict chỉ CORRECT khi tất cả cặp đúng. Không giới hạn score về [0,1].
- AttemptResultScope.read(...) kiểm tra scope, ID trùng và chuẩn hóa type; có aliases MCQ → SINGLE_CHOICE, FILL_IN → FILL_IN_THE_BLANK.
- TV3-13 đã bổ sung snapshot có answer key/explanation phía server qua findSnapshotById.
- Workspace response đi qua WorkspaceSnapshotSanitizer; không trả key/explanation.
- SnapshotGradingKeyExtractor có thể lấy key từ snapshot. Không cần gọi adapter đọc đề TV2 hiện tại.
- TestAttemptRepository.findByIdAndUserId(...) hỗ trợ ownership lookup.
- Security configuration yêu cầu authentication cho endpoint mới theo mặc định.
- Test profile dùng FixtureIdentityAdapter, trả cố định user ID 1. Thay username trong @WithMockUser không đủ để kiểm tra nhiều owner.
- Frontend chưa có luồng Practice feedback. TV3-15 chỉ triển khai backend API; tích hợp UI là task tiếp theo.

### Working tree

Có 62 entries trong git status --short, gồm implementation TV3-13/14, tests, docs và backend/Exam_Template.xlsx. Các thay đổi này đã tồn tại trước TV3-15 và phải được bảo toàn.

Handoff TV3-13/14 có kết luận PASS; implementation vẫn chưa commit. Executor phải đọc trạng thái mới nhất trước khi bắt đầu.

### Baseline đã chạy trong lượt planning

Tại backend:

    .\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT" test

Kết quả: 71 tests, 0 failures, 0 errors, 0 skipped; BUILD SUCCESS.

Tại repository root:

    git diff --check

Kết quả: exit 0; có thông báo LF/CRLF.

Không chạy full backend suite hoặc frontend suite trong lượt planning này.

### Global constraints

- Chỉ sửa backend testing module và hai tài liệu TV3-15.
- Không sửa schema, migration, dependency, frontend, shared auth hoặc shared exception handler.
- Không thay đổi grading rules, autosave, submit, result hoặc post-submit review contract.
- Không lưu feedback vào result_summary, is_correct_flags, earned_score hoặc ai_feedback.
- Không ghi/tăng version, thay status, deadline, locked sections hoặc timestamps.
- Không lấy key/explanation từ TV2 hiện tại, kể cả khi snapshot cũ thiếu key.
- Không trả snapshot, toàn Part, alternates, AI prompt hoặc grading key object.
- Không log request body, đáp án người học, correct answer, explanation hoặc token.
- Không commit/push.

### Review focus

1. Mode gửi trong body không thể mở feedback cho MOCK_TEST.
2. Cùng question ID ở nhiều Part không được dùng key của Part khác.
3. Snapshot lỗi/thiếu key phải fail closed, không trả một kết quả chấm giả.
4. Feedback không được làm thay đổi dữ liệu đã autosave hoặc ảnh hưởng submit đồng thời.
5. Malformed JSON không được đưa nội dung đáp án vào log hoặc error response.

## 2. Contract và acceptance criteria

### Endpoint mới — DECISION

    POST /api/v1/attempts/{id}/practice-feedback
    Content-Type: application/json

Dùng POST vì đáp án nằm trong body; không đưa answer vào URL/query/log truy cập.

Request:

    {
      "partId": 10,
      "questionId": "q_1",
      "answer": "A"
    }

Không yêu cầu version hoặc baseVersion; đây không phải thao tác lưu.

### Validation request

- Attempt ID: số thập phân chuẩn từ 1 đến 2147483647; không nhận leading zero, suffix, exponent hoặc khoảng trắng.
- partId: JSON integer dương trong Java integer range; không coercion từ string, boolean hoặc số lẻ.
- questionId: JSON string không blank, so khớp chính xác với ID canonical trong snapshot; không parse thành integer.
- answer bắt buộc hiện diện, nhưng có thể là null.
- Answer union: string | string[] | Record<string, string> | null.
- Không trim hoặc mutate answer trước khi chuyển vào grading engine.
- Các field khác không được dùng để chọn owner/mode/key hoặc thay đổi dữ liệu.
- Shape theo type:

| Type | Answer hợp lệ |
|---|---|
| SINGLE_CHOICE, TFNG, YNNG, FILL_IN_THE_BLANK, MATCHING_FEATURES, MATCHING_HEADINGS, DIAGRAM_LABELING, MAP_LABELING | string hoặc null |
| MULTIPLE_CHOICE | string[] hoặc null |
| MATCHING | Record<string,string> hoặc null |
| ESSAY | Không hỗ trợ; HTTP 422 |

Empty string, empty array, empty map và null hợp lệ khi tương ứng với type; verdict do engine quyết định.

### Response thành công

Dùng ApiResponse<PracticeFeedbackResponse>:

    {
      "success": true,
      "code": 200,
      "message": "Success",
      "data": {
        "attemptId": 42,
        "partId": 10,
        "questionId": "q_1",
        "type": "SINGLE_CHOICE",
        "userAnswer": "A",
        "verdict": "CORRECT",
        "score": 1,
        "correctAnswer": "A",
        "explanation": "Lời giải của câu q_1."
      }
    }

Quy tắc:

- userAnswer là snapshot input được kiểm tra, không phải đáp án đã autosave.
- score là BigDecimal từ engine, không quy đổi band hoặc thang điểm.
- correctAnswer lấy từ key của đúng câu trong snapshot.
- Giữ các kiểu primitive/list/map phẳng hợp lệ của key lịch sử; không trả arbitrary nested object.
- explanation là string hoặc null, lấy từ đúng question snapshot; không fallback sang explanation của group/Part/đề hiện tại.
- DTO có explicit null cho userAnswer và explanation.
- Response không có version, trạng thái đã lưu, resultSummary, examData, questions hoặc gradingKeys.
- Controller response dùng Cache-Control: no-store.
- Rich-text explanation là dữ liệu JSON; frontend tích hợp sau phải dùng sanitizer hiện có trước khi render HTML.

### Access và lỗi

Thứ tự kiểm tra nghiệp vụ:

1. Authentication theo security chain hiện có.
2. Owner lookup.
3. testMode === PRACTICE.
4. status === IN_PROGRESS.
5. Part thuộc snapshot scope.
6. Question thuộc đúng Part.
7. Type/answer/key hợp lệ.
8. Grading và projection response.

| Trường hợp | HTTP / code |
|---|---|
| Không đăng nhập | 401, auth handler hiện có |
| Không tồn tại hoặc sai owner | 403 / FORBIDDEN |
| MOCK_TEST, kể cả đã kết thúc | 403 / FORBIDDEN |
| Practice đã rời IN_PROGRESS | 409 / ATTEMPT_ALREADY_SUBMITTED |
| Part/question không thuộc scope | 404 / RESOURCE_NOT_FOUND |
| Path hoặc malformed JSON | 400 / INVALID_REQUEST |
| Field/answer shape sai, ESSAY | 422 / VALIDATION_FAILED |
| Snapshot/key/type dữ liệu server lỗi | 422 / GRADING_DATA_ERROR |

Error response dùng thông báo cố định, không đưa giá trị request hoặc chi tiết key lên UI.

### Concurrency

- Service dùng transaction read-only và owned lookup hiện có; không tạo write lock.
- Eligibility được đánh giá khi đọc attempt trong transaction.
- Submit có thể hoàn tất sau thời điểm đọc đó; feedback chỉ phản ánh request đã được phép kiểm tra, không xác nhận attempt vẫn đang mở khi response đến client.
- Hai request feedback độc lập, không ghi đè nhau.
- Autosave/submit tiếp tục quản lý persistence và version.
- Frontend sau này phải bỏ feedback nếu answer/context đã đổi; TV3-15 cung cấp identifiers và userAnswer để hỗ trợ việc đó.

### Acceptance criteria

- **AC-01 — Access:** chỉ authenticated owner của Practice IN_PROGRESS được nhận feedback.
- **AC-02 — Scope:** response chỉ chứa câu được yêu cầu; Part/question phải thuộc attempt snapshot.
- **AC-03 — Grading parity:** verdict/score khớp ObjectiveGradingService, gồm aliases, alternates, multiple choice và MATCHING partial credit.
- **AC-04 — Historical consistency:** key/explanation từ snapshot; sửa/xóa đề nguồn không làm thay đổi feedback.
- **AC-05 — No persistence:** feedback không sửa attempt/answer rows, version, grading flags hoặc result summary.
- **AC-06 — Contract:** validation giữ đúng ID string, null/empty và answer shape; response không giả định đã lưu.
- **AC-07 — ESSAY/error:** ESSAY và snapshot thiếu key trả lỗi rõ ràng; không gọi AI hoặc fallback current exam.
- **AC-08 — Leak boundary:** MOCK_TEST bị chặn; workspace/start vẫn không có lời giải; lỗi/log không chứa nội dung nhạy cảm.
- **AC-09 — Regression:** focused và final backend verification đạt; handoff có evidence đầy đủ.

## 3. File matrix và subtasks

Thứ tự: 15-01 → 15-02 → 15-03 → 15-04 → 15-05.

### TV3-15-01 — Request/response DTO và validation

**Prerequisite:** contract ở mục 2 đã chốt.  
**Hiện trạng:** chưa có DTO.

**Tạo:**

- backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/PracticeFeedbackRequest.java
- backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/PracticeFeedbackResponse.java
- backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackRequestValidator.java
- backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackRequestValidatorTest.java
- backend/src/test/java/com/multilingo/backend/modules/testing/dto/response/PracticeFeedbackResponseTest.java

**Interfaces:**

    class PracticeFeedbackRequest {
        JsonNode partId;
        JsonNode questionId;
        JsonNode answer;
    }

    record ValidatedFeedbackInput(
        Integer partId,
        String questionId,
        Object answer
    ) {}

    ValidatedFeedbackInput validate(PracticeFeedbackRequest request);
    void validateAnswerForType(String type, Object answer);

ValidatedFeedbackInput là nested record trong validator. DTO response dùng các field ở contract; verdict dùng GradingVerdict, score dùng BigDecimal.

**Steps**

- [x] Viết parameterized tests cho partId 0/1/max/max+1, string ID, float, boolean và missing.
- [x] Test questionId string Unicode, numeric/object/missing/blank; không trim ID hợp lệ.
- [x] Test answer explicit null so với missing; arrays/maps có phần tử không phải string hoặc nested object bị từ chối.
- [x] Test serialization response: null giữ nguyên, score >1 giữ nguyên, chỉ có allowlisted fields.
- [x] Chạy tests xác nhận RED.
- [x] Implement validator bằng kiểm tra JsonNode type trước khi convert; thông báo lỗi cố định.
- [x] Deep-copy arrays/maps; không đưa mutable request collections trực tiếp sang evaluator.
- [x] Implement answer/type shape validation theo bảng contract.
- [x] Chạy GREEN.

**Assertions bắt buộc:**

    assertThat(validate(inputWithExplicitNull()).answer()).isNull();
    assertThatThrownBy(() -> validate(inputWithMissingAnswer()))
        .isInstanceOf(AppException.class);
    assertThat(serializedResponse.get("score").decimalValue())
        .isEqualByComparingTo("2");
    assertThat(serializedResponse.has("version")).isFalse();

**Command tại backend:**

    .\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest" test

**Acceptance:** AC-06, AC-08.  
**Deliverable:** validated input và DTO không coercion, không leak.  
**Stop condition:** explicit null không phân biệt được với missing thì sửa binding/tests trong task này; không thay ObjectMapper toàn app.

### TV3-15-02 — Evaluator dùng snapshot và grading engine thật

**Prerequisite:** 15-01.  
**Hiện trạng:** engine/extractor/scope parser đã có; evaluator chưa có.

**Tạo:**

- backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java
- backend/src/test/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluatorTest.java

**Tái dùng, không đổi grading rules:**

- util/AttemptResultScope.java
- util/SnapshotGradingKeyExtractor.java
- service/support/AttemptReviewMapper.java — chỉ dùng public Part lookup, không gọi mapReview.
- grading/ObjectiveGradingService.java

Các paths tái dùng nằm dưới backend/src/main/java/com/multilingo/backend/modules/testing/.

**Interface:**

    PracticeFeedbackResponse evaluate(
        Integer attemptId,
        Map<String, Object> snapshot,
        ValidatedFeedbackInput input
    );

**Steps**

- [x] Viết fixtures flat/grouped, mirrored flat+groups, hai Part cùng questionId và group options được kế thừa.
- [x] Viết tests dùng ObjectiveGradingServiceImpl thật cho mọi objective type.
- [x] Test MATCHING partial credit: một trong hai cặp đúng → WRONG/score 1; cả hai đúng → CORRECT/score 2.
- [x] Test blank values, TFNG/YNNG aliases, accepted alternates, MCQ/FILL_IN type aliases và Heading option ID.
- [x] Test key/explanation thiếu, explanation sai kiểu, duplicate question IDs, unknown type và ESSAY.
- [x] Chạy RED.
- [x] Đọc scope bằng AttemptResultScope; xác nhận requested Part/question trước khi lấy key.
- [x] Lấy raw question theo precedence của scope parser: groups nếu hiện diện; flat chỉ khi không có groups. Mirrored flat list không bị xem như câu thứ hai.
- [x] Deep-copy câu đã chọn; gán canonical question ID/type; bổ sung group options nếu question không có options.
- [x] Tạo snapshot tạm chỉ chứa Part/câu đó rồi gọi SnapshotGradingKeyExtractor.
- [x] Key thiếu/invalid → GRADING_DATA_ERROR; không gọi GradingAdapter hoặc ExamAdapter.
- [x] Tạo AttemptAnswer transient với một answer; dùng LinkedHashMap để chứa null.
- [x] Gọi gradeAttempt với một transient answer và một Part key; lấy đúng result tuple.
- [x] Project response từ result + selected key + selected explanation; không serialize key object/alternates/options/Part data.
- [x] Chuyển lỗi extractor thành AppException thông báo cố định; không kèm raw snapshot.
- [x] Chạy GREEN và engine regression.

**Assertions bắt buộc:**

    assertThat(feedback.getQuestionId()).isEqualTo("q_1");
    assertThat(feedback.getVerdict()).isEqualTo(GradingVerdict.WRONG);
    assertThat(feedback.getScore()).isEqualByComparingTo("1");
    assertThat(snapshot).isEqualTo(snapshotBeforeEvaluation);

**Command:**

    .\mvnw.cmd "-Dtest=PracticeFeedbackEvaluatorTest,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest" test

**Acceptance:** AC-02–04, AC-07.  
**Deliverable:** pure evaluator, grading parity và snapshot không bị mutate.  
**Stop condition:** nếu cần thay grading semantics để chấm được fixture, ghi blocker; không sửa engine theo suy đoán.

### TV3-15-03 — Service ownership/mode/status và read-only behavior

**Prerequisite:** 15-01–02.  
**Hiện trạng:** repository/identity adapter đã có.

**Tạo:**

- backend/src/main/java/com/multilingo/backend/modules/testing/service/PracticeFeedbackService.java
- backend/src/test/java/com/multilingo/backend/modules/testing/service/PracticeFeedbackServiceTest.java

**Interface:**

    @Transactional(readOnly = true)
    public PracticeFeedbackResponse getFeedback(
        Integer attemptId,
        PracticeFeedbackRequest request
    );

Service là concrete Spring service riêng; không mở rộng TestAttemptServiceImpl.

**Steps**

- [x] Viết tests owner hợp lệ, wrong owner, missing attempt, MOCK_TEST mọi status và Practice mọi finalized status.
- [x] Test request chứa fake mode/userId không ảnh hưởng quyền.
- [x] Test successful feedback không gọi repository save/delete, answer repository hoặc finalization.
- [x] Chạy RED.
- [x] Resolve user từ IdentityAdapter; lookup bằng findByIdAndUserId.
- [x] Kiểm tra mode/status trước khi evaluator đọc snapshot.
- [x] Validate request, gọi evaluator với persisted snapshot.
- [x] Không load saved answers; feedback phải chấm input kể cả DB đang có answer khác.
- [x] Không gọi ensureFinalized/watchdog/submit hoặc sửa managed entity.
- [x] Chạy GREEN.

**Assertions bắt buộc:**

    verify(repository).findByIdAndUserId(attemptId, currentUserId);
    verify(repository, never()).save(any());
    verifyNoInteractions(evaluator); // khi sai owner hoặc MOCK_TEST
    assertThat(attempt.getVersion()).isEqualTo(versionBefore);
    assertThat(attempt.getResultSummary()).isEqualTo(summaryBefore);

**Command:**

    .\mvnw.cmd "-Dtest=PracticeFeedbackServiceTest" test

**Acceptance:** AC-01, AC-05, AC-07–08.  
**Deliverable:** service kiểm soát quyền trước khi expose solution.  
**Stop condition:** không thêm write lock hoặc persistence để giải quyết concurrency; contract đã chốt là preview read-only.

### TV3-15-04 — Controller, HTTP contract và security tests

**Prerequisite:** 15-01–03.

**Tạo:**

- backend/src/main/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackController.java
- backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackControllerIT.java

**Controller:**

- Base mapping /api/v1/attempts.
- POST mapping /{id}/practice-feedback.
- Path ID nhận String và parse canonical Java integer bằng helper private.
- Request nhận PracticeFeedbackRequest.
- Response ResponseEntity<ApiResponse<PracticeFeedbackResponse>>.

**Steps**

- [x] Viết MockMvc tests exact path/body/response và Cache-Control.
- [x] Test anonymous →401; wrong/missing owner →403; live/finalized MOCK_TEST →403.
- [x] Test Practice finalized →409; unknown Part/question →404; invalid ID/body/type/ESSAY theo error table.
- [x] Trong test profile, spy/mock IdentityAdapter để thay current user; không dùng riêng username làm bằng chứng ownership.
- [x] Chạy RED.
- [x] Implement controller và success envelope.
- [x] Thêm controller-local handlers cho AppException và HttpMessageNotReadableException.
- [x] Handler trả fixed message, no-store và không log exception/body. Không thay GlobalExceptionHandler.
- [x] Test malformed JSON chứa sentinel answer/key/token; cả error response lẫn captured output không chứa sentinel.
- [x] Test response allowlist: chỉ selected question; không có grading key, alternates, snapshot, Part payload hoặc saved version.
- [x] Chạy GREEN cùng review security regression.

**Assertions bắt buộc:**

    mockMvc.perform(post("/api/v1/attempts/" + mockId + "/practice-feedback")
            .contentType(MediaType.APPLICATION_JSON)
            .content(validBody))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.data").doesNotExist());

    mockMvc.perform(post("/api/v1/attempts/" + practiceId + "/practice-feedback")
            .contentType(MediaType.APPLICATION_JSON)
            .content(validBody))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", "no-store"))
        .andExpect(jsonPath("$.data.questionId").value("q_1"))
        .andExpect(jsonPath("$.data.version").doesNotExist());

**Command:**

    .\mvnw.cmd "-Dtest=PracticeFeedbackControllerIT,TestAttemptReviewControllerIT" test

**Acceptance:** AC-01–02, AC-06–08.  
**Deliverable:** authenticated endpoint và fixed, non-sensitive error contract.  
**Stop condition:** không thêm permitAll hoặc làm rộng review/workspace permissions.

### TV3-15-05 — Persistence/history integration và bàn giao

**Prerequisite:** 15-01–04.

**Tạo:**

- backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeFeedbackContractIT.java

**Cập nhật tài liệu khi được phép ghi:**

- docs/superpowers/plans/ndt/TV3-15-plan.md
- docs/superpowers/plans/ndt/TV3-15-handoff.md

**Steps**

- [x] Integration dùng controller/service/evaluator/engine/JPA thật; chỉ mock identity hoặc adapter boundary khi cần.
- [x] Tạo Practice qua endpoint với source exam có key/explanation A; autosave answer B; feedback input C.
- [x] Xác nhận feedback chấm C, còn DB vẫn giữ B, version/status/timestamps/grading fields không đổi.
- [x] Edit source key/explanation rồi gọi feedback lại; kết quả vẫn dùng snapshot A.
- [x] Với snapshot hợp lệ đã persist nhưng không còn source exam lookup, feedback vẫn hoạt động; không gọi current-exam adapter.
- [x] Legacy snapshot thiếu key →422; không fallback TV2.
- [x] Submit Practice rồi gọi feedback →409; post-submit review vẫn hoạt động qua endpoint cũ.
- [x] Kiểm tra Practice/MOCK_TEST create và workspace responses vẫn không chứa solutions.
- [x] Hai feedback requests với input khác nhau giữ result độc lập và không tạo AttemptAnswer rows.
- [x] Chạy focused suite, full backend suite một lần và diff check.
- [x] Append evidence/AC mapping/remaining issues; dừng chờ final review.

**Focused command:**

    .\mvnw.cmd "-Dtest=PracticeFeedbackRequestValidatorTest,PracticeFeedbackResponseTest,PracticeFeedbackEvaluatorTest,PracticeFeedbackServiceTest,PracticeFeedbackControllerIT,PracticeFeedbackContractIT,ObjectiveGradingServiceTest,SnapshotGradingKeyExtractorTest,DbExamAdapterSnapshotTest,TestAttemptReviewControllerIT,TestAttemptWorkspaceResponseTest" test

**Final commands:**

    # Tại backend
    .\mvnw.cmd test

    # Tại repository root
    git diff --check
    git status --short

Frontend không thay đổi nên không yêu cầu frontend suite/build cho TV3-15. PostgreSQL test đang có có thể skip khi môi trường chưa cấu hình; ghi số skipped chính xác, không gọi là đã kiểm chứng PostgreSQL.

**Acceptance:** AC-01–09.  
**Deliverable:** evidence cho real pipeline, persistence invariants và historical consistency.  
**Stop condition:** baseline failure ngoài phạm vi phải được tách riêng; không sửa để làm xanh suite bằng refactor không liên quan.

## 4. Test matrix và Definition of Done

| Mã TC | Loại | Tiền điều kiện | Thao tác | Dữ liệu | Kết quả | Task |
|---|---|---|---|---|---|---|
| TC_15_01 | Happy | Owner, live Practice | POST feedback | Correct/wrong answer | Verdict/score đúng engine | 02–04 |
| TC_15_02 | Security | Anonymous hoặc wrong owner | POST feedback | Attempt hợp lệ | 401/403, không solution | 03–04 |
| TC_15_03 | Security | MOCK_TEST mọi status | POST, có fake mode | PRACTICE trong body | Vẫn 403 | 03–04 |
| TC_15_04 | State | Practice đã finalized | POST feedback | Mọi finalized enum | 409, không evaluate | 03–05 |
| TC_15_05 | Scope | Single Part/Skill attempt | Hỏi Part/câu ngoài scope | Foreign IDs | 404, không expose | 02–04 |
| TC_15_06 | Boundary | Request parsing | Thử ID biên | 0/1/max/max+1/float/string | Chỉ ID chuẩn hợp lệ | 01, 04 |
| TC_15_07 | Integrity | Cùng ID ở hai Part | Hỏi từng Part | q_1, hai keys khác | Không trộn key | 02, 05 |
| TC_15_08 | Edge | Objective question | Gửi blank/empty | null, '', [], {} | Verdict do engine, không coercion | 01–02 |
| TC_15_09 | Correctness | Multiple/TFNG/Heading | Gửi aliases/alternates | Set, ng, option ID | Parity với grading | 02 |
| TC_15_10 | Correctness | MATCHING | Chấm partial/full | 1/2 cặp đúng | WRONG/1; CORRECT/2 | 02 |
| TC_15_11 | Negative | ESSAY hoặc key thiếu | POST feedback | Essay/legacy snapshot | 422, không AI/fallback | 02–04 |
| TC_15_12 | Historical | Snapshot đã tạo | Edit source; feedback | Key/explanation mới | Vẫn dùng snapshot cũ | 05 |
| TC_15_13 | Persistence | DB answer B | Feedback C | Version 7 | DB B/version 7 giữ nguyên | 03, 05 |
| TC_15_14 | Security | Malformed input | POST invalid JSON | Secret sentinel | Fixed error, không log sentinel | 04 |
| TC_15_15 | Regression | Live attempts | GET workspace/create | Private keys nested | Không leak solutions | 05 |
| TC_15_16 | State | Live Practice | Hai feedback/submit | Hai inputs | Independent previews; sau submit 409 | 05 |

**Definition of Done:**

- AC-01–09 có evidence và focused tests đạt.
- Full backend verification có kết quả hoặc blocker được ghi cụ thể.
- Feedback dùng đúng snapshot, không current-TV2 fallback.
- Không persistence hoặc thay đổi grading/lifecycle hiện có.
- Error/log không chứa payload nhạy cảm.
- Không đổi frontend/schema/dependency/auth/shared handler.
- Handoff append-only và yêu cầu final review toàn feature.
- Không commit/push.

**Ngoài phạm vi:** Practice feedback UI, AI grading ESSAY, rate-limit subsystem mới, scoring redesign, recovery snapshot legacy, sửa review fallback TV3-13, cross-tab coordination và lưu lịch sử từng lần kiểm tra.

**Giới hạn:** Người học được phép xem lời giải khi đang Practice theo quyết định đã chốt. API này không cam kết ngăn việc áp dụng kiến thức đó vào một MOCK_TEST khác. Feedback chỉ là preview, không xác nhận autosave hoặc submission.
