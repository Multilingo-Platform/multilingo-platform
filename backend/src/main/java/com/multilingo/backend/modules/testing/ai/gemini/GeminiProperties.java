package com.multilingo.backend.modules.testing.ai.gemini;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.regex.Pattern;

/**
 * Configuration properties for the internal Gemini client.
 * Caps request payload size at 128KB and response payload size at 512KB.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "testing.gemini")
public class GeminiProperties {

    public static final int MAX_REQUEST_BYTES = 131_072;
    public static final int MAX_IMAGES_PER_REQUEST = 2;
    public static final int MAX_IMAGE_BYTES = 2_097_152;
    public static final int MAX_TOTAL_IMAGE_BYTES = 4_194_304;
    public static final int MAX_TEXT_BYTES_WITH_IMAGES = 131_072;
    public static final int MAX_MULTIMODAL_REQUEST_BYTES = 6_291_456;
    public static final int MAX_RESPONSE_BYTES = 524_288;
    private static final Duration MAX_ALLOWED_REQUEST_TIMEOUT = Duration.ofSeconds(120);
    private static final Pattern MODEL_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]*$");

    private boolean enabled = false;
    private String apiKey = "";
    private String model = "";
    private Duration connectTimeout = Duration.ofSeconds(5);
    private Duration requestTimeout = Duration.ofSeconds(30);

    /**
     * Validates configuration parameters.
     * When disabled, missing apiKey or model does not fail validation.
     * When enabled, apiKey, model, and timeouts must satisfy strict safety requirements.
     *
     * @throws IllegalStateException on invalid configuration
     */
    public void validate() {
        if (!enabled) {
            return;
        }

        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Gemini API key must be configured when Gemini is enabled");
        }

        for (int i = 0; i < apiKey.length(); i++) {
            char c = apiKey.charAt(i);
            if (c < 0x21 || c > 0x7E) {
                throw new IllegalStateException("Gemini API key must not contain whitespace, control, or non-ASCII characters");
            }
        }

        if (model == null || model.isBlank()) {
            throw new IllegalStateException("Gemini model must be configured when Gemini is enabled");
        }

        if (model.length() > 128 || !MODEL_PATTERN.matcher(model).matches()) {
            throw new IllegalStateException(
                    "Gemini model must be a bare model ID matching [A-Za-z0-9][A-Za-z0-9._-]* with length 1-128"
            );
        }

        if (connectTimeout == null || connectTimeout.isZero() || connectTimeout.isNegative()) {
            throw new IllegalStateException("Gemini connect timeout must be positive and non-null");
        }

        if (requestTimeout == null || requestTimeout.isZero() || requestTimeout.isNegative()) {
            throw new IllegalStateException("Gemini request timeout must be positive and non-null");
        }

        if (connectTimeout.compareTo(requestTimeout) > 0) {
            throw new IllegalStateException("Gemini connect timeout must not exceed request timeout");
        }

        if (requestTimeout.compareTo(MAX_ALLOWED_REQUEST_TIMEOUT) > 0) {
            throw new IllegalStateException("Gemini request timeout must not exceed 120s");
        }
    }

    @Override
    public String toString() {
        return "GeminiProperties{" +
                "enabled=" + enabled +
                ", model='" + model + '\'' +
                ", connectTimeout=" + connectTimeout +
                ", requestTimeout=" + requestTimeout +
                ", apiKeyConfigured=" + (apiKey != null && !apiKey.isBlank()) +
                '}';
    }
}
