-- =============================================================================
-- Migration: V20261014140000__create_vocab_test_attempts_table.sql
-- Description: Tạo bảng vocab_test_attempts cho phân hệ Thi thử từ vựng (UC012.5),
--              lưu snapshot JSONB, hỗ trợ CAS autosave và Background Scheduler timeout
-- =============================================================================

CREATE TABLE IF NOT EXISTS vocab_test_attempts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    deck_id INT,
    deck_name_snapshot VARCHAR(255) NOT NULL,
    test_token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS' NOT NULL,
    progress_version INT DEFAULT 0 NOT NULL,
    progress_hash VARCHAR(64),
    total_questions INT NOT NULL,
    correct_count INT DEFAULT 0 NOT NULL,
    score INT DEFAULT 0 NOT NULL,
    xp_earned INT DEFAULT 0 NOT NULL,
    time_limit_seconds INT NOT NULL,
    time_spent_seconds INT DEFAULT 0 NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    questions_snapshot JSONB NOT NULL,
    answers_progress JSONB,
    result_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_vocab_test_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_vocab_test_deck FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE SET NULL,
    CONSTRAINT chk_vocab_test_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'TIMED_OUT'))
);

CREATE INDEX IF NOT EXISTS idx_vocab_test_user ON vocab_test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_test_deck ON vocab_test_attempts(deck_id);
CREATE INDEX IF NOT EXISTS idx_vocab_test_scheduler ON vocab_test_attempts(status, expires_at);
