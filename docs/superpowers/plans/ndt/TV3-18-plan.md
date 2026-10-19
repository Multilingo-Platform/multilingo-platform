# TV3-18 — Writing hints API — Implementation Plan

> **Dành cho Gemini Executor:** dùng skill `tv3-plan-executor`, triển khai tuần tự theo các task bên dưới và theo vòng RED → GREEN. Giữ nguyên worktree hiện tại; không commit hoặc push.

**Ngày:** 2026-10-12 · **Trạng thái:** PLANNED · **Baseline:** HEAD `7120d37`, branch `feature/TV3-00-contract-audit`.

**Goal:** Cung cấp dàn ý và 5–10 từ vựng cho Practice Writing, đúng ngôn ngữ được chọn, có kiểm soát quyền truy cập, quota và retry.

**Architecture:** `Controller → WritingHintsService → transaction coordinator → snapshot/language/quota → GeminiClient → output validator → persisted response`.

**Tech stack:** Java 21, Spring Boot, Spring Security, JPA, PostgreSQL/Flyway, Jackson, JUnit/Mockito. Tái sử dụng Gemini client của TV3-17, không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md`, UC08.4 và AC-12; quyết định bổ sung trong hội thoại TV3-18.

**Tài liệu:** `docs/superpowers/plans/ndt/TV3-18-plan.md`, `docs/superpowers/plans/ndt/TV3-18-handoff.md`.

## Phạm vi và ràng buộc

- Chỉ backend cho Writing hints Practice; không làm UI, grading worker, essay feedback, subscription policy hay quota reset scheduler.
- Chỉ nhận ID part/question và request ID; không nhận essay, answer, userId, model hoặc prompt từ client.
- Nguồn task là snapshot bất biến của attempt; không đọc live Exam làm fallback.
- Chỉ owner, `PRACTICE`, `IN_PROGRESS`, selected `WRITING`/`ESSAY` được gọi.
- Dùng quota đã provision; không tự cấp/reset, không premium bypass, không hiểu limit âm là unlimited.
- Reserve quota trước Gemini; chỉ giữ lượt khi hints hợp lệ được lưu thành công; retry cùng request ID không charge hai lần.
- Không thay Gemini transport TV3-17, SecurityConfig, auth architecture, answer/workspace/start/result/review contracts hoặc attempt lifecycle.
- Không log task text, prompt, essay, output, API key, raw request hoặc raw provider error.
- Giữ uncommitted và untracked work; không commit/push.

## VERIFIED — Hiện trạng repository

- HEAD `7120d37`; TV3-17 đã commit và latest full-feature review PASS.
- Gemini client có `generate(GeminiGenerationRequest)`, JSON output, deadline, giới hạn payload và lỗi an toàn; không tự retry.
- Chưa có hints endpoint/service/DTO/persistence. Practice feedback hiện chỉ cho objective questions.
- `TestAttempt.examSnapshot` bất biến sau tạo attempt. `DbExamAdapter` bỏ `ai_prompt_context`; không dùng field này làm prompt source.
- `AttemptResultScope.read()` chuẩn hóa part/question và loại ESSAY khỏi objective types; task reader cần lấy raw fields từ đúng selected question.
- `UserQuota` tồn tại nhưng chưa có repository/service/provisioning. Bảng hiện tại chưa có unique constraint user/feature.
- Frontend hiện dùng mã ngôn ngữ `en, vi, ko, zh, ja, fr, de, es`; i18n giao diện chỉ en/vi. `User.targetLanguage` là preference persisted; không có active learning context API.
- Exam language không được bind vào attempt snapshot; không lấy language từ live Exam.

## Quyết định ngôn ngữ và API

Endpoint:

```http
POST /api/v1/attempts/{id}/writing-hints
Content-Type: application/json
```

Request:

```json
{
  "partId": 30,
  "questionId": "writing-task-1",
  "requestId": "c5430ff2-6f41-4eb4-b287-e1e1fdab47aa",
  "learningLanguage": "en",
  "hintLanguage": "fr"
}
```

- `partId`: integer 1..2147483647. `questionId`: string không blank, không whitespace đầu/cuối, tối đa 128 ký tự. `requestId`: UUID chuẩn, normalize lowercase.
- `learningLanguage`/`hintLanguage`: optional hoặc null; blank, sai kiểu và explicit invalid đều bị từ chối. Unknown fields cũng bị từ chối.
- Path ID là decimal chuẩn, không leading zero, suffix, exponent, whitespace hoặc overflow. Đọc body trước khi parse với giới hạn 16 KiB; duplicate JSON key và trailing JSON bị từ chối.
- `learningLanguage`: request → `User.targetLanguage` → lỗi `LANGUAGE_REQUIRED`/`LANGUAGE_UNSUPPORTED`. `hintLanguage`: request → resolved learning language.
- Không lấy `nativeLanguage`, i18n locale, `Accept-Language`, `UserTarget` hoặc live Exam làm mặc định.
- Catalog cấu hình được, khởi tạo với tám mã đang dùng. Chuẩn hóa BCP 47, giữ region/script (`fr-CA`, `zh-Hant`), hỗ trợ alias ISO 639-3 suy ra từ catalog (gồm `eng→en`, `vie→vi`, `fra→fr`). Reject malformed tags, `_`, wildcard, `und`, private-use và extensions v1. Không có service branch riêng cho từng ngôn ngữ. Dùng `Locale.Builder` để không âm thầm bỏ tag sai.
- Không thêm language fields vào User, Exam hoặc TestAttempt.

Response `ApiResponse<WritingHintsResponse>`:

```ts
interface WritingHintsResponse {
  attemptId: number;
  partId: number;
  questionId: string;
  requestId: string;
  learningLanguage: string;
  hintLanguage: string;
  generatedAt: string;
  outline: Array<{ title: string; points: string[] }>;
  vocabulary: Array<{
    term: string;
    definition: string;
    explanation: string;
    example: string;
  }>;
  limitations: string[];
}
```

Không trả provider metadata, prompt, task snapshot, essay, score hoặc grading keys. Success và lỗi đã xử lý đều `Cache-Control: no-store`.

## Snapshot, prompt và validate output

- Dùng `AttemptResultScope.read()` xác nhận scope; raw locator tuân theo precedence grouped questions trước, flat questions chỉ khi groups absent.
- Chỉ lấy question text aliases `question_text/content/title/text`, prompt, instruction/context của group và part đã chọn. Chỉ chấp nhận dữ liệu text; không stringify object.
- Không copy nguyên map; loại correct answer, explanation, grading/private prompt metadata và mọi câu khác. Không gọi review mapper hoặc live Exam API.
- Context tối đa 16.000 Unicode code points; không có question text/prompt hoặc vượt cap thì trả lỗi. Không truncate. Media chỉ được biểu thị bằng cờ; không gửi/fetch URL. Nếu task có media, output phải kèm limitation và không suy đoán hình/số liệu.
- Prompt `writing-hints-v1` phân tách system instruction với task data JSON không đáng tin. Yêu cầu mọi generated fields (`title`, `points`, `term`, `definition`, `explanation`, `example`, `limitations`) theo `hintLanguage`; task gốc không bị dịch hoặc sửa.
- Gọi Gemini một lần với `OutputFormat.JSON`, `maxOutputTokens=4096`. Không tự retry, repair JSON hoặc tạo hints giả.
- Output tối đa 32 KiB; JSON object, không markdown fence/trailing content, chỉ field cho phép; `hintLanguage` phải normalize trùng request.
- Outline 2–8 sections, 1–6 points mỗi section. Vocabulary 5–10 items, term unique sau trim/case-fold. Không blank; giới hạn: title/term 200, point/definition/explanation 1.000, example 2.000 ký tự. Limitations 0–5, tối đa 1.000 ký tự mỗi item; task có media yêu cầu tối thiểu một limitation.
- Backend tự gắn IDs, resolved languages và generatedAt; không tin metadata do model trả.
- Schema/tag validation không chứng minh semantic language của mọi câu. Ghi rõ giới hạn này; staging multilingual verification vẫn cần thiết.

## Security, lỗi và quota/idempotency

Guards chạy trước provider/reservation và được kiểm tra lại trước khi chấp nhận output: authenticated owner, PRACTICE, IN_PROGRESS, selected part/question thuộc snapshot, WRITING/ESSAY, writing section không locked. Nếu deadline tồn tại và đã hết thì từ chối, không finalize. Nếu section lock không xác định được thì fail closed.

| Trường hợp | HTTP / mã lỗi |
|---|---|
| Unauthenticated | Auth contract hiện tại |
| Foreign/nonexistent attempt; MOCK_TEST | 403 `FORBIDDEN` |
| Attempt ended / deadline hết | 409 `ATTEMPT_ALREADY_SUBMITTED` / `ATTEMPT_EXPIRED` |
| Part/question ngoài snapshot | 404 `RESOURCE_NOT_FOUND` |
| Body/type sai; objective hoặc non-Writing | 422 `VALIDATION_FAILED` |
| Quota missing/expired/exhausted | 429 `QUOTA_EXCEEDED` |
| Provider disabled/upstream/transport | 503 `WRITING_HINTS_UNAVAILABLE` |
| Output bị block/incomplete/invalid | 502 `WRITING_HINTS_INVALID_RESPONSE` |
| Pending request / payload conflict | 409 `WRITING_HINTS_IN_PROGRESS` / `WRITING_HINTS_REQUEST_CONFLICT` |
| Cooldown | 429 `WRITING_HINTS_RATE_LIMITED` |
| Language unsupported/required | 422 `WRITING_HINTS_LANGUAGE_UNSUPPORTED` / `WRITING_HINTS_LANGUAGE_REQUIRED` |
| Context unavailable / Gemini timeout / request body quá lớn | 422 `WRITING_HINTS_CONTEXT_UNAVAILABLE` / 504 `WRITING_HINTS_TIMEOUT` / 413 `WRITING_HINTS_REQUEST_TOO_LARGE` |

ErrorCode mới dùng mã 1602–1611 theo bảng trên. Message cố định, không echo input/provider error. Controller-local handlers không log body hoặc exception có raw data.

Feature quota code `AI_WRITING_HINTS`; chỉ dùng row provisioned. Reserve là conditional update trong transaction hiện tại khi `reset_date > now` và `used_count < max_limit`. Counter âm, duplicate rows hoặc config sai fail closed; không tự chọn row hay tự provision.

Thêm `writing_hint_requests` (entity kế thừa `BaseEntity`) với:

- Scope: `user_id`, `attempt_id`, `part_id`, `question_id`, `request_id`, SHA-256 `request_fingerprint`.
- `context_json`: request intent, resolved language, prompt version; không lưu task text/essay/prompt.
- `status` PENDING/SUCCEEDED/FAILED, `run_id`, `lease_until`, `last_started_at`.
- Quota reservation: `quota_id`, `quota_reset_date`, `quota_reserved`.
- `result_json` chỉ chứa response đã validate; `failure_code` không chứa exception thô; BaseEntity audit fields.
- Unique `(user_id, request_id)`, partial unique một PENDING/user, partial unique quota rows theo user riêng cho feature `AI_WRITING_HINTS`; index cho lease recovery.
- Migration precheck duplicate quota rows và fail; không merge/xóa/backfill; không sửa migration cũ. FK user/attempt; quota reference theo ID/period, không ép lifecycle của quota.

Flow:

```text
Transaction ngắn: guards → replay/recovery → reserve + ghi PENDING
Không transaction: gọi Gemini → validate output
Transaction ngắn: recheck attempt/run/lease → lưu success hoặc refund
```

- Lock order attempt → quota → operation rows tăng dần theo ID. Provider không chạy khi đang giữ DB transaction/row lock.
- Mỗi user tối đa một provider call đang chạy; cooldown mặc định 10 giây, cấu hình được, tính cả call thất bại.
- Lease bằng Gemini timeout + 15 giây. Expired PENDING được lazy recovery trước lần admission sau; FAILED và refund đúng một lần.
- SUCCEEDED cùng requestId trả cùng response, không charge/call lại. PENDING chưa hết lease trả 409 và `Retry-After`. Cùng requestId, payload khác trả conflict.
- Retry FAILED cùng requestId giữ context/ngôn ngữ đã đóng băng, tạo `run_id` mới và reserve lại. Muốn đổi ngôn ngữ dùng requestId mới.
- Refund chỉ giảm đúng quota ID/reset period; không đụng counter period mới. Late completion từ run cũ không ghi success hoặc hoàn reservation mới.
- Không trả success trước khi result persistence commit. Coordinator trả outcome; chỉ sau commit service mới map thành exception/HTTP response để recovery/refund không bị rollback.
- Nếu DB unavailable khi cleanup, reservation được lease recovery ở request tiếp theo; quota có thể chưa được giải phóng tức thì khi process chết.

## Global Acceptance Criteria

- **AC-01:** Owner của Practice IN_PROGRESS Writing ESSAY mới được xin hints; MOCK_TEST luôn bị chặn.
- **AC-02:** Chỉ selected task trong immutable snapshot; chỉnh đề TV2 về sau không đổi task của attempt.
- **AC-03:** Language precedence và aliases đúng; toàn bộ catalog dùng được, không English fallback.
- **AC-04:** Prompt yêu cầu mọi output theo hintLanguage; original task được giữ nguyên.
- **AC-05:** Chỉ response schema hợp lệ, 5–10 từ; không grading/score/private metadata/fake hints.
- **AC-06:** Quota atomic; success tính một lần, failure hoàn đúng reservation.
- **AC-07:** Replay/retry/concurrency/crash không charge lặp hoặc nhận stale result.
- **AC-08:** Provider ngoài transaction; timeout/disabled/error có response hữu hạn và an toàn.
- **AC-09:** Không log secrets; không đổi attempt answers/version/status/workspace/start/review/result.
- **AC-10:** Focused, integration và PostgreSQL tests có evidence; handoff append theo lịch sử.

## Subtasks

Thứ tự bắt buộc `18-01 → 18-02 → 18-03 → 18-04 → 18-05 → 18-06`. Mỗi task: viết tests trước, chạy RED, implement tối thiểu, chạy GREEN, review diff và append handoff. Không triển khai đồng thời các task dùng chung contract.

### TV3-18-01 — Contract, language catalog và cấu hình

**Dependency:** TV3-17. **Hiện trạng:** chưa triển khai.

**Tạo:**

```text
backend/src/main/java/com/multilingo/backend/common/i18n/LearningLanguageCatalog.java
backend/src/main/java/com/multilingo/backend/modules/testing/adapter/LearningLanguageAdapter.java
backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbLearningLanguageAdapter.java
backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/WritingHintsRequest.java
backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/WritingHintsResponse.java
backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingHintsRequestValidator.java
backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingHintLanguageResolver.java
backend/src/main/java/com/multilingo/backend/modules/testing/config/WritingHintsProperties.java
backend/src/main/java/com/multilingo/backend/modules/testing/config/WritingHintsConfiguration.java
backend/src/test/java/com/multilingo/backend/common/i18n/LearningLanguageCatalogTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/adapter/DbLearningLanguageAdapterTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WritingHintLanguageResolverTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WritingHintsRequestValidatorTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/config/WritingHintsPropertiesTest.java
```

**Sửa:** `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`, `backend/src/main/resources/application.properties`, `backend/src/test/resources/application-test.properties`.

**Interfaces:**

```java
Optional<String> LearningLanguageAdapter.findTargetLanguage(Integer userId);
ResolvedLanguages WritingHintLanguageResolver.resolve(
    Integer userId, String learningLanguage, String hintLanguage);
