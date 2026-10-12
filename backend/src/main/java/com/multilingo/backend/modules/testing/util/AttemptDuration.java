package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.modules.testing.entity.TestAttempt;

import java.time.Duration;
import java.time.Instant;

public final class AttemptDuration {

    private AttemptDuration() {
    }

    public static Integer calculateSeconds(Instant startTime, Instant endTime) {
        if (startTime == null || endTime == null) {
            return null;
        }
        long seconds = Duration.between(startTime, endTime).getSeconds();
        if (seconds < 0) {
            return 0;
        }
        if (seconds > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) seconds;
    }

    public static Integer resolveDuration(TestAttempt attempt) {
        if (attempt == null) {
            return null;
        }
        if (attempt.getStartTime() != null && attempt.getEndTime() != null) {
            return calculateSeconds(attempt.getStartTime(), attempt.getEndTime());
        }
        Integer stored = attempt.getTimeSpentSeconds();
        if (stored != null && stored >= 0) {
            return stored;
        }
        return null;
    }
}
