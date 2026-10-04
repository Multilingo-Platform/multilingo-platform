package com.multilingo.backend.modules.auth.security;

import com.multilingo.backend.modules.auth.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(jwtTokenProvider, "jwtSecret", "mySecretKeyThatMustBeAtLeast32BytesLongForHS256ToWork");
        ReflectionTestUtils.setField(jwtTokenProvider, "jwtExpirationInMs", 3600000L);
    }

    @Test
    void testGenerateAndValidateToken() {
        User user = User.builder()
                .email("test@example.com")
                .build();
        
        user.setId(1); // Assuming BaseEntity provides setId

        String token = jwtTokenProvider.generateToken(user);
        
        assertNotNull(token);
        assertTrue(jwtTokenProvider.validateToken(token));
        assertEquals("test@example.com", jwtTokenProvider.getEmailFromJWT(token));
    }
}
