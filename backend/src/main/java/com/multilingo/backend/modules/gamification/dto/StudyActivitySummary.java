package com.multilingo.backend.modules.gamification.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StudyActivitySummary {
    private final Integer currentStreak;
    private final Integer streakIncrement;
    private final Integer highestStreak;
    private final Integer totalLearningMinutes;
    private final Integer dailyLearningMinutes;
    private final Integer dailyFlashcardsReviewed;
    private final boolean streakExtended;
}
