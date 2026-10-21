package com.multilingo.backend.modules.testing.config;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
@EnableConfigurationProperties(TestingLanguageProperties.class)
public class TestingLanguageConfiguration {

    @Bean
    @ConditionalOnMissingBean(LearningLanguageCatalog.class)
    public LearningLanguageCatalog learningLanguageCatalog(
            TestingLanguageProperties testingProperties,
            WritingHintsProperties legacyProperties,
            Environment environment) {
        if (environment.containsProperty("testing.languages.supported")) {
            return new LearningLanguageCatalog(testingProperties.getSupported());
        }
        if (legacyProperties.getSupportedLanguages() != null && !legacyProperties.getSupportedLanguages().isEmpty()) {
            return new LearningLanguageCatalog(legacyProperties.getSupportedLanguages());
        }
        return new LearningLanguageCatalog();
    }
}
