# Implementation Plan: Bổ sung Loại Câu hỏi MATCHING_SENTENCE_ENDINGS và Hoàn thiện MATCHING_FEATURES

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm loại câu hỏi `MATCHING_SENTENCE_ENDINGS` và hoàn thiện `MATCHING_FEATURES` trên toàn hệ thống (ExamBuilder Admin, Excel Import/Export hỗ trợ options A-H, Student Workspace, và Backend Grading Engine).

**Architecture:** Mở rộng enum `QuestionType` trên Frontend và `OBJECTIVE_TYPES` trên Backend; nâng cấp `detectExcelColumns` để nhận diện các cột `optF`, `optG`, `optH`; cho phép soạn thảo và kế thừa options cho câu hỏi matching trong ExamBuilder; chuẩn hóa `MatchingRenderer` để hiển thị mượt mà; hoàn thiện bộ unit test TDD cho cả Frontend và Backend.

**Tech Stack:** React, TypeScript, Vitest, Java 21, Spring Boot, JUnit 5, AssertJ.

**Spec:** [docs/superpowers/specs/2026-10-16-matching-question-types-design.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-16-matching-question-types-design.md) và [docs/superpowers/specs/2026-10-16-matching-question-types-test-design.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-16-matching-question-types-test-design.md)

## Global Constraints
- Primary key backend là `INT/Integer`, tự tăng `GenerationType.IDENTITY`.
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Frontend tuân thủ Feature-based Architecture (Feature-Sliced Design).
- Mọi thay đổi đều phải có unit test kiểm chứng theo chu trình TDD (Red -> Green -> Refactor).
- Bắt buộc chạy `mvn clean test` và chứng minh log PASS trước khi hoàn thành.
- Không tự động commit khi người dùng chưa kiểm tra và phê duyệt (`GEMINI.md`).

## Review Focus
- Input chứa options từ A đến G hoặc H không bị cắt bớt hoặc tràn giao diện.
- File Excel có hoặc không có các cột `Option F`, `Option G`, `Option H` đều được nhận diện tự động mà không lỗi (Backward compatible).
- Thí sinh nộp bài bằng ký tự chữ cái (`'A'` - `'G'`) hoặc bằng nội dung text của option đều được Backend chấm `CORRECT` (1.0).
- Chấm câu trả lời hoa/thường không phân biệt chữ hoa chữ thường (`'b'` hay `'B'` đều đúng).
- Chuyển đổi loại câu hỏi trong ExamBuilder giữa các dạng không làm mất dữ liệu bất thường.

---

### Task 1: Backend Grading Engine & Key Extractors Support for MATCHING_SENTENCE_ENDINGS

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/impl/ObjectiveGradingServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/util/SnapshotGradingKeyExtractor.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapter.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapterTest.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/util/SnapshotGradingKeyExtractorTest.java`

**Interfaces:**
- Consumes: `GradingKey`, `PartGradingKey`, `ObjectiveGradingService`
- Produces: Hỗ trợ chấm điểm và trích xuất key cho type `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES`

- [ ] **Step 1: Write the failing tests**
Thêm test case `gradeSentenceEndings_bothLetterAndTextAreCorrect()` trong `DbGradingAdapterTest.java` và `extractFromSnapshot_extractsSentenceEndingsWithSevenOptions()` trong `SnapshotGradingKeyExtractorTest.java`.

- [ ] **Step 2: Run test to verify it fails**
Run: `./mvnw test "-Dtest=DbGradingAdapterTest#gradeSentenceEndings*,SnapshotGradingKeyExtractorTest#extractFromSnapshot_extractsSentenceEndings*"`
Expected: FAIL với unsupported type hoặc compilation.

- [ ] **Step 3: Implement minimal code in Backend**
1. Trong `ObjectiveGradingServiceImpl.java`:
   - Bổ sung `"MATCHING_SENTENCE_ENDINGS"` vào `OBJECTIVE_TYPES`.
   - Trong `gradeQuestion()` switch-case:
     ```java
     case "MULTIPLE_CHOICE", "MULTIPLE_CHOICE_MULTI", "MATCHING_SENTENCE_ENDINGS", "MATCHING_FEATURES" -> gradeMultipleChoice(questionId, key, rawAnswer);
     ```
2. Trong `SnapshotGradingKeyExtractor.java` và `DbGradingAdapter.java`:
   - Đảm bảo `MATCHING_SENTENCE_ENDINGS` và `MATCHING_FEATURES` trích xuất đáp án và options tương ứng.

- [ ] **Step 4: Run test to verify it passes**
Run: `./mvnw test "-Dtest=DbGradingAdapterTest,SnapshotGradingKeyExtractorTest"`
Expected: PASS 100%.

---

### Task 2: Frontend Types & Student Workspace MatchingRenderer

**Files:**
- Modify: `frontend/src/features/exam/types/exam.types.ts`
- Modify: `frontend/src/features/exam/api/practiceFeedbackContract.ts`
- Modify: `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx`
- Modify: `frontend/src/features/exam/components/renderers/MatchingRenderer.tsx`
- Test: `frontend/src/features/exam/__tests__/QuestionRenderer.test.tsx`

**Interfaces:**
- Consumes: `Question`, `ExamOption`, `MatchingRenderer`
- Produces: `QuestionType` có thêm `'MATCHING_SENTENCE_ENDINGS'`, `MatchingRenderer` xử lý cả string array và object array từ A đến H

- [ ] **Step 1: Write the failing test**
Thêm test case trong `QuestionRenderer.test.tsx` kiểm tra render `MATCHING_SENTENCE_ENDINGS` với 7 options A-G.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- src/features/exam/__tests__/QuestionRenderer.test.tsx`
Expected: FAIL (Type error hoặc renderer không match).

