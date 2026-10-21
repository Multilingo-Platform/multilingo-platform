-- V20261021170100__unpublish_mock_toeic_exam.sql
-- Vô hiệu hóa đề thi mock ban đầu (TOEIC_MOCK_01) khỏi thư viện đề thi của học viên.
UPDATE exams
SET is_published = false
WHERE code = 'TOEIC_MOCK_01';
