package com.multilingo.backend.modules.analytics.repository;

import com.multilingo.backend.common.JpaTestConfig;
import com.multilingo.backend.modules.analytics.entity.AuditLog;
import com.multilingo.backend.modules.analytics.entity.LoginHistory;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@Import(JpaTestConfig.class)
@ActiveProfiles("test")
class AnalyticsRepositoryTest {

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private LoginHistoryRepository loginHistoryRepository;

    @Autowired
    private UserQuotaRepository userQuotaRepository;

    @Test
    @DisplayName("Should save and query AuditLog with action and pagination")
    void testAuditLogRepository() {
        AuditLog log1 = AuditLog.builder()
                .userId(1)
                .action("LOCK_USER")
                .entityType("USER")
                .entityId("2")
                .details(Map.of("reason", "Spamming"))
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(log1);

        AuditLog log2 = AuditLog.builder()
                .userId(1)
                .action("UPDATE_AI_QUOTA")
                .entityType("QUOTA")
                .entityId("AI_WRITING")
                .details(Map.of("maxLimit", 5))
                .ipAddress("127.0.0.1")
                .build();
        auditLogRepository.save(log2);

        Page<AuditLog> page = auditLogRepository.findByAction("LOCK_USER", PageRequest.of(0, 10));
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getAction()).isEqualTo("LOCK_USER");
        assertThat(page.getContent().get(0).getDetails()).containsEntry("reason", "Spamming");
    }

    @Test
    @DisplayName("Should save and query LoginHistory by userId")
    void testLoginHistoryRepository() {
        Instant now = Instant.now();
        LoginHistory h1 = LoginHistory.builder()
                .userId(10)
                .ipAddress("192.168.1.1")
                .deviceInfo("Chrome / Windows")
                .loginTime(now)
                .status("SUCCESS")
                .build();
        loginHistoryRepository.save(h1);

        List<LoginHistory> histories = loginHistoryRepository.findTop10ByUserIdOrderByLoginTimeDesc(10);
        assertThat(histories).hasSize(1);
        assertThat(histories.get(0).getDeviceInfo()).isEqualTo("Chrome / Windows");

        long activeUsers = loginHistoryRepository.countDistinctActiveUsers(now.minus(1, ChronoUnit.HOURS));
        assertThat(activeUsers).isEqualTo(1);
    }

    @Test
    @DisplayName("Should save and query UserQuota by featureCode and userId")
    void testUserQuotaRepository() {
        Instant nextReset = Instant.now().plus(7, ChronoUnit.DAYS);
        UserQuota quota = UserQuota.builder()
                .userId(1)
                .featureCode("AI_WRITING_GRADING")
                .usedCount(1)
                .maxLimit(5)
                .resetDate(nextReset)
                .build();
        userQuotaRepository.save(quota);

        Optional<UserQuota> found = userQuotaRepository.findByUserIdAndFeatureCode(1, "AI_WRITING_GRADING");
        assertThat(found).isPresent();
        assertThat(found.get().getMaxLimit()).isEqualTo(5);

        List<UserQuota> featureQuotas = userQuotaRepository.findByFeatureCode("AI_WRITING_GRADING");
        assertThat(featureQuotas).hasSize(1);
    }
}
