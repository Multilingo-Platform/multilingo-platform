package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecentExamScoreDto {
    Integer attemptId;
    String examTitle;
    Double score;
    Double maxScore;
    Double percentage;
    LocalDateTime completedAt;
}
