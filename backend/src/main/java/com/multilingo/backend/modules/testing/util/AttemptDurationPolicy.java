package com.multilingo.backend.modules.testing.util;

/** Shared validation and precedence rules for learner-selected scoped attempt time limits. */
public final class AttemptDurationPolicy {
    public static final int MIN_CUSTOM_MINUTES = 1;
    public static final int MAX_CUSTOM_MINUTES = 360;

    private AttemptDurationPolicy() {}

    public static boolean isValidCustomDuration(Integer minutes) {
        return minutes == null || (minutes >= MIN_CUSTOM_MINUTES && minutes <= MAX_CUSTOM_MINUTES);
    }

    public static Integer resolveScopedDuration(Integer configuredDefaultMinutes, Integer customMinutes) {
        if (!isValidCustomDuration(customMinutes)) {
            throw new IllegalArgumentException("Custom attempt duration must be between 1 and 360 minutes");
        }
        return customMinutes != null ? customMinutes : configuredDefaultMinutes;
    }
}
