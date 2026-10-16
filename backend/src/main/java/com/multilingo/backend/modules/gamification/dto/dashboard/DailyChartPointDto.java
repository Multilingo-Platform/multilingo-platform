package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyChartPointDto {
    private LocalDate date;
    private String label;
    private Integer learningMinutes;
    private Integer questionsAnswered;
}
