# Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử: Bộ Lọc Hình Thức Thi (Exam Library Scope Filter)

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)
- **Tác nhân (Actor):** Học viên (Student) đã đăng nhập hoặc chưa đăng nhập truy cập Thư viện đề thi (`/student/library`).
- **Phạm vi (In-Scope):**
  - Hiển thị 4 Chips hình thức: `Tất cả hình thức`, `Làm Full đề`, `1 Kỹ năng`, `1 Phần`.
  - Phân loại chính xác các đề IELTS, TOEIC, NLTV vào 3 nhóm scope (`FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART`).
  - Lọc kết hợp với các bộ lọc Kỹ năng, Chứng chỉ, Trạng thái làm bài, Từ khóa tìm kiếm.
  - Reset bộ lọc khi bấm "Xóa bộ lọc".
- **Ngoài phạm vi (Out-of-Scope):**
  - Giao diện phòng thi làm bài `/attempts/:attemptId`.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - Gherkin & Checklist)

### AC 1: Hiển thị bộ lọc hình thức thi
```gherkin
Kịch bản: Hiển thị hàng Filter Chips Hình thức làm bài trên thanh công cụ
Given Học viên đang ở trang Thư viện đề thi (/student/library)
When Trang tải hoàn tất
Then Hệ thống hiển thị hàng bộ lọc "Hình thức:" với 4 lựa chọn: "Tất cả hình thức", "Làm Full đề", "1 Kỹ năng", "1 Phần"
And Mặc định chip "Tất cả hình thức" ở trạng thái kích hoạt (active)
```

### AC 2: Lọc các đề thi Full đề (FULL_EXAM)
```gherkin
Kịch bản: Học viên lọc theo "Làm Full đề"
Given Danh sách đề thi đang hiển thị nhiều dạng đề khác nhau
When Học viên click vào chip "Làm Full đề"
Then Danh sách chỉ hiển thị các đề thi trọn gói (IELTS Academic, Full TOEIC L&R, Full NLTV)
And Các đề thi đơn kỹ năng hoặc đề 1 phần bị ẩn khỏi danh sách
And Số lượng kết quả hiển thị được cập nhật tương ứng
```

### AC 3: Lọc các đề thi 1 Kỹ năng (SINGLE_SKILL)
```gherkin
Kịch bản: Học viên lọc theo "1 Kỹ năng"
Given Danh sách đề thi đang hiển thị
When Học viên click vào chip "1 Kỹ năng"
Then Danh sách chỉ hiển thị các đề thi tập trung 1 kỹ năng (như IELTS Reading, TOEIC Writing, NLTV Đọc, NLTV Nghe...)
And Không hiển thị các đề Full hoặc đề 1 Part
```

### AC 4: Lọc các đề thi 1 Phần (SINGLE_PART)
```gherkin
Kịch bản: Học viên lọc theo "1 Phần"
Given Danh sách đề thi đang hiển thị
When Học viên click vào chip "1 Phần"
Then Danh sách chỉ hiển thị các đề thi chia nhỏ riêng từng Part/Passage (như IELTS Reading Passage 1/2/3, TOEIC Part 1..7, NLTV Phần 1..9)
```

### AC 5: Lọc kết hợp (Scope + Kỹ năng)
```gherkin
Kịch bản: Học viên kết hợp lọc "1 Phần" và kỹ năng "Đọc hiểu"
Given Học viên đang chọn chip "1 Phần"
When Học viên chọn thêm chip kỹ năng "Đọc hiểu"
Then Danh sách chỉ hiển thị các đề thi là 1 phần thuộc kỹ năng Đọc (như IELTS Passage 1/2/3, TOEIC Part 5/6/7, NLTV Phần 5/6)
```

### AC 6: Reset bộ lọc
```gherkin
Kịch bản: Học viên xóa bộ lọc khi đang lọc theo hình thức
Given Học viên đang chọn chip "1 Kỹ năng" hoặc "1 Phần"
When Học viên click nút "Xóa bộ lọc"
Then Chip hình thức được đặt lại về "Tất cả hình thức"
And Danh sách đề thi quay về trạng thái mặc định ban đầu
```

---

## 3. Ma Trận Kịch Bản Kiểm Thử (6 Khía Cạnh Kiểm Thử)

