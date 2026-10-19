package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(
        name = "writing_grading_jobs",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_writing_grading_jobs_attempt_part_question",
                        columnNames = {"attempt_id", "part_id", "question_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WritingGradingJob extends BaseEntity {

    @Column(name = "attempt_id", nullable = false)
    private Integer attemptId;

    @Column(name = "part_id", nullable = false)
    private Integer partId;

    @Column(name = "question_id", length = 128, nullable = false)
    private String questionId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_json", columnDefinition = "json", nullable = false)
    private Map<String, Object> contextJson;

    @Column(name = "input_hash", length = 64, nullable = false)
    private String inputHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private WritingGradingJobStatus status;

    @Column(name = "wait_reason", length = 50)
    private String waitReason;

    @Builder.Default
    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Builder.Default
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "image_count", nullable = false)
    private Integer imageCount = 0;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

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

    @Column(name = "last_error_code", length = 50)
    private String lastErrorCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "model_metadata", columnDefinition = "json")
    private Map<String, Object> modelMetadata;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "json")
    private Map<String, Object> resultJson;

    @Column(name = "completed_at")
    private Instant completedAt;
}
