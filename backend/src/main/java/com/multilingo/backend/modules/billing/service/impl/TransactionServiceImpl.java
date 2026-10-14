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
    private final com.multilingo.backend.modules.billing.service.VNPayService vnPayService;

    @Override
    @Transactional
    public com.multilingo.backend.modules.billing.dto.response.TransactionResponse createTransaction(Integer userId, PaymentCreateRequest request, String vnpTxnRef) {
        SubscriptionPlan plan = planRepository.findById(request.getPlanId())
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND, "Không tìm thấy gói SubscriptionPlan"));

        Transaction transaction = transactionMapper.toEntity(request, plan, userId, vnpTxnRef);
        Transaction saved = transactionRepository.save(transaction);
        return transactionMapper.toResponse(saved);
    }

    @Override
    public com.multilingo.backend.modules.billing.dto.response.TransactionResponse getTransactionByRef(String vnpTxnRef) {
        return transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .map(transactionMapper::toResponse)
                .orElse(null);
    }

    @Override
    @Transactional
    public void processIpnSuccess(String vnpTxnRef, String vnpTransactionNo, String bankCode) {
        Transaction transaction = transactionRepository.findByVnpTxnRef(vnpTxnRef)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy giao dịch"));
                
        if (transaction.getStatus() != com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING) {
            return; // Đã xử lý rồi, bỏ qua
        }

        transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS);
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

    @Override
    @Transactional
    public com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse processPaymentReturn(java.util.Map<String, String> allParams) {
        String secureHash = allParams.get("vnp_SecureHash");
        if (secureHash == null || !vnPayService.verifySignature(new java.util.HashMap<>(allParams), secureHash)) {
            return com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse.builder()
                    .status("INVALID_SIGNATURE")
                    .message("Chữ ký giao dịch không hợp lệ.")
                    .build();
        }

        String txnRef = allParams.get("vnp_TxnRef");
        Transaction transaction = transactionRepository.findByVnpTxnRef(txnRef)
                .orElse(null);

        if (transaction == null) {
            return com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse.builder()
                    .status("FAILED")
                    .message("Không tìm thấy thông tin giao dịch.")
                    .vnpTxnRef(txnRef)
                    .build();
        }

        String responseCode = allParams.get("vnp_ResponseCode");
        String bankCode = allParams.get("vnp_BankCode");
        String vnpTransactionNo = allParams.get("vnp_TransactionNo");

        if ("00".equals(responseCode)) {
            if (transaction.getStatus() == com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING) {
                transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS);
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

            return com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse.builder()
                    .status("SUCCESS")
                    .message("Thanh toán thành công. Gói dịch vụ đã được kích hoạt!")
                    .vnpTxnRef(transaction.getVnpTxnRef())
                    .planName(transaction.getPlan() != null ? transaction.getPlan().getName() : "")
                    .amount(transaction.getAmount())
                    .durationDays(transaction.getPlan() != null ? transaction.getPlan().getDurationDays() : 0)
                    .bankCode(transaction.getBankCode())
                    .paymentTime(transaction.getPaidAt() != null ? transaction.getPaidAt() : java.time.Instant.now())
                    .build();

        } else if ("24".equals(responseCode)) {
            if (transaction.getStatus() == com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING) {
                transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.CANCELLED);
                transactionRepository.save(transaction);
            }

            return com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse.builder()
                    .status("CANCELLED")
                    .message("Giao dịch đã bị hủy bởi người dùng.")
                    .vnpTxnRef(transaction.getVnpTxnRef())
                    .planName(transaction.getPlan() != null ? transaction.getPlan().getName() : "")
                    .amount(transaction.getAmount())
                    .durationDays(transaction.getPlan() != null && transaction.getPlan().getDurationDays() != null ? transaction.getPlan().getDurationDays() : 0)
                    .build();

        } else {
            if (transaction.getStatus() == com.multilingo.backend.modules.billing.entity.TransactionStatus.PENDING) {
                transaction.setStatus(com.multilingo.backend.modules.billing.entity.TransactionStatus.FAILED);
                transactionRepository.save(transaction);
            }

            return com.multilingo.backend.modules.billing.dto.response.PaymentReturnResponse.builder()
                    .status("FAILED")
                    .message("Giao dịch thanh toán không thành công (Mã lỗi: " + responseCode + ").")
                    .vnpTxnRef(transaction.getVnpTxnRef())
                    .planName(transaction.getPlan() != null ? transaction.getPlan().getName() : "")
                    .amount(transaction.getAmount())
                    .build();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public com.multilingo.backend.common.dto.PageResponse<com.multilingo.backend.modules.billing.dto.response.TransactionResponse> getPurchaseHistory(Integer userId, int page, int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        org.springframework.data.domain.Page<Transaction> transactionPage = transactionRepository
                .findByUserIdAndStatus(userId, com.multilingo.backend.modules.billing.entity.TransactionStatus.SUCCESS, pageable);
        org.springframework.data.domain.Page<com.multilingo.backend.modules.billing.dto.response.TransactionResponse> responsePage =
                transactionPage.map(transactionMapper::toResponse);
        return com.multilingo.backend.common.dto.PageResponse.from(responsePage);
    }
}
