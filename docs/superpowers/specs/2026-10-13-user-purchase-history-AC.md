# Tiêu Chí Nghiệm Thu & Thiết Kế Kịch Bản Kiểm Thử (AC & Test Design)
## Tính năng: Tra Cứu Lịch Sử Mua Gói Cước Người Dùng (User Purchase History)

Tài liệu được biên soạn tuân thủ quy chuẩn kỹ năng `acceptance-criteria-and-test-design`.

---

## 1. Phân tích Phạm vi & Tác nhân (Scope & Actors)
- **Tác nhân (Actor):** Học viên / Người dùng đã đăng nhập hệ thống (`STUDENT`, `ADMIN` sở hữu JWT token hợp lệ).
- **Phạm vi trong task (In-Scope):**
  - Backend:
    - Bổ sung trường `durationDays`, `planCode` vào `TransactionResponse` và cấu hình mapping trong `TransactionMapper`.
    - Thêm query method phân trang `Page<Transaction> findByUserIdAndStatus(Integer userId, TransactionStatus status, Pageable pageable)` trong `TransactionRepository`.
    - Bổ sung method `PageResponse<TransactionResponse> getPurchaseHistory(Integer userId, int page, int size)` trong `TransactionService` & `TransactionServiceImpl`.
    - Tạo endpoint `GET /api/v1/billing/my-history` trong `BillingController` nhận `@AuthenticationPrincipal CustomUserDetails`, `@RequestParam(defaultValue = "0") int page`, `@RequestParam(defaultValue = "20") int size`, trả về `ApiResponse<PageResponse<TransactionResponse>>`.
    - Viết Unit Test & Integration WebMvcTest bao phủ đầy đủ luồng.
  - Frontend:
    - Bổ sung mục "Lịch sử mua gói" kèm icon hóa đơn/thẻ trong `ProfileDropdown.tsx`, click chuyển hướng đến `/student/purchase-history`.
    - Thêm route `/student/purchase-history` vào `router.tsx`.
    - Xây dựng component trang `PurchaseHistoryPage.tsx` trong `features/premium/pages/` hỗ trợ hiển thị danh sách, phân trang 20 items/trang.
    - Xây dựng hàm gọi API trong `features/premium/api/billingApi.ts`.
    - Hỗ trợ đa ngôn ngữ i18n (`vi.json`, `en.json`).
- **Ngoài phạm vi (Out-of-Scope):**
  - Chức năng hoàn tiền (Refund / Chargeback).
  - Xuất hóa đơn điện tử PDF/Excel.
  - Quản trị đối soát toàn bộ giao dịch của Admin (thuộc Use Case UC16.2 riêng của TV4).

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 2.1 Kịch bản hành vi chính (Gherkin format)

#### Kịch bản 1: Lấy danh sách giao dịch thành công có phân trang (Mặc định 20 bản ghi/trang)
```gherkin
Kịch bản: Học viên đã mua gói cước xem lịch sử giao dịch phân trang
Given Học viên đã đăng nhập và có JWT token hợp lệ của user có id = 1
And Cơ sở dữ liệu có 2 giao dịch SUCCESS của user id = 1 và 1 giao dịch FAILED của user id = 1
When Client gửi request GET /api/v1/billing/my-history với Header "Authorization: Bearer <token>" (hoặc có query ?page=0&size=20)
Then Hệ thống trả về HTTP 200 OK
And Response body có status code 200, message "Lấy lịch sử mua gói thành công"
And Data trả về bọc trong PageResponse có:
  | page          | 0     |
  | size          | 20    |
  | totalElements | 2     |
  | totalPages    | 1     |
  | last          | true  |
And items chỉ chứa đúng 2 giao dịch có trạng thái SUCCESS
And Giao dịch được sắp xếp theo thời gian mới nhất lên đầu tiên (createdAt DESC)
And Mỗi phần tử chứa đầy đủ các trường: id, userId, planId, planName, planCode, durationDays, amount, status, bankCode, paymentMethod, paidAt, createdAt
```

#### Kịch bản 2: Người dùng chưa từng mua gói cước thành công
```gherkin
Kịch bản: Học viên mới chưa mua gói nào xem lịch sử
Given Học viên đã đăng nhập và có JWT token hợp lệ của user có id = 2
And Cơ sở dữ liệu không có giao dịch SUCCESS nào của user id = 2
When Client gửi request GET /api/v1/billing/my-history
Then Hệ thống trả về HTTP 200 OK
And Data trả về có items là mảng rỗng [], totalElements = 0
And Giao diện Frontend hiển thị Empty State "Bạn chưa có gói cước nào" kèm nút "Khám phá các gói VIP ngay"
```

