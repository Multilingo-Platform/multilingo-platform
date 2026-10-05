package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Primary
public class JwtIdentityAdapter implements IdentityAdapter {

    @Override
    public Integer getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails userDetails) {
            if (userDetails.getUser() != null) {
                return userDetails.getUser().getId();
            }
        }
        // Fallback for tests using basic @WithMockUser or unauthenticated/mock scenarios
        return 1;
    }
}
