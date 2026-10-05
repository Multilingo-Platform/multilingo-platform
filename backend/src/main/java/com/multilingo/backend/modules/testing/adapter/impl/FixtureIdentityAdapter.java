package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fixture identity adapter for dev/test profile.
 * Returns hardcoded userId=1 to simulate an authenticated student.
 *
 * TODO: Remove @Profile("dev","test") and this bean when TV1 JWT is ready.
 *       Replace with JwtIdentityAdapter that extracts userId from SecurityContextHolder.
 */
@Component
@Profile("test")
public class FixtureIdentityAdapter implements IdentityAdapter {

    @Override
    public Integer getCurrentUserId() {
        return 1;
    }
}
