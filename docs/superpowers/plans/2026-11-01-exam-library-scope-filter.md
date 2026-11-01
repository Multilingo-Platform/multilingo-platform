# Bộ Lọc Hình Thức Thi (Exam Library Scope Filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bộ lọc hình thức làm bài (Tất cả, Làm Full đề, 1 Kỹ năng, 1 Phần/Passage) vào thanh công cụ trang Thư viện đề thi học viên.

**Architecture:** Mở rộng bảng điều khiển bộ lọc trong `ExamLibrary.tsx` với hàng Filter Chips mới; bổ sung helper `getExamScope()` phân loại chính xác các đề thi IELTS, TOEIC, NLTV; kết hợp lọc chặt chẽ trong pipeline `displayedExams` và tối ưu `typesToFetch` khi gọi API.

**Tech Stack:** React, TypeScript, Vitest, `@testing-library/react`, Lucide Icons, i18next.

**Spec:** `docs/superpowers/specs/2026-11-01-exam-library-scope-filter-spec.md`  
**AC & Test Matrix:** `docs/superpowers/specs/2026-11-01-exam-library-scope-filter-AC.md`

## Global Constraints
- Tuân thủ Feature-based Architecture: Mọi logic UI và filter nằm gọn trong `features/exams/`.
- Giữ nguyên màu sắc và kiểu dáng thiết kế chuẩn mực của Multilingo (Cam thương hiệu, bo góc mềm mại, micro-transitions).
- Đảm bảo tương thích ngược 100% với các bài thi đã có trong cơ sở dữ liệu.

## Review Focus
1. Phân loại chuẩn xác các đề thi NLTV legacy có `type: 'NLTV'` nhưng tiêu đề là đơn kỹ năng hoặc 1 phần.
2. Không làm hỏng sự phối hợp giữa bộ lọc Scope và bộ lọc Kỹ năng (`selectedSkill`).
3. Đảm bảo nút "Xóa bộ lọc" (`handleResetFilters`) reset đúng `selectedScope` về `'ALL'`.
4. Hiển thị Empty state thanh lịch khi không có đề nào khớp với tổ hợp lọc.
5. Kiểm thử toàn diện 100% pass cả frontend và backend.

---

### Task 1: Định nghĩa tiện ích phân loại Scope `getExamScope` và viết Unit Tests
**Files:**
- Create/Modify: `frontend/src/features/exams/pages/student/ExamLibrary.tsx` (export `getExamScope`, `ExamScope`, `SCOPE_OPTIONS`)
- Create: `frontend/src/features/exams/__tests__/ExamLibraryScopeFilter.test.tsx`

- [ ] **Step 1:** Viết test cases kiểm tra hàm `getExamScope` cho các đề IELTS, TOEIC, NLTV (Full đề, 1 Kỹ năng, 1 Phần).
- [ ] **Step 2:** Chạy test để đảm bảo test fail (Red).
- [ ] **Step 3:** Cài đặt hàm `getExamScope` trong `ExamLibrary.tsx`.
- [ ] **Step 4:** Chạy lại test để đảm bảo pass (Green).

---

### Task 2: Thêm hàng Filter Chips Hình Thức vào UI và Pipeline Lọc Client-Side
**Files:**
- Modify: `frontend/src/features/exams/pages/student/ExamLibrary.tsx`

- [ ] **Step 1:** Khai báo state `selectedScope` (mặc định `'ALL'`) và danh sách `scopeOptions` với icon `Layers`, `Target`, `Puzzle`.
- [ ] **Step 2:** Thêm hàng Filter Chips "Hình thức:" vào `exam-library-filter-panel` trong `ExamLibrary.tsx`.
- [ ] **Step 3:** Cập nhật pipeline `displayedExams` để lọc theo `selectedScope`.
- [ ] **Step 4:** Cập nhật `handleResetFilters` để reset `selectedScope` về `'ALL'`.

---

### Task 3: Tích hợp Lọc Kết Hợp và Cập Nhật Truy Vấn API
**Files:**
- Modify: `frontend/src/features/exams/pages/student/ExamLibrary.tsx`

- [ ] **Step 1:** Kiểm tra logic `fetchExams` và `typesToFetch` khi người dùng kết hợp `selectedScope` và `selectedSkill`.
- [ ] **Step 2:** Đảm bảo khi chọn `SINGLE_PART` hoặc `SINGLE_SKILL`, `typesToFetch` bao gồm cả các mã part/skill tương ứng.
- [ ] **Step 3:** Đảm bảo nút "Xóa bộ lọc" hiển thị khi `selectedScope !== 'ALL'`.

---

### Task 4: Viết Integration Tests Đầy Đủ Cho Toàn Bộ 8 Kịch Bản AC
**Files:**
- Modify: `frontend/src/features/exams/__tests__/ExamLibraryScopeFilter.test.tsx`

- [ ] **Step 1:** Viết test render hàng Filter Chips Scope (`TC_EXAM_SCOPE_01`).
- [ ] **Step 2:** Viết test lọc Full đề (`TC_EXAM_SCOPE_02`).
- [ ] **Step 3:** Viết test lọc 1 Kỹ năng (`TC_EXAM_SCOPE_03`).
- [ ] **Step 4:** Viết test lọc 1 Phần (`TC_EXAM_SCOPE_04`).
- [ ] **Step 5:** Viết test lọc kết hợp Scope + Kỹ năng (`TC_EXAM_SCOPE_05`).
- [ ] **Step 6:** Viết test Empty State & nút Xóa bộ lọc (`TC_EXAM_SCOPE_06`, `TC_EXAM_SCOPE_08`).
- [ ] **Step 7:** Viết test đề NLTV legacy (`TC_EXAM_SCOPE_07`).
- [ ] **Step 8:** Chạy test xác nhận tất cả các test cases đều PASS.

---

### Task 5: Kiểm Tra Toàn Diện Hệ Thống (Verification Before Completion)
**Files:**
- N/A (chạy verification commands)

- [ ] **Step 1:** Chạy toàn bộ test suite frontend module exams `npm run test -- --run src/features/exams/__tests__/`.
- [ ] **Step 2:** Chạy test backend `AdminExamServiceImplTest,StudentExamServiceImplTest`.
- [ ] **Step 3:** Trình bày tóm tắt diff thay đổi và xin xác nhận của người dùng trước khi commit.
