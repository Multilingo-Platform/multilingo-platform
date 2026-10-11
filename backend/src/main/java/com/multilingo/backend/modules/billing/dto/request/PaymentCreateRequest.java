package com.multilingo.backend.modules.billing.dto.request;

import lombok.Data;

@Data
public class PaymentCreateRequest {
    private Integer planId;
    private String bankCode;
}
