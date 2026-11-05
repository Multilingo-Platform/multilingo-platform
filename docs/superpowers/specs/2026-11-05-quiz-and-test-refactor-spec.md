# Đặc tả Refactor Tinh gọn: Luyện tập (Quiz Practice) & Thi thử (Vocab Test)

## 1. Bối cảnh & Mục tiêu
- **Vấn đề:** 
  - Module `vocab` ở Backend cho hai tính năng **Luyện tập trắc nghiệm** và **Thi thử từ vựng** hiện đang bị Over-engineering nghiêm trọng: sử dụng cơ chế băm mật mã SHA-256 canonical hash (`PracticePayloadHasher`, `TestProgressHasher`), reserve receipts kiểu ngân hàng, CAS versioning khắt khe gây lỗi xung đột mạng (`409 VOCAB_TEST_VERSION_CONFLICT`), và chia nhỏ ra tới 12+ file/classes phụ trợ không cần thiết (`PracticeCompletionWriter`, `QuizScorer`, `QuizScoringResult`, các schedulers...).
  - Mã nguồn sinh 4 lựa chọn trắc nghiệm (1 đáp án đúng + 3 đáp án nhiễu) bị lặp lại 2 lần độc lập ở cả `QuizQuestionGenerator` và `VocabTestServiceImpl`.
- **Mục tiêu:**
  - **Đơn giản hóa thực dụng (KISS):** Loại bỏ toàn bộ các lớp băm SHA-256, scheduler rác, các writer/scorer trung gian thừa thãi.
  - **Tái sử dụng thống nhất:** Tạo `VocabQuestionGenerator` dùng chung 1 thuật toán sinh 4 đáp án trắc nghiệm chuẩn từ `UserFlashcard` cho cả Luyện tập và Thi thử.
  - **Rà soát & Tối ưu DTOs:**
    - Xóa DTO thừa (`QuizScoringResult`, băm hash).
    - Chuẩn hóa các Option DTO (`PracticeOptionDto` / `VocabTestOptionDto`) và Answer DTO.
    - Giữ trọn vẹn khả năng tương thíChế độ Học & Luyện tập
Lựa chọn phương pháp rèn luyện phù hợp để ghi nhớ từ vựng hiệu quả nhấtch API Contract với Frontend.
  - **Đồng bộ hóa Gamification:** Cố định cộng điểm XP đơn giản (+10 XP cho Practice, +20 XP cho Test hoàn thành) và lưu vĩnh viễn vào DB thông qua `StudyActivityService.recordActivity(...)`.
  - **Không thay đổi Database Schema:** Không thêm bảng mới, không thêm/xóa cột, không viết Flyway migration mới.

---

## 2. Rà soát & Tinh gọn DTO (DTO Audit & Redesign)

### A. DTOs Xóa Bỏ (Obsolete / Redundant DTOs)
1. `QuizScoringResult.java`: DTO nội bộ của `QuizScorer` -> **Xóa bỏ**.
2. Các class băm `PracticePayloadHasher.java` & `TestProgressHasher.java` -> **Xóa bỏ**.
3. `PracticeCompletionWriter.java` -> **Xóa bỏ** (gộp logic vào `QuizPracticeServiceImpl`).
4. `QuizScorer.java` -> **Xóa bỏ** (gộp vào `QuizPracticeServiceImpl`).

### B. DTOs Chuẩn Hóa & Giữ Lại
1. **Luyện tập (Practice):**
   - `CreateQuizSessionRequest`: `{ filterStatus: String, limit: Integer }`
   - `SubmitPracticeRequest`: `{ durationSeconds: Integer, answers: List<SubmitPracticeAnswerDto> }`
   - `SubmitPracticeAnswerDto`: `{ questionId: Integer, selectedOptionId: String }`
   - `PracticeSessionSnapshotDto`: `{ sessionId, deckId, deckName, totalQuestions, questions }`
   - `PracticeQuestionSnapshotDto`: `{ questionId, cardId, targetWord, phonetic, pos, sentence, options, correctOptionId, explanation }`
   - `PracticeOptionDto`: `{ optionId: String, text: String }`
   - `SubmitPracticeResponse`: `{ sessionId, totalQuestions, correctAnswers, accuracyPercent, xpEarned, currentStreak, streakIncremented, timeSpentSeconds, wrongAnswers }`
   - `PracticeWrongAnswerDto`: `{ questionId, targetWord, phonetic, sentence, selectedOptionId, correctOptionId, correctMeaning, explanation }`
