import { describe, it, expect } from 'vitest';
import { isAnswered } from '../utils/answerUtils';
import type { QuestionType } from '../types/exam.types';

describe('answerUtils - isAnswered', () => {
  describe('null / undefined inputs', () => {
    it('returns false for undefined', () => {
      expect(isAnswered(undefined)).toBe(false);
      expect(isAnswered(undefined, 'ESSAY')).toBe(false);
      expect(isAnswered(undefined, 'SINGLE_CHOICE')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isAnswered(null)).toBe(false);
      expect(isAnswered(null, 'ESSAY')).toBe(false);
      expect(isAnswered(null, 'MULTIPLE_CHOICE')).toBe(false);
    });
  });

  describe('string inputs (ESSAY, FILL_IN_THE_BLANK, SINGLE_CHOICE, etc.)', () => {
    it('returns false for empty string ""', () => {
      expect(isAnswered('', 'ESSAY')).toBe(false);
      expect(isAnswered('', 'FILL_IN_THE_BLANK')).toBe(false);
      expect(isAnswered('', 'SINGLE_CHOICE')).toBe(false);
    });

    it('returns false for whitespace-only strings', () => {
      expect(isAnswered('   ', 'ESSAY')).toBe(false);
      expect(isAnswered('\n\t\r\n  ', 'ESSAY')).toBe(false);
      expect(isAnswered('  ', 'FILL_IN_THE_BLANK')).toBe(false);
    });

    it('returns true for non-empty text', () => {
      expect(isAnswered('a', 'ESSAY')).toBe(true);
      expect(isAnswered('This is my essay.', 'ESSAY')).toBe(true);
      expect(isAnswered('  valid answer  ', 'FILL_IN_THE_BLANK')).toBe(true);
      expect(isAnswered('A', 'SINGLE_CHOICE')).toBe(true);
      expect(isAnswered('TRUE', 'TRUE_FALSE_NOT_GIVEN')).toBe(true);
    });
  });

  describe('array inputs (MULTIPLE_CHOICE)', () => {
    it('returns false for empty array []', () => {
      expect(isAnswered([], 'MULTIPLE_CHOICE')).toBe(false);
    });

    it('returns false for array containing only empty strings', () => {
      expect(isAnswered(['', '   '], 'MULTIPLE_CHOICE')).toBe(false);
    });

    it('returns true for array with valid selections', () => {
      expect(isAnswered(['A'], 'MULTIPLE_CHOICE')).toBe(true);
      expect(isAnswered(['A', 'B'], 'MULTIPLE_CHOICE')).toBe(true);
    });
  });

  describe('object inputs (MATCHING, LABELING)', () => {
    it('returns false for empty object {}', () => {
      expect(isAnswered({}, 'MATCHING_FEATURES')).toBe(false);
      expect(isAnswered({}, 'MAP_LABELING')).toBe(false);
    });

    it('returns false for object with only empty/blank values', () => {
      expect(isAnswered({ '1': '' }, 'MATCHING_FEATURES')).toBe(false);
      expect(isAnswered({ '1': '   ', '2': '' }, 'MATCHING_FEATURES')).toBe(false);
    });

    it('returns true for object with at least one answered pair', () => {
      expect(isAnswered({ '1': 'B' }, 'MATCHING_FEATURES')).toBe(true);
      expect(isAnswered({ '1': '', '2': 'C' }, 'MATCHING_FEATURES')).toBe(true);
    });
  });

  describe('parameterized edge-case matrix', () => {
    const matrix: Array<{ val: unknown; type?: QuestionType; expected: boolean }> = [
      { val: undefined, expected: false },
      { val: null, expected: false },
      { val: '', type: 'ESSAY', expected: false },
      { val: '   ', type: 'ESSAY', expected: false },
      { val: '\n\t', type: 'ESSAY', expected: false },
      { val: 'a', type: 'ESSAY', expected: true },
      { val: '', type: 'FILL_IN_THE_BLANK', expected: false },
      { val: 'word', type: 'FILL_IN_THE_BLANK', expected: true },
      { val: [], type: 'MULTIPLE_CHOICE', expected: false },
      { val: ['A'], type: 'MULTIPLE_CHOICE', expected: true },
      { val: {}, type: 'MATCHING_FEATURES', expected: false },
      { val: { '1': '' }, type: 'MATCHING_FEATURES', expected: false },
      { val: { '1': 'B' }, type: 'MATCHING_FEATURES', expected: true },
      { val: 'A', type: 'SINGLE_CHOICE', expected: true },
    ];

    matrix.forEach(({ val, type, expected }, idx) => {
      it(`matrix item #${idx}: ${JSON.stringify(val)} (${type}) -> ${expected}`, () => {
        expect(isAnswered(val, type)).toBe(expected);
      });
    });
  });
});
