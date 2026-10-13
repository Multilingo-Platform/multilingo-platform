package com.multilingo.backend.modules.testing.config;

import com.multilingo.backend.common.i18n.LearningLanguageCatalog;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WritingHintsPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfig.class, WritingHintsConfiguration.class);

    @Test
    @DisplayName("Giá trị mặc định của WritingHintsProperties chính xác và an toàn")
    void defaultValuesAreSafe() {
        WritingHintsProperties properties = new WritingHintsProperties();

        assertThat(properties.isEnabled()).isFalse();
        assertThat(properties.getMinInterval()).isEqualTo(Duration.ofSeconds(10));
        assertThat(properties.getLeaseExtension()).isEqualTo(Duration.ofSeconds(15));
        assertThat(properties.getMaxRequestBodyBytes()).isEqualTo(16384);
        assertThat(properties.getMaxContextCodePoints()).isEqualTo(16000);
        assertThat(properties.getMaxOutputBytes()).isEqualTo(32768);
        assertThat(properties.getSupportedLanguages()).containsExactly("en", "vi", "ko", "zh", "ja", "fr", "de", "es");
    }

    @Test
    @DisplayName("ApplicationContextRunner nạp cấu hình mặc định: Clock bean và LearningLanguageCatalog bean hoạt động")
    void contextLoadsWithDefaultBeans() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(WritingHintsProperties.class);
            assertThat(context).hasSingleBean(Clock.class);
            assertThat(context).hasSingleBean(LearningLanguageCatalog.class);

            WritingHintsProperties properties = context.getBean(WritingHintsProperties.class);
            assertThat(properties.isEnabled()).isFalse();

            LearningLanguageCatalog catalog = context.getBean(LearningLanguageCatalog.class);
            assertThat(catalog.isSupported("en")).isTrue();
            assertThat(catalog.isSupported("it")).isFalse();
        });
    }

    @Test
    @DisplayName("ApplicationContextRunner nạp cấu hình tùy biến: mở rộng thêm ngôn ngữ 'it'")
    void contextLoadsWithCustomProperties() {
        runner.withPropertyValues(
                "testing.writing-hints.enabled=true",
                "testing.writing-hints.min-interval=5s",
                "testing.writing-hints.lease-extension=20s",
                "testing.writing-hints.supported-languages=en,vi,it"
        ).run(context -> {
            WritingHintsProperties properties = context.getBean(WritingHintsProperties.class);
            assertThat(properties.isEnabled()).isTrue();
            assertThat(properties.getMinInterval()).isEqualTo(Duration.ofSeconds(5));
            assertThat(properties.getLeaseExtension()).isEqualTo(Duration.ofSeconds(20));
            assertThat(properties.getSupportedLanguages()).containsExactly("en", "vi", "it");

            LearningLanguageCatalog catalog = context.getBean(LearningLanguageCatalog.class);
            assertThat(catalog.isSupported("en")).isTrue();
            assertThat(catalog.isSupported("vi")).isTrue();
            assertThat(catalog.isSupported("it")).isTrue();
            assertThat(catalog.isSupported("ko")).isFalse();
        });
    }

    @Configuration
    @EnableConfigurationProperties(WritingHintsProperties.class)
    static class TestConfig {
    }
}
