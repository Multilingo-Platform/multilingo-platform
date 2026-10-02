# Kế Hoạch Khắc Phục Lỗi: Câu Writing Hiển Thị "Đã Làm" Dù Ô Nhập Trống

> **Mã lỗi:** BUG-S05-WRITING-EMPTY-ANSWER  
> **Kỹ năng áp dụng:** `/fix-bug`, `/plan`  
> **Trạng thái:** Chờ người dùng phê duyệt (CHƯA THỰC THI CODE)

---

## 1. Mô Tả Lỗi & Root Cause Analysis

### 1.1 Triệu chứng thực tế
Khi người dùng vào làm bài thi ở phần Writing (Task 1 / Task 2):
1. Gõ ký tự bất kỳ vào ô soạn thảo textarea.
2. Xóa sạch toàn bộ văn bản (ô trở về trống, bộ đếm từ hiện `0 từ`).
3. Bảng câu hỏi bên phải (Question Palette) vẫn hiển thị ô số câu màu xanh ("Đã làm"), thanh tiến độ tính câu đó (`1/9 câu`), và chú thích đếm `Đã làm (1) / Chưa làm (8)`.

### 1.2 Bằng chứng mã nguồn & Root Cause
Nguyên nhân gốc rễ là trạng thái "đã làm" đang được xác định bằng điều kiện lỏng lẻo `val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)`:

