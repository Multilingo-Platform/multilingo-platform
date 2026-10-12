# VNPay DB Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện phần Business Logic tương tác Database cho VNPay: Lưu Transaction trạng thái PENDING khi khởi tạo thanh toán và xử lý cập nhật trạng thái Transaction, cập nhật Hạng User khi nhận IPN Webhook thành công.

**Architecture:** Tạo `TransactionRepository` và `TransactionService` để quản lý giao dịch. `BillingController` gọi `TransactionService` để tạo giao dịch trước khi sinh URL thanh toán. Tại IPN Webhook, `TransactionService` xử lý cập nhật giao dịch và thay đổi `subscriptionTier`, `premiumExpiresAt` của `User`.

**Tech Stack:** Java, Spring Boot, Spring Data JPA, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-10-09-vnpay-integration-design.md`

## Global Constraints

- Mọi API trả về đúng format `ResponseEntity<ApiResponse<T>>` trừ API IPN của VNPay.
- Giao dịch phải được kiểm tra tính toàn vẹn (tồn tại, trùng lặp xử lý, đúng số tiền).
- Bỏ qua bước commit tự động theo cấu hình trước đó nếu người dùng yêu cầu.

## Review Focus

1. IPN nhận RspCode = 00 nhưng giao dịch không tồn tại -> Báo lỗi 01 (Order Not Found).
2. Giao dịch đã ở trạng thái SUCCESS nhưng IPN gọi lại -> Báo lỗi 02 (Order already confirmed).
3. Cập nhật User phải thay đổi hạng thành PREMIUM và cộng dồn ngày (`premiumExpiresAt` = now + duration_days).

---

### Task 1: Khởi tạo TransactionRepository và TransactionService cơ bản

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/dto/request/PaymentCreateRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/dto/response/PaymentCreateResponse.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/mapper/TransactionMapper.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/repository/TransactionRepository.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/service/TransactionService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/billing/service/impl/TransactionServiceImpl.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/billing/service/TransactionServiceTest.java`

**Interfaces:**
- Produces: `Transaction createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef)`
- Produces: `Transaction getTransactionByRef(String vnpTxnRef)`

- [ ] **Step 1: Write the failing test**

```java
package com.multilingo.backend.modules.billing.service;

import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.entity.Transaction;
import com.multilingo.backend.modules.billing.repository.SubscriptionPlanRepository;
import com.multilingo.backend.modules.billing.repository.TransactionRepository;
import com.multilingo.backend.modules.billing.service.impl.TransactionServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private SubscriptionPlanRepository planRepository;

    @Mock
    private com.multilingo.backend.modules.billing.mapper.TransactionMapper transactionMapper;

    @InjectMocks
    private TransactionServiceImpl transactionService;

    @Test
    void createTransaction_shouldSaveAndReturnTransaction() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1);
        plan.setPrice(new BigDecimal("100000"));

        com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest request = new com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest();
        request.setPlanId(1);
        request.setBankCode("NCB");

        Transaction mockMappedTxn = new Transaction();
        mockMappedTxn.setUserId(1);
        mockMappedTxn.setPlan(plan);
        mockMappedTxn.setVnpTxnRef("TXN123");
        mockMappedTxn.setAmount(new BigDecimal("100000"));
        mockMappedTxn.setStatus("PENDING");
        mockMappedTxn.setPaymentMethod("VNPAY");
        mockMappedTxn.setBankCode("NCB");

        when(planRepository.findById(1)).thenReturn(Optional.of(plan));
        when(transactionMapper.toEntity(any(), any(), any(), any())).thenReturn(mockMappedTxn);
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));

        Transaction result = transactionService.createTransaction(1, request, "TXN123");

        assertNotNull(result);
        assertEquals("PENDING", result.getStatus());
        assertEquals("TXN123", result.getVnpTxnRef());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./mvnw test -Dtest=TransactionServiceTest`
Expected: FAIL (Cannot resolve symbol)

- [ ] **Step 3: Write minimal implementation**

Tạo `TransactionRepository.java`:
```java
package com.multilingo.backend.modules.billing.repository;

import com.multilingo.backend.modules.billing.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Integer> {
    Optional<Transaction> findByVnpTxnRef(String vnpTxnRef);
}
```

Tạo `PaymentCreateRequest.java` và `PaymentCreateResponse.java`:
```java
package com.multilingo.backend.modules.billing.dto.request;

import lombok.Data;

@Data
public class PaymentCreateRequest {
    private Integer planId;
    private String bankCode; // Bắt buộc hoặc tuỳ chọn, tuỳ vào cổng
}
```

```java
package com.multilingo.backend.modules.billing.dto.response;

import lombok.Data;

@Data
public class PaymentCreateResponse {
    private String paymentUrl;
}
```

