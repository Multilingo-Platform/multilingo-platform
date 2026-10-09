package com.multilingo.backend.modules.billing.dto.response;

import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubscriptionPlanResponse {
    Integer id;
    String code;
    String name;
    BigDecimal price;
    Integer durationDays;
    Boolean isActive;
}
