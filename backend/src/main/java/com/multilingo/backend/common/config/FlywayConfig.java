package com.multilingo.backend.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình Flyway Migration Strategy.
 * Tự động chạy flyway.repair() trước khi migrate nhằm đồng bộ lại checksum
 * trong bảng flyway_schema_history khi có sự thay đổi về format (LF/CRLF) hoặc
 * cập nhật script migration trong quá trình phát triển (development).
 */
@Slf4j
@Configuration
public class FlywayConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            log.info("Flyway: Đang thực thi flyway.repair() để đồng bộ checksum lịch sử schema...");
            flyway.repair();
            log.info("Flyway: Đồng bộ checksum hoàn tất. Đang thực thi flyway.migrate()...");
            flyway.migrate();
            log.info("Flyway: Quá trình migrate cơ sở dữ liệu đã hoàn tất thành công!");
        };
    }
}
