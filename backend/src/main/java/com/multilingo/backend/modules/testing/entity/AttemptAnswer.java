package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.Map;

@Entity
@Table(name = "attempt_answers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttemptAnswer extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private TestAttempt attempt;

    @Column(name = "part_id", nullable = false)
    private Integer partId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "user_answers", nullable = false)
    private Map<String, Object> userAnswers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "is_correct_flags")
    private Map<String, Object> isCorrectFlags;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_feedback")
    private Map<String, Object> aiFeedback;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skill_stats")
    private Map<String, Object> skillStats;

    @Column(name = "earned_score", precision = 4, scale = 2)
    private BigDecimal earnedScore;
}
