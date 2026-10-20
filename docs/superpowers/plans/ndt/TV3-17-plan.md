# TV3-17 — Gemini HTTP client infrastructure

> **For agentic workers:** Khi triển khai, dùng skill `tv3-plan-executor`; đọc plan và handoff trước khi sửa, thực hiện tuần tự RED → GREEN và cập nhật handoff. Không commit hoặc push.

**Ngày:** 2026-10-12  
**Trạng thái:** R2 IMPLEMENTED — AWAITING FINAL REVIEW; REGRESSION VERIFIED PASS
**Baseline:** HEAD `73da0a9`, branch `feature/TV3-00-contract-audit`.

**Goal:** Tạo Gemini client nội bộ backend có cấu hình an toàn, deadline, giới hạn payload, phân loại lỗi và tests không gọi provider thật.

**Architecture:** `Caller → GeminiClient → request/response codec → JDK HttpClient → Gemini`. Client không phụ thuộc attempt, quota hoặc database. Writing Hints và grading worker sau này dùng cùng interface nhưng tự quản lý nghiệp vụ, validation và retry.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Jackson, JDK `HttpClient`, JUnit 5, Mockito, Spring Test.

**Spec:** `docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md`, mục 5.6; yêu cầu TV3-17 và quyết định planning được ghi tại handoff.

## Hiện trạng và phạm vi

- Repository chưa có Gemini client, Gemini config hoặc HTTP client production. Dependencies hiện có đủ dùng JDK `HttpClient` và Jackson; không thêm SDK/WebFlux.
- Submit đã có trạng thái `AI_GRADING`/`AI_GRADING_QUEUED`, nhưng chưa có provider/worker hoàn tất Writing.
- `GlobalExceptionHandler` ghi message của `AppException` và stack trace của exception khác. Gemini exception phải an toàn, không mang raw cause.
- Working tree có thay đổi tracked/untracked thuộc TV3-16 và handoff TV3-15. Phải giữ nguyên.
- Ghi chú TV3-16 dùng mã TV3-17 cho post-submit retry; yêu cầu hiện tại xác định TV3-17 là Gemini HTTP infrastructure. Không sửa tài liệu TV3-16.

**Baseline đã chạy:** `TestAttemptWorkspaceResponseTest` và `PracticeFeedbackServiceTest`: 21 tests PASS, 0 failures/errors/skipped. `git diff --check` PASS. Không chạy full suite, không gọi Gemini thật. Có compiler unchecked/JVM agent warnings baseline; không xử lý trong phạm vi này.

### Global Constraints

- Chỉ sửa backend infrastructure mới, cấu hình liên quan, module README và hai tài liệu TV3-17.
- Không đổi frontend, DB/schema, attempt lifecycle, grading khách quan hoặc API hiện có.
- Không triển khai hints, grading worker, quota, scheduler, prompt nghiệp vụ hoặc feedback schema.
- Không đưa key/prompt/essay/raw response vào log, exception, `toString()` hoặc public DTO.
- Không gọi Google thật trong tests; không tạo chi phí.
- Không chỉnh shared exception handler/ErrorCode chỉ để phục vụ client.
- Không commit/push; giữ mọi uncommitted/untracked work.

### Review Focus

1. Body treo sau khi nhận headers vẫn phải hết deadline.
2. Redirect không chuyển API key sang host khác.
3. JSON malformed không làm lộ nội dung nhạy cảm qua Jackson exception.
4. `MAX_TOKENS`, safety block và thought parts không thành kết quả hoàn chỉnh.
5. Timeout/interruption giải phóng client-side wait; request khác không bị ảnh hưởng.

## Contract và acceptance criteria

### Interface nội bộ

Package mới: `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/`.

```java
public interface GeminiClient {
    GeminiGenerationResult generate(GeminiGenerationRequest request);
}

public record GeminiGenerationRequest(
    String systemInstruction,
    String userText,
    int maxOutputTokens,
    OutputFormat outputFormat
) {
    public enum OutputFormat { TEXT, JSON }
}

public record GeminiGenerationResult(String text, Usage usage) {
    public record Usage(
        Integer promptTokens,
        Integer candidateTokens,
        Integer totalTokens
    ) {}
}
```

