# Thiết kế: Kết nối Module Testing với Dữ liệu thực từ Database (DbExamAdapter & DbGradingAdapter)

## 1. Ngữ cảnh (Context)
- Hiện tại, Module **Testing (TV3)** đang sử dụng `FixtureExamAdapter` và `FixtureGradingAdapter` để đọc dữ liệu đề thi và đáp án từ các file JSON tĩnh (`exam-fixture.json`, `grading-fixture.json`).
- Module **Exam (TV2)** đã phát triển hoàn thiện các Entity (`Exam`, `ExamSection`, `ExamPart`), Repository và đã có `MockDataSeeder` tự động seed dữ liệu đề thi đầy đủ (bao gồm cả cấu trúc, câu hỏi, đáp án, và giải thích) vào cột `content_data` (chuẩn JSON) của bảng `exam_parts`.
- **Mục tiêu:** Chuyển đổi Module Testing để lấy dữ liệu đề thi và đáp án chấm điểm trực tiếp từ Database thực do TV2 quản lý, thay vì dùng file fixture.

## 2. Giải pháp kỹ thuật (Approach)
Chúng ta sẽ triển khai 2 Adapter mới tuân thủ interface của Module Testing nhưng gọi trực tiếp xuống `ExamRepository` của Module Exam.

### 2.1. DbExamAdapter
- **Nhiệm vụ:** Implement `ExamAdapter.findById(Integer examId)`.
- **Logic:** 
  - Gọi `examRepository.findById()`.
  - Ánh xạ từ các entity `Exam`, `ExamSection`, `ExamPart` sang các DTO nội bộ của Testing (`ExamFixture`, `SectionFixture`, `PartFixture`).
  - **Bảo mật quan trọng:** Trong cột `content_data` của `ExamPart`, mảng `questions` đang chứa cả `correct_answer` và `explanation`. Adapter này có nhiệm vụ clone mảng `questions` và xóa bỏ (`remove`) 2 field này trước khi trả về `ExamFixture`. Nếu không, đáp án sẽ bị lộ ra Frontend thông qua API lấy `exam_snapshot`.
  - **Lưu ý biên dịch (JDK 21 + Lombok bug):** Để tránh lỗi `TypeTag :: UNKNOWN` của `javac` khi kết hợp Lombok và JDK 21, ta sẽ sử dụng ép kiểu trực tiếp (casting `(List<Map<String, Object>>)`) thay vì dùng anonymous inner class `new TypeReference<List<Map<String, Object>>>() {}` của Jackson.

### 2.2. DbGradingAdapter
- **Nhiệm vụ:** Implement `GradingAdapter.loadPartKeys(Integer examId)`.
- **Logic:**
  - Gọi `examRepository.findById()`.
  - Duyệt qua tất cả các `ExamPart`.
  - Trích xuất mảng `questions` từ `content_data`.
  - Đọc các field `question_id`, `type`, `correct_answer`, và `alternates` (nếu có) để xây dựng đối tượng `GradingKey` cho từng câu hỏi.
  - Gom nhóm lại thành `PartGradingKey` theo từng `partId` và trả về `Map<Integer, PartGradingKey>`.
  
### 2.3. Cấu hình Injection
- Cả hai class `DbExamAdapter` và `DbGradingAdapter` sẽ được gắn annotation `@Component` và `@Primary` để Spring Boot ưu tiên inject các Bean này thay vì các Bean Fixture đang nằm ở profile dev/test.

## 3. Scope & Phụ thuộc
- **Files touched:**
  - `DbExamAdapter.java` (Tạo mới)
  - `DbGradingAdapter.java` (Tạo mới)
- **Rủi ro (Risks):** Lỗi biên dịch của Lombok trên JDK 21. Đã giải quyết bằng cách tránh dùng subclass nặc danh (anonymous subclass) khi dùng Jackson.
- **Tiêu chí nghiệm thu (Acceptance Criteria):** `mvn clean compile` và `mvn clean test` phải vượt qua thành công, không gặp lỗi. Mọi API thi và chấm điểm sẽ tự động chuyển sang đọc DB mà không cần sửa Core Business Logic.
