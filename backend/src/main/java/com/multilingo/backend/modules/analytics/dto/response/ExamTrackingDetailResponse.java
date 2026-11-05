package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamTrackingDetailResponse {
    private Integer examId;
    private String code;
    private String title;
    private String type;
    private Integer durationMinutes;
    private long totalAttempts;
    private long completedAttempts;
    private double completionRate;
    private Double averageScore;
    private List<ExamAttemptUserDto> attempts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExamAttemptUserDto {
        private Integer attemptId;
        private Integer userId;
        private String fullName;
        private String email;
        private String subscriptionTier;
        private int attemptNumber;
        private String testMode;
        private String status;
        private Instant startTime;
        private Instant endTime;
        private Integer timeSpentSeconds;
        private Double overallScore;
        private String scoreUnit;
    }
}

