package com.multilingo.backend.modules.testing.config;

import com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties;
import com.multilingo.backend.modules.testing.ai.grading.WritingRubricRegistry;
import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.time.Clock;

@Configuration
@Import(TestingLanguageConfiguration.class)
@EnableConfigurationProperties({WritingGradingProperties.class, ImageFetchProperties.class})
public class WritingGradingConfiguration {

    @Bean
    @ConditionalOnMissingBean(WritingRubricRegistry.class)
    public WritingRubricRegistry writingRubricRegistry(LearningLanguageCatalog languages) {
        return new WritingRubricRegistry(languages);
    }

    @Bean(name = "writingGradingTaskExecutor")
    public ThreadPoolTaskExecutor writingGradingTaskExecutor(WritingGradingProperties properties) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int concurrency = Math.max(1, properties.getConcurrency());
        executor.setCorePoolSize(concurrency);
        executor.setMaxPoolSize(concurrency);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("writing-grading-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    @Bean
    @ConditionalOnMissingBean(Clock.class)
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public WritingGradingConfigValidator writingGradingConfigValidator(
            WritingGradingProperties gradingProperties,
            ImageFetchProperties imageFetchProperties
    ) {
        return new WritingGradingConfigValidator(gradingProperties, imageFetchProperties);
    }

    public static class WritingGradingConfigValidator implements InitializingBean {
        private final WritingGradingProperties gradingProperties;
        private final ImageFetchProperties imageFetchProperties;

        public WritingGradingConfigValidator(WritingGradingProperties gradingProperties,
                                             ImageFetchProperties imageFetchProperties) {
            this.gradingProperties = gradingProperties;
            this.imageFetchProperties = imageFetchProperties;
        }

        @Override
        public void afterPropertiesSet() {
            gradingProperties.validate(imageFetchProperties);
        }
    }
}

