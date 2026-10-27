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
public class RecentScoreTrendItem {
    private Integer attemptId;
    private String examTitle;
    private String certType;
    private Double score;
    private Double maxScore;
    private Double percentage;
    private Instant completedAt;
}
