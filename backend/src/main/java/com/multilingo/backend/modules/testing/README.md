# 📝 MODULE TESTING & AI ASSISTANT (THI THỬ, LUYỆN TẬP & TRỢ LÝ AI)

**Thành viên phụ trách:** Thành viên 3 (TV3)  
**Package:** `com.multilingo.backend.modules.testing`  
**Tài liệu phân công chi tiết:** [docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (7 AD / 7 SD)

1. **UC08 - Không gian làm bài thi & Luyện tập:** Học viên chọn làm full đề tính giờ (Mock Test) hoặc luyện từng part/kỹ năng (Practice), làm bài, nghe audio.
2. **UC08.4 - Gợi ý dàn ý & Từ vựng từ AI (Writing Hints):** Bấm "💡 Gợi ý AI Hints" trong khi luyện viết, gọi Gemini API sinh dàn ý và 5-10 từ vựng theo chủ đề bài viết.
3. **UC08.5 - Tự động thu bài khi hết giờ:** Đồng hồ đếm ngược về `00:00`, tự động khóa form và nộp bài lên hệ thống.
4. **UC09 - Chấm điểm trắc nghiệm & điền từ tự động:** So khớp câu trả lời với đáp án đúng, chuẩn hóa text (`trim()`, lowercase), sinh mảng `is_correct_flags`, tính điểm tổng.
5. **UC09.2 - Chấm điểm Writing bằng Gemini 2.5 Flash:** Gửi bài viết và tiêu chí chấm (Task Achievement, Coherence, Lexical, Grammar) lên Gemini API, nhận về điểm thành phần, lời nhận xét và bài viết mẫu sửa lỗi.
6. **UC10 - Xem kết quả bài thi & Lời giải chi tiết:** Xem bảng điểm tổng quan, chi tiết từng câu đúng/sai kèm giải thích song ngữ.
7. **UC10.2 - Xem nhận xét AI & Giao diện Diff-View sửa lỗi:** Hiển thị nhận xét 4 tiêu chí từ Gemini và giao diện so sánh sửa lỗi bài viết tự luận.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `test_attempts`: Quản lý phiên làm bài (`test_mode`: `MOCK_TEST`, `PRACTICE`; `test_scope`: `FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART`), thời gian bắt đầu/kết thúc, tổng điểm.
- `attempt_answers`: Chứa `user_answers` (JSONB), `is_correct_flags` (JSONB), và `ai_feedback` (JSONB - kết quả AI chấm bài và gợi ý sửa lỗi).

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.testing
├── controller/          # TestAttemptController, GradingController, AIAssistantController
├── dto/                 # Data Transfer Objects
│   ├── request/         # StartTestRequest, SubmitTestRequest, AIWritingHintRequest, AIGradeRequest
│   └── response/        # TestAttemptResponse, TestResultDetailResponse, AIFeedbackResponse
├── entity/              # TestAttempt, AttemptAnswer
├── repository/          # TestAttemptRepository, AttemptAnswerRepository
└── service/             # TestAttemptService, GradingEngineService, GeminiAIService
    └── impl/            # TestAttemptServiceImpl, GradingEngineServiceImpl, GeminiAIServiceImpl
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Kế thừa `BaseEntity`.
2. **Cột JSONB:** Quản lý `user_answers`, `is_correct_flags`, `ai_feedback` bằng kiểu JSONB.
3. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>`.
4. **Tích hợp Gemini AI:** Gọi API bằng HTTP Client (WebClient / RestTemplate / Spring AI), bao bọc lỗi kết nối và ném `AppException` nếu AI timeout hoặc quota vượt giới hạn.

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
> Client Gemini tại TV3-17 là **hạ tầng transport độc lập** và **chưa được nối vào bất kỳ use case nghiệp vụ nào** (chưa inject vào Submit test, Practice feedback hay Writing Grading Worker). Việc hoàn thành hạ tầng HTTP client không đồng nghĩa tính năng AI Writing Hints hay Auto-grading đã hoạt động.

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
