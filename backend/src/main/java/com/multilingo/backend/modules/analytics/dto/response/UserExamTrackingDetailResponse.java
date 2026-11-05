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
public class UserExamTrackingDetailResponse {
    private Integer userId;
    private String fullName;
    private String email;
    private String subscriptionTier;
    private long totalExamsAttempted;
    private Double averageScore;
    private List<UserExamSummaryDto> examSummaries;
    private List<UserAttemptDetailDto> attempts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserExamSummaryDto {
        private Integer examId;
        private String examCode;
        private String examTitle;
        private String examType;
        private long attemptCount;
        private Double highestScore;
        private Double latestScore;
        private Instant latestAttemptAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserAttemptDetailDto {
        private Integer attemptId;
        private Integer examId;
        private String examCode;
        private String examTitle;
        private String testMode;
        private String testScope;
        private String status;
        private Instant startTime;
        private Instant endTime;
        private Integer timeSpentSeconds;
        private Double overallScore;
        private String scoreUnit;
    }
}

