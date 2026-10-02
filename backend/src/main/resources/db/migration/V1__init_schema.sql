-- =============================================================================
-- Migration: V1__init_schema.sql
-- Description: Initial database schema for Multilingo Platform (7 Modules, 22 Tables)
-- Engine: PostgreSQL 15+ / 16+
-- Base Rule: 100% tables implement BaseEntity (id, created_at, updated_at)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. MODULE AUTH (5 Tables + 1 Join Table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action_code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(150),
    avatar_url VARCHAR(500),
    role_id INT NOT NULL REFERENCES roles(id),
    native_language VARCHAR(10) DEFAULT 'vi' NOT NULL,
    target_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    subscription_tier VARCHAR(20) DEFAULT 'FREE' NOT NULL,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_targets (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    target_certificate VARCHAR(50) NOT NULL,
    target_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    target_score NUMERIC(4, 1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 2. MODULE BILLING (2 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    duration_days INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NOT NULL REFERENCES subscription_plans(id),
    vnp_txn_ref VARCHAR(100) NOT NULL UNIQUE,
    vnp_transaction_no VARCHAR(100),
    amount NUMERIC(12, 2) NOT NULL,
    bank_code VARCHAR(20),
    payment_method VARCHAR(50) DEFAULT 'VNPAY' NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 3. MODULE EXAM (3 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS exams (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    exam_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    is_vip_only BOOLEAN DEFAULT FALSE NOT NULL,
    duration_minutes INT DEFAULT 60 NOT NULL,
    thumbnail_url VARCHAR(500),
    created_by INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_sections (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exam_id INT NOT NULL REFERENCES exams(id),
    skill_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    duration_minutes INT DEFAULT 60 NOT NULL,
    audio_url VARCHAR(500),
    order_index INT DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_parts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_id INT NOT NULL REFERENCES exam_sections(id),
    part_number INT DEFAULT 1 NOT NULL,
    content_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 4. MODULE TESTING (2 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS test_attempts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    exam_id INT NOT NULL,
    test_scope VARCHAR(50) DEFAULT 'FULL_EXAM' NOT NULL,
    test_mode VARCHAR(50) DEFAULT 'MOCK_TEST' NOT NULL,
    status VARCHAR(30) DEFAULT 'IN_PROGRESS' NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    time_spent_seconds INT DEFAULT 0 NOT NULL,
    overall_score NUMERIC(4, 2),
    section_scores JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS attempt_answers (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempt_id INT NOT NULL REFERENCES test_attempts(id),
    part_id INT NOT NULL,
    user_answers JSONB NOT NULL,
    is_correct_flags JSONB,
    ai_feedback JSONB,
    skill_stats JSONB,
    earned_score NUMERIC(4, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 5. MODULE VOCAB (3 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dictionary_words (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word VARCHAR(150) NOT NULL,
    language_code VARCHAR(10) DEFAULT 'en' NOT NULL,
    phonetic VARCHAR(150),
    pos VARCHAR(50),
    level VARCHAR(10),
    default_meaning JSONB NOT NULL,
    example_sentence TEXT,
    audio_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS flashcard_decks (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE NOT NULL,
    clones_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_flashcards (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    deck_id INT NOT NULL REFERENCES flashcard_decks(id),
    word_id INT REFERENCES dictionary_words(id),
    custom_word VARCHAR(150) NOT NULL,
    custom_meaning TEXT NOT NULL,
    example_sentence TEXT,
    custom_image_url VARCHAR(500),
    status VARCHAR(30) DEFAULT 'NEW' NOT NULL,
    review_count INT DEFAULT 0 NOT NULL,
    ease_factor NUMERIC(4, 2) DEFAULT 2.50 NOT NULL,
    interval_days INT DEFAULT 0 NOT NULL,
    next_review_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 6. MODULE GAMIFICATION (3 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_study_stats (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    current_streak INT DEFAULT 0 NOT NULL,
    highest_streak INT DEFAULT 0 NOT NULL,
    total_learning_minutes INT DEFAULT 0 NOT NULL,
    last_study_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_study_logs (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    study_date DATE NOT NULL,
    learning_minutes INT DEFAULT 0 NOT NULL,
    flashcards_due INT DEFAULT 0 NOT NULL,
    flashcards_reviewed INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =============================================================================
-- 7. MODULE ANALYTICS (3 Tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_quotas (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    feature_code VARCHAR(50) NOT NULL,
    used_count INT DEFAULT 0 NOT NULL,
    max_limit INT DEFAULT 1 NOT NULL,
    reset_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS login_history (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT,
    ip_address VARCHAR(45) NOT NULL,
    device_info VARCHAR(255),
    login_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'SUCCESS' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