WritingHintsRequest WritingHintsRequestValidator.read(InputStream body);
Integer WritingHintsRequestValidator.parseAttemptId(String raw);
record ResolvedLanguages(String learningLanguage, String hintLanguage) {}
```

- [ ] Tests catalog tám codes, aliases en/vi/fr, regional/script tags, malformed/unsupported và config mở rộng thêm `it`.
- [ ] Tests precedence, absent/null so với blank/invalid, invalid stored preference; không đọc native/i18n language.
- [ ] Tests strict path/body, unknown fields, duplicate keys, trailing JSON, 16 KiB và 16 KiB+1.
- [ ] Chạy focused tests và xác nhận RED.
- [ ] Implement configurable catalog, User.targetLanguage adapter và resolver dùng `Locale.Builder`.
- [ ] Implement DTO không in payload qua `toString()`; thêm error codes 1602–1611.
- [ ] Thêm `testing.writing-hints.enabled=false`, `min-interval=10s`, language catalog; cấp `Clock.systemUTC()` bean để test clock deterministic. Test profile giữ hints disabled.
- [ ] Chạy GREEN.

Assertion:

```java
assertThat(resolve(userId, "eng", "fra"))
    .isEqualTo(new ResolvedLanguages("en", "fr"));
assertThat(resolve(userId, "vi", null).hintLanguage()).isEqualTo("vi");
assertThat(extendedCatalog.normalize("it-IT")).isEqualTo("it-IT");
```

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=LearningLanguageCatalogTest,DbLearningLanguageAdapterTest,WritingHintLanguageResolverTest,WritingHintsRequestValidatorTest,WritingHintsPropertiesTest" test`

