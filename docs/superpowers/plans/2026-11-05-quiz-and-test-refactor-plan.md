# Kế hoạch Refactor Tinh gọn Luyện tập (Quiz Practice) & Thi thử (Vocab Test)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor toàn bộ mã nguồn Backend của phần Luyện tập trắc nghiệm và Thi thử từ vựng, loại bỏ các tầng over-engineered (băm SHA-256, schedulers rác, classes trung gian thừa thãi), hợp nhất bộ sinh câu hỏi `VocabQuestionGenerator`, đơn giản hóa DTOs và đồng bộ giao diện Frontend.

**Architecture:** Hợp nhất logic sinh câu hỏi 4 lựa chọn trắc nghiệm vào `VocabQuestionGenerator.java` dùng chung cho cả Luyện tập và Thi thử. Rút gọn `QuizPracticeServiceImpl.java` và `VocabTestServiceImpl.java` thành các service tuần tự, trực tiếp, dễ đọc và dễ bảo trì. Giữ nguyên 100% API contract để tương thích Frontend. Xóa các class băm SHA-256, scorer trung gian và scheduler rác.

**Tech Stack:** Java 21, Spring Boot 3, PostgreSQL, Redis, React 19, TypeScript, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-05-quiz-and-test-refactor-spec.md`

## Global Constraints
- Không thay đổi cấu trúc bảng Database (không thêm cột, không đổi kiểu dữ liệu, không tạo Flyway migration).
- Giữ nguyên URL endpoints và cấu trúc dữ liệu JSON để không làm gãy Frontend.
- Gamification: Cố định 10 XP cho Practice hoàn thành, 20 XP cho Vocab Test hoàn thành, lưu vĩnh viễn vào DB qua `StudyActivityService.recordActivity(...)`.
- Tuyệt đối không tự ý `git commit` khi người dùng chưa duyệt diff và xác nhận bằng văn bản.

## Review Focus
1. `QuizPracticeService`: Tạo bài và nộp bài hoạt động trơn tru không còn lỗi 409 SHA-256 hash conflict khi làm lại hay gửi lại.
2. `VocabTestService`: Autosave tiến độ bài thi lưu thẳng vào DB mượt mà, không bị lỗi 409 version conflict khi mạng chập chờn.
3. Sinh câu hỏi: Đảm bảo có tối thiểu 4 từ vựng và 4 nghĩa phân biệt trong bộ thẻ để tạo 4 lựa chọn không trùng lặp.
4. XP & Streak: Tích hợp đầy đủ với `StudyActivityService`, điểm XP được cộng và lưu vĩnh viễn vào bảng `user_study_stats.total_xp`.
5. Frontend: Giao diện Luyện tập và Thi thử hiển thị đúng, màu sắc cam chuẩn nhận diện, nộp bài thành công và chuyển sang màn hình kết quả.

---

## Danh sách Task Thực thi (Task Checklist)

### Task 1: Xây dựng Bộ sinh Câu hỏi Dùng chung (`VocabQuestionGenerator.java`)
**Mục tiêu:** Hợp nhất logic sinh câu hỏi trắc nghiệm 4 lựa chọn (1 đúng + 3 nhiễu ngẫu nhiên) dùng chung cho cả Luyện tập và Thi thử, loại bỏ sự trùng lặp mã nguồn giữa `QuizQuestionGenerator` và `VocabTestServiceImpl`.

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/quiz/QuizQuestionGenerator.java` (hoặc đổi tên thành bộ sinh dùng chung)
- Test: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/QuizQuestionGeneratorTest.java`

**Checklist:**
- [ ] Bước 1: Viết test cho trường hợp sinh câu hỏi với bộ thẻ đủ điều kiện và không đủ điều kiện (thiếu thẻ, trùng nghĩa).
- [ ] Bước 2: Cập nhật `QuizQuestionGenerator` hỗ trợ cả hai chế độ:
  - Sinh snapshot đầy đủ cho Luyện tập (gồm cả `correctOptionId` để FE phản hồi tức thì khi click).
  - Sinh snapshot nội bộ cho Thi thử (ẩn đáp án đúng khi gửi về client, lưu `correctKey` trong snapshot nội bộ).
- [ ] Bước 3: Chạy test `QuizQuestionGeneratorTest` và xác nhận PASS.

---

### Task 2: Dọn dẹp & Xóa bỏ các Class Over-engineered và DTO Thừa Rác
**Mục tiêu:** Xóa bỏ hoàn toàn các class băm SHA-256 rườm rà, các class scorer / writer trung gian và scheduler rác không cần thiết.

**Files cần xóa:**
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/quiz/PracticePayloadHasher.java`
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/quiz/TestProgressHasher.java`
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/PracticeCompletionWriter.java`
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/quiz/QuizScorer.java`
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/quiz/QuizScoringResult.java`
- Delete: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/scheduler/PracticeReceiptCleanupScheduler.java`
- Delete các test file tương ứng: `PracticePayloadHasherTest.java`, `PracticeCompletionWriterTest.java`, `QuizScorerTest.java`.

**Checklist:**
- [ ] Bước 1: Xóa các file thừa rác nói trên.
- [ ] Bước 2: Xóa các unit test không còn phù hợp tương ứng với các class đã xóa.

---

### Task 3: Refactor Tinh gọn `QuizPracticeServiceImpl.java` (Phần Luyện tập)
**Mục tiêu:** Viết lại `QuizPracticeServiceImpl` gọn gàng (~100 dòng), đọc hiểu trong 2 phút:
1. `createPracticeSession`: Dùng `QuizQuestionGenerator` sinh câu hỏi ➔ Lưu Redis snapshot (TTL 30 phút).
2. `submitPracticeSession`: Đọc Redis snapshot ➔ Chấm điểm trực tiếp ➔ Tạo danh sách `wrongAnswers` ➔ Gọi `StudyActivityService.recordActivity` cộng cố định 10 XP ➔ Lưu receipt đơn giản ➔ Xóa Redis session ➔ Trả kết quả.

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/QuizPracticeServiceImpl.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/QuizPracticeServiceTest.java`

