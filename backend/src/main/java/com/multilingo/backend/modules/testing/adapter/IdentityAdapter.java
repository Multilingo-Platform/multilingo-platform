package com.multilingo.backend.modules.testing.adapter;

/**
 * Adapter interface for getting current authenticated user.
 * In dev/test profile: returns hardcoded userId=1 (FixtureIdentityAdapter).
 * In production: will extract userId from Spring Security context (TV1's JWT).
 *
 * TODO: Replace FixtureIdentityAdapter with JwtIdentityAdapter when TV1 JWT is ready.
 */
public interface IdentityAdapter {
    Integer getCurrentUserId();
}
