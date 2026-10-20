-- V20261017190000__create_attempt_listening_playback.sql
-- TW-03: Create attempt_listening_playback table for server-authoritative audio timeline

CREATE TABLE IF NOT EXISTS attempt_listening_playback (
    id SERIAL PRIMARY KEY,
    attempt_id INT NOT NULL,
    started_at TIMESTAMPTZ,
    playlist_frozen JSONB NOT NULL,
    total_duration_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attempt_listening_playback_attempt UNIQUE (attempt_id),
    CONSTRAINT fk_attempt_listening_playback_attempt FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempt_listening_playback_attempt_id
ON attempt_listening_playback (attempt_id);
