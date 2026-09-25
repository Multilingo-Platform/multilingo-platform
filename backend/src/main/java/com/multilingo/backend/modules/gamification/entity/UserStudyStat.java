package com.multilingo.backend.modules.gamification.entity;

import com.multilingo.backend.common.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "user_study_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserStudyStat extends BaseEntity {

    @Column(name = "user_id", nullable = false, unique = true)
    private Integer userId;

    @Builder.Default
    @Column(name = "current_streak", nullable = false)
    private Integer currentStreak = 0;

    @Builder.Default
    @Column(name = "highest_streak", nullable = false)
    private Integer highestStreak = 0;

    @Builder.Default
    @Column(name = "total_learning_minutes", nullable = false)
    private Integer totalLearningMinutes = 0;

    @Column(name = "last_study_date")
    private LocalDate lastStudyDate;
}
