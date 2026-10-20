# 📝 MODULE TESTING & AI ASSISTANT (THI THỬ, LUYỆN TẬP & TRỢ LÝ AI)

**Thành viên phụ trách:** Thành viên 3 (TV3)  
**Package:** `com.multilingo.backend.modules.testing`  
**Tài liệu phân công chi tiết:** `docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md`

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (7 AD / 7 SD)

1. **UC08 - Không gian làm bài thi & Luyện tập:** Học viên chọn làm full đề tính giờ (Mock Test) hoặc luyện từng part/kỹ năng (Practice), làm bài, nghe audio.
2. **UC08.4 - Gợi ý dàn ý & Từ vựng từ AI (Writing Hints):** Bấm "💡 Gợi ý AI Hints" trong khi luyện viết, gọi Gemini API sinh dàn ý và 5-10 từ vựng theo chủ đề bài viết.
3. **UC08.5 - Tự động thu bài khi hết giờ:** Đồng hồ đếm ngược về `00:00`, tự động khóa form và nộp bài lên hệ thống.
4. **UC09 - Chấm điểm trắc nghiệm & điền từ tự động:** So khớp câu trả lời với đáp án đúng, chuẩn hóa text (`trim()`, lowercase), sinh mảng `is_correct_flags`, tính điểm tổng.
5. **UC09.2 - Chấm điểm Writing bằng Gemini client:** Gửi bài viết và tiêu chí chấm (Task Achievement, Coherence, Lexical, Grammar) lên model do người vận hành cấu hình qua `GEMINI_MODEL`, nhận về điểm thành phần, lời nhận xét, bài viết sửa lỗi và diff.
6. **UC10 - Xem kết quả bài thi & Lời giải chi tiết:** Xem bảng điểm tổng quan, chi tiết từng câu đúng/sai kèm giải thích song ngữ.
7. **UC10.2 - Xem nhận xét AI & Giao diện Diff-View sửa lỗi:** Hiển thị nhận xét 4 tiêu chí từ Gemini và giao diện so sánh sửa lỗi bài viết tự luận.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `test_attempts`: Quản lý phiên làm bài (`test_mode`: `MOCK_TEST`, `PRACTICE`; `test_scope`: `FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART`), `exam_snapshot` bất biến, thời gian bắt đầu/kết thúc, trạng thái, tổng điểm và `result_summary`.
- `attempt_answers`: Chứa `user_answers` (JSONB), `is_correct_flags` (JSONB), `earned_score`, và `ai_feedback` (JSONB - kết quả AI chấm bài, diff và gợi ý sửa lỗi).
- `writing_hint_requests`: Ledger idempotency/quota cho Writing Hints (xem mục 6.3).
- `dictionary_lookup_requests`: Ledger idempotency, lease, replay và reservation/refund cho Tra từ AI trong Practice; chỉ lưu kết quả định nghĩa, không lưu passage.
- `writing_grading_jobs`: Hàng đợi chấm Writing bền vững, gồm snapshot ngữ cảnh, trạng thái job, lease, quota và kết quả đã validate.
- `attempt_listening_playback`: Một phiên playback server-authoritative cho mỗi attempt TOEIC Mock.

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.testing
├── controller/          # Attempt lifecycle, Hints, Writing feedback, Practice feedback,
│                        # Listening playback, Learner exam structure
├── dto/                 # request/ và response/ cho các endpoint trên
├── entity/              # TestAttempt, AttemptAnswer, WritingHintRequest, WritingGradingJob
├── repository/          # JPA repositories và query khóa/lease
├── service/             # Service interfaces + implementations
│   ├── support/         # Snapshot readers, mappers, validators, enqueuer, state resolver
│   ├── worker/          # WritingGradingWorker
│   └── scheduler/       # WritingGradingDispatcher
├── ai/                  # gemini/, hints/, grading/, media/ (provider và image fetcher)
├── adapter/             # Exam/Identity/Language/Grading/Quota boundaries
├── grading/             # Objective grading engine và DTO
├── config/              # Feature properties và validation
├── exception/           # Lỗi nghiệp vụ riêng của module
└── util/                # Attempt scope, snapshot/grading key, word counter
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Kế thừa `BaseEntity`.
2. **Cột JSONB:** Quản lý `user_answers`, `is_correct_flags`, `ai_feedback` bằng kiểu JSONB.
3. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>`; endpoint đọc kết quả/feedback gửi `Cache-Control: no-store`.
4. **Tích hợp Gemini AI:** Chỉ gọi qua `GeminiClient` đã bọc lỗi; caller chịu trách nhiệm ownership, quota, idempotency, validate output và persistence. Không log bài viết, prompt, feedback hoặc URL ảnh.
5. **Phân quyền:** Mọi endpoint attempt lấy `userId` từ `IdentityAdapter`; user khác chủ sở hữu bị từ chối, không lộ answer key/transcript.

---

## 5. HẠ TẦNG GEMINI HTTP CLIENT (TV3-17 INFRASTRUCTURE)

**Package:** `com.multilingo.backend.modules.testing.ai.gemini`

### Cấu hình môi trường

Hạ tầng Gemini Client sử dụng tiền tố `testing.gemini.*` trong `application.properties`:

| Thuộc tính | Biến môi trường | Mặc định | Mô tả |
|---|---|---|---|
| `testing.gemini.enabled` | `GEMINI_ENABLED` | `false` | Bật/tắt client Gemini. Mặc định `false` (an toàn). |
| `testing.gemini.api-key` | `GEMINI_API_KEY` | *(trống)* | API key Google Gemini. Bắt buộc khi bật; chỉ chấp nhận ký tự ASCII in được không khoảng trắng. |
| `testing.gemini.model` | `GEMINI_MODEL` | *(trống)* | Bare model ID (ví dụ: `gemini-1.5-flash`). Regex: `^[A-Za-z0-9][A-Za-z0-9._-]*$`, dài 1–128. Bắt buộc khi bật. |
| `testing.gemini.connect-timeout` | `GEMINI_CONNECT_TIMEOUT` | `5s` | Timeout kết nối TCP (`connectTimeout > 0`). |
| `testing.gemini.request-timeout` | `GEMINI_REQUEST_TIMEOUT` | `30s` | Monotonic deadline bao trọn toàn bộ request (`connectTimeout <= requestTimeout <= 120s`). |

- **Disabled theo mặc định:** Khi `testing.gemini.enabled=false`, context khởi tạo bean `GeminiClient` ở trạng thái vô hiệu hóa (`DisabledGeminiClient`). Mọi lời gọi `generate()` lập tức ném `GeminiClientException(Kind.DISABLED)` mà không tạo `HttpClient` và không gọi mạng.
- **Fail-fast khi bật:** Khi `testing.gemini.enabled=true`, nếu thiếu hoặc sai `api-key`, `model` hay `timeouts`, Spring Boot sẽ fail-fast lúc startup bằng thông báo lỗi cố định, tuyệt đối không in giá trị key ra log.

### Trạng thái tích hợp nghiệp vụ

> [!IMPORTANT]
> Trạng thái hiện tại: TV3-18 dùng Gemini client cho Writing Hints **text-only**. TV3-20 đã nối Writing grading vào submit/enqueue/worker: bài ESSAY được tạo `writing_grading_jobs`, worker gọi Gemini ngoài transaction rồi lưu feedback; khi `testing.writing-grading.images-enabled=true`, worker có thể tải 0–2 ảnh từ snapshot qua `ImageFetcher` và gửi inline cho model. Toàn bộ pipeline này vẫn **opt-in** và mặc định tắt (`WRITING_GRADING_ENABLED=false`, `WRITING_GRADING_IMAGES_ENABLED=false`). Practice feedback là đánh giá objective tại chỗ, không gọi AI; Hints vẫn không gửi ảnh.

### Revision R2 — Inline images và fetcher độc lập

`GeminiGenerationRequest` giữ constructor bốn tham số, tương đương request không ảnh và có byte output như trước. Constructor năm tham số nhận danh sách `GeminiImagePart`; chỉ nhận `image/png`, `image/jpeg`, `image/webp`. Arrays được copy khi tạo/đọc, list bất biến. Client không nhận URL và không tự tải ảnh. Request có ảnh gửi ảnh theo thứ tự list rồi text cuối qua `inlineData`, không dùng Files API.

| Giới hạn | Giá trị |
|---|---:|
| Text-only JSON | 131.072 bytes |
| Số ảnh mỗi request | 2 |
| Mỗi ảnh gốc | 2 MiB |
| Tổng ảnh gốc | 4 MiB |
| Tổng UTF-8 system instruction và user text khi có ảnh | 131.072 bytes |
| JSON multimodal, gồm base64 và escaping | 6 MiB |
| Response Gemini | 524.288 bytes |

`GEMINI_MODEL` phải được người vận hành chọn là model hỗ trợ ảnh đầu vào; client không kiểm tra capability của model. `GEMINI_REQUEST_TIMEOUT` vẫn mặc định 30s, tối đa 120s; request ảnh có thể cần tăng trong giới hạn này. Client không tự retry/fallback hoặc chuyển sang model khác. Cancellation chỉ kết thúc việc chờ ở client, không bảo đảm provider chưa xử lý/tính phí.

Fetcher nằm ở `com.multilingo.backend.modules.testing.ai.media`, không phụ thuộc Gemini, attempt, quota hoặc DB:

```java
FetchedImage image = imageFetcher.fetch(allowedImageUrl);
GeminiImagePart part = new GeminiImagePart(image.mimeType(), image.data());
// Caller tự tạo GeminiGenerationRequest với List.of(part); fetcher không tự gọi Gemini.
```

| Thuộc tính | Biến môi trường | Mặc định |
|---|---|---|
| `testing.image-fetch.enabled` | `IMAGE_FETCH_ENABLED` | `false` |
| `testing.image-fetch.allowed-url-prefixes` | `IMAGE_FETCH_ALLOWED_URL_PREFIXES` | Rỗng |
| `testing.image-fetch.connect-timeout` | `IMAGE_FETCH_CONNECT_TIMEOUT` | `5s` |
| `testing.image-fetch.request-timeout` | `IMAGE_FETCH_REQUEST_TIMEOUT` | `10s` |

- Disabled có đúng một fetcher ném `DISABLED`, không tạo HTTP client/executor, không DNS/network startup. Enabled với prefix thiếu/sai hoặc timeout không thỏa `0 < connect <= request <= 30s` thì fail startup bằng lỗi cố định. Cấu hình được chụp khi tạo bean; đổi cần restart.
- Allowlist là danh sách prefix phân tách bằng dấu phẩy, ví dụ `https://res.cloudinary.com/<cloud-name>/`. Không có cloud name mặc định. Prefix phải HTTPS, hostname, port 443/default, path kết thúc `/`, không userinfo/query/fragment. URL trong snapshot hoặc Excel không tự cấp quyền tải.
- URL tải tối đa 2.048 ký tự, có thể giữ signed query nhưng không userinfo/fragment/IP literal/localhost/path traversal hoặc encoded dot/slash/backslash. Kiểm tra mọi địa chỉ DNS; từ chối local/private/multicast/CGNAT/ULA và IPv4-mapped tương ứng, kể cả mixed public/private.
- Chỉ GET, không theo redirect; không cookie/Authorization/Gemini key. Hai HTTP client độc lập được định danh bằng qualifiers. Monotonic deadline bao gồm DNS precheck, headers, body và kiểm tra nội dung. Vượt 2 MiB actual body sẽ cancel subscription; Content-Length không thay kiểm tra actual bytes. Không nhận Content-Encoding ngoài identity.
- MIME phải khớp magic bytes và cấu trúc tối thiểu PNG/JPEG/WebP. Không nhận GIF/SVG, không dựa đuôi URL, không decode pixel; việc vượt qua sniff không bảo đảm ảnh decode được hoàn toàn hoặc nội dung biểu đồ đúng.
- `ImageFetchException` chỉ có Kind/retryable/upstreamStatus và thông điệp an toàn. Retryable chỉ cho RATE_LIMITED/UPSTREAM/TIMEOUT/TRANSPORT; fetcher không tự retry/cache/backoff. Không log URL, bytes/base64 hoặc upstream body. Không bật wire logging trên môi trường có key/dữ liệu thật.

