package com.multilingo.backend.modules.testing.repository;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.*;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class WritingHintPostgresIT {

    private boolean isPostgresConfigured() {
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        return pgUrl != null && !pgUrl.isBlank() &&
                pgUser != null && !pgUser.isBlank() &&
                pgPassword != null && !pgPassword.isBlank();
    }

    private Connection getPostgresConnection() throws SQLException {
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        return DriverManager.getConnection(pgUrl, pgUser, pgPassword);
    }

    private void seedPrerequisiteTables(Connection conn, String schemaName) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("CREATE SCHEMA " + schemaName);
            stmt.execute("SET search_path TO " + schemaName);

            stmt.execute("""
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL
                );

                CREATE TABLE user_quotas (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    feature_code VARCHAR(50) NOT NULL,
                    max_limit INT NOT NULL DEFAULT 5,
                    used_count INT NOT NULL DEFAULT 0,
                    reset_date TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE test_attempts (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    exam_id INT NOT NULL,
                    test_mode VARCHAR(50) NOT NULL DEFAULT 'PRACTICE',
                    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """);
        }
    }

    @Test
    @DisplayName("PostgreSQL Migration: V20261012180000 áp dụng thành công và tạo đúng cấu trúc bảng, chỉ mục")
    void migrationAppliesSuccessfullyOnIsolatedPostgresSchema() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping Postgres IT");

        String schemaName = "tv3_18_pg_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            // Chạy migration nhắm đến schema cô lập
            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261010233000")
                    .baselineOnMigrate(true)
                    .target("20261012180000")
                    .load();

            flyway.migrate();

            // 1. Kiểm tra version hiện tại là 20261012180000
            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("20261012180000");

            // 2. Xác thực bảng writing_hint_requests tồn tại
            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ? AND table_name = 'writing_hint_requests'
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                }
            }

            // 3. Xác thực các partial unique index và recovery index
            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT indexname FROM pg_indexes
                WHERE schemaname = ?
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    java.util.List<String> indexes = new java.util.ArrayList<>();
                    while (rs.next()) {
                        indexes.add(rs.getString("indexname"));
                    }
                    assertThat(indexes).contains(
                            "uq_user_quotas_ai_writing_hints",
                            "idx_writing_hint_requests_pending_user",
                            "idx_writing_hint_requests_lease_recovery",
                            "idx_writing_hint_requests_attempt_id"
                    );
                }
            }

            // Same-key uniqueness also applies after a request is terminal (independent of the PENDING index).
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("INSERT INTO users (id, username, email) VALUES (1, 'key-user', 'key@test.com')");
                stmt.execute("INSERT INTO test_attempts (id, user_id, exam_id) VALUES (1, 1, 10)");
                stmt.execute("""
                        INSERT INTO writing_hint_requests
                        (user_id, attempt_id, part_id, question_id, request_id, request_fingerprint, context_json, status)
                        VALUES (1, 1, 30, 'w1', 'same-key', 'fingerprint', '{}', 'SUCCEEDED')
                        """);
                assertThatThrownBy(() -> stmt.execute("""
                        INSERT INTO writing_hint_requests
                        (user_id, attempt_id, part_id, question_id, request_id, request_fingerprint, context_json, status)
                        VALUES (1, 1, 30, 'w1', 'same-key', 'fingerprint', '{}', 'FAILED')
                        """))
                        .isInstanceOf(SQLException.class)
                        .satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23505"));
                stmt.execute("INSERT INTO user_quotas (user_id, feature_code, reset_date) VALUES (1, 'AI_WRITING_HINTS', NOW() + INTERVAL '1 day')");
                assertThatThrownBy(() -> stmt.execute("INSERT INTO user_quotas (user_id, feature_code, reset_date) VALUES (1, 'AI_WRITING_HINTS', NOW() + INTERVAL '1 day')"))
                        .isInstanceOf(SQLException.class)
                        .satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23505"));
            }
        } finally {
            // Dọn dẹp schema cô lập hoàn toàn, không đụng public schema
            try (Connection conn = getPostgresConnection(); Statement stmt = conn.createStatement()) {
                stmt.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
            }
        }
    }

    @Test
    @DisplayName("PostgreSQL Precheck: Migration từ chối chạy khi phát hiện duplicate row trong user_quotas")
    void migrationFailsWhenDuplicateUserQuotasExist() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping Postgres IT");

        String schemaName = "tv3_18_pg_dup_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            // Chèn dữ liệu duplicate cố ý
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("INSERT INTO " + schemaName + ".users (id, username, email) VALUES (1, 'dupuser', 'dup@test.com')");
                stmt.execute("INSERT INTO " + schemaName + ".user_quotas (user_id, feature_code, max_limit, reset_date) VALUES (1, 'AI_WRITING_HINTS', 5, NOW() + INTERVAL '1 day')");
                stmt.execute("INSERT INTO " + schemaName + ".user_quotas (user_id, feature_code, max_limit, reset_date) VALUES (1, 'AI_WRITING_HINTS', 5, NOW() + INTERVAL '1 day')");
            }

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261010233000")
                    .baselineOnMigrate(true)
                    .target("20261012180000")
                    .load();

            // Phải ném ngoại lệ do precheck block migration
            assertThatThrownBy(flyway::migrate)
                    .isInstanceOf(FlywayException.class)
                    .hasMessageContaining("Duplicate user_quotas rows found for feature AI_WRITING_HINTS");

        } finally {
            try (Connection conn = getPostgresConnection(); Statement stmt = conn.createStatement()) {
                stmt.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
            }
        }
    }

    @Test
    @DisplayName("PostgreSQL JDBC/index semantics: atomic counter và partial unique PENDING; production paths ở WritingHintPostgresTransactionIT")
    void postgresQuotaAndLedgerConcurrencyGuards() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping Postgres IT");

        String schemaName = "tv3_18_pg_race_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261010233000")
                    .baselineOnMigrate(true)
                    .target("20261012180000")
                    .load();
            flyway.migrate();

            // Chèn user và quota có maxLimit = 1, usedCount = 0
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("INSERT INTO " + schemaName + ".users (id, username, email) VALUES (1, 'raceuser', 'race@test.com')");
                stmt.execute("INSERT INTO " + schemaName + ".user_quotas (id, user_id, feature_code, max_limit, used_count, reset_date) " +
                        "VALUES (100, 1, 'AI_WRITING_HINTS', 1, 0, NOW() + INTERVAL '1 day')");
                stmt.execute("INSERT INTO " + schemaName + ".test_attempts (id, user_id, exam_id) VALUES (500, 1, 10)");
            }

            // 1. Concurrency Test: 2 luồng đồng thời tranh chấp quota reservation (maxLimit = 1)
            int threadCount = 2;
            CyclicBarrier barrier = new CyclicBarrier(threadCount);
            AtomicInteger successCount = new AtomicInteger(0);

            List<Callable<Void>> tasks = new java.util.ArrayList<>();
            for (int i = 0; i < threadCount; i++) {
                tasks.add(() -> {
                    try (Connection workerConn = getPostgresConnection()) {
                        barrier.await(10, TimeUnit.SECONDS);
                        try (PreparedStatement ps = workerConn.prepareStatement(
                                "UPDATE " + schemaName + ".user_quotas " +
                                        "SET used_count = used_count + 1 " +
                                        "WHERE id = 100 AND used_count < max_limit AND reset_date > NOW()"
                        )) {
                            int updated = ps.executeUpdate();
                            if (updated > 0) {
                                successCount.incrementAndGet();
                            }
                        }
                    }
                    return null;
                });
            }

            List<Future<Void>> futures = executor.invokeAll(tasks, 15, TimeUnit.SECONDS);
            for (Future<Void> f : futures) {
                f.get(10, TimeUnit.SECONDS);
            }

            // Chính xác 1 luồng được cấp quota
            assertThat(successCount.get()).isEqualTo(1);

            // DB used_count phải là 1
            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT used_count FROM " + schemaName + ".user_quotas WHERE id = 100")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt("used_count")).isEqualTo(1);
            }

            // 2. Concurrency Test: 2 luồng tranh chấp partial unique PENDING
            AtomicInteger pendingInsertCount = new AtomicInteger(0);
            CyclicBarrier pendingBarrier = new CyclicBarrier(threadCount);

            List<Callable<Void>> pendingTasks = new java.util.ArrayList<>();
            for (int i = 0; i < threadCount; i++) {
                final int idx = i;
                pendingTasks.add(() -> {
                    try (Connection workerConn = getPostgresConnection()) {
                        pendingBarrier.await(10, TimeUnit.SECONDS);
                        try (PreparedStatement ps = workerConn.prepareStatement(
                                "INSERT INTO " + schemaName + ".writing_hint_requests " +
                                        "(user_id, attempt_id, part_id, question_id, request_id, request_fingerprint, context_json, status) " +
                                        "VALUES (1, 500, 1, 'q1', 'req-pending-" + idx + "', 'fp" + idx + "', '{}', 'PENDING')"
                        )) {
                            ps.executeUpdate();
                            pendingInsertCount.incrementAndGet();
                        } catch (SQLException e) {
                            assertThat(e.getSQLState()).isEqualTo("23505");
                        }
                    }
                    return null;
                });
            }

            futures = executor.invokeAll(pendingTasks, 15, TimeUnit.SECONDS);
            for (Future<Void> f : futures) {
                f.get(10, TimeUnit.SECONDS);
            }

            // Partial unique index đảm bảo chỉ tối đa 1 dòng PENDING cho user
            assertThat(pendingInsertCount.get()).isEqualTo(1);

        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
            try (Connection conn = getPostgresConnection(); Statement stmt = conn.createStatement()) {
                stmt.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
            }
        }
    }
}
