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
