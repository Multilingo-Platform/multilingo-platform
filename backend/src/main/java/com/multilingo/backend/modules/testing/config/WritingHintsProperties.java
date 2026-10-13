package com.multilingo.backend.modules.testing.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "testing.writing-hints")
public class WritingHintsProperties {

    private boolean enabled = false;
    private Duration minInterval = Duration.ofSeconds(10);
    private Duration leaseExtension = Duration.ofSeconds(15);
    private int maxRequestBodyBytes = 16 * 1024;
    private int maxContextCodePoints = 16000;
    private int maxOutputBytes = 32 * 1024;
    private List<String> supportedLanguages = new ArrayList<>(
            List.of("en", "vi", "ko", "zh", "ja", "fr", "de", "es")
    );
}
