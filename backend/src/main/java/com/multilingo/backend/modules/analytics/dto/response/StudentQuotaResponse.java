package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentQuotaResponse {
    private String featureCode;
    private String featureName;
    private Integer usedCount;
    private Integer maxLimit;
    private Integer remaining;
    private String tier;
    private Instant resetDate;
}

