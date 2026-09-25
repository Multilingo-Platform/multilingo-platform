# 📚 MODULE EXAM (ONBOARDING, KHO ĐỀ THI & CMS ĐỀ THI)

**Thành viên phụ trách:** Thành viên 2 (TV2)  
**Package:** `com.multilingo.backend.modules.exam`  
**Tài liệu phân công chi tiết:** [docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (7 AD / 7 SD)

1. **UC05 - Thiết lập mục tiêu học tập (Onboarding):** Chọn ngôn ngữ mẹ đẻ, ngôn ngữ học, chứng chỉ (IELTS/TOEIC/VNLTV) và Band điểm kỳ vọng.
2. **UC07 - Tra cứu & Lọc kho đề thi (Catalog):** Bộ lọc theo kỹ năng (Reading, Listening, Writing), độ khó, miễn phí / VIP.
3. **UC07.1 - Gợi ý đề thi cá nhân hóa (Recommendation):** Tự động đề xuất các bộ đề dựa trên Target Band của học viên.
4. **UC14.1 - Thêm mới đề thi đa cấp (CMS Exam Builder):** Tạo Exam -> tạo Sections (kỹ năng) -> tạo Parts -> đính kèm Audio/Ảnh và đóng gói câu hỏi/đáp án/giải thích vào JSONB.
5. **UC14.2 - Chỉnh sửa đề thi (CMS Exam Editor):** Sửa nội dung bài đọc, cập nhật media URL, sửa đáp án, bật/tắt cờ xuất bản `is_published`.
6. **UC14.3 - Xóa đề thi (CMS Delete Exam):** Kiểm tra ràng buộc và xóa đề thi (hoặc xóa mềm), ghi vết vào `audit_logs`.
7. **UC14.4 - Import đề thi từ file (JSON/Excel):** Tải file `.json` hoặc `.xlsx` câu hỏi, tự động parse và validate tính toàn vẹn, lưu tự động vào DB.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `exams`: Tiêu đề đề thi, mã đề (`slug`), loại chứng chỉ, thời lượng, cờ `is_published`, `is_free`.
- `exam_sections`: Phân đoạn kỹ năng (LISTENING, READING, WRITING), thời lượng từng phần.
- `exam_parts`: Chứa cột `content_data` (JSONB) lưu bài đọc, audio URL, danh sách câu hỏi, đáp án đúng và giải thích chi tiết.

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.exam
├── controller/          # ExamCatalogController, AdminExamController, OnboardingController
├── dto/                 # Data Transfer Objects
│   ├── request/         # CreateExamRequest, UpdateExamRequest, ExamFilterRequest, OnboardingRequest
│   └── response/        # ExamDetailResponse, ExamListResponse, RecommendedExamsResponse
├── entity/              # Exam, ExamSection, ExamPart
├── repository/          # ExamRepository, ExamSectionRepository, ExamPartRepository
└── service/             # ExamService, AdminExamService, ExamImportService, OnboardingService
    └── impl/            # ExamServiceImpl, AdminExamServiceImpl,...
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Mọi Entity kế thừa `BaseEntity`.
2. **Cột JSONB:** Dùng `@JdbcTypeCode(SqlTypes.JSON)` và `@Column(name = "content_data", columnDefinition = "jsonb")`.
3. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>` (hoặc `ApiResponse<PageResponse<T>>`).
4. **Lỗi:** Ném `AppException(ErrorCode.RESOURCE_NOT_FOUND)` khi không tìm thấy mã đề hoặc part tương ứng.
