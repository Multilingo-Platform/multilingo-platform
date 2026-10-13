package com.multilingo.backend.modules.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamTrackingResponse {

    private Integer examId;
    private String title;
    private String code;
    private long totalAttempts;
    private long completedAttempts;
    private double completionRate;
    private Double averageScore;
}