**Acceptance:** AC-03/04. Dừng nếu phát hiện active learning context khác; không tự đổi precedence.

### TV3-18-02 — Snapshot context, prompt và output parser

**Dependency:** 18-01. **Hiện trạng:** chưa triển khai.

**Tạo:**

```text
backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingHintContextReader.java
backend/src/main/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintPromptFactory.java
backend/src/main/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintOutputParser.java
backend/src/main/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintGenerator.java
backend/src/main/resources/prompts/writing-hints-v1.txt
backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WritingHintContextReaderTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintPromptFactoryTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintOutputParserTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/ai/hints/WritingHintGeneratorTest.java
```

**Interfaces:**

```java
HintContext WritingHintContextReader.read(
    TestAttempt attempt, Integer partId, String questionId);
GeminiGenerationRequest WritingHintPromptFactory.build(
    HintContext context, ResolvedLanguages languages);
WritingHintsResponse.Content WritingHintOutputParser.parse(
    String output, String expectedHintLanguage, boolean visualContext);
WritingHintsResponse.Content WritingHintGenerator.generate(
    HintContext context, ResolvedLanguages languages);
```

- [ ] Tests grouped/flat precedence, groups rỗng, duplicate IDs, same questionId ở part khác và scope giới hạn.
- [ ] Thêm sentinels answer key/explanation/private prompt/other task; assert không vào Gemini request.
- [ ] Tests giữ nguyên đề gốc en/vi/fr và yêu cầu mọi generated fields theo hintLanguage; media không gửi URL và đòi limitation.
- [ ] Parser tests biên 4/5/10/11 vocabulary items, output size, malformed JSON, markdown fence, wrong language và unknown fields.
- [ ] Chạy RED; implement selected-context allowlist, prompt version và một Gemini call.
- [ ] Parse error không giữ raw response/cause; không sửa JSON hoặc tạo hints giả.
- [ ] Chạy GREEN.

