# Hồ Sơ Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử - UC012.6: Trò Chơi Ghép Thẻ Tốc Độ

- **Mã Use Case:** UC012.6
- **Tên Use Case:** Trò chơi Ghép thẻ tốc độ (Vocabulary Speed Match Game)
- **Phân hệ:** Vocab & Flashcards (`features/vocab/modes/match/`)
- **Tác nhân:** Học viên / Người dùng đã đăng nhập (`ROLE_USER`)
- **Tài liệu tham chiếu:** [Đặc tả kỹ thuật UC012.6](uc12.6-tro-choi-ghep-the-toc-do.md)

---

## 1. Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1.1. Tác nhân (Actor Persona)
- **Học viên (`ROLE_USER`):** Đã đăng nhập vào hệ thống, mở xem chi tiết một bộ thẻ và chọn chế độ "Ghép thẻ" để rèn luyện phản xạ nối từ nhanh trong 60 giây.

### 1.2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - Kiểm tra điều kiện mở bàn chơi: Yêu cầu bộ thẻ có tối thiểu 6 từ (`cards.length >= 6`). Nếu $< 6$, hiển thị Empty State hướng dẫn thêm từ.
  - Sinh bàn cờ 12 ô ngẫu nhiên từ 6 từ vựng được bốc ngẫu nhiên (6 ô `WORD` và 6 ô `MEANING`).
  - Đồng hồ đếm ngược 60 giây (`useVocabTimer`), tích hợp âm thanh Web Audio API (`useSoundEffects`).
  - Logic ghép cặp tức thì (0ms latency):
    - Đúng: Đổi màu xanh lá cây, phát âm thanh vui, ẩn ô, tăng điểm thưởng theo combo.
    - Sai: Đổi viền đỏ, phát âm thanh cảnh báo, rung lắc (shake), **phạt trừ 5 giây** trên timer, reset combo.
  - Xử lý dừng ván: Hoàn thành sạch 12 ô (thắng) HOẶC hết 60 giây (thua/hết giờ).
  - Quản lý Kỷ lục cá nhân (Personal Best): Lưu và đọc từ `localStorage` (`multilingo_match_best_deck_${deckId}`).
  - Xóa bỏ toàn bộ các file frontend cũ không còn dùng trong `src/components/vocab/` và `src/pages/student/Flashcards.tsx`.
- **Out-of-Scope:**
  - Lưu trữ đề bài hoặc kết quả lên cơ sở dữ liệu PostgreSQL (áp dụng triết lý Zero DB Bloat).
  - Bảng xếp hạng toàn cầu đua top giữa nhiều học viên (chỉ duy trì bảng kỷ lục cá nhân).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - Gherkin & Checklist)

### 2.1. Định dạng Gherkin

