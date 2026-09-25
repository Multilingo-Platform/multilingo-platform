# 📖 MODULE VOCAB, FLASHCARDS & DASHBOARD (TỪ ĐIỂN, FLASHCARD SRS & DASHBOARD)

**Thành viên phụ trách:** Thành viên 5 (TV5)  
**Package:** `com.multilingo.backend.modules.vocab`  
**Tài liệu phân công chi tiết:** [docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (8 AD / 8 SD)

1. **UC11 - Tra cứu Từ điển đa ngôn ngữ:** Tra từ qua thanh tìm kiếm hoặc double-click trong bài đọc, hiển thị nghĩa tiếng Việt, phiên âm IPA, từ loại, ví dụ.
2. **UC11.1 - Lưu từ vào Flashcard cá nhân:** Bấm "+ Lưu vào Flashcard" từ kết quả tra từ hoặc trong phòng thi, lưu từ kèm câu ngữ cảnh gốc.
3. **UC12 - Quản lý Sổ tay Từ vựng:** Xem danh sách từ đã lưu, lọc theo trạng thái (Đang học, Đã thuộc).
4. **UC12.1 - Tạo mới / Chỉnh sửa thẻ từ vựng:** Thêm thẻ thủ công hoặc sửa lại câu ngữ cảnh, nghĩa cá nhân hóa.
5. **UC12.2 - Ôn tập lặp lại ngắt quãng (SuperMemo SM-2):** Lật thẻ 3D, chọn mức độ nhớ (Again, Hard, Good, Easy) để cập nhật hệ số `ease_factor` và tính ngày nhắc ôn tiếp theo.
6. **UC12.3 - Nhắc nhở ôn tập qua thông báo:** Kiểm tra thẻ đến hạn ôn, gửi thông báo đến chuông thông báo (Bell Header).
7. **UC13 - Xem Dashboard & Chuỗi ngày Streak:** Hiển thị chuỗi ngày Streak 🔥, tổng thời lượng học tập trong tuần/tháng.
8. **UC13.1 / UC13.2 - Phân tích Biểu đồ Radar & Đề xuất lộ trình:** Vẽ biểu đồ radar các kỹ năng, phân tích điểm yếu và đề xuất bài ôn luyện trọng tâm.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `dictionary_words`: Kho từ điển đa ngôn ngữ dùng chung (từ vựng, phiên âm IPA, từ loại, nghĩa JSONB).
- `user_flashcards`: Sổ thẻ từ vựng cá nhân, câu ngữ cảnh, chỉ số thuật toán SRS (`ease_factor`, `interval_days`, `next_review_date`).
- `user_study_stats`: Thống kê học tập, chuỗi ngày streak (`current_streak`, `longest_streak`), tổng thời gian học.
- `daily_study_logs`: Nhật ký học tập hàng ngày theo ngày.
- `notifications`: Bảng lưu trữ thông báo người dùng (`title`, `content`, `is_read`, `created_at`).

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.vocab
├── controller/          # DictionaryController, FlashcardController, StudyDashboardController, NotificationController
├── dto/                 # Data Transfer Objects
│   ├── request/         # CreateFlashcardRequest, ReviewCardRequest, UpdateCardRequest
│   └── response/        # DictionaryWordResponse, FlashcardResponse, DashboardStatsResponse, NotificationResponse
├── entity/              # DictionaryWord, UserFlashcard, UserStudyStat, DailyStudyLog, Notification
├── repository/          # DictionaryWordRepository, UserFlashcardRepository, UserStudyStatRepository,...
└── service/             # DictionaryService, FlashcardService, SM2AlgorithmService, DashboardService, NotificationService
    └── impl/            # DictionaryServiceImpl, FlashcardServiceImpl, SM2AlgorithmServiceImpl,...
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Kế thừa `BaseEntity`.
2. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>`.
3. **Thuật toán SM-2:** Triển khai độc lập trong `SM2AlgorithmService` với unit test độ chính xác 100%.
4. **Phân trang:** Trả về danh sách thẻ từ vựng bọc trong `PageResponse<T>`.