- `userText` bắt buộc và không blank; chỉ kiểm tra blank, không trim payload. `systemInstruction` nullable; null thì bỏ field. `outputFormat` bắt buộc.
- `maxOutputTokens` trong `[1, 8192]`. Request/result override `toString()` để không in nội dung.
- `text` giữ nguyên văn bản cuối provider. Không tự sửa JSON hoặc bỏ Markdown fences. `usage` nullable; counter thiếu thành null, counter có mặt phải là integer không âm; không suy ra tổng token.
- Client chỉ validate provider envelope. Caller phải validate schema/nghiệp vụ của hints/grading trước khi sử dụng output.

### Cấu hình

Thêm vào `backend/src/main/resources/application.properties`:

```properties
testing.gemini.enabled=${GEMINI_ENABLED:false}
testing.gemini.api-key=${GEMINI_API_KEY:}
testing.gemini.model=${GEMINI_MODEL:}
testing.gemini.connect-timeout=${GEMINI_CONNECT_TIMEOUT:5s}
testing.gemini.request-timeout=${GEMINI_REQUEST_TIMEOUT:30s}
```

- Disabled: có client từ chối bằng lỗi `DISABLED`, không tạo `HttpClient`.
- Enabled: thiếu key/model fail startup bằng message cố định, không in giá trị cấu hình.
- Model là bare ID, dài 1–128, regex `[A-Za-z0-9][A-Za-z0-9._-]*`; không nhận `models/`, URL, query hoặc slash.
- Key không blank, không whitespace/control characters; không trim/log key.
- Timeout dương; `connectTimeout ≤ requestTimeout ≤ 120s`.
- Giới hạn cố định: request JSON 131.072 bytes; response 524.288 bytes.
- Production endpoint cố định, không cấu hình base URL. URI localhost chỉ inject qua constructor package-private trong tests.
- Cấu hình được chụp khi tạo client; đổi key/model cần restart.

### HTTP và response contract

```http
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Content-Type: application/json
Accept: application/json
x-goog-api-key: <server-side key>
```

```json
{
  "systemInstruction": {"parts": [{"text": "..."}]},
  "contents": [{"role": "user", "parts": [{"text": "..."}]}],
  "generationConfig": {
    "candidateCount": 1,
    "maxOutputTokens": 1024,
    "responseMimeType": "application/json"
  }
}
```