**Rủi ro còn lại:** JDK HttpClient tự resolve DNS lúc kết nối, nên precheck không loại bỏ hoàn toàn DNS-rebinding. Allowlist CDN cố định là kiểm soát chính; không mở rộng prefix tùy tiện. Timeout cancel future nhưng native DNS có thể còn chạy. Chữ trong ảnh là dữ liệu không đáng tin; caller TV3-20 phải đặt system instruction chống prompt injection. Ảnh gửi Gemini được chuyển sang Google, cần xem xét dữ liệu và quyền sử dụng nội dung trước khi bật nghiệp vụ.

**Wiring TV3-20 (đã triển khai):** `WritingGradingContextReader` trích URL ảnh có thứ tự từ snapshot theo allowlist; `WritingGradingEnqueuer` lưu context và tạo job; `WritingGradingWorker` tải ảnh ngoài transaction, gọi Gemini, rồi lưu feedback/diff và digest ảnh qua coordinator. Hints vẫn text-only. Fetcher không được gọi từ controller hay Hints.

### Ranh giới trách nhiệm của Caller (Use Cases / Workers)

Client chỉ chịu trách nhiệm gửi nhận envelope HTTP thô và phân loại lỗi provider. Tầng nghiệp vụ gọi client (`Caller`) có toàn quyền và bắt buộc tự quản lý:
1. **Quyền sở hữu & Trạng thái Attempt:** Kiểm tra `userId`, quyền học viên, attempt mode (`MOCK_TEST` vs `PRACTICE`), trạng thái bài thi (`IN_PROGRESS`, `COMPLETED`).
2. **Hạn ngạch & Tần suất (Quota / Rate-Limiting):** Kiểm tra số lần xin gợi ý AI / hạn mức lượt chấm trước khi gọi client.
3. **Validate nội dung bài viết:** Kiểm tra độ dài essay tối thiểu, lọc nội dung rác trước khi gửi cho AI.
4. **Chiến lược Thử lại (Retry & Backoff):** Client không tự retry. Cờ `isRetryable()` chỉ mang tính gợi ý; caller quyết định có thử lại (exponential backoff/jitter) hay không.
5. **Validation Schema & Nghiệp vụ AI:** Parse và validate cấu trúc JSON nghiệp vụ (tiêu chí Task Achievement, Lexical, v.v.), xử lý trường hợp AI hallucinate hoặc trả Markdown fences.
6. **Persistence & Lịch sử:** Lưu kết quả vào `attempt_answers.ai_feedback` hoặc audit logs.

