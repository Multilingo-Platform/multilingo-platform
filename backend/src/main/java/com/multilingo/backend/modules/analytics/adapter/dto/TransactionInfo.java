package com.multilingo.backend.modules.analytics.adapter.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionInfo {
    private Integer id;
    private Integer userId;
    private String userEmail;
    private String planName;
    private String vnpTxnRef;
    private String vnpTransactionNo;
    private BigDecimal amount;
    private String bankCode;
    private String paymentMethod;
    private String status;
    private Instant paidAt;
    private Instant createdAt;
}
