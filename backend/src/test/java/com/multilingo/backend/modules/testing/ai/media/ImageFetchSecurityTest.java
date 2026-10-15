package com.multilingo.backend.modules.testing.ai.media;

import com.multilingo.backend.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.*;
import java.util.Map;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(OutputCaptureExtension.class)
class ImageFetchSecurityTest {
    @Test void productionFailuresThroughHandlerDoNotLeakUrlBodyOrCause(CapturedOutput output) throws Exception {
        var handler = new GlobalExceptionHandler();
        for (boolean transportError : new boolean[]{false,true}) {
            try (var fixture = new HttpImageFetcherTest.Fixture()) {
                if (transportError) {
                    when(fixture.http.sendAsync(any(), any())).thenThrow(new IllegalArgumentException("SECRET_SIGNED_URL"));
                } else fixture.reply(403, Map.of(), "SECRET_IMAGE_ERROR_BODY".getBytes(), false);
                try {
                    fixture.fetcher().fetch("https://cdn.example.test/cloud/image.png?signature=SECRET_SIGNED_URL");
                    throw new AssertionError("Expected failure");
                } catch (ImageFetchException error) {
                    assertThat(error.getCause()).isNull();
                    var trace = new java.io.StringWriter();
                    error.printStackTrace(new java.io.PrintWriter(trace));
                    assertThat(trace.toString()).doesNotContain("SECRET_SIGNED_URL", "SECRET_IMAGE_ERROR_BODY");
                    assertThat(handler.handleAppException(error).getBody().getMessage())
                            .doesNotContain("SECRET_SIGNED_URL", "SECRET_IMAGE_ERROR_BODY");
                }
            }
        }
        assertThat(output.getAll()).doesNotContain("SECRET_SIGNED_URL", "SECRET_IMAGE_ERROR_BODY");
    }
}
