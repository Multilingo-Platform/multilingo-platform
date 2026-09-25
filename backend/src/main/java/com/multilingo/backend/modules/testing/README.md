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
