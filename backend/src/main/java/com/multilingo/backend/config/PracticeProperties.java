package com.multilingo.backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
@ConfigurationProperties(prefix = "vocab.practice")
@Getter
@Setter
public class PracticeProperties {
    private Duration sessionValidity = Duration.ofMinutes(30);
    private Duration receiptRetention = Duration.ofHours(24);
    private Duration completionTransactionTimeout = Duration.ofSeconds(30);
    private Duration cleanupSafetyMargin = Duration.ofMinutes(1);
    private String cleanupCron = "0 0 */6 * * *";
}
