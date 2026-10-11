# Kế hoạch triển khai Luồng Kết quả Thanh toán VNPay (Hủy & Thành công)

> **Dành cho agent:** KỸ NĂNG BẮT BUỘC: Sử dụng superpowers:subagent-driven-development (khuyên dùng) hoặc superpowers:executing-plans để triển khai kế hoạch này theo từng task. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Xử lý toàn diện luồng chuyển hướng khi kết thúc thanh toán VNPay: khi người dùng ấn Hủy giao dịch trên cổng thanh toán (mã phản hồi `24`) hoặc Thanh toán thành công (mã phản hồi `00`), hệ thống sẽ chuyển hướng về trang thông báo kết quả `PaymentResultPage` với giao diện chuyên nghiệp tông màu Trắng - Cam, cập nhật trạng thái đơn hàng và quyền lợi tài khoản.

**Kiến trúc:** 
1. Cấu hình `vnpay.returnUrl` chuyển hướng trình duyệt trực tiếp về route Frontend `http://localhost:5173/student/payment/result`.
2. Backend cung cấp API `GET /api/v1/billing/vnpay/payment-return` thẩm định chữ ký (`vnp_SecureHash`), cập nhật trạng thái Transaction (`SUCCESS`, `CANCELLED`, `FAILED`), kích hoạt quyền `PREMIUM` cho người dùng và trả về thông tin chi tiết gói cước.
3. Frontend xây dựng trang `PaymentResultPage` (nằm trong `features/premium/pages/`) đọc tham số URL, gọi backend thẩm định, hiển thị UI trạng thái (Thành công / Đã hủy / Thất bại) và tự động đồng bộ lại Redux Auth State để hiển thị ngay huy hiệu VIP.

**Công nghệ:** Spring Boot 3, Java 17, JUnit 5, Mockito, React 18, TypeScript, Tailwind CSS, Lucide React, Redux Toolkit, React Router v6.

**Tài liệu Đặc tả:** `docs/superpowers/specs/2026-10-09-vnpay-integration-AC.md`

## Các ràng buộc chung (Global Constraints)

- **Màu sắc & UI:** Giữ nguyên thiết kế chủ đạo Cam - Trắng (`orange-500`, `amber-500`, `slate-900`, `slate-500`, thẻ card bo tròn `rounded-3xl` cao cấp).
- **Ngôn ngữ:** Giao diện, thông báo lỗi và kế hoạch bằng Tiếng Việt; tên biến, phương thức và DTO bằng Tiếng Anh (`PaymentReturnResponse`, `handlePaymentReturn`, etc.).
- **Bảo mật:** Không tin cậy dữ liệu query params từ trình duyệt nếu chưa xác thực chữ ký (`vnp_SecureHash`) qua VNPay Service ở Backend.
- **Tính lũy kế / An toàn:** Nếu IPN đã xử lý thành công trước đó, return URL chỉ lấy dữ liệu hiển thị, không cộng dồn thời hạn 2 lần (Idempotency).
- **Kiến trúc Feature-based:** Toàn bộ component và trang thanh toán phải nằm trong `features/premium/`.

## Trọng tâm Review (Review Focus)

1. **Khách hàng ấn Hủy trên VNPay (`vnp_ResponseCode = 24`):** Đơn hàng phải chuyển sang trạng thái `CANCELLED`, giao diện hiển thị thông báo đã hủy thân thiện, hướng dẫn thử lại mà không báo lỗi sập hệ thống.
2. **Khách hàng gian lận tự sửa query params trên URL (Invalid Signature):** Người dùng sửa URL thành `vnp_ResponseCode=00`, backend phải kiểm tra `vnp_SecureHash` thất bại và trả về lỗi không hợp lệ, không kích hoạt Premium.
3. **Môi trường Localhost không nhận được IPN (Fallback Handler):** Ở môi trường dev/sandbox, VNPay không gọi được vào localhost `ipn`. Xử lý return URL tại backend phải đóng vai trò fallback tự động kích hoạt tài khoản `PREMIUM` ngay khi `vnp_ResponseCode=00` và hash hợp lệ.
4. **Đồng bộ Redux Auth State sau khi thanh toán thành công:** Sau khi thanh toán thành công, UI Header và Sidebar của Student phải cập nhật ngay trạng thái `subscriptionTier = "PREMIUM"` mà không bắt người dùng phải đăng xuất rồi đăng nhập lại.
5. **Trạng thái đang xác thực (Loading/Verify state):** Khi người dùng vừa chuyển hướng về, trang phải hiển thị spinner tải và thông điệp "Đang xác thực kết quả thanh toán với VNPay..." trước khi hiển thị kết quả cuối cùng.

---

### Task 1: Cấu hình `vnpay.returnUrl` trong Backend

