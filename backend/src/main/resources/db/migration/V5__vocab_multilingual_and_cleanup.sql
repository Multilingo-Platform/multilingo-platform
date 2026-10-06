-- =============================================================================
-- Migration: V2__vocab_multilingual_and_cleanup.sql
-- Description: Bổ sung cặp ngôn ngữ (target_language, source_language) cho flashcard_decks
--              và loại bỏ cột audio_url không cần thiết khỏi dictionary_words
-- =============================================================================

-- 1. Thêm cặp ngôn ngữ cho bộ thẻ
ALTER TABLE flashcard_decks 
    ADD COLUMN IF NOT EXISTS target_language VARCHAR(10) DEFAULT 'en' NOT NULL,
    ADD COLUMN IF NOT EXISTS source_language VARCHAR(10) DEFAULT 'vi' NOT NULL;

-- 2. Loại bỏ cột audio_url khỏi từ điển (client sử dụng Web Speech API / TTS trực tiếp)
ALTER TABLE dictionary_words 
    DROP COLUMN IF EXISTS audio_url;
