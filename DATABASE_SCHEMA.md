# TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)
*Dự án: Nền tảng Thi thử và Đánh giá năng lực Đa ngôn ngữ (Multilingo)*

Tài liệu này mô tả chi tiết cấu trúc các bảng trong cơ sở dữ liệu PostgreSQL, dựa trên việc tổng hợp chức năng và các tài liệu tham chiếu. Hệ thống sử dụng kết hợp các trường quan hệ (Relational) và trường phi cấu trúc (JSONB) để đảm bảo tốc độ và sự linh hoạt.

---

## CỤM 1: Người dùng, Gói cước & Hạn mức (Users & Subscriptions)
Lưu thông tin tài khoản và kiểm soát giới hạn tính năng AI.

### Bảng `users`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính người dùng |
| `email` | VARCHAR | Unique, Tài khoản đăng nhập |
| `password_hash` | VARCHAR | Mật khẩu mã hóa |
| `role` | VARCHAR | Phân quyền (ROLE_USER, ROLE_ADMIN) |
| `native_language` | VARCHAR | Ngôn ngữ mẹ đẻ (VD: `vi`, `en`) |
| `target_language` | VARCHAR | Ngôn ngữ muốn học/thi (VD: `en`, `vi`) |
| `subscription_tier` | VARCHAR | Hạng tài khoản (FREE, PREMIUM) |
| `premium_expires_at` | TIMESTAMP | Thời gian hết hạn gói Premium |

### Bảng `subscription_plans`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | VARCHAR (PK) | Mã gói (VD: `plan-30-days`) |
| `name` | VARCHAR | Tên hiển thị của gói |
| `price` | NUMERIC | Giá tiền |
| `duration_days` | INT | Số ngày hiệu lực (VD: 30, 90) |

### Bảng `transactions`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Định danh giao dịch |
| `user_id` | UUID (FK) | Liên kết với `users` |
| `plan_id` | VARCHAR (FK) | Liên kết với `subscription_plans` |
| `status` | VARCHAR | Trạng thái thanh toán (SUCCESS, PENDING, FAILED) |
| `payment_method` | VARCHAR | Cổng thanh toán (VNPAY, MOMO) |
| `paid_at` | TIMESTAMP | Thời gian thanh toán thành công |

### Bảng `user_quotas`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính |
| `user_id` | UUID (FK) | Liên kết với `users` |
| `feature_code` | VARCHAR | Mã tính năng (VD: `AI_WRITING_GRADING`, `AI_DICTIONARY`) |
| `used_count` | INT | Số lượt đã sử dụng |
| `max_limit` | INT | Số lượt tối đa được phép dùng |
| `reset_date` | TIMESTAMP | Thời điểm reset lại `used_count` về 0 (VD: Chủ nhật hàng tuần) |

---

## CỤM 2: Ngân hàng Đề thi (Exam Core)
Chứa cấu trúc đề thi đa cấp bậc (Exam -> Section -> Part), áp dụng lưu trữ JSONB cho dữ liệu chi tiết của câu hỏi.

### Bảng `exams`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | VARCHAR (PK) | Mã đề nguyên khối (VD: `cam-18-test-1`) |
| `title` | VARCHAR | Tên đề hiển thị |
| `type` | VARCHAR | Loại chứng chỉ (IELTS, TOEIC, VNLTV) |
| `exam_language` | VARCHAR | Ngôn ngữ của đề thi (VD: `en`, `vi`) |
| `is_published` | BOOLEAN | Trạng thái hiển thị với học viên |
| `created_at`, `updated_at`| TIMESTAMP | Thời gian tạo và cập nhật |

### Bảng `exam_sections` (Kỹ năng)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính kỹ năng |
| `exam_id` | VARCHAR (FK) | Liên kết với bảng `exams` |
| `skill_type` | VARCHAR | Kỹ năng (READING, LISTENING, WRITING) |
| `duration_minutes` | INT | Tổng thời gian đếm ngược làm bài (VD: 60) |

