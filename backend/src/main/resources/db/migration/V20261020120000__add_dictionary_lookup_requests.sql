-- Practice AI Dictionary: atomic daily quota identity and idempotent request ledger.
DO $$
BEGIN
    IF EXISTS (
        SELECT user_id, feature_code, COUNT(*)
        FROM user_quotas
        WHERE feature_code = 'DICTIONARY_LOOKUP'
        GROUP BY user_id, feature_code
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Precheck failed: duplicate DICTIONARY_LOOKUP quota rows exist';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_quotas_dictionary_lookup
    ON user_quotas (user_id, feature_code)
    WHERE feature_code = 'DICTIONARY_LOOKUP';

CREATE TABLE IF NOT EXISTS dictionary_lookup_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id INT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id INT NOT NULL,
    document_id VARCHAR(128) NOT NULL,
    request_id VARCHAR(36) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    run_id VARCHAR(36),
    lease_until TIMESTAMPTZ,
    last_started_at TIMESTAMPTZ,
    quota_id INT,
    quota_reset_date TIMESTAMPTZ,
    quota_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    result_json JSONB,
    failure_code VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dictionary_lookup_user_request UNIQUE (user_id, request_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dictionary_lookup_pending_user
    ON dictionary_lookup_requests (user_id)
    WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_dictionary_lookup_lease_recovery
    ON dictionary_lookup_requests (status, lease_until)
    WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_dictionary_lookup_attempt
    ON dictionary_lookup_requests (attempt_id);
