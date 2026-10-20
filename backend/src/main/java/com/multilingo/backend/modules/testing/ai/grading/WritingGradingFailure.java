package com.multilingo.backend.modules.testing.ai.grading;

/**
 * Safe failure descriptor for writing grading workflows.
 * Used to classify retryable vs. terminal errors and prevent leaking internal secrets.
 */
public record WritingGradingFailure(
        String errorCode,
        String safeMessage,
        boolean isRetryable,
        boolean isWaiting,
        TerminalDestination destination
) {
    public enum TerminalDestination {
        NONE,
        FAILED,
        UNAVAILABLE
    }

    public WritingGradingFailure {
        if (errorCode == null || errorCode.isBlank()) {
            throw new IllegalArgumentException("errorCode must not be null or blank");
        }
        if (safeMessage == null || safeMessage.isBlank()) {
            safeMessage = "Grading operation failed: " + errorCode;
        }
        if (destination == null) {
            destination = isRetryable || isWaiting ? TerminalDestination.NONE : TerminalDestination.FAILED;
        }
    }

    public WritingGradingFailure(String errorCode, String safeMessage, boolean isRetryable, boolean isWaiting) {
        this(errorCode, safeMessage, isRetryable, isWaiting,
                (isRetryable || isWaiting) ? TerminalDestination.NONE : TerminalDestination.FAILED);
    }

    public static WritingGradingFailure retryable(String errorCode, String safeMessage) {
        return new WritingGradingFailure(errorCode, safeMessage, true, false, TerminalDestination.NONE);
    }

    public static WritingGradingFailure terminal(String errorCode, String safeMessage) {
        return new WritingGradingFailure(errorCode, safeMessage, false, false, TerminalDestination.FAILED);
    }

    public static WritingGradingFailure unavailable(String errorCode, String safeMessage) {
        return new WritingGradingFailure(errorCode, safeMessage, false, false, TerminalDestination.UNAVAILABLE);
    }

    public static WritingGradingFailure waiting(String errorCode, String safeMessage) {
        return new WritingGradingFailure(errorCode, safeMessage, false, true, TerminalDestination.NONE);
    }

    public boolean isTerminal() {
        return destination == TerminalDestination.FAILED;
    }

    public boolean isUnavailable() {
        return destination == TerminalDestination.UNAVAILABLE;
    }

    @Override
    public String toString() {
        return "WritingGradingFailure[errorCode=" + errorCode
                + ", isRetryable=" + isRetryable
                + ", isWaiting=" + isWaiting
                + ", destination=" + destination + "]";
    }
}
