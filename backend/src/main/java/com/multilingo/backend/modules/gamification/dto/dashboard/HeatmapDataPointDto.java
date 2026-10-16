package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HeatmapDataPointDto {
    private LocalDate date;
    private Integer learningMinutes;
    private Integer flashcardsReviewed;
    private Integer practiceQuestions;
    private Integer xpEarned;
    private Integer level;
}
