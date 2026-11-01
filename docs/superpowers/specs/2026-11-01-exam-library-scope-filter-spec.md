# Đặc Tả Kỹ Thuật: Bộ Lọc Hình Thức Thi (Full Đề / 1 Kỹ Năng / 1 Phần) Tại Thư Viện Đề Thi

## 1. Mục tiêu & Bối cảnh
- **Mục tiêu:** Cho phép học viên trên trang Thư viện đề thi (`/student/library`) nhanh chóng phân loại và lựa chọn làm trọn vẹn cả đề (**Full đề**), làm chuyên sâu **1 Kỹ năng** (Nghe / Đọc / Viết), hoặc luyện tập vi mô **1 Phần** (Part / Passage).
- **Trải nghiệm người dùng (UX):** Tích hợp hàng **Filter Chips** chuẩn hóa ngay trong bảng điều khiển bộ lọc của Thư viện đề thi, đồng bộ với bộ lọc Kỹ năng, Chứng chỉ mục tiêu và Trạng thái làm bài.

---

## 2. Phân loại & Ranh giới (Scope Boundaries)
- **In-Scope:**
  1. Bổ sung hàng Filter Chips **Hình thức làm bài (Scope Filter)** tại `frontend/src/features/exams/pages/student/ExamLibrary.tsx`:
     - `[Tất cả hình thức]` (`ALL`)
     - `[Làm Full đề]` (`FULL_EXAM`)
     - `[1 Kỹ năng]` (`SINGLE_SKILL`)
     - `[1 Phần (Part / Passage)]` (`SINGLE_PART`)
  2. Xây dựng tiện ích chuẩn hóa `getExamScope(type: string, title?: string, parts?: number)`:
     - Nhận diện chính xác cho cả 3 hệ chứng chỉ: **IELTS**, **TOEIC**, **NLTV**.
  3. Kết hợp mượt mà giữa **Scope Filter** với **Kỹ năng** (`selectedSkill`), **Chứng chỉ** (`currentCert`) và **Tìm kiếm**:
     - Ví dụ: Chọn `1 Kỹ năng` + `Đọc hiểu` -> Ra các đề IELTS Reading, TOEIC Reading, NLTV Đọc.
     - Ví dụ: Chọn `1 Phần` + `Đọc hiểu` -> Ra IELTS Passage 1/2/3, TOEIC Part 5/6/7, NLTV Phần 5/6.
     - Ví dụ: Chọn `Làm Full đề` -> Ra đề IELTS Academic trọn gói, TOEIC L&R trọn gói, Full NLTV 9 phần.
  4. Nút `Xóa bộ lọc` reset `selectedScope` về `'ALL'`.
- **Out-of-Scope:**
  - Không thay đổi luồng giao diện làm bài bên trong phòng thi (`/attempts/:attemptId`).

---

## 3. Kiến trúc Phân loại Đề thi (Exam Scope Classification)

| Phân loại Scope | IELTS Types / Patterns | TOEIC Types / Patterns | NLTV Types / Patterns |
| :--- | :--- | :--- | :--- |
| **`FULL_EXAM`** | `IELTS_ACADEMIC`, `IELTS_GENERAL`, `IELTS` (đủ các kỹ năng) | `TOEIC_LR`, `TOEIC`, `TOEIC_LISTENING_READING` | `NLTV`, `NLTV_B1_C1`, `NLTV_A1_A2` (khi `parts === 9` hoặc không có từ khóa đơn lẻ) |
| **`SINGLE_SKILL`** | `IELTS_LISTENING`, `IELTS_READING`, `IELTS_WRITING` | `TOEIC_LISTENING`, `TOEIC_READING`, `TOEIC_WRITING`, `TW`, `TOEIC_W` | `NLTV_READING`, `NLTV_LISTENING`, `NLTV_WRITING`, `NLTV_R`, `NLTV_L`, `NLTV_W` (hoặc title chứa "kỹ năng đọc/nghe/viết") |
| **`SINGLE_PART`** | `IELTS_L1`..`L4`, `IELTS_R1`..`R3`, `IELTS_W1`..`W2` | `TOEIC_P1`..`P7`, `TW_P1`..`P3`, `TOEIC_W1`..`W3` | `NLTV_L1`..`L4`, `NLTV_R1`..`R2`, `NLTV_W1`..`W3` (hoặc title chứa "Phần 1..9", "Part") |

---

## 4. Thiết kế Giao diện (UI Specification)

### Vị trí hiển thị:
Đặt trong `.exam-library-filter-panel`, thêm 1 hàng lọc ngay trên hàng Trạng thái làm bài:

```html
<div class="exam-library-filter-row" style="border-top: 1px solid #f1f5f9; padding-top: 0.85rem;">
  <span class="exam-library-filter-label">Hình thức:</span>
  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
    <!-- Chips: Tất cả, Làm Full đề, 1 Kỹ năng, 1 Phần -->
  </div>
</div>
```

### Style & Trạng thái:
- **Default:** Bo tròn `rounded-lg`, nền trắng `#ffffff`, viền `#e2e8f0`, chữ `#475569`.
- **Active:** Nền cam nhạt `#fff7ed`, viền cam thương hiệu `#ea580c`, chữ đậm `#ea580c`, box-shadow `0 1px 3px rgba(234,88,12,0.15)`.
- **Hover:** Chuyển màu viền mượt mà `border-color 0.2s`.
