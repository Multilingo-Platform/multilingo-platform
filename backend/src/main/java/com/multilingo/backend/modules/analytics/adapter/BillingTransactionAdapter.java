package com.multilingo.backend.modules.analytics.adapter;

import com.multilingo.backend.common.dto.PageResponse;
import com.multilingo.backend.modules.analytics.adapter.dto.TransactionInfo;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface BillingTransactionAdapter {

    BigDecimal getTotalSuccessfulRevenue();

    BigDecimal getSuccessfulRevenueSince(Instant since);

    List<TransactionInfo> findSuccessfulTransactionsBetween(Instant from, Instant to);

    PageResponse<TransactionInfo> findTransactions(String vnpTxnRef, String status, Instant from, Instant to, Pageable pageable);
}
