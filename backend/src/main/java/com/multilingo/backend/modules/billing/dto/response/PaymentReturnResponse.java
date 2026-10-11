package com.multilingo.backend.modules.billing.dto.response;

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
public class PaymentReturnResponse {
    private String status;         // SUCCESS, CANCELLED, FAILED, INVALID_SIGNATURE
    private String message;
    private String vnpTxnRef;
    private String planName;
    private BigDecimal amount;
    private Integer durationDays;
    private String bankCode;
    private Instant paymentTime;
}