2. **Thi thử (Vocab Test):**
   - `GenerateVocabTestRequest`: `{ limit: Integer }`
   - `AutoSaveProgressRequest`: `{ expectedVersion: Integer, answers: List<VocabTestAnswerItemDto> }` (BE linh hoạt lưu tiến độ mà không ném lỗi 409 khi mạng lag).
   - `SubmitVocabTestRequest`: `{ expectedVersion: Integer, idempotencyKey: String, answers: List<VocabTestAnswerItemDto> }`
   - `VocabTestAnswerItemDto`: `{ questionNumber: Integer, selectedKey: String, flagged: Boolean }`
   - `VocabTestExamDto`: `{ testToken, deckId, deckName, timeLimitSeconds, totalQuestions, startedAt, expiresAt, serverTime, questions }`
   - `VocabTestQuestionDto`: `{ questionNumber, cardId, word, phonetic, pos, sentence, options }`
   - `VocabTestOptionDto`: `{ key: String, text: String }`
   - `VocabTestResultResponse`: `{ testToken, status, score, correctCount, totalQuestions, xpEarned, timeSpentSeconds, currentStreak, streakIncremented, submittedAt }`
   - `VocabTestResumeResponse`: `{ testToken, deckId, deckName, status, progressVersion, timeLimitSeconds, totalQuestions, startedAt, expiresAt, serverTime, deadlinePassed, questions, savedAnswers, resultSummary }`
   - `VocabTestReviewDetailDto` & `VocabTestReviewItemDto`: Dành cho trang xem lại giải thích chi tiết sau khi nộp bài.
   - `VocabTestHistoryDto`: Dành cho lịch sử làm bài.

---

## 3. Kiến trúc Backend Mới

```
backend/src/main/java/com/multilingo/backend/modules/vocab/
├── controller/
│   ├── QuizPracticeController.java (Giữ nguyên endpoints)
│   └── VocabTestController.java    (Giữ nguyên endpoints)
├── service/
│   ├── QuizPracticeService.java
│   ├── VocabTestService.java
│   ├── impl/
│   │   ├── QuizPracticeServiceImpl.java  (~100 dòng, trong sáng, dễ bảo trì)
│   │   └── VocabTestServiceImpl.java      (~180 dòng, loại bỏ 568 dòng cũ rườm rà)
│   └── quiz/
│       └── VocabQuestionGenerator.java    (Dùng chung sinh câu hỏi 4 lựa chọn cho cả 2 luồng)
```

### Luồng xử lý Luyện tập (Quiz Practice):
1. **Tạo phiên:** Lấy cards từ `user_flashcards` ➔ Dùng `VocabQuestionGenerator` sinh câu hỏi trắc nghiệm ➔ Lưu snapshot lên Redis với TTL 30 phút (để phục vụ reload/F5) ➔ Trả `PracticeSessionSnapshotDto` cho Frontend.
2. **Nộp bài:** Đọc session snapshot từ Redis ➔ Chấm điểm câu trả lời trực tiếp (so sánh `selectedOptionId` với `correctOptionId`) ➔ Tạo danh sách `wrongAnswers` ➔ Gọi `StudyActivityService.recordActivity(...)` cộng cố định **10 XP** và lưu vào DB ➔ Lưu receipt đơn giản vào `practice_completion_receipts` ➔ Xóa session trên Redis ➔ Trả kết quả cho Frontend.

### Luồng xử lý Thi thử (Vocab Test):
1. **Sinh đề thi:** Lấy cards từ `user_flashcards` ➔ Dùng `VocabQuestionGenerator` sinh danh sách câu hỏi ➔ Lưu vào `vocab_test_attempts` với `questions_snapshot` ➔ Trả `VocabTestExamDto` (ẩn đáp án đúng).
2. **Khôi phục bài (Resume):** Tìm attempt theo `testToken` và `userId` ➔ Trả lại đề thi và các câu đã làm.
3. **Autosave tiến độ:** Cập nhật `answersProgress` vào DB theo `testToken` và `userId` mà không so sánh hash phức tạp gây nghẽn. Trả về version tăng dần.
4. **Nộp bài:** Lấy đề thi từ `questions_snapshot` ➔ Chấm điểm câu trả lời ➔ Tính điểm theo thang 100 ➔ Gọi `StudyActivityService.recordActivity(...)` cộng cố định **20 XP** ➔ Cập nhật trạng thái `COMPLETED` ➔ Lưu `result_summary` và trả kết quả.
5. **Xem lại (Review):** Lấy `questions_snapshot` và `answers_progress` ➔ Trả về đầy đủ giải thích và phương án đúng/sai.

---

## 4. Tinh chỉnh Frontend
- Bỏ cờ `frozenPayloadRef` và các logic hack hash chống 409 conflict ở `QuizPracticeView.tsx`.
- Đồng bộ màu sắc nút/thẻ bài thi từ `amber` sang `orange-600` / `orange-500` chuẩn nhận diện brand.
- Giữ nguyên trải nghiệm phím tắt, timer, âm thanh và kết quả tổng kết.

