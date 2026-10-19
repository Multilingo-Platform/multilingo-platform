-- V20261013210000__add_writing_grading_jobs.sql
-- TV3-20: Durable queue and status persistence for AI Writing post-submit grading

-- 1. Precheck for duplicate user_quotas rows for AI_WRITING_GRADING.
-- Fails immediately without modifications if corrupt duplicate rows exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT user_id, feature_code, COUNT(*)
        FROM user_quotas
        WHERE feature_code = 'AI_WRITING_GRADING'
        GROUP BY user_id, feature_code
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Precheck failed: Duplicate user_quotas rows found for feature AI_WRITING_GRADING. Migration aborted without modifications.';
    END IF;
END $$;

-- 2. Partial unique index for AI_WRITING_GRADING feature quota per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_quotas_ai_writing_grading
ON user_quotas (user_id, feature_code)
WHERE feature_code = 'AI_WRITING_GRADING';

-- 3. Create writing_grading_jobs table
CREATE TABLE IF NOT EXISTS writing_grading_jobs (
    id                  SERIAL          PRIMARY KEY,
    attempt_id          INT             NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id             INT             NOT NULL,
    question_id         VARCHAR(128)    NOT NULL,
    context_json        JSONB           NOT NULL,
    input_hash          VARCHAR(64)     NOT NULL,
    status              VARCHAR(30)     NOT NULL,
    wait_reason         VARCHAR(50),
    attempt_count       INT             NOT NULL DEFAULT 0,
    image_count         SMALLINT        NOT NULL DEFAULT 0,
    next_attempt_at     TIMESTAMPTZ,
    run_id              VARCHAR(64),
    lease_until         TIMESTAMPTZ,
    last_started_at     TIMESTAMPTZ,
    quota_id            INT,
    quota_reset_date    TIMESTAMPTZ,
    quota_reserved      BOOLEAN         NOT NULL DEFAULT FALSE,
    last_error_code     VARCHAR(50),
    model_metadata      JSONB,
    result_json         JSONB,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_writing_grading_jobs_attempt_part_question UNIQUE (attempt_id, part_id, question_id),
    CONSTRAINT chk_writing_grading_jobs_attempt_count CHECK (attempt_count >= 0 AND attempt_count <= 4),
    CONSTRAINT chk_writing_grading_jobs_image_count CHECK (image_count >= 0 AND image_count <= 2),
    CONSTRAINT chk_writing_grading_jobs_running CHECK (
        status <> 'RUNNING' OR (run_id IS NOT NULL AND lease_until IS NOT NULL AND quota_reserved = TRUE)
    )
);

-- 4. Index on attempt_id for attempt state resolution and history
CREATE INDEX IF NOT EXISTS idx_writing_grading_jobs_attempt_id
ON writing_grading_jobs (attempt_id);

-- 5. Due-job index for dispatcher polling
CREATE INDEX IF NOT EXISTS idx_writing_grading_jobs_due
ON writing_grading_jobs (status, next_attempt_at)
WHERE status IN ('READY', 'RETRY_WAIT');

-- 6. Expired-lease index for recovery watchdog
CREATE INDEX IF NOT EXISTS idx_writing_grading_jobs_expired_lease
ON writing_grading_jobs (status, lease_until)
WHERE status = 'RUNNING';

-- 7. Waiting jobs index for periodic quota/provider recheck
CREATE INDEX IF NOT EXISTS idx_writing_grading_jobs_waiting
ON writing_grading_jobs (status, next_attempt_at)
WHERE status = 'WAITING';
