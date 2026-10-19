# TV3-20 — AI chấm Writing sau submit

> **For agentic workers:** Đây là plan, chưa phải lệnh triển khai. Khi được chủ dự án yêu cầu thực hiện, dùng `tv3-plan-executor`, đọc brief R2/plan/handoff và repository instructions, làm tuần tự RED → GREEN. Không commit/push.

**Ngày:** 2026-10-13
**Revision R2:** 2026-10-14
**Trạng thái:** PLANNED — REVISED R2 (multimodal)
**Baseline R2:** HEAD `3dee084b34fd3d787de49b3ffe0258ff31b979ce`, branch `feature/TV3-00-contract-audit`; dirty/untracked work ETS, TV3-17 R2 và tài liệu khác được giữ nguyên.

**Goal:** Chấm Writing tiếng Anh text-only hoặc có tối đa hai ảnh cấu trúc hợp lệ sau submit; lưu rubric, feedback, corrected essay, diff và mô tả nội dung ảnh; xử lý quota, retry và worker restart an toàn.

**Architecture:** Transaction submit đóng băng text/URL trong PostgreSQL job, không tải ảnh. Worker bounded claim/reserve → tải ảnh tuần tự ngoài transaction → Gemini ngoài transaction → validate → complete/fail trong transaction riêng. GET writing-feedback chỉ trả projection đã lưu, không tải lại ảnh hoặc gọi model.

**Tech stack:** Java 21, Spring Boot, JPA, PostgreSQL, Flyway, Gemini client TV3-17, JUnit, Mockito, MockMvc.

**Spec:** `Dac_ta_Usecase_UC08_UC10.md` (UC09.2/UC10.2); `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md` (AC-13); brief R2 ngày 2026-10-14 tại `C:/Users/admin/.codex/attachments/6655a767-e53e-41ad-b9da-25c918fe415d/Pasted text.txt`; quyết định của chủ dự án về preflight trong chat ngày 2026-10-14. Brief R2 và các quyết định mới có ưu tiên hơn phần text-only cũ; các quyết định không được sửa vẫn giữ nguyên.

**Global Constraints**

- Chỉ sửa backend, tests, resource/config liên quan và hai tài liệu TV3-20.
- Không thêm dependency, broker hoặc framework orchestration.
- Không đổi contract autosave, submit, hints, review, result, deadline, grace period, version hoặc finalAnswers.
- Giữ nguyên objective scores/verdicts; không cộng điểm AI vào raw objective score.
- Dựng context từ attempt snapshot và đáp án đã chốt, không JOIN exam hiện tại.
- Không log essay, prompt, feedback, API key, token, URL/query ảnh, bytes/base64, SHA nội bộ hoặc raw provider response; không giữ raw cause từ network/parser.
- Chỉ dùng public API TV3-17 R2; không sửa package Gemini/media, Hints hoặc transports của TV3-17. Test loopback được dùng helper test-only hiện có.
- Không lưu bytes ảnh vào DB/storage/cache, không Files API, OCR riêng, HTML parser, tải ảnh khi submit hoặc prefetch trước quota.
- Chỉ lấy ảnh qua ImageFetcher; không tự tải URL/DNS/MIME hoặc mở rộng allowlist từ dữ liệu snapshot.
- Không dùng raw malformed response làm fallback; không tự provision/reset quota.
- Entity kế thừa BaseEntity, PK Integer; Controller trả ApiResponse.
- Migration mới theo VYYYYMMDDHHMMSS__...sql; không sửa migration đã chạy.
- Bảo toàn untracked/user changes; không commit/push/rebase.

**Review Focus:**

1. Enqueue atomic/idempotent, short essay trước xử lý ảnh; submit/GET tuyệt đối không fetch/reserve ngoài đường đã duyệt (20-01, 20-04, 20-07).
2. SSRF qua snapshot, media/HTML không hỗ trợ, URL ký sẵn và alias/group trùng: chỉ extractor allowlist → ImageFetcher, đúng scope/thứ tự, không leak (20-01, 20-02, 20-08).
3. Source exam/ảnh đổi sau submit: URL lịch sử giữ nguyên, bytes lấy lúc run và audit SHA; không mô tả URL snapshot là ảnh bất biến (20-01, 20-02, 20-08).
4. Lease gồm tải ảnh, shutdown/stale callback/retry/period reset: một reservation, refund đúng đích, merge nhiều ESSAY không mất feedback (20-03, 20-05, 20-06).
5. Raw UTF-8 so với JSON cap, visualObservations có điều kiện, API allowlist và objective/result bất biến; model không được bịa số liệu hoặc làm lộ metadata ảnh (20-02, 20-07, 20-08).

---

## 1. Hiện trạng và quyết định

