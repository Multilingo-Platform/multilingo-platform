package com.multilingo.backend.modules.analytics.adapter.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserStudyStatInfo {
    private Integer userId;
    private int currentStreak;
    private int highestStreak;
    private int totalLearningMinutes;
    private long totalXp;
}
