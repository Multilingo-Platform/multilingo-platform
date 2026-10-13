package com.multilingo.backend.modules.analytics.adapter.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccountInfo {
    private Integer id;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String roleName;
    private String subscriptionTier;
    private Boolean isActive;
    private String nativeLanguage;
    private String targetLanguage;
    private String phone;
    private Instant premiumExpiresAt;
    private Instant createdAt;
    private Instant lastLoginAt;
    private String lastLoginIp;
}
