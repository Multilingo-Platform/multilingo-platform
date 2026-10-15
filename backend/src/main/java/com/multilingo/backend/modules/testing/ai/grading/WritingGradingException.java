package com.multilingo.backend.modules.testing.ai.grading;

/**
 * Exception thrown when writing grading fails, wrapping a safe {@link WritingGradingFailure}.
 */
public class WritingGradingException extends RuntimeException {

    private final WritingGradingFailure failure;

    public WritingGradingException(WritingGradingFailure failure) {
        super(failure != null ? failure.safeMessage() : "Writing grading failed");
        this.failure = failure;
    }

    public WritingGradingException(WritingGradingFailure failure, Throwable cause) {
        super(failure != null ? failure.safeMessage() : "Writing grading failed", cause);
        this.failure = failure;
    }

    public WritingGradingFailure getFailure() {
        return failure;
    }
}
