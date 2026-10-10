package com.multilingo.backend.modules.testing.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamResultResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private TestScope testScope;
    private TestMode testMode;
    private Instant startTime;
    private Instant endTime;
    private Integer timeSpentSeconds;
    private BigDecimal overallScore;

    @JsonProperty("summaryAvailable")
    private boolean summaryAvailable;

    private ResultSummaryResponse resultSummary;
}
