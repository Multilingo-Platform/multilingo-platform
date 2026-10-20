package com.multilingo.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.repository.ExamPartRepository;
import com.multilingo.backend.modules.exam.repository.ExamRepository;
import com.multilingo.backend.modules.exam.repository.ExamSectionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MockDataSeederConditionTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(MockDataSeeder.class, SeederDependencies.class)
            .withInitializer(context -> context.getEnvironment().setActiveProfiles("dev"));

    @Test
    void mockSeederIsDisabledByDefaultEvenInDevProfile() {
        runner.run(context -> assertThat(context).doesNotHaveBean(MockDataSeeder.class));
    }

    @Test
    void mockSeederRequiresItsFlagAndIsExcludedWhenOfficialSeedIsEnabled() {
        runner.withPropertyValues("exam.mock-data.enabled=true", "exam.default-dataset.enabled=false")
                .run(context -> assertThat(context).hasSingleBean(MockDataSeeder.class));
        runner.withPropertyValues("exam.mock-data.enabled=true", "exam.default-dataset.enabled=true")
                .run(context -> assertThat(context).doesNotHaveBean(MockDataSeeder.class));
    }

    @Configuration(proxyBeanMethods = false)
    static class SeederDependencies {
        @Bean ExamRepository examRepository() { return mock(ExamRepository.class); }
        @Bean ExamSectionRepository examSectionRepository() { return mock(ExamSectionRepository.class); }
        @Bean ExamPartRepository examPartRepository() { return mock(ExamPartRepository.class); }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
    }
}
