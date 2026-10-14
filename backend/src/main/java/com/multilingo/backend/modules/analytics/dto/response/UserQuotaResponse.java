package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserQuotaResponse {
    private Integer id;
    private String feature;
    private String tier;
    private Integer dailyLimit;
    private String resetCycle;
    private Instant updatedAt;
}
