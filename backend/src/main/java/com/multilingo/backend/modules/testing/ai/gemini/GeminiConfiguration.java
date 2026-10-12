package com.multilingo.backend.modules.testing.ai.gemini;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;

/**
 * Spring configuration for Gemini AI infrastructure.
 * Ensures exactly one GeminiClient is exposed.
 * When disabled (default), creates a DisabledGeminiClient that rejects requests without creating an HttpClient.
 * When enabled, validates configuration and provisions a singleton JDK HttpClient with connect timeout and Redirect.NEVER.
 */
@Configuration
@EnableConfigurationProperties(GeminiProperties.class)
public class GeminiConfiguration {

    @Bean
    public GeminiPayloadCodec geminiPayloadCodec() {
        return new GeminiPayloadCodec();
    }

    @Bean(destroyMethod = "")
    @ConditionalOnProperty(prefix = "testing.gemini", name = "enabled", havingValue = "true")
    public HttpClient geminiHttpClient(GeminiProperties properties) {
        properties.validate();
        return HttpClient.newBuilder()
                .connectTimeout(properties.getConnectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "testing.gemini", name = "enabled", havingValue = "true")
    public DisposableBean geminiHttpClientShutdown(HttpClient geminiHttpClient) {
        return geminiHttpClient::shutdownNow;
    }

    @Bean
    public GeminiClient geminiClient(
            GeminiProperties properties,
            GeminiPayloadCodec codec,
            ObjectProvider<HttpClient> httpClientProvider
    ) {
        if (!properties.isEnabled()) {
            return new DisabledGeminiClient();
        }
        properties.validate();
        HttpClient httpClient = httpClientProvider.getIfAvailable();
        if (httpClient == null) {
            httpClient = HttpClient.newBuilder()
                    .connectTimeout(properties.getConnectTimeout())
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();
        }
        return new HttpGeminiClient(httpClient, properties, codec);
    }

    private static final class DisabledGeminiClient implements GeminiClient {
        @Override
        public GeminiGenerationResult generate(GeminiGenerationRequest request) {
            throw new GeminiClientException(
                    GeminiClientException.Kind.DISABLED,
                    "Gemini client is disabled in configuration"
            );
        }

        @Override
        public String toString() {
            return "DisabledGeminiClient";
        }
    }
}
