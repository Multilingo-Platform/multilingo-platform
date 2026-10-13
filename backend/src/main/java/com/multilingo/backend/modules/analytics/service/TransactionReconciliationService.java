package com.multilingo.backend.modules.analytics.service;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.dto.response.AdminTransactionResponse;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

public interface TransactionReconciliationService {

    PageResponse<AdminTransactionResponse> getTransactions(
            String vnpTxnRef,
            String status,
            Instant from,
            Instant to,
            Pageable pageable
    );

    List<AdminTransactionResponse> getAllTransactionsForExport(
            String vnpTxnRef,
            String status,
            Instant from,
            Instant to
    );
}