| Khía cạnh | Kịch bản kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- |
| **1. Happy Path** | Click lần lượt các chip: Full đề, 1 Kỹ năng, 1 Phần, Tất cả | Danh sách cập nhật tức thì, hiển thị đúng các đề thuộc từng nhóm |
| **2. Negative** | Chọn kết hợp bộ lọc không có đề nào thỏa mãn (VD: NLTV + 1 Phần + Kỹ năng không khớp) | Hiển thị Empty state: "Không tìm thấy đề thi nào phù hợp" kèm nút "Xem tất cả đề thi" |
| **3. Boundary** | Đề thi có `parts === 1` và title chứa "Passage 1" | Phân loại chuẩn xác vào `SINGLE_PART` chứ không bị nhầm vào `SINGLE_SKILL` |
| **4. Edge Cases** | Đề thi NLTV cũ lưu `type: 'NLTV'` nhưng tiêu đề là "Kỹ năng Đọc" (2 phần, 40 câu) | Phân loại chính xác vào `SINGLE_SKILL`, không bị lọt vào `FULL_EXAM` |
| **5. Security / Safety** | Kiểm tra tham số bộ lọc an toàn, không gây crash hoặc injection | Hoạt động an toàn, client-side type-safe |
| **6. UI/UX** | Hiệu ứng chuyển động chip, độ tương phản màu cam thương hiệu, responsive trên mobile | Chip bo góc mượt mà, icon hiển thị sắc nét, co giãn linh hoạt trên màn hình hẹp |

---

## 4. Bảng Test Cases Chuẩn Hóa (7 Cột)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_EXAM_SCOPE_01** | Happy Path | Hiển thị mặc định bộ lọc Scope | Truy cập `/student/library` | 1. Tải trang Thư viện | N/A | - Hàng "Hình thức:" hiển thị 4 chips<br>- Chip "Tất cả hình thức" active |
| **TC_EXAM_SCOPE_02** | Happy Path | Lọc Full đề | Trang đã tải danh sách đề | 1. Click chip "Làm Full đề" | `scope = FULL_EXAM` | - Chỉ hiển thị các đề Full (IELTS Academic, TOEIC LR, Full NLTV)<br>- Không có đề đơn lẻ |
| **TC_EXAM_SCOPE_03** | Happy Path | Lọc 1 Kỹ năng | Đang ở tab IELTS hoặc TOEIC | 1. Click chip "1 Kỹ năng" | `scope = SINGLE_SKILL` | - Chỉ hiển thị đề chuyên biệt 1 kỹ năng (IELTS Listening, TOEIC Writing, NLTV Đọc...) |
| **TC_EXAM_SCOPE_04** | Happy Path | Lọc 1 Phần | Đang ở tab IELTS | 1. Click chip "1 Phần" | `scope = SINGLE_PART` | - Chỉ hiển thị đề dạng Part/Passage (IELTS R1, R2, R3, TOEIC P1..P7) |
| **TC_EXAM_SCOPE_05** | Happy Path | Lọc kết hợp Scope + Skill | Đang ở thư viện | 1. Click chip "1 Phần"<br>2. Click chip "Đọc hiểu" | `scope = SINGLE_PART`, `skill = READING` | - Chỉ hiển thị các phần đọc (IELTS Passage 1/2/3, TOEIC Part 5/6/7) |
| **TC_EXAM_SCOPE_06** | Negative | Lọc ra 0 kết quả | Đang ở thư viện | 1. Chọn tổ hợp bộ lọc không có dữ liệu | `scope = SINGLE_PART`, `keyword = xyzabc` | - Hiển thị Empty state giao diện đẹp<br>- Nút Reset hoạt động tốt |
| **TC_EXAM_SCOPE_07** | Boundary / Edge Case | Đề NLTV legacy có `type='NLTV'` nhưng là Đọc 2 phần | CSDL có đề NLTV-02E230 | 1. Click chip "1 Kỹ năng"<br>2. Chọn tab NLTV | Đề NLTV-02E230 | - Đề hiển thị đúng trong "1 Kỹ năng"<br>- Không hiển thị trong "Làm Full đề" |
| **TC_EXAM_SCOPE_08** | UI/UX | Reset bộ lọc Scope | Đang chọn "1 Kỹ năng" | 1. Click nút "Xóa bộ lọc" | N/A | - Chip quay lại "Tất cả hình thức"<br>- Danh sách trả về đầy đủ |