---

## 6. GỢI Ý DÀN Ý & TỪ VỰNG AI (TV3-18 AI WRITING HINTS)

**Packages:**
- `com.multilingo.backend.modules.testing.ai.hints`
- `com.multilingo.backend.modules.testing.service.support`
- `com.multilingo.backend.modules.testing.adapter`
- `com.multilingo.backend.modules.testing.controller`

### 6.1. Endpoint HTTP & Access Control

- **Endpoint:** `POST /api/v1/attempts/{id}/writing-hints`
- **Authentication & Authorization:**
  - Yêu cầu người dùng đăng nhập (`@WithMockUser` / JWT). Unauthenticated trả về `401 Unauthorized`.
  - Kiểm tra quyền sở hữu: chỉ thí sinh tạo attempt mới được gọi hints. Foreign user hoặc `MOCK_TEST` trả về `403 Forbidden` (AI Hints chỉ hỗ trợ chế độ `PRACTICE`).
  - Kiểm tra trạng thái attempt: Chỉ cho phép khi attempt đang `IN_PROGRESS` và chưa quá hạn `deadline`. Attempt đã nộp hoặc hết hạn trả về `409 Conflict`.
- **Contract & Headers:**
  - Envelope chuẩn: `ResponseEntity<ApiResponse<WritingHintsResponse>>`.
  - Header an toàn: Toàn bộ response (thành công hoặc lỗi) đều có `Cache-Control: no-store`.
  - Header `Retry-After: <seconds>` được cấp khi request đang chờ xử lý (`409 Conflict`) hoặc đang trong khoảng cooldown (`429 Too Many Requests`). Hết quota (`QUOTA_EXCEEDED`) trả 429 không kèm `Retry-After`.
  - Bounded input reader: Giới hạn tối đa 16 KiB stream body, từ chối payload ngoại cỡ bằng `413 Payload Too Large`.

