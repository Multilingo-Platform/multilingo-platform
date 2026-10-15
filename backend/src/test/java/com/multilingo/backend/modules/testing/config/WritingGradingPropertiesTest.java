package com.multilingo.backend.modules.testing.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class WritingGradingPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class, WritingGradingConfiguration.class);

    @Test
    @DisplayName("Giá trị mặc định của WritingGradingProperties chính xác và an toàn")
    void defaultValuesAreSafe() {
        WritingGradingProperties properties = new WritingGradingProperties();

        assertThat(properties.isEnabled()).isFalse();
        assertThat(properties.isImagesEnabled()).isFalse();
        assertThat(properties.getPollInterval()).isEqualTo(Duration.ofSeconds(5));
        assertThat(properties.getBatchSize()).isEqualTo(10);
        assertThat(properties.getConcurrency()).isEqualTo(2);
        assertThat(properties.getQuotaRecheckInterval()).isEqualTo(Duration.ofSeconds(60));
        assertThat(properties.getLeaseExtension()).isEqualTo(Duration.ofSeconds(15));
        assertThat(properties.isDispatcherEnabled()).isFalse();
    }

    @Test
    @DisplayName("ApplicationContextRunner nạp cấu hình mặc định: WritingGradingProperties bean hoạt động")
    void contextLoadsWithDefaultBeans() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(WritingGradingProperties.class);

            WritingGradingProperties properties = context.getBean(WritingGradingProperties.class);
            assertThat(properties.isEnabled()).isFalse();
            assertThat(properties.isImagesEnabled()).isFalse();
            assertThat(properties.getPollInterval()).isEqualTo(Duration.ofSeconds(5));
            assertThat(properties.getBatchSize()).isEqualTo(10);
            assertThat(properties.getConcurrency()).isEqualTo(2);
            assertThat(properties.getQuotaRecheckInterval()).isEqualTo(Duration.ofSeconds(60));
            assertThat(properties.getLeaseExtension()).isEqualTo(Duration.ofSeconds(15));
            assertThat(properties.isDispatcherEnabled()).isFalse();
        });
    }

    @Test
    @DisplayName("ApplicationContextRunner nạp cấu hình tùy biến: ghi đè toàn bộ properties")
    void contextLoadsWithCustomProperties() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=true",
                "testing.writing-grading.images-enabled=true",
                "testing.writing-grading.poll-interval=10s",
                "testing.writing-grading.batch-size=20",
                "testing.writing-grading.concurrency=4",
                "testing.writing-grading.quota-recheck-interval=120s",
                "testing.writing-grading.lease-extension=30s",
                "testing.writing-grading.dispatcher-enabled=true",
                "testing.image-fetch.enabled=true",
                "testing.image-fetch.allowed-url-prefixes=https://storage.example.test/"
        ).run(context -> {
            WritingGradingProperties properties = context.getBean(WritingGradingProperties.class);
            assertThat(properties.isEnabled()).isTrue();
            assertThat(properties.isImagesEnabled()).isTrue();
            assertThat(properties.getPollInterval()).isEqualTo(Duration.ofSeconds(10));
            assertThat(properties.getBatchSize()).isEqualTo(20);
            assertThat(properties.getConcurrency()).isEqualTo(4);
            assertThat(properties.getQuotaRecheckInterval()).isEqualTo(Duration.ofSeconds(120));
            assertThat(properties.getLeaseExtension()).isEqualTo(Duration.ofSeconds(30));
            assertThat(properties.isDispatcherEnabled()).isTrue();
        });
    }

    @Test
    @DisplayName("TV3-20-03-R2: Context fail startup nếu enabled=true, images-enabled=true nhưng image-fetch bị tắt")
    void startupFailsWhenVisualGradingEnabledButImageFetchDisabled() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=true",
                "testing.writing-grading.images-enabled=true",
                "testing.image-fetch.enabled=false"
        ).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure())
                    .hasRootCauseInstanceOf(IllegalStateException.class)
                    .hasRootCauseMessage("Image fetch must be enabled when visual writing grading is enabled");
        });
    }

    @Test
    @DisplayName("TV3-20-03-R2: Context fail startup nếu enabled=true, images-enabled=true, image-fetch.enabled=true nhưng allowlist rỗng")
    void startupFailsWhenVisualGradingEnabledAndFetchEnabledButAllowlistEmpty() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=true",
                "testing.writing-grading.images-enabled=true",
                "testing.image-fetch.enabled=true",
                "testing.image-fetch.allowed-url-prefixes="
        ).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure())
                    .hasRootCauseInstanceOf(IllegalStateException.class)
                    .hasRootCauseMessage("Invalid image fetch configuration");
        });
    }

    @Test
    @DisplayName("TV3-20-03-R2: Startup thành công khi cấu hình visual grading và image fetch đều hợp lệ")
    void startupSucceedsWhenValidGradingAndImageFetchConfigured() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=true",
                "testing.writing-grading.images-enabled=true",
                "testing.image-fetch.enabled=true",
                "testing.image-fetch.allowed-url-prefixes=https://storage.example.test/"
        ).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(WritingGradingProperties.class);
        });
    }

    @Test
    @DisplayName("TV3-20-03-R2: Startup thành công khi grading tắt, không bị chặn bởi image fetch")
    void startupSucceedsWhenGradingDisabledEvenIfImageFetchDisabled() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=false",
                "testing.writing-grading.images-enabled=true",
                "testing.image-fetch.enabled=false"
        ).run(context -> {
            assertThat(context).hasNotFailed();
        });
    }

    @Test
    @DisplayName("TV3-20-03-R2: Startup thành công khi images-enabled tắt, không bị chặn bởi image fetch")
    void startupSucceedsWhenImagesDisabledEvenIfImageFetchDisabled() {
        runner.withPropertyValues(
                "testing.writing-grading.enabled=true",
                "testing.writing-grading.images-enabled=false",
                "testing.image-fetch.enabled=false"
        ).run(context -> {
            assertThat(context).hasNotFailed();
        });
    }

    @Configuration
    @EnableConfigurationProperties(WritingGradingProperties.class)
    static class TestConfig {
    }
}
