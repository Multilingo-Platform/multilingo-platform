# Sprint 07 – Exam Review Mode (UC11): Design Spec

**Ngày:** 2026-10-05
**Sprint:** 07 – Chế độ Ôn tập & Phân tích (`UC11`)
**Phân hệ:** TV3 (Testing Workspace)
**Nhánh Git:** `feature/UC11-exam-review`
**Style Guide:** Minimalism & Swiss Style (UI-UX Pro Max)

---

## 1. Mục tiêu & Scope

Mục tiêu của UC11 là cung cấp một giao diện "Review Mode" giúp học viên xem lại bài thi đã nộp, đối chiếu đáp án đúng/sai và đọc giải thích chi tiết (Explanation) từ AI. 

### In-Scope:
- Routing: `/attempts/:attemptId/review`
- Giao diện (UI/UX): Tái sử dụng lại bố cục của `WorkspacePage` (gồm thanh điều hướng Part, Bảng câu hỏi Question Palette bên phải) nhưng ở chế độ **Read-only**.
- Tích hợp API: Gọi `GET /api/v1/testing/attempts/{id}/review/{partId}` đã làm ở Sprint 06.
- Hiển thị UI màu sắc nhận diện (Semantic Colors): Xanh lá (Đúng), Đỏ (Sai), Vàng/Xám (Bỏ trống).
- Hiển thị hộp thoại "Giải thích chi tiết" (Explanation) ngay dưới mỗi câu hỏi.

---

## 2. Trải nghiệm người dùng (UI/UX Design)

Dựa theo tư vấn của bộ kỹ năng `ui-ux-pro-max`, tôi chọn **Option A (Tái sử dụng Workspace Layout)** vì nó giữ nguyên Mental Model (Mô hình tâm lý) của người dùng lúc thi, kết hợp với các tinh chỉnh sau:

* **Màu sắc & Typography (Outfit / Work Sans):**
  - **Đúng (Correct):** `#16A34A` (Green) – Dùng cho viền ô đáp án và nền ô trên bảng câu hỏi.
  - **Sai (Incorrect):** `#DC2626` (Red) – Dùng cho đáp án user chọn sai.
  - **Giải thích (Explanation Box):** Nền `#FFFBEB` (Vàng nhạt), viền `#F59E0B` (Amber) để tạo sự chú ý mà không gây gắt mắt.

* **Bảng điều hướng câu hỏi (Question Palette):**
  - Thay vì chỉ hiện "Đã làm / Chưa làm", Palette sẽ đổi màu: Câu đúng (Xanh), Câu sai (Đỏ), Câu bỏ trống (Xám/Gạch chéo).

* **Vùng nội dung câu hỏi (Main Workspace):**
  - Radio/Checkbox bị `disabled` (không cho click).
  - Đáp án user chọn sẽ có icon `(x)` nếu sai, và icon `(v)` ở đáp án đúng thực sự.
  - Một box "💡 Giải thích chi tiết" tự động mở rộng bên dưới các câu hỏi đã trả lời sai hoặc người dùng bấm vào xem.

---

## 3. Kiến trúc Component (Frontend)

```text
frontend/src/features/exam/
├── pages/
│   └── ExamReviewPage.tsx        # Container chính cho Route /attempts/:id/review
├── components/
│   ├── review/
│   │   ├── ReviewWorkspaceShell.tsx  # Layout tương tự WorkspaceShell nhưng không có nút Submit
│   │   ├── ReviewPalette.tsx         # Bảng câu hỏi có màu Đúng/Sai
│   │   └── ExplanationBox.tsx        # Box hiển thị giải thích (Render HTML bằng DOMPurify)
│   └── ...
└── hooks/
    └── useExamReview.ts          # Custom hook fetch dữ liệu API
```

### 3.1 Custom Hook: `useExamReview`
Quản lý state gọi API theo từng `partId`.
```typescript
export function useExamReview(attemptId: number, partId: number | null) {
  // Trạng thái: loading, error, data
  // Gọi API: attemptApi.getAttemptReview(attemptId, partId)
}
```

### 3.2 State Management
Vì là chế độ Read-only, chúng ta không cần lưu Redux state cho đáp án. Mọi dữ liệu (đề bài, câu trả lời của user, cờ đúng/sai) đều được server trả về qua API. Component chỉ việc render dựa trên `data` từ API.

---

## 4. Kế hoạch triển khai (Implementation Steps)

Sẽ được chia nhỏ ở bước Plan, bao gồm:
1. Tạo Custom Hook `useExamReview`.
2. Xây dựng các UI Components tĩnh (Palette màu sắc, Explanation Box).
3. Xây dựng trang `ExamReviewPage` ghép nối các components và routing.
4. Xử lý logic đổi Part và render nội dung câu hỏi an toàn (DOMPurify).

---

## 5. Tiêu chí nghiệm thu (Acceptance Criteria)
- [ ] Truy cập `/attempts/:id/review` load thành công dữ liệu review của Part đầu tiên.
- [ ] Bảng câu hỏi bên phải hiện đúng màu (Xanh = đúng, Đỏ = sai).
- [ ] Click vào Part khác sẽ gọi lại API để load Part mới mượt mà.
- [ ] Các Box giải thích hiển thị HTML chính xác, không bị lỗi vỡ layout hoặc XSS.
- [ ] Không thể thay đổi đáp án trên giao diện (Read-only).
