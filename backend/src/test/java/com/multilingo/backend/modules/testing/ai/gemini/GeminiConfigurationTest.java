package com.multilingo.backend.modules.testing.ai.gemini;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.http.HttpClient;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(OutputCaptureExtension.class)
class GeminiConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(GeminiConfiguration.class);

    @Test
    @DisplayName("Disabled by default: starts context, provides Disabled GeminiClient, creates no HttpClient")
    void disabledByDefaultStartsContextSafely() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(GeminiClient.class);
            assertThat(context).hasSingleBean(GeminiPayloadCodec.class);
            assertThat(context).doesNotHaveBean(HttpClient.class);

            GeminiClient client = context.getBean(GeminiClient.class);
            GeminiGenerationRequest request = new GeminiGenerationRequest(
                    null,
                    "User prompt",
                    1024,
                    GeminiGenerationRequest.OutputFormat.TEXT
            );

            assertThatThrownBy(() -> client.generate(request))
                    .isInstanceOf(GeminiClientException.class)
                    .satisfies(e -> {
                        GeminiClientException ex = (GeminiClientException) e;
                        assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.DISABLED);
                        assertThat(ex.isRetryable()).isFalse();
                    });
        });
    }

    @Test
    @DisplayName("Explicitly disabled: starts context even if api-key and model are missing")
    void explicitlyDisabledStartsContextSafely() {
        contextRunner
                .withPropertyValues("testing.gemini.enabled=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(GeminiClient.class);
                    assertThat(context).doesNotHaveBean(HttpClient.class);

                    GeminiClient client = context.getBean(GeminiClient.class);
                    GeminiGenerationRequest request = new GeminiGenerationRequest(
                            null,
                            "User prompt",
                            1024,
                            GeminiGenerationRequest.OutputFormat.TEXT
                    );

                    assertThatThrownBy(() -> client.generate(request))
                            .isInstanceOf(GeminiClientException.class)
                            .satisfies(e -> {
                                GeminiClientException ex = (GeminiClientException) e;
                                assertThat(ex.getKind()).isEqualTo(GeminiClientException.Kind.DISABLED);
                            });
                });
    }

    @Test
    @DisplayName("Enabled with valid configuration: creates singleton HttpGeminiClient and HttpClient with Redirect.NEVER")
    void enabledWithValidConfigCreatesHttpClientAndHttpGeminiClient() {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=test-secret-api-key",
                        "testing.gemini.model=gemini-1.5-flash",
                        "testing.gemini.connect-timeout=3s",
                        "testing.gemini.request-timeout=15s"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(GeminiClient.class);
                    assertThat(context).hasSingleBean(HttpClient.class);
                    assertThat(context).hasSingleBean(GeminiPayloadCodec.class);

                    GeminiClient client = context.getBean(GeminiClient.class);
                    assertThat(client).isInstanceOf(HttpGeminiClient.class);

                    HttpClient httpClient = context.getBean(HttpClient.class);
                    assertThat(httpClient.followRedirects()).isEqualTo(HttpClient.Redirect.NEVER);
                    assertThat(httpClient.connectTimeout()).hasValue(Duration.ofSeconds(3));
                });
    }

    @Test
    @DisplayName("Enabled without API key: fails fast during context startup with IllegalStateException")
    void enabledWithoutApiKeyFailsStartup() {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.model=gemini-1.5-flash"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasRootCauseMessage("Gemini API key must be configured when Gemini is enabled");
                });
    }

    @Test
    @DisplayName("Enabled without model: fails fast during context startup with IllegalStateException")
    void enabledWithoutModelFailsStartup() {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=test-secret-api-key"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasRootCauseMessage("Gemini model must be configured when Gemini is enabled");
                });
    }

    @Test
    @DisplayName("Enabled with invalid model: fails fast during context startup")
    void enabledWithInvalidModelFailsStartup() {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=test-secret-api-key",
                        "testing.gemini.model=models/gemini-1.5-flash"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class);
                });
    }

    @Test
    @DisplayName("Enabled with invalid timeout (connect > request): fails fast during context startup")
    void enabledWithInvalidTimeoutsFailsStartup() {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=test-secret-api-key",
                        "testing.gemini.model=gemini-1.5-flash",
                        "testing.gemini.connect-timeout=20s",
                        "testing.gemini.request-timeout=10s"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class);
                });
    }

    @Test
    @DisplayName("Enabled with non-ASCII or whitespace apiKey fails fast during startup without leaking sentinel")
    void enabledWithNonAsciiApiKeyFailsStartupSafely(CapturedOutput output) {
        String sentinelKey = "SENTINEL_NON_ASCII_KEY_\u0100";
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=" + sentinelKey,
                        "testing.gemini.model=gemini-1.5-flash"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasRootCauseMessage("Gemini API key must not contain whitespace, control, or non-ASCII characters");

                    Throwable rootCause = context.getStartupFailure().getCause();
                    assertThat(rootCause.getMessage()).doesNotContain("SENTINEL_NON_ASCII_KEY");

                    StringWriter sw = new StringWriter();
                    context.getStartupFailure().printStackTrace(new PrintWriter(sw));
                    assertThat(sw.toString()).doesNotContain("SENTINEL_NON_ASCII_KEY");
                    assertThat(output.getAll()).doesNotContain("SENTINEL_NON_ASCII_KEY");
                });
    }

    @Test
    @DisplayName("Context shutdown closes HttpClient cleanly without reflection warning")
    void contextShutdownClosesHttpClientWithoutWarnings(CapturedOutput output) {
        contextRunner
                .withPropertyValues(
                        "testing.gemini.enabled=true",
                        "testing.gemini.api-key=test-secret-api-key",
                        "testing.gemini.model=gemini-1.5-flash"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    HttpClient httpClient = context.getBean(HttpClient.class);
                    assertThat(httpClient).isNotNull();
                    context.close();
                    assertThat(output.getAll()).doesNotContain("Failed to invoke custom destroy method");
                    assertThat(output.getAll()).doesNotContain("IllegalAccessException");
                });
    }
}