Tạo `TransactionMapper.java`:
```java
package com.multilingo.backend.modules.billing.mapper;

import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.entity.Transaction;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.math.BigDecimal;

@Mapper(componentModel = "spring")
public interface TransactionMapper {
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "paidAt", ignore = true)
    @Mapping(target = "vnpTransactionNo", ignore = true)
    @Mapping(target = "bankCode", source = "request.bankCode")
    @Mapping(target = "status", constant = "PENDING")
    @Mapping(target = "paymentMethod", constant = "VNPAY")
    @Mapping(target = "plan", source = "plan")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "vnpTxnRef", source = "vnpTxnRef")
    @Mapping(target = "amount", source = "plan.price") // Lấy giá từ Database của Plan để tránh gian lận
    Transaction toEntity(PaymentCreateRequest request, SubscriptionPlan plan, Integer userId, String vnpTxnRef);
}
```

Tạo `TransactionService.java` và `TransactionServiceImpl.java`:
```java
package com.multilingo.backend.modules.billing.service;
import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.entity.Transaction;

public interface TransactionService {
    Transaction createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef);
    Transaction getTransactionByRef(String vnpTxnRef);
}
```

```java
package com.multilingo.backend.modules.billing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest;
import com.multilingo.backend.modules.billing.entity.SubscriptionPlan;
import com.multilingo.backend.modules.billing.entity.Transaction;
import com.multilingo.backend.modules.billing.mapper.TransactionMapper;
import com.multilingo.backend.modules.billing.repository.SubscriptionPlanRepository;
import com.multilingo.backend.modules.billing.repository.TransactionRepository;
import com.multilingo.backend.modules.billing.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TransactionServiceImpl implements TransactionService {

    private final TransactionRepository transactionRepository;
    private final SubscriptionPlanRepository planRepository;
    private final TransactionMapper transactionMapper;

    @Override
    @Transactional
    public Transaction createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef) {
        SubscriptionPlan plan = planRepository.findById(request.getPlanId())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy gói SubscriptionPlan"));

        // Sử dụng MapStruct tự động map các trường từ Request, Constant (VNPAY, PENDING), Plan (amount)
        Transaction transaction = transactionMapper.toEntity(request, plan, userId, vnpTxnRef);
        
        return transactionRepository.save(transaction);
    }

    @Override
    public Transaction getTransactionByRef(String vnpTxnRef) {
        return transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .orElse(null);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `./mvnw test -Dtest=TransactionServiceTest`
Expected: PASS

---

### Task 2: Hoàn thiện logic xử lý IPN và Nâng cấp User

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/service/impl/TransactionServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/service/TransactionService.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/billing/service/TransactionServiceTest.java`

**Interfaces:**
- Consumes: `UserRepository` để update hạng người dùng.
- Produces: `void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode)`

- [ ] **Step 1: Write the failing test**

Thêm đoạn sau vào `TransactionServiceTest`:
```java
    @Mock
    private com.multilingo.backend.modules.auth.repository.UserRepository userRepository;

    @Test
    void processIpnSuccess_shouldUpdateTransactionAndUser() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setDurationDays(30);

        Transaction transaction = new Transaction();
        transaction.setUserId(1);
        transaction.setPlan(plan);
        transaction.setStatus("PENDING");

        com.multilingo.backend.modules.auth.entity.User user = new com.multilingo.backend.modules.auth.entity.User();
        user.setId(1);

        when(transactionRepository.findByVnpTxnRef("TXN123")).thenReturn(Optional.of(transaction));
        when(userRepository.findById(1)).thenReturn(Optional.of(user));

        transactionService.processIpnSuccess("TXN123", "VNP123", "NCB");

        assertEquals("SUCCESS", transaction.getStatus());
        assertEquals(com.multilingo.backend.modules.auth.entity.SubscriptionTier.PREMIUM, user.getSubscriptionTier());
        assertNotNull(user.getPremiumExpiresAt());
    }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./mvnw test -Dtest=TransactionServiceTest`

- [ ] **Step 3: Write minimal implementation**

Trong `TransactionServiceImpl`, inject thêm `UserRepository userRepository` và triển khai:
```java
    // Import Instant, temporal.ChronoUnit
    @Override
    @Transactional
    public void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode) {
        Transaction transaction = transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy giao dịch"));
                
        if (!"PENDING".equals(transaction.getStatus())) {
            return; // Đã xử lý rồi, bỏ qua
        }

        transaction.setStatus("SUCCESS");
        transaction.setVnpTransactionNo(vnpTransactionNo);
        transaction.setBankCode(bankCode);
        transaction.setPaidAt(java.time.Instant.now());
        transactionRepository.save(transaction);

        com.multilingo.backend.modules.auth.entity.User user = userRepository.findById(transaction.getUserId())
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy User"));

        user.setSubscriptionTier(com.multilingo.backend.modules.auth.entity.SubscriptionTier.PREMIUM);
        
        java.time.Instant now = java.time.Instant.now();
        if (user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now)) {
            user.setPremiumExpiresAt(user.getPremiumExpiresAt().plus(transaction.getPlan().getDurationDays(), java.time.temporal.ChronoUnit.DAYS));
        } else {
            user.setPremiumExpiresAt(now.plus(transaction.getPlan().getDurationDays(), java.time.temporal.ChronoUnit.DAYS));
        }
        userRepository.save(user);
    }
```

