package com.multilingo.backend.modules.analytics.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateQuotaRequest {

    @NotBlank(message = "Feature is required")
    private String feature;

    @NotBlank(message = "Tier is required")
    private String tier;

    @NotNull(message = "Daily limit is required")
    @Min(value = 0, message = "Daily limit must be at least 0")
    private Integer dailyLimit;

    @Builder.Default
    private String resetCycle = "DAILY";
}