- finalizeAndGradeAttempt lưu final answers, chấm objective và chuyển attempt có ESSAY sang AI_GRADING hoặc AI_GRADING_QUEUED.
- checkAiQuota hiện luôn true; chưa có worker/job/final Writing state. AttemptAnswer.aiFeedback đã có.
- Gemini client TV3-17 có deadline, payload limits, JSON output, safe errors; mỗi generate gọi provider một lần.
- TV3-18 quota service đã có lock/increment/refund theo period nhưng hard-code AI_WRITING_HINTS.
- Exam.examLanguage tồn tại nhưng ExamFixture và attempt snapshot chưa lưu.
- WritingHintContextReader đọc context public từ snapshot theo allowlist.
- /result hiện giữ Writing score/maxScore=null; frontend enum chỉ nhận PENDING/QUEUED/FAILED/UNAVAILABLE.
- Chưa có writing-feedback hoặc writing-retry endpoint.
- TV3-17 R2 đã implement và final reviewer kết luận PASS trong entry cuối handoff ngày 2026-10-14. Header BLOCKED cũ của plan TV3-17 là lịch sử trước fixture fix, không được dùng thay verdict mới.
- `ImageFetcher.fetch(String)` trả `FetchedImage`; không có overload deadline. `ImageFetchProperties.getRequestTimeout()` công khai trả **String**; `Settings/snapshot()` là package-private, không được truy cập từ grading.
- PartFixture lưu `sharedMedia/sharedAudio/contentHtml/questionGroups`; group/question vẫn là raw maps có thể dùng snake_case. DB adapter đọc `shared_media` từ content_data, snapshot serializes part thành camelCase. Extractor phải xử lý cả hai, không chỉ JSON của builder.
- MEDIA_KEYS của Hints reader là private; reader chỉ trả boolean hasVisualContext, không trả refs. Reuse public `read()` cho text, viết extractor grading riêng cho refs, không copy reader hoặc thay đổi Hints.
- Chưa có production grading classes, writing_grading_jobs hoặc migration `V20261013210000__add_writing_grading_jobs.sql`. Các lớp/coordinator trong brief là thiết kế cần tạo, không phải code đã hoàn tất.

**Quyết định đã khóa:**

1. Quota tính theo ESSAY; reserve một lượt trước provider, retry không charge thêm, terminal failure refund đúng quota/period.
2. Tối đa một lần đầu + ba retry (bốn lần claim).
3. Chấm tiếng Anh, feedback tiếng Việt; text-only hoặc ảnh hợp lệ được chấm. Visual images chỉ bật qua flag riêng; media khác/HTML image không hỗ trợ → UNAVAILABLE.
4. Lưu examLanguage trong snapshot attempt mới; không đoán ngôn ngữ attempt cũ.
5. API writing-feedback riêng; không đổi /result. UI điểm/diff là task sau.
6. Không backfill attempt cũ, không thêm manual retry API, không thay quota provisioning.
7. `testing.writing-grading.enabled=false` và `testing.writing-grading.images-enabled=false` mặc định. Images tắt: task visual >10 từ → UNAVAILABLE/VISUAL_CONTEXT_UNSUPPORTED ngay enqueue, không job/quota/fetch.
8. Fetch sau claim/reserve, ngoài transaction. Lỗi ảnh sau reserve được charge rồi refund theo đích terminal; không thêm network precheck. Thứ tự này thay hướng dẫn fetch-trước-quota cũ ở tài liệu TV3-17 bằng quyết định rõ ràng của brief TV3-20 R2.
9. Tối đa hai ảnh/task, dedupe URL chính xác, tải lại mỗi run; quota vẫn một lượt/ESSAY. URL đóng băng trong context/input_hash; SHA bytes chỉ lưu audit sau success, không nằm trong input_hash hoặc API.
10. Không giữ bytes lịch sử: ảnh cùng URL thay đổi/xóa sau submit sẽ được đọc theo lúc worker chạy hoặc lỗi. Không tuyên bố snapshot URL bảo đảm ảnh lịch sử.
11. Chọn **writing-grading-en-v2 chung** cho cả text-only/ảnh, có phần ảnh điều kiện; promptVersion ghi trong job/feedback. Không có v1 grader triển khai để phải duy trì byte output; output text-only vẫn đúng năm field cũ, không visualObservations.
12. **Chủ dự án chốt preflight:** task có ảnh kiểm tra tổng raw UTF-8 system/user text trước, encode với ảnh thật sau fetch. Không dùng codec text-only cap 131072 JSON bytes để chặn task có ảnh. Text-only giữ codec preflight cũ; không sửa TV3-17.