```gherkin
Feature: Trò chơi Ghép thẻ tốc độ 60 giây (UC012.6)

  Scenario: Chặn bàn chơi khi bộ thẻ dưới 6 từ vựng
    Given Học viên mở bộ thẻ có 5 từ vựng
    When Học viên bấm nút "Ghép thẻ"
    Then Giao diện hiển thị EmptyState thông báo cần tối thiểu 6 từ
    And Bàn cờ 12 ô không được tạo ra

  Scenario: Khởi tạo bàn chơi thành công khi bộ thẻ có từ 6 từ trở lên
    Given Học viên mở bộ thẻ có 10 từ vựng
    When Học viên bấm nút "Ghép thẻ"
    Then Hệ thống chọn ngẫu nhiên 6 từ và sinh đúng 12 ô thẻ xáo trộn (6 từ, 6 nghĩa)
    And Đồng hồ bắt đầu đếm ngược từ 60 giây
    And Điểm số ban đầu hiển thị 0 điểm và combo ban đầu là x1

  Scenario: Ghép đúng 1 cặp từ vựng và định nghĩa
    Given Bàn chơi đang mở có ô từ "diligent" và ô nghĩa "chăm chỉ, cần cù"
    When Học viên nhấp chọn ô "diligent" và sau đó nhấp chọn ô "chăm chỉ, cần cù"
    Then Cả 2 ô đổi sang màu xanh lá cây và biến mất khỏi bàn cờ
    And Điểm số tăng thêm 100 điểm (x1 combo)
    And Combo hiển thị tăng lên x2

  Scenario: Ghép sai cặp thẻ và bị phạt trừ 5 giây
    Given Đồng hồ đếm ngược đang ở mức 48 giây
    And Combo đang ở mức x3
    When Học viên nhấp chọn ô "diligent" và ô nghĩa "lười biếng"
    Then Cả 2 ô chuyển sang viền màu đỏ và rung lắc trong 500ms
    And Thời gian đếm ngược bị trừ ngay 5 giây (còn 43 giây)
    And Combo bị reset về x1
    And Cả 2 ô tự động bỏ chọn sau 500ms để học viên tiếp tục thao tác

  Scenario: Nhấp lại vào chính ô đang chọn để hủy chọn
    Given Học viên đang chọn ô "diligent" (ô đang viền vàng)
    When Học viên nhấp lại vào chính ô "diligent"
    Then Ô "diligent" trở về trạng thái bình thường (bỏ chọn)
    And Không bị trừ thời gian và không tính là lần ghép sai

  Scenario: Hoàn thành toàn bộ 12 ô trước khi hết giờ (Chiến thắng)
    Given Bàn chơi chỉ còn 2 ô cuối cùng và đồng hồ còn 22 giây
    When Học viên ghép đúng cặp ô cuối cùng
    Then Đồng hồ lập tức dừng lại
    And Điểm số được cộng thêm điểm thưởng thời gian (22 giây x 20 = 440 điểm)
    And Màn hình tổng kết hiển thị huy hiệu chiến thắng và tổng điểm
    And Nếu điểm số cao hơn kỷ lục cũ trong localStorage, hiển thị nhãn "Kỷ Lục Mới!"

  Scenario: Hết thời gian 60 giây (Hết giờ)
    Given Đồng hồ đếm ngược về 00:00 và bàn chơi vẫn còn 4 ô chưa ghép
    When Giây cuối cùng kết thúc
    Then Bàn cờ bị khóa, không cho phép nhấp chọn thẻ nữa
    And Màn hình tổng kết hiển thị thông báo hết giờ và số cặp đã hoàn thành
```

### 2.2. Business Rules Checklist
- [x] **Ngưỡng tối thiểu:** Bắt buộc $\ge 6$ từ vựng hợp lệ (loại bỏ từ rỗng nghĩa).
- [x] **Kích thước bàn cờ:** Cố định 12 ô ($3 \times 4$ hoặc $4 \times 3$), mỗi cặp gồm 1 ô `type: 'WORD'` và 1 ô `type: 'MEANING'`.
- [x] **Phạt thời gian:** Sai trừ 5 giây (`deductTime(5)`), nếu thời gian $\le 5$ giây thì về 0 và kết thúc ván.
- [x] **Khóa tương tác:** Trong 500ms khi 2 ô ghép sai đang rung lắc, khóa không cho chọn ô thứ ba để tránh race condition.
- [x] **Lưu kỷ lục:** Lưu vào `localStorage` dạng JSON: `highScore`, `bestTimeSeconds`, `lastPlayedAt`.

---

## 3. Ma Trận Kịch Bản Kiểm Thử (Comprehensive Test Matrix)

