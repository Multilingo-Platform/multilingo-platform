package com.multilingo.backend.modules.auth.entity;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RefreshToken extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Column(name = "token", length = 500, unique = true, nullable = false)
    String token;

    @Column(name = "device_info", length = 255)
    String deviceInfo;

    @Column(name = "ip_address", length = 45)
    String ipAddress;

    @Column(name = "expires_at", nullable = false)
    Instant expiresAt;

    @Builder.Default
    @Column(name = "is_revoked", nullable = false)
    Boolean isRevoked = false;
}
