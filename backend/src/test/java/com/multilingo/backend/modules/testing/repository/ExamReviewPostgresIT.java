package com.multilingo.backend.modules.testing.repository;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ExamReviewPostgresIT {

    @Test
    @DisplayName("Should persist and query exam_snapshot with review data (correct_answer, explanation) on real PostgreSQL")
    void testPostgresExamSnapshotPersistenceAndQuery() throws Exception {
        String pgUrl = System.getenv("TV3_PG_TEST_URL");
        String pgUser = System.getenv("TV3_PG_TEST_USER");
        String pgPassword = System.getenv("TV3_PG_TEST_PASSWORD");

        assumeTrue(pgUrl != null && !pgUrl.isBlank() &&
                   pgUser != null && !pgUser.isBlank() &&
                   pgPassword != null && !pgPassword.isBlank(),
                "PostgreSQL test environment (TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD) not configured - skipping Postgres IT");

        String schemaName = "tv3_13_pg_" + UUID.randomUUID().toString().replace("-", "");

        try (Connection conn = DriverManager.getConnection(pgUrl, pgUser, pgPassword)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("CREATE SCHEMA " + schemaName);
                stmt.execute("SET search_path TO " + schemaName);

                stmt.execute("""
                    CREATE TABLE test_attempts (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        exam_id INTEGER NOT NULL,
                        test_scope VARCHAR(50) NOT NULL DEFAULT 'FULL_EXAM',
                        test_mode VARCHAR(50) NOT NULL DEFAULT 'PRACTICE',
                        status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
                        start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        end_time TIMESTAMPTZ,
                        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
                        overall_score NUMERIC(4,2),
                        section_scores JSONB,
                        exam_snapshot JSONB,
                        result_summary JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE TABLE attempt_answers (
                        id SERIAL PRIMARY KEY,
                        attempt_id INTEGER NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
                        part_id INTEGER NOT NULL,
                        user_answers JSONB NOT NULL DEFAULT '{}',
                        earned_score NUMERIC(4,2),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """);
            }

            // Run Flyway migrations targeting the isolated schema
            Flyway flyway = Flyway.configure()
                    .dataSource(pgUrl, pgUser, pgPassword)
                    .schemas(schemaName)
                    .locations("classpath:db/migration")
                    .baselineVersion("20261006165504")
                    .baselineOnMigrate(true)
                    .target("20261010233000")
                    .load();

            flyway.migrate();

            // Verify Flyway applied migrations
            assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("20261010233000");

            // Insert a test attempt with complex exam_snapshot containing Vietnamese unicode, explanation, and review data
            String snapshotJson = """
                {
                    "examId": 1,
                    "title": "Kỳ thi Đánh giá Năng lực Chuẩn hóa IELTS",
                    "updatedAt": "2026-10-11T12:00:00Z",
                    "sections": [
                        {
                            "id": 10,
                            "skillType": "READING",
                            "title": "Phần Đọc hiểu Học thuật",
                            "parts": [
                                {
                                    "id": 100,
                                    "partNumber": 1,
                                    "title": "Bài đọc 1: Trí tuệ nhân tạo",
                                    "question_groups": [
                                        {
                                            "instruction": "Chọn đáp án đúng nhất cho các câu hỏi sau:",
                                            "options": [
                                                {"key": "A", "text": "Học máy có giám sát (Supervised)"},
                                                {"key": "B", "text": "Học tăng cường (Reinforcement)"}
                                            ],
                                            "questions": [
                                                {
                                                    "question_id": "q_pg_1",
                                                    "type": "SINGLE_CHOICE",
                                                    "text": "Phương pháp nào yêu cầu dữ liệu gán nhãn?",
                                                    "correct_answer": "A",
                                                    "explanation": "Đoạn 1 nêu rõ học có giám sát cần tập dữ liệu được gán nhãn trước."
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
                """;

            // Insert using PreparedStatement into test_attempts
            try (PreparedStatement ps = conn.prepareStatement("""
                INSERT INTO test_attempts (user_id, exam_id, status, test_mode, test_scope, start_time, exam_snapshot, overall_score)
                VALUES (1, 1, 'COMPLETED', 'PRACTICE', 'FULL_EXAM', NOW(), ?::jsonb, 1.00)
                RETURNING id;
            """)) {
                ps.setString(1, snapshotJson);
                try (ResultSet rs = ps.executeQuery()) {
                    assertThat(rs.next()).isTrue();
                    long attemptId = rs.getLong("id");
                    assertThat(attemptId).isGreaterThan(0);

                    // Query back using PostgreSQL native jsonb extraction
                    try (PreparedStatement qps = conn.prepareStatement("""
                        SELECT id,
                               exam_snapshot->>'title' AS exam_title,
                               exam_snapshot->'sections'->0->>'skillType' AS skill,
                               exam_snapshot->'sections'->0->'parts'->0->'question_groups'->0->'questions'->0->>'correct_answer' AS correct_ans,
                               exam_snapshot->'sections'->0->'parts'->0->'question_groups'->0->'questions'->0->>'explanation' AS explanation
                        FROM test_attempts
                        WHERE id = ?
                    """)) {
                        qps.setLong(1, attemptId);
                        try (ResultSet qrs = qps.executeQuery()) {
                            assertThat(qrs.next()).isTrue();
                            assertThat(qrs.getString("exam_title")).isEqualTo("Kỳ thi Đánh giá Năng lực Chuẩn hóa IELTS");
                            assertThat(qrs.getString("skill")).isEqualTo("READING");
                            assertThat(qrs.getString("correct_ans")).isEqualTo("A");
                            assertThat(qrs.getString("explanation")).isEqualTo("Đoạn 1 nêu rõ học có giám sát cần tập dữ liệu được gán nhãn trước.");
                        }
                    }
                }
            }

        } finally {
            // Cleanup isolated schema
            try (Connection conn = DriverManager.getConnection(pgUrl, pgUser, pgPassword);
                 Statement stmt = conn.createStatement()) {
                stmt.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
            } catch (Exception ignored) {
            }
        }
    }
}