**Planning evidence R2 mới chạy:** 8 lớp Hints context/prompt, Gemini contract/codec/HTTP và image config/HTTP, **140 tests PASS, 0 failures/errors/skips**, BUILD SUCCESS ngày 2026-10-14 15:59:45 +07. Không chạy broad/full suite, frontend, PostgreSQL hoặc provider thật trong lượt planning. Các số 173/162 ngày 2026-10-13 thuộc lịch sử, không phải lần chạy mới. TV3-17 final review tham chiếu 409 focused PASS và broad 1191 cases = 1177 PASS + 14 SKIP; không diễn giải thành PostgreSQL đã chạy.

## 2. Contracts và acceptance criteria

### Context, eligibility và word count

Thêm examLanguage vào ExamFixture, lấy từ Exam.examLanguage và giữ trong snapshot mọi scope. Không default en; hai fixture IELTS hiện có khai báo en. Answer không phải string không được stringify. Missing/null thành essay rỗng. Tách WritingWordCounter dùng quy tắc result mapper hiện tại \\S+ (UNICODE_CHARACTER_CLASS), giữ nguyên semantics.

Task eligible khi thuộc snapshot, là ESSAY ở WRITING, language English hợp lệ, context text hợp lệ và không phụ thuộc ảnh. Giới hạn: essay 8.000 Unicode code points; context 16.000. Thiếu language/context, sai kiểu, media dependency hoặc quá giới hạn → UNAVAILABLE, score null, không gọi Gemini/quota. Với task eligible: ≤10 từ nhận 0 không Gemini/quota; >10 tạo job. Không trim hoặc normalize essay.

### Rubric, output validation, diff

Rubric nội bộ WRITING_EN_V1, điểm AI tham khảo 0–9:

| Code | Tiêu chí |
|---|---|
| TR | Đáp ứng nhiệm vụ |
| CC | Mạch lạc và liên kết |
| LR | Từ vựng |
| GRA | Ngữ pháp |

Mỗi tiêu chí score hữu hạn [0,9], bước 0.5 và feedback. Backend tự tính overall trung bình bốn điểm, làm tròn 0.5 HALF_UP; không tin overall model gửi. Điểm AI là ước lượng, không phải chứng nhận hoặc điểm objective.

JSON output allowlist: feedbackLanguage=vi; đúng bốn criteria {code, score, feedback}; overallFeedback; correctedEssay; corrections {start,end,replacement,explanation}. Reject duplicate/unknown keys, code fences, trailing content, criteria trùng/thiếu, sai ngôn ngữ, sai score, malformed JSON. Giới hạn output 64 KiB, maxOutputTokens=8192; feedback mỗi criterion 1.000 code points, tổng quan 2.000; corrected essay 16.000; tối đa 100 corrections, replacement 2.000, explanation 500.

Correction offsets UTF-16, trong original, tăng dần, không overlap/cắt surrogate pair. Apply corrections phải tái tạo đúng correctedEssay. Dựng diff EQUAL/DELETE/INSERT server-side, không dependency hoặc HTML:

    joinWithoutInsert(diff) == originalEssay
    joinWithoutDelete(diff) == correctedEssay

### Durable jobs và quota

Tạo writing_grading_jobs với: id; attempt/part/question IDs; context_json frozen (prompt/context/essay/language/wordCount/rubric/prompt version); input_hash SHA-256; status/wait_reason/attempt_count/next_attempt_at; run_id/lease_until; quota_id/quota_reset_date/quota_reserved; last_error_code/model metadata/timestamps.

Constraints: FK attempt; unique attempt_id+part_id+question_id; giữ question_id là string; attempt_count 0..4; RUNNING cần run token/lease/reservation; due-job và expired-lease indexes. Migration precheck duplicate quota rows; partial unique quota theo user cho AI_WRITING_GRADING; fail migration nếu duplicate, không merge/delete.

States: READY → RUNNING → SUCCEEDED; lỗi tạm → RETRY_WAIT → RUNNING; terminal → FAILED; invalid input/context → UNAVAILABLE. Feature/provider disabled hoặc quota chưa sẵn sàng → WAITING, recheck 60 giây, không tăng attempt count. Claim reserve một lần, tăng budget và cấp UUID token. Lease = provider timeout + 15 giây. Retry backoff 5/30/120 giây, giữ reservation. Retry timeout/transport/rate-limit/upstream/interruption do shutdown; auth/rejected/blocked/incomplete/malformed là terminal. Crash sau claim tính một run. Provider billing có thể lặp sau crash, nhưng chỉ một kết quả được commit.

Refund conditional decrement đúng quota ID/period; period đã reset thì không giảm counter period mới. Retry không reserve thêm. Lock order: attempt → quota → job; lấy clock sau locks.

### Persistence, status và API

