# Kế Hoạch & Thiết Kế Kiểm Thử - Màn Hình Chi Tiết Bộ Thẻ (Deck Detail Learning Hub)

- **Mã Tài Liệu:** TD-DECK-DETAIL-HUB
- **Phân Hệ:** Frontend & Backend Integration Vocab Management (`Flashcards.tsx`, `DeckDetailView.tsx`)
- **Tác Nhân (Actor):** Học viên (`ROLE_USER`)
- **Tài liệu tham chiếu:**
  - [uc12.1-quan-ly-bo-the-va-the-tu-vung.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.1-quan-ly-bo-the-va-the-tu-vung.md)
  - [uc12.2-on-tap-flashcard.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.2-on-tap-flashcard.md)
  - [uc12.3-hoc-tu-vung.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.3-hoc-tu-vung.md)
  - [uc12.4-kiem-tra-tu-vung.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.4-kiem-tra-tu-vung.md)
  - [uc12.5-tro-choi-ghep-the-toc-do.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.5-tro-choi-ghep-the-toc-do.md)
  - [uc12.6-xoa-the-ghi-nho-flashcard.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/uc12-flashcard-deck/uc12.6-xoa-the-ghi-nho-flashcard.md)

---

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Mục tiêu
Chuẩn hóa màn hình **Chi tiết của một bộ thẻ** khi người dùng nhấp chọn vào bộ thẻ đó:
1. **Header Thông tin & Tiến độ:** Hiển thị tên bộ thẻ, cặp ngôn ngữ, mô tả, tổng số từ vựng và thanh tiến độ ghi nhớ (Tỷ lệ Thành thạo, Đang học, Mới, thẻ cần ôn).
2. **Cụm 4 Chế độ Học & Chơi:**
   - 🗂️ **Flashcard:** Ôn tập lặp lại ngắt quãng SRS lật thẻ 3D (UC012.2).
   - 🎯 **Ôn tập (Học từ vựng):** Trắc nghiệm 4 đáp án chọn nghĩa (UC012.3, yêu cầu bộ thẻ >= 4 từ).
   - 📝 **Thi (Kiểm tra từ vựng):** Thi thử có tính giờ, chấm điểm và xem lại bài làm (UC012.4, yêu cầu bộ thẻ >= 4 từ).
   - ⚡ **Ghép từ (Ghép thẻ tốc độ):** Trò chơi phản xạ nối từ - nghĩa trong 60 giây (UC012.5, yêu cầu bộ thẻ >= 6 từ).
3. **Quản lý Thẻ từ vựng bên trong bộ (Thêm - Sửa - Xóa 1 thẻ):**
   - Nút **"+ Thêm từ mới"** mở Modal thêm từ vựng.
   - Thanh tìm kiếm & lọc trạng thái (`Tất cả`, `Mới`, `Đang học`, `Thành thạo`) kèm số đếm.
   - Thao tác trên từng thẻ: Nút loa phát âm chuẩn, nút **Sửa thẻ** (mở CardModal sửa thông tin thẻ), nút **Xóa thẻ** (mở Modal xác nhận xóa an toàn theo UC012.6).

### 1.2. Ranh giới triển khai
- **In-Scope:**
  - Nâng cấp toàn diện `DeckDetailView.tsx`.
  - Xây dựng `ConfirmDeleteCardModal.tsx` chuyên biệt cho thao tác xóa 1 thẻ từ vựng (UC012.6), hiển thị rõ từ vựng bị xóa và cảnh báo không thể hoàn tác, dùng `createPortal(..., document.body)` căn giữa tuyệt đối.
  - Tích hợp 4 nút kích hoạt 4 chế độ học với kiểm tra điều kiện số từ vựng tối thiểu.
  - Tích hợp các thao tác Thêm thẻ, Sửa thẻ, Xóa thẻ mượt mà.
- **Out-of-Scope:**
  - Thao tác sửa/xóa cả bộ thẻ (đã nằm ở màn hình danh sách bộ thẻ ngoài).
  - Logic engine bài thi Quiz/Test/Game bên trong (thực hiện ở các use case tương ứng).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

### 2.1. Behavioral AC (Gherkin)

