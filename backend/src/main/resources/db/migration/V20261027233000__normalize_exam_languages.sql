-- Migration to normalize exam_language to standard canonical BCP 47 codes ('en', 'vi')
UPDATE exams SET exam_language = 'vi' WHERE type LIKE 'NLTV%' OR title LIKE '%Tiếng Việt%';
UPDATE exams SET exam_language = 'en' WHERE LOWER(exam_language) = 'english';
