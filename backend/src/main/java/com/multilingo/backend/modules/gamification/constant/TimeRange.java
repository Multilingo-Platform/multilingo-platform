package com.multilingo.backend.modules.gamification.constant;

public enum TimeRange {
    THIS_WEEK,
    THIS_MONTH,
    ALL;

    public static TimeRange fromString(String value) {
        if (value == null || value.isBlank()) {
            return THIS_WEEK;
        }
        try {
            return TimeRange.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return THIS_WEEK;
        }
    }
}