- [ ] **Step 4: Run test to verify it passes**
Run: `./mvnw test -Dtest=TransactionServiceTest`
Expected: PASS

---

### Task 3: Tích hợp DB Logic vào BillingController

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/billing/controller/BillingController.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/billing/controller/BillingControllerTest.java`

**Interfaces:**
- Consumes: `TransactionService`, `VNPayService`.

- [ ] **Step 1: Write the failing test**

Thêm test case IPN vào `BillingControllerTest`:
```java
    @MockBean
    private com.multilingo.backend.modules.billing.service.TransactionService transactionService;

    @Test
    void ipnWebhook_shouldReturn00_whenValidSignature() throws Exception {
        when(vnPayService.verifySignature(any(), any())).thenReturn(true);
        when(transactionService.getTransactionByRef("TXN")).thenReturn(
            com.multilingo.backend.modules.billing.entity.Transaction.builder().status("PENDING").amount(new BigDecimal("100000")).build()
        );

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/billing/vnpay/ipn")
                .param("vnp_SecureHash", "hash")
                .param("vnp_TxnRef", "TXN")
                .param("vnp_Amount", "10000000") // 100,000 * 100
                .param("vnp_ResponseCode", "00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));
    }
```

- [ ] **Step 2: Run test to verify it fails**
Run: `./mvnw test -Dtest=BillingControllerTest`

- [ ] **Step 3: Write minimal implementation**

Sửa `BillingController.java`:
```java
    private final TransactionService transactionService;
    // (Đảm bảo add TransactionService vào constructor @RequiredArgsConstructor)

    @PostMapping("/create-payment")
    public com.multilingo.backend.common.dto.ApiResponse<com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse> createPayment(
            @RequestBody com.multilingo.backend.modules.billing.dto.request.PaymentCreateRequest requestBody, 
            HttpServletRequest request) {
        String ipAddr = request.getRemoteAddr();
        String vnpTxnRef = "TXN" + System.currentTimeMillis();
        
        // Hardcode userId = 1 cho demo, thực tế lấy từ SecurityContextHolder
        Transaction txn = transactionService.createTransaction(1, requestBody, vnpTxnRef);
        
        String url = vnPayService.createPaymentUrl(txn.getVnpTxnRef(), txn.getAmount().longValue(), null, ipAddr);
        
        com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse response = new com.multilingo.backend.modules.billing.dto.response.PaymentCreateResponse();
        response.setPaymentUrl(url);
        
        return com.multilingo.backend.common.dto.ApiResponse.success(response);
    }
    
    @GetMapping("/ipn")
    public String ipnWebhook(@RequestParam Map<String, String> allParams) {
        String secureHash = allParams.get("vnp_SecureHash");
        if (secureHash == null || !vnPayService.verifySignature(new HashMap<>(allParams), secureHash)) {
            return "{\"RspCode\":\"97\",\"Message\":\"Invalid signature\"}";
        }

        String txnRef = allParams.get("vnp_TxnRef");
        Transaction txn = transactionService.getTransactionByRef(txnRef);
        if (txn == null) {
            return "{\"RspCode\":\"01\",\"Message\":\"Order not found\"}";
        }

        long vnpAmount = Long.parseLong(allParams.get("vnp_Amount"));
        if (txn.getAmount().longValue() * 100 != vnpAmount) {
            return "{\"RspCode\":\"04\",\"Message\":\"Invalid amount\"}";
        }

        if (!"PENDING".equals(txn.getStatus())) {
            return "{\"RspCode\":\"02\",\"Message\":\"Order already confirmed\"}";
        }

        String rspCode = allParams.get("vnp_ResponseCode");
        if ("00".equals(rspCode)) {
            transactionService.processIpnSuccess(txnRef, allParams.get("vnp_TransactionNo"), allParams.get("vnp_BankCode"));
        } else {
            // Có thể thêm logic lưu trạng thái FAILED
        }

        return "{\"RspCode\":\"00\",\"Message\":\"Confirm Success\"}";
    }
```

- [ ] **Step 4: Run test to verify it passes**
Run: `./mvnw test -Dtest=BillingControllerTest`
Expected: PASS