```gherkin
Feature: Màn hình Chi tiết Bộ thẻ Từ vựng (Deck Detail Hub)

  Scenario: Hiển thị đầy đủ thông tin bộ thẻ và 4 chế độ học tập
    Given Người dùng mở xem chi tiết bộ thẻ "IELTS Core" có 10 từ vựng
    Then Màn hình hiển thị tên bộ thẻ, cặp ngôn ngữ và thanh tiến độ học tập
    And Hiển thị 4 nút chế độ: "Flashcard", "Ôn tập (Quiz)", "Thi (Kiểm tra)", "Ghép từ (Game)"
    And Cả 4 nút đều ở trạng thái sẵn sàng (active)

  Scenario: Kiểm tra điều kiện số từ vựng tối thiểu cho các chế độ học
    Given Người dùng xem bộ thẻ chỉ có 3 từ vựng
    Then Nút "Flashcard" vẫn khả dụng
    And Nút "Ôn tập (Quiz)" và "Thi (Kiểm tra)" hiển thị trạng thái chưa đủ điều kiện kèm nhãn "Cần >= 4 từ"
    And Nút "Ghép từ" hiển thị trạng thái chưa đủ điều kiện kèm nhãn "Cần >= 6 từ"

  Scenario: Thêm từ vựng mới vào bộ thẻ
    Given Người dùng đang ở màn hình chi tiết bộ thẻ
    When Người dùng nhấn "+ Thêm từ mới"
    Then Modal thêm thẻ mở ra ở chính giữa màn hình với các trường nhập từ, nghĩa, ví dụ

  Scenario: Sửa 1 thẻ từ vựng trong bộ thẻ
    Given Người dùng bấm nút sửa (icon bút) tại từ "ubiquitous"
    Then Modal sửa thẻ mở ra nạp sẵn từ, nghĩa, phát âm, ví dụ của từ "ubiquitous"
    When Người dùng chỉnh sửa nghĩa và bấm "Lưu thay đổi"
    Then Thẻ được cập nhật và danh sách hiển thị dữ liệu mới

  Scenario: Xóa 1 thẻ từ vựng an toàn theo UC012.6
    Given Người dùng bấm nút xóa (icon thùng rác) tại từ "ephemeral"
    Then Modal xác nhận xóa hiển thị chính giữa màn hình
    And Modal nêu rõ: "Bạn có chắc chắn muốn xóa thẻ từ vựng 'ephemeral' khỏi bộ thẻ này không?"
    When Người dùng bấm "Xác nhận xóa"
    Then Thẻ "ephemeral" bị xóa khỏi bộ thẻ và tổng số thẻ giảm đi 1
```

### 2.2. Checklist Quy tắc nghiệp vụ
- [x] **Ràng buộc tối thiểu chế độ Quiz & Thi:** Bộ thẻ phải có ít nhất 4 từ vựng (`totalCards >= 4`) thì mới kích hoạt được chế độ Ôn tập Quiz hoặc Thi kiểm tra.
- [x] **Ràng buộc tối thiểu chế độ Ghép từ:** Bộ thẻ phải có ít nhất 6 từ vựng (`totalCards >= 6`) thì mới kích hoạt được trò chơi ghép từ 60 giây.
- [x] **Modal xóa thẻ độc lập (UC012.6):** Hiển thị rõ ràng tên từ vựng bị xóa, cảnh báo mất dữ liệu tiến độ SRS của từ này.
- [x] **Modal Portaled:** Sử dụng `createPortal(..., document.body)` đảm bảo modal luôn căn giữa viewport, khóa cuộn trang nền.
- [x] **Phát âm bản xứ:** Nút loa gọi trực tiếp Web Speech Synthesis API với đúng `targetLanguage` của bộ thẻ.

---

## 3. Ma Trận Kiểm Thử 6 Khía Cạnh (6-Aspect Test Matrix)

