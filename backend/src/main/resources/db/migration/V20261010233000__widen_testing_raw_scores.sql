-- V20261010233000__widen_testing_raw_scores.sql
-- TV3-11: Widen test_attempts.overall_score and attempt_answers.earned_score from NUMERIC(4,2) to NUMERIC(10,2)
-- Allows raw scores >= 100 (e.g. 100-200) without numeric overflow while preserving existing decimal scores.

ALTER TABLE test_attempts
  ALTER COLUMN overall_score TYPE NUMERIC(10,2);

ALTER TABLE attempt_answers
  ALTER COLUMN earned_score TYPE NUMERIC(10,2);
