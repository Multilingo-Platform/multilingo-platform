package com.multilingo.backend.modules.testing.service.support;

import com.multilingo.backend.modules.testing.ai.grading.WritingGradingContext;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable token and payload for an acquired grading claim.
 * Sensitive text fields (essay, prompt) are strictly excluded from {@link #toString()}.
 */
public record Claim(
        Integer jobId,
        Integer attemptId,
        Integer partId,
        String questionId,
        String runId,
        Instant leaseUntil,
        int attemptCount,
        String inputHash,
        WritingGradingContext context
) {
    public Claim {
        Objects.requireNonNull(jobId, "jobId must not be null");
        Objects.requireNonNull(attemptId, "attemptId must not be null");
        Objects.requireNonNull(partId, "partId must not be null");
        Objects.requireNonNull(questionId, "questionId must not be null");
        Objects.requireNonNull(runId, "runId must not be null");
        Objects.requireNonNull(leaseUntil, "leaseUntil must not be null");
        Objects.requireNonNull(inputHash, "inputHash must not be null");
    }

    @Override
    public String toString() {
        return "Claim[jobId=" + jobId
                + ", attemptId=" + attemptId
                + ", partId=" + partId
                + ", questionId='" + questionId + '\''
                + ", runId='" + runId + '\''
                + ", leaseUntil=" + leaseUntil
                + ", attemptCount=" + attemptCount
                + ", inputHash='" + inputHash + '\''
                + ", wordCount=" + (context != null ? context.wordCount() : 0)
                + ']';
    }
}
