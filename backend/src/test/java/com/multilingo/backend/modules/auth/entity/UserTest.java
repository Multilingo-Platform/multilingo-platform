package com.multilingo.backend.modules.auth.entity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class UserTest {
    @Test
    void userShouldHaveEnumSubscriptionTier() {
        User user = new User();
        user.setSubscriptionTier(SubscriptionTier.PREMIUM);
        assertEquals(SubscriptionTier.PREMIUM, user.getSubscriptionTier());
    }
}