`responseMimeType` là `text/plain` cho `TEXT`. Không gửi tools, files, streaming, schema hoặc safety overrides. Wire contract tham chiếu [Google generateContent](https://ai.google.dev/api/generate-content); API key chỉ gửi server-side qua header theo [Google API keys](https://ai.google.dev/gemini-api/docs/api-key). Structured output vẫn cần validation phía ứng dụng ([Google structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)).

- Mỗi lần gọi chỉ gửi một `sendAsync`, không retry/sleep/fallback.
- Deadline monotonic tính từ đầu thao tác và bao gồm nhận hết response body. Dùng `future.get(remainingBudget, ...)`, không chỉ dựa vào `HttpRequest.timeout`.
- Timeout cancel future; interruption cancel và khôi phục interrupt flag. Cancellation không bảo đảm provider chưa xử lý hoặc tính phí.
- Bounded body subscriber cancel subscription ngay khi vượt giới hạn.
- HTTP client dùng `Redirect.NEVER`; URI production host cố định.
- Response thành công phải là JSON envelope hợp lệ, đúng một candidate, `finishReason=STOP` và có final text không blank. Ghép text parts theo thứ tự, bỏ parts `thought=true`; từ chối tool/file output.
- Prompt bị block/safety finish → `BLOCKED`; `MAX_TOKENS` → `INCOMPLETE`; thiếu/unknown finish reason → `INVALID_RESPONSE`. Không trả raw provider envelope.

### Exception contract

`GeminiClientException extends AppException`, dùng `UNCATEGORIZED_EXCEPTION`, không có raw cause/body/provider message. Expose `Kind getKind()`, `boolean isRetryable()`, `Integer getUpstreamStatus()`.

| Kind | Trường hợp | Retryable |
|---|---|---|
| `DISABLED` | Gemini chưa bật | Không |
| `INVALID_INPUT` | Request không hợp lệ/quá lớn | Không |
| `AUTHENTICATION` | Provider 401/403 | Không |
| `PROVIDER_REQUEST_REJECTED` | 4xx khác, trừ 408/429 | Không |
| `RATE_LIMITED` | 429 | Có |
| `TIMEOUT` | Deadline hoặc 408 | Có |
| `TRANSPORT` | Network/I/O failure | Có |
| `UPSTREAM` | 5xx | Có |
| `INTERRUPTED` | Thread bị interrupt | Không |
| `REDIRECT_REJECTED` | 3xx | Không |
| `BLOCKED` | Prompt/content bị chặn | Không |
| `INCOMPLETE` | `MAX_TOKENS` | Không |
| `INVALID_RESPONSE` | JSON/envelope/UTF-8 không hợp lệ | Không |
| `RESPONSE_TOO_LARGE` | Body vượt giới hạn | Không |

`retryable=true` chỉ là tín hiệu cho caller, không kích hoạt retry. Provider 401/403 không phải lỗi đăng nhập của learner.

### Acceptance Criteria

- **AC-01:** Disabled startup không cần key/model, không gọi mạng; enabled config sai fail an toàn.
- **AC-02:** POST đúng URL/header/body; key không nằm trong URL/payload.
- **AC-03:** Deadline bao gồm body; request/response giới hạn bytes; timeout/interruption cancel.
- **AC-04:** Chỉ trả final text hoàn chỉnh; phân biệt safety, truncation, thought và malformed response.
- **AC-05:** Phân loại lỗi đúng; không retry/fallback tự động.
- **AC-06:** Không lộ key/prompt/essay/raw response qua logs, exceptions hoặc `toString()`.
- **AC-07:** Client dùng lại an toàn; không đổi API/DB/attempt flow hoặc gọi Gemini khi startup.
- **AC-08:** Tests mới và regression liên quan PASS; handoff ghi evidence, không PASS khi thiếu kiểm chứng.

## Subtasks triển khai

Thứ tự: `17-01 → 17-02 → 17-03 → 17-04 → 17-05`. Mỗi task có review gate riêng; không triển khai song song các task sửa cùng contract/package.

### TV3-17-01 — Contract và cấu hình an toàn

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiClient.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiGenerationRequest.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiGenerationResult.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiClientException.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiProperties.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiPropertiesTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiContractTest.java`

**Steps:**

- [x] Viết tests disabled không cần key/model; enabled thiếu key/model; model slash/query/control; timeout 0/âm/connect lớn hơn request/request quá 120s.
- [x] Test `toString()`, exception message và stack trace không chứa sentinel key/prompt/essay/output/provider error.
- [x] Chạy RED; ghi tên test và lỗi.
- [x] Implement types, safe `toString()` và `GeminiProperties.validate()` với message cố định; không dùng rejected value của API key trong lỗi validation.
- [x] Chạy GREEN và `git diff --check`.

**Assertion:** `request.toString()` không chứa `SECRET_PROMPT` hoặc `SECRET_ESSAY`. Command: `cd backend; .\mvnw.cmd "-Dtest=GeminiPropertiesTest,GeminiContractTest" test`. **AC:** 01, 06. Task này chưa tạo HTTP bean.

### TV3-17-02 — Request codec và response normalization

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiPayloadCodec.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiPayloadCodecTest.java`

**Interface:** `byte[] encode(GeminiGenerationRequest request)` và `GeminiGenerationResult decode(byte[] responseBody)`. Codec dùng Jackson configuration riêng, không mutate shared `ObjectMapper`.

**Steps:**

- [x] Viết exact JSON tests cho TEXT/JSON, system instruction có/không; Unicode/emoji/quote/newline/HTML-like text giữ nguyên.
- [x] Test null/blank input, format null, token `0/1/8192/8193`; request đúng byte cap và cap+1, serialize bằng bounded output.
- [x] Test STOP nhiều text parts, thought, usage thiếu/0; blocked prompt, SAFETY, MAX_TOKENS, no/multiple candidates, thiếu text, unknown finish, tool output.
- [x] Test malformed/trailing JSON, UTF-8 sai, usage sai kiểu/âm.
- [x] Chạy RED; implement allowlisted projection, bỏ metadata không dùng; chuyển parse errors sang safe exception, không gắn Jackson cause.
- [x] Chạy GREEN.

**Assertion:** thought `PRIVATE_THOUGHT` bị bỏ; text cuối bằng chính xác `Kết quả tiếng Việt`. Command: `cd backend; .\mvnw.cmd "-Dtest=GeminiPayloadCodecTest,GeminiContractTest" test`. **AC:** 02, 04, 06.

### TV3-17-03 — HTTP transport hữu hạn và phân loại lỗi

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/HttpGeminiClient.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/BoundedBodySubscriber.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/HttpGeminiClientTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/BoundedBodySubscriberTest.java`

**Interface:** `HttpGeminiClient implements GeminiClient`; constructor package-private nhận `HttpClient`, endpoint URI, properties, codec để tests inject.

**Steps:**

- [x] Test request POST/path/model/header; key không ở query/body.
- [x] Test future không settle, body treo sau headers, late completion; interruption cancel và giữ interrupt flag.
- [x] Test bảng HTTP status 401/403/408/429/4xx/5xx/3xx và xác nhận chỉ một `sendAsync`.
- [x] Test subscriber nhiều chunks, đúng giới hạn/cap+1, `Content-Length` thiếu hoặc giả; vượt cap phải cancel.
- [x] Chạy RED; implement deadline monotonic bao gồm đọc body, cancel future, backpressure và status mapping.
- [x] Không chia sẻ future/body/status giữa các lần gọi. Không tạo lỗi bằng cách đưa raw provider message vào exception.
- [x] Chạy GREEN, diff check.

**Assertion:** timeout → `Kind.TIMEOUT`, retryable; future bị cancel; `sendAsync` đúng một lần. Tests dùng timeout ngắn. Command: `cd backend; .\mvnw.cmd "-Dtest=HttpGeminiClientTest,BoundedBodySubscriberTest,GeminiPayloadCodecTest" test`. **AC:** 02, 03, 05.

### TV3-17-04 — Spring wiring và integration/security tests

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiConfiguration.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiConfigurationTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiHttpContractTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/ai/gemini/GeminiSecurityTest.java`

**Sửa:**

- `backend/src/main/resources/application.properties`
- `backend/src/test/resources/application-test.properties`

**Wiring:** `@EnableConfigurationProperties(GeminiProperties.class)`; luôn có đúng một `GeminiClient`. Disabled client ném `DISABLED`, không tạo HTTP client. Enabled tạo singleton JDK client với connect timeout, `Redirect.NEVER`; bean shutdown dùng `shutdownNow`.

**Steps:**

- [x] Test `ApplicationContextRunner`: disabled/enabled, config bắt buộc, startup không gọi network.
- [x] Tạo JDK `HttpServer` loopback port ngẫu nhiên; không thêm dependency test.
- [x] Qua client/codec thật, test request/response, chunked body chậm, malformed/oversize response và status lỗi.
- [x] Redirect tới server thứ hai: xác nhận server thứ hai không nhận request hoặc key.
- [x] Chạy hai calls đồng thời, chứng minh không lẫn response/state.
- [x] Capture logs cho sentinel key/prompt/essay/provider body; kiểm tra startup failure và exception qua `GlobalExceptionHandler` không lộ sentinel.
- [x] Chạy RED; nối cấu hình/beans; test profile đặt `testing.gemini.enabled=false`.
- [x] Cleanup server/executor sau test kể cả khi assertion lỗi; chạy GREEN.

**Commands:** `cd backend; .\mvnw.cmd "-Dtest=GeminiConfigurationTest,GeminiHttpContractTest,GeminiSecurityTest" test`. **AC:** 01–07.

### TV3-17-05 — Regression, tài liệu và bàn giao

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/README.md`
- `docs/superpowers/plans/ndt/TV3-17-plan.md`
- `docs/superpowers/plans/ndt/TV3-17-handoff.md`

**Steps:**

- [x] README ghi rõ biến cấu hình, disabled default, model bắt buộc, client chưa được nối vào nghiệp vụ.
- [x] Ghi ranh giới caller: ownership/mode/quota, essay ngắn, retry, schema AI và persistence thuộc use case/worker.
- [x] Chạy tests mới và regression workspace/review/result/practice.
- [x] Chạy backend suite; không cần frontend tests vì không sửa frontend.
- [x] Chạy `git diff --check`, kiểm tra tracked/untracked scope.
- [x] Append handoff: files, RED/GREEN evidence, AC mapping, commands/results, residual risks, review request.
- [x] Nếu có test lỗi sẵn, ghi output và phạm vi; không sửa code ngoài TV3-17.
- [x] Dừng chờ review; không commit/push.

Commands tại `backend`:

```powershell
.\mvnw.cmd "-Dtest=GeminiPropertiesTest,GeminiContractTest,GeminiPayloadCodecTest,HttpGeminiClientTest,BoundedBodySubscriberTest,GeminiConfigurationTest,GeminiHttpContractTest,GeminiSecurityTest" test
.\mvnw.cmd "-Dtest=TestAttemptWorkspaceResponseTest,WorkspaceSnapshotSanitizerTest,TestAttemptReviewServiceTest,ReviewSnapshotPersistenceTest,PracticeFeedbackServiceTest,ExamReviewContractIT,ResultSummaryContractIT,PracticeFeedbackContractIT" test
.\mvnw.cmd test
```

Tại repository root: `git diff --check`, `git status --short`.

**AC:** 08. Không kết luận Writing hints/grading đã hoạt động chỉ vì HTTP client hoàn tất.

## Ma trận kiểm thử và Definition of Done

| TC | Phân loại | Kịch bản | Kết quả bắt buộc | Task |
|---|---|---|---|---|
| 17-01 | Happy path | TEXT/JSON, HTTP 200, STOP | Đúng body/header; final text nguyên vẹn | 02–04 |
| 17-02 | Config | Disabled thiếu key/model; enabled thiếu/sai | Disabled không mạng; enabled fail an toàn | 01, 04 |
| 17-03 | Boundary | Token 0/1/8192/8193; timeout biên | Chỉ giá trị hợp lệ được nhận | 01, 02 |
| 17-04 | Boundary | Request/response cap và cap+1 | Cap hợp lệ; vượt cap bị chặn/cancel | 02, 03 |
| 17-05 | Negative | 401/403/408/429/4xx/5xx/3xx | Kind/retryable đúng; không tự retry | 03, 04 |
| 17-06 | State | Future treo/body chậm hết deadline | Wait kết thúc; future/subscription bị cancel | 03, 04 |
| 17-07 | State | Interrupt và late completion | Giữ interrupt flag; không dùng kết quả muộn | 03 |
| 17-08 | Integrity | Unicode, escape, HTML-like text | Không trim/sửa/execute nội dung | 02, 04 |
| 17-09 | Integrity | Thought, safety, MAX_TOKENS | Bỏ thought; blocked/truncated không thành success | 02 |
| 17-10 | Negative | JSON/UTF-8/shape sai, usage âm | Safe exception, không raw cause | 02, 04 |
| 17-11 | Security | Redirect host khác; log sentinel | Không chuyển key; không log dữ liệu nhạy cảm | 04 |
| 17-12 | Concurrency | Hai calls đồng thời, một lỗi | Không trộn state/ảnh hưởng call còn lại | 03, 04 |
| 17-13 | Regression | Workspace/review/result/practice | Contract và security behavior giữ nguyên | 05 |

**Definition of Done:** AC-01–08 có evidence; RED/GREEN từng task; tests mới, regression liên quan và backend suite PASS hoặc ghi blocker kèm evidence; không thêm dependency/endpoint/migration/worker/frontend; không gọi provider thật; không lộ dữ liệu nhạy cảm; diff trong phạm vi TV3-17; handoff append; dừng chờ review; không commit/push.

## Revision R2 — Multimodal

Ngày duyệt: 2026-10-14. Baseline `3dee084b34fd3d787de49b3ffe0258ff31b979ce`, branch `feature/TV3-00-contract-audit`. Spec là brief R2 của chủ dự án và plan R2 được yêu cầu triển khai trong chat; phần 17-01…05 phía trên là lịch sử, không viết lại.

**Goal:** Gemini nhận tối đa hai ảnh inline; fetcher URL → ảnh độc lập với Gemini và nghiệp vụ. Chưa nối vào Hints/grading/submit/quota. Java 21/JDK HttpClient/Jackson, không thêm dependency.

### Constraints được sửa và giữ nguyên

- Cho phép `inlineData` ảnh, vẫn không Files API/tools/streaming/safety overrides.
- Text-only cap 131072 và byte output không đổi; multimodal có cap riêng bên dưới.
- Thêm `ai/media`, sửa có kiểm soát `ai/gemini`, main/test properties, README và plan/handoff này.
- Timeout Gemini vẫn default 30s/max 120s; README nhắc model cần hỗ trợ ảnh và timeout có thể cần tăng.
- Không frontend/endpoint/DB/migration/Hints/quota/worker/shared handler/ErrorCode; không mạng/provider/CDN thật, không key thật, không retry/cache/fallback/concurrency limiter, không commit/push. Giữ mọi dirty/untracked work ETS.

### Contract R2

`GeminiImagePart(String mimeType, byte[] data)`: chỉ MIME chính xác `image/png`, `image/jpeg`, `image/webp`; data 1..2097152; defensive copy khi tạo/đọc, toString chỉ MIME/length. Sai → safe INVALID_INPUT, không cause.

`GeminiGenerationRequest(systemInstruction,userText,maxOutputTokens,outputFormat,List<GeminiImagePart> images)`: constructor 4 tham số giữ nguyên, tương đương ảnh rỗng; null list thành rỗng, list bất biến, không null element. Giữ validation cũ, không trim. toString thêm imageCount, không MIME/ảnh/text.

| Constant GeminiProperties | Value |
|---|---:|
| MAX_REQUEST_BYTES | 131072 |
| MAX_IMAGES_PER_REQUEST | 2 |
| MAX_IMAGE_BYTES | 2097152 |
| MAX_TOTAL_IMAGE_BYTES | 4194304 |
| MAX_TEXT_BYTES_WITH_IMAGES | 131072 |
| MAX_MULTIMODAL_REQUEST_BYTES | 6291456 |
| MAX_RESPONSE_BYTES | 524288 |

Codec: ảnh theo thứ tự list rồi text cuối; `inlineData.mimeType/data`, base64 chuẩn không xuống dòng. Bounded serialization chọn cap theo có ảnh. Raw UTF-8 system+user text có ảnh <=131072; không nhầm với JSON escape bytes. Decoder vẫn từ chối output inlineData/fileData; thêm IMAGE_SAFETY, IMAGE_PROHIBITED_CONTENT, IMAGE_RECITATION → BLOCKED theo quyết định chủ dự án. IMAGE_OTHER/NO_IMAGE → INVALID_RESPONSE; textual nonblank promptFeedback.blockReason → BLOCKED, malformed shape → safe INVALID_RESPONSE.

`ImageFetcher.fetch(String url): FetchedImage`; `FetchedImage(String mimeType,byte[] data)` defensive copy/safe toString. Media caps độc lập với Gemini, test bridge xác nhận cùng 2 MiB. Fetcher không import Gemini/attempt/quota/DB.

URL policy: HTTPS; hostname, không IP literal/localhost/userinfo/fragment/backslash/segment `..`; port default/443; <=2048 chars; cấm encoded dot/slash/backslash trước normalization. Prefix config HTTPS, host/path kết thúc `/`, không query/userinfo/fragment; so sánh scheme/host/effective port/path, giữ query URL tải. Không hardcode cloud demo hoặc suy allowlist từ URL snapshot.

Address policy: resolver inject được, kiểm tra TẤT CẢ kết quả; reject loopback/link-local/site-local/any-local/multicast, ULA fc00::/7, CGNAT 100.64/10, 0/8 và IPv4-mapped IPv6 tương ứng. DNS fail → ADDRESS_REJECTED, không raw cause.

Transport: riêng HttpClient, Redirect.NEVER, chỉ GET/Accept PNG JPEG WebP, không cookie/authenticator/Authorization/x-goog-api-key. Monotonic deadline từ đầu fetch bao gồm DNS và body; resolver qua virtual-thread executor chỉ tạo khi enabled; timeout cancel, interrupt restore flag. Bounded subscriber cancel ngay khi actual bytes >2 MiB; Content-Length chỉ precheck; reject encoding khác identity. Chỉ HTTP200 tạo ảnh, 3xx không follow; 2xx khác INVALID_CONTENT. Không giữ/in upstream error body.

Sniffing không decode pixel: PNG signature/IHDR/chunk bounds/IEND; JPEG SOI/header/EOI; WebP RIFF/WEBP/declared size/chunk bounds. Empty/truncated/minimal structure sai → INVALID_CONTENT; MIME/magic không khớp hoặc GIF/SVG/HTML/EXE → UNSUPPORTED_TYPE.

`ImageFetchException extends AppException(UNCATEGORIZED_EXCEPTION)`, không cause, Kind/retryable/upstreamStatus; cố định message. Kinds nonretryable: DISABLED, INVALID_URL, HOST_NOT_ALLOWED, ADDRESS_REJECTED, REDIRECT_REJECTED, UPSTREAM_NOT_FOUND(404/410), UPSTREAM_REJECTED(other4xx), INTERRUPTED, TOO_LARGE, UNSUPPORTED_TYPE, INVALID_CONTENT. Retryable: RATE_LIMITED(429), UPSTREAM(5xx), TIMEOUT(deadline/408), TRANSPORT(I/O). Không tự retry.

Properties `testing.image-fetch`: enabled env IMAGE_FETCH_ENABLED=false; allowed-url-prefixes env IMAGE_FETCH_ALLOWED_URL_PREFIXES rỗng; connect-timeout IMAGE_FETCH_CONNECT_TIMEOUT=5s; request-timeout IMAGE_FETCH_REQUEST_TIMEOUT=10s. Enabled yêu cầu prefix hợp lệ và 0<connect<=request<=30s; disabled không transport/executor/DNS và luôn có đúng một ImageFetcher bean. Parse/validate lỗi an toàn không rejected URL/config trong logs; snapshot config khi tạo client. Qualifier riêng geminiHttpClient/imageFetchHttpClient kể cả shutdown.

### Tasks và review focus

Thứ tự bắt buộc 17-06 → 17-07 → 17-08 → 17-09 → 17-10. Mỗi task tests trước, behavioral RED rồi GREEN, diff check, append IN_PROGRESS/IMPLEMENTED và review gate; không chuyển khi còn P0/P1. Không nới assertions cũ.

- [x] **17-06:** tạo gemini/GeminiImagePart.java và test; sửa GeminiGenerationRequest/GeminiProperties/GeminiContractTest. Test MIME/null/uppercase, bytes empty/cap/+1, copy cả hai chiều, immutable/null list/element, 0/1/2/3 ảnh, raw UTF8 cap/+1, constructor cũ/toString. Gate: GeminiImagePartTest,GeminiContractTest,GeminiPropertiesTest. AC-R01–03.
- [x] **17-07:** sửa GeminiPayloadCodec và test. Capture golden baseline TEXT/JSON/system/Unicode trước sửa; test ảnh→text, base64, JSON text-only/multimodal cap/+1 (escape expansion hợp lệ raw-text), image safety/prompt block/response inline rejection. Gate: GeminiImagePartTest,GeminiContractTest,GeminiPayloadCodecTest. AC-R01–03.
- [x] **17-08:** tạo media/ImageFetcher,FetchedImage,ImageFetchException,ImageFetchProperties,ImageUrlPolicy,ImageAddressPolicy,ImageSniffer và tests FetchedImageTest,ImageFetchExceptionTest,ImageFetchPropertiesTest,ImageUrlPolicyTest,ImageAddressPolicyTest,ImageSnifferTest; main/test properties thêm namespace. Tests URL spoof/traversal/2048/2049, mọi dải IP/mixed/DNS failure, MIME/structure/truncation, safe exceptions/config. AC-R03–05/R07.
- [x] **17-09:** tạo media/HttpImageFetcher,ImageFetchConfiguration,BoundedByteBodySubscriber và HttpImageFetcherTest,ImageFetchConfigurationTest,ImageFetchHttpContractTest,ImageFetchSecurityTest. Gemini BoundedBodySubscriber làm wrapper generic exception factory, giữ API/message/behavior cũ. Sửa GeminiConfiguration qualifiers, thêm mixed configuration tests. Test zero dispatch khi policy reject, loopback với test policy, no redirect/headers, DNS/body timeout, late/interrupt/cap/chunk/status, overlapping success+failure, 4 enable combinations/startup no DNS/shutdown. AC-R04–08.
- [x] **17-10:** sửa GeminiHttpContractTest/GeminiSecurityTest, README/plan/handoff. Bridge fetch giả→GeminiImagePart→Gemini thật/server giả; bytes/header/caps; overlapping multimodal một call lỗi; log/handler sentinel. README config/caps/model/timeout, Hints đã dùng text-only nhưng R2 chưa nối grading. Chạy focused/regression/broad suite, AC mapping, dừng final review. AC-R01–09.

Ngày 2026-10-14: đã triển khai 17-06…10 và chạy đủ ba nhóm verification bên dưới. Focused 299/299 PASS; review độc lập không có finding P0/P1/P2 trong R2. **Definition of Done chưa đạt:** business regression có 1 error; broad suite có 1 failure/3 errors/14 skips. Các lỗi thuộc hai test tạo attempt cũ chưa theo thay đổi ETS ở dirty baseline, không thuộc diff R2. AC-R09 còn BLOCKED; xem entry cuối handoff để đối chiếu, không diễn giải checklist triển khai thành toàn bộ backend PASS.

Review Focus: qualifier/transport key isolation; DNS/body deadline; raw/encoded prefix traversal và mixed DNS; escape expansion vượt JSON cap; failure isolation/late completion.

### AC và verification

AC-R01 byte-identical text-only và old tests; R02 ordered inline/caps; R03 copy/no leakage; R04 allowlist/address/redirect; R05 bounded body/deadline/sniff; R06 transports riêng/no key; R07 disabled/startup config; R08 no retry/cache và concurrent reuse; R09 scope/regressions/evidence.

Tại backend:

```powershell
.\mvnw.cmd '-Dtest=GeminiImagePartTest,GeminiContractTest,GeminiPropertiesTest,GeminiPayloadCodecTest,HttpGeminiClientTest,BoundedBodySubscriberTest,GeminiConfigurationTest,GeminiHttpContractTest,GeminiSecurityTest,FetchedImageTest,ImageFetchExceptionTest,ImageFetchPropertiesTest,ImageUrlPolicyTest,ImageAddressPolicyTest,ImageSnifferTest,HttpImageFetcherTest,ImageFetchConfigurationTest,ImageFetchHttpContractTest,ImageFetchSecurityTest' test
.\mvnw.cmd '-Dtest=WritingHintPromptFactoryTest,WritingHintGeneratorTest,WritingHintsServiceTest,WritingHintsControllerIT,WritingHintsContractIT,TestAttemptWorkspaceResponseTest,WorkspaceSnapshotSanitizerTest,TestAttemptReviewServiceTest,ReviewSnapshotPersistenceTest,PracticeFeedbackServiceTest,ExamReviewContractIT,ResultSummaryContractIT,PracticeFeedbackContractIT' test
.\mvnw.cmd '-Dtest=*,!GenerateTemplateTest' test
```

Chủ dự án đã chọn loại GenerateTemplateTest vì ghi workbook. Ghi broad suite, không gọi full nguyên bản; không tự cấu hình PostgreSQL/provider để hết skip. Root diff check/status so dirty baseline. Handoff ghi test count/errors/skips thật, không sửa entry cũ.

Risks/bàn giao TV3-20: DNS rebinding giữa precheck/JDK connect chưa loại trừ; cancel không chắc native DNS/provider dừng; sniff không chứng minh decode/chấm đúng; ảnh gửi Google cần xem xét dữ liệu/bản quyền. TV3-20 xử lý URL extraction/HTML img, quota ordering, prompt injection, feedback/prompt/model/image identity persistence, grading orchestration. Không kết luận Writing đã đọc ảnh khi chỉ infrastructure hoàn tất.

