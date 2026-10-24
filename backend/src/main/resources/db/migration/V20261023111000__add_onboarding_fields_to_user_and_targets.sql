-- Migration: Add onboarding fields to users and user_targets tables
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL;

ALTER TABLE user_targets
    ADD COLUMN IF NOT EXISTS daily_minutes INT DEFAULT 30 NOT NULL,
    ADD COLUMN IF NOT EXISTS current_level VARCHAR(30);
