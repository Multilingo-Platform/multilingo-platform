package com.multilingo.backend.modules.analytics.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "login_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginHistory extends BaseEntity {

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "ip_address", length = 45, nullable = false)
    private String ipAddress;

    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    @Column(name = "login_time", nullable = false)
    private Instant loginTime;

    @Builder.Default
    @Column(name = "status", length = 20, nullable = false)
    private String status = "SUCCESS";
}
