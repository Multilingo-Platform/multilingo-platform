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

    @Mock
    private com.multilingo.backend.modules.auth.repository.UserRepository userRepository;

    @Mock
    private com.multilingo.backend.modules.billing.service.VNPayService vnPayService;

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
        mockMappedTxn.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING);
        mockMappedTxn.setPaymentMethod("VNPAY");
        mockMappedTxn.setBankCode("NCB");

        com.multilingo.backend.modules.billing.dto.response.TransactionResponse mockResponse =
                com.multilingo.backend.modules.billing.dto.response.TransactionResponse.builder()
                        .userId(1)
                        .vnpTxnRef("TXN123")
                        .amount(new BigDecimal("100000"))
                        .status(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING)
                        .paymentMethod("VNPAY")
                        .bankCode("NCB")
                        .build();

        when(planRepository.findById(1)).thenReturn(Optional.of(plan));
        when(transactionMapper.toEntity(any(), any(), any(), any())).thenReturn(mockMappedTxn);
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionMapper.toResponse(any(Transaction.class))).thenReturn(mockResponse);

        com.multilingo.backend.modules.billing.dto.response.TransactionResponse result = transactionService.createTransaction(1, request, "TXN123");

        assertNotNull(result);
        assertEquals(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING, result.getStatus());
        assertEquals("TXN123", result.getVnpTxnRef());
    }

    @Test
    void processIpnSuccess_shouldUpdateTransactionAndUser() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setDurationDays(30);

        Transaction transaction = new Transaction();
        transaction.setUserId(1);
        transaction.setPlan(plan);
        transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING);

        com.multilingo.backend.modules.auth.entity.User user = new com.multilingo.backend.modules.auth.entity.User();
        user.setId(1);

        when(transactionRepository.findByVnpTxnRef("TXN123")).thenReturn(Optional.of(transaction));
        when(userRepository.findById(1)).thenReturn(Optional.of(user));

        transactionService.processIpnSuccess("TXN123", "VNP123", "NCB");

        assertEquals(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS, transaction.getStatus());
        assertEquals(com.multilingo.backend.modules.auth.entity.SubscriptionTier.PREMIUM, user.getSubscriptionTier());
        assertNotNull(user.getPremiumExpiresAt());
    }

    @Test
    void processPaymentReturn_shouldReturnSuccessWhenCode00() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName("Gói 1 Tháng");
        plan.setPrice(new BigDecimal("99000"));
        plan.setDurationDays(30);

        Transaction transaction = new Transaction();
        transaction.setUserId(1);
        transaction.setPlan(plan);
        transaction.setAmount(new BigDecimal("99000"));
        transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING);
        transaction.setVnpTxnRef("TXN_TEST_00");

        com.multilingo.backend.modules.auth.entity.User user = new com.multilingo.backend.modules.auth.entity.User();
        user.setId(1);

        java.util.Map<String, String> params = new java.util.HashMap<>();
        params.put("vnp_TxnRef", "TXN_TEST_00");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_SecureHash", "VALID_HASH");
        params.put("vnp_TransactionNo", "14000123");
        params.put("vnp_BankCode", "NCB");

        when(vnPayService.verifySignature(any(), any())).thenReturn(true);
        when(transactionRepository.findByVnpTxnRef("TXN_TEST_00")).thenReturn(Optional.of(transaction));
        when(userRepository.findById(1)).thenReturn(Optional.of(user));

        com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse res = transactionService.processPaymentReturn(params);

        assertNotNull(res);
        assertEquals("SUCCESS", res.getStatus());
        assertEquals("Gói 1 Tháng", res.getPlanName());
        assertEquals(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS, transaction.getStatus());
        assertEquals(com.multilingo.backend.modules.auth.entity.SubscriptionTier.PREMIUM, user.getSubscriptionTier());
    }

    @Test
    void processPaymentReturn_shouldReturnCancelledWhenCode24() {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName("Gói 1 Tháng");
        plan.setPrice(new BigDecimal("99000"));

        Transaction transaction = new Transaction();
        transaction.setUserId(1);
        transaction.setPlan(plan);
        transaction.setAmount(new BigDecimal("99000"));
        transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING);
        transaction.setVnpTxnRef("TXN_TEST_24");

        java.util.Map<String, String> params = new java.util.HashMap<>();
        params.put("vnp_TxnRef", "TXN_TEST_24");
        params.put("vnp_ResponseCode", "24");
        params.put("vnp_SecureHash", "VALID_HASH");

        when(vnPayService.verifySignature(any(), any())).thenReturn(true);
        when(transactionRepository.findByVnpTxnRef("TXN_TEST_24")).thenReturn(Optional.of(transaction));

        com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse res = transactionService.processPaymentReturn(params);

        assertNotNull(res);
        assertEquals("CANCELLED", res.getStatus());
        assertEquals(com.multilingo.backend.modules.billing.entity.TransactionStatus.CANCELLED, transaction.getStatus());
    }

    @Test
    void processPaymentReturn_shouldReturnInvalidSignatureWhenHashMismatch() {
        java.util.Map<String, String> params = new java.util.HashMap<>();
        params.put("vnp_TxnRef", "TXN_TEST_FAKE");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_SecureHash", "FAKE_HASH");

        when(vnPayService.verifySignature(any(), any())).thenReturn(false);

        com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse res = transactionService.processPaymentReturn(params);

        assertNotNull(res);
        assertEquals("INVALID_SIGNATURE", res.getStatus());
    }

    @Test
    void getPurchaseHistory_shouldReturnPageResponseOfSuccessfulTransactions() {
        Integer userId = 1;
        int page = 0;
        int size = 20;

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(1);
        plan.setName("Gói 1 Tháng");
        plan.setCode("VIP_1M");
        plan.setDurationDays(30);

        Transaction txn = new Transaction();
        txn.setId(10);
        txn.setUserId(userId);
        txn.setPlan(plan);
        txn.setAmount(new BigDecimal("99000"));
        txn.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS);
        txn.setVnpTxnRef("TXN_123");

        com.multilingo.backend.modules.billing.dto.response.TransactionResponse mockResponse =
                com.multilingo.backend.modules.billing.dto.response.TransactionResponse.builder()
                        .id(10)
                        .userId(userId)
                        .planId(1)
                        .planName("Gói 1 Tháng")
                        .planCode("VIP_1M")
                        .durationDays(30)
                        .amount(new BigDecimal("99000"))
                        .status(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS)
                        .vnpTxnRef("TXN_123")
                        .build();

        org.springframework.data.domain.Page<Transaction> mockPage =
                new org.springframework.data.domain.PageImpl<>(java.util.List.of(txn), org.springframework.data.domain.PageRequest.of(page, size), 1);

        when(transactionRepository.findByUserIdAndStatus(any(), any(), any())).thenReturn(mockPage);
        when(transactionMapper.toResponse(txn)).thenReturn(mockResponse);

        com.multilingo.backend.common.dto.PageResponse<com.multilingo.backend.modules.billing.dto.response.TransactionResponse> result =
                transactionService.getPurchaseHistory(userId, page, size);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(1, result.getItems().size());
        assertEquals("VIP_1M", result.getItems().get(0).getPlanCode());
        assertEquals(30, result.getItems().get(0).getDurationDays());
    }

    @Test
    void getPurchaseHistory_shouldReturnEmptyPageResponse_whenNoTransactions() {
        Integer userId = 2;
        int page = 0;
        int size = 20;

        org.springframework.data.domain.Page<Transaction> mockEmptyPage =
                new org.springframework.data.domain.PageImpl<>(java.util.Collections.emptyList(), org.springframework.data.domain.PageRequest.of(page, size), 0);

        when(transactionRepository.findByUserIdAndStatus(any(), any(), any())).thenReturn(mockEmptyPage);

        com.multilingo.backend.common.dto.PageResponse<com.multilingo.backend.modules.billing.dto.response.TransactionResponse> result =
                transactionService.getPurchaseHistory(userId, page, size);

        assertNotNull(result);
        assertEquals(0, result.getTotalElements());
        assertEquals(0, result.getItems().size());
    }
}
