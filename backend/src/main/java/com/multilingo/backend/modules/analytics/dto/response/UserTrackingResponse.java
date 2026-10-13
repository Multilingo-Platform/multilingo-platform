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
public class UserTrackingResponse {

    private Integer userId;
    private String email;
    private String fullName;
    private String subscriptionTier;
    private long totalAttempts;
    private Double averageScore;
    private Integer totalLearningMinutes;
    private String lastLoginIp;
    private Instant lastLoginAt;
}
