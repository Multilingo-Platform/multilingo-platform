import { describe, it, expect } from 'vitest';
import {
  normalizeExamType,
  EXAM_TYPE_OPTIONS,
  deduplicatePartAndGroupInstructions,
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
});