Assertion:

```java
assertThat(request.userText()).contains(originalTaskText);
assertThat(request.userText()).doesNotContain(
    answerKeySentinel, privatePromptSentinel, otherTaskSentinel);
assertThat(request.maxOutputTokens()).isEqualTo(4096);
assertThat(request.outputFormat()).isEqualTo(OutputFormat.JSON);
```

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=WritingHintContextReaderTest,WritingHintPromptFactoryTest,WritingHintOutputParserTest,WritingHintGeneratorTest" test`

**Acceptance:** AC-02/04/05/09. Không sửa shared grading/snapshot logic nếu không có defect trực tiếp được xác nhận.

### TV3-18-03 — Quota adapter và durable request ledger

**Dependency:** 18-01. **Hiện trạng:** chỉ có UserQuota entity, chưa có repository/service.

**Tạo:**

```text
backend/src/main/java/com/multilingo/backend/modules/analytics/repository/UserQuotaRepository.java
backend/src/main/java/com/multilingo/backend/modules/analytics/service/UserQuotaReservationService.java
backend/src/main/java/com/multilingo/backend/modules/testing/adapter/WritingHintQuotaAdapter.java
backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbWritingHintQuotaAdapter.java
backend/src/main/java/com/multilingo/backend/modules/testing/entity/WritingHintRequest.java
backend/src/main/java/com/multilingo/backend/modules/testing/repository/WritingHintRequestRepository.java
backend/src/main/resources/db/migration/V20261012180000__add_writing_hint_requests.sql
backend/src/test/java/com/multilingo/backend/modules/analytics/service/UserQuotaReservationServiceTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingHintRequestRepositoryTest.java
```

