# Tích hợp VNPay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp cổng thanh toán VNPay để xử lý nâng cấp tài khoản tự động thông qua IPN Webhook.

**Architecture:** Tạo API khởi tạo URL thanh toán VNPay, kết hợp một API nhận IPN Webhook Server-to-Server để xử lý giao dịch đáng tin cậy. `Transaction` lưu vết trạng thái và `User` sử dụng `SubscriptionTier` Enum để kiểm soát logic thời hạn gói Premium.

**Tech Stack:** Java, Spring Boot, Spring Data JPA, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-10-09-vnpay-integration-design.md`

## Global Constraints

- Mọi API trả về đúng format `ResponseEntity<ApiResponse<T>>` trừ API IPN của VNPay trả về dạng JSON raw `{"RspCode":"00","Message":"Confirm Success"}`.
- Không được phép hardcode secret key, phải đọc từ cấu hình `application.yml`.
- Entity phải kế thừa `BaseEntity`.

## Review Focus

1. Kẻ gian gọi IPN URL với chữ ký không hợp lệ -> Hệ thống phải trả RspCode 97 và không thay đổi DB.
2. Trùng lặp IPN cho đơn hàng đã xử lý xong -> Hệ thống phải trả RspCode 02, không cộng dồn thêm ngày.
3. Số tiền đẩy về IPN không khớp với DB -> Trả RspCode 04.

---

### Task 1: Refactor User Entity với SubscriptionTier Enum

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/auth/entity/SubscriptionTier.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/auth/entity/User.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/auth/entity/UserTest.java`

**Interfaces:**
- Produces: `Enum SubscriptionTier { FREE, PREMIUM }`, `User.getSubscriptionTier()` trả về Enum.

- [ ] **Step 1: Write the failing test**

```java
package com.multilingo.backend.modules.auth.entity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class UserTest {
    @Test
    void userShouldHaveEnumSubscriptionTier() {
        User user = new User();
        user.setSubscriptionTier(SubscriptionTier.PREMIUM);
        assertEquals(SubscriptionTier.PREMIUM, user.getSubscriptionTier());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && ./mvnw test -Dtest=UserTest`
Expected: FAIL (Cannot resolve symbol SubscriptionTier)

- [ ] **Step 3: Write minimal implementation**

Tạo `SubscriptionTier.java`:
```java
package com.multilingo.backend.modules.auth.entity;

public enum SubscriptionTier {
    FREE, PREMIUM
}
```

Cập nhật `User.java`:
```java
// Sửa dòng @Column(name = "subscription_tier", length = 20, nullable = false)
// String subscriptionTier = "FREE"; 
// Thành:
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_tier", length = 20, nullable = false)
    SubscriptionTier subscriptionTier = SubscriptionTier.FREE;
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && ./mvnw test -Dtest=UserTest`
Expected: PASS



---

