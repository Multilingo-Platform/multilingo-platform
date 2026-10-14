package com.multilingo.backend.modules.vocab.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/**
 * Entity lưu trữ bài thi thử từ vựng (Vocabulary Mock Test / Assessment).
 * Lưu snapshot đề thi, tiến độ làm bài và kết quả tổng kết dưới dạng JSONB trong PostgreSQL.
 */
@Entity
@Table(name = "vocab_test_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabTestAttempt extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "deck_id")
    private Integer deckId;

    @Column(name = "deck_name_snapshot", nullable = false)
    private String deckNameSnapshot;

    @Column(name = "test_token", nullable = false, unique = true, length = 64)
    private String testToken;

    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private String status = "IN_PROGRESS";

    @Builder.Default
    @Column(name = "progress_version", nullable = false)
    private Integer progressVersion = 0;

    @Column(name = "progress_hash", length = 64)
    private String progressHash;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Builder.Default
    @Column(name = "correct_count", nullable = false)
    private Integer correctCount = 0;

    @Builder.Default
    @Column(name = "score", nullable = false)
    private Integer score = 0;

    @Builder.Default
    @Column(name = "xp_earned", nullable = false)
    private Integer xpEarned = 0;

    @Column(name = "time_limit_seconds", nullable = false)
    private Integer timeLimitSeconds;

    @Builder.Default
    @Column(name = "time_spent_seconds", nullable = false)
    private Integer timeSpentSeconds = 0;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "questions_snapshot", nullable = false)
    private String questionsSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers_progress")
    private String answersProgress;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_summary")
    private String resultSummary;
}
