package com.multilingo.backend.modules.testing.adapter.repository;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Runs the exact TW-03 migration in a disposable schema on an explicitly isolated PostgreSQL database. */
@EnabledIfEnvironmentVariable(named = "TW03_POSTGRES_TEST_URL",
        matches = "jdbc:postgresql://(127\\.0\\.0\\.1|localhost):[0-9]+/tw03_playback_test")
class AttemptListeningPlaybackPostgresIT {
    private Connection connection;
    private String schema;

    @BeforeEach
    void migrateIsolatedSchema() throws Exception {
        connection = DriverManager.getConnection(System.getenv("TW03_POSTGRES_TEST_URL"),
                System.getenv().getOrDefault("TW03_POSTGRES_TEST_USER", "tw03"),
                System.getenv().getOrDefault("TW03_POSTGRES_TEST_PASSWORD", ""));
        schema = "tw03_" + UUID.randomUUID().toString().replace("-", "");
        execute("CREATE SCHEMA " + schema);
        execute("SET search_path TO " + schema);
        execute("CREATE TABLE test_attempts (id INT PRIMARY KEY, version INT NOT NULL, user_answers JSONB, exam_snapshot JSONB, deadline TIMESTAMPTZ)");
        try (var input = getClass().getResourceAsStream("/db/migration/V20261017190000__create_attempt_listening_playback.sql")) {
            assertThat(input).isNotNull();
            execute(new String(input.readAllBytes(), StandardCharsets.UTF_8));
        }
        execute("INSERT INTO test_attempts VALUES (1,7,'{\"101:q1\":\"A\"}','{\"id\":42}', '2026-10-17T23:00:00Z')");
    }

    @AfterEach
    void dropOnlyTheTestSchema() throws Exception {
        if (connection != null) {
            try {
                connection.rollback();
            } catch (SQLException ignored) { /* autocommit connection */ }
            connection.setAutoCommit(true);
            if (schema != null) execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
            connection.close();
        }
    }

    @Test
    void migrationPersistsQueryableJsonbAndTimezoneAwareTimeline() throws Exception {
        insertPlayback(1);
        assertThat(scalar("SELECT data_type FROM information_schema.columns WHERE table_schema='" + schema
                + "' AND table_name='attempt_listening_playback' AND column_name='playlist_frozen'")).isEqualTo("jsonb");
        assertThat(scalar("SELECT playlist_frozen->0->>'partId' FROM attempt_listening_playback")).isEqualTo("101");
        assertThat(scalar("SELECT started_at AT TIME ZONE 'UTC' FROM attempt_listening_playback")).startsWith("2026-10-17 10:00:00");
        assertThat(scalar("SELECT total_duration_ms FROM attempt_listening_playback")).isEqualTo("1000");
    }

    @Test
    void migrationEnforcesUniqueAttemptAndRealForeignKey() throws Exception {
        insertPlayback(1);
        assertThatThrownBy(() -> insertPlayback(1)).isInstanceOf(SQLException.class)
                .satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23505"));
        assertThatThrownBy(() -> insertPlayback(999)).isInstanceOf(SQLException.class)
                .satisfies(error -> assertThat(((SQLException) error).getSQLState()).isEqualTo("23503"));
    }

    @Test
    void deletingParentCascadesOnlyItsPlayback() throws Exception {
        insertPlayback(1);
        execute("DELETE FROM test_attempts WHERE id=1");
        assertThat(scalar("SELECT count(*) FROM attempt_listening_playback")).isEqualTo("0");
    }

    @Test
    void playbackTransactionRollsBackWithoutChangingAttemptState() throws Exception {
        String before = scalar("SELECT row_to_json(t)::text FROM test_attempts t WHERE id=1");
        connection.setAutoCommit(false);
        insertPlayback(1);
        execute("UPDATE attempt_listening_playback SET started_at=started_at + interval '1 second'");
        assertThat(scalar("SELECT row_to_json(t)::text FROM test_attempts t WHERE id=1")).isEqualTo(before);
        connection.rollback();
        assertThat(scalar("SELECT count(*) FROM attempt_listening_playback")).isEqualTo("0");
        assertThat(scalar("SELECT row_to_json(t)::text FROM test_attempts t WHERE id=1")).isEqualTo(before);
    }

    private void insertPlayback(int attemptId) throws SQLException {
        execute("INSERT INTO attempt_listening_playback(attempt_id,started_at,playlist_frozen,total_duration_ms) VALUES ("
                + attemptId + ", '2026-10-17T17:00:00+07:00', '[{\"partId\":\"101\",\"durationMs\":1000}]', 1000)");
    }

    private void execute(String sql) throws SQLException {
        try (var statement = connection.createStatement()) { statement.execute(sql); }
    }

    private String scalar(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
            assertThat(result.next()).isTrue(); return result.getString(1);
        }
    }
}
