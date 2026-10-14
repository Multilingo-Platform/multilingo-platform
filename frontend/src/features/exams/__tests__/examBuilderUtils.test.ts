import { describe, it, expect } from 'vitest';
import {
  normalizeExamType,
  EXAM_TYPE_OPTIONS,
  deduplicatePartAndGroupInstructions,
  detectExcelColumns,
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
    expect(normalizeExamType('NLTV')).toBe('NLTV_B1_C1');
    expect(normalizeExamType('NLTV_B1_C1')).toBe('NLTV_B1_C1');
    expect(normalizeExamType('NLTV (B1 - C1)')).toBe('NLTV_B1_C1');
    expect(normalizeExamType('NLTV_A1_A2')).toBe('NLTV_A1_A2');
  });

  it('provides readable display labels for all standard exam types', () => {
    expect(EXAM_TYPE_OPTIONS['TOEIC_LR']).toBe('TOEIC (Listening & Reading)');
    expect(EXAM_TYPE_OPTIONS['TOEIC_WRITING']).toBe('TOEIC Writing');
    expect(EXAM_TYPE_OPTIONS['IELTS_ACADEMIC']).toBe('IELTS Academic');
    expect(EXAM_TYPE_OPTIONS['IELTS_GENERAL']).toBe('IELTS General');
    expect(EXAM_TYPE_OPTIONS['NLTV_B1_C1']).toBe('NLTV (B1 - C1)');
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
});


