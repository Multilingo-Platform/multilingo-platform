package com.multilingo.backend.modules.testing.config;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
@EnableConfigurationProperties(WritingHintsProperties.class)
public class WritingHintsConfiguration {

    @Bean
    @ConditionalOnMissingBean(Clock.class)
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public LearningLanguageCatalog learningLanguageCatalog(WritingHintsProperties properties) {
        if (properties.getSupportedLanguages() != null && !properties.getSupportedLanguages().isEmpty()) {
            return new LearningLanguageCatalog(properties.getSupportedLanguages());
        }
        return new LearningLanguageCatalog();
    }
}
