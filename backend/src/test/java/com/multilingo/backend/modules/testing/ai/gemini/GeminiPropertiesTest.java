package com.multilingo.backend.modules.testing.ai.gemini;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GeminiPropertiesTest {

    @Test
    @DisplayName("Disabled by default with safe timeout defaults")
    void disabledByDefault() {
        GeminiProperties properties = new GeminiProperties();
        assertThat(properties.isEnabled()).isFalse();
        assertThat(properties.getConnectTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(properties.getRequestTimeout()).isEqualTo(Duration.ofSeconds(30));
        assertThat(properties.getApiKey()).isEmpty();
        assertThat(properties.getModel()).isEmpty();
        assertThatCode(properties::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Disabled configuration does not require apiKey or model")
    void disabledDoesNotRequireKeyOrModel() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(false);
        properties.setApiKey(null);
        properties.setModel(null);
        assertThatCode(properties::validate).doesNotThrowAnyException();

        properties.setApiKey("   ");
        properties.setModel("");
        assertThatCode(properties::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Enabled configuration requires non-blank apiKey")
    void enabledRequiresApiKey() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setModel("gemini-1.5-flash");

        properties.setApiKey(null);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini API key must be configured when Gemini is enabled");

        properties.setApiKey("   ");
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini API key must be configured when Gemini is enabled");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "key with space",
            "key\twith\ttab",
            "key\nwith\nnewline",
            "key\rwith\rcr",
            "key\u0000withNull",
            " keyWithLeadingSpace",
            "keyWithTrailingSpace ",
            "key\u0100withUnicode",
            "keyWithNonAscii\u00A9",
            "SECRET_KEY_SENTINEL_\u0100"
    })
    @DisplayName("Enabled configuration rejects apiKey with whitespace, control, or non-ASCII characters")
    void enabledRejectsApiKeyWithWhitespaceOrControlCharacters(String badKey) {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setModel("gemini-1.5-flash");
        properties.setApiKey(badKey);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini API key must not contain whitespace, control, or non-ASCII characters")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(badKey));
    }

    @Test
    @DisplayName("Enabled configuration requires non-blank model")
    void enabledRequiresModel() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("valid-secret-key-12345");

        properties.setModel(null);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini model must be configured when Gemini is enabled");

        properties.setModel("   ");
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini model must be configured when Gemini is enabled");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "models/gemini-1.5-flash",
            "https://ai.google.dev/gemini",
            "gemini/flash",
            "gemini?key=abc",
            "gemini 1.5",
            ".gemini-flash",
            "-gemini-flash",
            "_gemini-flash",
            "gemini@flash",
            "gemini#flash"
    })
    @DisplayName("Enabled configuration rejects invalid model format")
    void enabledRejectsInvalidModelPattern(String invalidModel) {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("valid-secret-key-12345");
        properties.setModel(invalidModel);

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini model must be a bare model ID matching [A-Za-z0-9][A-Za-z0-9._-]* with length 1-128");
    }

    @Test
    @DisplayName("Enabled configuration rejects model longer than 128 characters")
    void enabledRejectsModelTooLong() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("valid-secret-key-12345");
        properties.setModel("a".repeat(129));

        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini model must be a bare model ID matching [A-Za-z0-9][A-Za-z0-9._-]* with length 1-128");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "gemini-1.5-flash",
            "gemini-2.5-flash",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro-001",
            "text-embedding-004",
            "m",
            "Model_123.v1"
    })
    @DisplayName("Enabled configuration accepts valid bare model IDs")
    void enabledAcceptsValidBareModelIds(String validModel) {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("valid-secret-key-12345");
        properties.setModel(validModel);

        assertThatCode(properties::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Timeouts must be positive and within bounds")
    void validatesTimeouts() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("valid-secret-key-12345");
        properties.setModel("gemini-1.5-flash");

        // connectTimeout null
        properties.setConnectTimeout(null);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini connect timeout must be positive and non-null");

        // connectTimeout zero or negative
        properties.setConnectTimeout(Duration.ZERO);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini connect timeout must be positive and non-null");

        properties.setConnectTimeout(Duration.ofSeconds(-1));
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini connect timeout must be positive and non-null");

        // requestTimeout null
        properties.setConnectTimeout(Duration.ofSeconds(5));
        properties.setRequestTimeout(null);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini request timeout must be positive and non-null");

        // requestTimeout zero or negative
        properties.setRequestTimeout(Duration.ZERO);
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini request timeout must be positive and non-null");

        // connectTimeout > requestTimeout
        properties.setConnectTimeout(Duration.ofSeconds(10));
        properties.setRequestTimeout(Duration.ofSeconds(5));
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini connect timeout must not exceed request timeout");

        // requestTimeout > 120s
        properties.setConnectTimeout(Duration.ofSeconds(10));
        properties.setRequestTimeout(Duration.ofSeconds(121));
        assertThatThrownBy(properties::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Gemini request timeout must not exceed 120s");

        // Valid boundary 120s
        properties.setConnectTimeout(Duration.ofSeconds(120));
        properties.setRequestTimeout(Duration.ofSeconds(120));
        assertThatCode(properties::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Fixed payload caps are 128KB request and 512KB response")
    void fixedPayloadCaps() {
        assertThat(GeminiProperties.MAX_REQUEST_BYTES).isEqualTo(131_072);
        assertThat(GeminiProperties.MAX_RESPONSE_BYTES).isEqualTo(524_288);
    }

    @Test
    @DisplayName("toString() does not expose apiKey")
    void safeToStringDoesNotLeakApiKey() {
        GeminiProperties properties = new GeminiProperties();
        properties.setEnabled(true);
        properties.setApiKey("SUPER_SECRET_KEY_99999");
        properties.setModel("gemini-1.5-flash");

        String str = properties.toString();
        assertThat(str).doesNotContain("SUPER_SECRET_KEY_99999");
        assertThat(str).contains("gemini-1.5-flash");
    }
}
