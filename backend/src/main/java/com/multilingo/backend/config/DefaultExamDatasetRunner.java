package com.multilingo.backend.config;

import com.multilingo.backend.modules.exam.service.DefaultExamDatasetService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "exam.default-dataset.enabled", havingValue = "true")
public class DefaultExamDatasetRunner implements ApplicationRunner {
    private final DefaultExamDatasetService service;

    public DefaultExamDatasetRunner(DefaultExamDatasetService service) { this.service = service; }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        // Fixed classpath only. Manifest cannot select a local path or remote URL.
        var resources = new PathMatchingResourcePatternResolver().getResources("classpath*:datasets/exams/*.json");
        service.seedClasspath(resources);
    }
}
