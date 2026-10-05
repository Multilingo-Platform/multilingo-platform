package com.multilingo.backend.modules.auth.entity;

import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "user_targets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserTarget extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Column(name = "target_certificate", length = 50, nullable = false)
    String targetCertificate;

    @Builder.Default
    @Column(name = "target_language", length = 10, nullable = false)
    String targetLanguage = "en";

    @Column(name = "target_score", precision = 4, scale = 1, nullable = false)
    BigDecimal targetScore;
}