### 6.2. Cấu hình hệ thống (`testing.writing-hints.*`)

| Thuộc tính | Biến môi trường | Mặc định | Mô tả |
|---|---|---|---|
| `testing.writing-hints.enabled` | `WRITING_HINTS_ENABLED` | `false` | Bật/tắt tính năng gợi ý AI. Mặc định `false` (an toàn). Khi `false`, trả `503 Service Unavailable`. |
| `testing.writing-hints.min-interval` | `WRITING_HINTS_MIN_INTERVAL` | `10s` | Khoảng cách tối thiểu giữa hai lần bắt đầu gọi provider của cùng user, kể cả lần thất bại. |
| `testing.writing-hints.lease-extension` | `WRITING_HINTS_LEASE_EXTENSION` | `15s` | Lease bằng `testing.gemini.request-timeout` (mặc định `30s`) cộng extension. Request tiếp theo của user thu hồi PENDING hết lease; không có scheduler. |
| `testing.writing-hints.supported-languages` | `WRITING_HINTS_SUPPORTED_LANGUAGES` | `en,vi,ko,zh,ja,fr,de,es` | Catalog ngôn ngữ hỗ trợ, chuẩn hóa BCP 47 và alias ISO 639-3. |

Quota dùng mã cố định `AI_WRITING_HINTS` và row đã được provision trong `user_quotas`; không có thuộc tính `quota-feature`, không tự cấp hoặc reset quota.

