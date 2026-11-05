# Acceptance Criteria & Test Design: Student AI Quota Visibility & Upgrade CTA

## Bước 1: Phân tích Phạm vi & Tác nhân (Scope & Actors)
- **Tác nhân (Actor):**
  - `Học viên (Student)`: Người dùng đã đăng nhập hệ thống, sử dụng các tính năng luyện tập AI (Tra từ điển ngữ cảnh, Gợi ý viết bài luận, AI chấm bài).
- **Phạm vi (Boundaries):**
  - **In-Scope:**
    - API `GET /api/v1/student/quotas` trả về thông tin hạn mức của học viên cho các tính năng: `AI_WRITING_HINTS`, `AI_WRITING_GRADING`, `DICTIONARY_LOOKUP`.
    - Trạng thái hạn mức phản ánh chính xác gói cước (`FREE` vs `PREMIUM`).
    - Nút CTA chuyển hướng đến `/student/premium` khi hết hạn mức tại `WritingHintsPanel` và `PracticeDictionaryPopover`.
  - **Out-of-Scope:**
    - Thay đổi logic trừ hạn mức nguyên tử tại tầng CSDL.
    - Sửa đổi các cổng thanh toán (VNPay).

---

## Bước 2: Tiêu chí Nghiệm thu (Acceptance Criteria - AC)

### AC1: Lấy danh sách Hạn mức AI của Học viên (Student Quota API)
- **Kịch bản 1: Học viên gói FREE chưa sử dụng lượt nào trong ngày**
  - **Given** Học viên đăng nhập có hạng tài khoản `FREE`.
  - **When** Học viên gọi `GET /api/v1/student/quotas`.
  - **Then** Hệ thống trả về danh sách 3 tính năng AI:
    - `AI_WRITING_HINTS`: `usedCount = 0`, `maxLimit = 5`, `remaining = 5`, `tier = "FREE"`.
    - `AI_WRITING_GRADING`: `usedCount = 0`, `maxLimit = 5`, `remaining = 5`, `tier = "FREE"`.
    - `DICTIONARY_LOOKUP`: `usedCount = 0`, `maxLimit = 20`, `remaining = 20`, `tier = "FREE"`.
  - **And** `resetDate` là mốc 00:00 ngày tiếp theo theo múi giờ `Asia/Ho_Chi_Minh`.

- **Kịch bản 2: Học viên gói PREMIUM có hạn mức nâng cao**
  - **Given** Học viên có gói `PREMIUM` còn hạn.
  - **When** Học viên gọi `GET /api/v1/student/quotas`.
  - **Then** Hệ thống trả về `tier = "PREMIUM"`:
    - `AI_WRITING_HINTS`: `maxLimit = 20`.
    - `AI_WRITING_GRADING`: `maxLimit = 20`.
    - `DICTIONARY_LOOKUP`: `maxLimit = 500`.

- **Kịch bản 3: Học viên đã sử dụng một phần hạn mức**
  - **Given** Học viên đã dùng 3 lượt `AI_WRITING_HINTS` trong ngày.
  - **When** Gọi API `GET /api/v1/student/quotas`.
  - **Then** Hệ thống trả về `usedCount = 3`, `maxLimit = 5`, `remaining = 2`.

### AC2: CTA Nâng cấp gói Premium tại WritingHintsPanel
- **Kịch bản 4: Hiển thị CTA nâng cấp khi hết hạn mức gợi ý viết**
  - **Given** Học viên đang làm bài tự luận chế độ Practice.
  - **When** Yêu cầu tạo gợi ý trả về lỗi `429 (QUOTA_EXCEEDED)` (`state.error.kind === 'quota'`).
  - **Then** `WritingHintsPanel` hiển thị thông báo hết hạn mức kèm nút CTA "Nâng cấp gói Premium".
  - **When** Học viên nhấn nút "Nâng cấp gói Premium".
  - **Then** Hệ thống điều hướng học viên tới trang `/student/premium`.

