package com.multilingo.backend.modules.testing.ai.media;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class ImageFetchPropertiesTest {
    @Test void disabledIgnoresMissingPrefixAndDoesNotExposeConfig() {
        var properties = new ImageFetchProperties();
        properties.setAllowedUrlPrefixes("https://SECRET.invalid/cloud/?signature=SECRET");
        assertThatCode(properties::validate).doesNotThrowAnyException();
        assertThat(properties.toString()).doesNotContain("SECRET", "https://");
        properties.setEnabled(true);
        assertThatThrownBy(properties::validate).isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0s", "-1s", "31s", "SECRET_TIMEOUT", "999999999999999999999999999999999999s"})
    void rejectsInvalidRequestTimeoutSafely(String timeout) {
        var properties = valid();
        properties.setRequestTimeout(timeout);
        assertThatThrownBy(properties::validate).isInstanceOfSatisfying(IllegalStateException.class, e -> {
            assertThat(e.getMessage()).doesNotContain(timeout);
            assertThat(e.getCause()).isNull();
        });
    }

    @Test void validatesMissingPrefixesAndTimeoutOrdering() {
        var properties = new ImageFetchProperties();
        properties.setEnabled(true);
        assertThatThrownBy(properties::validate).isInstanceOf(IllegalStateException.class);
        properties = valid();
        assertThatCode(properties::validate).doesNotThrowAnyException();
        properties.setConnectTimeout("11s");
        assertThatThrownBy(properties::validate).isInstanceOf(IllegalStateException.class);
    }

    static ImageFetchProperties valid() {
        var properties = new ImageFetchProperties();
        properties.setEnabled(true);
        properties.setAllowedUrlPrefixes("https://cdn.example.test/cloud/");
        return properties;
    }
}
