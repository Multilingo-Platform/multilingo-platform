package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.WritingGradingJob;
import com.multilingo.backend.modules.testing.entity.enums.WritingGradingJobStatus;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class WritingGradingPostgresIT {

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
                CREATE TABLE roles (
                    id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE
                );

                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    full_name VARCHAR(150),
                    role_id INT NOT NULL REFERENCES roles(id)
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
    @DisplayName("PostgreSQL Migration: V20261013210000 áp dụng thành công và tạo đúng cấu trúc bảng, chỉ mục")
    void migrationAppliesSuccessfullyOnIsolatedPostgresSchema() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping Postgres IT");

        String schemaName = "tv3_20_pg_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261012180000")
                    .baselineOnMigrate(true)
                    .target("20261013210000")
                    .load();

            flyway.migrate();

            // 1. Kiểm tra version hiện tại là 20261013210000
            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("20261013210000");

            // 2. Xác thực bảng writing_grading_jobs và cột image_count tồn tại
            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ? AND table_name = 'writing_grading_jobs'
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                }
            }

            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = 'writing_grading_jobs' AND column_name = 'image_count'
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getString("data_type")).isEqualTo("smallint");
                    assertThat(rs.getString("is_nullable")).isEqualTo("NO");
                    assertThat(rs.getString("column_default")).contains("0");
                }
            }

            // 3. Xác thực các partial unique index và recovery index
            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT indexname FROM pg_indexes
                WHERE schemaname = ?
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    List<String> indexes = new java.util.ArrayList<>();
                    while (rs.next()) {
                        indexes.add(rs.getString("indexname"));
                    }
                    assertThat(indexes).contains(
                            "uq_user_quotas_ai_writing_grading",
                            "idx_writing_grading_jobs_attempt_id",
                            "idx_writing_grading_jobs_due",
                            "idx_writing_grading_jobs_expired_lease",
                            "idx_writing_grading_jobs_waiting"
                    );
                }
            }
        }
    }

    @Test
    @DisplayName("Precheck ngăn migration chạy nếu đã có duplicate quota rows cho AI_WRITING_GRADING")
    void precheckFailsWhenDuplicateGradingQuotasExist() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment not configured - skipping Postgres IT");

        String schemaName = "tv3_20_fail_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET search_path TO " + schemaName);
                stmt.execute("INSERT INTO roles (id, name) VALUES (1, 'STUDENT')");
                stmt.execute("INSERT INTO users (id, email, full_name, role_id) VALUES (1, 'u1@test.com', 'U1', 1)");

                // Tạo 2 dòng duplicate quota cho cùng user và AI_WRITING_GRADING
                stmt.execute("""
                    INSERT INTO user_quotas (user_id, feature_code, max_limit, used_count, reset_date)
                    VALUES (1, 'AI_WRITING_GRADING', 5, 0, NOW() + INTERVAL '1 day');
                    INSERT INTO user_quotas (user_id, feature_code, max_limit, used_count, reset_date)
                    VALUES (1, 'AI_WRITING_GRADING', 5, 0, NOW() + INTERVAL '1 day');
                """);
            }

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261012180000")
                    .baselineOnMigrate(true)
                    .target("20261013210000")
                    .load();

            assertThatThrownBy(flyway::migrate)
                    .isInstanceOf(FlywayException.class)
                    .hasMessageContaining("Precheck failed: Duplicate user_quotas rows found for feature AI_WRITING_GRADING");
        }
    }

    @Test
    @DisplayName("Ràng buộc toàn vẹn PostgreSQL: attempt_count 0..4, RUNNING constraints, unique attempt/part/question")
    void postgresConstraintsEnforceJobIntegrity() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment not configured - skipping Postgres IT");

        String schemaName = "tv3_20_chk_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261012180000")
                    .baselineOnMigrate(true)
                    .target("20261013210000")
                    .load();

            flyway.migrate();

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET search_path TO " + schemaName);
                stmt.execute("INSERT INTO roles (id, name) VALUES (1, 'STUDENT')");
                stmt.execute("INSERT INTO users (id, email, full_name, role_id) VALUES (1, 'user@test.com', 'User', 1)");
                stmt.execute("INSERT INTO test_attempts (id, user_id, exam_id) VALUES (10, 1, 100)");

                // 1. attempt_count > 4 ném lỗi check constraint
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, attempt_count)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'READY', 5)
                """)).isInstanceOf(SQLException.class);

                // 2. attempt_count < 0 ném lỗi check constraint
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, attempt_count)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'READY', -1)
                """)).isInstanceOf(SQLException.class);

                // 2b. image_count > 2 ném lỗi check constraint
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, image_count)
                    VALUES (10, 1, 'q-img-high', '{"prompt":"test"}'::jsonb, 'hash1', 'READY', 3)
                """)).isInstanceOf(SQLException.class);

                // 2c. image_count < 0 ném lỗi check constraint
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, image_count)
                    VALUES (10, 1, 'q-img-low', '{"prompt":"test"}'::jsonb, 'hash1', 'READY', -1)
                """)).isInstanceOf(SQLException.class);

                // 2d. image_count = 0, 1, 2 đều hợp lệ và mặc định là 0
                for (int count = 0; count <= 2; count++) {
                    stmt.execute(String.format("""
                        INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, image_count)
                        VALUES (10, 2, 'q-img-%d', '{"prompt":"test"}'::jsonb, 'hash-%d', 'READY', %d)
                    """, count, count, count));
                }

                // 3. RUNNING thiếu run_id, lease_until hoặc quota_reserved ném lỗi check constraint
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, run_id, lease_until, quota_reserved)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'RUNNING', NULL, NOW() + INTERVAL '1 minute', TRUE)
                """)).isInstanceOf(SQLException.class);

                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, run_id, lease_until, quota_reserved)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'RUNNING', 'run-1', NULL, TRUE)
                """)).isInstanceOf(SQLException.class);

                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, run_id, lease_until, quota_reserved)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'RUNNING', 'run-1', NOW() + INTERVAL '1 minute', FALSE)
                """)).isInstanceOf(SQLException.class);

                // 4. RUNNING hợp lệ được chấp nhận
                stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status, run_id, lease_until, quota_reserved)
                    VALUES (10, 1, 'q1', '{"prompt":"test"}'::jsonb, 'hash1', 'RUNNING', 'run-1', NOW() + INTERVAL '1 minute', TRUE)
                """);

                // 5. Unique constraint (attempt_id, part_id, question_id)
                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO writing_grading_jobs (attempt_id, part_id, question_id, context_json, input_hash, status)
                    VALUES (10, 1, 'q1', '{"prompt":"duplicate"}'::jsonb, 'hash2', 'READY')
                """)).isInstanceOf(SQLException.class)
                  .satisfies(e -> assertThat(((SQLException) e).getSQLState()).isEqualTo("23505"));

                // 6. Partial unique index uq_user_quotas_ai_writing_grading
                stmt.execute("""
                    INSERT INTO user_quotas (user_id, feature_code, max_limit, used_count, reset_date)
                    VALUES (1, 'AI_WRITING_GRADING', 5, 0, NOW() + INTERVAL '1 day')
                """);

                assertThatThrownBy(() -> stmt.execute("""
                    INSERT INTO user_quotas (user_id, feature_code, max_limit, used_count, reset_date)
                    VALUES (1, 'AI_WRITING_GRADING', 5, 0, NOW() + INTERVAL '1 day')
                """)).isInstanceOf(SQLException.class)
                  .satisfies(e -> assertThat(((SQLException) e).getSQLState()).isEqualTo("23505"));
            }
        }
    }

    @Test
    @DisplayName("TV3-20-03-R3: Hibernate ddl-auto=validate thành công trên PostgreSQL và JPA round-trip imageCount 0, 1, 2")
    void hibernateSchemaValidationAndJpaRoundTripSucceedsAgainstPostgresMigration() throws Exception {
        assumeTrue(isPostgresConfigured(),
                "PostgreSQL test environment not configured - skipping Postgres IT");

        String schemaName = "tv3_20_hib_" + UUID.randomUUID().toString().replace("-", "");
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        try (Connection conn = getPostgresConnection()) {
            seedPrerequisiteTables(conn, schemaName);

            try (Statement stmt = conn.createStatement()) {
                stmt.execute("SET search_path TO " + schemaName);
                stmt.execute("INSERT INTO roles (id, name) VALUES (1, 'STUDENT')");
                stmt.execute("INSERT INTO users (id, email, full_name, role_id) VALUES (1, 'user@test.com', 'User', 1)");
                stmt.execute("INSERT INTO test_attempts (id, user_id, exam_id) VALUES (10, 1, 100)");
            }

            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261012180000")
                    .baselineOnMigrate(true)
                    .target("20261013210000")
                    .load();

            flyway.migrate();

            StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                    .applySetting("hibernate.connection.url", pgUrl)
                    .applySetting("hibernate.connection.username", pgUser)
                    .applySetting("hibernate.connection.password", pgPassword)
                    .applySetting("hibernate.connection.driver_class", "org.postgresql.Driver")
                    .applySetting("hibernate.default_schema", schemaName)
                    .applySetting("hibernate.hbm2ddl.auto", "validate")
                    .applySetting("hibernate.type.json_format_mapper", "jackson")
                    .build();

            try {
                try (SessionFactory sessionFactory = new MetadataSources(registry)
                        .addAnnotatedClass(WritingGradingJob.class)
                        .buildMetadata()
                        .buildSessionFactory()) {

                    // Schema validation đã pass khi buildSessionFactory() không ném SchemaManagementException.
                    // Tiếp theo: kiểm tra JPA round-trip lưu và đọc các giá trị imageCount 0, 1, 2.
                    for (int count = 0; count <= 2; count++) {
                        Integer savedId;
                        try (Session session = sessionFactory.openSession()) {
                            Transaction tx = session.beginTransaction();
                            WritingGradingJob job = WritingGradingJob.builder()
                                    .attemptId(10)
                                    .partId(1)
                                    .questionId("q-hib-" + count)
                                    .contextJson(Map.of("prompt", "Hibernate roundtrip test", "count", count))
                                    .inputHash("hash-hib-" + count)
                                    .status(WritingGradingJobStatus.READY)
                                    .imageCount(count)
                                    .build();
                            job.setCreatedAt(Instant.now());
                            job.setUpdatedAt(Instant.now());
                            session.persist(job);
                            tx.commit();
                            savedId = job.getId();
                        }

                        try (Session session = sessionFactory.openSession()) {
                            WritingGradingJob loaded = session.find(WritingGradingJob.class, savedId);
                            assertThat(loaded).isNotNull();
                            assertThat(loaded.getImageCount()).isEqualTo(count);
                            assertThat(loaded.getContextJson()).containsEntry("count", count);
                        }
                    }
                }
            } finally {
                StandardServiceRegistryBuilder.destroy(registry);
            }
        }
    }
}
