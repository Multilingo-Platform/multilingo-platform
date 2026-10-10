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
}
