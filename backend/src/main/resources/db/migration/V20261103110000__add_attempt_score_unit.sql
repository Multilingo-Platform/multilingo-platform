-- Distinguish raw practice points from IELTS bands and TOEIC scaled estimates in aggregates.
ALTER TABLE test_attempts ADD COLUMN score_unit VARCHAR(30);