1. **[`QuestionPalette.tsx:48`](file:///D:/Project/University/multilingo-platform/frontend/src/features/exam/components/QuestionPalette.tsx#L48):**
   ```ts
   const val = answers[pId]?.[qId];
   if (val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)) {
     answeredCount++;
   }
   ```
2. **[`QuestionPalette.tsx:117`](file:///D:/Project/University/multilingo-platform/frontend/src/features/exam/components/QuestionPalette.tsx#L117):**
   ```ts
   const answered = val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0);
   ```
3. **[`WorkspacePage.tsx:141`](file:///D:/Project/University/multilingo-platform/frontend/src/features/exam/pages/WorkspacePage.tsx#L141):**
   ```ts
   if (val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)) {
     answered++;
   }
   ```
4. **[`WorkspacePage.tsx:434`](file:///D:/Project/University/multilingo-platform/frontend/src/features/exam/pages/WorkspacePage.tsx#L434):**
   ```ts
   const isAnswered = currentVal !== null && currentVal !== undefined && (!Array.isArray(currentVal) || currentVal.length > 0);
   ```

Khi người dùng xóa hết nội dung trong `EssayRenderer`, sự kiện `onChange` gửi chuỗi rỗng `""`. Redux `answerSlice` lưu `state.answers[partId][questionId] = ""`.
Chuỗi `""` thỏa mãn `val !== null` và `val !== undefined` và `!Array.isArray(val)`, do đó bị hệ thống đánh giá sai thành `answered = true`.

---

## 2. Bảng Kiểm Kê Toàn Bộ Các Nơi Sử Dụng Logic "Đã Làm" (Audit Table)

| STT | File:Dòng | Mục đích sử dụng | Cách kiểm tra hiện tại | Đánh giá rỗng | Sau khi sửa |
|---|---|---|---|---|---|
| 1 | `QuestionPalette.tsx:48` | Đếm tổng số câu đã làm để tính thanh tiến độ | `val !== null && val !== undefined && (!Array.isArray(val) \|\| val.length > 0)` | ❌ Lỗi với `""`, `"   "`, `{}` | Dùng `isAnswered(val, q.type)` |
| 2 | `QuestionPalette.tsx:117` | Xác định màu sắc/trạng thái từng ô câu hỏi trong grid | `val !== null && val !== undefined && (!Array.isArray(val) \|\| val.length > 0)` | ❌ Lỗi với `""`, `"   "`, `{}` | Dùng `isAnswered(val, q.type)` |
| 3 | `QuestionPalette.tsx:216-221` | Hiển thị số lượng ở chú thích "Đã làm" & "Chưa làm" | Dựa trên `answeredCount` ở dòng 48 | ❌ Bị sai dây chuyền | Dựa trên `answeredCount` chuẩn |
| 4 | `WorkspacePage.tsx:141` | Tính `unansweredCount` truyền vào Modal xác nhận nộp bài | `val !== null && val !== undefined && (!Array.isArray(val) \|\| val.length > 0)` | ❌ Lỗi với `""`, `"   "`, `{}` | Dùng `isAnswered(val)` |
| 5 | `WorkspacePage.tsx:434` | Đánh dấu viền card câu hỏi & màu badge số thứ tự | `currentVal !== null && currentVal !== undefined && (!Array.isArray(currentVal) \|\| currentVal.length > 0)` | ❌ Lỗi với `""`, `"   "`, `{}` | Dùng `isAnswered(currentVal, q.type)` |
| 6 | `WorkspacePage.tsx:651-652` | Truyền `answered` và `unansweredCount` vào `SubmitConfirmModal` | Dựa trên `unansweredCount` ở dòng 141 | ❌ Bị sai dây chuyền | Nhận giá trị chính xác |

---

## 3. Quyết Định Thiết Kế Đã Thống Nhất (/grill-me Alignment)

1. **Phương án xử lý State (Đã duyệt):**
   * **Phương án A:** Tạo hàm tiện ích chuẩn `isAnswered(value, type)` kiểm tra `trim().length > 0`.
   * Giữ key trong Redux state (không xóa key) để tránh xung đột optimistic lock của Autosave và tránh conflict khi client sync với server. Mọi nơi quyết định "đã làm" đều phải gọi qua hàm `isAnswered()`.
2. **Phát hiện phụ ở Mục 9 (Đã duyệt):**
   * Tập trung xử lý dứt điểm lỗi chính `isAnswered` trước; 2 vấn đề phụ (ngưỡng `minWords` động từ đề thi và nhãn header `Passage` vs `Task`) sẽ xử lý ở commit riêng theo quy ước của Bug Brief.

---

## 4. Chi Tiết Kế Hoạch Triển Khai (Proposed Changes)

### 4.1 [NEW] `frontend/src/features/exam/utils/answerUtils.ts`
Tạo hàm tiện ích chuẩn, xử lý an toàn cho mọi kiểu dữ liệu đáp án:

```ts
import type { QuestionType } from '../types/exam.types';

/**
 * Kiểm tra xem một câu hỏi đã thực sự được trả lời hay chưa.
 * - Chuỗi văn bản (ESSAY, FILL_IN, MCQ đơn...): phải có ký tự thực tế sau khi trim().
 * - Mảng (MULTIPLE_CHOICE): phải có ít nhất 1 phần tử hợp lệ.
 * - Đối tượng (MATCHING, LABELING): phải có ít nhất 1 cặp giá trị không rỗng.
 */
export function isAnswered(value: unknown, type?: QuestionType): boolean {
  if (value == null) return false;

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.some(item =>
      typeof item === 'string' ? item.trim().length > 0 : item != null
    );
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v =>
      typeof v === 'string' ? v.trim().length > 0 : v != null && v !== ''
    );
  }

  return false;
}
```

### 4.2 [MODIFY] `frontend/src/features/exam/components/QuestionPalette.tsx`
- Import `isAnswered` từ `../utils/answerUtils`.
- Thay thế dòng 48:
  ```ts
  if (isAnswered(val, q.type)) {
    answeredCount++;
  }
  ```
- Thay thế dòng 117:
  ```ts
  const answered = isAnswered(val, q.type);
  ```

### 4.3 [MODIFY] `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Import `isAnswered` từ `../utils/answerUtils`.
- Thay thế dòng 141 trong `useMemo` tính `unansweredCount`:
  ```ts
  if (isAnswered(val)) {
    answered++;
  }
  ```
- Thay thế dòng 434 khi render card câu hỏi:
  ```ts
  const isQuestionAnswered = isAnswered(currentVal, q.type);
  ```

---

## 5. Kế Hoạch Kiểm Thử (Verification Plan)

### 5.1 [NEW] `frontend/src/features/exam/__tests__/answerUtils.test.ts`
Bộ unit test tham số hóa đầy đủ các trường hợp biên theo đúng bảng mục 5.1 của Bug Brief:

| Input | Type | Kỳ vọng |
|---|---|---|
| `undefined`, `null` | mọi loại | `false` |
| `""` | `ESSAY` | `false` |
| `"   "` | `ESSAY` | `false` |
| `"\n\t  \r\n"` | `ESSAY` | `false` |
| `"Hello world"` | `ESSAY` | `true` |
| `""` | `FILL_IN_THE_BLANK` | `false` |
| `"  answer  "` | `FILL_IN_THE_BLANK` | `true` |
| `[]` | `MULTIPLE_CHOICE` | `false` |
| `["A"]` | `MULTIPLE_CHOICE` | `true` |
| `{}` | `MATCHING_FEATURES` | `false` |
| `{"1": ""}` | `MATCHING_FEATURES` | `false` |
| `{"1": "B"}` | `MATCHING_FEATURES` | `true` |
| `"A"` | `SINGLE_CHOICE` | `true` |

### 5.2 [MODIFY] `frontend/src/features/exam/__tests__/QuestionPalette.test.tsx`
Bổ sung test tái hiện lỗi (regression test):
- Khi câu hỏi có giá trị `""` hoặc `"   "`, `data-answered` phải là `'false'`.
- Khi người dùng gõ vào bài Writing (`setAnswer("My essay")`) -> Palette chuyển `data-answered="true"`.
- Khi người dùng xóa hết (`setAnswer("")`) -> Palette ngay lập tức chuyển về `data-answered="false"`, và tổng `answeredCount` giảm.

### 5.3 Automated Tests
Chạy lệnh kiểm thử toàn diện:
```bash
npm --prefix frontend test
npm --prefix frontend run build
```
Đảm bảo 100% test pass và 0 TypeScript errors.
