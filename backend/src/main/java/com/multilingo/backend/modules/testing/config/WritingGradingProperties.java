package com.multilingo.backend.modules.testing.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Getter
@Setter
@ConfigurationProperties(prefix = "testing.writing-grading")
public class WritingGradingProperties {

    private boolean enabled = false;
    private boolean imagesEnabled = false;
    private Duration pollInterval = Duration.ofSeconds(5);
    private int batchSize = 10;
    private int concurrency = 2;
    private Duration quotaRecheckInterval = Duration.ofSeconds(60);
    private Duration leaseExtension = Duration.ofSeconds(15);
    private boolean dispatcherEnabled = false;

    public void validate(com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties imageFetchProperties) {
        if (enabled && imagesEnabled) {
            if (imageFetchProperties == null || !imageFetchProperties.isEnabled()) {
                throw new IllegalStateException("Image fetch must be enabled when visual writing grading is enabled");
            }
            imageFetchProperties.validate();
        }
    }
}
