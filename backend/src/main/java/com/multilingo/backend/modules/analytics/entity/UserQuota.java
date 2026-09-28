package com.multilingo.backend.modules.analytics.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "user_quotas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserQuota extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "feature_code", length = 50, nullable = false)
    private String featureCode;

    @Builder.Default
    @Column(name = "used_count", nullable = false)
    private Integer usedCount = 0;

    @Builder.Default
    @Column(name = "max_limit", nullable = false)
    private Integer maxLimit = 1;

    @Column(name = "reset_date", nullable = false)
    private Instant resetDate;
}
