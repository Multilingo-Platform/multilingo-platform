package com.multilingo.backend.modules.auth.security;

import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderRoleTest {

    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", "ThisIsAVeryLongSecretKeyForTestingHS256AlgorithmMustBe32BytesLong");
        ReflectionTestUtils.setField(tokenProvider, "jwtExpirationInMs", 3600000L);
    }

    @Test
    @DisplayName("generateToken phải chứa claim role và userId")
    void generateToken_ShouldContainRoleAndUserIdClaims() {
        Role adminRole = Role.builder().name("ADMIN").build();
        User admin = User.builder()
                .email("admin@multilingo.com")
                .role(adminRole)
                .build();
        ReflectionTestUtils.setField(admin, "id", 99);

        String token = tokenProvider.generateToken(admin);

        assertNotNull(token);
        assertEquals("admin@multilingo.com", tokenProvider.getEmailFromJWT(token));
        assertEquals("ADMIN", tokenProvider.getRoleFromJWT(token));
        assertEquals(99, tokenProvider.getUserIdFromJWT(token));
    }

    @Test
    @DisplayName("generateToken fallback role USER nếu user không có role")
    void generateToken_ShouldFallbackToUserRoleIfNull() {
        User userWithoutRole = User.builder()
                .email("norole@multilingo.com")
                .role(null)
                .build();

        String token = tokenProvider.generateToken(userWithoutRole);

        assertEquals("USER", tokenProvider.getRoleFromJWT(token));
    }
}
