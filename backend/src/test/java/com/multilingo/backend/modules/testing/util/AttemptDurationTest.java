package com.multilingo.backend.modules.testing.util;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class AttemptDurationTest {

    @Test
    @DisplayName("Should calculate floor seconds between start and end time")
    void calculateSeconds_normalDuration() {
        Instant start = Instant.parse("2026-10-10T10:00:00.000Z");
        Instant end = Instant.parse("2026-10-10T10:01:15.800Z");

        Integer seconds = AttemptDuration.calculateSeconds(start, end);

        assertThat(seconds).isEqualTo(75);
    }

    @Test
    @DisplayName("Should clamp clock skew (end before start) to 0")
    void calculateSeconds_clockSkew_clampedToZero() {
        Instant start = Instant.parse("2026-10-10T10:05:00.000Z");
        Instant end = Instant.parse("2026-10-10T10:04:00.000Z");

        Integer seconds = AttemptDuration.calculateSeconds(start, end);

        assertThat(seconds).isEqualTo(0);
    }

    @Test
    @DisplayName("Should clamp duration exceeding Integer.MAX_VALUE")
    void calculateSeconds_overflow_clampedToMaxInteger() {
        Instant start = Instant.parse("1970-01-01T00:00:00.000Z");
        Instant end = Instant.parse("2100-01-01T00:00:00.000Z");

        Integer seconds = AttemptDuration.calculateSeconds(start, end);

        assertThat(seconds).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    @DisplayName("Should return null if start or end is null")
    void calculateSeconds_nullTimestamps() {
        assertThat(AttemptDuration.calculateSeconds(null, Instant.now())).isNull();
        assertThat(AttemptDuration.calculateSeconds(Instant.now(), null)).isNull();
    }

    @Test
    @DisplayName("resolveDuration should compute from timestamps when available, or fallback to stored duration")
    void resolveDuration_fallbackLogic() {
        Instant start = Instant.parse("2026-10-10T10:00:00Z");
        Instant end = Instant.parse("2026-10-10T10:10:00Z");

        TestAttempt attemptWithTimestamps = TestAttempt.builder()
                .startTime(start)
                .endTime(end)
                .timeSpentSeconds(0) // stored was 0
                .build();
        assertThat(AttemptDuration.resolveDuration(attemptWithTimestamps)).isEqualTo(600);

        TestAttempt attemptWithoutEndTime = TestAttempt.builder()
                .startTime(start)
                .endTime(null)
                .timeSpentSeconds(120)
                .build();
        assertThat(AttemptDuration.resolveDuration(attemptWithoutEndTime)).isEqualTo(120);

        TestAttempt attemptInvalid = TestAttempt.builder()
                .startTime(null)
                .endTime(null)
                .timeSpentSeconds(-5)
                .build();
        assertThat(AttemptDuration.resolveDuration(attemptInvalid)).isNull();
    }
}
