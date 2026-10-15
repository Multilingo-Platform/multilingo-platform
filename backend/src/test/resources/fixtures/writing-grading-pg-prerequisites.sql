-- Minimal persisted dependencies at the approved TV3-20 migration baseline.
-- WritingGradingPostgresIT sets search_path to its random schema first.
-- The jobs table and partial indexes are created only by the production Flyway migration.
CREATE TABLE roles (
    id SERIAL PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE users (
    id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255),
    full_name VARCHAR(150), phone VARCHAR(20), avatar_url VARCHAR(500),
    role_id INT NOT NULL REFERENCES roles(id), native_language VARCHAR(10) NOT NULL DEFAULT 'vi',
    target_language VARCHAR(10) NOT NULL DEFAULT 'en', subscription_tier VARCHAR(20) NOT NULL DEFAULT 'FREE',
    premium_expires_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    google_id VARCHAR(255), last_login_at TIMESTAMPTZ, last_login_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE user_quotas (
    id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
    feature_code VARCHAR(50) NOT NULL, used_count INT NOT NULL DEFAULT 0,
    max_limit INT NOT NULL DEFAULT 1, reset_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE test_attempts (
    id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), exam_id INT NOT NULL,
    test_scope VARCHAR(50) NOT NULL DEFAULT 'FULL_EXAM', test_mode VARCHAR(50) NOT NULL DEFAULT 'PRACTICE',
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS', start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ, deadline TIMESTAMPTZ, time_spent_seconds INT NOT NULL DEFAULT 0,
    overall_score NUMERIC(10,2), section_scores JSONB, exam_snapshot JSONB,
    result_summary JSONB, version INT NOT NULL DEFAULT 1, locked_sections JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE attempt_answers (
    id SERIAL PRIMARY KEY, attempt_id INT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id INT NOT NULL, user_answers JSONB NOT NULL DEFAULT '{}',
    is_correct_flags JSONB, ai_feedback JSONB, skill_stats JSONB,
    earned_score NUMERIC(4,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

