# Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử: Nâng Cấp Thư Viện Đề Thi (Exam Library)

## Bước 1: Phạm vi & Tác nhân (Scope & Actors)
- **Tác nhân (Actors):**
  - **Học viên đã đăng nhập (Authenticated Student):** Đã hoàn tất hoặc chưa hoàn tất Onboarding. Xem danh sách đề thi kèm trạng thái đã làm / chưa làm và điểm số cao nhất của bản thân.
  - **Khách vãng lai (Guest):** Chưa đăng nhập, xem danh sách đề thi công khai nhưng không có thông tin làm bài cá nhân.
- **Phạm vi trong task (In-Scope):**
  - Giao diện thư viện đề thi mới với Hero banner, Search tức thì, Segmented Tabs chứng chỉ, Filter Chips kỹ năng & trạng thái làm bài.
  - Tab "Dành cho bạn" tự động lọc theo mục tiêu Onboarding.
  - Card đề thi hiện đại hiển thị thời lượng, lượt thi, kỹ năng, badge trạng thái đã thi / chưa thi, điểm cao nhất.
  - Backend API `/api/v1/student/exams` bổ sung thông tin `isAttempted`, `userAttemptsCount`, `userHighestScore`, `userLatestScore` khi có token xác thực.
- **Ngoài phạm vi (Out-of-Scope):**
  - Chức năng làm bài thi và chấm điểm (đã thuộc module exam workspace).

---

## Bước 2: Tiêu chí nghiệm thu (Acceptance Criteria)

### 2.1. Kịch bản Gherkin chuẩn
```gherkin
Feature: Thư viện đề thi cá nhân hóa & hiển thị lịch sử làm bài

  Scenario: Tự động lọc đề theo mục tiêu Onboarding (Tab "Dành cho bạn")
    Given Học viên đã đăng nhập và đã đặt mục tiêu "IELTS_ACADEMIC" với ngôn ngữ "en"
    When Học viên truy cập trang Thư viện đề thi /student/library
    Then Tab "Dành cho bạn" được kích hoạt mặc định
    And Danh sách đề thi hiển thị các đề IELTS Academic ngôn ngữ tiếng Anh
    And Banner mục tiêu hiển thị "Mục tiêu: IELTS Academic (Band 7.0)"

  Scenario: Hiển thị trạng thái đã làm và điểm số cao nhất trên thẻ đề thi
    Given Học viên đã hoàn thành đề thi "Cambridge IELTS 18 Test 1" 2 lần với điểm 6.5 và 7.5
    When Học viên duyệt danh sách đề thi trên Thư viện
    Then Thẻ đề thi "Cambridge IELTS 18 Test 1" hiển thị badge "✓ Đã làm (2 lần) • Điểm: 7.5"
    And Nút hành động trên thẻ hiển thị "Làm lại"

  Scenario: Lọc đề thi bằng Filter Chips kỹ năng và trạng thái làm bài
    Given Học viên đang ở Thư viện đề thi
    When Học viên click chọn Filter Chip "Listening" và "Chưa làm"
    Then Danh sách đề thi chỉ hiển thị các đề có kỹ năng Listening mà học viên chưa từng nộp bài

  Scenario: Khách vãng lai xem thư viện đề thi
    Given Người dùng chưa đăng nhập
    When Người dùng truy cập /student/library
    Then Danh sách đề thi vẫn hiển thị đầy đủ
    And Tất cả thẻ đề thi hiển thị trạng thái trung tính, không lỗi hệ thống
```

### 2.2. Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **Ràng buộc xuất bản:** Chỉ hiển thị các đề thi có cờ `published = true`. Đề thi nháp không bao giờ xuất hiện ở thư viện của học viên.
- [x] **Xác thực linh hoạt:** API `/api/v1/student/exams` hỗ trợ cả người dùng có Bearer Token (trả về điểm số cá nhân) và không có token (trả về `isAttempted = false`, `userHighestScore = null`).
- [x] **Trạng thái bài thi tính điểm:** Chỉ các `TestAttempt` có trạng thái `COMPLETED` mới được tính vào `userAttemptsCount` và `userHighestScore`. Các bài đang làm dở dang (`IN_PROGRESS`) hoặc bị hủy không được tính.