#### Kịch bản 3: Phân trang khi có nhiều hơn 20 bản ghi
```gherkin
Kịch bản: Học viên có 25 giao dịch thành công
Given Học viên có 25 giao dịch SUCCESS trong cơ sở dữ liệu
When Client gửi request GET /api/v1/billing/my-history?page=0&size=20
Then Hệ thống trả về items gồm 20 giao dịch đầu tiên, totalElements = 25, totalPages = 2, last = false
When Client gửi tiếp request GET /api/v1/billing/my-history?page=1&size=20
Then Hệ thống trả về items gồm 5 giao dịch còn lại, page = 1, last = true
```

#### Kịch bản 4: Truy cập không xác thực hoặc Token không hợp lệ
```gherkin
Kịch bản: Người dùng chưa đăng nhập hoặc token hết hạn cố gọi API
Given Request không chứa Header Authorization hoặc chứa Bearer Token không hợp lệ
When Client gửi request GET /api/v1/billing/my-history
Then Hệ thống từ chối và trả về HTTP 401 Unauthorized
And Không có dữ liệu giao dịch nào bị rò rỉ
```

#### Kịch bản 5: Điều hướng từ Menu ProfileDropdown
```gherkin
Kịch bản: Học viên mở ProfileDropdown và chọn Lịch sử mua gói
Given Học viên đang ở bất kỳ trang nào trên giao diện (ví dụ /student/dashboard)
When Học viên click vào avatar để mở ProfileDropdown
Then Mục "Lịch sử mua gói" xuất hiện với icon trực quan
When Học viên click vào "Lịch sử mua gói"
Then ProfileDropdown tự động đóng lại
And Trình duyệt điều hướng chính xác đến "/student/purchase-history"
And Trang PurchaseHistoryPage được tải với dữ liệu lịch sử phân trang của học viên
```

### 2.2 Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **BR-01 (Chống IDOR):** ID người dùng được đọc hoàn toàn từ JWT Security Context (`@AuthenticationPrincipal`), không cho phép truyền `userId` từ Query Parameter hay Request Body.
- [x] **BR-02 (Lọc trạng thái):** Chỉ trả về các bản ghi giao dịch có `status = TransactionStatus.SUCCESS`.
- [x] **BR-03 (Phân trang chuẩn 20 bản ghi/trang):** Mặc định `page = 0`, `size = 20`, sắp xếp giảm dần theo thời gian tạo (`createdAt DESC`).
- [x] **BR-04 (Cấu trúc phản hồi PageResponse):** Response bọc trong `ApiResponse<PageResponse<TransactionResponse>>` với `PageResponse.from(...)`.
- [x] **BR-05 (UI State & Pagination):** Giao diện phải có đủ 4 trạng thái: Loading, Empty State, Data Table/Card kèm Pagination controls nếu `totalPages > 1`, Error Alert.

---

## 3. Ma Trận Kịch Bản Kiểm Thử 6 Khía Cạnh (Comprehensive Test Matrix)

1. **Happy Path (Luồng chuẩn):**
   - User có giao dịch thành công $\rightarrow$ API trả về `PageResponse` với `items`, `page=0, size=20`, Frontend render đẹp mắt.
2. **Negative Cases (Luồng lỗi):**
   - Không truyền Token $\rightarrow$ HTTP 401.
   - Token hết hạn hoặc sai chữ ký bí mật $\rightarrow$ HTTP 401.
3. **Boundary Value Analysis (Phân tích cận biên):**
   - User có 0 giao dịch $\rightarrow$ `items: []`, `totalElements: 0`, `totalPages: 0`, `last: true`.
   - User có đúng 20 giao dịch $\rightarrow$ `page=0`, `size=20`, `totalPages=1`, `last=true`.
   - User có 21 giao dịch $\rightarrow$ `totalPages=2`, trang 0 có 20 items (`last=false`), trang 1 có 1 item (`last=true`).
4. **Edge Cases & State Handling (Ca biên & Trạng thái):**
   - Giao dịch có `paidAt = null` $\rightarrow$ Mapper xử lý an toàn không sập.
   - Người dùng chuyển sang page không tồn tại (ví dụ page=99) $\rightarrow$ Trả về `items: []`, `last=true`.
   - Double click liên tục vào mục trong ProfileDropdown $\rightarrow$ Không kích hoạt chuyển hướng nhiều lần.