### Task 2: Service tạo HMAC SHA512 và URL VNPay

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/service/VNPayService.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/billing/service/VNPayServiceTest.java`

**Interfaces:**
- Produces: `String createPaymentUrl(String vnpTxnRef, long amount, String bankCode, String ipAddress)`
- Produces: `boolean verifySignature(Map<String, String> fields, String secureHash)`

- [ ] **Step 1: Write the failing test**

```java
package com.multilingo.backend.modules.billing.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.HashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class VNPayServiceTest {
    private VNPayService vnPayService;

    @BeforeEach
    void setUp() {
        vnPayService = new VNPayService();
        ReflectionTestUtils.setField(vnPayService, "vnpTmnCode", "DUMMYCODE");
        ReflectionTestUtils.setField(vnPayService, "vnpHashSecret", "DUMMYSECRET");
        ReflectionTestUtils.setField(vnPayService, "vnpPayUrl", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        ReflectionTestUtils.setField(vnPayService, "vnpReturnUrl", "http://localhost:3000/payment/vnpay-return");
    }

    @Test
    void createPaymentUrl_shouldReturnValidUrl() {
        String url = vnPayService.createPaymentUrl("12345", 100000, "VNPAYQR", "127.0.0.1");
        assertTrue(url.contains("vnp_TxnRef=12345"));
        assertTrue(url.contains("vnp_Amount=10000000")); // amount * 100
        assertTrue(url.contains("vnp_SecureHash="));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && ./mvnw test -Dtest=VNPayServiceTest`
Expected: FAIL (Cannot resolve symbol VNPayService)

- [ ] **Step 3: Write minimal implementation**

```java
package com.multilingo.backend.modules.billing.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

@Service
public class VNPayService {
    @Value("${vnpay.tmnCode:}")
    private String vnpTmnCode;
    @Value("${vnpay.hashSecret:}")
    private String vnpHashSecret;
    @Value("${vnpay.payUrl:}")
    private String vnpPayUrl;
    @Value("${vnpay.returnUrl:}")
    private String vnpReturnUrl;

    public String createPaymentUrl(String vnpTxnRef, long amount, String bankCode, String ipAddress) {
        Map<String, String> vnp_Params = new HashMap<>();
        vnp_Params.put("vnp_Version", "2.1.0");
        vnp_Params.put("vnp_Command", "pay");
        vnp_Params.put("vnp_TmnCode", vnpTmnCode);
        vnp_Params.put("vnp_Amount", String.valueOf(amount * 100));
        vnp_Params.put("vnp_CurrCode", "VND");
        if (bankCode != null && !bankCode.isEmpty()) {
            vnp_Params.put("vnp_BankCode", bankCode);
        }
        vnp_Params.put("vnp_TxnRef", vnpTxnRef);
        vnp_Params.put("vnp_OrderInfo", "Thanh toan don hang " + vnpTxnRef);
        vnp_Params.put("vnp_OrderType", "other");
        vnp_Params.put("vnp_Locale", "vn");
        vnp_Params.put("vnp_ReturnUrl", vnpReturnUrl);
        vnp_Params.put("vnp_IpAddr", ipAddress);

        Calendar cld = Calendar.getInstance(TimeZone.getTimeZone("Etc/GMT+7"));
        SimpleDateFormat formatter = new SimpleDateFormat("yyyyMMddHHmmss");
        vnp_Params.put("vnp_CreateDate", formatter.format(cld.getTime()));

        cld.add(Calendar.MINUTE, 15);
        vnp_Params.put("vnp_ExpireDate", formatter.format(cld.getTime()));

        List<String> fieldNames = new ArrayList<>(vnp_Params.keySet());
        Collections.sort(fieldNames);
        StringBuilder hashData = new StringBuilder();
        StringBuilder query = new StringBuilder();
        try {
            for (String fieldName : fieldNames) {
                String fieldValue = vnp_Params.get(fieldName);
                if (fieldValue != null && (fieldValue.length() > 0)) {
                    hashData.append(fieldName).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                    query.append(URLEncoder.encode(fieldName, StandardCharsets.US_ASCII.toString())).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                    if (fieldNames.indexOf(fieldName) < fieldNames.size() - 1) {
                        query.append('&');
                        hashData.append('&');
                    }
                }
            }
            String queryUrl = query.toString();
            String vnp_SecureHash = hmacSHA512(vnpHashSecret, hashData.toString());
            queryUrl += "&vnp_SecureHash=" + vnp_SecureHash;
            return vnpPayUrl + "?" + queryUrl;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
    
    public boolean verifySignature(Map<String, String> fields, String secureHash) {
        try {
            fields.remove("vnp_SecureHashType");
            fields.remove("vnp_SecureHash");
            List<String> fieldNames = new ArrayList<>(fields.keySet());
            Collections.sort(fieldNames);
            StringBuilder hashData = new StringBuilder();
            for (String fieldName : fieldNames) {
                String fieldValue = fields.get(fieldName);
                if (fieldValue != null && (fieldValue.length() > 0)) {
                    hashData.append(fieldName).append('=').append(URLEncoder.encode(fieldValue, StandardCharsets.US_ASCII.toString()));
                    if (fieldNames.indexOf(fieldName) < fieldNames.size() - 1) {
                        hashData.append('&');
                    }
                }
            }
            String signValue = hmacSHA512(vnpHashSecret, hashData.toString());
            return signValue.equals(secureHash);
        } catch (Exception e) {
            return false;
        }
    }

    private String hmacSHA512(final String key, final String data) throws Exception {
        if (key == null || data == null) throw new NullPointerException();
        Mac hmac512 = Mac.getInstance("HmacSHA512");
        byte[] hmacKeyBytes = key.getBytes(StandardCharsets.UTF_8);
        SecretKeySpec secretKey = new SecretKeySpec(hmacKeyBytes, "HmacSHA512");
        hmac512.init(secretKey);
        byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
        byte[] result = hmac512.doFinal(dataBytes);
        StringBuilder sb = new StringBuilder(2 * result.length);
        for (byte b : result) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && ./mvnw test -Dtest=VNPayServiceTest`
Expected: PASS



---

### Task 3: Cập nhật BillingController xử lý Create Payment & IPN Webhook

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/controller/BillingController.java` (Giả sử file này hoặc VNPayController sẽ được tạo)
- Test: `backend/src/test/java/com/multilingo/backend/modules/billing/controller/BillingControllerTest.java`

**Interfaces:**
- Consumes: `VNPayService.createPaymentUrl`, `VNPayService.verifySignature`
- Produces: `POST /api/v1/billing/vnpay/create-payment`, `GET /api/v1/billing/vnpay/ipn`

- [ ] **Step 1: Write the failing test**

```java
package com.multilingo.backend.modules.billing.controller;

import com.multilingo.backend.modules.billing.service.VNPayService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BillingController.class)
class BillingControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VNPayService vnPayService;
    
    // (Giả sử các mock dependency khác cũng được khai báo nếu controller có)

    @Test
    void createPayment_shouldReturnUrl() throws Exception {
        when(vnPayService.createPaymentUrl(any(), any(Long.class), any(), any())).thenReturn("http://vnpay.url");
        
        mockMvc.perform(post("/api/v1/billing/vnpay/create-payment")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"planId\":1}"))
                .andExpect(status().isOk());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && ./mvnw test -Dtest=BillingControllerTest`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Tạo mới (hoặc update) `BillingController.java`:
```java
package com.multilingo.backend.modules.billing.controller;

import com.multilingo.backend.modules.billing.service.VNPayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/v1/billing/vnpay")
@RequiredArgsConstructor
public class BillingController {

    private final VNPayService vnPayService;
    
    @PostMapping("/create-payment")
    public ResponseEntity<?> createPayment(HttpServletRequest request) {
        // Tạm thời mockup vì controller này chưa liên kết TransactionService trong step test nhỏ này
        String ipAddr = request.getRemoteAddr();
        String url = vnPayService.createPaymentUrl("DUMMYTXN", 100000, null, ipAddr);
        Map<String, String> data = new HashMap<>();
        data.put("paymentUrl", url);
        return ResponseEntity.ok(data); // Chỗ này sau sẽ bọc qua ApiResponse theo chuẩn Base
    }
    
    @GetMapping("/ipn")
    public ResponseEntity<?> ipnWebhook(@RequestParam Map<String, String> allParams) {
        String secureHash = allParams.get("vnp_SecureHash");
        if (secureHash == null || !vnPayService.verifySignature(new HashMap<>(allParams), secureHash)) {
            return ResponseEntity.ok(Map.of("RspCode", "97", "Message", "Invalid signature"));
        }
        return ResponseEntity.ok(Map.of("RspCode", "00", "Message", "Confirm Success"));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && ./mvnw test -Dtest=BillingControllerTest`
Expected: PASS



*(Ghi chú: Bước kế tiếp người thực thi sẽ nối logic TransactionService và AuthService vào BillingController để xử lý DB lưu Transaction và cập nhật User. Việc nối DB sẽ được thực hiện sau khi pass Controller test).*

