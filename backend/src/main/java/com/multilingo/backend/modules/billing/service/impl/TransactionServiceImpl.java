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
    private final com.multilingo.backend.modules.auth.repository.UserRepository userRepository;

    @Override
    @Transactional
    public Transaction createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef) {
        SubscriptionPlan plan = planRepository.findById(request.getPlanId())
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND, "Không tìm thấy gói SubscriptionPlan"));

        Transaction transaction = transactionMapper.toEntity(request, plan, userId, vnpTxnRef);
        
        return transactionRepository.save(transaction);
    }

    @Override
    public Transaction getTransactionByRef(String vnpTxnRef) {
        return transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .orElse(null);
    }

    @Override
    @Transactional
    public void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode) {
        Transaction transaction = transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy giao dịch"));
                
        if (!"PENDING".equals(transaction.getStatus())) {
            return; // Đã xử lý rồi, bỏ qua
        }

        transaction.setStatus("SUCCESS");
        transaction.setVnpTransactionNo(vnpTransactionNo);
        transaction.setBankCode(bankCode);
        transaction.setPaidAt(java.time.Instant.now());
        transactionRepository.save(transaction);

        com.multilingo.backend.modules.auth.entity.User user = userRepository.findById(transaction.getUserId())
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy User"));

        user.setSubscriptionTier(com.multilingo.backend.modules.auth.entity.SubscriptionTier.PREMIUM);
        
        java.time.Instant now = java.time.Instant.now();
        if (user.getPremiumExpiresAt() != null && user.getPremiumExpiresAt().isAfter(now)) {
            user.setPremiumExpiresAt(user.getPremiumExpiresAt().plus(transaction.getPlan().getDurationDays(), java.time.temporal.ChronoUnit.DAYS));
        } else {
            user.setPremiumExpiresAt(now.plus(transaction.getPlan().getDurationDays(), java.time.temporal.ChronoUnit.DAYS));
        }
        userRepository.save(user);
    }
}