### 6.3. Bảng dữ liệu Ledger (`writing_hint_requests`)

Bảng `writing_hint_requests` được khởi tạo qua migration `V20261012180000__add_writing_hint_requests.sql` để đảm bảo tính bất biến và lưu vết phân tán:
- `id`: Khóa chính integer tự tăng, kế thừa `BaseEntity`.
- `request_id`: UUID bắt buộc do client gửi, chuẩn hóa lowercase; unique theo cặp `(user_id, request_id)`.
- `attempt_id`, `user_id`, `part_id`, `question_id`: Định danh ngữ cảnh câu hỏi luyện viết.
- `status`: Enum trạng thái (`PENDING`, `SUCCEEDED`, `FAILED`).
- `run_id`, `lease_until`, `last_started_at`: Định danh phiên chạy, hạn lease và mốc tính cooldown; callback phiên cũ không được ghi đè kết quả hoặc hoàn reservation của phiên mới.
- `quota_reserved`: Cờ boolean đánh dấu quota đã được trừ tạm ứng (để hoàn tiền khi fail hoặc abort).
- `quota_id`, `quota_reset_date`: Định danh quota và kỳ đã reserve; refund không giảm counter của kỳ mới.
- `request_fingerprint`: SHA-256 của request intent để kiểm tra xung đột trên cùng `request_id`.
- `context_json`: Intent, ngôn ngữ đã resolve và phiên bản prompt; không lưu task text, essay hoặc prompt.
- `result_json`: JSONB chứa response đã validate và thời điểm sinh, dùng cho replay không charge/call thêm.
- `failure_code`: Mã lỗi an toàn, không chứa raw provider exception.
- **Ràng buộc:** Partial Unique Index đảm bảo tại một thời điểm mỗi người dùng chỉ có tối đa một request ở trạng thái `PENDING`.

### 6.4. Mô hình Transaction Coordinator (Tách biệt DB & LLM)

Nhằm bảo vệ connection pool của cơ sở dữ liệu khỏi việc bị chiếm dụng trong lúc chờ LLM phản hồi, `WritingHintTransactionCoordinator` tách quy trình thành 3 pha độc lập:

```text
┌────────────────────────────────────────────────────────┐
│ Phase 1: BEGIN (In DB Transaction)                     │
│ - Validate Attempt (owner, PRACTICE mode, IN_PROGRESS) │
│ - Check Idempotency (replay cache if SUCCEEDED)        │
│ - Check Cooldown & Reserve User Quota                  │
│ - Insert Ledger Record (status = PENDING)              │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: GENERATE (OUTSIDE DB Transaction)             │
│ - Call Gemini API via GeminiClient (HTTP transport)    │
│ - Parse & Validate AI Output (5-10 vocab, outline)     │
│ - Bắt timeout (504), unavailable (503), schema (502)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: COMPLETE (In DB Transaction)                  │
│ - Fencing check: Xác nhận Attempt vẫn IN_PROGRESS      │
│   (Nếu user đã nộp bài giữa chừng: Abort & Hoàn Quota) │
│ - Nếu Success: Lưu response JSON, cập nhật SUCCEEDED   │
│ - Nếu Failure: Cập nhật FAILED, Hoàn Quota tự động     │
└────────────────────────────────────────────────────────┘
```

