package com.multilingo.backend.modules.testing.ai.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class ImageUrlPolicyTest {
    private final ImageUrlPolicy policy = new ImageUrlPolicy(List.of("https://cdn.example.test/cloud/"));

    @Test void acceptsCaseInsensitiveHostDefaultPortAndPreservesSignedQuery() {
        assertThat(policy.validate("https://CDN.EXAMPLE.TEST:443/cloud/a.png?sig=SECRET").getRawQuery())
                .isEqualTo("sig=SECRET");
        assertThat(policy.validate("https://cdn.example.test/cloud/" )).isNotNull();
        // Derive padding from the literal URI prefix, not the production length check.
        String prefix = "https://cdn.example.test/cloud/";
        String exact = prefix + "a".repeat(2_048 - prefix.length());
        assertThat(policy.validate(exact).toString()).hasSize(2_048);
        String oversized = exact + "a";
        assertThatThrownBy(() -> policy.validate(oversized)).isInstanceOf(ImageFetchException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://cdn.example.test/cloud/a", "https://u:p@cdn.example.test/cloud/a",
            "https://cdn.example.test/cloud/a#x", "https://127.0.0.1/cloud/a", "https://[::1]/cloud/a",
            "https://localhost/cloud/a", "https://localhost./cloud/a", "https://cdn.example.test:444/cloud/a",
            "https://cdn.example.test/cloud/../secret", "https://cdn.example.test/cloud/%2e%2e/secret",
            "https://cdn.example.test/cloud/%2Fa", "https://cdn.example.test/cloud/%5ca",
            "https://cdn.example.test/cloud/%252e%252e/a", "https://cdn.example.test/cloud/\\a",
            "https://cdn.example.test.evil.test/cloud/a", "https://evil.test/cdn.example.test/cloud/a",
            "https://cdn.example.test/cloud-other/a", "https://cdn.example.test/other/a", "SECRET_URL", ""})
    void rejectsUnsafeOrOutOfPrefixUrls(String url) {
        assertThatThrownBy(() -> policy.validate(url)).isInstanceOfSatisfying(ImageFetchException.class, e -> {
            assertThat(e.isRetryable()).isFalse();
            assertThat(e.getCause()).isNull();
            assertThat(e.toString()).doesNotContain("SECRET_URL");
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://cdn.example.test/cloud/", "https://cdn.example.test/cloud", "https://localhost/",
            "https://cdn.example.test/cloud/?key=SECRET", "https://u@cdn.example.test/cloud/"})
    void rejectsInvalidConfiguredPrefixesWithoutEcho(String prefix) {
        assertThatThrownBy(() -> new ImageUrlPolicy(List.of(prefix)))
                .isInstanceOfSatisfying(IllegalStateException.class, e -> {
                    assertThat(e.getMessage()).doesNotContain(prefix, "SECRET");
                    assertThat(e.getCause()).isNull();
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"%25%32%65%25%32%65/secret", "%25%32%66secret", "%25%35%63secret",
            "%2525%2532%2565%2525%2532%2565/secret"})
    void rejectsSplitAndNestedEncodedTraversal(String path) {
        assertThatThrownBy(() -> policy.validate("https://cdn.example.test/cloud/" + path))
                .isInstanceOfSatisfying(ImageFetchException.class,
                        e -> assertThat(e.getKind()).isEqualTo(ImageFetchException.Kind.INVALID_URL));
    }
}