Canonical feedback nằm trong AttemptAnswer.aiFeedback theo schemaVersion=1 và tasks map questionId → WritingGrade. Ghi/merge dưới attempt lock, không replace feedback của câu khác. Feedback, job terminal state và reservation commit cùng transaction. Objective flags/scores không đổi. Chỉ completion đúng run_id, lease còn hạn và input không đổi.

Attempt status aggregation:

| Trạng thái jobs | Attempt |
|---|---|
| Có job có thể chạy READY/RUNNING/RETRY_WAIT | AI_GRADING |
| Chỉ còn WAITING | AI_GRADING_QUEUED |
| Tất cả SUCCEEDED, kể cả TOO_SHORT | COMPLETED |
| Hết pending, có FAILED/UNAVAILABLE | GRADING_FAILED |

Không override lỗi objective; không chạy job khi IN_PROGRESS.

    GET /api/v1/attempts/{attemptId}/writing-feedback?partId={partId}

Response gồm attempt/part IDs, attemptStatus, part status, tasks theo thứ tự snapshot. Task gồm questionId string, label/status/wordCount/language, source, scoreUnit, overall/maxScore, criteria, originalText, overallFeedback, correctedEssay, corrections, diff, reasonCode, displayMessage.

- Owner identity qua adapter; missing attempt và non-owner trả 403 theo convention.
- IN_PROGRESS trả 400; GET không lazy-finalize.
- ID sai 400; part ngoài snapshot hoặc không có ESSAY 404.
- Chỉ trả task thuộc part được yêu cầu. Pending/failed/unavailable có score null.
- TOO_SHORT trả 0, bốn criteria 0, corrected essay bằng original, diff unchanged.
- Payload không trả original text quá giới hạn; không truncate dữ liệu gốc.
- Attempt cũ không có job → UNAVAILABLE/LEGACY_NO_JOB; GET không tạo job.
- Không trả provider errors, prompt, grading keys, quota/run IDs hoặc job context.
- Cache-Control no-store. Không polling, manual retry hoặc thay đổi /result.

### Acceptance criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | Mọi finalization path tạo job đúng scope, atomic, idempotent |
| AC-02 | Frozen input giữ đề/ngôn ngữ/essay lịch sử |
| AC-03 | English text-only ≤10 từ nhận 0; không provider/quota |
| AC-04 | Validate output; lưu rubric/feedback/corrected essay/diff nhất quán |
| AC-05 | Quota theo ESSAY, retry không charge thêm, refund đúng một lần/period |
| AC-06 | Worker bounded ngoài transaction; tối đa bốn runs, backoff/recovery |
| AC-07 | Stale completion không sửa feedback/status/quota |
| AC-08 | API owner/submitted-only/part-scoped, không lộ dữ liệu nội bộ |
| AC-09 | Writing không đổi objective scores/verdicts/contracts |
| AC-10 | Focused regression và PostgreSQL evidence PASS; handoff đầy đủ |

    Given attempt có ESSAY tiếng Anh text-only trên 10 từ
    When submit commit và worker xử lý thành công
    Then feedback hợp lệ được lưu đúng part/question
    And objective result không đổi

    Given callback thuộc run có lease hết hạn
    When callback cũ complete sau recovery
    Then kết quả và reservation của run hiện tại không đổi

    Given người gọi không sở hữu attempt hoặc attempt còn IN_PROGRESS
    When GET writing-feedback
    Then không trả essay/feedback/điểm và không có side effect

## 3. Subtasks

Thực hiện tuần tự 20-01 → 20-08, mỗi task theo RED → GREEN và review diff riêng.

**Quy ước thư mục:**

- B = D:/Project/University/multilingo-platform/backend/src/main/java/com/multilingo/backend/modules/testing/
- T = D:/Project/University/multilingo-platform/backend/src/test/java/com/multilingo/backend/modules/testing/
- R = D:/Project/University/multilingo-platform/backend/src/main/resources/
- TR = D:/Project/University/multilingo-platform/backend/src/test/resources/

### TV3-20-01 — Frozen context và exam language

**Sửa:** B/adapter/dto/ExamFixture.java; B/adapter/impl/DbExamAdapter.java; B/service/support/AttemptResultSummaryMapper.java; R/fixtures/exam-fixture.json; tests DbExamAdapterSnapshotTest, ReviewSnapshotPersistenceTest, TestAttemptWorkspaceResponseTest.

**Tạo:** B/ai/grading/WritingGradingContext.java; B/service/support/WritingGradingContextReader.java; B/util/WritingWordCounter.java; tests WritingGradingContextReaderTest, WritingWordCounterTest.