### 6.5. Bảo mật ngữ cảnh & Đa ngôn ngữ (Snapshot & i18n)

1. **Snapshot Context Bất biến:** `WritingHintContextReader` chỉ đọc duy nhất từ `attempt.getExamSnapshot()`, tuyệt đối không truy vấn live Exam hay review mapper. Mọi answer keys, giải thích, và câu hỏi khác bị lọc bỏ trước khi đưa vào prompt LLM (chống rò rỉ đề và đáp án).
2. **Quy tắc phân giải ngôn ngữ:** `learningLanguage` = request → `User.targetLanguage` → lỗi required/unsupported (`422`); `hintLanguage` = request → learning language đã resolve. Không dùng ngôn ngữ live Exam, native language, locale giao diện hoặc `Accept-Language` làm mặc định. Retry FAILED cùng request ID giữ ngôn ngữ đã đóng băng; đổi ngôn ngữ cần request ID mới.
   Prompt yêu cầu mọi generated field theo `hintLanguage` và giữ nguyên đề gốc. Test fixture/schema chỉ kiểm tra contract và bảo toàn nội dung; vẫn cần staging verification để xác nhận ngôn ngữ của output từ model thật.
3. **Bảo mật Logging (Zero Leakage):** Không bao giờ ghi raw payload bài viết học viên hay nội dung LLM vào log. Mọi ngoại lệ trả về thông điệp lỗi tĩnh theo `ErrorCode` chuẩn.

---

## 7. VÒNG ĐỜI ATTEMPT VÀ API HIỆN CÓ

`TestAttemptController` là entry point của vòng đời làm bài. Tất cả endpoint đều yêu cầu user đã đăng nhập; `userId` được lấy từ `IdentityAdapter`, không lấy từ request body/path.

| Method | Endpoint | Hành vi chính |
|---|---|---|
| `POST` | `/api/v1/attempts` | Tạo attempt, chụp `exam_snapshot`, trả `201` + `WorkspaceResponse`. |
| `GET` | `/api/v1/attempts/{id}` hoặc `/{id}/workspace` | Resume workspace; chỉ owner; snapshot và saved answers lấy từ server. |
| `PUT` | `/api/v1/attempts/{id}/answers` | Autosave draft; trả version server. |
| `POST` | `/api/v1/attempts/{id}/sections/{sectionId}/lock` | Khóa section theo progression (Mock full exam). |
| `POST` | `/api/v1/attempts/{id}/submit` | Nộp bài idempotent; nếu attempt đã finalize thì trả trạng thái hiện có, không chấm lại. |
| `GET` | `/api/v1/attempts/{id}/result` | Result summary/review navigation; từ chối attempt còn `IN_PROGRESS`. |
| `GET` | `/api/v1/attempts/{id}/review/{partId}` | Review theo part trong snapshot; từ chối part ngoài scope và attempt còn sống. |
| `GET` | `/api/v1/attempts/{id}/writing-feedback?partId=` | Feedback Writing theo part; `Cache-Control: no-store`; không lazy-finalize. |
| `POST` | `/api/v1/attempts/{id}/practice-feedback` | Feedback objective tức thời, chỉ `PRACTICE` + `IN_PROGRESS`; read-only. |
| `POST` | `/api/v1/attempts/{id}/writing-hints` | Hints AI cho Writing Practice; ownership/quota/idempotency. |
| `GET` | `/api/v1/attempts/{id}/listening-playback` | Đọc timeline playback server-authoritative. |
| `POST` | `/api/v1/attempts/{id}/listening-playback/start` | Bắt đầu playback Mock idempotent; không nhận position/URL từ client. |
| `GET` | `/api/v1/exams/{id}/structure` | Cấu trúc đề đã publish cho learner. |

### 7.1. Submit, chấm objective và trạng thái

