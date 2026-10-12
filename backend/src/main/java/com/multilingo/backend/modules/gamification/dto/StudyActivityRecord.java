package com.multilingo.backend.modules.gamification.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StudyActivityRecord {
    private final Integer userId;
    private final Integer studyMinutes;
    private final Integer cardsReviewed;
    private final Integer xpEarned;
    private final String activityType;
    private final Integer questionsAnswered;
    private final Integer correctAnswers;
    private final Boolean qualifiesForStreak;
}
