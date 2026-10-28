package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class GoalProgressDto {
    String targetCertificate;
    Double targetScore;
    Double recentAverageScore;
    Integer progressPercent;
    Integer recentExamCount;
    List<RecentExamScoreDto> recentScores;
}
