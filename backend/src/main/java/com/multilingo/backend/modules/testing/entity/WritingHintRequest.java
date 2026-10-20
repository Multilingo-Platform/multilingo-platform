package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(
        name = "writing_hint_requests",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_writing_hint_requests_user_request", columnNames = {"user_id", "request_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WritingHintRequest extends BaseEntity {

    public enum Status {
        PENDING,
        SUCCEEDED,
        FAILED
    }

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "attempt_id", nullable = false)
    private Integer attemptId;

    @Column(name = "part_id", nullable = false)
    private Integer partId;

    @Column(name = "question_id", length = 128, nullable = false)
    private String questionId;

    @Column(name = "request_id", length = 64, nullable = false)
    private String requestId;

    @Column(name = "request_fingerprint", length = 64, nullable = false)
    private String requestFingerprint;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_json", columnDefinition = "json")
    private Map<String, Object> contextJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private Status status;

    @Column(name = "run_id", length = 64)
    private String runId;

    @Column(name = "lease_until")
    private Instant leaseUntil;

    @Column(name = "last_started_at")
    private Instant lastStartedAt;

    @Column(name = "quota_id")
    private Integer quotaId;

    @Column(name = "quota_reset_date")
    private Instant quotaResetDate;

    @Builder.Default
    @Column(name = "quota_reserved", nullable = false)
    private Boolean quotaReserved = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "json")
    private Map<String, Object> resultJson;

    @Column(name = "failure_code", length = 50)
    private String failureCode;
}