| Khía cạnh kiểm thử | Kịch bản kiểm thử trọng tâm |
| :--- | :--- |
| **1. Happy Path** | Bộ thẻ 8 từ $\rightarrow$ Bấm ghép thẻ $\rightarrow$ Ghép đúng liên tiếp 6 cặp $\rightarrow$ Nhận thưởng combo & thưởng thời gian $\rightarrow$ Màn hình vinh danh thắng cuộc $\rightarrow$ Bấm "Chơi lại" sinh ván mới. |
| **2. Negative Cases** | Bộ thẻ rỗng (0 từ) hoặc ít hơn 6 từ (1–5 từ) $\rightarrow$ Không mở game, hiển thị EmptyState thân thiện $\rightarrow$ Nút quay lại hoạt động chuẩn. |
| **3. Boundary Value Analysis** | - Cận biên 5 từ: Chặn không cho chơi.<br>- Cận biên 6 từ: Cho phép chơi bình thường, bốc trọn 6 từ.<br>- Thời gian còn 3 giây bị trừ 5 giây phạt: Đồng hồ không bị âm mà về chính xác 0 và kết thúc game. |
| **4. Edge Cases & State Handling** | - Spam click vào cùng 1 ô liên tục: Không phát sinh bug hay đúp điểm.<br>- Nhấp ô thứ 3 khi 2 ô sai đang rung lắc: Thao tác bị chặn an toàn.<br>- Các từ vựng tiếng Việt dài nhiều dòng: Ô thẻ tự co giãn text, không vỡ layout.<br>- Bấm nút Back trên trình duyệt khi đang chơi: Thoát về `DeckDetailView` mượt mà, timer tự hủy không leak memory. |
| **5. Security & Data Integrity** | Dữ liệu `localStorage` bị người dùng sửa bằng tay thành giá trị rác/JSON lỗi: Hệ thống có `try/catch` fallback an toàn về giá trị mặc định, không crash trang. |
| **6. UI/UX & Accessibility** | - Hiệu ứng rung lắc `shake` khi sai mượt mà bằng CSS Tailwind.<br>- Âm thanh bật tắt tự nhiên qua Web Audio API không phụ thuộc file mp3 ngoài.<br>- Nhãn nút rõ ràng, hỗ trợ responsive trên màn hình điện thoại 375px. |

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (Standard Test Cases)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_MATCH_INIT_01** | Boundary | Bộ thẻ có đúng 5 từ vựng (dưới ngưỡng) | Đang ở `DeckDetailView` | 1. Bấm nút "Ghép thẻ" | Bộ thẻ có 5 từ | Hiển thị EmptyState: "Cần tối thiểu 6 từ vựng", không mở bàn chơi. |
| **TC_MATCH_INIT_02** | Happy Path | Bộ thẻ có 6 từ vựng (đạt ngưỡng tối thiểu) | Đang ở `DeckDetailView` | 1. Bấm nút "Ghép thẻ" | Bộ thẻ có 6 từ | Bàn cờ 12 ô hiển thị đầy đủ, timer 60s bắt đầu chạy, điểm = 0. |
| **TC_MATCH_CLICK_01** | Happy Path | Nhấp chọn 1 ô đầu tiên | Đang trong ván chơi | 1. Nhấp ô "Hello" | Ô `word-1` | Ô chuyển sang viền vàng nổi bật (`border-amber-500 ring-2`). |
| **TC_MATCH_CLICK_02** | Edge Case | Nhấp lại vào ô đang chọn | Đang chọn 1 ô | 1. Nhấp lại chính ô đó | Ô `word-1` | Ô trở về trạng thái bình thường (bỏ chọn), không phạt. |
| **TC_MATCH_PAIR_01** | Happy Path | Ghép đúng 1 cặp từ - nghĩa | Đang chọn 1 ô từ | 1. Nhấp ô nghĩa tương ứng | Ô `meaning-1` | - 2 ô đổi màu xanh lá, biến mất.<br>- Âm thanh đúng phát.<br>- Điểm tăng +100, combo lên x2. |
| **TC_MATCH_PAIR_02** | Negative | Ghép sai cặp từ - nghĩa | Đang chọn 1 ô từ | 1. Nhấp ô nghĩa khác | Ô `meaning-2` | - 2 ô viền đỏ, rung lắc.<br>- Âm thanh sai phát.<br>- Timer bị trừ 5s.<br>- Combo reset về x1. |
| **TC_MATCH_TIME_01** | Boundary | Phạt trừ giờ khi thời gian còn ít hơn 5s | Timer đang ở 3s | 1. Ghép sai 1 cặp | Cặp sai | Timer về 0s ngay lập tức, chuyển sang màn hình Hết Giờ. |
| **TC_MATCH_WIN_01** | Happy Path | Ghép hoàn thành toàn bộ 12 ô | Còn 1 cặp cuối | 1. Ghép đúng cặp cuối | Cặp cuối | - Timer dừng lại.<br>- Cộng điểm thưởng thời gian.<br>- Màn hình chiến thắng hiển thị kèm điểm tổng. |
| **TC_MATCH_RECORD_01** | Data Integrity | Cập nhật kỷ lục cá nhân khi đạt điểm cao mới | Chưa có kỷ lục | 1. Hoàn thành ván chơi đạt 1200 điểm | Điểm 1200 | `localStorage` lưu key `multilingo_match_best_deck_{id}` với highScore 1200, hiện badge "Kỷ lục mới". |
| **TC_MATCH_EXIT_01** | UI/UX | Bấm nút Thoát khi đang chơi | Đang trong ván | 1. Bấm nút Back/Thoát | N/A | Quay về `DeckDetailView`, timer được dọn dẹp sạch không chạy ngầm. |
| **TC_MATCH_CLEANUP_01** | Architecture | Kiểm tra không còn import từ `components/vocab` | Dự án sau refactor | 1. Quét toàn bộ codebase `frontend/src` | `components/vocab` | Không còn bất kỳ file nào import từ `components/vocab`, thư mục cũ đã xóa sạch. |