**Interface quota:** `lockAccount(userId)`, `reserve(account, now)` bằng conditional update, `refund(quotaId, reservedPeriod)`. Tất cả methods chạy trong transaction hiện hành, không `REQUIRES_NEW`.

- [ ] Tests missing/expired/exhausted/invalid/duplicate quota rows; reserve, refund, không âm/vượt limit/không refund period mới.
- [ ] Persistence tests request uniqueness, JSONB context/result và status.
- [ ] Chạy RED; implement row lock/conditional updates và ledger fields như mục “Security, lỗi và quota/idempotency”.
- [ ] Migration có precheck duplicate `AI_WRITING_HINTS` rows, partial unique indexes cho feature quota và PENDING/user; không merge/delete/backfill.
- [ ] Chạy GREEN.

Assertion với maxLimit 1: lần reserve đầu thành công, lần hai thất bại, DB `used_count=1`; refund hai lần chỉ giảm một lần.

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=UserQuotaReservationServiceTest,WritingHintRequestRepositoryTest" test`

**Acceptance:** AC-06/07. Dừng khi có duplicate dữ liệu, báo migration blocker; không tự sửa dữ liệu.

### TV3-18-04 — Orchestration, idempotency, recovery và race guards

**Dependency:** 18-01–03. **Hiện trạng:** chưa có hints orchestration.

