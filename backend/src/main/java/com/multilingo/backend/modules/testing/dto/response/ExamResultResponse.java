package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
public class ExamResultResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private TestScope testScope;
    private TestMode testMode;
    private Instant startTime;
    private Instant endTime;
    private Integer timeSpentSeconds;
    private BigDecimal overallScore;
    
    // Parsed from JSON string in TestAttempt.resultSummary
    private Map<String, Object> resultSummary;
}