### AC3: CTA Nâng cấp gói Premium tại PracticeDictionaryPopover
- **Kịch bản 5: Hiển thị CTA nâng cấp khi hết hạn mức tra từ điển**
  - **Given** Học viên chọn từ để tra cứu trong bài thi Practice.
  - **When** API tra từ trả về lỗi `429` (`error.kind === 'quota'`).
  - **Then** Popover hiển thị thẻ cảnh báo màu hổ phách kèm nút "Nâng cấp gói Premium".
  - **When** Học viên click vào nút này.
  - **Then** Trình duyệt mở trang `/student/premium`.

### Business Rules Checklist:
- [x] Không bao giờ trả về giá trị `remaining` âm (nếu `usedCount > maxLimit` thì `remaining = 0`).
- [x] Mọi thời điểm reset đều đồng bộ múi giờ `Asia/Ho_Chi_Minh` (00:00 hôm sau).
- [x] Không tiết lộ thông tin của người dùng khác (chỉ lấy userId từ SecurityContextHolder).

---

## Bước 3: Ma trận Kịch bản Kiểm thử 6 Khía cạnh (Test Matrix)

| Khía cạnh | Kịch bản kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- |
| **1. Happy Path** | Học viên gọi API `GET /api/v1/student/quotas` khi đăng nhập | HTTP 200, trả về danh sách 3 hạn mức tính năng AI hợp lệ. |
| **2. Negative** | Người dùng chưa đăng nhập gọi API `GET /api/v1/student/quotas` | HTTP 401 Unauthorized. |
| **3. Boundary** | `usedCount == maxLimit` (đã dùng hết hạn mức) | `remaining = 0`, không bị số âm. |
| **4. Edge Cases** | Người dùng mới đăng ký, bảng `user_quotas` chưa có bất kỳ dòng nào | Tự động trả về hạn mức mặc định của FREE tier với `usedCount = 0`. |
| **5. Security** | Kiểm tra quyền truy cập IDOR (Học viên không thể truyền userId người khác để xem) | API luôn lấy `userId` từ token xác thực của phiên làm việc. |
| **6. UI/UX** | Giao diện nút CTA trên `WritingHintsPanel` và `PracticeDictionaryPopover` | Nút hiển thị rõ ràng, màu sắc hài hòa với design system (`amber-600` / `orange-600`), có icon và nhãn truy cập dễ hiểu. |

---

## Bước 4: Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã TC | Phân loại | Mô tả kịch bản | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_QUOTA_STUDENT_01** | Happy Path | Học viên FREE xem hạn mức chưa dùng | Đã đăng nhập tài khoản FREE, chưa dùng AI | Gửi `GET /api/v1/student/quotas` | Token FREE user | Trả về 3 quota, usedCount = 0, remaining = maxLimit, tier = FREE |
| **TC_QUOTA_STUDENT_02** | Happy Path | Học viên PREMIUM xem hạn mức | Đã đăng nhập tài khoản PREMIUM | Gửi `GET /api/v1/student/quotas` | Token PREMIUM user | maxLimit nâng cao (Hints: 20, Grading: 20, Dict: 500), tier = PREMIUM |
| **TC_QUOTA_STUDENT_03** | Boundary | Học viên đã dùng hết hạn mức | usedCount = 5, maxLimit = 5 | Gửi `GET /api/v1/student/quotas` | Token user hết quota | remaining = 0 |
| **TC_QUOTA_STUDENT_04** | Security | Chưa đăng nhập gọi API hạn mức | Chưa có JWT token | Gửi `GET /api/v1/student/quotas` không kèm Authorization | Không token | HTTP 401 Unauthorized |
| **TC_QUOTA_UI_01** | UI/UX | Hiển thị CTA nâng cấp tại WritingHintsPanel khi hết quota | `state.error.kind === 'quota'` | Mở WritingHintsPanel với trạng thái lỗi quota | Quota failure | Hiển thị nút "Nâng cấp gói Premium" dẫn đến `/student/premium` |
| **TC_QUOTA_UI_02** | UI/UX | Hiển thị CTA nâng cấp tại PracticeDictionaryPopover khi hết quota | `error.kind === 'quota'` | Render Dictionary Popover với lỗi quota | Quota failure | Hiển thị nút "Nâng cấp Premium" mở `/student/premium` |