1. Submit khóa attempt, ghi `end_time`/`time_spent_seconds`, chuyển `SUBMITTED`.
2. Hệ thống chấm objective từ `exam_snapshot`; ưu tiên đáp án nằm trong snapshot, fallback adapter chỉ khi snapshot thiếu key nhưng có câu objective.
3. Objective thành công: lưu `result_summary`, `overall_score`, `section_scores`, `earned_score` và `is_correct_flags`; sau đó enqueue Writing (nếu có ESSAY).
4. Không có Writing: attempt `COMPLETED`. Có Writing: trạng thái tổng hợp do `WritingGradingAttemptStateResolver` quyết định (`AI_GRADING`, `AI_GRADING_QUEUED`, `GRADING_FAILED`, `COMPLETED`).
5. Objective lỗi: `GRADING_FAILED`; không enqueue Writing. Lỗi DB khi enqueue phải propagate để rollback submit, không tạo trạng thái partial.

`result`/`review` chỉ đọc dữ liệu đã lưu; không tự chấm lại. Với Mock đã quá deadline, `ensureFinalized` có thể finalize theo server time trước khi trả kết quả.

### 7.2. Practice feedback

- Chỉ áp dụng `test_mode=PRACTICE`, attempt `IN_PROGRESS`, đúng owner.
- Validate `partId`/`questionId` thuộc snapshot và là câu objective; không ghi đáp án vào `attempt_answers` và không gọi provider AI.
- `Cache-Control: no-store` cho cả success và lỗi.

---

## 8. WRITING GRADING PIPELINE (TV3-19/20/21)

### 8.1. Enqueue và worker

- `WritingGradingEnqueuer` quét các câu `ESSAY` trong section `WRITING` của snapshot, tạo tối đa một job cho mỗi `(attempt_id, part_id, question_id)`.
- Bài **≤ 10 từ** được chấm local 0 điểm (`TOO_SHORT`), không gọi Gemini, không reserve quota, không tải ảnh.
- Khi grading bật, job mới ở `READY`; khi tắt, job ở `WAITING` với `FEATURE_DISABLED` để có thể chấm sau khi bật.
- `WritingGradingDispatcher` chạy theo `poll-interval`, phục hồi lease hết hạn, giới hạn batch/concurrency và chỉ dispatch khi **cả** `enabled` và `dispatcher-enabled` đều bật.
- `WritingGradingWorker` claim job trong transaction ngắn, tải ảnh và gọi Gemini **ngoài** transaction DB, rồi complete/fail trong transaction riêng. Không log essay, prompt, feedback hay URL ảnh.

### 8.2. Trạng thái job và feedback

| Job status | Ý nghĩa | Feedback API |
|---|---|---|
| `READY`, `RUNNING`, `RETRY_WAIT` | Đang chờ/chạy hoặc retry | `PENDING` |
| `WAITING` | Chưa thể chạy (feature/provider/quota) | `QUEUED` |
| `SUCCEEDED` | Có kết quả đã validate | `DONE` |
| `FAILED` | Lỗi terminal/retry đã cạn | `FAILED` |
| `UNAVAILABLE` | Không thể chấm (ngôn ngữ, ngữ cảnh, ảnh...) | `UNAVAILABLE` |

- Feedback được đọc từ `attempt_answers.ai_feedback` trước, sau đó từ `writing_grading_jobs.result_json`; dữ liệu hỏng fail-closed sang `FAILED`, không hiển thị điểm giả.
- Response có `partStatus` tổng hợp: `DONE`, `PENDING`, `QUEUED`, `FAILED`, `UNAVAILABLE`; mỗi task có score, criteria, corrected essay, corrections và diff.
- Chỉ chấm Writing khi exam language là `en`; ngôn ngữ khác trả `UNAVAILABLE` (`UNSUPPORTED_LANGUAGE`). Giới hạn: essay tối đa 8.000 code points, context tối đa 16.000 code points.
- Ảnh trong snapshot: tối đa 2 ảnh/task; URL phải qua allowlist `testing.image-fetch.*`; ảnh lỗi/không hợp lệ được map thành lỗi an toàn, không làm lộ URL. Khi ảnh bị tắt nhưng task có visual context, feedback là `UNAVAILABLE` (`VISUAL_CONTEXT_UNSUPPORTED`).

### 8.3. Cấu hình vận hành

