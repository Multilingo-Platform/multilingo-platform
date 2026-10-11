# Tiêu chí nghiệm thu & Test Cases: Tích hợp VNPay

## 1. Phân tích Scope & Actor
- **Actor (Tác nhân):** Người dùng đã đăng nhập (User).
- **In-Scope (Phạm vi):**
  - Tạo URL thanh toán VNPay.
  - Xử lý IPN Webhook để cập nhật trạng thái giao dịch (`Transaction`) và nâng cấp tài khoản (`User.subscriptionTier` = `PREMIUM`, cộng ngày `premiumExpiresAt`).
  - Xử lý Return URL hiển thị kết quả cho người dùng.
- **Out-of-Scope (Ngoài phạm vi):** 
  - Quản lý các gói giá (Subscription Plans) - đã có sẵn.
  - Tự động trừ tiền định kỳ (auto-recurring billing) - tính năng này chỉ là nạp theo lần.

## 2. Tiêu chí nghiệm thu (Acceptance Criteria - AC)

### 2.1 Khởi tạo thanh toán
```gherkin
Given Người dùng đang đăng nhập và ở trang Nâng cấp tài khoản
When Người dùng chọn gói nạp hợp lệ và bấm "Thanh toán VNPay"
Then Hệ thống tạo mới một bản ghi Transaction với trạng thái PENDING
And Trả về một paymentUrl của VNPay có chứa chữ ký hợp lệ
```

### 2.2 Xử lý IPN - Giao dịch thành công
```gherkin
Given Có một bản ghi Transaction đang ở trạng thái PENDING
When VNPay gọi IPN Webhook với vnp_ResponseCode="00" và chữ ký vnp_SecureHash hợp lệ
Then Hệ thống cập nhật Transaction.status = SUCCESS
And Hệ thống đổi User.subscriptionTier thành Enum PREMIUM
And Hệ thống cộng thêm số ngày tương ứng của gói vào User.premiumExpiresAt (cộng dồn nếu đã là PREMIUM)
And Hệ thống trả về {"RspCode":"00","Message":"Confirm Success"} cho VNPay
```

### 2.3 Xử lý IPN - Trùng lặp (Chống X2 ngày nạp)
```gherkin
Given Có một bản ghi Transaction đã ở trạng thái SUCCESS (đã xử lý trước đó)
When VNPay gọi lại IPN Webhook với mã đơn hàng đó (vnp_TxnRef)
Then Hệ thống KHÔNG cộng thêm ngày vào User
And Hệ thống trả về {"RspCode":"02","Message":"Order already confirmed"} cho VNPay
```

### 2.4 Checklist Quy tắc nghiệp vụ (Business Rules)
- Chữ ký VNPay (`vnp_SecureHash`) bắt buộc phải được verify lại bằng thuật toán HMAC SHA512 với `HashSecret` của server cho cả request IPN và Return URL.
- Enum `SubscriptionTier` trong thực thể `User` phải chỉ giới hạn 2 giá trị là `FREE` và `PREMIUM`.
- `Transaction.amount` lưu số tiền gốc, phải đối chiếu với `vnp_Amount` (chia 100) gửi về từ IPN. Nếu sai số tiền, trả mã `04`.

## 3. Ma trận kiểm thử 6 khía cạnh

1. **Happy Path:** Khách mua gói thành công, IPN trả về 00, tài khoản được lên PREMIUM và cộng đúng số ngày. Trình duyệt hiển thị trang Success.
2. **Negative Cases:**
   - User truyền `planId` không tồn tại khi tạo payment -> Lỗi 404/400.
   - VNPay IPN gọi về với `vnp_TxnRef` không tồn tại trong DB -> Trả mã lỗi `01` (Order not found).
   - Thanh toán thất bại hoặc user hủy trên cổng VNPay (ResponseCode khác 00) -> Đổi Transaction status thành FAILED/CANCELLED.
3. **Boundary Value:**
   - Số tiền thanh toán VNPay IPN đẩy về (`vnp_Amount`) khác với `Transaction.amount` -> Trả về mã lỗi `04` (Invalid amount).
4. **Edge Cases & State Handling:**
   - Tài khoản đã là PREMIUM từ trước: Phải cộng dồn (extend) thêm ngày vào `premiumExpiresAt` hiện tại thay vì ghi đè từ thời điểm `now()`.
   - Lỗi mạng từ VNPay IPN (gọi nhiều lần cho cùng 1 đơn SUCCESS) -> Phải bắt được trạng thái != PENDING và trả `02` (Idempotent).
5. **Security & Data Integrity:**
   - Kẻ xấu giả mạo gọi API IPN hoặc đổi param trên Return URL với chữ ký sai -> Hệ thống chặn đứng, ném lỗi checksum invalid (`97`).
6. **UI/UX & Accessibility:**
   - Bấm nút thanh toán có loading spinner, disable nút để chống double-click.

## 4. Bảng Test Cases Chuẩn Hóa

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_BILLING_CREATE_01** | Happy Path | Tạo URL thanh toán thành công | User có quyền truy cập, chọn Plan hợp lệ | 1. Gọi POST /create-payment với planId = 1 | `planId: 1` | Trả về `paymentUrl`, DB tạo Transaction PENDING |
| **TC_BILLING_IPN_01** | Happy Path | IPN xử lý thanh toán thành công (User FREE) | Transaction PENDING, User đang FREE | 1. Gọi GET /ipn với ResponseCode=00, chữ ký hợp lệ | `vnp_ResponseCode=00` | Transaction = SUCCESS, User lên PREMIUM, tính `expiresAt` từ hiện tại, trả `RspCode: 00` |
| **TC_BILLING_IPN_02** | Edge Case | IPN xử lý thanh toán thành công (User PREMIUM) | Transaction PENDING, User đã PREMIUM | 1. Gọi GET /ipn với ResponseCode=00, chữ ký hợp lệ | `vnp_ResponseCode=00` | Transaction = SUCCESS, ngày `expiresAt` được **cộng dồn** từ ngày cũ, trả `RspCode: 00` |
| **TC_BILLING_IPN_03** | Edge Case | Trùng lặp IPN cho đơn đã xử lý | Transaction đã SUCCESS | 1. VNPay gọi lại GET /ipn cho đơn cũ | Đơn hàng đã SUCCESS | Không cộng thêm ngày, trả về `RspCode: 02` |
| **TC_BILLING_IPN_04** | Security | Giả mạo IPN sai chữ ký | Transaction PENDING | 1. Kẻ gian gọi GET /ipn với `vnp_SecureHash` giả | Sai chữ ký | Hệ thống từ chối, không đổi data, trả về `RspCode: 97` |
| **TC_BILLING_IPN_05** | Negative | Thanh toán bị hủy / lỗi | Transaction PENDING | 1. VNPay gọi GET /ipn với ResponseCode=24 | `vnp_ResponseCode=24` | Transaction = CANCELLED, User không đổi, trả `RspCode: 00` |
| **TC_BILLING_IPN_06** | Boundary | Số tiền gửi về không khớp | Transaction PENDING amount=100k | 1. VNPay IPN có vnp_Amount=50k | `vnp_Amount` sai | Hệ thống từ chối, không cập nhật User, trả `RspCode: 04` |
