package com.multilingo.backend.modules.testing.adapter.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(
        name = "attempt_listening_playback",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_attempt_listening_playback_attempt", columnNames = {"attempt_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttemptListeningPlayback extends BaseEntity {

    @Column(name = "attempt_id", nullable = false, unique = true)
    private Integer attemptId;

    @Column(name = "started_at")
    private Instant startedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "playlist_frozen", columnDefinition = "json", nullable = false)
    private String playlistFrozen;

    @Column(name = "total_duration_ms", nullable = false)
    private Long totalDurationMs;
}
