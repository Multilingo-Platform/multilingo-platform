package com.multilingo.backend.config;

import com.multilingo.backend.modules.exam.service.DefaultExamDatasetService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@Component
@ConditionalOnProperty(name = "exam.default-dataset.enabled", havingValue = "true")
public class DefaultExamDatasetRunner implements ApplicationRunner {
    private static final Map<String, String> APPROVED_BUNDLE_PATHS = Map.of(
            "cambridge-ielts-20-test-1", "datasets/exams/cambridge-ielts-20-test-1.v2.json",
            "ets-2024-test-1", "datasets/exams/ets-2024-test-1.v2.json",
            "nltv-sample-test-1", "datasets/exams/nltv-sample-test-1.v2.json");

    private final DefaultExamDatasetService service;
    private final boolean publishApproved;
    private final String datasetKeys;

    public DefaultExamDatasetRunner(DefaultExamDatasetService service,
            @Value("${exam.default-dataset.publish-approved:false}") boolean publishApproved,
            @Value("${exam.default-dataset.keys:cambridge-ielts-20-test-1,ets-2024-test-1}") String datasetKeys) {
        this.service = service;
        this.publishApproved = publishApproved;
        this.datasetKeys = datasetKeys;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Fixed classpath allowlist only. A manifest cannot select a path or remote URL.
        Set<String> selectedKeys = new LinkedHashSet<>(Arrays.stream(datasetKeys.split(","))
                .map(String::trim).filter(key -> !key.isEmpty()).toList());
        if (selectedKeys.isEmpty() || selectedKeys.stream().anyMatch(key -> !APPROVED_BUNDLE_PATHS.containsKey(key))) {
            throw new IllegalArgumentException("Unknown default exam dataset key.");
        }
        Resource[] resources = selectedKeys.stream().map(APPROVED_BUNDLE_PATHS::get)
                .map(ClassPathResource::new).toArray(Resource[]::new);
        service.seedClasspath(resources, publishApproved);
    }
}
