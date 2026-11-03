package com.multilingo.backend.modules.testing.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AttemptDurationPolicyTest {

    @Test
    void acceptsOnlyCustomDurationsFromOneThroughThreeHundredSixtyMinutes() {
        assertTrue(AttemptDurationPolicy.isValidCustomDuration(null));
        assertTrue(AttemptDurationPolicy.isValidCustomDuration(1));
        assertTrue(AttemptDurationPolicy.isValidCustomDuration(360));
        assertFalse(AttemptDurationPolicy.isValidCustomDuration(0));
        assertFalse(AttemptDurationPolicy.isValidCustomDuration(361));
    }

    @Test
    void resolvesCustomDurationBeforeExistingConfiguredDefault() {
        assertEquals(25, AttemptDurationPolicy.resolveScopedDuration(25, null));
        assertEquals(75, AttemptDurationPolicy.resolveScopedDuration(25, 75));
        assertNull(AttemptDurationPolicy.resolveScopedDuration(null, null));
    }
}
