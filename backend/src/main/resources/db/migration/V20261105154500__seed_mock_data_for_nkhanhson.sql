-- =============================================================================
-- Migration: V20261105154500__seed_mock_data_for_nkhanhson.sql
-- Description: Seed realistic, comprehensive mock data for learner account nkhanhson25112005@gmail.com
-- Modules affected: Users, User Targets, Gamification, Vocabulary, Quotas, Billing, Testing & Notifications
-- Resiliency: 100% dynamic exam & part resolution, fail-safe against schema ID variance across environments
-- =============================================================================

-- Đảm bảo clones_count có DEFAULT 0 nếu database ban đầu chưa cấu hình default
UPDATE flashcard_decks SET clones_count = 0 WHERE clones_count IS NULL;
ALTER TABLE flashcard_decks ALTER COLUMN clones_count SET DEFAULT 0;

-- Đảm bảo attempt_answers sạch dữ liệu trùng lặp và có unique constraint nếu khả dụng
DELETE FROM attempt_answers a USING attempt_answers b
WHERE a.id < b.id AND a.attempt_id = b.attempt_id AND a.part_id = b.part_id;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'attempt_answers_attempt_id_part_id_key'
    ) THEN
        BEGIN
            ALTER TABLE attempt_answers ADD CONSTRAINT attempt_answers_attempt_id_part_id_key UNIQUE (attempt_id, part_id);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

DO $$
DECLARE
    v_user_id INT;
    v_deck_ielts_id INT;
    v_deck_toeic_id INT;
    v_plan_1y_id INT;
    v_user_role_id INT;
    v_snap JSONB;
    v_att RECORD;
    v_part RECORD;
    v_user_answers JSONB;
    v_flags JSONB;
    v_q_count INT;
    v_correct_count INT;
    v_earned NUMERIC(6,2);

    -- Dynamic Exam IDs
    v_exam_ielts_full_id INT;
    v_exam_ielts_read_id INT;
    v_exam_ielts_lis_id INT;
    v_exam_ielts_write_id INT;
    v_exam_toeic_full_id INT;
    v_exam_toeic_lis_id INT;
    v_exam_toeic_read_id INT;
    v_exam_toeic_p5_id INT;
    v_exam_toeic_write_id INT;
    v_exam_nltv_id INT;

    -- Dynamic Writing Attempt & Part IDs
    v_writing_att_id INT;
    v_writing_part1_id INT;
    v_writing_part2_id INT;
