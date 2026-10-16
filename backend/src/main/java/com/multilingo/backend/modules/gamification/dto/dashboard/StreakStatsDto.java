package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StreakStatsDto {
    private Integer currentStreak;
    private Integer highestStreak;
    private Integer totalLearningMinutes;
    private Long totalXp;
    private Boolean isStudiedToday;
    private LocalDate lastStudyDate;
}