- [x] RED tests language snapshot mọi scope, sửa source exam/preference, missing language, non-English, media, sai type/answer, grouped/flat, limits.
- [x] Map exam language, khai báo en cho fixtures IELTS.
- [x] Reuse WritingHintContextReader allowlist; không copy reader hoặc lấy private grading data.
- [x] Extract word-count hiện có, giữ semantics.
- [x] GREEN; xác nhận workspace/start không lộ dữ liệu grading.

Interface:

    int WritingWordCounter.count(String text);
    ContextDecision read(TestAttempt, Integer partId, String questionId,
                         List<AttemptAnswer> answers);

ContextDecision là Eligible(frozen context) hoặc Unavailable(safe reason); toString không chứa essay/prompt.

Assertion:

    assertThat(context.originalText()).isEqualTo(submittedEssay);
    assertThat(context.learningLanguage()).isEqualTo("en");

Test:

    .\mvnw.cmd "-Dtest=WritingGradingContextReaderTest,WritingWordCounterTest,DbExamAdapterSnapshotTest,ReviewSnapshotPersistenceTest,TestAttemptWorkspaceResponseTest" test

**Acceptance:** AC-02, AC-03, AC-08, AC-09.

### TV3-20-02 — Rubric, parser, diff, generator

**Tạo:** B/ai/grading/{WritingGrade,WritingGradingFailure,WritingGradingPromptFactory,WritingGradingOutputParser,WritingDiffBuilder,WritingGradingGenerator}.java; R/prompts/writing-grading-en-v1.txt; tests cùng package cho từng lớp.

- [x] RED: criteria/score/rounding, JSON lỗi, correction overlap/surrogate/CRLF/reconstruction, prompt injection, không log secret.
- [x] Tạo prompt versioned; JSON encode context/essay; preflight GeminiPayloadCodec.encode.
- [x] Implement strict parser theo contract; không repair JSON/raw fallback.
- [x] Generator gọi Gemini đúng một lần; map lỗi về safe code/retryable.
- [x] GREEN.

Assertion: parser trả đúng bốn criteria; overall 6.5; diff tái tạo corrected essay; geminiClient.generate được gọi một lần.

    .\mvnw.cmd "-Dtest=WritingGradingPromptFactoryTest,WritingGradingOutputParserTest,WritingDiffBuilderTest,WritingGradingGeneratorTest,GeminiContractTest" test

**Acceptance:** AC-04, AC-06, AC-08.

### TV3-20-03 — Job schema, config, quota adapter

**Tạo:** B/entity/WritingGradingJob.java; B/entity/enums/WritingGradingJobStatus.java; B/repository/WritingGradingJobRepository.java; B/config/WritingGradingProperties.java; B/config/WritingGradingConfiguration.java; B/adapter/WritingGradingQuotaAdapter.java; B/adapter/impl/DbWritingGradingQuotaAdapter.java; R/db/migration/V20261013210000__add_writing_grading_jobs.sql; tests WritingGradingJobRepositoryTest, WritingGradingPostgresIT, WritingGradingPropertiesTest, DbWritingGradingQuotaAdapterTest; TR/fixtures/writing-grading-pg-prerequisites.sql.

**Sửa:** modules/analytics/service/UserQuotaReservationService.java và test; R/application.properties; TR/application-test.properties.

- [x] RED constraints, duplicate quota, missing/exhausted/expired account.
- [x] Migration có duplicate precheck; không backfill.
- [x] Thêm quota service overload theo feature code; methods cũ vẫn AI_WRITING_HINTS.
- [x] Grading adapter chỉ thao tác AI_WRITING_GRADING.
- [x] Config: disabled by default, poll 5s, batch10, concurrency2, quota recheck60s, lease extension15s; dispatcher toggle.
- [x] GREEN, chứng minh hints counter không đổi.

    assertThat(gradingQuota.getUsedCount()).isEqualTo(1);
    assertThat(hintsQuota.getUsedCount()).isZero();

    .\mvnw.cmd "-Dtest=WritingGradingJobRepositoryTest,WritingGradingPropertiesTest,DbWritingGradingQuotaAdapterTest,UserQuotaReservationServiceTest" test
    .\mvnw.cmd "-Dtest=WritingGradingPostgresIT" test

PostgreSQL gate chỉ PASS nếu test chạy, không skip.

**Acceptance:** AC-01, AC-05, AC-07, AC-10.

### TV3-20-04 — Atomic enqueue

**Tạo:** B/service/support/WritingGradingEnqueuer.java, WritingGradingAttemptStateResolver.java; tests WritingGradingEnqueuerTest, WritingGradingSubmissionIT.