BEGIN
    -- 1. Resolve USER role
    SELECT id INTO v_user_role_id FROM roles WHERE name = 'USER';
    IF v_user_role_id IS NULL THEN
        SELECT id INTO v_user_role_id FROM roles LIMIT 1;
    END IF;

    -- 2. Identify or create user
    SELECT id INTO v_user_id FROM users WHERE email = 'nkhanhson25112005@gmail.com';
    IF v_user_id IS NULL THEN
        INSERT INTO users (
            email, password_hash, full_name, avatar_url, role_id, native_language, target_language,
            subscription_tier, premium_expires_at, is_active, phone, has_completed_onboarding,
            created_at, updated_at
        ) VALUES (
            'nkhanhson25112005@gmail.com',
            '$2a$10$0a9Dwxiy5AeAUuYLTLvS4OdSFAZiGq9mcoowE2WARW43UXQhIYyCu',
            'Nguyễn Khánh Sơn',
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
            v_user_role_id,
            'vi',
            'en',
            'PREMIUM',
            CURRENT_TIMESTAMP + INTERVAL '365 days',
            true,
            '0325641987',
            true,
            CURRENT_TIMESTAMP - INTERVAL '30 days',
            CURRENT_TIMESTAMP
        ) RETURNING id INTO v_user_id;
    ELSE
        UPDATE users
        SET full_name = 'Nguyễn Khánh Sơn',
            avatar_url = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
            subscription_tier = 'PREMIUM',
            premium_expires_at = CURRENT_TIMESTAMP + INTERVAL '365 days',
            phone = '0325641987',
            native_language = 'vi',
            target_language = 'en',
            has_completed_onboarding = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_user_id;
    END IF;

    -- 3. Upsert User Target (IELTS Academic 7.5 Target)
    IF EXISTS (SELECT 1 FROM user_targets WHERE user_id = v_user_id) THEN
        UPDATE user_targets
        SET target_certificate = 'IELTS_ACADEMIC',
            target_score = 7.5,
            daily_minutes = 45,
            current_level = 'INTERMEDIATE',
            target_language = 'en',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = v_user_id;
    ELSE
        INSERT INTO user_targets (user_id, target_certificate, target_language, target_score, daily_minutes, current_level, created_at, updated_at)
        VALUES (v_user_id, 'IELTS_ACADEMIC', 'en', 7.5, 45, 'INTERMEDIATE', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP);
    END IF;

    -- 4. Upsert Gamification Study Stats (Streak 14, 2460 mins, 8250 XP)
    INSERT INTO user_study_stats (user_id, current_streak, highest_streak, total_learning_minutes, total_xp, last_study_date, created_at, updated_at)
    VALUES (v_user_id, 14, 21, 2460, 8250, CURRENT_DATE, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
        current_streak = 14,
        highest_streak = 21,
        total_learning_minutes = 2460,
        total_xp = 8250,
        last_study_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP;

    -- 5. Daily Study Logs for the past 30 days
    INSERT INTO daily_study_logs (
        user_id, study_date, learning_minutes, flashcards_due, flashcards_reviewed,
        practice_sessions, practice_questions_answered, practice_correct_answers, practice_xp_earned,
        created_at, updated_at
    )
    SELECT 
        v_user_id,
        (CURRENT_DATE - i)::date,
        (35 + ((i * 13 + 7) % 45)),
        ((i * 7 + 2) % 12),
        (18 + ((i * 11 + 3) % 25)),
        (1 + ((i * 3) % 3)),
        (15 + ((i * 17 + 5) % 30)),
        (12 + ((i * 17 + 5) % 30) - (i % 3)),
        (120 + ((i * 29 + 11) % 180)),
        CURRENT_TIMESTAMP - (i || ' days')::interval,
        CURRENT_TIMESTAMP - (i || ' days')::interval
    FROM generate_series(0, 29) i
    ON CONFLICT (user_id, study_date) DO UPDATE SET
        learning_minutes = EXCLUDED.learning_minutes,
        flashcards_due = EXCLUDED.flashcards_due,
        flashcards_reviewed = EXCLUDED.flashcards_reviewed,
        practice_sessions = EXCLUDED.practice_sessions,
        practice_questions_answered = EXCLUDED.practice_questions_answered,
        practice_correct_answers = EXCLUDED.practice_correct_answers,
        practice_xp_earned = EXCLUDED.practice_xp_earned,
        updated_at = CURRENT_TIMESTAMP;

    -- 6. Upsert AI Quotas for Premium Tier
    DELETE FROM user_quotas WHERE user_id = v_user_id;
    INSERT INTO user_quotas (user_id, feature_code, used_count, max_limit, reset_date, created_at, updated_at)
    VALUES 
        (v_user_id, 'AI_WRITING_GRADING', 3, 50, CURRENT_TIMESTAMP + INTERVAL '25 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (v_user_id, 'AI_WRITING_HINTS', 8, 150, CURRENT_TIMESTAMP + INTERVAL '25 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (v_user_id, 'DICTIONARY_LOOKUP', 24, 500, CURRENT_TIMESTAMP + INTERVAL '25 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- 7. Subscription Plans & Transaction
    INSERT INTO subscription_plans (code, name, price, duration_days, is_active, created_at, updated_at)
    VALUES 
        ('PREMIUM_1M', 'Gói Premium 1 Tháng', 199000, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('PREMIUM_6M', 'Gói Premium 6 Tháng', 899000, 180, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('PREMIUM_1Y', 'Gói Premium VIP 1 Năm', 1499000, 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (code) DO NOTHING;

    SELECT id INTO v_plan_1y_id FROM subscription_plans WHERE code = 'PREMIUM_1Y';

    IF NOT EXISTS (SELECT 1 FROM transactions WHERE user_id = v_user_id AND vnp_txn_ref = 'VNP20261016140502') THEN
        INSERT INTO transactions (user_id, plan_id, vnp_txn_ref, vnp_transaction_no, amount, bank_code, payment_method, status, paid_at, created_at, updated_at)
        VALUES (
            v_user_id,
            v_plan_1y_id,
            'VNP20261016140502',
            '14589234',
            1499000.00,
            'NCB',
            'VNPAY',
            'SUCCESS',
            TIMESTAMPTZ '2026-10-16 14:05:30+07',
            CURRENT_TIMESTAMP - INTERVAL '20 days',
            CURRENT_TIMESTAMP - INTERVAL '20 days'
        );
    END IF;

    -- 8. Flashcard Decks
    SELECT id INTO v_deck_ielts_id FROM flashcard_decks WHERE user_id = v_user_id AND name = 'IELTS Academic Core 7.5+';
    IF v_deck_ielts_id IS NULL THEN
        INSERT INTO flashcard_decks (user_id, name, description, is_public, clones_count, target_language, source_language, created_at, updated_at)
        VALUES (v_user_id, 'IELTS Academic Core 7.5+', 'Từ vựng trọng tâm target Band 7.5+ IELTS Academic', false, 0, 'en', 'vi', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP)
        RETURNING id INTO v_deck_ielts_id;
    END IF;

    SELECT id INTO v_deck_toeic_id FROM flashcard_decks WHERE user_id = v_user_id AND name = 'TOEIC 850+ Business Master';
    IF v_deck_toeic_id IS NULL THEN
        INSERT INTO flashcard_decks (user_id, name, description, is_public, clones_count, target_language, source_language, created_at, updated_at)
        VALUES (v_user_id, 'TOEIC 850+ Business Master', 'Từ vựng văn phòng, hợp đồng và thương mại quốc tế', false, 0, 'en', 'vi', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP)
        RETURNING id INTO v_deck_toeic_id;
    END IF;

    -- 9. User Flashcards
    DELETE FROM user_flashcards WHERE user_id = v_user_id;
    INSERT INTO user_flashcards (user_id, deck_id, custom_word, custom_meaning, example_sentence, status, review_count, ease_factor, interval_days, next_review_date, created_at, updated_at)
    VALUES 
        (v_user_id, v_deck_ielts_id, 'ubiquitous', 'phổ biến, xuất hiện ở khắp mọi nơi', 'Smartphones have become ubiquitous in modern urban life.', 'MASTERED', 8, 2.60, 15, CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'exacerbate', 'làm trầm trọng thêm', 'The heatwave will exacerbate the ongoing water shortage.', 'REVIEWING', 3, 2.30, 4, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'plausible', 'hợp lý, đáng tin cậy', 'She presented a plausible hypothesis for the experiment results.', 'MASTERED', 7, 2.50, 12, CURRENT_TIMESTAMP + INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'scrutinize', 'soi xét, kiểm tra tỉ mỉ', 'Auditors scrutinized the company balance sheets thoroughly.', 'REVIEWING', 4, 2.45, 6, CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '11 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'detrimental', 'có hại, gây bất lợi', 'Sedentary lifestyles have detrimental impacts on cardiovascular health.', 'MASTERED', 10, 2.75, 20, CURRENT_TIMESTAMP + INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'lucrative', 'sinh lời cao, béo bở', 'Software engineering remains a highly lucrative career choice.', 'MASTERED', 6, 2.50, 9, CURRENT_TIMESTAMP + INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'synthesize', 'tổng hợp kiến thức/thông tin', 'Learners should synthesize key takeaways from multiple academic papers.', 'REVIEWING', 4, 2.40, 5, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_ielts_id, 'ambiguous', 'mơ hồ, đa nghĩa', 'The legal clause was criticized for its ambiguous phrasing.', 'MASTERED', 7, 2.50, 11, CURRENT_TIMESTAMP + INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'negotiate', 'đàm phán, thương lượng', 'The sales director negotiated favorable partnership terms.', 'MASTERED', 8, 2.60, 14, CURRENT_TIMESTAMP + INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'compliance', 'sự tuân thủ pháp lý/quy chuẩn', 'Our operations are conducted in strict compliance with ISO regulations.', 'REVIEWING', 4, 2.40, 5, CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'reimburse', 'bồi hoàn, hoàn tiền công tác', 'Staff will be reimbursed for reasonable meal and travel costs.', 'REVIEWING', 3, 2.30, 4, CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'feasible', 'khả thi', 'The engineering team confirmed that the product launch deadline is feasible.', 'MASTERED', 8, 2.55, 14, CURRENT_TIMESTAMP + INTERVAL '11 days', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'implement', 'triển khai, thi hành', 'The bank will implement two-factor biometric authentication.', 'MASTERED', 9, 2.65, 16, CURRENT_TIMESTAMP + INTERVAL '13 days', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'confidentiality', 'tính bảo mật', 'All contractors must sign a strict non-disclosure and confidentiality clause.', 'MASTERED', 8, 2.60, 13, CURRENT_TIMESTAMP + INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP),
        (v_user_id, v_deck_toeic_id, 'facilitate', 'tạo điều kiện, hỗ trợ thuận tiện', 'The CRM software facilitates smoother customer collaboration.', 'NEW', 1, 2.50, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP);

    -- 10. Dynamic Exam Resolution across different database environments
    SELECT id INTO v_exam_ielts_full_id FROM exams 
    WHERE type = 'IELTS_ACADEMIC' OR (title ILIKE '%Cambridge%Test 2%' AND type NOT LIKE '%_L%' AND type NOT LIKE '%_R%' AND type NOT LIKE '%_W%') 
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_ielts_read_id FROM exams 
    WHERE type = 'IELTS_READING' OR (title ILIKE '%Reading%' AND type LIKE 'IELTS%' AND type NOT LIKE '%R1%' AND type NOT LIKE '%R2%' AND type NOT LIKE '%R3%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_ielts_lis_id FROM exams 
    WHERE type = 'IELTS_LISTENING' OR (title ILIKE '%Listening%' AND type LIKE 'IELTS%' AND type NOT LIKE '%L1%' AND type NOT LIKE '%L2%' AND type NOT LIKE '%L3%' AND type NOT LIKE '%L4%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_ielts_write_id FROM exams 
    WHERE type = 'IELTS_WRITING' OR (title ILIKE '%Writing%' AND type LIKE 'IELTS%' AND type NOT LIKE '%W1%' AND type NOT LIKE '%W2%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_toeic_full_id FROM exams 
    WHERE type IN ('TOEIC_LR', 'TOEIC') OR (title ILIKE '%ETS%Test 2%' AND type NOT LIKE '%P%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_toeic_lis_id FROM exams 
    WHERE type = 'TOEIC_LISTENING' OR (title ILIKE '%ETS%Listening%' AND type NOT LIKE '%P%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_toeic_read_id FROM exams 
    WHERE type = 'TOEIC_READING' OR (title ILIKE '%ETS%Reading%' AND type NOT LIKE '%P%')
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_toeic_p5_id FROM exams 
    WHERE type = 'TOEIC_P5' OR title ILIKE '%Part 5%'
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_toeic_write_id FROM exams 
    WHERE type = 'TOEIC_WRITING' OR title ILIKE '%TOEIC Writing%'
    ORDER BY id LIMIT 1;

    SELECT id INTO v_exam_nltv_id FROM exams 
    WHERE type = 'NLTV' AND title ILIKE '%Đọc%'
    ORDER BY id LIMIT 1;
    IF v_exam_nltv_id IS NULL THEN
        SELECT id INTO v_exam_nltv_id FROM exams WHERE type = 'NLTV' ORDER BY id LIMIT 1;
    END IF;

    -- 11. Populate Attempts Resiliently (Skipped gracefully if exam does not exist in target DB)

    -- 11.1 Cambridge IELTS 20 Test 2 (Full Exam Mock Test)
    IF v_exam_ielts_full_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_ielts_full_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_ielts_full_id, 'FULL_EXAM', 'MOCK_TEST', 'COMPLETED',
            TIMESTAMPTZ '2026-11-05 14:09:00+07', TIMESTAMPTZ '2026-11-05 16:24:00+07', 8100,
            7.50, 'IELTS_BAND', '{"LISTENING": 8.0, "READING": 7.5, "WRITING": 7.0}'::jsonb,
            '{"totalObjectiveCount": 80, "correctObjectiveCount": 68, "skippedObjectiveCount": 1, "accuracyPercentage": 85.0}'::jsonb,
            1, TIMESTAMPTZ '2026-11-05 14:09:00+07', TIMESTAMPTZ '2026-11-05 16:24:00+07'
        );
    END IF;

    -- 11.2 Cambridge IELTS Reading Practice
    IF v_exam_ielts_read_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_ielts_read_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_ielts_read_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-11-03 14:15:00+07', TIMESTAMPTZ '2026-11-03 15:10:00+07', 3300,
            7.50, 'IELTS_BAND', '{"READING": 7.5}'::jsonb,
            '{"totalObjectiveCount": 40, "correctObjectiveCount": 33, "skippedObjectiveCount": 1, "accuracyPercentage": 82.5}'::jsonb,
            1, TIMESTAMPTZ '2026-11-03 14:15:00+07', TIMESTAMPTZ '2026-11-03 15:10:00+07'
        );
    END IF;

    -- 11.3 Cambridge IELTS Listening Practice
    IF v_exam_ielts_lis_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_ielts_lis_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_ielts_lis_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-11-01 10:00:00+07', TIMESTAMPTZ '2026-11-01 10:32:00+07', 1920,
            8.00, 'IELTS_BAND', '{"LISTENING": 8.0}'::jsonb,
            '{"totalObjectiveCount": 40, "correctObjectiveCount": 35, "skippedObjectiveCount": 0, "accuracyPercentage": 87.5}'::jsonb,
            1, TIMESTAMPTZ '2026-11-01 10:00:00+07', TIMESTAMPTZ '2026-11-01 10:32:00+07'
        );
    END IF;

    -- 11.4 Cambridge IELTS Writing Practice (with detailed AI criteria grading)
    IF v_exam_ielts_write_id IS NOT NULL THEN
        SELECT id INTO v_writing_att_id FROM test_attempts 
        WHERE user_id = v_user_id AND exam_id = v_exam_ielts_write_id AND status = 'COMPLETED' 
        ORDER BY id DESC LIMIT 1;

        IF v_writing_att_id IS NULL THEN
            INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
            VALUES (
                v_user_id, v_exam_ielts_write_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
                TIMESTAMPTZ '2026-10-29 15:00:00+07', TIMESTAMPTZ '2026-10-29 15:58:00+07', 3480,
                7.00, 'IELTS_BAND', '{"WRITING": 7.0}'::jsonb,
                '{"totalObjectiveCount": 0, "correctObjectiveCount": 0, "skippedObjectiveCount": 0, "accuracyPercentage": 100.0}'::jsonb,
                1, TIMESTAMPTZ '2026-10-29 15:00:00+07', TIMESTAMPTZ '2026-10-29 15:58:00+07'
            ) RETURNING id INTO v_writing_att_id;
        END IF;

        -- Resolve Part IDs for writing tasks dynamically from database
        SELECT p.id INTO v_writing_part1_id FROM exam_parts p JOIN exam_sections s ON p.section_id = s.id WHERE s.exam_id = v_exam_ielts_write_id AND p.part_number = 1 LIMIT 1;
        SELECT p.id INTO v_writing_part2_id FROM exam_parts p JOIN exam_sections s ON p.section_id = s.id WHERE s.exam_id = v_exam_ielts_write_id AND p.part_number = 2 LIMIT 1;

        IF v_writing_att_id IS NOT NULL AND v_writing_part1_id IS NOT NULL THEN
            DELETE FROM attempt_answers WHERE attempt_id = v_writing_att_id AND part_id = v_writing_part1_id;
            INSERT INTO attempt_answers (attempt_id, part_id, user_answers, is_correct_flags, earned_score, ai_feedback, created_at, updated_at)
            VALUES (
                v_writing_att_id, v_writing_part1_id,
                jsonb_build_object('q_w1', 'The bar chart illustrates the proportion of households in three different income categories owning various electrical appliances in a European country between 2010 and 2020. Overall, it is clear that washing machines and refrigerators were the most common appliances across all income groups, while dishwashers and clothes dryers showed the lowest ownership rates. In 2010, nearly 95% of high-income households possessed a refrigerator, compared to approximately 80% of low-income families. Over the ten-year period, these figures remained relatively stable with minor increases of around 2-3%. In contrast, dishwasher ownership experienced substantial growth among middle and high-income households, climbing from 45% to over 65% in the wealthiest bracket. By 2020, ownership rates across almost all categories had risen, reflecting broader economic improvements and technological accessibility.'),
                jsonb_build_object('q_w1', 'CORRECT'), 7.00,
                jsonb_build_object(
                    'status', 'DONE', 'overallScore', 7.0, 'band', 7.0,
                    'tasks', jsonb_build_object(
                        'q_w1', jsonb_build_object(
                            'status', 'DONE', 'overallScore', 7.0, 'maxScore', 9.0, 'rubricCode', 'WRITING_IELTS_ACADEMIC_TASK1', 'feedbackLanguage', 'vi',
                            'criteria', jsonb_build_array(
                                jsonb_build_object('code', 'TA', 'name', 'Task Achievement', 'score', 7.0, 'comment', 'Bao quát đầy đủ các xu hướng chính và số liệu so sánh nổi bật.'),
                                jsonb_build_object('code', 'CC', 'name', 'Coherence & Cohesion', 'score', 7.0, 'comment', 'Cấu trúc đoạn mạch lạc, liên kết câu mượt mà.'),
                                jsonb_build_object('code', 'LR', 'name', 'Lexical Resource', 'score', 7.0, 'comment', 'Từ vựng học thuật đa dạng (substantial growth, possession, accessibility).'),
                                jsonb_build_object('code', 'GRA', 'name', 'Grammatical Accuracy', 'score', 7.0, 'comment', 'Đa dạng cấu trúc phức tạp, không mắc lỗi chia thì.')
                            ),
                            'strengths', jsonb_build_array('Overview rõ ràng, nêu bật các thiết bị chủ đạo', 'So sánh tỷ lệ giữa các nhóm thu nhập chuẩn xác'),
                            'improvements', jsonb_build_array('Có thể bổ sung thêm số liệu cụ thể cho nhóm máy sấy quần áo')
                        )
                    )
                ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        END IF;

        IF v_writing_att_id IS NOT NULL AND v_writing_part2_id IS NOT NULL THEN
            DELETE FROM attempt_answers WHERE attempt_id = v_writing_att_id AND part_id = v_writing_part2_id;
            INSERT INTO attempt_answers (attempt_id, part_id, user_answers, is_correct_flags, earned_score, ai_feedback, created_at, updated_at)
            VALUES (
                v_writing_att_id, v_writing_part2_id,
                jsonb_build_object('q_w2', 'In contemporary society, an increasing number of people choose to live alone or in smaller family units. While some sociologists argue that this trend weakens community cohesion, I firmly believe that its benefits, particularly in terms of personal autonomy and economic flexibility, outweigh the perceived drawbacks. To begin with, living independently fosters self-reliance and emotional resilience. When individuals manage their own households, they acquire essential life competencies such as financial budgeting, domestic management, and critical decision-making. Furthermore, the absence of familial pressure enables professionals to dedicate sufficient time to career advancement and lifelong learning.'),
                jsonb_build_object('q_w2', 'CORRECT'), 7.50,
                jsonb_build_object(
                    'status', 'DONE', 'overallScore', 7.5, 'band', 7.5,
                    'tasks', jsonb_build_object(
                        'q_w2', jsonb_build_object(
                            'status', 'DONE', 'overallScore', 7.5, 'maxScore', 9.0, 'rubricCode', 'WRITING_IELTS_ACADEMIC_TASK2', 'feedbackLanguage', 'vi',
                            'criteria', jsonb_build_array(
                                jsonb_build_object('code', 'TR', 'name', 'Task Response', 'score', 7.5, 'comment', 'Quan điểm rõ ràng, lập luận chặt chẽ với dẫn chứng thuyết phục.'),
                                jsonb_build_object('code', 'CC', 'name', 'Coherence & Cohesion', 'score', 7.5, 'comment', 'Phát triển ý mạch lạc từ luận điểm chính sang phản biện và kết luận.'),
                                jsonb_build_object('code', 'LR', 'name', 'Lexical Resource', 'score', 7.5, 'comment', 'Sử dụng linh hoạt các cụm từ collocations.'),
                                jsonb_build_object('code', 'GRA', 'name', 'Grammatical Accuracy', 'score', 7.5, 'comment', 'Sử dụng linh hoạt mệnh đề quan hệ và đảo ngữ.')
                            ),
                            'strengths', jsonb_build_array('Luận điểm bảo vệ việc sống tự lập rất sắc bén'),
                            'improvements', jsonb_build_array('Nên liên kết sâu hơn ví dụ ở đoạn 2 với khía cạnh kinh tế vĩ mô')
                        )
                    )
                ), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        END IF;
    END IF;

    -- 11.5 ETS TOEIC Full Exam (Mock Test) -> 860.00 / 990
    IF v_exam_toeic_full_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_toeic_full_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_toeic_full_id, 'FULL_EXAM', 'MOCK_TEST', 'COMPLETED',
            TIMESTAMPTZ '2026-10-26 08:30:00+07', TIMESTAMPTZ '2026-10-26 10:28:00+07', 7080,
            860.00, 'TOEIC_SCALED', '{"LISTENING": 445, "READING": 415}'::jsonb,
            '{"totalObjectiveCount": 200, "correctObjectiveCount": 173, "skippedObjectiveCount": 4, "accuracyPercentage": 86.5}'::jsonb,
            1, TIMESTAMPTZ '2026-10-26 08:30:00+07', TIMESTAMPTZ '2026-10-26 10:28:00+07'
        );
    END IF;

    -- 11.6 ETS TOEIC Listening Practice (Single Skill) -> 450.00 / 450
    IF v_exam_toeic_lis_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_toeic_lis_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_toeic_lis_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-10-23 16:00:00+07', TIMESTAMPTZ '2026-10-23 16:44:00+07', 2640,
            450.00, 'TOEIC_SCALED', '{"LISTENING": 450}'::jsonb,
            '{"totalObjectiveCount": 100, "correctObjectiveCount": 90, "skippedObjectiveCount": 1, "accuracyPercentage": 90.0}'::jsonb,
            1, TIMESTAMPTZ '2026-10-23 16:00:00+07', TIMESTAMPTZ '2026-10-23 16:44:00+07'
        );
    END IF;

    -- 11.7 ETS TOEIC Reading Practice (Single Skill) -> 410.00 / 450
    IF v_exam_toeic_read_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_toeic_read_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_toeic_read_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-10-20 14:00:00+07', TIMESTAMPTZ '2026-10-20 15:12:00+07', 4320,
            410.00, 'TOEIC_SCALED', '{"READING": 410}'::jsonb,
            '{"totalObjectiveCount": 100, "correctObjectiveCount": 82, "skippedObjectiveCount": 3, "accuracyPercentage": 82.0}'::jsonb,
            1, TIMESTAMPTZ '2026-10-20 14:00:00+07', TIMESTAMPTZ '2026-10-20 15:12:00+07'
        );
    END IF;

    -- 11.8 TOEIC Writing Test (Full Exam) -> 160.00 / 200
    IF v_exam_toeic_write_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_toeic_write_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_toeic_write_id, 'FULL_EXAM', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-10-18 09:00:00+07', TIMESTAMPTZ '2026-10-18 09:56:00+07', 3360,
            160.00, 'TOEIC_WRITING', '{"WRITING": 160}'::jsonb,
            '{"totalObjectiveCount": 0, "correctObjectiveCount": 0, "skippedObjectiveCount": 0, "accuracyPercentage": 100.0}'::jsonb,
            1, TIMESTAMPTZ '2026-10-18 09:00:00+07', TIMESTAMPTZ '2026-10-18 09:56:00+07'
        );
    END IF;

    -- 11.9 NLTV Reading Practice (Single Skill) -> 5.50 / 6 Bậc
    IF v_exam_nltv_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_nltv_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (user_id, exam_id, test_scope, test_mode, status, start_time, end_time, time_spent_seconds, overall_score, score_unit, section_scores, result_summary, version, created_at, updated_at)
        VALUES (
            v_user_id, v_exam_nltv_id, 'SINGLE_SKILL', 'PRACTICE', 'COMPLETED',
            TIMESTAMPTZ '2026-10-15 15:30:00+07', TIMESTAMPTZ '2026-10-15 16:20:00+07', 3000,
            5.50, 'RAW_OBJECTIVE', '{"READING": 5.5}'::jsonb,
            '{"totalObjectiveCount": 30, "correctObjectiveCount": 27, "skippedObjectiveCount": 1, "accuracyPercentage": 91.6}'::jsonb,
            1, TIMESTAMPTZ '2026-10-15 15:30:00+07', TIMESTAMPTZ '2026-10-15 16:20:00+07'
        );
    END IF;

    -- 11.10 TOEIC Part 5 Practice (Single Part Practice) -> 26 / 30 câu đúng
    IF v_exam_toeic_p5_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM test_attempts WHERE user_id = v_user_id AND exam_id = v_exam_toeic_p5_id AND status = 'COMPLETED') THEN
        INSERT INTO test_attempts (
            user_id, exam_id, test_scope, test_mode, status,
            start_time, end_time, deadline, time_spent_seconds,
            overall_score, score_unit, result_summary, version, created_at, updated_at
        ) VALUES (
            v_user_id, v_exam_toeic_p5_id, 'SINGLE_PART', 'PRACTICE', 'COMPLETED',
            CURRENT_TIMESTAMP - INTERVAL '7 days 20 minutes', CURRENT_TIMESTAMP - INTERVAL '7 days',
            CURRENT_TIMESTAMP - INTERVAL '7 days', 1200,
            26.00, 'RAW_OBJECTIVE',
            jsonb_build_object('totalObjectiveCount', 30, 'correctCount', 26, 'accuracy', 86.7),
            1, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days'
        );
    END IF;

    -- 12. Completed Vocab Test Attempt
    IF NOT EXISTS (SELECT 1 FROM vocab_test_attempts WHERE user_id = v_user_id) THEN
        INSERT INTO vocab_test_attempts (
            user_id, deck_id, deck_name_snapshot, test_token, status, progress_version,
            total_questions, correct_count, score, xp_earned, time_limit_seconds, time_spent_seconds,
            started_at, submitted_at, expires_at, questions_snapshot, answers_progress, result_summary,
            created_at, updated_at
        )
        VALUES (
            v_user_id, v_deck_ielts_id, 'IELTS Academic Core 7.5+', 'vtok_ielts_core_01', 'COMPLETED', 1,
            20, 18, 90, 180, 600, 345,
            TIMESTAMPTZ '2026-11-04 19:30:00+07', TIMESTAMPTZ '2026-11-04 19:35:45+07', TIMESTAMPTZ '2026-11-04 19:40:00+07',
            '[]'::jsonb, '{}'::jsonb, '{"accuracy": 90.0, "total": 20, "correct": 18}'::jsonb,
            TIMESTAMPTZ '2026-11-04 19:30:00+07', TIMESTAMPTZ '2026-11-04 19:35:45+07'
        );
    END IF;

    -- 13. Populate Exam Snapshot for all user attempts (dynamically from live exams)
    FOR v_att IN SELECT a.id, a.exam_id FROM test_attempts a WHERE a.user_id = v_user_id LOOP
        SELECT jsonb_build_object(
            'id', e.id, 'code', e.code, 'title', e.title, 'type', e.type, 'examLanguage', e.exam_language,
            'sections', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id, 'name', s.title, 'skill', s.skill_type, 'skillType', s.skill_type, 'title', s.title, 'durationMinutes', s.duration_minutes,
                        'parts', (
                            SELECT jsonb_agg(
                                jsonb_build_object('id', p.id, 'partNumber', p.part_number) || p.content_data
                                ORDER BY p.part_number ASC
                            ) FROM exam_parts p WHERE p.section_id = s.id
                        )
                    ) ORDER BY s.order_index ASC
                ) FROM exam_sections s WHERE s.exam_id = e.id
            )
        ) INTO v_snap FROM exams e WHERE e.id = v_att.exam_id;
        IF v_snap IS NOT NULL THEN
            UPDATE test_attempts SET exam_snapshot = v_snap WHERE id = v_att.id;
        END IF;
    END LOOP;

    -- 14. Populate Objective Attempt Answers & Explanations dynamically
    FOR v_att IN SELECT a.id, a.exam_id, a.overall_score, a.test_scope FROM test_attempts a WHERE a.user_id = v_user_id AND a.status = 'COMPLETED' LOOP
        FOR v_part IN 
            SELECT p.id as part_id, s.skill_type
            FROM exam_sections s JOIN exam_parts p ON p.section_id = s.id
            WHERE s.exam_id = v_att.exam_id
            ORDER BY s.order_index, p.part_number
        LOOP
            IF v_part.skill_type != 'WRITING' THEN
                WITH raw_questions AS (
                    SELECT 
                        COALESCE(q->>'question_id', q->>'id', 'q_' || row_number() over ()) AS qid,
                        COALESCE(q->'metadata'->>'correct_answer', q->>'correct_answer', q->>'correctAnswer', 'A') AS ans,
                        q->'metadata'->'options' AS opts,
                        row_number() over () as rn
                    FROM exam_parts p,
                    LATERAL (
                        SELECT q FROM jsonb_to_recordset(
                            CASE 
                                WHEN jsonb_typeof(p.content_data->'question_groups') = 'array' THEN p.content_data->'question_groups'
                                WHEN jsonb_typeof(p.content_data->'questionGroups') = 'array' THEN p.content_data->'questionGroups'
                                ELSE '[]'::jsonb
                            END
                        ) AS g(questions jsonb),
                        jsonb_array_elements(g.questions) AS q
                        UNION ALL
                        SELECT q FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(p.content_data->'questions') = 'array' THEN p.content_data->'questions'
                                ELSE '[]'::jsonb
                            END
                        ) AS q
                    ) q_all
                    WHERE p.id = v_part.part_id
                )
                SELECT 
                    jsonb_object_agg(qid, CASE 
                        WHEN rn % 7 = 0 THEN 'C' 
                        WHEN ans ~ '^[A-D]$' THEN ans
                        WHEN jsonb_typeof(opts) = 'array' AND jsonb_array_length(opts) > 0 THEN COALESCE(opts->>0, ans)
                        ELSE ans 
                    END),
                    jsonb_object_agg(qid, CASE WHEN rn % 7 = 0 THEN 'WRONG' ELSE 'CORRECT' END),
                    COUNT(*),
                    COUNT(*) - COUNT(*) FILTER (WHERE rn % 7 = 0)
                INTO v_user_answers, v_flags, v_q_count, v_correct_count
                FROM raw_questions;

                IF v_q_count > 0 THEN
                    IF v_att.test_scope = 'SINGLE_PART' THEN
                        v_earned := 26.00;
                    ELSE
                        v_earned := ROUND((v_correct_count::numeric / v_q_count::numeric) * 100.0, 1);
                    END IF;

                    DELETE FROM attempt_answers WHERE attempt_id = v_att.id AND part_id = v_part.part_id;
                    INSERT INTO attempt_answers (attempt_id, part_id, user_answers, is_correct_flags, earned_score, created_at, updated_at)
                    VALUES (v_att.id, v_part.part_id, v_user_answers, v_flags, v_earned, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                END IF;
            END IF;
        END LOOP;
    END LOOP;

END $$;
