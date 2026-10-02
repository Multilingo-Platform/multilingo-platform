# Kế hoạch Fix Lỗi Chọn Đáp Án và Cải Thiện UI Workspace (Study4 Style)

## Vấn đề hiện tại
1. **Lỗi State Binding ở Reading Part 1 (Single Choice):** Khi chọn đáp án câu 1 thì nhảy sang câu 2 và ngược lại. Root cause là do `SingleChoiceRenderer.tsx` sử dụng thuộc tính `name="single-choice"` bị hardcode cho tất cả các câu hỏi. Trình duyệt coi tất cả các radio buttons có cùng `name` là thuộc một nhóm duy nhất.
2. **UI Chọn Part (Đặc biệt phần Writing/Part nhiều câu):** Hiện tại Part Switcher được thiết kế dạng thanh ngang (`overflow-x-auto`), khi có quá nhiều part người dùng phải kéo ngang (scroll) rất bất tiện, không giống với trải nghiệm thực tế (Study4 style).

## Giải pháp & Kế hoạch (Action Plan)

### Task 1: Fix lỗi Binding Single Choice (Root Cause: Radio Group Name Collision)
- **File:** `frontend/src/features/exam/components/renderers/SingleChoiceRenderer.tsx`
- **Hành động:** 
  - Truyền thêm `questionId` vào component này.
  - Sửa `name="single-choice"` thành `name={`single-choice-${questionId}`}` để đảm bảo tính duy nhất cho mỗi câu hỏi.
  - *Lưu ý:* Cập nhật cả `QuestionRenderer.tsx` để truyền `question.question_id` xuống `SingleChoiceRenderer`.

### Task 2: Redesign Part Switcher (Study4 Style)
- **File:** `frontend/src/features/exam/pages/WorkspacePage.tsx`
- **Hành động:**
  - Chuyển logic render `Part Switcher Tabs` từ thanh ngang ở `main` sang **Right Sidebar (Question Palette Dock)**.
  - Ở trên cùng của Sidebar, đặt danh sách các Part dưới dạng Grid (nếu ít) hoặc danh sách dọc có bọc lưới, cho phép người dùng ấn trực tiếp để nhảy Part mà không cần scroll ngang. Giao diện này giống hệt các tab chuyển passage trên Study4.

### Task 3: Kiểm thử
- Test chức năng chọn đáp án MCQ xem có còn bị nhảy không.
- Test UI chọn Part ở các bài thi có nhiều Part (như Writing, IELTS Reading) để đảm bảo Grid wrap đẹp mắt.
