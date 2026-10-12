-- =============================================================================
-- Migration: V20261012100000__create_practice_completion_receipts.sql
-- Description: Tạo bảng practice_completion_receipts cho Chế độ Luyện tập (UC012.4),
--              bổ sung total_xp và practice counters, đảm bảo unique daily_study_logs
-- =============================================================================

-- 1. Dọn dẹp an toàn các bảng quiz cũ nếu có
DROP TABLE IF EXISTS vocab_quiz_rewards CASCADE;
DROP TABLE IF EXISTS vocab_quiz_questions CASCADE;
DROP TABLE IF EXISTS vocab_quiz_sessions CASCADE;

-- 2. Đảm bảo Unique Constraint cho daily_study_logs (user_id, study_date)
DELETE FROM daily_study_logs 
WHERE id NOT IN (
    SELECT MIN(id) FROM daily_study_logs GROUP BY user_id, study_date
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_daily_study_logs_user_date 
    ON daily_study_logs (user_id, study_date);

-- 3. Bổ sung total_xp vào user_study_stats
ALTER TABLE user_study_stats ADD COLUMN IF NOT EXISTS total_xp BIGINT DEFAULT 0 NOT NULL;

-- 4. Bổ sung các bộ đếm luyện tập vào daily_study_logs
ALTER TABLE daily_study_logs ADD COLUMN IF NOT EXISTS practice_sessions INT DEFAULT 0 NOT NULL;
ALTER TABLE daily_study_logs ADD COLUMN IF NOT EXISTS practice_questions_answered INT DEFAULT 0 NOT NULL;
ALTER TABLE daily_study_logs ADD COLUMN IF NOT EXISTS practice_correct_answers INT DEFAULT 0 NOT NULL;
ALTER TABLE daily_study_logs ADD COLUMN IF NOT EXISTS practice_xp_earned INT DEFAULT 0 NOT NULL;

-- 5. Tạo bảng practice_completion_receipts
CREATE TABLE IF NOT EXISTS practice_completion_receipts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(64) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    result_json JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    session_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    retain_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uk_receipt_user_session UNIQUE (user_id, session_id),
    CONSTRAINT fk_receipt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_receipt_cleanup ON practice_completion_receipts (retain_until);
CREATE INDEX IF NOT EXISTS idx_receipt_session_expires ON practice_completion_receipts (session_expires_at);