- [ ] **Step 3: Implement minimal code in Frontend Types & Renderers**
1. Cập nhật `exam.types.ts`: thêm `'MATCHING_SENTENCE_ENDINGS'` vào `QuestionType`.
2. Cập nhật `practiceFeedbackContract.ts`: thêm `'MATCHING_SENTENCE_ENDINGS'`.
3. Cập nhật `QuestionRenderer.tsx`: route `MATCHING_SENTENCE_ENDINGS` vào `MatchingRenderer`.
4. Cập nhật `MatchingRenderer.tsx`:
   - Chuẩn hóa options: nếu options là mảng chuỗi `string[]`, tự động map thành `{ id: String.fromCharCode(65 + index), text: opt }`.
   - Dropdown hiển thị: `${opt.id}. ${opt.text}` (hỗ trợ A-H).

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- src/features/exam/__tests__/QuestionRenderer.test.tsx`
Expected: PASS.

---

### Task 3: ExamBuilder - Add Question Type, Expand Excel Column Mapping (optF, optG, optH) & Options Editor

**Files:**
- Modify: `frontend/src/features/exams/pages/admin/ExamBuilder.tsx`
- Test: `frontend/src/features/exams/__tests__/examBuilderUtils.test.ts`

**Interfaces:**
- Consumes: `detectExcelColumns`, `QUESTION_TYPES`, `ExcelColumnMap`
- Produces: Nhận diện cột `optF`, `optG`, `optH`; cho phép soạn thảo options A-G/H cho matching; import/export Excel đầy đủ

- [ ] **Step 1: Write the failing tests**
Thêm unit tests trong `examBuilderUtils.test.ts`:
- `detectExcelColumns detects Option F, Option G, Option H correctly`.
- `QUESTION_TYPES includes MATCHING_SENTENCE_ENDINGS`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- src/features/exams/__tests__/examBuilderUtils.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal code in ExamBuilder.tsx**
1. Mở rộng `ExcelColumnMap`: thêm `optF?: number`, `optG?: number`, `optH?: number`.
2. Trong `detectExcelColumns`: nhận diện các tiêu đề "Lựa chọn F / Option F", "Lựa chọn G / Option G", "Lựa chọn H / Option H".
3. Thêm vào `QUESTION_TYPES`:
   `{ value: 'MATCHING_SENTENCE_ENDINGS', label: 'Matching Sentence Endings (Nối đuôi câu A-G)' }`
4. Trong `updateQuestion` & `batchGenerateQuestions`:
   - Khi type là `MATCHING_SENTENCE_ENDINGS`, khởi tạo sẵn 7 options rỗng `['', '', '', '', '', '', '']`.
   - Khi type là `MATCHING_FEATURES`, khởi tạo sẵn 3-4 options rỗng.
   - Không set `options = undefined` đối với các dạng bài matching.
5. Trong giao diện câu hỏi:
   - Hiển thị danh sách các options (tới A-H) và cho phép thêm/xóa/chọn radio đáp án đúng cho các câu hỏi matching.
6. Trong `handleImportExcel`:
   - Đọc giá trị `rawOptF`, `rawOptG`, `rawOptH` và đưa vào `options` array.
   - Map `cleanCorrect` từ 'A' đến 'H' sang index tương ứng (0 - 7).
7. Trong `handleExportTemplate`:
   - Thêm cột optF, optG, optH khi export template hoặc câu hỏi matching.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- src/features/exams/__tests__/examBuilderUtils.test.ts`
Expected: PASS.

---

### Task 4: Full System Verification

**Files:**
- Test toàn bộ: Frontend tests và Backend tests

- [ ] **Step 1: Run frontend test suite**
Run: `npm test` trong `frontend/`
Expected: All tests pass.

- [ ] **Step 2: Run backend test suite**
Run: `./mvnw clean test` trong `backend/`
Expected: 800+ tests pass with 0 failures and 0 errors.

- [ ] **Step 3: Review Git Diff & Present to User**
Hiển thị tóm tắt diff thay đổi, xác nhận không có file rác, và xin phép người dùng xác nhận trước khi commit.
