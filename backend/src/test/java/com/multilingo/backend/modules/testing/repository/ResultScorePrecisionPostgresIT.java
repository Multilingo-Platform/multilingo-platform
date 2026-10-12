package com.multilingo.backend.modules.testing.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ResultScorePrecisionPostgresIT {

    @Test
    @DisplayName("Should migrate numeric(4,2) to numeric(10,2) on real PostgreSQL without data loss when TV3_PG_TEST_URL is provided")
    void testPostgresMigration() throws Exception {
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        assumeTrue(pgUrl != null && !pgUrl.isBlank() &&
                   pgUser != null && !pgUser.isBlank() &&
                   pgPassword != null && !pgPassword.isBlank(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping migration IT");

        String schemaName = "tv3_11_it_" + UUID.randomUUID().toString().replace("-", "");

        try (Connection conn = DriverManager.getConnection(pgUrl, pgUser, pgPassword)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("CREATE SCHEMA " + schemaName);
                stmt.execute("SET search_path TO " + schemaName);

                // Setup old fixture tables with NUMERIC(4,2)
                stmt.execute("""
                    CREATE TABLE test_attempts (
                        id SERIAL PRIMARY KEY,
                        overall_score NUMERIC(4,2)
                    );
                    CREATE TABLE attempt_answers (
                        id SERIAL PRIMARY KEY,
                        earned_score NUMERIC(4,2)
                    );
                """);

                // Insert legacy data (e.g. 9.25)
                stmt.execute("INSERT INTO test_attempts (overall_score) VALUES (9.25)");
                stmt.execute("INSERT INTO attempt_answers (earned_score) VALUES (9.25)");
            }

            // Run Flyway migration targeting the new schema
            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261006165504")
                    .baselineOnMigrate(true)
                    .load();

            flyway.migrate();

            // Assert Flyway schema history target version
            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("20261010233000");
            assertThat(flyway.info().current().getState().isApplied()).isTrue();

            try (Statement stmt = conn.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT version, success FROM " + schemaName + ".flyway_schema_history WHERE version = '20261010233000'")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString("version")).isEqualTo("20261010233000");
                assertThat(rs.getBoolean("success")).isTrue();
            }

            // Verify precision & scale in information_schema
            try (PreparedStatement ps = conn.prepareStatement("""
                SELECT table_name, column_name, numeric_precision, numeric_scale
                FROM information_schema.columns
                WHERE table_schema = ? AND column_name IN ('overall_score', 'earned_score')
            """)) {
                ps.setString(1, schemaName);
                try (ResultSet rs = ps.executeQuery()) {
                    int count = 0;
                    while (rs.next()) {
                        int precision = rs.getInt("numeric_precision");
                        int scale = rs.getInt("numeric_scale");
                        assertThat(precision).isEqualTo(10);
                        assertThat(scale).isEqualTo(2);
                        count++;
                    }
                    assertThat(count).isEqualTo(2);
                }
            }

            // Verify legacy row preserved
            try (Statement stmt = conn.createStatement()) {
                try (ResultSet rs = stmt.executeQuery("SELECT overall_score FROM " + schemaName + ".test_attempts WHERE id = 1")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getBigDecimal("overall_score")).isEqualByComparingTo(new BigDecimal("9.25"));
                }
                try (ResultSet rs = stmt.executeQuery("SELECT earned_score FROM " + schemaName + ".attempt_answers WHERE id = 1")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getBigDecimal("earned_score")).isEqualByComparingTo(new BigDecimal("9.25"));
                }

                // Verify inserting 200.00 succeeds now!
                stmt.execute("INSERT INTO " + schemaName + ".test_attempts (overall_score) VALUES (200.00)");
                stmt.execute("INSERT INTO " + schemaName + ".attempt_answers (earned_score) VALUES (200.00)");

                try (ResultSet rs = stmt.executeQuery("SELECT overall_score FROM " + schemaName + ".test_attempts WHERE overall_score = 200.00")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getBigDecimal("overall_score")).isEqualByComparingTo(new BigDecimal("200.00"));
                }
            }
        } finally {
            // Cleanup only the schema created by this test
            try (Connection conn = DriverManager.getConnection(pgUrl, pgUser, pgPassword);
                 Statement stmt = conn.createStatement()) {
                stmt.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
            } catch (Exception ignored) {
            }
        }
    }
}
