package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "test_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestAttempt extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "exam_id", nullable = false)
    private Integer examId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "test_scope", length = 50, nullable = false)
    private TestScope testScope = TestScope.FULL_EXAM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "test_mode", length = 50, nullable = false)
    private TestMode testMode = TestMode.MOCK_TEST;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    /**
     * Sprint 01: deadline — null for PRACTICE mode, startTime + duration for MOCK_TEST.
     */
    @Column(name = "deadline")
    private Instant deadline;

    @Builder.Default
    @Column(name = "time_spent_seconds", nullable = false)
    private Integer timeSpentSeconds = 0;

    @Column(name = "overall_score", precision = 4, scale = 2)
    private BigDecimal overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "section_scores", columnDefinition = "json")
    private Map<String, Object> sectionScores;

    /**
     * Sprint 01: Server-side snapshot of exam at attempt creation.
     * Immutable after create — edits to source exam do NOT affect this snapshot.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exam_snapshot", columnDefinition = "json")
    private Map<String, Object> examSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_summary", columnDefinition = "jsonb")
    private com.fasterxml.jackson.databind.JsonNode resultSummary;

    @Builder.Default
    @Column(name = "version", nullable = false)
    private Integer version = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "locked_sections", columnDefinition = "json")
    private java.util.List<Integer> lockedSections;
}
