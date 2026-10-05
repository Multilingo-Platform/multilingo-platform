package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.adapter.impl.JwtIdentityAdapter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtIdentityAdapterTest {

    private JwtIdentityAdapter adapter;

    @BeforeEach
    void setUp() {
        adapter = new JwtIdentityAdapter();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getCurrentUserId_whenAuthenticatedWithCustomUserDetails_returnsUserId() {
        User user = new User();
        user.setId(42);
        user.setEmail("test@example.com");

        CustomUserDetails userDetails = new CustomUserDetails(user);
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        Integer userId = adapter.getCurrentUserId();

        assertEquals(42, userId);
    }

    @Test
    void getCurrentUserId_whenNotAuthenticated_throwsAppException() {
        SecurityContextHolder.clearContext();

        assertThrows(AppException.class, () -> adapter.getCurrentUserId());
    }

    @Test
    void getCurrentUserId_whenPrincipalIsNotCustomUserDetails_throwsAppException() {
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken("plainStringPrincipal", null);
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertThrows(AppException.class, () -> adapter.getCurrentUserId());
    }
}
