import { describe, it, expect } from 'vitest';
import {
  normalizeExamType,
  EXAM_TYPE_OPTIONS,
  deduplicatePartAndGroupInstructions,
  detectExcelColumns,
  getIeltsTemplateParts,
  getIeltsSampleExcelParts,
  getNltvTemplateParts,
  getPartBounds,
  getMaxGroupsForPart,
  getQuestionNumLabel,
  QUESTION_TYPES,
  type ExamPart
} from '../pages/admin/ExamBuilder';

describe('ExamBuilder utils', () => {
  it('correctly maps various TOEIC strings to TOEIC_LR', () => {
    expect(normalizeExamType('TOEIC')).toBe('TOEIC_LR');
    expect(normalizeExamType('TOEIC_LR')).toBe('TOEIC_LR');
    expect(normalizeExamType('TOEIC_LISTENING_READING')).toBe('TOEIC_LR');
    expect(normalizeExamType('TOEIC (Listening & Reading)')).toBe('TOEIC_LR');
    expect(normalizeExamType('TOEIC L&R')).toBe('TOEIC_LR');
  });

  it('correctly maps TOEIC Writing to TOEIC_WRITING', () => {
    expect(normalizeExamType('TOEIC_WRITING')).toBe('TOEIC_WRITING');
    expect(normalizeExamType('toeic writing')).toBe('TOEIC_WRITING');
  });

  it('correctly maps IELTS variations', () => {
    expect(normalizeExamType('IELTS')).toBe('IELTS_ACADEMIC');
    expect(normalizeExamType('IELTS_ACADEMIC')).toBe('IELTS_ACADEMIC');
    expect(normalizeExamType('IELTS Academic')).toBe('IELTS_ACADEMIC');
    expect(normalizeExamType('IELTS_GENERAL')).toBe('IELTS_GENERAL');
    expect(normalizeExamType('IELTS General')).toBe('IELTS_GENERAL');
  });

  it('correctly maps NLTV variations', () => {
    expect(normalizeExamType('NLTV')).toBe('NLTV');
    expect(normalizeExamType('NLTV_B1_C1')).toBe('NLTV_B1_C1');
    expect(normalizeExamType('NLTV (B1 - C1)')).toBe('NLTV_B1_C1');
    expect(normalizeExamType('NLTV_A1_A2')).toBe('NLTV_A1_A2');
    expect(normalizeExamType('NLTV (A1 - A2)')).toBe('NLTV_A1_A2');
  });

  it('provides readable display labels for all standard exam types', () => {
    expect(EXAM_TYPE_OPTIONS['TOEIC_LR']).toBe('TOEIC (Listening & Reading)');
    expect(EXAM_TYPE_OPTIONS['TOEIC_WRITING']).toBe('TOEIC Writing');
    expect(EXAM_TYPE_OPTIONS['IELTS_ACADEMIC']).toBe('IELTS Academic');
    expect(EXAM_TYPE_OPTIONS['IELTS_GENERAL']).toBe('IELTS General');
    expect(EXAM_TYPE_OPTIONS['NLTV']).toBe('Đánh giá Năng lực Tiếng Việt (NLTV)');
    expect(EXAM_TYPE_OPTIONS['NLTV_B1_C1']).toBeUndefined();
    expect(EXAM_TYPE_OPTIONS['NLTV_A1_A2']).toBeUndefined();
  });

  describe('deduplicatePartAndGroupInstructions', () => {
    it('clears group instructions when they duplicate part instruction', () => {
      const parts: ExamPart[] = [
        {
          part_title: 'Listening Part 1',
          instruction: 'Listen carefully to the audio and answer questions 1-10.',
          question_groups: [
            {
              group_id: 'g1',
              instruction: 'Listen carefully to the audio and answer questions 1-10.',
              content_html: '',
              questions: []
            },
            {
              group_id: 'g2',
              instruction: 'Listen carefully to the audio and answer questions 1-10.',
              content_html: '',
              questions: []
            }
          ]
        }
      ];

      const result = deduplicatePartAndGroupInstructions(parts);
      expect(result[0].instruction).toBe('Listen carefully to the audio and answer questions 1-10.');
      expect(result[0].question_groups[0].instruction).toBe('');
      expect(result[0].question_groups[1].instruction).toBe('');
    });

    it('promotes common group instruction to part instruction if part instruction was empty', () => {
      const parts: ExamPart[] = [
        {
          part_title: 'Reading Part 5',
          instruction: '',
          question_groups: [
            {
              group_id: 'g1',
              instruction: 'Choose the best word to complete each sentence.',
              content_html: '',
              questions: []
            },
            {
              group_id: 'g2',
              instruction: 'Choose the best word to complete each sentence.',
              content_html: '',
              questions: []
            }
          ]
        }
      ];

      const result = deduplicatePartAndGroupInstructions(parts);
      expect(result[0].instruction).toBe('Choose the best word to complete each sentence.');
      expect(result[0].question_groups[0].instruction).toBe('');
      expect(result[0].question_groups[1].instruction).toBe('');
    });

    it('preserves distinct group instructions', () => {
      const parts: ExamPart[] = [
        {
          part_title: 'Part 7: Reading Comprehension',
          instruction: 'Questions 147-200',
          question_groups: [
            {
              group_id: 'g1',
              instruction: 'Questions 147-148 refer to the following notice.',
              content_html: '',
              questions: []
            },
            {
              group_id: 'g2',
              instruction: 'Questions 149-150 refer to the following email.',
              content_html: '',
              questions: []
            }
          ]
        }
      ];

      const result = deduplicatePartAndGroupInstructions(parts);
      expect(result[0].instruction).toBe('Questions 147-200');
      expect(result[0].question_groups[0].instruction).toBe('Questions 147-148 refer to the following notice.');
      expect(result[0].question_groups[1].instruction).toBe('Questions 149-150 refer to the following email.');
    });

    it('handles empty parts and mixed groups gracefully', () => {
      const parts: ExamPart[] = [
        {
          part_title: 'Part 1',
          instruction: 'General Instruction',
          question_groups: [
            {
              group_id: 'g1',
              instruction: 'General Instruction',
              content_html: '',
              questions: []
            },
            {
              group_id: 'g2',
              instruction: 'Specific Instruction for Group 2',
              content_html: '',
              questions: []
            }
          ]
        },
        {
          part_title: 'Part 2',
          instruction: '',
          question_groups: []
        }
      ];

      const result = deduplicatePartAndGroupInstructions(parts);
      expect(result[0].question_groups[0].instruction).toBe('');
      expect(result[0].question_groups[1].instruction).toBe('Specific Instruction for Group 2');
      expect(result[1].instruction).toBe('');
      expect(result[1].question_groups).toHaveLength(0);
    });
  });

  describe('detectExcelColumns', () => {
    it('correctly maps 16-column layout with separate Part and Group instructions and passage', () => {
      const headers = [
        'Phần (Part)',
        'Hướng dẫn chung (Phần)',
        'Nhóm (Group)',
        'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)',
        'Nội dung nhóm (Văn bản đọc/nghe)',
        'Câu hỏi (Question Text)',
        'Lựa chọn A',
        'Lựa chọn B',
        'Lựa chọn C',
        'Lựa chọn D',
        'Đáp án đúng',
        'Giải thích',
        'Audio/File chung (Phần)',
        'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];

      const colMap = detectExcelColumns(headers);
      expect(colMap.part).toBe(1);
      expect(colMap.partInstruction).toBe(2);
      expect(colMap.group).toBe(3);
      expect(colMap.type).toBe(4);
      expect(colMap.groupInstruction).toBe(5);
      expect(colMap.passage).toBe(6);
      expect(colMap.question).toBe(7);
      expect(colMap.optA).toBe(8);
      expect(colMap.optB).toBe(9);
      expect(colMap.optC).toBe(10);
      expect(colMap.optD).toBe(11);
      expect(colMap.correct).toBe(12);
      expect(colMap.explanation).toBe(13);
      expect(colMap.partMedia).toBe(14);
      expect(colMap.groupMedia).toBe(15);
      expect(colMap.qMedia).toBe(16);
    });

    it('does not confuse "Nội dung nhóm (Văn bản đọc/nghe)" with group name or instruction', () => {
      const headers = [
        'Phần (Part)',
        'Hướng dẫn chung (Phần)',
        'Nhóm (Group)',
        'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)',
        'Nội dung nhóm (Văn bản đọc/nghe)',
        'Câu hỏi (Question Text)'
      ];

      const colMap = detectExcelColumns(headers);
      // Group column must be col 3, NOT col 6
      expect(colMap.group).toBe(3);
      // Group instruction must be col 5
      expect(colMap.groupInstruction).toBe(5);
      // Passage must be col 6 (Nội dung nhóm), NOT col 5 or col 7
      expect(colMap.passage).toBe(6);
      // Question must be col 7
      expect(colMap.question).toBe(7);
    });

    it('correctly maps legacy 15-column layout', () => {
      const headers = [
        'Phần (Part)',
        'Nhóm (Group)',
        'Loại câu hỏi (Type)',
        'Hướng dẫn (Instruction)',
        'Nội dung đoạn văn / Đề bài (Passage / Prompt)',
        'Câu hỏi (Question Text)',
        'Lựa chọn A (Option A)',
        'Lựa chọn B (Option B)',
        'Lựa chọn C (Option C)',
        'Lựa chọn D (Option D)',
        'Đáp án đúng (Key)',
        'Giải thích chi tiết (Explanation)',
        'Audio/File chung (Part)',
        'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];

      const colMap = detectExcelColumns(headers);
      expect(colMap.part).toBe(1);
      expect(colMap.group).toBe(2);
      expect(colMap.type).toBe(3);
      expect(colMap.legacyInstruction).toBe(4);
      expect(colMap.passage).toBe(5);
      expect(colMap.question).toBe(6);
      expect(colMap.optA).toBe(7);
      expect(colMap.optB).toBe(8);
      expect(colMap.optC).toBe(9);
      expect(colMap.optD).toBe(10);
      expect(colMap.correct).toBe(11);
      expect(colMap.explanation).toBe(12);
      expect(colMap.partMedia).toBe(13);
      expect(colMap.groupMedia).toBe(14);
      expect(colMap.qMedia).toBe(15);
    });

    it('gracefully falls back when headers are missing or empty', () => {
      const emptyHeaders: string[] = [];
      const colMap = detectExcelColumns(emptyHeaders);
      expect(colMap.part).toBe(1);
      expect(colMap.group).toBe(2);
      expect(colMap.type).toBe(3);
      expect(colMap.passage).toBe(5);
      expect(colMap.question).toBe(6);
    });
  });

  describe('IELTS Template and Dynamic Question Groups', () => {
    it('getIeltsTemplateParts generates 9 parts without hardcoded multiple choice questions', () => {
      const parts = getIeltsTemplateParts();
      expect(parts).toHaveLength(9);

      // Listening Part 1-4: question_groups must be empty so user can create them dynamically
      const listeningParts = parts.slice(0, 4);
      expect(listeningParts.map(p => p.part_title)).toEqual([
        'Listening Part 1',
        'Listening Part 2',
        'Listening Part 3',
        'Listening Part 4'
      ]);
      listeningParts.forEach(p => {
        expect(p.question_groups).toEqual([]);
      });

      // Reading Passage 1-3: question_groups must be empty so user can create them dynamically
      const readingParts = parts.slice(4, 7);
      expect(readingParts.map(p => p.part_title)).toEqual([
        'Reading Passage 1',
        'Reading Passage 2',
        'Reading Passage 3'
      ]);
      readingParts.forEach(p => {
        expect(p.question_groups).toEqual([]);
      });

      // Writing Tasks (Task 1 & Task 2)
      const writingParts = parts.slice(7, 9);
      expect(writingParts[0].part_title).toBe('Writing Task 1');
      expect(writingParts[0].question_groups[0].questions[0].type).toBe('WRITING_ESSAY');
      expect(writingParts[1].part_title).toBe('Writing Task 2');
      expect(writingParts[1].question_groups[0].questions[0].type).toBe('WRITING_ESSAY');
    });

    it('getPartBounds returns accurate bounds for IELTS parts and passages', () => {
      expect(getPartBounds('Listening Part 1', 'IELTS_ACADEMIC')).toEqual({ start: 1, end: 10 });
      expect(getPartBounds('Listening Part 2', 'IELTS_ACADEMIC')).toEqual({ start: 11, end: 20 });
      expect(getPartBounds('Listening Part 3', 'IELTS_ACADEMIC')).toEqual({ start: 21, end: 30 });
      expect(getPartBounds('Listening Part 4', 'IELTS_ACADEMIC')).toEqual({ start: 31, end: 40 });
      expect(getPartBounds('Reading Passage 1', 'IELTS_ACADEMIC')).toEqual({ start: 1, end: 13 });
      expect(getPartBounds('Reading Passage 2', 'IELTS_ACADEMIC')).toEqual({ start: 14, end: 26 });
      expect(getPartBounds('Reading Passage 3', 'IELTS_ACADEMIC')).toEqual({ start: 27, end: 40 });
      expect(getPartBounds('Writing Task 1', 'IELTS_ACADEMIC')).toEqual({ start: 1, end: 1 });
      expect(getPartBounds('Writing Task 2', 'IELTS_ACADEMIC')).toEqual({ start: 2, end: 2 });

      // Case insensitivity & partial match
      expect(getPartBounds('listening part 1: notes completion', 'IELTS_GENERAL')).toEqual({ start: 1, end: 10 });
      expect(getPartBounds('passage 2: science history', 'IELTS_ACADEMIC')).toEqual({ start: 14, end: 26 });
      expect(getPartBounds('task 1: chart description', 'IELTS_ACADEMIC')).toEqual({ start: 1, end: 1 });
    });

    it('getPartBounds returns accurate bounds for NLTV parts', () => {
      expect(getPartBounds('Kỹ năng Nghe - Phần 1', 'NLTV')).toEqual({ start: 1, end: 15 });
      expect(getPartBounds('Kỹ năng Nghe - Phần 2', 'NLTV')).toEqual({ start: 16, end: 29 });
      expect(getPartBounds('Kỹ năng Nghe - Phần 3', 'NLTV')).toEqual({ start: 30, end: 43 });
      expect(getPartBounds('Kỹ năng Nghe - Phần 4', 'NLTV')).toEqual({ start: 44, end: 55 });
      expect(getPartBounds('Kỹ năng Đọc - Phần 1', 'NLTV')).toEqual({ start: 1, end: 16 });
      expect(getPartBounds('Kỹ năng Đọc - Phần 2', 'NLTV')).toEqual({ start: 17, end: 40 });
      expect(getPartBounds('Kỹ năng Viết - Phần 1', 'NLTV')).toEqual({ start: 1, end: 10 });
      expect(getPartBounds('Kỹ năng Viết - Phần 2', 'NLTV')).toEqual({ start: 1, end: 1 });
      expect(getPartBounds('Kỹ năng Viết - Phần 3', 'NLTV')).toEqual({ start: 1, end: 1 });
    });

    it('getPartBounds returns accurate bounds for TOEIC Writing parts', () => {
      expect(getPartBounds('Part 1: Write a Sentence Based on a Picture', 'TOEIC_WRITING')).toEqual({ start: 1, end: 5 });
      expect(getPartBounds('Part 2: Respond to a Written Request', 'TOEIC_WRITING')).toEqual({ start: 6, end: 7 });
      expect(getPartBounds('Part 3: Write an Opinion Essay', 'TOEIC_WRITING')).toEqual({ start: 8, end: 8 });
    });

    it('getNltvTemplateParts generates standard 9 parts with correct group and question structures', () => {
      const parts = getNltvTemplateParts();
      expect(parts).toHaveLength(9);

      // Listening: 4 parts, 55 questions total
      const lParts = parts.slice(0, 4);
      expect(lParts[0].part_title).toBe('Kỹ năng Nghe - Phần 1');
      expect(lParts[0].question_groups).toHaveLength(1);
      expect(lParts[0].question_groups[0].questions).toHaveLength(15);
      expect(lParts[0].question_groups[0].questions[0].question_id).toBe('q_001');
      expect(lParts[0].question_groups[0].questions[14].question_id).toBe('q_015');
      expect(lParts[0].question_groups.reduce((acc, g) => acc + g.questions.length, 0)).toBe(15);

      expect(lParts[1].part_title).toBe('Kỹ năng Nghe - Phần 2');
      expect(lParts[1].question_groups).toHaveLength(5);
      expect(lParts[1].question_groups[0].questions).toHaveLength(6);
      expect(lParts[1].question_groups[1].questions).toHaveLength(2);
      expect(lParts[1].question_groups.reduce((acc, g) => acc + g.questions.length, 0)).toBe(14);

      expect(lParts[2].part_title).toBe('Kỹ năng Nghe - Phần 3');
      expect(lParts[2].question_groups).toHaveLength(7);
      expect(lParts[2].question_groups.reduce((acc, g) => acc + g.questions.length, 0)).toBe(14);

      expect(lParts[3].part_title).toBe('Kỹ năng Nghe - Phần 4');
      expect(lParts[3].question_groups).toHaveLength(6);
      expect(lParts[3].question_groups.reduce((acc, g) => acc + g.questions.length, 0)).toBe(12);

      const totalListeningQs = lParts.reduce((acc, p) => acc + p.question_groups.reduce((a, g) => a + g.questions.length, 0), 0);
      expect(totalListeningQs).toBe(55);

      // Reading: 2 parts, 5 groups (passages), 40 questions total
      const rParts = parts.slice(4, 6);
      expect(rParts[0].part_title).toBe('Kỹ năng Đọc - Phần 1');
      expect(rParts[0].question_groups).toHaveLength(2);
      expect(rParts[0].question_groups[0].questions).toHaveLength(10);
      expect(rParts[0].question_groups[1].questions).toHaveLength(6);

      expect(rParts[1].part_title).toBe('Kỹ năng Đọc - Phần 2');
      expect(rParts[1].question_groups).toHaveLength(3);
      expect(rParts[1].question_groups[0].questions).toHaveLength(8);
      expect(rParts[1].question_groups[1].questions).toHaveLength(8);
      expect(rParts[1].question_groups[2].questions).toHaveLength(8);

      const totalReadingQs = rParts.reduce((acc, p) => acc + p.question_groups.reduce((a, g) => a + g.questions.length, 0), 0);
      expect(totalReadingQs).toBe(40);

      // Writing: 3 parts
      const wParts = parts.slice(6, 9);
      expect(wParts[0].part_title).toBe('Kỹ năng Viết - Phần 1');
      expect(wParts[0].shared_audio).toBeDefined();
      expect(wParts[0].question_groups).toHaveLength(1);
      expect(wParts[0].question_groups[0].questions).toHaveLength(10);
      expect(wParts[0].question_groups[0].questions[0].type).toBe('FILL_IN_THE_BLANK');
      expect(wParts[0].question_groups[0].questions[0].question_id).toBe('q_001');
      expect(wParts[0].question_groups[0].questions[9].question_id).toBe('q_010');
      expect(wParts[0].question_groups[0].questions[0].question_text).toBe('Chỗ trống (1)');
      expect(wParts[0].question_groups[0].questions[9].question_text).toBe('Chỗ trống (10)');

      expect(wParts[1].part_title).toBe('Kỹ năng Viết - Phần 2');
      expect(wParts[1].question_groups[0].questions[0].type).toBe('WRITING_ESSAY');

      expect(wParts[2].part_title).toBe('Kỹ năng Viết - Phần 3');
      expect(wParts[2].question_groups[0].questions[0].type).toBe('WRITING_ESSAY');
    });

    it('getQuestionNumLabel correctly formats question numbers and prevents showing "nltv"', () => {
      // Standard IDs
      expect(getQuestionNumLabel('q_001', 1)).toBe('1');
      expect(getQuestionNumLabel('q_015', 15)).toBe('15');
      expect(getQuestionNumLabel('q_100', 100)).toBe('100');

      // Regression: former prefix with "nltv"
      expect(getQuestionNumLabel('q_nltv_001', 1)).toBe('1');
      expect(getQuestionNumLabel('q_nltv_015', 15)).toBe('15');
      expect(getQuestionNumLabel('q_nltv_w_005', 5)).toBe('5');

      // Writing IDs
      expect(getQuestionNumLabel('q_w_001', 1)).toBe('1');
      expect(getQuestionNumLabel('q_w_002', 2)).toBe('2');

      // Fallbacks and arbitrary text
      expect(getQuestionNumLabel('câu 7', 1)).toBe('7');
      expect(getQuestionNumLabel('no-numbers', 4)).toBe('4');
      expect(getQuestionNumLabel('', 3)).toBe('3');
      expect(getQuestionNumLabel(undefined, 8)).toBe('8');
    });

    it('getMaxGroupsForPart accurately enforces group limits for NLTV parts', () => {
      expect(getMaxGroupsForPart('Kỹ năng Nghe - Phần 1', 'NLTV')).toBe(1);
      expect(getMaxGroupsForPart('Kỹ năng Nghe - Phần 2', 'NLTV')).toBe(5);
      expect(getMaxGroupsForPart('Kỹ năng Nghe - Phần 3', 'NLTV')).toBe(7);
      expect(getMaxGroupsForPart('Kỹ năng Nghe - Phần 4', 'NLTV')).toBe(6);
      expect(getMaxGroupsForPart('Kỹ năng Đọc - Phần 1', 'NLTV')).toBe(2);
      expect(getMaxGroupsForPart('Kỹ năng Đọc - Phần 2', 'NLTV')).toBe(3);
      expect(getMaxGroupsForPart('Kỹ năng Viết - Phần 1', 'NLTV')).toBe(1);
      expect(getMaxGroupsForPart('Kỹ năng Viết - Phần 2', 'NLTV')).toBe(1);
      expect(getMaxGroupsForPart('Kỹ năng Viết - Phần 3', 'NLTV')).toBe(1);
    });

    it('QUESTION_TYPES includes canonical FILL_IN_THE_BLANK and IELTS-relevant types', () => {
      const typeValues = QUESTION_TYPES.map(q => q.value);
      expect(typeValues).toContain('FILL_IN_THE_BLANK');
      expect(typeValues).toContain('MULTIPLE_CHOICE');
      expect(typeValues).toContain('MULTIPLE_CHOICE_MULTI');
      expect(typeValues).toContain('TRUE_FALSE_NOT_GIVEN');
      expect(typeValues).toContain('YES_NO_NOT_GIVEN');
      expect(typeValues).toContain('MATCHING_HEADINGS');
      expect(typeValues).toContain('MATCHING_FEATURES');

      const multiChoice = QUESTION_TYPES.find(q => q.value === 'MULTIPLE_CHOICE_MULTI');
      expect(multiChoice?.label).toBe('Trắc nghiệm Chọn 2 đáp án (Choose 2 / A-E)');
    });

    it('detectExcelColumns supports optional Lựa chọn E (Option E)', () => {
      const headers17 = [
        'Phần (Part)', 'Hướng dẫn chung (Phần)', 'Nhóm (Group)', 'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)', 'Nội dung nhóm (Văn bản đọc/nghe)', 'Câu hỏi (Question Text)',
        'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Lựa chọn E',
        'Đáp án đúng', 'Giải thích', 'Audio/File chung (Phần)', 'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];
      const colMap17 = detectExcelColumns(headers17);
      expect(colMap17.optD).toBe(11);
      expect(colMap17.optE).toBe(12);
      expect(colMap17.correct).toBe(13);

      const headers16 = [
        'Phần (Part)', 'Hướng dẫn chung (Phần)', 'Nhóm (Group)', 'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)', 'Nội dung nhóm (Văn bản đọc/nghe)', 'Câu hỏi (Question Text)',
        'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D',
        'Đáp án đúng', 'Giải thích', 'Audio/File chung (Phần)', 'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];
      const colMap16 = detectExcelColumns(headers16);
      expect(colMap16.optD).toBe(11);
      expect(colMap16.optE).toBe(-1);
      expect(colMap16.optF).toBe(-1);
      expect(colMap16.optG).toBe(-1);
      expect(colMap16.correct).toBe(12);
    });

    it('detectExcelColumns supports optional Lựa chọn F, G, H for matching sentence endings', () => {
      const headers19 = [
        'Phần (Part)', 'Hướng dẫn chung (Phần)', 'Nhóm (Group)', 'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)', 'Nội dung nhóm (Văn bản đọc/nghe)', 'Câu hỏi (Question Text)',
        'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Lựa chọn E', 'Lựa chọn F', 'Lựa chọn G',
        'Đáp án đúng', 'Giải thích', 'Audio/File chung (Phần)', 'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];
      const colMap19 = detectExcelColumns(headers19);
      expect(colMap19.optA).toBe(8);
      expect(colMap19.optE).toBe(12);
      expect(colMap19.optF).toBe(13);
      expect(colMap19.optG).toBe(14);
      expect(colMap19.correct).toBe(15);
      expect(colMap19.explanation).toBe(16);
    });

    it('detectExcelColumns supports all 8 options A to H (20 columns)', () => {
      const headers20 = [
        'Phần (Part)', 'Hướng dẫn chung (Phần)', 'Nhóm (Group)', 'Loại câu hỏi (Type)',
        'Hướng dẫn riêng (Nhóm)', 'Nội dung nhóm (Văn bản đọc/nghe)', 'Câu hỏi (Question Text)',
        'Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D', 'Lựa chọn E', 'Lựa chọn F', 'Lựa chọn G', 'Lựa chọn H',
        'Đáp án đúng', 'Giải thích', 'Audio/File chung (Phần)', 'Đính kèm chung (Nhóm)',
        'Đính kèm riêng (Câu hỏi)'
      ];
      const colMap20 = detectExcelColumns(headers20);
      expect(colMap20.optA).toBe(8);
      expect(colMap20.optE).toBe(12);
      expect(colMap20.optF).toBe(13);
      expect(colMap20.optG).toBe(14);
      expect(colMap20.optH).toBe(15);
      expect(colMap20.correct).toBe(16);
      expect(colMap20.explanation).toBe(17);
      expect(colMap20.partMedia).toBe(18);
      expect(colMap20.groupMedia).toBe(19);
      expect(colMap20.qMedia).toBe(20);
    });

    it('detectExcelColumns supports "Choice A-H" and "Đáp án A-H" without colliding with "Đáp án đúng"', () => {
      const headersChoice = [
        'Part', 'Part Instruction', 'Group', 'Type', 'Group Instruction', 'Passage', 'Question',
        'Choice A', 'Choice B', 'Choice C', 'Choice D', 'Choice E', 'Choice F', 'Choice G', 'Choice H',
        'Correct Answer', 'Explanation', 'Part Media', 'Group Media', 'Question Media'
      ];
      const colMapChoice = detectExcelColumns(headersChoice);
      expect(colMapChoice.optA).toBe(8);
      expect(colMapChoice.optB).toBe(9);
      expect(colMapChoice.optC).toBe(10);
      expect(colMapChoice.optD).toBe(11);
      expect(colMapChoice.optE).toBe(12);
      expect(colMapChoice.optF).toBe(13);
      expect(colMapChoice.optG).toBe(14);
      expect(colMapChoice.optH).toBe(15);
      expect(colMapChoice.correct).toBe(16);

      const headersDapAn = [
        'Phần', 'Hướng dẫn chung', 'Nhóm', 'Loại', 'Hướng dẫn riêng', 'Nội dung', 'Câu hỏi',
        'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D',
        'Đáp án đúng', 'Giải thích', 'Audio', 'Ảnh', 'Đính kèm'
      ];
      const colMapDapAn = detectExcelColumns(headersDapAn);
      expect(colMapDapAn.optA).toBe(8);
      expect(colMapDapAn.optB).toBe(9);
      expect(colMapDapAn.optC).toBe(10);
      expect(colMapDapAn.optD).toBe(11);
      expect(colMapDapAn.correct).toBe(12);
    });

    it('QUESTION_TYPES includes MATCHING_SENTENCE_ENDINGS and MATCHING_FEATURES', () => {
      const typeValues = QUESTION_TYPES.map(q => q.value);
      expect(typeValues).toContain('MATCHING_SENTENCE_ENDINGS');
      expect(typeValues).toContain('MATCHING_FEATURES');

      const sentenceEndings = QUESTION_TYPES.find(q => q.value === 'MATCHING_SENTENCE_ENDINGS');
      expect(sentenceEndings?.label).toContain('Sentence Endings');
    });

    it('getIeltsSampleExcelParts provides diverse question types for Excel templates', () => {
      const sampleParts = getIeltsSampleExcelParts();
      expect(sampleParts).toHaveLength(9);

      // Check that Listening Part 1 has both FILL_IN_THE_BLANK and MULTIPLE_CHOICE
      const l1Groups = sampleParts[0].question_groups;
      expect(l1Groups.length).toBeGreaterThan(1);
      expect(l1Groups[0].questions[0].type).toBe('FILL_IN_THE_BLANK');
      expect(l1Groups[1].questions[0].type).toBe('MULTIPLE_CHOICE');

      // Check that Reading Passage 1 has TRUE_FALSE_NOT_GIVEN
      const r1Groups = sampleParts[4].question_groups;
      expect(r1Groups[0].questions[0].type).toBe('TRUE_FALSE_NOT_GIVEN');

      // Check that Reading Passage 2 has MATCHING_HEADINGS
      const r2Groups = sampleParts[5].question_groups;
      expect(r2Groups[0].questions[0].type).toBe('MATCHING_HEADINGS');
    });
  });
});