**Tạo:**

```text
backend/src/main/java/com/multilingo/backend/modules/testing/service/WritingHintsService.java
backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingHintTransactionCoordinator.java
backend/src/test/java/com/multilingo/backend/modules/testing/service/WritingHintsServiceTest.java
backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WritingHintTransactionCoordinatorTest.java
```

Coordinator định nghĩa `BeginDecision` = Replay/Reserved/Denied; `TerminalDecision` = response/error; `Reservation` mang operation ID, run ID, attempt/question IDs, frozen languages/context và lease.

```java
WritingHintsResponse WritingHintsService.generate(
    Integer attemptId, WritingHintsRequest request);
BeginDecision begin(Integer userId, Integer attemptId, WritingHintsRequest request);
TerminalDecision complete(Reservation reservation, WritingHintsResponse.Content content);
TerminalDecision fail(Reservation reservation, ErrorCode failure);
```

- [ ] Tests không gọi provider/không reserve cho foreign, mock, ended, locked, sai part/type.
- [ ] Tests replay, cùng key khác payload, failed retry và preference đổi nhưng context retry vẫn frozen.
- [ ] Deferred tests: submit trong lúc call, lease hết hạn, completion cũ đến sau run mới.
- [ ] Assert provider chạy ngoài transaction (`TransactionSynchronizationManager` false).
- [ ] Assert refund/recovery commit cả khi request mới bị từ chối.
- [ ] Chạy RED; implement begin/call/complete ba pha, 10s cooldown, một pending/user, lease timeout+15s, lazy recovery và stale run fencing.
- [ ] Chỉ ném exception sau transaction commit; không trả success trước khi persist.
- [ ] Chạy GREEN.

Assertion: hai request cùng requestId chỉ gọi Gemini một lần, cùng response và quota count 1. Nếu attempt kết thúc trước provider completion thì không persist hints; refund đúng reservation.

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=WritingHintsServiceTest,WritingHintTransactionCoordinatorTest" test`

**Acceptance:** AC-01/06–09. Không thêm scheduler, provider automatic retry hoặc attempt lifecycle changes.

### TV3-18-05 — Controller, access control và HTTP contract

**Dependency:** 18-04. **Hiện trạng:** Practice feedback controller là mẫu gần nhất.

**Tạo:**

```text
backend/src/main/java/com/multilingo/backend/modules/testing/controller/WritingHintsController.java
backend/src/test/java/com/multilingo/backend/modules/testing/controller/WritingHintsControllerIT.java
```