| Khía cạnh | Kịch bản kiểm thử trọng tâm |
| :--- | :--- |
| **1. Happy Path** | Mở chi tiết bộ thẻ ➔ Xem 4 chế độ ➔ Bấm Flashcard vào học SRS ➔ Thêm/Sửa/Xóa 1 thẻ thành công. |
| **2. Negative** | - Bộ thẻ có 0 từ: 4 chế độ bị disabled, nhắc nhở thêm từ vựng.<br>- Xóa thẻ nhưng bấm "Hủy bỏ": Thẻ giữ nguyên không bị xóa. |
| **3. Boundary** | - Deck có 3 từ: Flashcard active; Quiz, Thi, Ghép từ disabled.<br>- Deck có 4 từ: Flashcard, Quiz, Thi active; Ghép từ disabled.<br>- Deck có 6 từ: Toàn bộ 4 chế độ đều active. |
| **4. Edge Cases** | - Từ vựng có nghĩa hoặc câu ví dụ rất dài: Bố cục co giãn không bị vỡ layout.<br>- Xóa thẻ cuối cùng trong bộ: Tự động chuyển về trạng thái rỗng (Empty State) thân thiện. |
| **5. Security** | Thao tác Thêm/Sửa/Xóa 1 thẻ gửi đúng `deckId`, `cardId` và header `X-User-Id`, kiểm soát IDOR. |
| **6. UI/UX** | Giao diện chuẩn EdTech cổ điển ấm áp (Warm Classic), bo góc nhẹ (4px - 10px), hover mượt mà. |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (`TC_DECK_DETAIL_xx`)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_DECK_DETAIL_01** | Happy Path | Hiển thị thông tin bộ thẻ và thanh tiến độ ghi nhớ | Deck #1 có 10 thẻ (3 Mastered, 5 Learning, 2 New) | 1. Nhấp vào Deck #1 | `deckId = 1` | - Hiển thị tên, cặp ngôn ngữ<br>- Thanh tiến độ hiển thị 30% Mastered<br>- Hiển thị đủ 4 nút chế độ học |
| **TC_DECK_DETAIL_02** | Happy Path | Bấm nút Flashcard để bắt đầu ôn tập SRS | Deck #1 có ít nhất 1 thẻ | 1. Nhấn nút "Flashcard" | Chế độ SRS | - Chuyển sang màn hình `SrsStudyView`<br>- Nạp danh sách thẻ học |
| **TC_DECK_DETAIL_03** | Boundary | Khóa chế độ Quiz, Thi, Ghép từ khi deck < 4 từ | Deck #2 có 3 từ vựng | 1. Mở Deck #2 | `cards.length = 3` | - Nút Flashcard khả dụng<br>- Nút Quiz & Thi hiển thị badge "Cần >= 4 từ"<br>- Nút Ghép từ hiển thị badge "Cần >= 6 từ" |
| **TC_DECK_DETAIL_04** | Boundary | Mở khóa Quiz & Thi khi deck đạt 4 từ vựng | Deck #3 có đúng 4 từ vựng | 1. Mở Deck #3 | `cards.length = 4` | - Nút Quiz và Thi chuyển sang trạng thái active |
| **TC_DECK_DETAIL_05** | Boundary | Mở khóa toàn bộ khi deck đạt 6 từ vựng | Deck #4 có đúng 6 từ vựng | 1. Mở Deck #4 | `cards.length = 6` | - Cả 4 nút: Flashcard, Ôn tập, Thi, Ghép từ đều active |
| **TC_DECK_DETAIL_06** | Happy Path | Mở Modal thêm thẻ từ vựng mới | Đang xem chi tiết bộ thẻ | 1. Nhấn nút "+ Thêm từ mới" | Nút Add Card | - Modal thêm từ mở ra ở giữa màn hình |
| **TC_DECK_DETAIL_07** | Happy Path | Sửa 1 thẻ từ vựng trong bộ thẻ | Thẻ #101 "ubiquitous" tồn tại | 1. Nhấn icon cây bút tại thẻ #101 | Thẻ ID #101 | - Modal sửa thẻ mở ra có sẵn dữ liệu cũ<br>- Sửa và lưu thành công |
| **TC_DECK_DETAIL_08** | Happy Path | Xóa 1 thẻ từ vựng có Modal xác nhận (UC012.6) | Thẻ #102 "ephemeral" tồn tại | 1. Bấm icon thùng rác tại thẻ #102<br>2. Bấm "Xác nhận xóa" | Thẻ ID #102 | - Modal xác nhận xóa hiện ra ở giữa ghi rõ từ 'ephemeral'<br>- Sau khi bấm xóa: Thẻ biến mất khỏi bảng, tổng số thẻ giảm 1 |
| **TC_DECK_DETAIL_09** | Negative | Hủy bỏ thao tác xóa 1 thẻ từ vựng | Thẻ đang hiển thị | 1. Bấm icon thùng rác<br>2. Bấm "Hủy bỏ" | Nút Cancel | - Modal đóng lại, thẻ vẫn còn nguyên trong bộ |
| **TC_DECK_DETAIL_10** | UI/UX | Lọc thẻ theo trạng thái (Tất cả/Mới/Đang học/Thành thạo) | Bộ thẻ có các thẻ khác trạng thái | 1. Chọn tab "Đang học" | Status `LEARNING` | - Bảng chỉ hiển thị danh sách thẻ đang học |
| **TC_DECK_DETAIL_11** | UI/UX | Phát âm từ vựng bản xứ bằng nút loa | Trình duyệt có Web Speech | 1. Nhấn icon loa cạnh từ vựng | Web Speech TTS | - Phát âm chuẩn xác theo targetLanguage |
