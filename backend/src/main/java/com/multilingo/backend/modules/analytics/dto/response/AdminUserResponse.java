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
public class AdminUserResponse {
    private Integer id;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String role;
    private String subscriptionTier;
    private Boolean isActive;
    private Instant createdAt;
    private Instant lastLoginAt;
    private String lastLoginIp;
    private String lastLoginDevice;
    private Boolean isFraudRisk;
}
