package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "dictionary_lookup_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DictionaryLookupRequestRecord extends BaseEntity {
    public enum Status { PENDING, SUCCEEDED, FAILED }

    @Column(name = "user_id", nullable = false)
    private Integer userId;
    @Column(name = "attempt_id", nullable = false)
    private Integer attemptId;
    @Column(name = "part_id", nullable = false)
    private Integer partId;
    @Column(name = "document_id", length = 128, nullable = false)
    private String documentId;
    @Column(name = "request_id", length = 36, nullable = false)
    private String requestId;
    @Column(name = "request_fingerprint", length = 64, nullable = false)
    private String requestFingerprint;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private Status status;
    @Column(name = "run_id", length = 36)
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
    /** Contains generated definition fields only, never the passage or request text. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "jsonb")
    private Map<String, Object> resultJson;
    @Column(name = "failure_code", length = 50)
    private String failureCode;
    /** Frozen language/prompt policy only; passage and selected text are never persisted here. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_json", columnDefinition = "jsonb")
    private Map<String, Object> contextJson;

    @Override
    public String toString() {
        return "DictionaryLookupRequestRecord[id=" + getId() + ", userId=" + userId + ", attemptId=" + attemptId
                + ", requestId=" + requestId + ", status=" + status + ", content=<redacted>]";
    }
}
