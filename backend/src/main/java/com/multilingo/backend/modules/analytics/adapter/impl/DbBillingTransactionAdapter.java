package com.multilingo.backend.modules.analytics.adapter.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.TransactionInfo;
import com.multilingo.backend.modules.billing.entity.Transaction;
import com.multilingo.backend.modules.billing.entity.TransactionStatus;
import com.multilingo.backend.modules.billing.repository.TransactionRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DbBillingTransactionAdapter implements BillingTransactionAdapter {

    private final TransactionRepository transactionRepository;

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getTotalSuccessfulRevenue() {
        BigDecimal sum = transactionRepository.sumAmountByStatus(TransactionStatus.SUCCESS);
        return sum != null ? sum : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public BigDecimal getSuccessfulRevenueSince(Instant since) {
        BigDecimal sum = transactionRepository.sumAmountByStatusAndCreatedAtAfter(TransactionStatus.SUCCESS, since);
        return sum != null ? sum : BigDecimal.ZERO;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TransactionInfo> findSuccessfulTransactionsBetween(Instant from, Instant to) {
        return transactionRepository.findByStatusAndCreatedAtBetween(TransactionStatus.SUCCESS, from, to)
                .stream()
                .map(this::toInfo)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TransactionInfo> findTransactions(String vnpTxnRef, String status, Instant from, Instant to, Pageable pageable) {
        Specification<Transaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (vnpTxnRef != null && !vnpTxnRef.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("vnpTxnRef")), "%" + vnpTxnRef.trim().toLowerCase() + "%"));
            }

            if (status != null && !status.isBlank()) {
                try {
                    TransactionStatus ts = TransactionStatus.valueOf(status.trim().toUpperCase());
                    predicates.add(cb.equal(root.get("status"), ts));
                } catch (IllegalArgumentException ignored) {}
            }

            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }

            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Transaction> page = transactionRepository.findAll(spec, pageable);
        Page<TransactionInfo> dtoPage = page.map(this::toInfo);
        return PageResponse.from(dtoPage);
    }

    private TransactionInfo toInfo(Transaction t) {
        return TransactionInfo.builder()
                .id(t.getId())
                .userId(t.getUserId())
                .planName(t.getPlan() != null ? t.getPlan().getName() : "VIP Plan")
                .vnpTxnRef(t.getVnpTxnRef())
                .vnpTransactionNo(t.getVnpTransactionNo())
                .amount(t.getAmount())
                .bankCode(t.getBankCode())
                .paymentMethod(t.getPaymentMethod())
                .status(t.getStatus() != null ? t.getStatus().name() : "PENDING")
                .paidAt(t.getPaidAt())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
