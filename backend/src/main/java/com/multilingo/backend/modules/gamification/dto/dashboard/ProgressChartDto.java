package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProgressChartDto {
    private String timeRange;
    private List<DailyChartPointDto> dataPoints;
}
