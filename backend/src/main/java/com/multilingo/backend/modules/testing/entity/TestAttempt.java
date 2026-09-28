package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
    @Column(name = "test_scope", length = 50, nullable = false)
    private String testScope = "FULL_EXAM";

    @Builder.Default
    @Column(name = "test_mode", length = 50, nullable = false)
    private String testMode = "MOCK_TEST";

    @Builder.Default
    @Column(name = "status", length = 30, nullable = false)
    private String status = "IN_PROGRESS";

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Builder.Default
    @Column(name = "time_spent_seconds", nullable = false)
    private Integer timeSpentSeconds = 0;

    @Column(name = "overall_score", precision = 4, scale = 2)
    private BigDecimal overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "section_scores")
    private Map<String, Object> sectionScores;
}
