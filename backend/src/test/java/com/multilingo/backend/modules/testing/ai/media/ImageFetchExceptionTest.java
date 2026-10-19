package com.multilingo.backend.modules.testing.ai.media;
import org.junit.jupiter.api.Test;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;

class ImageFetchExceptionTest {
    @Test void everyKindHasSafeMessageNoCauseAndCorrectRetryability() {
        var retryable = Set.of("RATE_LIMITED", "UPSTREAM", "TIMEOUT", "TRANSPORT");
        assertThat(ImageFetchException.Kind.values()).hasSize(15);
        for (var kind : ImageFetchException.Kind.values()) {
            var error = new ImageFetchException(kind, 429);
            assertThat(error.isRetryable()).isEqualTo(retryable.contains(kind.name()));
            assertThat(error.getUpstreamStatus()).isEqualTo(429);
            assertThat(error.getCause()).isNull();
            assertThat(error.toString()).doesNotContain("https://", "base64");
        }
    }
}
