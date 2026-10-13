-- V20261012180000__add_writing_hint_requests.sql
-- TV3-18: Durable ledger for AI Writing Hints and quota integrity constraints

-- 1. Precheck for duplicate user_quotas rows for AI_WRITING_HINTS.
-- Fails immediately without modifications if corrupt duplicate rows exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT user_id, feature_code, COUNT(*)
        FROM user_quotas
        WHERE feature_code = 'AI_WRITING_HINTS'
        GROUP BY user_id, feature_code
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Precheck failed: Duplicate user_quotas rows found for feature AI_WRITING_HINTS. Migration aborted without modifications.';
    END IF;
END $$;

-- 2. Partial unique index for AI_WRITING_HINTS feature quota per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_quotas_ai_writing_hints
ON user_quotas (user_id, feature_code)
WHERE feature_code = 'AI_WRITING_HINTS';

-- 3. Create writing_hint_requests durable ledger table
CREATE TABLE IF NOT EXISTS writing_hint_requests (
    id                  SERIAL          PRIMARY KEY,
    user_id             INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id          INT             NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id             INT             NOT NULL,
    question_id         VARCHAR(128)    NOT NULL,
    request_id          VARCHAR(64)     NOT NULL,
    request_fingerprint VARCHAR(64)     NOT NULL,
    context_json        JSONB           NOT NULL,
    status              VARCHAR(30)     NOT NULL,
    run_id              VARCHAR(64),
    lease_until         TIMESTAMPTZ,
    last_started_at     TIMESTAMPTZ,
    quota_id            INT,
    quota_reset_date    TIMESTAMPTZ,
    quota_reserved      BOOLEAN         NOT NULL DEFAULT FALSE,
    result_json         JSONB,
    failure_code        VARCHAR(50),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_writing_hint_requests_user_request UNIQUE (user_id, request_id)
);

-- 4. Partial unique index: at most one PENDING request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_writing_hint_requests_pending_user
ON writing_hint_requests (user_id)
WHERE status = 'PENDING';

-- 5. Index for lease recovery and watchdog
CREATE INDEX IF NOT EXISTS idx_writing_hint_requests_lease_recovery
ON writing_hint_requests (status, lease_until)
WHERE status = 'PENDING';

-- 6. Index on attempt_id for attempt cleanup or auditing
CREATE INDEX IF NOT EXISTS idx_writing_hint_requests_attempt_id
ON writing_hint_requests (attempt_id);
