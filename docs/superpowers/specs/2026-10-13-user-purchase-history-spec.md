# Đặc Tả Kỹ Thuật: Tra Cứu Lịch Sử Mua Gói Cước Người Dùng (User Purchase History)

## 1. Mục tiêu & Bối cảnh
Cung cấp tính năng và API cho phép học viên (Student / User) tra cứu lại toàn bộ lịch sử các gói cước VIP/Premium đã thanh toán thành công trong hệ thống Multilingo Platform.
Tính năng giúp người dùng theo dõi minh bạch các giao dịch đã thực hiện, thời gian mua, số tiền, phương thức thanh toán và thời hạn sử dụng.
Hỗ trợ phân trang chuẩn với kích thước mặc định 20 bản ghi/trang (`PageResponse<T>`).
Thông tin định danh người dùng được trích xuất an toàn từ JWT Token của phiên đăng nhập (không truyền `userId` qua query/body). Trên giao diện người dùng, mục này được truy cập thông qua menu `ProfileDropdown`.

## 2. Actor & Điều kiện tiên quyết
- **Actor:** Người dùng đã đăng nhập vào hệ thống (Role: `STUDENT`, `ADMIN` hoặc bất kỳ người dùng có JWT hợp lệ).
- **Điều kiện tiên quyết:**
  - Người dùng đã xác thực danh tính thành công và có Access Token (JWT) còn hiệu lực.
  - Hệ thống cơ sở dữ liệu đã có bảng `transactions` và `subscription_plans`.

## 3. Luồng chính (Happy Path)
1. **Truy cập từ ProfileDropdown:**
   - Người dùng click vào avatar trên Header để mở `ProfileDropdown`.
   - Người dùng click vào mục **"Lịch sử mua gói"** (kèm icon `Receipt`).
   - Hệ thống chuyển hướng người dùng sang trang `/student/purchase-history`.
2. **Gọi API lấy dữ liệu phân trang:**
   - Frontend gửi request `GET /api/v1/billing/my-history?page=0&size=20` kèm header `Authorization: Bearer <access_token>`.
   - Backend `JwtAuthenticationFilter` giải mã token, nạp `CustomUserDetails` vào `SecurityContext`.
   - `BillingController` nhận `CustomUserDetails` qua `@AuthenticationPrincipal` và lấy `userId = userDetails.getUser().getId()`.
   - `TransactionService` truy vấn `TransactionRepository` với `Pageable` tìm các giao dịch của `userId` có `status = SUCCESS`, sắp xếp giảm dần theo thời gian (`createdAt DESC`), kích thước trang mặc định 20 bản ghi.
   - Map danh sách sang `Page<TransactionResponse>` và bọc vào `PageResponse.from(...)`.
   - Backend trả về `ApiResponse<PageResponse<TransactionResponse>>` với mã HTTP `200 OK`.
3. **Hiển thị trên giao diện:**
   - Frontend hiển thị danh sách các gói đã mua dạng thẻ/bảng trực quan: Mã giao dịch, Tên gói, Thời hạn gói, Số tiền, Ngân hàng, Thời gian thanh toán, Trạng thái "Thành công".
   - Hiển thị thanh phân trang nếu số lượng bản ghi vượt quá 20.
   - Hiển thị tóm tắt thông tin gói hiện tại (còn hạn đến ngày nào) và nút CTA "Gia hạn / Nâng cấp" dẫn tới `/student/premium`.

## 4. Luồng phụ & Ngoại lệ (Edge cases & Error Handling)
- **Chưa có giao dịch nào:** Trả về `PageResponse` với `items: []`, `totalElements: 0`. Frontend hiển thị giao diện Empty State thân thiện kèm nút điều hướng đến trang Mua gói Premium `/student/premium`.
- **Token không hợp lệ / Hết hạn:** Backend ném `AppException(ErrorCode.UNAUTHENTICATED_ACCESS)` $\rightarrow$ trả về HTTP `401 Unauthorized`. Frontend axios interceptor tự động kích hoạt refresh token hoặc điều hướng về `/login`.
- **Người dùng chưa đăng nhập:** Chặn ngay tại `router.tsx` bằng `ProtectedRoute`, không cho vào trang `/student/purchase-history`.

## 5. Thiết kế API Contract
### Endpoint: `GET /api/v1/billing/my-history`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <access_token>`
- **Query Parameters:**
  - `page`: Số thứ tự trang, bắt đầu từ 0 (Mặc định: `0`)
  - `size`: Số bản ghi trên 1 trang (Mặc định: `20`)
- **Body:** Không có.
- **Response Format (200 OK):**
```json
{
  "code": 200,
  "message": "Lấy lịch sử mua gói thành công",
  "data": {
    "items": [
      {
        "id": 12,
        "userId": 5,
        "planId": 2,
        "planCode": "VIP_3_MONTHS",
        "planName": "Gói VIP 3 Tháng",
        "durationDays": 90,
        "vnpTxnRef": "TXN1712984501234",
        "vnpTransactionNo": "14567890",
        "amount": 249000.00,
        "bankCode": "NCB",
        "paymentMethod": "VNPAY",
        "status": "SUCCESS",
        "paidAt": "2026-10-10T14:30:00Z",
        "createdAt": "2026-10-10T14:28:15Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  }
}
```

## 6. Thiết kế Database & DTO
- **Database Tables:** Sử dụng bảng hiện có `transactions` và quan hệ `plan_id -> subscription_plans.id`.
- **Entity & DTO Refinements:**
  - `TransactionResponse`: Bổ sung 2 trường `Integer durationDays` và `String planCode`.
  - `TransactionMapper`: Bổ sung mapping `@Mapping(target = "durationDays", source = "plan.durationDays")` và `@Mapping(target = "planCode", source = "plan.code")`.
  - `TransactionRepository`: Thêm phương thức truy vấn phân trang:
    `Page<Transaction> findByUserIdAndStatus(Integer userId, TransactionStatus status, Pageable pageable);`
  - Bọc phản hồi bằng `PageResponse<TransactionResponse>`.
