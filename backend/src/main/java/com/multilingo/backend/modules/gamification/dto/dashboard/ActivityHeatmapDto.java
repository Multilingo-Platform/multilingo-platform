package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityHeatmapDto {
    private Integer year;
    private Integer totalActiveDays;
    private Integer longestStreak;
    private List<HeatmapDataPointDto> dataPoints;
}