**Checklist:**
- [ ] Bước 1: Viết test cases kiểm tra luồng tạo phiên và nộp bài luyện tập (tính đúng số câu, accuracy %, cộng 10 XP, lưu streak).
- [ ] Bước 2: Viết lại `QuizPracticeServiceImpl` loại bỏ toàn bộ băm SHA-256 và `PracticeCompletionWriter`.
- [ ] Bước 3: Chạy test `QuizPracticeServiceTest` và xác nhận PASS.

---

### Task 4: Refactor Tinh gọn `VocabTestServiceImpl.java` (Phần Thi thử)
**Mục tiêu:** Rút gọn `VocabTestServiceImpl` từ 568 dòng xuống dưới ~200 dòng trong sáng:
1. Dùng chung `QuizQuestionGenerator` để sinh đề thi.
2. Đơn giản hóa `saveProgress` (Autosave): Cập nhật tiến độ `answers_progress` trực tiếp vào DB, không so sánh hash SHA-256 gây 409 version conflict khi mạng lag.
3. Đơn giản hóa `submitTest`: Chấm điểm trực tiếp, tính điểm theo thang 100, cộng cố định 20 XP và lưu DB qua `StudyActivityService`.
4. Rút gọn các phương thức helper serialize/deserialize JSON với `ObjectMapper`.

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/service/impl/VocabTestServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/vocab/repository/VocabTestAttemptRepository.java` (đơn giản hóa query update autosave)
- Modify: `backend/src/test/java/com/multilingo/backend/modules/vocab/service/VocabTestServiceTest.java`

**Checklist:**
- [ ] Bước 1: Viết/cập nhật test cases cho `VocabTestServiceTest` (tạo đề, autosave, nộp bài, xem lại đáp án chi tiết).
- [ ] Bước 2: Cập nhật `VocabTestAttemptRepository` để cập nhật tiến độ linh hoạt, tin cậy.
- [ ] Bước 3: Viết lại `VocabTestServiceImpl` tinh gọn, rõ ràng.
- [ ] Bước 4: Chạy test `VocabTestServiceTest` và xác nhận PASS.

---

### Task 5: Tinh chỉnh Frontend (`QuizPracticeView.tsx` & `VocabTestView.tsx`)
**Mục tiêu:** Loại bỏ các hack chống 409 hash conflict ở FE, đồng bộ màu sắc sang tone màu cam của hệ thống.

**Files:**
- Modify: `frontend/src/features/vocab/modes/quiz/QuizPracticeView.tsx`
- Modify: `frontend/src/features/vocab/modes/test/VocabTestView.tsx`
- Modify: `frontend/src/features/vocab/modes/test/VocabTestReviewView.tsx`

**Checklist:**
- [ ] Bước 1: Dọn dẹp cờ `frozenPayloadRef` và ghi chú hash ở `QuizPracticeView.tsx`.
- [ ] Bước 2: Đồng bộ màu sắc nút/thẻ bài thi từ `amber` sang `orange-600` / `orange-500`.
- [ ] Bước 3: Chạy `npm --prefix frontend run build` và xác nhận build thành công không có lỗi.

---

### Task 6: Nghiệm thu Tổng thể (Verification & Git Diff Summary)
**Mục tiêu:** Chạy toàn bộ test suite của backend và frontend, đối soát kết quả, chuẩn bị bản tóm tắt diff để người dùng kiểm tra trước khi commit.

**Checklist:**
- [ ] Bước 1: Chạy `mvn -f backend/pom.xml test -Dtest=FlashcardStudyServiceTest,QuizPracticeServiceTest,VocabTestServiceTest,QuizQuestionGeneratorTest` và xác nhận 100% PASS.
- [ ] Bước 2: Chạy `npm --prefix frontend run build` kiểm tra build FE.
- [ ] Bước 3: Hiển thị tóm tắt `git diff --stat` và xin xác nhận của người dùng trước khi thực hiện `git commit`.

