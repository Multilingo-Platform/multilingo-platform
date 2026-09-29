package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.Map;

/**
 * Safe workspace response — returned to client after creating or reading an attempt.
 * SECURITY CONSTRAINT: This DTO must NEVER contain correct_answer, explanation, or ai_feedback.
 * Those fields are only accessible via the result endpoint after submission.
 */
@Data
@Builder
public class WorkspaceResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private TestScope testScope;
    private TestMode testMode;
    private Instant startTime;
    /** null for PRACTICE mode */
    private Instant deadline;
    /**
     * Server-side snapshot of exam at attempt creation time.
     * Contains questions and options, but NOT correct_answer or explanation.
     */
    private Map<String, Object> examSnapshot;
}
