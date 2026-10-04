# Kế Hoạch Triển Khai - Nâng Cấp Trang Chi Tiết Bộ Thẻ (Deck Detail Learning Hub)

- **Mã Kế Hoạch:** PLAN-DECK-DETAIL-HUB
- **Phân Hệ:** Frontend UI & Flow Coordination (`frontend/src/pages/student/Flashcards.tsx`, `DeckDetailView.tsx`, `ConfirmDeleteCardModal.tsx`)
- **Mục Tiêu:** Nâng cấp màn hình Chi tiết của một bộ thẻ thành Trung tâm Điều hướng Học tập và Quản lý Thẻ Từ vựng (Learning Hub & Card Management):
  1. **4 Cổng Chế độ Học & Chơi:** Flashcard (SRS lật thẻ 3D), Ôn tập (Quiz trắc nghiệm 4 đáp án), Thi (Kiểm tra tính giờ), Ghép từ (Trò chơi 60 giây) kèm kiểm tra điều kiện số từ vựng tối thiểu (>= 4 từ cho Quiz & Thi, >= 6 từ cho Ghép từ).
  2. **Thanh Tiến độ Ghi nhớ:** Hiển thị tỷ lệ % Mastered, số thẻ Đang học, Mới và số thẻ cần ôn hôm nay (icon ngọn lửa 🔥).
  3. **Quản lý Thẻ Từ vựng trong bộ (Thêm - Sửa - Xóa 1 thẻ):**
     - Nút "+ Thêm từ mới" mở Modal thêm thẻ.
     - Nút Sửa thẻ (icon cây bút) mở Modal chỉnh sửa thông tin thẻ từ vựng.
     - Nút Xóa thẻ (icon thùng rác) mở Modal xác nhận xóa 1 thẻ an toàn theo chuẩn [UC012.6](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.6-xoa-the-ghi-nho-flashcard.md).
- **Tài liệu tham chiếu:**
  - Thiết kế Test: [test-design-deck-detail-view.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/test-design-deck-detail-view.md)
  - Đặc tả: [uc12.1-quan-ly-bo-the-va-the-tu-vung.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.1-quan-ly-bo-the-va-the-tu-vung.md)
  - Đặc tả Xóa thẻ: [uc12.6-xoa-the-ghi-nho-flashcard.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.6-xoa-the-ghi-nho-flashcard.md)

---

## Danh Sách Task Triển Khai Nguyên Tử (2-5 Phút / Task)

### Phase 1: Modal Xác Nhận Xóa 1 Thẻ Từ Vựng An Toàn (ConfirmDeleteCardModal & UC012.6)
- [x] **Task 1.1:** Tạo Component `ConfirmDeleteCardModal.tsx` trong `frontend/src/components/vocab/`:
  - Dùng `createPortal(..., document.body)` để gắn trực tiếp vào body, căn giữa tuyệt đối màn hình.
  - Khóa cuộn trang nền (`overflow: hidden` trên `document.body`).
  - Thiết kế EdTech cổ điển (bo góc 8px): Icon cảnh báo tam giác màu đỏ/hổ phách, tiêu đề: *"Xác nhận xóa thẻ từ vựng"*, hiển thị rõ ràng từ vựng bị xóa (ví dụ: *"Bạn có chắc chắn muốn xóa thẻ '**ubiquitous**' khỏi bộ thẻ này không?"*), cảnh báo: *"Hành động này sẽ xóa toàn bộ tiến độ học lặp lại (SRS) của từ vựng này và không thể hoàn tác."*.
  - 2 nút bấm: "Hủy bỏ" (btn-outline, phím Esc) và "Xác nhận xóa" (btn-danger).

### Phase 2: Thanh Tiến Độ Ghi Nhớ & Header Chi Tiết Bộ Thẻ
- [x] **Task 2.1:** Cập nhật Header của `DeckDetailView.tsx`:
  - Nút quay lại: "Quay lại danh sách bộ thẻ".
  - Tên bộ thẻ, cặp ngôn ngữ học & giải nghĩa (`targetLanguage ➔ sourceLanguage`), mô tả bộ thẻ.
  - Nút "+ Thêm từ mới" ở vị trí thuận tiện nhất để người dùng bổ sung từ vựng vào bộ thẻ.