**Các file:**
- Sửa đổi: `backend/src/main/resources/application.properties:36`
- Sửa đổi: `backend/src/main/resources/application-dev.properties`

**Giao tiếp (Interfaces):**
- Đầu vào: Cấu hình `vnpay.returnUrl`
- Đầu ra: URL redirect trình duyệt trỏ về frontend `http://localhost:5173/student/payment/result`

- [ ] **Bước 1: Cập nhật file `application.properties`**

Cập nhật `vnpay.returnUrl` từ endpoint ipn cũ sang frontend:
```properties
vnpay.returnUrl=http://localhost:5173/student/payment/result
```

- [ ] **Bước 2: Cập nhật file `application-dev.properties`**

Đảm bảo `application-dev.properties` cũng có:
```properties
vnpay.returnUrl=http://localhost:5173/student/payment/result
```

---

### Task 2: Xây dựng DTO `PaymentReturnResponse` ở Backend

**Các file:**
- Tạo mới: `backend/src/main/java/com/multilingo/backend/modules/billing/dto/response/PaymentReturnResponse.java`

**Giao tiếp (Interfaces):**
- Sản sinh: `PaymentReturnResponse` chứa `status` (SUCCESS, CANCELLED, FAILED, INVALID_SIGNATURE), `message`, `txnRef`, `planName`, `amount`, `durationDays`, `paymentTime`, `bankCode`.

- [ ] **Bước 1: Viết class `PaymentReturnResponse`**

```java
package com.multilingo.backend.modules.billing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentReturnResponse {
    private String status;         // SUCCESS, CANCELLED, FAILED, INVALID_SIGNATURE
    private String message;
    private String vnpTxnRef;
    private String planName;
    private BigDecimal amount;
    private Integer durationDays;
    private String bankCode;
    private Instant paymentTime;
}
```

---

### Task 3: Viết Unit Test và Triển khai Logic `processPaymentReturn` trong `TransactionService`

**Các file:**
- Sửa đổi: `backend/src/main/java/com/multilingo/backend/modules/billing/service/TransactionService.java`
- Sửa đổi: `backend/src/main/java/com/multilingo/backend/modules/billing/service/impl/TransactionServiceImpl.java`
- Sửa đổi: `backend/src/test/java/com/multilingo/backend/modules/billing/service/TransactionServiceTest.java` (hoặc tạo mới test)

**Giao tiếp (Interfaces):**
- Nhận vào: `Map<String, String> allParams`
- Trả về: `PaymentReturnResponse`

- [ ] **Bước 1: Viết unit tests kiểm thử các trường hợp (Thành công, Hủy mã 24, Sai chữ ký)**

Tạo/Bổ sung test trong `TransactionServiceTest.java`:
- Test trường hợp `vnp_ResponseCode = "00"` -> Cập nhật `Transaction` thành `SUCCESS`, nâng cấp user lên `PREMIUM`.
- Test trường hợp `vnp_ResponseCode = "24"` (Hủy) -> Cập nhật `Transaction` thành `CANCELLED`, trả về status `CANCELLED`.
- Test trường hợp `vnp_SecureHash` không hợp lệ -> Trả về status `INVALID_SIGNATURE`.

- [ ] **Bước 2: Chạy test để xác nhận FAIL (Red step)**

Chạy:
```powershell
mvn test -Dtest=TransactionServiceTest
```

- [ ] **Bước 3: Thêm phương thức `processPaymentReturn` vào `TransactionService` & `TransactionServiceImpl`**

Triển khai logic:
1. Xác thực chữ ký `vnPayService.verifySignature(params, secureHash)`. Nếu sai -> trả về status `INVALID_SIGNATURE`.
2. Tìm `Transaction` theo `vnp_TxnRef`. Nếu không tìm thấy -> trả về status `FAILED`, message "Không tìm thấy giao dịch".
3. Kiểm tra `vnp_ResponseCode`:
   - Nếu `"00"`:
     - Nếu status đang `PENDING`: Cập nhật `status = "SUCCESS"`, lưu `vnpTransactionNo`, `bankCode`, `paidAt`. Gia hạn / cấp `PREMIUM` cho `User`.
     - Trả về response `status = "SUCCESS"`.
   - Nếu `"24"`:
     - Nếu status đang `PENDING`: Cập nhật `status = "CANCELLED"`.
     - Trả về response `status = "CANCELLED"`, message: "Bạn đã hủy giao dịch thanh toán."
   - Trường hợp khác:
     - Cập nhật `status = "FAILED"`.
     - Trả về response `status = "FAILED"`, message: "Giao dịch thanh toán không thành công."

- [ ] **Bước 4: Chạy lại test để xác nhận PASS (Green step)**

Chạy:
```powershell
mvn test -Dtest=TransactionServiceTest
```

---

### Task 4: Thêm Endpoint `GET /payment-return` trong `BillingController`