| Thuộc tính | Biến môi trường | Mặc định | Ghi chú |
|---|---|---|---|
| `testing.writing-grading.enabled` | `WRITING_GRADING_ENABLED` | `false` | Bật enqueue/worker. |
| `testing.writing-grading.dispatcher-enabled` | `WRITING_GRADING_DISPATCHER_ENABLED` | `false` | Phải bật cùng `enabled` để scheduler chạy. |
| `testing.writing-grading.images-enabled` | `WRITING_GRADING_IMAGES_ENABLED` | `false` | Cần `IMAGE_FETCH_ENABLED=true` và allowlist. |
| `testing.writing-grading.poll-interval` | `WRITING_GRADING_POLL_INTERVAL` | `5s` | Chu kỳ dispatcher. |
| `testing.writing-grading.batch-size` | `WRITING_GRADING_BATCH_SIZE` | `10` | Số job tối đa mỗi lượt. |
| `testing.writing-grading.concurrency` | `WRITING_GRADING_CONCURRENCY` | `2` | Số worker; executor không queue. |
| `testing.writing-grading.quota-recheck-interval` | `WRITING_GRADING_QUOTA_RECHECK_INTERVAL` | `60s` | Thời điểm recheck job `WAITING`. |
| `testing.writing-grading.lease-extension` | `WRITING_GRADING_LEASE_EXTENSION` | `15s` | Lease claim/recovery. |
| `testing.gemini.enabled` | `GEMINI_ENABLED` | `false` | Provider thật; test phải dùng fake. |
| `testing.gemini.api-key` | `GEMINI_API_KEY` | *(trống)* | Không ghi giá trị vào log/evidence. |
| `testing.gemini.model` | `GEMINI_MODEL` | *(trống)* | Model ID do operator chọn; phải hỗ trợ ảnh nếu bật visual. |
| `testing.image-fetch.enabled` | `IMAGE_FETCH_ENABLED` | `false` | Fetcher ảnh độc lập. |
| `testing.image-fetch.allowed-url-prefixes` | `IMAGE_FETCH_ALLOWED_URL_PREFIXES` | *(rỗng)* | Danh sách prefix HTTPS, phân tách bằng dấu phẩy. |
| `testing.writing-hints.enabled` | `WRITING_HINTS_ENABLED` | `false` | Hints vẫn text-only. |
| `testing.dictionary-lookup.enabled` | `DICTIONARY_LOOKUP_ENABLED` | `false` | Bật Tra từ AI chỉ trong Reading Practice; cần Gemini được cấu hình riêng. |
| `testing.dictionary-lookup.recovery-interval-ms` | `DICTIONARY_LOOKUP_RECOVERY_INTERVAL_MS` | `60000` | Chu kỳ thu hồi lease tra từ hết hạn. |

Khi bật visual grading, startup fail-fast nếu `IMAGE_FETCH_ENABLED=false` hoặc cấu hình fetch không hợp lệ. Không bật `GEMINI_ENABLED`/`IMAGE_FETCH_ENABLED` trong unit test; dùng fake boundary.

### 8.4. Tra từ AI trong Reading Practice

- `POST /api/v1/attempts/{attemptId}/dictionary-lookups` chỉ nhận từ/cụm và ngữ cảnh được xác minh lại từ snapshot của đúng Part/group Reading; Mock, attempt không thuộc người gọi, section khóa hoặc attempt đã kết thúc bị chặn.
- Prompt gửi một lần tới `GeminiClient` hiện có. Không ghi passage/từ chọn vào ledger hoặc log; kết quả chỉ lưu các trường định nghĩa để hỗ trợ idempotent replay.
- Hạn mức dùng feature `DICTIONARY_LOOKUP`: FREE mặc định 20/ngày, PREMIUM còn hạn mặc định 500/ngày, có thể điều chỉnh qua template quota admin; ngày reset theo `Asia/Ho_Chi_Minh`.
- Bật `DICTIONARY_LOOKUP_ENABLED=true` chỉ sau khi Gemini và migration đã sẵn sàng. Mặc định tắt.

---

## 9. KIỂM CHỨNG VÀ BÀN GIAO

- Ma trận traceability: `docs/testing/TV3-22-regression-matrix.md`.
- Browser smoke/accessibility và giới hạn mock: `docs/testing/TV3-22-browser-smoke.md`.
- Bàn giao tổng hợp, command chạy lại, evidence và findings: `docs/testing/TV3-22-handover.md`.
- Kết quả gate gần nhất và blocker phải được đọc từ handover/handoff, không suy rộng từ unit test sang end-to-end. PostgreSQL phải chạy trên database riêng; browser smoke dùng API mock không thay thế backend HTTP integration hay kiểm thử staging.
