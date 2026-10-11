# Thiết Kế Tích Hợp Thanh Toán VNPay (Account Upgrade)

## 1. Mục tiêu & Bối cảnh
Tích hợp cổng thanh toán VNPay vào Multilingo Platform để cho phép người dùng thanh toán trực tuyến khi mua các gói nâng cấp tài khoản (Subscription Plans). Quá trình thanh toán cần đảm bảo an toàn, dữ liệu nhất quán (tránh mất tiền oan cho khách hàng) bằng việc kết hợp Return URL (cho Frontend) và IPN Webhook (cho Backend).

## 2. Actor & Điều kiện tiên quyết
- **Actor:** Người dùng đã đăng nhập (User).
- **Điều kiện tiên quyết:**
  - Người dùng có tài khoản đang hoạt động.
  - Gói nâng cấp (SubscriptionPlan) được chọn phải tồn tại và đang ở trạng thái kích hoạt (isActive = true).
  - Hệ thống đã cấu hình đầy đủ tham số VNPay (TmnCode, HashSecret, PaymentUrl).

## 3. Luồng chính (Happy Path)
1. **Khởi tạo thanh toán:** 
   - User chọn 1 `SubscriptionPlan` trên giao diện Frontend và bấm "Thanh toán".
   - Frontend gọi API `POST /api/v1/billing/vnpay/create-payment` kèm `planId`.
   - Backend tạo mới bản ghi `Transaction` với trạng thái `PENDING`, mã `vnpTxnRef` ngẫu nhiên duy nhất, và tạo URL thanh toán VNPay có chứa chữ ký số. Trả URL này về cho Frontend.
2. **Chuyển hướng VNPay:**
   - Frontend tự động redirect trình duyệt của User sang `paymentUrl` của VNPay.
   - User nhập thông tin thẻ/app ngân hàng, OTP và thanh toán thành công.
3. **Cập nhật IPN (Server-to-Server) - BẮT BUỘC:**
   - Server VNPay gọi ngầm tới API `GET /api/v1/billing/vnpay/ipn` của Backend (đã cấu hình trên Dashboard VNPay).
   - Backend xác thực chữ ký (HashSecret), kiểm tra số tiền khớp với `Transaction`, nếu `vnp_ResponseCode == "00"`, đổi `Transaction.status = SUCCESS`.
   - Backend cập nhật tài khoản người dùng: `User.subscriptionTier = PREMIUM`, cộng thêm số ngày tương ứng của gói vào `User.premiumExpiresAt`.
4. **Return URL (Client-side):**
   - Trình duyệt của User được VNPay chuyển hướng về Frontend URL (ví dụ: `http://localhost:3000/payment/vnpay-return?vnp_ResponseCode=00&...`).
   - Frontend hiển thị giao diện "Thanh toán thành công" dựa vào mã `00`. 

## 4. Luồng phụ & Ngoại lệ (Edge cases, Error Codes)
- **Người dùng hủy thanh toán:** VNPay trả về `vnp_ResponseCode = 24`. Transaction giữ trạng thái `PENDING` hoặc chuyển sang `CANCELLED`.
- **Thanh toán thất bại (Thẻ hết tiền, sai OTP):** Các mã lỗi khác "00". Đổi Transaction sang `FAILED`.
- **IPN đến chậm hoặc lỗi mạng:** Nhờ có IPN, dù user tắt trình duyệt khi đang thanh toán, hệ thống vẫn cập nhật thành công khi có mạng lại.
- **Tấn công giả mạo (Fake IPN / Return):** Mọi request từ VNPay (cả IPN và Return) đều phải được verify lại chữ ký bằng thuật toán HMAC SHA512 với `HashSecret`. Nếu sai chữ ký -> Báo lỗi `97` (Invalid Checksum).
- **Trùng mã giao dịch:** VNPay gửi lại IPN cho 1 giao dịch đã SUCCESS. Backend kiểm tra nếu `Transaction.status` != `PENDING` thì trả về `02` (Order already confirmed) mà không cộng ngày lại, tránh bị x2 phần thưởng.

## 5. Thiết kế API Contract
### 5.1 Khởi tạo URL Thanh toán
**`POST /api/v1/billing/vnpay/create-payment`**
- **Request Body:** 
  ```json
  { "planId": 1 }
  ```
- **Response (200 OK):**
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=...",
      "txnRef": "TXN_1638293819"
    }
  }
  ```

### 5.2 Xử lý IPN Webhook (Do VNPay gọi ngầm)
**`GET /api/v1/billing/vnpay/ipn`**
- **Query Params:** Các tham số `vnp_*` từ VNPay (`vnp_TxnRef`, `vnp_Amount`, `vnp_ResponseCode`, `vnp_SecureHash`,...)
- **Response (200 OK - Định dạng riêng theo yêu cầu VNPay):**
  ```json
  {
    "RspCode": "00",
    "Message": "Confirm Success"
  }
  ```
  *(Lưu ý: API này không bọc trong `ApiResponse` chuẩn vì VNPay yêu cầu JSON raw)*

### 5.3 (Optional) API Verify cho Frontend từ Return URL
**`GET /api/v1/billing/vnpay/verify-return`**
- Dùng trong trường hợp Frontend muốn tự gọi Backend để verify tính hợp lệ của Return URL thay vì chỉ tin vào query param. Giúp xử lý đồng bộ trạng thái ngay lập tức nếu IPN tới chậm.

## 6. Thiết kế Database (Bảng, Cột, Khóa ngoại)
Các bảng hiện tại đã đáp ứng đủ thiết kế, chỉ sử dụng lại và đảm bảo luồng chuẩn:

**Entity `Transaction` (đã có):**
- `id` (PK)
- `userId` (Integer, FK tới `users.id`)
- `planId` (Integer, FK tới `subscription_plans.id`)
- `vnpTxnRef` (String, UK - Mã đơn hàng gửi sang VNPay)
- `vnpTransactionNo` (String - Mã giao dịch ghi nhận tại VNPay)
- `amount` (BigDecimal - Số tiền thanh toán thực tế)
- `bankCode` (String)
- `paymentMethod` (String, default "VNPAY")
- `status` (String, enum: PENDING, SUCCESS, FAILED, CANCELLED)
- `paidAt` (Instant)

**Entity `User` (đã có):**
- Thuộc tính `subscriptionTier` sẽ được refactor thành Enum `SubscriptionTier` (chỉ chứa 2 giá trị là `FREE` và `PREMIUM`). Khi IPN xác nhận SUCCESS, service sẽ cập nhật `subscriptionTier = PREMIUM` và tính toán `premiumExpiresAt = now() + plan.duration` (nếu đang là FREE) hoặc cộng dồn (nếu đang là PREMIUM).
