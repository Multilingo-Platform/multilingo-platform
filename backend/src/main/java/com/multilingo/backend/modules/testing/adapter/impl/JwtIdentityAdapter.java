package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Production identity adapter that extracts userId from JWT-authenticated SecurityContext.
 * Active only in non-test profiles; test profile uses FixtureIdentityAdapter instead.
 */
@Component
@Profile("!test")
public class JwtIdentityAdapter implements IdentityAdapter {

    @Override
    public Integer getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails) {
            if (userDetails.getUser() != null) {
                return userDetails.getUser().getId();
            }
        }
        throw new AppException(ErrorCode.UNAUTHENTICATED_ACCESS);
    }
}
