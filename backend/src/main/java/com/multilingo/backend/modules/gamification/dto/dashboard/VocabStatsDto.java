package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabStatsDto {
    private Long totalWords;
    private Long masteredWords;
    private Long learningWords;
    private Double masteryRate;
    private Long dueTodayCount;
}
