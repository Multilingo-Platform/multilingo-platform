package com.multilingo.backend.modules.testing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentHistoryStatsResponse {
    private long totalAttempts;
    private long completedAttempts;
    private long inProgressAttempts;
    private long failedAttempts;
    private Double averageScore;
    private Double highestScore;
    private long totalPracticeMinutes;
    private int currentStreak;
    private long targetAchievedCount;
    private List<RecentScoreTrendItem> recentScoreTrends;
}
