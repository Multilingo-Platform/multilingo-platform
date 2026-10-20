package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.config.DataSeeder;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.auth.entity.Role;
import com.multilingo.backend.modules.auth.entity.User;
import com.multilingo.backend.modules.auth.repository.RoleRepository;
import com.multilingo.backend.modules.auth.repository.UserRepository;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiClient;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiGenerationResult;
import com.multilingo.backend.modules.testing.ai.hints.WritingHintOutputParser;
import com.multilingo.backend.modules.testing.dto.request.WritingHintsRequest;
import com.multilingo.backend.modules.testing.dto.response.WritingHintsResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.service.WritingHintsService;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator.BeginDecision;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator.Reservation;
import com.multilingo.backend.modules.testing.service.support.WritingHintTransactionCoordinator.TerminalDecision;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Real Spring transaction proxies and production JPQL against an isolated Flyway-migrated PG schema. */
@SpringBootTest(properties = {
        "testing.writing-hints.enabled=true", "testing.writing-hints.min-interval=0s",
        "spring.jpa.open-in-view=false"
})
@ActiveProfiles("test")
@EnabledIfEnvironmentVariable(named = "TV3_PG_TEST_URL", matches = "jdbc:postgresql:.*")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class WritingHintPostgresTransactionIT {
    private static final String SCHEMA = "tv3_18_tx_" + UUID.randomUUID().toString().replace("-", "");
    private static boolean schemaCreated;
    private static final Instant NOW = Instant.parse("2026-10-13T05:00:00Z");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) throws Exception {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + SCHEMA);
            schemaCreated = true;
            statement.execute("SET search_path TO " + SCHEMA);
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("fixtures/writing-hints-pg-prerequisites.sql"));
        }
        String url = System.getenv("TV3_PG_TEST_URL");
        registry.add("spring.datasource.url", () -> url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        registry.add("spring.datasource.username", () -> System.getenv("TV3_PG_TEST_USER"));
        registry.add("spring.datasource.password", () -> System.getenv("TV3_PG_TEST_PASSWORD"));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.datasource.hikari.connection-init-sql", () -> "SET statement_timeout = '10s'");
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA);
        registry.add("spring.flyway.target", () -> "20261012180000");
        registry.add("spring.flyway.baseline-version", () -> "20261010233000");
    }

    private static Connection connection() throws Exception {
        return DriverManager.getConnection(System.getenv("TV3_PG_TEST_URL"),
                System.getenv("TV3_PG_TEST_USER"), System.getenv("TV3_PG_TEST_PASSWORD"));
    }

    @AfterAll
    static void dropIsolatedSchema() throws Exception {
        if (schemaCreated) {
            try (Connection connection = connection(); Statement statement = connection.createStatement()) {
                statement.execute("DROP SCHEMA " + SCHEMA + " CASCADE");
            }
        }
    }

    static class TestClock extends Clock {
        private final AtomicReference<Instant> current = new AtomicReference<>(NOW);
        void set(Instant instant) { current.set(instant); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return Clock.fixed(instant(), zone); }
        @Override public Instant instant() { return current.get(); }
    }

    @TestConfiguration
    static class ClockConfiguration {
        @Bean @Primary TestClock postgresClock() { return new TestClock(); }
    }

    @Autowired private WritingHintsService service;
    @Autowired private WritingHintTransactionCoordinator coordinator;
    @Autowired private WritingHintOutputParser parser;
    @Autowired private UserQuotaReservationService quotaService;
    @Autowired private UserQuotaRepository quotas;
    @Autowired private TestAttemptRepository attempts;
    @Autowired private UserRepository users;
    @Autowired private RoleRepository roles;
    @Autowired private TestClock clock;
    @Autowired private DataSource dataSource;
    @MockBean private GeminiClient gemini;
    // No bootstrap account creation/logging; fixtures belong solely to this schema.
    @MockBean private DataSeeder dataSeeder;
    private JdbcTemplate jdbc;
    private Integer userId;
    private Integer attemptId;
    private UserQuota quota;

    @BeforeEach
    void seedCommittedFixture() {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        assertThat(AopUtils.isAopProxy(coordinator)).isTrue();
        assertThat(AopUtils.isAopProxy(quotaService)).isTrue();
        clock.set(NOW);
        jdbc = new JdbcTemplate(dataSource);
        Role role = roles.findByName("TV3_PG_USER").orElseGet(() -> roles.save(Role.builder().name("TV3_PG_USER").build()));
        userId = users.save(User.builder().email(UUID.randomUUID() + "@tv3.test")
                .fullName("PG learner").role(role).targetLanguage("en").build()).getId();
        attemptId = seedAttempt();
        quota = quotas.save(UserQuota.builder().userId(userId).featureCode("AI_WRITING_HINTS")
                .maxLimit(1).usedCount(0).resetDate(NOW.plusSeconds(86400)).build());
    }

    private Integer seedAttempt() {
        return attempts.save(TestAttempt.builder().userId(userId).examId(1).testMode(TestMode.PRACTICE)
                .startTime(NOW).examSnapshot(Map.of("sections", List.of(Map.of("id", 10, "name", "WRITING",
                        "parts", List.of(Map.of("id", 30, "questions", List.of(Map.of(
                                "question_id", "w1", "type", "ESSAY", "prompt", "Write an essay about clean energy."))))))))
                .build()).getId();
    }

    private WritingHintsRequest request(String key) {
        return new WritingHintsRequest(30, "w1", key, "en", "fr");
    }

    private Reservation begin(String key) {
        var decision = coordinator.begin(userId, attemptId, request(key));
        assertThat(decision).isInstanceOf(BeginDecision.Reserved.class);
        return ((BeginDecision.Reserved) decision).reservation();
    }

    // JdbcTemplate obtains a fresh connection with no caller transaction: these are committed-state assertions.
    private int usedCount() {
        return jdbc.queryForObject("SELECT used_count FROM user_quotas WHERE id = ?", Integer.class, quota.getId());
    }

    private Map<String, Object> ledger(Integer id) {
        return jdbc.queryForMap("SELECT status, run_id, quota_reserved, failure_code, result_json FROM writing_hint_requests WHERE id = ?", id);
    }

    private WritingHintsResponse.Content content(String marker) {
        try (var input = new ClassPathResource("fixtures/writing-hints-fr.json").getInputStream()) {
            var parsed = parser.parse(new String(input.readAllBytes(), StandardCharsets.UTF_8), "fr", false);
            var outline = new java.util.ArrayList<>(parsed.outline());
            outline.set(0, new WritingHintsResponse.OutlineSection(marker, outline.getFirst().points()));
            return new WritingHintsResponse.Content(outline, parsed.vocabulary(), parsed.limitations());
        } catch (java.io.IOException exception) {
            throw new java.io.UncheckedIOException(exception);
        }
    }

    private GeminiGenerationResult providerResult() throws Exception {
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
        try (var input = new ClassPathResource("fixtures/writing-hints-fr.json").getInputStream()) {
            return new GeminiGenerationResult(new String(input.readAllBytes(), StandardCharsets.UTF_8),
                    new GeminiGenerationResult.Usage(10, 20, 30));
        }
    }

    @Test
    void distinctAttemptRequestsShareOneQuotaAndOneProviderCall() throws Exception {
        assertServiceRace(false);
    }

    @Test
    void concurrentSameKeyAndReplayNeverDuplicateOrChargeAgain() throws Exception {
        assertServiceRace(true);
    }

    private void assertServiceRace(boolean sameKey) throws Exception {
        Integer otherAttempt = sameKey ? attemptId : seedAttempt();
        String firstKey = UUID.randomUUID().toString();
        String secondKey = sameKey ? firstKey : UUID.randomUUID().toString();
        CyclicBarrier start = new CyclicBarrier(2);
        CountDownLatch providerEntered = new CountDownLatch(1);
        CountDownLatch releaseProvider = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        when(gemini.generate(any())).thenAnswer(invocation -> {
            calls.incrementAndGet();
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            providerEntered.countDown();
            assertThat(releaseProvider.await(10, TimeUnit.SECONDS)).isTrue();
            return providerResult();
        });
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CompletionService<Object> completed = new ExecutorCompletionService<>(executor);
        try {
            completed.submit(() -> callAfterBarrier(start, attemptId, firstKey));
            completed.submit(() -> callAfterBarrier(start, otherAttempt, secondKey));
            assertThat(providerEntered.await(10, TimeUnit.SECONDS)).isTrue();
            Future<Object> deniedFuture = completed.poll(10, TimeUnit.SECONDS);
            assertThat(deniedFuture).isNotNull();
            Object denied = deniedFuture.get(10, TimeUnit.SECONDS);
            assertThat(denied).isInstanceOf(AppException.class);
            assertThat(((AppException) denied).getErrorCode()).isEqualTo(ErrorCode.WRITING_HINTS_IN_PROGRESS);
            assertThat(calls.get()).isEqualTo(1);
            assertThat(usedCount()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM writing_hint_requests WHERE user_id = ?", Integer.class, userId)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT quota_reserved FROM writing_hint_requests WHERE user_id = ?", Boolean.class, userId)).isTrue();
            releaseProvider.countDown();
            Future<Object> successFuture = completed.poll(10, TimeUnit.SECONDS);
            assertThat(successFuture).isNotNull();
            Object result = successFuture.get(10, TimeUnit.SECONDS);
            assertThat(result).isInstanceOf(WritingHintsResponse.class);
            WritingHintsResponse success = (WritingHintsResponse) result;
            assertThat(service.generate(userId, success.attemptId(), request(success.requestId()))).isEqualTo(success);
            assertThat(calls.get()).isEqualTo(1);
            assertThat(usedCount()).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT status FROM writing_hint_requests WHERE user_id = ?", String.class, userId)).isEqualTo("SUCCEEDED");
        } finally {
            releaseProvider.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private Object callAfterBarrier(CyclicBarrier start, Integer targetAttempt, String key) throws Exception {
        start.await(10, TimeUnit.SECONDS);
        try {
            return service.generate(userId, targetAttempt, request(key));
        } catch (AppException exception) {
            return exception;
        }
    }

    @Test
    void productionQuotaReservationIsAtomicWithOneRemainingUnit() throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> reserve = () -> {
                start.await(10, TimeUnit.SECONDS);
                return quotaService.tryReserve(userId).isPresent();
            };
            Future<Boolean> first = executor.submit(reserve);
            Future<Boolean> second = executor.submit(reserve);
            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
            assertThat(usedCount()).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void productionConditionalIncrementRejectsStalePeriodExpiredAndNegativeCounters() {
        var account = quotaService.lockAccount(userId);
        jdbc.update("UPDATE user_quotas SET reset_date = ? WHERE id = ?", java.sql.Timestamp.from(NOW.plusSeconds(172800)), quota.getId());
        assertQuotaRejected(account, NOW);
        jdbc.update("UPDATE user_quotas SET reset_date = ? WHERE id = ?", java.sql.Timestamp.from(account.resetDate()), quota.getId());
        assertQuotaRejected(account, account.resetDate());
        jdbc.update("UPDATE user_quotas SET used_count = -1 WHERE id = ?", quota.getId());
        assertQuotaRejected(account, NOW);
        assertThat(usedCount()).isEqualTo(-1);
    }

    private void assertQuotaRejected(UserQuotaReservationService.QuotaAccount account, Instant now) {
        assertThatThrownBy(() -> quotaService.reserve(account, now)).isInstanceOf(AppException.class)
                .satisfies(exception -> assertThat(((AppException) exception).getErrorCode()).isEqualTo(ErrorCode.QUOTA_EXCEEDED));
    }

    @Test
    void repeatedFailureAndCompletionRefundOnlyTheirReservation() {
        var failed = begin(UUID.randomUUID().toString());
        coordinator.fail(failed, ErrorCode.WRITING_HINTS_UNAVAILABLE);
        assertThat(usedCount()).isZero();
        var current = begin(UUID.randomUUID().toString());
        coordinator.fail(failed, ErrorCode.WRITING_HINTS_UNAVAILABLE);
        assertThat(coordinator.complete(failed, content("late"))).isInstanceOf(TerminalDecision.Failure.class);
        assertThat(usedCount()).isEqualTo(1);
        assertThat(ledger(failed.operationId())).containsEntry("status", "FAILED").containsEntry("quota_reserved", false);
        assertThat(coordinator.complete(current, content("current"))).isInstanceOf(TerminalDecision.Success.class);
        var committed = ledger(current.operationId());
        coordinator.fail(current, ErrorCode.WRITING_HINTS_UNAVAILABLE);
        coordinator.complete(current, content("overwrite"));
        assertThat(ledger(current.operationId())).isEqualTo(committed);
        assertThat(usedCount()).isEqualTo(1);
    }

    @Test
    void quotaPeriodResetProtectsNewCounterFromLateRefund() {
        var old = begin(UUID.randomUUID().toString());
        jdbc.update("UPDATE user_quotas SET reset_date = ?, used_count = 1 WHERE id = ?",
                java.sql.Timestamp.from(NOW.plusSeconds(172800)), quota.getId());
        coordinator.fail(old, ErrorCode.WRITING_HINTS_TIMEOUT);
        assertThat(ledger(old.operationId())).containsEntry("status", "FAILED").containsEntry("quota_reserved", false);
        assertThat(usedCount()).isEqualTo(1);
        assertThat(quotaService.refund(old.quotaId(), old.quotaResetDate())).isFalse();
        assertThat(usedCount()).isEqualTo(1);
    }

    @Test
    void expiredLeaseRetryCreatesNewRunAndFencesOldCompleteAndFail() {
        String key = UUID.randomUUID().toString();
        var old = begin(key);
        clock.set(old.leaseUntil()); // Exact boundary, no sleeps and no handwritten recovery SQL.
        var current = begin(key);
        assertThat(current.operationId()).isEqualTo(old.operationId());
        assertThat(current.runId()).isNotEqualTo(old.runId());
        var pending = ledger(current.operationId());
        assertThat(pending).containsEntry("status", "PENDING").containsEntry("quota_reserved", true);
        assertThat(usedCount()).isEqualTo(1);
        assertThat(coordinator.complete(old, content("stale"))).isInstanceOf(TerminalDecision.Failure.class);
        coordinator.fail(old, ErrorCode.WRITING_HINTS_TIMEOUT);
        assertThat(ledger(current.operationId())).isEqualTo(pending);
        assertThat(usedCount()).isEqualTo(1);
        assertThat(coordinator.complete(current, content("new"))).isInstanceOf(TerminalDecision.Success.class);
        var committed = ledger(current.operationId());
        coordinator.complete(old, content("stale again"));
        coordinator.fail(old, ErrorCode.WRITING_HINTS_TIMEOUT);
        assertThat(ledger(current.operationId())).isEqualTo(committed);
        assertThat(usedCount()).isEqualTo(1);
    }

    @Test
    void lazyRecoveryCommitsEvenWhenNewAdmissionFailsThenDoesNotRefundAgain() {
        var expired = begin(UUID.randomUUID().toString());
        clock.set(expired.leaseUntil());
        var invalid = new WritingHintsRequest(30, "w1", UUID.randomUUID().toString(), "xx", "fr");
        var denied = coordinator.begin(userId, attemptId, invalid);
        assertThat(denied).isInstanceOf(BeginDecision.Denied.class);
        assertThat(((BeginDecision.Denied) denied).errorCode()).isEqualTo(ErrorCode.WRITING_HINTS_LANGUAGE_UNSUPPORTED);
        assertThat(ledger(expired.operationId())).containsEntry("status", "FAILED")
                .containsEntry("quota_reserved", false).containsEntry("failure_code", "LEASE_EXPIRED");
        assertThat(usedCount()).isZero();
        var current = begin(UUID.randomUUID().toString());
        coordinator.fail(expired, ErrorCode.WRITING_HINTS_TIMEOUT);
        coordinator.complete(expired, content("stale"));
        assertThat(usedCount()).isEqualTo(1);
        assertThat(ledger(current.operationId())).containsEntry("status", "PENDING").containsEntry("quota_reserved", true);
        coordinator.fail(current, ErrorCode.WRITING_HINTS_UNAVAILABLE);
        assertThat(usedCount()).isZero();
    }
}
