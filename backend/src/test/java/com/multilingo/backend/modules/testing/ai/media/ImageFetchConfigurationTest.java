package com.multilingo.backend.modules.testing.ai.media;

import com.multilingo.backend.modules.testing.ai.gemini.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.*;
import java.net.http.HttpClient;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(OutputCaptureExtension.class)
class ImageFetchConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ImageFetchConfiguration.class, GeminiConfiguration.class);

    @Test void disabledHasNoHttpClientOrResolverButHasBothDisabledFacades() {
        runner.run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(ImageFetcher.class).hasSingleBean(GeminiClient.class)
                    .doesNotHaveBean(HttpClient.class).doesNotHaveBean("imageFetchResolverExecutor");
            assertThatThrownBy(() -> context.getBean(ImageFetcher.class).fetch("SECRET_URL"))
                    .isInstanceOfSatisfying(ImageFetchException.class,
                            e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.DISABLED));
        });
    }

    @Test void allEnabledCombinationsSelectIndependentNamedTransportsAndCloseCleanly() {
        for (boolean image : new boolean[]{false,true}) {
            for (boolean gemini : new boolean[]{false,true}) {
                runner.withPropertyValues("testing.image-fetch.enabled=" + image,
                        "testing.image-fetch.allowed-url-prefixes=https://cdn.example.test/cloud/",
                        "testing.gemini.enabled=" + gemini, "testing.gemini.api-key=TEST_KEY_NOT_REAL",
                        "testing.gemini.model=test-model").run(context -> {
                    assertThat(context).hasNotFailed().hasSingleBean(ImageFetcher.class).hasSingleBean(GeminiClient.class);
                    assertThat(context.getBeansOfType(HttpClient.class)).hasSize((image ? 1 : 0) + (gemini ? 1 : 0));
                    if (image) {
                        var client = context.getBean("imageFetchHttpClient", HttpClient.class);
                        assertThat(client.followRedirects()).isEqualTo(HttpClient.Redirect.NEVER);
                        assertThat(client.cookieHandler()).isEmpty();
                        assertThat(client.authenticator()).isEmpty();
                        if (gemini) assertThat(client).isNotSameAs(context.getBean("geminiHttpClient"));
                    }
                });
            }
        }
    }

    @Test void badPrefixAndTimeoutFailStartupWithoutRejectedValues(CapturedOutput output) {
        for (String property : new String[]{
                "testing.image-fetch.allowed-url-prefixes=https://SECRET_PREFIX.invalid/cloud/?sig=SECRET",
                "testing.image-fetch.request-timeout=SECRET_TIMEOUT"}) {
            runner.withPropertyValues("testing.image-fetch.enabled=true",
                    "testing.image-fetch.allowed-url-prefixes=https://cdn.example.test/cloud/", property)
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertThat(context.getStartupFailure()).hasRootCauseMessage("Invalid image fetch configuration");
                        var trace = new java.io.StringWriter();
                        context.getStartupFailure().printStackTrace(new java.io.PrintWriter(trace));
                        assertThat(trace.toString()).doesNotContain("SECRET_PREFIX", "SECRET_TIMEOUT");
                    });
        }
        assertThat(output.getAll()).doesNotContain("SECRET_PREFIX", "SECRET_TIMEOUT");
    }

    @Test void shutdownTerminatesBothClientsWithoutReflectiveWarnings(CapturedOutput output) {
        runner.withPropertyValues("testing.image-fetch.enabled=true",
                "testing.image-fetch.allowed-url-prefixes=https://cdn.example.test/cloud/",
                "testing.gemini.enabled=true", "testing.gemini.api-key=TEST_KEY", "testing.gemini.model=test")
                .run(context -> {
                    var image = context.getBean("imageFetchHttpClient", HttpClient.class);
                    var gemini = context.getBean("geminiHttpClient", HttpClient.class);
                    context.close();
                    try {
                        assertThat(image.awaitTermination(Duration.ofSeconds(2))).isTrue();
                        assertThat(gemini.awaitTermination(Duration.ofSeconds(2))).isTrue();
                    } catch (InterruptedException e) { throw new AssertionError(e); }
                });
        assertThat(output.getAll()).doesNotContain("IllegalAccessException", "Failed to invoke custom destroy");
    }
}
