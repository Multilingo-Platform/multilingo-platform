package com.multilingo.backend.modules.testing.ai.gemini;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Constructor;
import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiContractTest {

    @Test
    void legacyRequestReportsZeroImagesWithoutRevealingText() {
        var request = new GeminiGenerationRequest("SECRET_SYSTEM", "SECRET_USER", 32,
                GeminiGenerationRequest.OutputFormat.TEXT);
        assertThat(request.toString()).contains("imageCount=0")
                .doesNotContain("SECRET_SYSTEM", "SECRET_USER");
    }

    @Test
    @DisplayName("GeminiProperties.validate() rejects rejected key without leaking sentinel in message or stack trace (P2)")
    void validateRejectedConfigNeverLeaksSentinel() {
        String sentinelApiKey = "REJECTED_SECRET_API_KEY_WITH_TRAILING_WHITESPACE ";
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey(sentinelApiKey);
        properties.setModel("gemini-1.5-flash");

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain(sentinelApiKey);
                    assertThat(e.toString()).doesNotContain(sentinelApiKey);

                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain(sentinelApiKey);
                    assertThat(e.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("GeminiPayloadCodec.decode() rejects malformed provider body without leaking sentinel in message or stack trace (P2)")
    void decodeMalformedProviderBodyNeverLeaksSentinel() {
        String sentinelSecret = "MALFORMED_PROVIDER_BODY_SENTINEL_TOKEN_SECRET";
        String malformedJsonWithSentinel = "{\"candidates\": [{\"secret\": \"" + sentinelSecret + "\", \"broken...";

        GeminiPayloadCodec codec = new GeminiPayloadCodec();
        assertThatThrownBy(() -> codec.decode(malformedJsonWithSentinel.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE);
                    assertThat(ex.getMessage()).doesNotContain(sentinelSecret);
                    assertThat(ex.toString()).doesNotContain(sentinelSecret);

                    StringWriter sw = new StringWriter();
                    ex.printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain(sentinelSecret);
                    assertThat(ex.getCause()).isNull();
                });
    }

    @Test
    @DisplayName("GeminiGenerationRequest rejects null or blank userText")
    void requestRejectsNullOrBlankUserText() {
        assertThatThrownBy(() -> new GeminiGenerationRequest(
                "system instruction",
                null,
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        )).isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                    assertThat(ex.isRetryable()).isFalse();
                });

        assertThatThrownBy(() -> new GeminiGenerationRequest(
                "system instruction",
                "   ",
                1024,
                GeminiGenerationRequest.OutputFormat.TEXT
        )).isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                });
    }

    @Test
    @DisplayName("GeminiGenerationRequest rejects null outputFormat")
    void requestRejectsNullOutputFormat() {
        assertThatThrownBy(() -> new GeminiGenerationRequest(
                "system instruction",
                "Valid user text",
                1024,
                null
        )).isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                });
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 8193, 10000})
    @DisplayName("GeminiGenerationRequest rejects maxOutputTokens outside [1, 8192]")
    void requestRejectsInvalidMaxOutputTokens(int invalidTokens) {
        assertThatThrownBy(() -> new GeminiGenerationRequest(
                "system instruction",
                "Valid user text",
                invalidTokens,
                GeminiGenerationRequest.OutputFormat.JSON
        )).isInstanceOf(GeminiClientException.class)
                .satisfies(e -> {
                    GeminiClientException ex = (GeminiClientException) e;
                    assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.INVALID_INPUT);
                });
    }

    @Test
    @DisplayName("GeminiGenerationRequest accepts boundary maxOutputTokens [1, 8192] and nullable systemInstruction")
    void requestAcceptsValidBoundaries() {
        assertThatCode(() -> new GeminiGenerationRequest(
                null,
                "Valid user text",
                1,
                GeminiGenerationRequest.OutputFormat.TEXT
        )).doesNotThrowAnyException();

        assertThatCode(() -> new GeminiGenerationRequest(
                "Some system prompt",
                "Valid user text",
                8192,
                GeminiGenerationRequest.OutputFormat.JSON
        )).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("GeminiGenerationRequest.toString() never prints userText or systemInstruction")
    void requestToStringDoesNotLeakPrompts() {
        String secretPrompt = "SUPER_SECRET_SYSTEM_PROMPT_12345";
        String secretEssay = "SUPER_SECRET_USER_ESSAY_67890";

        GeminiGenerationRequest request = new GeminiGenerationRequest(
                secretPrompt,
                secretEssay,
                1024,
                GeminiGenerationRequest.OutputFormat.JSON
        );

        String str = request.toString();
        assertThat(str).doesNotContain(secretPrompt);
        assertThat(str).doesNotContain(secretEssay);
        assertThat(str).contains("1024");
        assertThat(str).contains("JSON");
    }

    @Test
    @DisplayName("GeminiGenerationResult.toString() never prints output text")
    void resultToStringDoesNotLeakOutput() {
        String secretOutput = "SUPER_SECRET_MODEL_OUTPUT_ABCDE";
        GeminiGenerationResult result = new GeminiGenerationResult(
                secretOutput,
                new GeminiGenerationResult.Usage(100, 50, 150)
        );

        String str = result.toString();
        assertThat(str).doesNotContain(secretOutput);
        assertThat(str).contains("100");
        assertThat(str).contains("50");
        assertThat(str).contains("150");
    }

    @Test
    @DisplayName("GeminiGenerationResult.Usage rejects negative token counts")
    void usageRejectsNegativeCounts() {
        assertThatThrownBy(() -> new GeminiGenerationResult.Usage(-1, 10, 20))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        assertThatThrownBy(() -> new GeminiGenerationResult.Usage(10, -1, 20))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        assertThatThrownBy(() -> new GeminiGenerationResult.Usage(10, 20, -1))
                .isInstanceOf(GeminiClientException.class)
                .satisfies(e -> assertThat(((GeminiClientException) e).getKind())
                        .isEqualTo(GeminiClientException.Kind.INVALID_RESPONSE));

        // Null token counts are allowed when provider does not report them
        assertThatCode(() -> new GeminiGenerationResult.Usage(null, null, null))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("GeminiClientException extends AppException with UNCATEGORIZED_EXCEPTION")
    void exceptionContract() {
        GeminiClientException ex = new GeminiClientException(
                GeminiClientException.Kind.AUTHENTICATION,
                "Authentication failed with upstream Gemini provider",
                401
        );

        assertThat(ex).isInstanceOf(AppException.class);
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNCATEGORIZED_EXCEPTION);
        assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.AUTHENTICATION);
        assertThat(ex.isRetryable()).isFalse();
        assertThat(ex.getUpstreamStatus()).isEqualTo(401);
        assertThat(ex.getCause()).isNull();
    }

    @Test
    @DisplayName("GeminiClientException has no constructor accepting Throwable cause to prevent leaking raw cause")
    void exceptionHasNoThrowableCauseConstructor() {
        Constructor<?>[] constructors = GeminiClientException.class.getDeclaredConstructors();
        for (Constructor<?> constructor : constructors) {
            boolean hasThrowable = Arrays.stream(constructor.getParameterTypes())
                    .anyMatch(Throwable.class::isAssignableFrom);
            assertThat(hasThrowable)
                    .as("Constructor %s should not accept Throwable", constructor)
                    .isFalse();
        }
    }

    @Test
    @DisplayName("GeminiClientException does not expose sensitive strings in toString()")
    void exceptionToStringSafe() {
        GeminiClientException ex = new GeminiClientException(
                GeminiClientException.Kind.TIMEOUT,
                "Request timed out after deadline",
                408
        );

        String str = ex.toString();
        assertThat(str).contains("TIMEOUT");
        assertThat(str).contains("true"); // retryable
        assertThat(str).contains("408");
    }

    @ParameterizedTest
    @EnumSource(GeminiClientException.Kind.class)
    @DisplayName("All 14 GeminiClientException.Kind correctly map retryability")
    void allKindsRetryabilityMapping(GeminiClientException.Kind kind) {
        Set<GeminiClientException.Kind> expectedRetryable = Set.of(
                GeminiClientException.Kind.RATE_LIMITED,
                GeminiClientException.Kind.TIMEOUT,
                GeminiClientException.Kind.TRANSPORT,
                GeminiClientException.Kind.UPSTREAM
        );

        GeminiClientException ex = new GeminiClientException(kind, "Safe message for kind: " + kind);
        if (expectedRetryable.contains(kind)) {
            assertThat(ex.isRetryable())
                    .as("Kind %s should be retryable", kind)
                    .isTrue();
        } else {
            assertThat(ex.isRetryable())
                    .as("Kind %s should NOT be retryable", kind)
                    .isFalse();
        }
    }

    @Test
    @DisplayName("Kind enum has exactly the 14 specified kinds")
    void exactFourteenKinds() {
        assertThat(GeminiClientException.Kind.values()).hasSize(14);
        assertThat(GeminiClientException.Kind.values()).containsExactlyInAnyOrder(
                GeminiClientException.Kind.DISABLED,
                GeminiClientException.Kind.INVALID_INPUT,
                GeminiClientException.Kind.AUTHENTICATION,
                GeminiClientException.Kind.PROVIDER_REQUEST_REJECTED,
                GeminiClientException.Kind.RATE_LIMITED,
                GeminiClientException.Kind.TIMEOUT,
                GeminiClientException.Kind.TRANSPORT,
                GeminiClientException.Kind.UPSTREAM,
                GeminiClientException.Kind.INTERRUPTED,
                GeminiClientException.Kind.REDIRECT_REJECTED,
                GeminiClientException.Kind.BLOCKED,
                GeminiClientException.Kind.INCOMPLETE,
                GeminiClientException.Kind.INVALID_RESPONSE,
                GeminiClientException.Kind.RESPONSE_TOO_LARGE
        );
    }
}