---

## Bước 3: Ma trận kiểm thử 6 khía cạnh (Comprehensive Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- |
| **1. Happy Path** | Học viên vào thư viện, xem đề theo tab "Dành cho bạn", chuyển tab TOEIC/NLTV, lọc theo Listening. | Dữ liệu lọc mượt mà, danh sách cập nhật chính xác, không giật lag. |
| **2. Negative** | Người dùng nhập từ khóa tìm kiếm không tồn tại (VD: "xyz12345"). | Hiển thị màn hình rỗng thân thiện (Empty State) với nút "Xóa bộ lọc". |
| **3. Boundary** | Học viên có số lần làm bài cực lớn (> 100 lần) hoặc điểm thi đạt trần (IELTS 9.0, TOEIC 990). | Hiển thị trọn vẹn trên badge không bị tràn viền hoặc vỡ layout card. |
| **4. Edge Cases** | Học viên vừa hoàn thành onboarding xong chưa từng thi bài nào. | Tất cả thẻ đề thi hiển thị badge "Chưa làm" và nút "Làm bài ngay". |
| **5. Security** | Học viên A truy cập thư viện không thể xem điểm thi của học viên B. | `TestAttemptRepository` chỉ truy vấn đúng `userId` từ SecurityContextHolder của học viên hiện tại. |
| **6. UI/UX** | Responsive trên màn hình Mobile (375px), Tablet (768px) và Desktop (1440px). | Tabs và Chips cuộn ngang mượt mà (scrollable chips), Card co giãn grid linh hoạt 1-3 cột. |

---

## Bước 4: Bảng Test Cases Chuẩn Hóa (7 Cột)

| Test Case ID | Tên Kịch Bản | Tiền Điều Kiện | Các Bước Thực Hiện | Dữ Liệu Đầu Vào | Kết Quả Mong Đợi | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_LIB_FILTER_01** | Lọc theo tab "Dành cho bạn" | Học viên có target TOEIC_LR | 1. Mở `/student/library` | Token học viên mục tiêu TOEIC | Tab "Dành cho bạn" kích hoạt, chỉ hiện đề TOEIC | Chưa chạy |
| **TC_LIB_FILTER_02** | Chuyển tab Chứng chỉ khác | Đang ở tab Dành cho bạn | 1. Bấm tab `🇬🇧 IELTS`<br>2. Quan sát danh sách | Click tab IELTS | Danh sách đổi sang các đề IELTS | Chưa chạy |
| **TC_LIB_FILTER_03** | Lọc theo Chip Kỹ năng | Đang ở tab IELTS | 1. Bấm chip `🎧 Listening` | Click chip Listening | Chỉ hiện đề IELTS có phần Listening | Chưa chạy |
| **TC_LIB_FILTER_04** | Lọc đề "Chưa làm" | Đã làm 1 số đề | 1. Bấm chip `Chưa làm` | Click chip Chưa làm | Chỉ hiện các đề có `isAttempted = false` | Chưa chạy |
| **TC_LIB_SEARCH_05** | Tìm kiếm theo tiêu đề | Thư viện có đề Cam 18 | 1. Nhập "Cambridge"<br>2. Nhấn Enter | Search query: "Cambridge" | Hiện đúng các đề chứa từ khóa Cambridge | Chưa chạy |
| **TC_LIB_ATTEMPT_06** | Hiển thị điểm thi cao nhất | Đã làm đề ID 1 đạt 800đ | 1. Duyệt đến card đề ID 1 | Đề ID 1 | Badge hiển thị "✓ Đã làm • Cao nhất: 800" | Chưa chạy |
| **TC_LIB_GUEST_07** | Khách xem thư viện | Chưa đăng nhập | 1. Mở `/student/library` | Không có Bearer Token | Đề thi hiện bình thường, không crash, không hiện điểm | Chưa chạy |