**Sửa:** B/service/impl/TestAttemptServiceImpl.java; TestAttemptServiceTest, TestAttemptGracePeriodTest, TestAttemptSchedulerSubmitConcurrencyIT; constructor fixtures trong TestAttemptAutosaveVersionTest, TestAttemptReviewServiceTest, TestAttemptSinglePartDurationTest, TestAttemptWorkspaceResponseTest, AttemptGradingSameVersionTest, SubmitAttemptImmutableKeysTest, ReviewSnapshotPersistenceTest.

Interface enqueue(attempt, answers) chạy MANDATORY; resolve(jobs) trả attempt status.

- [x] RED cho manual/client/server timeout/lazy finalize, repeated submit, mixed objective + nhiều ESSAY, answer row absent, short/unavailable.
- [x] Bỏ quota stub, enqueue sau objective success; không provider trong submit.
- [x] DB enqueue lỗi propagate để rollback submit; không để broad catch tạo trạng thái partial.
- [x] Tạo frozen job hoặc terminal local result duy nhất; aggregate status đúng.
- [x] Inject dependency bắt buộc; cập nhật tests, không dùng no-op/null fallback.
- [x] GREEN và assert objective không đổi.

    submitAttempt(id, request); submitAttempt(id, request);
    assertThat(jobs).hasSize(2);
    verifyNoInteractions(geminiClient);
    assertThat(attempt.getOverallScore()).isEqualByComparingTo(objectiveScore);

    .\mvnw.cmd "-Dtest=WritingGradingEnqueuerTest,WritingGradingSubmissionIT,TestAttemptServiceTest,TestAttemptGracePeriodTest,TestAttemptSchedulerSubmitConcurrencyIT,SubmitAttemptImmutableKeysTest,ReviewSnapshotPersistenceTest" test

**Acceptance:** AC-01–03, AC-09.

### TV3-20-05 — Claim, completion, failure, recovery

**Tạo:** B/service/support/WritingGradingTransactionCoordinator.java; tests WritingGradingTransactionCoordinatorTest, WritingGradingTransactionCoordinatorIT, WritingGradingPostgresTransactionIT.
**Sửa:** B/repository/WritingGradingJobRepository.java.

    ClaimDecision claim(Integer jobId);
    void complete(Claim claim, WritingGrade grade);
    void fail(Claim claim, WritingGradingFailure failure);
    int recoverExpired(int limit);

Claim immutable; toString không chứa essay.

- [x] RED duplicate claim, late completion, expired lease, refund lặp.
- [x] Locks attempt → quota → job; recheck state/due time, sample clock sau locks.
- [x] Claim reserve/increment/token/lease rồi commit trước khi trả frozen context.
- [x] Completion validate token/lease/input; merge aiFeedback theo question ID.
- [x] Success lưu result/job/reservation atomically; transient backoff; terminal refund một lần.
- [x] Recovery dùng cùng budget/fencing.
- [x] Test reset period, DB rollback và hai ESSAY cùng part.
- [x] PG race tests dùng latch và bằng chứng lock wait, không fixed sleep.
- [x] GREEN qua transaction proxies.

    complete(oldClaim, oldGrade);
    assertThat(job.getRunId()).isEqualTo(newClaim.runId());
    assertThat(savedFeedback).doesNotContainValue(oldGrade);
    assertThat(quota.getUsedCount()).isEqualTo(1);

    .\mvnw.cmd "-Dtest=WritingGradingTransactionCoordinatorTest,WritingGradingTransactionCoordinatorIT" test
    .\mvnw.cmd "-Dtest=WritingGradingPostgresTransactionIT" test

**Acceptance:** AC-05–07, AC-09.

### TV3-20-06 — Worker và dispatcher bounded

**Tạo:** B/service/worker/WritingGradingWorker.java; B/service/scheduler/WritingGradingDispatcher.java; tests WritingGradingWorkerTest, WritingGradingDispatcherTest, WritingGradingWorkerIT.
**Sửa:** B/config/WritingGradingConfiguration.java.

- [x] RED: provider ngoài transaction, concurrency/queue cap, disabled mode, retry budget.
- [x] Worker: claim → Gemini ngoài transaction → coordinator complete/fail.
- [x] Dispatcher đọc bounded batch IDs; claim recheck; không lock job trước attempt.
- [x] Dedicated bounded executor hai workers; không unbounded queue hoặc Gemini trên scheduler thread.
- [x] Chỉ claim khi có capacity; shutdown/rejected task được fencing/recovery.
- [x] Mỗi tick recovery rồi dispatch due jobs; không scan lịch sử.
- [x] Disabled không reserve/call provider; log chỉ safe metadata.
- [x] GREEN; tối đa bốn runs, một reservation.

Assertion: Gemini mock xác nhận TransactionSynchronizationManager.isActualTransactionActive() == false.

    .\mvnw.cmd "-Dtest=WritingGradingWorkerTest,WritingGradingDispatcherTest,WritingGradingWorkerIT" test