- [x] **Task 2.2:** Xây dựng Thanh Tiến độ ghi nhớ đa sắc thái (Memory Progress Strip):
  - Tính toán tỷ lệ % thành thạo: `masteredPercent = round((masteredCards / totalCards) * 100)`.
  - Dải thanh tiến độ trực quan (Xanh lá = Mastered, Vàng = Learning, Xanh dương = New).
  - Khối thống kê 4 chỉ số: Mới, Đang học, Thành thạo, Cần ôn hôm nay (icon 🔥).

### Phase 3: Cụm 4 Cổng Chế Độ Học Tập (Learning Modes Strip)
- [x] **Task 3.1:** Thiết kế Khối Grid 4 thẻ Chế độ học tập trực quan trong `DeckDetailView.tsx`:
  - **1. 🗂️ Flashcard:** Ôn tập lặp lại ngắt quãng SRS lật thẻ 3D (Khả dụng khi `totalCards >= 1`).
  - **2. 🎯 Ôn tập (Học từ vựng):** Trắc nghiệm 4 đáp án chọn nghĩa (Khả dụng khi `totalCards >= 4`, nếu `< 4` hiển thị badge khóa "Cần >= 4 từ").
  - **3. 📝 Thi (Kiểm tra từ vựng):** Bài thi tính giờ và chấm điểm (Khả dụng khi `totalCards >= 4`, nếu `< 4` hiển thị badge khóa "Cần tối thiểu 4 từ").
  - **4. ⚡ Ghép từ (Ghép thẻ tốc độ):** Trò chơi phản xạ nối từ 60 giây (Khả dụng khi `totalCards >= 6`, nếu `< 6` hiển thị badge khóa "Cần tối thiểu 6 từ").
- [x] **Task 3.2:** Khai báo các callbacks tương ứng trên `DeckDetailViewProps`:
  - `onFlashcardClick: () => void` (Mở SRS Study Mode)
  - `onQuizClick?: () => void` (Mở chế độ Ôn tập Trắc nghiệm)
  - `onTestClick?: () => void` (Mở chế độ Thi Kiểm tra)
  - `onMatchGameClick?: () => void` (Mở trò chơi Ghép từ)
  - `onAddCardClick: () => void` (Thêm 1 thẻ mới)
  - `onEditCard: (card: Flashcard) => void` (Sửa 1 thẻ)
  - `onDeleteCard: (card: Flashcard) => void` (Xóa 1 thẻ)

### Phase 4: Quản Lý Danh Sách Thẻ (Thêm - Sửa - Xóa 1 Thẻ) & Tích Hợp Controller
- [x] **Task 4.1:** Bổ sung số lượng từ vựng trên các Tab lọc trạng thái trong `DeckDetailView.tsx`:
  - `Tất cả (${total})`, `Mới (${new})`, `Đang học (${learning})`, `Thành thạo (${mastered})`.
- [x] **Task 4.2:** Kết nối sự kiện trong `Flashcards.tsx`:
  - Nút Sửa 1 thẻ ➔ Mở `CardModal` nạp dữ liệu cũ của thẻ để học viên sửa từ, nghĩa, ví dụ, ảnh.
  - Nút Xóa 1 thẻ ➔ Mở `ConfirmDeleteCardModal` xác nhận xóa đúng thẻ đó theo chuẩn UC012.6.
  - Khi xác nhận xóa: Gọi `vocabApi.deleteCard(deckId, cardId)`, đóng modal, thông báo thành công và làm mới danh sách thẻ.

### Phase 5: Kiểm Tra Thẩm Mỹ & Nghiệm Thu Biên Dịch (Verification)
- [x] **Task 5.1:** Chạy `npm run build` trong thư mục `frontend/` đảm bảo 100% build PASS không có lỗi TypeScript hay layout.
- [x] **Task 5.2:** Kiểm tra thẩm mỹ: Phong cách EdTech cổ điển ấm áp, bo góc chuẩn (4px - 10px), modal căn giữa tuyệt đối trên màn hình.

