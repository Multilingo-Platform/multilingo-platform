package com.multilingo.backend.modules.auth.entity;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;

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
@FieldDefaults(level = AccessLevel.PRIVATE)
public class User extends BaseEntity {

    @Column(name = "email", length = 255, unique = true, nullable = false)
    String email;

    @Column(name = "password_hash", length = 255)
    String passwordHash;

    @Column(name = "full_name", length = 150)
    String fullName;

    @Column(name = "phone", length = 20)
    String phone;

    @Column(name = "avatar_url", length = 500)
    String avatarUrl;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "role_id", nullable = false)
    Role role;

    @Builder.Default
    @Column(name = "native_language", length = 10, nullable = false)
    String nativeLanguage = "vi";

    @Builder.Default
    @Column(name = "target_language", length = 10, nullable = false)
    String targetLanguage = "en";

    @Builder.Default
    @Column(name = "subscription_tier", length = 20, nullable = false)
    String subscriptionTier = "FREE";

    @Column(name = "premium_expires_at")
    Instant premiumExpiresAt;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    Boolean isActive = true;

    @Column(name = "google_id", length = 255, unique = true)
    String googleId;

    @Column(name = "last_login_at")
    Instant lastLoginAt;

    @Column(name = "last_login_ip", length = 45)
    String lastLoginIp;
}
