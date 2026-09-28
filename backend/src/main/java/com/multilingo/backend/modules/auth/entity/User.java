package com.multilingo.backend.modules.auth.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends BaseEntity {

    @Column(name = "email", length = 255, unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "full_name", length = 150)
    private String fullName;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Builder.Default
    @Column(name = "native_language", length = 10, nullable = false)
    private String nativeLanguage = "vi";

    @Builder.Default
    @Column(name = "target_language", length = 10, nullable = false)
    private String targetLanguage = "en";

    @Builder.Default
    @Column(name = "subscription_tier", length = 20, nullable = false)
    private String subscriptionTier = "FREE";

    @Column(name = "premium_expires_at")
    private Instant premiumExpiresAt;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "google_id", length = 255, unique = true)
    private String googleId;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "last_login_ip", length = 45)
    private String lastLoginIp;
}
