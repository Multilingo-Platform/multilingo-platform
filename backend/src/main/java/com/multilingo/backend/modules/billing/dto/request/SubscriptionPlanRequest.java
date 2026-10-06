package com.multilingo.backend.modules.billing.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionPlanRequest {

    @NotBlank(message = "PLAN_CODE_REQUIRED")
    String code;

    @NotBlank(message = "PLAN_NAME_REQUIRED")
    String name;

    @NotNull(message = "PLAN_PRICE_REQUIRED")
    @DecimalMin(value = "0.0", inclusive = false, message = "PLAN_PRICE_MIN")
    BigDecimal price;

    @NotNull(message = "PLAN_DURATION_REQUIRED")
    @Min(value = 1, message = "PLAN_DURATION_MIN")
    Integer durationDays;
}