**Acceptance:** AC-05–07, AC-10.

### TV3-20-07 — Feedback API

**Tạo:** B/dto/response/WritingFeedbackResponse.java; B/service/WritingFeedbackService.java; B/service/impl/WritingFeedbackServiceImpl.java; B/controller/WritingFeedbackController.java; B/service/support/WritingFeedbackMapper.java; tests WritingFeedbackServiceTest, WritingFeedbackContractIT, WritingGradingDtoSecurityTest.

- [x] RED owner/non-owner/live attempt/invalid part; multiple tasks and same questionId across parts; partial/legacy data.
- [x] GET theo contract: identity, submitted-only, snapshot part scope, cache no-store.
- [x] Mapper dùng allowlist persisted feedback; malformed data không thành DONE.
- [x] Error message cố định; không lộ raw error/provider/job context.
- [x] GET không enqueue/reserve/call Gemini/lazy-finalize.
- [x] GREEN và kiểm tra workspace/result/review không lộ feedback.

Assertion: response task có questionId string; không có runId/quotaId.

    .\mvnw.cmd "-Dtest=WritingFeedbackServiceTest,WritingFeedbackContractIT,WritingGradingDtoSecurityTest,ResultSummaryContractIT,ExamReviewContractIT,TestAttemptWorkspaceResponseTest" test

**Acceptance:** AC-04, AC-08, AC-09.

### TV3-20-08 — Integration và handoff

**Tạo:** T/service/WritingGradingLifecycleIT.java; T/controller/WritingGradingResultCompatibilityIT.java; T/ai/grading/WritingGradingSecurityTest.java.

- [x] Integration dùng pipeline production từ submit tới feedback GET; chỉ mock provider/clock.
- [x] Test source exam đổi, worker restart, stale callback, partial failure, mixed ESSAY, objective invariance.
- [x] Test quota lỗi không từ chối submit; provider pending không giữ request submit.
- [x] Test short/unsupported/media không gọi provider.
- [x] Chạy focused backend, PG migration/concurrency và frontend compatibility.
- [x] Append files, RED/GREEN, AC evidence, commands/results, risks; dừng chờ review.

    assertThat(feedback.originalText()).isEqualTo(submittedEssay);
    assertThat(resultAfter.getResultSummary().getObjective())
        .usingRecursiveComparison().isEqualTo(resultBefore.getResultSummary().getObjective());
    assertThat(resultAfter.getResultSummary().getWriting().getTasks().getFirst().getScore())
        .isNull();

**Acceptance:** AC-01–10.

## 4. Test matrix và Definition of Done

| TC | Loại | Kịch bản/dữ liệu | Kết quả mong đợi | Task |
|---|---|---|---|---|
| 20-01 | Happy | Essay tiếng Anh text-only >10 từ | Grade, feedback, diff từ Gemini | 01–02, 06–08 |
| 20-02 | Boundary | 0/9/10/11 từ | ≤10 zero/no quota; 11 enqueue | 01, 04 |
| 20-03 | Boundary | essay 8.000/8.001; context 16.000/16.001 | Không truncate; over-limit unavailable | 01 |
| 20-04 | Integrity | Sửa exam/language sau create attempt | Frozen snapshot được dùng | 01, 08 |
| 20-05 | Negative | vi/missing language/chart/media | UNAVAILABLE, no provider/quota | 01, 04, 08 |
| 20-06 | Integrity | Hai part cùng q1, nhiều essay cùng part | Không collision/mất result | 03–08 |
| 20-07 | State | submit/watchdog/lazy finalize đồng thời | Một job mỗi task | 04–05 |
| 20-08 | State | disabled/quota thiếu/hết hạn | WAITING; submit/objective hoàn tất | 03–06 |
| 20-09 | Integrity | quota hints + grading | Hints counter không đổi | 03 |
| 20-10 | State | transient errors, backoff 5/30/120s | Tối đa 4 runs, một reservation | 05–06 |
| 20-11 | Negative | auth/blocked/malformed provider output | Terminal failure, refund safe | 02, 05–06 |
| 20-12 | Race | expired lease, stale callback | Không overwrite/double refund | 05–06 |
| 20-13 | Integrity | quota period reset | Không giảm period mới | 05 |
| 20-14 | Integrity | DB persistence/commit failure | Rollback, không false DONE | 05, 08 |
| 20-15 | Boundary | score -0.5/0/9/9.5; thiếu criterion | Chỉ schema hợp lệ được lưu | 02 |
| 20-16 | Integrity | emoji/CRLF, overlap, surrogate split | Reject sai; valid diff reconstruct | 02 |
| 20-17 | Security | live attempt/non-owner/missing auth | Không dữ liệu hoặc side effect | 07 |
| 20-18 | Security | prompt injection, HTML-like text | Không log/private data | 02, 06–08 |
| 20-19 | Integration | result/review/workspace sau grade | Contract và objective không đổi | 07–08 |
| 20-20 | UX contract | QUEUED/FAILED/UNAVAILABLE | Message rõ, không hứa retry giả | 07 |

