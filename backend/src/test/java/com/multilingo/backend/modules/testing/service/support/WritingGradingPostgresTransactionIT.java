package com.multilingo.backend.modules.testing.service.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.analytics.entity.UserQuota;
import com.multilingo.backend.modules.analytics.repository.UserQuotaRepository;
import com.multilingo.backend.modules.analytics.service.UserQuotaReservationService;
import com.multilingo.backend.modules.testing.adapter.impl.DbWritingGradingQuotaAdapter;
import com.multilingo.backend.modules.testing.ai.gemini.GeminiProperties;
import com.multilingo.backend.modules.testing.ai.grading.WritingGrade;
import com.multilingo.backend.modules.testing.ai.grading.WritingGradingFailure;
import com.multilingo.backend.modules.testing.ai.media.ImageFetchProperties;
import com.multilingo.backend.modules.testing.config.WritingGradingProperties;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.repository.AttemptAnswerRepository;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.repository.WritingGradingJobRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.support.AopUtils;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.persistenceunit.PersistenceManagedTypes;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.*;

/** Production Spring proxies/repositories/quota adapter in a disposable, migrated PostgreSQL schema. */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@EnabledIfEnvironmentVariable(named = "TV3_PG_TEST_URL", matches = "jdbc:postgresql:.*")
class WritingGradingPostgresTransactionIT {
    private static final Instant NOW = Instant.parse("2026-10-15T10:00:00Z");
    private final String schema = "tv32005_" + UUID.randomUUID().toString().replace("-", "");
    private AnnotationConfigApplicationContext spring;
    private DataSource dataSource;
    private JdbcTemplate jdbc;
    private WritingGradingTransactionCoordinator coordinator;
    private GateClock clock;

