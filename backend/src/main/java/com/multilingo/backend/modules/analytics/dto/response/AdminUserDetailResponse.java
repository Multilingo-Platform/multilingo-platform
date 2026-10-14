package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserDetailResponse {
    private Integer id;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String role;
    private String subscriptionTier;
    private Boolean isActive;
    private String nativeLanguage;
    private String targetLanguage;
    private String phone;
    private Instant premiumExpiresAt;
    private Instant createdAt;
    private Instant lastLoginAt;
    private String lastLoginIp;
    private String lastLoginDevice;
    private Boolean isFraudRisk;

    // Tiến trình & Gamification
    private Long totalExamsAttempted;
    private Double averageExamScore;
    private Integer totalLearningMinutes;
    private Integer currentStreak;
    private Long totalXp;

    // Lịch sử phiên đăng nhập
    private List<LoginHistoryItem> recentLoginHistory;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LoginHistoryItem {
        private Integer id;
        private String ipAddress;
        private String deviceInfo;
        private Instant loginTime;
        private String status;
    }
}