**Các file:**
- Sửa đổi: `backend/src/main/java/com/multilingo/backend/modules/billing/controller/BillingController.java`
- Sửa đổi: `backend/src/test/java/com/multilingo/backend/modules/billing/controller/BillingControllerTest.java`

**Giao tiếp (Interfaces):**
- Request: `GET /api/v1/billing/vnpay/payment-return` kèm query params từ VNPay
- Response: `ApiResponse<PaymentReturnResponse>`

- [ ] **Bước 1: Viết Unit Test cho `handlePaymentReturn` trong `BillingControllerTest`**

Kiểm thử endpoint `/api/v1/billing/vnpay/payment-return` trả về `ApiResponse.success(response)` khi nhận query params hợp lệ.

- [ ] **Bước 2: Chạy test để xác nhận FAIL**

- [ ] **Bước 3: Viết phương thức `handlePaymentReturn` trong `BillingController`**

```java
@GetMapping("/payment-return")
public com.multilingo.backend.common.dto.ApiResponse<com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse> handlePaymentReturn(
        @RequestParam Map<String, String> allParams) {
    com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse response = transactionService.processPaymentReturn(allParams);
    return com.multilingo.backend.common.dto.ApiResponse.success(response);
}
```

- [ ] **Bước 4: Chạy test để xác nhận PASS**

Chạy:
```powershell
mvn test -Dtest=BillingControllerTest
```

---

### Task 5: Xây dựng Trang Kết quả Thanh toán `PaymentResultPage` trên Frontend

**Các file:**
- Tạo mới: `frontend/src/features/premium/pages/PaymentResultPage.tsx`
- Sửa đổi: `frontend/src/app/router.tsx`

**Giao tiếp (Interfaces):**
- Đầu vào: Query params từ `useLocation().search` hoặc `useSearchParams()`
- Hành động: Gọi API `GET /v1/billing/vnpay/payment-return?{params}`, nếu `SUCCESS` thì dispatch `authApi.getMyInfo()` -> `updateUser`
- Giao diện:
  - Trạng thái `Loading`: Hiển thị icon spinner và thông báo kiểm tra kết quả giao dịch.
  - Trạng thái `SUCCESS`: Icon Checkmark & Vương miện cam, thẻ tóm tắt gói cước, số tiền, ngày hết hạn, 2 nút "Bắt đầu học ngay" và "Xem trang cá nhân".
  - Trạng thái `CANCELLED`: Icon Hủy giao dịch (màu cam/xám ấm), thông báo thân thiện "Bạn đã hủy thanh toán. Tài khoản chưa bị trừ tiền.", nút "Thử lại thanh toán" (quay lại `/student/premium`) và nút "Về trang chủ".
  - Trạng thái `FAILED`: Cảnh báo lỗi giao dịch kèm lý do và nút hỗ trợ.

- [ ] **Bước 1: Tạo component `PaymentResultPage.tsx`**

Đảm bảo styling tuân thủ tông Cam - Trắng (`bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30`, thẻ card trắng tinh tế, shadow nổi bật, responsive toàn diện cả Mobile lẫn Desktop).

- [ ] **Bước 2: Đăng ký route trong `router.tsx`**

Thêm route con trong `/student`:
```tsx
{
  path: "payment/result",
  element: <PaymentResultPage />,
}
```

- [ ] **Bước 3: Kiểm tra Build Frontend**

Chạy:
```powershell
npm run build
```
Đảm bảo TypeScript không có lỗi type hoặc import thiếu.

---

### Task 6: Tích hợp và Kiểm thử Toàn bộ Luồng (End-to-End Verification)

- [ ] **Bước 1: Chạy kiểm thử tự động toàn diện Backend**
Chạy `mvn clean test` và xác nhận PASS toàn bộ test suite.

- [ ] **Bước 2: Kiểm thử thủ công luồng "Hủy thanh toán"**
1. Chọn gói Premium -> Modal xác nhận -> Bấm "Thanh toán VNPay".
2. Chuyển sang trang VNPay Sandbox -> Bấm nút **"Hủy"** trên cổng VNPay.
3. Trình duyệt chuyển về `http://localhost:5173/student/payment/result?...&vnp_ResponseCode=24...`.
4. Trang `PaymentResultPage` hiển thị giao diện "Thanh toán đã bị hủy", cung cấp nút "Thử lại thanh toán".

- [ ] **Bước 3: Kiểm thử thủ công luồng "Thanh toán thành công"**
1. Thực hiện thanh toán thành công với thẻ test NCB (mã OTP `123456`).
2. Trình duyệt chuyển về `http://localhost:5173/student/payment/result?...&vnp_ResponseCode=00...`.
3. Trang `PaymentResultPage` hiển thị giao diện chúc mừng rực rỡ, thông tin gói cước và huy hiệu VIP được cập nhật ngay lập tức trên thanh điều hướng.
