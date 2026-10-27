package com.multilingo.backend.modules.testing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentHistoryItemResponse {
    private Integer attemptId;
    private Integer examId;
    private String examCode;
    private String examTitle;
    private String examType;
    private String examLanguage;
    private Boolean isExamDeleted;
    private String testMode;
    private String testScope;
    private String status;
    private Instant startTime;
    private Instant endTime;
    private Integer timeSpentSeconds;
    private Integer durationMinutes;
    private Double overallScore;
    private Double maxScore;
    private Double targetScore;
    private Boolean targetAchieved;
    private Boolean passed;
    private Double accuracyPercentage;
}