    @TestConfiguration(proxyBeanMethods = false)
    @EnableTransactionManagement(proxyTargetClass = true)
    @EnableJpaRepositories(
            basePackageClasses = {WritingGradingJobRepository.class, UserQuotaRepository.class},
            includeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE,
                    classes = {WritingGradingJobRepository.class, TestAttemptRepository.class,
                            AttemptAnswerRepository.class, UserQuotaRepository.class}))
    @Import({WritingGradingTransactionCoordinator.class, WritingGradingAttemptStateResolver.class,
            DbWritingGradingQuotaAdapter.class, UserQuotaReservationService.class})
    static class JpaConfig {
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource dataSource) {
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(dataSource);
            factory.setManagedTypes(PersistenceManagedTypes.of(TestAttempt.class.getName(), AttemptAnswer.class.getName(),
                    WritingGradingJob.class.getName(), UserQuota.class.getName()));
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "none"));
            return factory;
        }
        @Bean EntityManager entityManager(EntityManagerFactory factory) {
            return SharedEntityManagerCreator.createSharedEntityManager(factory);
        }
        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory factory) {
            return new JpaTransactionManager(factory);
        }
        @Bean ObjectMapper objectMapper() { return new ObjectMapper(); }
        @Bean GateClock clock() { return new GateClock(); }
        @Bean WritingGradingProperties gradingProperties() {
            var properties = new WritingGradingProperties();
            properties.setEnabled(true);
            return properties;
        }
        @Bean GeminiProperties geminiProperties() {
            var properties = new GeminiProperties();
            properties.setEnabled(true);
            properties.setRequestTimeout(Duration.ofSeconds(30));
            return properties;
        }
        @Bean ImageFetchProperties imageFetchProperties() { return new ImageFetchProperties(); }
    }

    /** Pause the holder at the coordinator's real clock read, after its production locks. */
    static final class GateClock extends Clock {
        final ThreadLocal<Gate> active = new ThreadLocal<>();
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() {
            Gate gate = active.get();
            if (gate != null && gate.once.compareAndSet(false, true)) {
                gate.entered.countDown();
                try {
                    if (!gate.release.await(15, TimeUnit.SECONDS)) throw new AssertionError("Holder was not released");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new AssertionError(e);
                }
            }
            return NOW;
        }
    }
    static final class Gate {
        final AtomicBoolean once = new AtomicBoolean();
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
    }

    @BeforeAll
    void startProductionContext() throws Exception {
        String url = Objects.requireNonNull(System.getenv("TV3_PG_TEST_URL"));
        String user = Objects.requireNonNull(System.getenv("TV3_PG_TEST_USER"));
        String password = Objects.requireNonNull(System.getenv("TV3_PG_TEST_PASSWORD"));
        var admin = new DriverManagerDataSource(url, user, password);
        try (Connection connection = admin.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            statement.execute("SET search_path TO " + schema);
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("fixtures/writing-grading-pg-prerequisites.sql"));
        }
        Flyway.configure().dataSource(url, user, password).schemas(schema)
                .locations("classpath:db/migration").baselineOnMigrate(true).baselineVersion("20261012180000")
                .target("20261013210000").load().migrate();
        dataSource = new DriverManagerDataSource(url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema, user, password) {
            @Override public Connection getConnection() throws SQLException {
                Connection connection = super.getConnection();
                connection.setClientInfo("ApplicationName", schema + "_" + Thread.currentThread().getName());
                try (var statement = connection.createStatement()) {
                    statement.execute("SET statement_timeout = '12s'");
                }
                return connection;
            }
        };
        jdbc = new JdbcTemplate(dataSource);
        spring = new AnnotationConfigApplicationContext();
        spring.registerBean(DataSource.class, () -> dataSource);
        spring.register(JpaConfig.class);
        spring.refresh();
        coordinator = spring.getBean(WritingGradingTransactionCoordinator.class);
        clock = spring.getBean(GateClock.class);
        assertThat(AopUtils.isAopProxy(coordinator)).isTrue();
        assertThat(AopUtils.isAopProxy(spring.getBean(UserQuotaReservationService.class))).isTrue();
        assertThat(spring.getBean(DbWritingGradingQuotaAdapter.class)).isNotNull();
    }

    @BeforeEach
    void seed() {
        jdbc.execute("DROP TRIGGER IF EXISTS reject_change ON writing_grading_jobs");
        jdbc.execute("DROP TRIGGER IF EXISTS reject_change ON test_attempts");
        jdbc.execute("TRUNCATE writing_grading_jobs, attempt_answers, test_attempts, user_quotas, users, roles RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO roles(id,name) VALUES (1,'STUDENT')");
        jdbc.update("INSERT INTO users(id,email,full_name,role_id) VALUES (1,'test@example.test','Student',1)");
        jdbc.update("INSERT INTO user_quotas(id,user_id,feature_code,max_limit,used_count,reset_date) VALUES (1,1,'AI_WRITING_GRADING',5,0,?)",
                java.sql.Timestamp.from(NOW.plusSeconds(86400)));
        jdbc.update("INSERT INTO test_attempts(id,user_id,exam_id,status,start_time,overall_score,section_scores) "
                + "VALUES(10,1,100,'AI_GRADING_QUEUED',?,8.25,'{\"READING\":8.25}'::jsonb)", java.sql.Timestamp.from(NOW));
        jdbc.update("INSERT INTO attempt_answers(attempt_id,part_id,user_answers,is_correct_flags,earned_score,ai_feedback) "
                + "VALUES(10,1,'{\"q-1\":\"essay one\",\"q-2\":\"essay two\"}'::jsonb,'{\"objective\":true}'::jsonb,4.5,"
                + "'{\"schemaVersion\":1,\"tasks\":{\"prior\":{\"overallFeedback\":\"keep prior\"}}}'::jsonb)");
    }

    @AfterAll
    void closeAndDropOwnedSchema() {
        if (spring != null) spring.close();
        if (jdbc != null) {
            if (!schema.matches("tv32005_[a-f0-9]{32}")) throw new AssertionError("Invalid owned schema");
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }

    private void job(int id, String question) {
        jdbc.update("INSERT INTO writing_grading_jobs(id,attempt_id,part_id,question_id,context_json,input_hash,status,attempt_count,image_count,quota_reserved) "
                + "VALUES(?,10,1,?,?::jsonb,?,'READY',0,0,false)", id, question,
                "{\"partId\":1,\"questionId\":\"" + question + "\",\"taskPrompt\":\"Prompt\",\"originalText\":\"Essay\",\"learningLanguage\":\"en\",\"wordCount\":20}", "hash-" + question);
    }
    private Claim claim(int id) {
        ClaimDecision decision = coordinator.claim(id);
        assertThat(decision).isInstanceOf(ClaimDecision.Granted.class);
        return ((ClaimDecision.Granted)decision).claim();
    }
    private WritingGrade grade(String feedback) {
        return new WritingGrade("WRITING_EN_V1", "vi", new BigDecimal("6.5"), List.of(), feedback, "Essay", List.of(), List.of());
    }
    private int used() { return jdbc.queryForObject("SELECT used_count FROM user_quotas WHERE id=1", Integer.class); }
    private Map<String, List<String>> snapshot() {
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (String table : List.of("writing_grading_jobs", "user_quotas", "attempt_answers", "test_attempts")) {
            result.put(table, jdbc.queryForList("SELECT row_to_json(t)::text FROM " + table + " t ORDER BY id", String.class));
        }
        return result;
    }

    /** Collect both futures so assertion/SQL failures in either participant reach JUnit. */
    private <T> List<T> overlap(Supplier<T> holder, Supplier<T> waiter) throws Exception {
        Gate gate = new Gate();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<T> first = executor.submit(() -> {
                Thread.currentThread().setName("holder");
                clock.active.set(gate);
                try { return holder.get(); } finally { clock.active.remove(); }
            });
            assertThat(gate.entered.await(8, TimeUnit.SECONDS)).as("Holder reached production clock after locks").isTrue();
            Future<T> second = executor.submit(() -> {
                Thread.currentThread().setName("waiter");
                return waiter.get();
            });
            try { assertSpecificAttemptLockWait(); } finally { gate.release.countDown(); }
            return List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        } finally {
            gate.release.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(15, TimeUnit.SECONDS)).isTrue();
        }
    }
    private void assertSpecificAttemptLockWait() {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(6);
        while (System.nanoTime() < deadline) {
            List<Map<String, Object>> waits = jdbc.queryForList("""
                    SELECT w.pid AS waiter, h.pid AS holder, w.query
                    FROM pg_stat_activity w JOIN pg_stat_activity h
                      ON h.pid = ANY(pg_blocking_pids(w.pid))
                    WHERE w.application_name = ? AND h.application_name = ?
                      AND w.wait_event_type = 'Lock'
                    """, schema + "_waiter", schema + "_holder");
            if (!waits.isEmpty()) {
                assertThat(waits).hasSize(1);
                assertThat(waits.getFirst().get("waiter")).isNotEqualTo(waits.getFirst().get("holder"));
                assertThat(waits.getFirst().get("query").toString()).contains("test_attempts").containsPattern("(?i)for (?:no key )?update");
                System.out.println("PG_COORDINATOR_LOCK_WAIT " + waits.getFirst());
                return;
            }
            Thread.onSpinWait();
        }
        fail("Specific coordinator waiter did not block on holder's attempt lock");
    }

    @Test
    void concurrentClaim_productionProxy_oneWinnerOneReservation() throws Exception {
        job(1, "q-1");
        List<ClaimDecision> decisions = overlap(() -> coordinator.claim(1), () -> coordinator.claim(1));
        assertThat(decisions).filteredOn(ClaimDecision.Granted.class::isInstance).hasSize(1);
        assertThat(decisions).filteredOn(ClaimDecision.Rejected.class::isInstance).hasSize(1);
        assertThat(used()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT attempt_count FROM writing_grading_jobs WHERE id=1", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT quota_reserved FROM writing_grading_jobs WHERE id=1", Boolean.class)).isTrue();
    }

    @Test
    void concurrentCompletion_productionProxy_mergesBothEssaysAndPreservesObjectiveData() throws Exception {
        job(1, "q-1"); job(2, "q-2");
        Claim first = claim(1), second = claim(2);
        var objectiveBefore = jdbc.queryForMap("SELECT user_answers::text,is_correct_flags::text,earned_score FROM attempt_answers WHERE part_id=1");
        overlap(() -> { coordinator.complete(first, grade("Feedback one")); return true; },
                () -> { coordinator.complete(second, grade("Feedback two")); return true; });
        String feedback = jdbc.queryForObject("SELECT ai_feedback::text FROM attempt_answers WHERE part_id=1", String.class);
        Map<?, ?> tasks = (Map<?, ?>)new ObjectMapper().readValue(feedback, Map.class).get("tasks");
        assertThat(tasks.keySet().stream().map(Object::toString).toList()).containsExactlyInAnyOrder("prior", "q-1", "q-2");
        assertThat(((Map<?, ?>)tasks.get("q-1")).get("overallFeedback")).isEqualTo("Feedback one");
        assertThat(((Map<?, ?>)tasks.get("q-2")).get("overallFeedback")).isEqualTo("Feedback two");
        assertThat(((Map<?, ?>)tasks.get("prior")).get("overallFeedback")).isEqualTo("keep prior");
        assertThat(jdbc.queryForMap("SELECT user_answers::text,is_correct_flags::text,earned_score FROM attempt_answers WHERE part_id=1")).isEqualTo(objectiveBefore);
        assertThat(jdbc.queryForList("SELECT status FROM writing_grading_jobs ORDER BY id", String.class)).containsExactly("SUCCEEDED", "SUCCEEDED");
        assertThat(jdbc.queryForObject("SELECT status FROM test_attempts WHERE id=10", String.class)).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("SELECT overall_score FROM test_attempts WHERE id=10", BigDecimal.class)).isEqualByComparingTo("8.25");
        assertThat(used()).isEqualTo(2);
    }

    /** Deferred trigger fails at COMMIT, after production has changed all participating rows. */
    private void rejectCommit(String table, String status) {
        if (!List.of("writing_grading_jobs", "test_attempts").contains(table)) throw new AssertionError("Invalid table");
        jdbc.execute("CREATE OR REPLACE FUNCTION reject_test_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN "
                + "IF NEW.status = '" + status + "' THEN RAISE EXCEPTION 'forced_coordinator_rollback'; END IF; RETURN NEW; END $$");
        jdbc.execute("CREATE CONSTRAINT TRIGGER reject_change AFTER INSERT OR UPDATE ON " + table
                + " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_test_commit()");
    }
    private void assertRolledBack(Runnable call) {
        Map<String, List<String>> before = snapshot();
        assertThatThrownBy(call::run).hasStackTraceContaining("forced_coordinator_rollback");
        assertThat(snapshot()).as("Quota, feedback, job and attempt must roll back together").isEqualTo(before);
    }

    @Test
    void claim_commitFailure_rollsBackReservationRunAndAttemptStatus() {
        job(1, "q-1");
        rejectCommit("writing_grading_jobs", "RUNNING");
        assertRolledBack(() -> coordinator.claim(1));
        assertThat(used()).isZero();
    }

    @Test
    void completion_commitFailure_rollsBackFeedbackJobReservationAndAttemptStatus() {
        job(1, "q-1"); Claim claim = claim(1);
        rejectCommit("test_attempts", "COMPLETED");
        assertRolledBack(() -> coordinator.complete(claim, grade("must not persist")));
        assertThat(used()).isEqualTo(1);
    }

    @Test
    void terminalFailure_commitFailure_rollsBackRefundAndJobStatus() {
        job(1, "q-1"); Claim claim = claim(1);
        rejectCommit("writing_grading_jobs", "FAILED");
        assertRolledBack(() -> coordinator.fail(claim, WritingGradingFailure.terminal("INVALID_INPUT", "Safe failure")));
        assertThat(used()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void oldPeriodReservation_terminalFailureOrRecovery_doesNotDecrementNewPeriod(boolean recovery) {
        job(1, "q-1"); Claim claim = claim(1);
        Instant newPeriod = NOW.plusSeconds(172800);
        jdbc.update("UPDATE user_quotas SET reset_date=?,used_count=2 WHERE id=1", java.sql.Timestamp.from(newPeriod));
        if (recovery) {
            jdbc.update("UPDATE writing_grading_jobs SET attempt_count=4,lease_until=? WHERE id=1", java.sql.Timestamp.from(NOW.minusSeconds(1)));
            assertThat(coordinator.recoverExpired(10)).isEqualTo(1);
            assertThat(coordinator.recoverExpired(10)).isZero();
        } else {
            coordinator.fail(claim, WritingGradingFailure.terminal("INVALID_INPUT", "Safe failure"));
            coordinator.fail(claim, WritingGradingFailure.terminal("INVALID_INPUT", "Safe failure"));
        }
        assertThat(used()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT reset_date FROM user_quotas WHERE id=1", java.sql.Timestamp.class).toInstant()).isEqualTo(newPeriod);
        assertThat(jdbc.queryForObject("SELECT quota_reserved FROM writing_grading_jobs WHERE id=1", Boolean.class)).isFalse();
        assertThat(jdbc.queryForObject("SELECT status FROM writing_grading_jobs WHERE id=1", String.class)).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT status FROM test_attempts WHERE id=10", String.class)).isEqualTo("GRADING_FAILED");
        assertThat(jdbc.queryForObject("SELECT ai_feedback->'tasks'->'q-1' FROM attempt_answers WHERE part_id=1", String.class)).isNull();

        // Positive control: a reservation from the current period must still refund exactly once.
        job(2, "q-2");
        Claim current = claim(2);
        assertThat(used()).isEqualTo(3);
        coordinator.fail(current, WritingGradingFailure.terminal("INVALID_INPUT", "Safe failure"));
        coordinator.fail(current, WritingGradingFailure.terminal("INVALID_INPUT", "Safe failure"));
        assertThat(used()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT quota_reserved FROM writing_grading_jobs WHERE id=2", Boolean.class)).isFalse();
    }

    @Test
    void staleCompletion_afterRetry_rejectsOldRunWithoutMutation() {
        job(1, "q-1"); Claim old = claim(1);
        coordinator.fail(old, WritingGradingFailure.retryable("TIMEOUT", "Safe timeout"));
        jdbc.update("UPDATE writing_grading_jobs SET next_attempt_at=? WHERE id=1", java.sql.Timestamp.from(NOW.minusSeconds(1)));
        Claim fresh = claim(1);
        assertThat(fresh.runId()).isNotEqualTo(old.runId());
        var before = snapshot();
        coordinator.complete(old, grade("stale feedback"));
        assertThat(snapshot()).isEqualTo(before);
        coordinator.complete(fresh, grade("fresh feedback"));
        assertThat(jdbc.queryForObject("SELECT result_json->>'overallFeedback' FROM writing_grading_jobs WHERE id=1", String.class)).isEqualTo("fresh feedback");
        assertThat(used()).isEqualTo(1);
    }
}
