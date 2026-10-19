package com.multilingo.backend.modules.testing.ai.media;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.convert.DurationStyle;
import java.time.Duration;
import java.util.Arrays;

@Getter
@Setter
@ConfigurationProperties(prefix = "testing.image-fetch")
public class ImageFetchProperties {
    public static final int MAX_IMAGE_BYTES = 2_097_152;
    private boolean enabled;
    private String allowedUrlPrefixes = "";
    private String connectTimeout = "5s";
    private String requestTimeout = "10s";
    public void validate() { if (enabled) snapshot(); }

    Settings snapshot() {
        try {
            Duration connect = DurationStyle.detectAndParse(connectTimeout);
            Duration request = DurationStyle.detectAndParse(requestTimeout);
            if (connect.isZero() || connect.isNegative() || request.isZero() || request.isNegative()
                    || connect.compareTo(request) > 0 || request.compareTo(Duration.ofSeconds(30)) > 0) {
                throw new IllegalArgumentException();
            }
            var prefixes = Arrays.stream(allowedUrlPrefixes.split(",", -1)).map(String::trim).toList();
            return new Settings(connect, request, new ImageUrlPolicy(prefixes));
        } catch (RuntimeException error) {
            throw new IllegalStateException("Invalid image fetch configuration");
        }
    }

    record Settings(Duration connectTimeout, Duration requestTimeout, ImageUrlPolicy urlPolicy) {
        @Override public String toString() { return "ImageFetchSettings{}"; }
    }
    @Override public String toString() { return "ImageFetchProperties{enabled=" + enabled + '}'; }
}