- [ ] MockMvc tests authenticated/anonymous, owner/foreign, Practice/Mock, active/submitted.
- [ ] Tests path/body/language, feature disabled, quota errors, exact envelope and no-store.
- [ ] Test Retry-After cho pending/cooldown.
- [ ] Capture logs với sentinels ở malformed request, task, AI output và parse errors.
- [ ] Chạy RED; implement POST dùng bounded request reader; local handlers trả fixed safe errors, không log body/raw exception.
- [ ] Không sửa SecurityConfig; dùng test identity để kiểm thử contract nhưng không coi đó là bằng chứng auth production.
- [ ] Chạy GREEN.

Assertion: success trả `ApiResponse`, `Cache-Control: no-store`, language đúng, đủ 5+ vocabulary; foreign/mock không có Gemini interaction; logs không chứa sentinels.

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=WritingHintsControllerIT,WritingHintsServiceTest" test`

**Acceptance:** AC-01/03/05/08/09. Dừng nếu cần thay auth architecture.

### TV3-18-06 — Integration, PostgreSQL concurrency và handoff

**Dependency:** 18-01–05.

**Tạo:**

```text
backend/src/test/java/com/multilingo/backend/modules/testing/controller/WritingHintsContractIT.java
backend/src/test/java/com/multilingo/backend/modules/testing/repository/WritingHintPostgresIT.java
```

**Sửa có giới hạn:**

```text
backend/src/test/java/com/multilingo/backend/modules/testing/repository/ExamReviewPostgresIT.java
backend/src/test/java/com/multilingo/backend/modules/testing/repository/ResultScorePrecisionPostgresIT.java
backend/src/main/java/com/multilingo/backend/modules/testing/README.md
docs/superpowers/plans/ndt/TV3-18-plan.md
docs/superpowers/plans/ndt/TV3-18-handoff.md
```

Hai Postgres IT hiện chạy toàn migration trên fixture schema tối thiểu và assert version `20261010233000`. Giới hạn migration target của chúng tại version đó; `WritingHintPostgresIT` kiểm chứng migration mới trên schema riêng.

- [x] Contract integration dùng controller/service/coordinator/parser/repository thật; chỉ Gemini và identity được stub.
- [x] Tạo attempt rồi sửa TV2 exam; hints vẫn lấy task trong snapshot.
- [x] Test en/vi/fr và override chéo; mọi generated fields và prompt theo hintLanguage, đề gốc giữ nguyên.
- [x] Test replay success, provider/parser failure → refund → explicit retry.
- [x] PostgreSQL: quota=1 dưới concurrency, duplicate key, partial unique pending, double refund, period reset, expired lease và stale completion.
- [x] Dùng latch/barrier, không dùng sleeps để tạo race.
- [x] Submit giữa provider call: không nhận result, refund. Hints không sửa answers/version/status/resultSummary; workspace/start không lộ hints/private prompt.
- [x] Chạy regression và `git diff --check`; append file list, test logs, AC mapping, risks, review request.

**Lệnh:** `cd backend; .\mvnw.cmd "-Dtest=WritingHintsContractIT,WritingHintPostgresIT,ExamReviewPostgresIT,ResultScorePrecisionPostgresIT" test`

PostgreSQL đọc `TV3_PG_TEST_URL/USER/PASSWORD`, dùng schema ngẫu nhiên riêng; không dùng/xóa public schema và không in credentials. Bài PG bị skip không được tính là concurrency/migration PASS.

## Test matrix

