import { describe, it, expect } from 'vitest';
import {
  formatBandScore,
  getCriterionName,
  getTaskStatusLabel,
  sortCriteriaCanonical,
  CANONICAL_CRITERIA_CODES,
} from '../utils/writingFeedbackPresentation';
import type { WritingCriterion } from '../types/api.types';

describe('writingFeedbackPresentation', () => {
  describe('formatBandScore', () => {
    it('formats numbers according to vi-VN locale with 1 decimal digit', () => {
      expect(formatBandScore(7.0)).toBe('7,0');
      expect(formatBandScore(6.5)).toBe('6,5');
      expect(formatBandScore(0.0)).toBe('0,0');
      expect(formatBandScore(9.0)).toBe('9,0');
      expect(formatBandScore(8.5)).toBe('8,5');
    });

    it('does not turn null or undefined into 0 or 0,0', () => {
      expect(formatBandScore(null)).toBe('Chưa có điểm');
      expect(formatBandScore(undefined)).toBe('Chưa có điểm');
      expect(formatBandScore(null, '--')).toBe('--');
      expect(formatBandScore(undefined, 'N/A')).toBe('N/A');
    });

    it('distinguishes 0 from null/undefined', () => {
      expect(formatBandScore(0)).toBe('0,0');
      expect(formatBandScore(0)).not.toBe('Chưa có điểm');
    });
  });

  describe('criteria mapping', () => {
    it('maps all 4 IELTS canonical criteria codes to standard names', () => {
      expect(CANONICAL_CRITERIA_CODES).toEqual(['TR', 'CC', 'LR', 'GRA']);
      expect(getCriterionName('TR')).toBe('Task Response');
      expect(getCriterionName('CC')).toBe('Coherence & Cohesion');
      expect(getCriterionName('LR')).toBe('Lexical Resource');
      expect(getCriterionName('GRA')).toBe('Grammatical Range & Accuracy');
    });

    it('sorts criteria according to canonical order [TR, CC, LR, GRA]', () => {
      const unordered: WritingCriterion[] = [
        { code: 'GRA', score: 6.5, feedback: 'Grammar feedback' },
        { code: 'LR', score: 7.0, feedback: 'Vocab feedback' },
        { code: 'TR', score: 8.0, feedback: 'Task response feedback' },
        { code: 'CC', score: 7.5, feedback: 'Coherence feedback' },
      ];

      const sorted = sortCriteriaCanonical(unordered);
      expect(sorted.map(c => c.code)).toEqual(['TR', 'CC', 'LR', 'GRA']);
      expect(sorted[0].score).toBe(8.0);
      expect(sorted[1].score).toBe(7.5);
      expect(sorted[2].score).toBe(7.0);
      expect(sorted[3].score).toBe(6.5);
    });

    it('does not mutate the original criteria array', () => {
      const original: WritingCriterion[] = [
        { code: 'GRA', score: 6.0, feedback: 'f1' },
        { code: 'TR', score: 7.0, feedback: 'f2' },
      ];
      const cloned = [...original];
      sortCriteriaCanonical(original);
      expect(original).toEqual(cloned);
    });
  });

  describe('getTaskStatusLabel', () => {
    it('maps all task statuses to clear Vietnamese labels', () => {
      expect(getTaskStatusLabel('DONE')).toBe('Đã có kết quả');
      expect(getTaskStatusLabel('PENDING')).toBe('Đang chờ chấm');
      expect(getTaskStatusLabel('QUEUED')).toBe('Đang trong hàng đợi');
      expect(getTaskStatusLabel('FAILED')).toBe('Chấm điểm thất bại');
      expect(getTaskStatusLabel('UNAVAILABLE')).toBe('Chưa có nhận xét');
    });
  });
});
