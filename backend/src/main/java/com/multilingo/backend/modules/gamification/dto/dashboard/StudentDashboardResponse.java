package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentDashboardResponse {
    private Boolean isNewUser;
    private UserProfileSummary userProfile;
    private StreakStatsDto streak;
    private ExamStatsDto examStats;
    private VocabStatsDto vocabStats;
    private ActivityHeatmapDto activityHeatmap;
    private ProgressChartDto progressChart;
    private List<SuggestedActionDto> suggestedActions;
}
