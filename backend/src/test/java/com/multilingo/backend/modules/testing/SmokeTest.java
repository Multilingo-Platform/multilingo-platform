package com.multilingo.backend.modules.testing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SmokeTest {

    @Test
    @DisplayName("Testing module context loads with H2 test database")
    void contextLoads() {
        assertThat(true).isTrue();
    }
}