5. **Security & Data Integrity (Bảo mật & Toàn vẹn dữ liệu):**
   - User A không bao giờ thấy giao dịch của User B (Cách ly dữ liệu 100% qua JWT `userId`).
   - Token bị thu hồi (blacklisted trong Redis) $\rightarrow$ Bị chặn ngay tại filter.
6. **UI/UX & Accessibility:**
   - Trạng thái loading mượt mà với Skeleton/Spinner.
   - Nút chuyển trang (Next/Prev/Trang số) khi tổng số bản ghi > 20.
   - Định dạng tiền tệ chuẩn tiếng Việt (`249.000 đ`) và định dạng ngày giờ dễ đọc (`14:30 - 10/10/2026`).

---

## 4. Bảng Test Cases Chuẩn Hóa 7 Cột (`TC_BILLING_HISTORY_xx`)

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_BILLING_HISTORY_01** | Happy Path | Lấy danh sách giao dịch thành công mặc định trang 0, kích thước 20 | User id=1 đã đăng nhập, có 2 giao dịch SUCCESS | 1. Gửi GET `/api/v1/billing/my-history` | Bearer token User 1 | - HTTP 200<br>- `data.items` có 2 items SUCCESS<br>- `data.size = 20`, `data.page = 0`<br>- `data.totalElements = 2` |
| **TC_BILLING_HISTORY_02** | Happy Path | Phân trang khi tổng bản ghi > 20 | User id=1 có 25 giao dịch SUCCESS | 1. GET `?page=0&size=20`<br>2. GET `?page=1&size=20` | Bearer token User 1 | - Page 0: 20 items, `last = false`<br>- Page 1: 5 items, `last = true`, `totalPages = 2` |
| **TC_BILLING_HISTORY_03** | Happy Path | User chưa mua gói nào trả về PageResponse rỗng | User id=2 chưa mua gói nào | 1. Gửi GET `/api/v1/billing/my-history` | Bearer token User 2 | - HTTP 200<br>- `data.items = []`, `data.totalElements = 0`<br>- Frontend render Empty State |
| **TC_BILLING_HISTORY_04** | Negative | Không có Header Authorization | Chưa đăng nhập | 1. Gửi GET `/api/v1/billing/my-history` không kèm header | Header rỗng | - HTTP 401 Unauthorized |
| **TC_BILLING_HISTORY_05** | Negative | Access Token giả mạo hoặc sai chữ ký | Token tự chế | 1. Gửi GET `/api/v1/billing/my-history` kèm token sai | `Bearer invalid_token_123` | - HTTP 401 Unauthorized |
| **TC_BILLING_HISTORY_06** | Security / IDOR | Kiểm tra cách ly dữ liệu giữa các User | User 1 có 2 gói, User 2 có 1 gói | 1. Đăng nhập User 1 gọi API<br>2. Đăng nhập User 2 gọi API | Token User 1 & Token User 2 | - User 1 chỉ thấy giao dịch của User 1<br>- User 2 chỉ thấy giao dịch của User 2 |
| **TC_BILLING_HISTORY_07** | Edge Case | Lọc bỏ các giao dịch PENDING / FAILED / CANCELLED | User 1 có 1 SUCCESS, 1 PENDING, 1 FAILED | 1. Gửi GET `/api/v1/billing/my-history` | Token User 1 | - HTTP 200<br>- `data.items` chỉ có duy nhất 1 item SUCCESS |
| **TC_BILLING_HISTORY_08** | UI/UX | Hiển thị mục Lịch sử mua gói trong ProfileDropdown | Đã đăng nhập, đang ở trang Home/Dashboard | 1. Click Avatar trên Header | UI Header | - ProfileDropdown mở ra<br>- Có mục "Lịch sử mua gói" kèm icon |
| **TC_BILLING_HISTORY_09** | UI/UX | Điều hướng đúng tới `/student/purchase-history` | Đang mở ProfileDropdown | 1. Click vào "Lịch sử mua gói" | Click event | - Dropdown đóng lại<br>- URL chuyển thành `/student/purchase-history`<br>- Giao diện hiển thị trang lịch sử |
| **TC_BILLING_HISTORY_10** | UI/UX | Hiển thị phân trang và định dạng tiền tệ / thời gian | User có gói đã mua | 1. Quan sát thẻ/bảng giao dịch | `amount: 249000` | - Tiền tệ: `249.000 ₫`<br>- Ngày: Format ngày tháng rõ ràng<br>- Badge trạng thái: Xanh lá "Thành công"<br>- Hiển thị thanh phân trang nếu > 20 items |