| ID | Loại | Kịch bản | Kết quả cần có | Task |
|---|---|---|---|---|
| TC_18_01 | Happy | Practice Writing hợp lệ | Hints schema đúng; quota charge 1 | 04–06 |
| TC_18_02 | Security | Mock/foreign/anonymous | Deny; không gọi provider/reserve | 04–06 |
| TC_18_03 | Negative | Unknown/malformed/duplicate JSON | Fixed error; không log body | 01/05 |
| TC_18_04 | Boundary | Path/body/string max±1 | Đúng biên đã chốt | 01 |
| TC_18_05 | Language | en/vi/fr, eng/vie/fra, fr-CA | Precedence và canonical tag đúng | 01/06 |
| TC_18_06 | Language | Thêm ngôn ngữ cấu hình | Hoạt động không thêm service branch | 01 |
| TC_18_07 | Negative | Language invalid/missing | Không fallback tiếng Anh | 01/05 |
| TC_18_08 | Integrity | Live exam đổi sau khi tạo attempt | Provider chỉ nhận snapshot cũ | 02/06 |
| TC_18_09 | Security | Snapshot có answer key/secret | Không vào prompt/response/log | 02/05/06 |
| TC_18_10 | Boundary | Vocabulary 4/5/10/11 | Chỉ 5–10 được nhận | 02 |
| TC_18_11 | Negative | Timeout/blocked/invalid output | Không success; reservation được hoàn | 02/04–06 |
| TC_18_12 | Concurrency | Hai requests, quota=1 | Không vượt quota; một provider call | 03/04/06 |
| TC_18_13 | Idempotency | Replay/cùng key khác body | Cache hoặc conflict; không charge lặp | 04/06 |
| TC_18_14 | Recovery | Lease expiry và old completion | Refund một lần; reject stale run | 04/06 |
| TC_18_15 | Integrity | Quota period đổi trong call | Không giảm counter kỳ mới | 03/06 |
| TC_18_16 | Race | Submit khi Gemini pending | Không lưu hints; hoàn reservation | 04/06 |
| TC_18_17 | Privacy | Sentinels trong mọi lỗi | Không xuất hiện trong log/toString | 02/05/06 |
| TC_18_18 | API | Pending/cooldown/disabled | Safe error, Retry-After, không hứa auto retry | 05 |

## Verification và Definition of Done

Baseline đã chạy tại backend:

```powershell
.\mvnw.cmd "-Dtest=GeminiContractTest,PracticeFeedbackServiceTest,TestAttemptWorkspaceResponseTest" test
```

Observed 51 tests, 0 failure/error/skip; BUILD SUCCESS. `git diff --check` exit 0. Không gọi Gemini thật. Chưa có PostgreSQL environment; chưa chạy TV3-18 tests.

Regression command sau implementation:

```powershell
.\mvnw.cmd "-Dtest=GeminiContractTest,GeminiHttpContractTest,GeminiSecurityTest,PracticeFeedbackServiceTest,PracticeFeedbackContractIT,TestAttemptWorkspaceResponseTest,WorkspaceSnapshotSanitizerTest,TestAttemptReviewServiceTest,ResultSummaryContractIT" test
```

Broader backend command:

```powershell
.\mvnw.cmd "-Dtest=*,!GenerateTemplateTest" clean test
```

Đây không phải full suite tuyệt đối: loại `GenerateTemplateTest` vì test hiện có ghi đè `backend/Exam_Template.xlsx`, đang là untracked user work. Không sửa test ngoài phạm vi, không ghi đè workbook và không gọi command trên là full-suite PASS.

DoD: AC-01–10 có evidence; focused/regression tests PASS; PostgreSQL migration/concurrency không skip; provider chạy ngoài transaction; replay/retry/failure/crash paths có quota assertions; logs không lộ sentinels; work ngoài phạm vi được giữ nguyên; handoff append trạng thái cuối và dừng chờ review. Không commit/push.

Dependencies/risk: TV1 cần provision `AI_WRITING_HINTS`; feature mặc định disabled cho đến khi quota và Gemini config hợp lệ. Provider có thể tính phí dù application hoàn quota. Text-only hints không phân tích ảnh. Mocked tests không chứng minh chất lượng ngôn ngữ semantic; cần staging multilingual validation.

## Gemini Executor và Codex Reviewer

**Executor:** Đọc plan/handoff/repository instructions và TV3-17 contracts; chụp lại Git state; triển khai đúng dependency order; append `IN_PROGRESS`/`IMPLEMENTED` cùng files, tests, AC evidence. PostgreSQL skip không phải PASS. Không mở rộng sang UI/grading/subscription, không sửa work ngoài phạm vi; dừng chờ final review.

**Reviewer:** Review toàn feature, không chỉ task cuối. Kiểm tra owner/mode/status trước cache/provider/quota; snapshot allowlist; toàn bộ generated fields theo language; DB transaction boundary, atomic quota/refund period, lease/run fencing; submit-during-generation; malformed output và logs. Append `PASS`/`NEED_FIX`/`BLOCKED`, findings P0/P1/P2 và verification evidence.