### Bảng `exam_parts` (Task / Playlist)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính Part |
| `section_id` | UUID (FK) | Liên kết với bảng `exam_sections` |
| `part_number` | INT | Thứ tự phát (Playlist audio) hoặc thứ tự Tab hiển thị |
| `content_data` | **JSONB** | **(Quan trọng)** Chứa nội dung bài đọc, mảng các câu hỏi, các options, `correct_answer`, và `media_url` (Cloudinary/Firebase). |

---

## CỤM 3: Lịch sử Thi & Kết quả (Test Tracking)
Lưu bài nộp, đáp án của học sinh và điểm số thống kê.

### Bảng `test_attempts` (Phiên làm bài)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Định danh phiên thi |
| `user_id` | UUID (FK) | Liên kết `users` |
| `exam_id` | VARCHAR (FK) | Liên kết `exams` |
| `test_scope` | VARCHAR | Phạm vi: FULL_EXAM, SINGLE_SKILL, SINGLE_PART |
| `test_mode` | VARCHAR | Chế độ: MOCK_TEST (Thi thật), PRACTICE (Luyện tập) |
| `status` | VARCHAR | Trạng thái: IN_PROGRESS, AI_GRADING, COMPLETED, ABANDONED |
| `start_time`, `end_time` | TIMESTAMP | Dùng để tính toán tốc độ làm bài |
| `overall_score` | NUMERIC | Điểm tổng kết |
| `section_scores` | **JSONB** | Điểm số phân bổ theo từng kỹ năng |

### Bảng `attempt_answers` (Đáp án chi tiết)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính |
| `attempt_id` | UUID (FK) | Liên kết với `test_attempts` |
| `part_id` | UUID (FK) | Liên kết với `exam_parts` |
| `user_answers` | **JSONB** | Mảng đáp án thí sinh điền (VD: `{"q1": "A", "q2": "fox"}`) |
| `is_correct_flags`| **JSONB** | Mảng chấm Đúng/Sai tự động (VD: `{"q1": true, "q2": false}`) |
| `ai_feedback` | **JSONB** | Báo cáo đa chiều do AI trả về cho phần Writing (Ngữ pháp, Từ vựng) |
| `skill_stats` | **JSONB** | Báo cáo thống kê số câu đúng/tổng theo từng dạng câu hỏi (Matching, T/F/NG) để vẽ biểu đồ Radar. |

---

## CỤM 4: Sổ tay Từ vựng (Flashcard - Spaced Repetition)
Hỗ trợ tính năng tra từ điển và ôn tập lặp lại ngắt quãng.

### Bảng `dictionary_words` (Từ điển dùng chung)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính |
| `word` | VARCHAR | Từ vựng |
| `language_code` | VARCHAR | Ngôn ngữ của từ (VD: `en`, `vi`) |
| `phonetic` | VARCHAR | Phiên âm (IPA) |
| `pos` | VARCHAR | Từ loại (Danh từ, động từ...) |
| `default_meaning` | **JSONB** | Nghĩa mặc định đa ngôn ngữ (VD: `{"vi": "Quả táo", "en": "A fruit"}`) |

### Bảng `user_flashcards` (Dữ liệu cá nhân hóa)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Khóa chính |
| `user_id` | UUID (FK) | Liên kết `users` |
| `word_id` | UUID (FK) | Liên kết `dictionary_words` |
| `custom_meaning` | TEXT | Nghĩa dịch sát ngữ cảnh (Do AI sinh ra khi học viên double-click tra từ trong bài đọc) |
| `example_sentence` | TEXT | Đoạn văn chứa từ vựng trong lúc tra, giúp học sinh nhớ ngữ cảnh |
| `status` | VARCHAR | NEW, LEARNING, MASTERED |
| `review_count` | INT | Số lần đã ôn tập |
| `ease_factor` | NUMERIC | Hệ số độ khó (Phục vụ thuật toán SRS) |
| `interval_days` | INT | Chu kỳ ngày nhắc ôn tập |
| `next_review_date` | TIMESTAMP | Lịch nhắc ôn tập cụ thể |
