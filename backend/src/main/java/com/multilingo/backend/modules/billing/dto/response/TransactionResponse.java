package com.multilingo.backend.modules.billing.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TransactionResponse {
    Integer id;
    Integer userId;
    Integer planId;
    String planName;
    String vnpTxnRef;
    String vnpTransactionNo;
    BigDecimal amount;
    String bankCode;
    String paymentMethod;
    com.multilingo.backend.modules.billing.entity.TransactionStatus status;
    Instant paidAt;
    Instant createdAt;
}
