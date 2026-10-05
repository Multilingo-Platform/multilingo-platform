-- V2__create_test_attempts_tables.sql
-- Sprint 01: test_attempts + attempt_answers schema for TV3 module
-- Note: H2 in test profile uses ddl-auto=create-drop; Flyway disabled in test profile
-- This migration runs only in production/dev profile against PostgreSQL

CREATE TABLE IF NOT EXISTS test_attempts (
    id                  SERIAL          PRIMARY KEY,
    user_id             INTEGER         NOT NULL,
    exam_id             INTEGER         NOT NULL,
    test_scope          VARCHAR(50)     NOT NULL DEFAULT 'FULL_EXAM',
    test_mode           VARCHAR(50)     NOT NULL DEFAULT 'MOCK_TEST',
    status              VARCHAR(30)     NOT NULL DEFAULT 'IN_PROGRESS',
    start_time          TIMESTAMPTZ     NOT NULL,
    end_time            TIMESTAMPTZ,
    deadline            TIMESTAMPTZ,
    time_spent_seconds  INTEGER         NOT NULL DEFAULT 0,
    overall_score       NUMERIC(4,2),
    section_scores      JSONB,
    exam_snapshot       JSONB,
    version             INTEGER         NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN test_attempts.exam_snapshot IS 'Server-side snapshot of exam at attempt creation. Immutable after create — edits to source exam do NOT affect this snapshot.';
COMMENT ON COLUMN test_attempts.deadline IS 'NULL for PRACTICE mode. For MOCK_TEST: startTime + sum of relevant section/part durations.';
COMMENT ON COLUMN test_attempts.version IS 'Reserved for optimistic locking in Sprint 03. Default 1, incremented on answer save.';

CREATE TABLE IF NOT EXISTS attempt_answers (
    id                  SERIAL          PRIMARY KEY,
    attempt_id          INTEGER         NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id             INTEGER         NOT NULL,
    user_answers        JSONB           NOT NULL DEFAULT '{}',
    is_correct_flags    JSONB,
    ai_feedback         JSONB,
    skill_stats         JSONB,
    earned_score        NUMERIC(4,2),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (attempt_id, part_id)
);

COMMENT ON COLUMN attempt_answers.user_answers IS 'Map of questionId -> answer value. Supports MCQ, fill-in, matching, essay types.';
COMMENT ON COLUMN attempt_answers.is_correct_flags IS 'Map of questionId -> boolean correct flag. Populated after grading.';
COMMENT ON COLUMN attempt_answers.ai_feedback IS 'AI feedback per question/essay. Populated after Gemini grading (Sprint 08+).';

CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_exam_id ON test_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON attempt_answers(attempt_id);
