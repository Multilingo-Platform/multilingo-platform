package com.multilingo.backend.modules.gamification.dto.dashboard;

import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamStatsDto {
    private Long totalExamsTaken;
    private Double averageScore;
    private String latestExamTitle;
    private Double latestExamScore;
    private Instant latestExamDate;
}