Focused backend:

    .\mvnw.cmd "-Dtest=WritingGrading*,WritingFeedback*,WritingDiffBuilderTest,WritingWordCounterTest,DbWritingGradingQuotaAdapterTest,UserQuotaReservationService*,TestAttempt*,SubmitAttemptImmutableKeysTest,ReviewSnapshotPersistenceTest,AttemptResultSummaryMapperTest,DbExamAdapter*,FixtureExamAdapterTest,ResultSummaryContractIT,ExamReviewContractIT,WritingHint*,WritingHints*,GeminiContractTest" test

PostgreSQL gate:

    .\mvnw.cmd "-Dtest=WritingGradingPostgresIT,WritingGradingPostgresTransactionIT" test

Mỗi PG IT tạo schema riêng prefix tv3_20_; sử dụng TV3_PG_TEST_URL/USER/PASSWORD, prerequisite fixture và production Flyway migration từ baseline 20261012180000. Không dùng production/default schema. Test skipped hoặc thiếu database nghĩa là gate chưa đạt; H2 không thay bằng chứng PostgreSQL.

Frontend compatibility:

    npm test -- src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/resultPageContract.test.tsx src/features/exam/__tests__/reviewContract.test.ts src/features/exam/pages/__tests__/ExamResultPage.test.tsx

Repository checks: git diff --check; git status --short. Không chạy GenerateTemplateTest vì có thể ghi đè backend/Exam_Template.xlsx.

**DoD:** AC-01–10 có evidence; PostgreSQL locks/quota/migration PASS; provider chạy ngoài transaction; no change objective or existing contracts; no fake/raw fallback; handoff append; feature disabled by default; staging human quality review trước rollout; không commit/push.

## 5. Handoff khởi tạo

Tài liệu handoff đích: docs/superpowers/plans/ndt/TV3-20-handoff.md.

### 2026-10-13 — Codex Planner — TV3-20 — PLANNED

**Baseline:** HEAD 3dee084, branch feature/TV3-00-contract-audit.
**Dependencies:** Gemini TV3-17; quota pattern TV3-18; result contract TV3-12/19.
**Implementation evidence:** Chưa triển khai.

| Task | Deliverable | Dependency | Status |
|---|---|---|---|
| 20-01 | Frozen context, language, word count | Existing snapshot | PLANNED |
| 20-02 | Rubric/parser/diff/generator | 20-01, TV3-17 | PLANNED |
| 20-03 | Durable jobs/config/quota | TV3-18 | PLANNED |
| 20-04 | Atomic enqueue/finalization | 20-01–03 | PLANNED |
| 20-05 | Coordinator/recovery | 20-02–04 | PLANNED |
| 20-06 | Bounded worker/dispatcher | 20-05 | PLANNED |
| 20-07 | Secure feedback API | 20-01–05 | PLANNED |
| 20-08 | Integration/evidence | 20-01–07 | IMPLEMENTED |

**Planning verification:** Backend focused 173 tests PASS; frontend 4 files/162 tests PASS; diff check exit0. Full suites, PostgreSQL, live Gemini chưa chạy.

**Decisions:** Quota per ESSAY; initial+3 retries; English/text-only v1; feedback Vietnamese; frozen snapshot language; API riêng, /result giữ nguyên; no backfill/manual retry endpoint; feature mặc định disabled.

**Preserved:** .codex/ và backend/Exam_Template.xlsx.

**Risks:** Model quality cần staging review; provider có thể bill request vật lý trùng sau crash; thiếu quota giữ WAITING; legacy attempt thiếu language/job unavailable; chưa hỗ trợ visual/non-English; UI điểm/diff cần task tiếp theo.

**Executor:** Đọc plan/handoff/repository instructions; recheck baseline/dirty state/migration collision. Làm tuần tự RED → GREEN, append status/files/tests/AC evidence cho từng task. Không no-op production dependency hoặc mocked transaction evidence. Không tính PG test skipped là PASS. Không bật feature, commit hoặc push; dừng sau implementation chờ review.

**Reviewer:** Review toàn AC; ưu tiên atomic enqueue, lock order, fresh clock, fencing, quota period, parallel merge, historical context, API access và objective compatibility. Ghi P0/P1/P2 với locations/minimal fixes; append PASS/NEED_FIX/BLOCKED và evidence.

### Implementation log

Chưa bắt đầu.

