package com.multilingo.backend.modules.testing.entity.enums;

public enum WritingGradingJobStatus {
    READY,
    RUNNING,
    SUCCEEDED,
    RETRY_WAIT,
    FAILED,
    UNAVAILABLE,
    WAITING;

    public boolean isTerminal() {
        return this == SUCCEEDED || this == FAILED || this == UNAVAILABLE;
    }

    public boolean isPending() {
        return this == READY || this == RUNNING || this == RETRY_WAIT || this == WAITING;
    }

    public boolean isWaiting() {
        return this == WAITING;
    }
}
