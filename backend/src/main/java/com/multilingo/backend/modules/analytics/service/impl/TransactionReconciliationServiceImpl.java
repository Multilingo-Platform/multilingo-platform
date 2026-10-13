package com.multilingo.backend.modules.analytics.service.impl;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.BillingTransactionAdapter;
import com.multilingo.backend.modules.analytics.adapter.UserAccountAdapter;
import com.multilingo.backend.modules.analytics.adapter.dto.TransactionInfo;
import com.multilingo.backend.modules.analytics.adapter.dto.UserAccountInfo;
import com.multilingo.backend.modules.analytics.dto.response.AdminTransactionResponse;
import com.multilingo.backend.modules.analytics.service.TransactionReconciliationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionReconciliationServiceImpl implements TransactionReconciliationService {

    private final BillingTransactionAdapter billingTransactionAdapter;
    private final UserAccountAdapter userAccountAdapter;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AdminTransactionResponse> getTransactions(
            String vnpTxnRef,
            String status,
            Instant from,
            Instant to,
            Pageable pageable
    ) {
        PageResponse<TransactionInfo> page = billingTransactionAdapter.findTransactions(vnpTxnRef, status, from, to, pageable);

        Set<Integer> userIds = page.getItems().stream()
                .map(TransactionInfo::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Integer, UserAccountInfo> userMap = userAccountAdapter.findUsersByIds(userIds);

        List<AdminTransactionResponse> content = page.getItems().stream()
                .map(t -> mapToResponse(t, userMap.get(t.getUserId())))
                .collect(Collectors.toList());

        return PageResponse.<AdminTransactionResponse>builder()
                .items(content)
                .page(page.getPage())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminTransactionResponse> getAllTransactionsForExport(
            String vnpTxnRef,
            String status,
            Instant from,
            Instant to
    ) {
        PageResponse<TransactionInfo> page = billingTransactionAdapter.findTransactions(vnpTxnRef, status, from, to, Pageable.unpaged());

        Set<Integer> userIds = page.getItems().stream()
                .map(TransactionInfo::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Integer, UserAccountInfo> userMap = userAccountAdapter.findUsersByIds(userIds);

        return page.getItems().stream()
                .map(t -> mapToResponse(t, userMap.get(t.getUserId())))
                .collect(Collectors.toList());
    }

    private AdminTransactionResponse mapToResponse(TransactionInfo t, UserAccountInfo user) {
        return AdminTransactionResponse.builder()
                .id(t.getId())
                .userId(t.getUserId())
                .userEmail(user != null ? user.getEmail() : null)
                .planName(t.getPlanName())
                .vnpTxnRef(t.getVnpTxnRef())
                .vnpTransactionNo(t.getVnpTransactionNo())
                .amount(t.getAmount())
                .bankCode(t.getBankCode())
                .paymentMethod(t.getPaymentMethod())
                .status(t.getStatus())
                .paidAt(t.getPaidAt())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
