# Kế hoạch Triển khai: Bỏ khối Thống kê trên Giao diện Bộ thẻ từ vựng & Rà soát API

> **Kỷ luật Superpowers:** Kế hoạch thực hiện từng bước (Task-by-task), kiểm soát rủi ro không làm ảnh hưởng đến các màn hình liên quan.

**Mục tiêu:** Bỏ khối hiển thị 3 thẻ thống kê tổng hợp ("Tổng số từ", "Cần ôn hôm nay", "Đã thành thạo") trên màn hình danh mục bộ thẻ từ vựng (`DeckListView.tsx`), rà soát toàn bộ các API liên quan và làm sạch mã nguồn.

---

## 1. Kết quả Rà soát API (API Audit Report)

### 1.1. Khối 3 thẻ thống kê bị xóa có dùng API riêng không?
- **Kết luận:** **KHÔNG CÓ API RIÊNG**.
- **Cơ chế hiện tại:**
  - Trang cha `FlashcardsPage.tsx` gọi duy nhất 1 API: `vocabApi.getDecks()` (`GET /api/v1/vocab/decks`).
  - Phía Frontend, `DeckListView.tsx` tự gom dữ liệu từ danh sách các bộ thẻ bằng hàm tính toán:
    ```typescript
    const stats = useMemo(() => {
      return decks.reduce(
        (acc, d) => ({
          totalCards: acc.totalCards + (d.totalCards || 0),
          dueTodayCards: acc.dueTodayCards + (d.dueTodayCards || 0),
          masteredCards: acc.masteredCards + (d.masteredCards || 0),
        }),
        { totalCards: 0, dueTodayCards: 0, masteredCards: 0 }
      );
    }, [decks]);
    ```
  - Do đó, việc xóa 3 thẻ thống kê này là **thao tác làm sạch UI phía Frontend**, không có API nào bị gọi dư thừa để phục vụ riêng cho nó.

### 1.2. Có nên sửa hoặc bỏ API `GET /api/v1/vocab/decks` ở Backend không?
- **Khuyến nghị: KHÔNG NÊN BỎ HOẶC SỬA**.
- **Lý do:**
  1. `GET /api/v1/vocab/decks` là API cốt lõi để tải toàn bộ danh sách bộ thẻ (tên, ngôn ngữ, mô tả...).
  2. Mỗi thẻ bộ từ vựng con bên dưới (như thẻ "Bộ thẻ từ vựng test" trong ảnh) vẫn cần các trường:
     - `deck.totalCards` để hiển thị: `8 từ`.
     - `deck.masteredCards` và `deck.totalCards` để hiển thị thanh tiến độ: `Thành thạo 0%` (`Math.round(mastered / total * 100)`).
  3. Màn hình chi tiết bộ thẻ `DeckDetailView.tsx` hiện đang lấy trực tiếp dữ liệu từ bộ thẻ này (`selectedDeck`) để hiển thị 4 chỉ số chi tiết và badge số thẻ ôn tập.
  4. Backend đã được tối ưu chống N+1 (chỉ tốn đúng 2 query: 1 query lấy danh sách Deck và 1 query GROUP BY tính số lượng thẻ).

### 1.3. Rà soát các hàm API thừa trong `vocabApi.ts`
- **Phát hiện:** Hàm `vocabApi.getDeckDetail(deckId: number)` gọi endpoint `GET /api/v1/vocab/decks/{deckId}`:
  - Backend đã xây dựng endpoint này.
  - Nhưng trong toàn bộ Frontend, hàm này **chưa từng được gọi ở bất cứ đâu** (do `FlashcardsPage` lấy trực tiếp `deck` từ mảng `decks` có sẵn).
- **Hành động đề xuất:**
  - Nếu muốn dọn sạch code thừa: Bỏ hàm `getDeckDetail` trong `vocabApi.ts`.
  - Hoặc có thể giữ nguyên nếu muốn giữ đầy đủ bộ client SDK phục vụ tương lai.

---

## 2. Kế hoạch Thực thi Chi tiết (Implementation Process)

### Task 1: Chỉnh sửa Giao diện `DeckListView.tsx`
- **File:** `frontend/src/features/vocab/components/deck/DeckListView.tsx`
- **Nội dung thực hiện:**
  1. Xóa toàn bộ khối JSX mục `2. Ba thẻ Thống Kê Tổng Hợp` (dòng 136 - 185) bao gồm các thẻ "Tổng số từ", "Cần ôn hôm nay", "Đã thành thạo".
  2. Xóa hook tính toán `const stats = useMemo(...)` (dòng 71 - 80).
  3. Xóa các icon không còn dùng: `Flame`, `GraduationCap` khỏi câu lệnh import `lucide-react` (giữ lại `BookOpen` vì đang dùng ở `EmptyState`).
  4. Cập nhật comment JSDoc của component (bỏ mô tả về 3 chỉ số thống kê).

### Task 2: Rà soát & Tinh gọn API Client (Tùy chọn)
- **File:** `frontend/src/features/vocab/api/vocabApi.ts`
- **Nội dung thực hiện:**
  - Tinh gọn hoặc giữ lại `getDeckDetail` theo quyết định của người dùng.

### Task 3: Nghiệm thu Giao diện (Verification)
- Kiểm tra lại bố cục màn hình:
  - Banner "Bộ thẻ từ vựng" hiển thị trực tiếp liền mạch xuống thanh tìm kiếm "Tìm kiếm bộ thẻ..." và các chip lọc ngôn ngữ.
  - Danh sách lưới các bộ thẻ bên dưới hoạt động bình thường, giữ nguyên thông tin tiến độ `% thành thạo` và số lượng từ của từng bộ thẻ.
  - Không có lỗi biên dịch TypeScript hay cảnh báo console.

