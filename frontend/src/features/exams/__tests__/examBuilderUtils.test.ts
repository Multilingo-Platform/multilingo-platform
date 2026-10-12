import { describe, it, expect } from 'vitest';
import { normalizeExamType, EXAM_TYPE_OPTIONS } from '../pages/admin/ExamBuilder';

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
});
