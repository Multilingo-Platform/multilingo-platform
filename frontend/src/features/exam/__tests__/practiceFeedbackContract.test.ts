import { describe, it, expect } from 'vitest';
import {
  PracticeFeedbackContractError,
  validatePracticeFeedbackRequest,
  normalizePracticeFeedback,
  areAnswerValuesEqual,
} from '../api/practiceFeedbackContract';
import { practiceFeedbackFixture } from './fixtures/practiceFeedback';
import type { PracticeFeedbackRequest } from '../types/api.types';

describe('TV3-16-01 practiceFeedbackContract', () => {
  describe('validatePracticeFeedbackRequest', () => {
    const validReq: PracticeFeedbackRequest = {
      partId: 10,
      questionId: 'q1',
      answer: 'A',
    };

    it('accepts valid request with string answer', () => {
      expect(() => validatePracticeFeedbackRequest(42, validReq)).not.toThrow();
    });

    it('accepts valid request with null answer', () => {
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: null })
      ).not.toThrow();
    });

    it('accepts valid request with empty string or whitespace answer', () => {
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: '' })
      ).not.toThrow();
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: '   ' })
      ).not.toThrow();
    });

    it('accepts valid request with array of strings', () => {
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: ['A', 'B'] })
      ).not.toThrow();
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: [] })
      ).not.toThrow();
    });

    it('accepts valid request with map/record of strings', () => {
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: { '1': 'A', '2': 'B' } })
      ).not.toThrow();
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: {} })
      ).not.toThrow();
    });

    it.each([0, -1, 1.5, 2147483648, NaN, Infinity, null, undefined, '42'])(
      'rejects invalid attemptId %s',
      (invalidId) => {
        expect(() =>
          validatePracticeFeedbackRequest(invalidId as any, validReq)
        ).toThrow(PracticeFeedbackContractError);
      }
    );

    it.each([0, -1, 1.5, 2147483648, NaN, Infinity, null, undefined, '10'])(
      'rejects invalid partId %s',
      (invalidPartId) => {
        expect(() =>
          validatePracticeFeedbackRequest(42, { ...validReq, partId: invalidPartId as any })
        ).toThrow(PracticeFeedbackContractError);
      }
    );

    it.each(['', '   ', null, undefined, 123, {}])(
      'rejects invalid or blank questionId %s',
      (invalidQId) => {
        expect(() =>
          validatePracticeFeedbackRequest(42, { ...validReq, questionId: invalidQId as any })
        ).toThrow(PracticeFeedbackContractError);
      }
    );

    it.each([
      123,
      true,
      ['A', 1],
      ['A', null],
      { '1': 100 },
      { '1': null },
      { '1': { nested: 'obj' } },
    ])('rejects non-AnswerValue answer %j', (invalidAnswer) => {
      expect(() =>
        validatePracticeFeedbackRequest(42, { ...validReq, answer: invalidAnswer as any })
      ).toThrow(PracticeFeedbackContractError);
    });

    it('rejects null or non-object request', () => {
      expect(() => validatePracticeFeedbackRequest(42, null as any)).toThrow(
        PracticeFeedbackContractError
      );
      expect(() => validatePracticeFeedbackRequest(42, undefined as any)).toThrow(
        PracticeFeedbackContractError
      );
      expect(() => validatePracticeFeedbackRequest(42, 'request' as any)).toThrow(
        PracticeFeedbackContractError
      );
    });
  });

  describe('normalizePracticeFeedback', () => {
    it('normalizes valid raw feedback response and preserves all 9 contract fields', () => {
      const raw = practiceFeedbackFixture({
        score: 1.5,
        userAnswer: ['A', 'B'],
        correctAnswer: ['A', 'B'],
        explanation: 'Giải thích chi tiết',
      });

      const result = normalizePracticeFeedback(raw, 42, 10, 'q1');

      expect(result).toEqual({
        attemptId: 42,
        partId: 10,
        questionId: 'q1',
        type: 'SINGLE_CHOICE',
        userAnswer: ['A', 'B'],
        verdict: 'CORRECT',
        score: 1.5,
        correctAnswer: ['A', 'B'],
        explanation: 'Giải thích chi tiết',
      });
    });

    it('preserves score > 1 without clamping', () => {
      const raw = practiceFeedbackFixture({
        type: 'MATCHING',
        score: 2,
        correctAnswer: { '1': 'A', '2': 'B' },
        userAnswer: { '1': 'A', '2': 'B' },
      });

      const result = normalizePracticeFeedback(raw, 42, 10, 'q1');
      expect(result.score).toBe(2);
      expect(result.type).toBe('MATCHING');
      expect(result.correctAnswer).toEqual({ '1': 'A', '2': 'B' });
    });

    it('strips non-allowlisted / secret fields from the returned object', () => {
      const rawWithExtras = {
        ...practiceFeedbackFixture(),
        version: 5,
        gradingKeys: { secret: 'key' },
        options: [{ id: 'A' }],
        examSnapshot: { sections: [] },
        aiPrompt: 'internal prompt do not leak',
      };

      const result = normalizePracticeFeedback(rawWithExtras, 42, 10, 'q1') as unknown as Record<string, unknown>;

      expect(result.version).toBeUndefined();
      expect(result.gradingKeys).toBeUndefined();
      expect(result.options).toBeUndefined();
      expect(result.examSnapshot).toBeUndefined();
      expect(result.aiPrompt).toBeUndefined();
      expect(Object.keys(result).sort()).toEqual([
        'attemptId',
        'correctAnswer',
        'explanation',
        'partId',
        'questionId',
        'score',
        'type',
        'userAnswer',
        'verdict',
      ].sort());
    });

    it('deep-copies userAnswer and correctAnswer to prevent mutation leaks', () => {
      const rawUserAns = ['A', 'B'];
      const rawCorrectAns = { '1': 'A', '2': 'B' };
      const raw = practiceFeedbackFixture({
        userAnswer: rawUserAns,
        correctAnswer: rawCorrectAns,
      });

      const result = normalizePracticeFeedback(raw, 42, 10, 'q1');

      expect(result.userAnswer).not.toBe(rawUserAns);
      expect(result.correctAnswer).not.toBe(rawCorrectAns);
      expect(result.userAnswer).toEqual(rawUserAns);
      expect(result.correctAnswer).toEqual(rawCorrectAns);
    });

    it('handles explicit null explanation', () => {
      const raw = practiceFeedbackFixture({ explanation: null });
      const result = normalizePracticeFeedback(raw, 42, 10, 'q1');
      expect(result.explanation).toBeNull();
    });

    it('handles missing/undefined explanation by defaulting to null', () => {
      const raw = { ...practiceFeedbackFixture() };
      delete (raw as any).explanation;
      const result = normalizePracticeFeedback(raw, 42, 10, 'q1');
      expect(result.explanation).toBeNull();
    });

    it('rejects non-string explanation (when not null/undefined)', () => {
      const raw = practiceFeedbackFixture({ explanation: 12345 as any });
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      { attemptId: 99, partId: 10, questionId: 'q1' },
      { attemptId: 42, partId: 99, questionId: 'q1' },
      { attemptId: 42, partId: 10, questionId: 'other_q' },
    ])('rejects tuple mismatch %j', (mismatched) => {
      const raw = practiceFeedbackFixture(mismatched);
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      'ESSAY',
      'UNKNOWN_TYPE',
      '',
      null,
      undefined,
      123,
    ])('rejects unsupported or ESSAY type %s', (invalidType) => {
      const raw = practiceFeedbackFixture({ type: invalidType as any });
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      'PARTIAL',
      'PENDING',
      'correct',
      '',
      null,
      undefined,
    ])('rejects invalid verdict %s', (invalidVerdict) => {
      const raw = practiceFeedbackFixture({ verdict: invalidVerdict as any });
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      -1,
      -0.5,
      NaN,
      Infinity,
      '1',
      null,
      undefined,
    ])('rejects invalid score %s', (invalidScore) => {
      const raw = practiceFeedbackFixture({ score: invalidScore as any });
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      { '1': { nested: 'forbidden' } },
      [['nested', 'array']],
      [{ nested: 'obj' }],
      null,
      undefined,
    ])('rejects invalid nested or null correctAnswer %j', (invalidCorrect) => {
      const raw = practiceFeedbackFixture({ correctAnswer: invalidCorrect as any });
      expect(() => normalizePracticeFeedback(raw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      null,
      undefined,
      'string',
      123,
      [],
    ])('rejects non-record raw response %j', (invalidRaw) => {
      expect(() => normalizePracticeFeedback(invalidRaw, 42, 10, 'q1')).toThrow(
        PracticeFeedbackContractError
      );
    });

    it.each([
      { sent: 'A', echoed: 'B', desc: 'string value mismatch' },
      { sent: 'A', echoed: null, desc: 'sent string but echoed null' },
      { sent: null, echoed: 'A', desc: 'sent null but echoed string' },
      { sent: ['A', 'B'], echoed: ['B', 'A'], desc: 'array ordering mismatch' },
      { sent: ['A', 'B'], echoed: ['A'], desc: 'array length mismatch' },
      { sent: { '1': 'A' }, echoed: { '1': 'B' }, desc: 'map value mismatch' },
      { sent: { '1': 'A' }, echoed: { '2': 'A' }, desc: 'map key mismatch' },
      { sent: { '1': 'A' }, echoed: { '1': 'A', '2': 'B' }, desc: 'map extra key' },
    ])('rejects when response userAnswer does not match expected sent answer ($desc)', ({ sent, echoed }) => {
      const raw = practiceFeedbackFixture({
        userAnswer: echoed as any,
      });

      expect(() =>
        normalizePracticeFeedback(raw, 42, 10, 'q1', sent as any)
      ).toThrow(PracticeFeedbackContractError);
    });

    it('accepts matching response when expectedUserAnswer is provided and equal', () => {
      const raw = practiceFeedbackFixture({
        userAnswer: 'A',
      });
      const result = normalizePracticeFeedback(raw, 42, 10, 'q1', 'A');
      expect(result.userAnswer).toBe('A');
    });

    it('accepts matching response when map keys have different insertion order', () => {
      const raw = practiceFeedbackFixture({
        userAnswer: { '2': 'B', '1': 'A' },
      });
      const result = normalizePracticeFeedback(raw, 42, 10, 'q1', { '1': 'A', '2': 'B' });
      expect(result.userAnswer).toEqual({ '2': 'B', '1': 'A' });
    });

    it('accepts matching response when answer contains exact Unicode and whitespace', () => {
      const unicodeAns = '  Café ☕ / Hà Nội  \n';
      const raw = practiceFeedbackFixture({
        userAnswer: unicodeAns,
      });
      const result = normalizePracticeFeedback(raw, 42, 10, 'q1', unicodeAns);
      expect(result.userAnswer).toBe(unicodeAns);
    });
  });

  describe('areAnswerValuesEqual', () => {
    it('compares nulls correctly', () => {
      expect(areAnswerValuesEqual(null, null)).toBe(true);
      expect(areAnswerValuesEqual(null, 'A')).toBe(false);
      expect(areAnswerValuesEqual('A', null)).toBe(false);
      expect(areAnswerValuesEqual(null, [])).toBe(false);
      expect(areAnswerValuesEqual(null, {})).toBe(false);
    });

    it('compares strings with exact Unicode and whitespace preservation', () => {
      expect(areAnswerValuesEqual('A', 'A')).toBe(true);
      expect(areAnswerValuesEqual('A', 'B')).toBe(false);
      expect(areAnswerValuesEqual('', '')).toBe(true);
      expect(areAnswerValuesEqual('   ', '   ')).toBe(true);
      expect(areAnswerValuesEqual('   ', ' ')).toBe(false);
      expect(areAnswerValuesEqual('A ', 'A')).toBe(false);
      expect(areAnswerValuesEqual('Tiếng Việt 🇻🇳', 'Tiếng Việt 🇻🇳')).toBe(true);
      expect(areAnswerValuesEqual('Tiếng Việt', 'Tiếng Anh')).toBe(false);
    });

    it('compares arrays with strict order and length', () => {
      expect(areAnswerValuesEqual([], [])).toBe(true);
      expect(areAnswerValuesEqual(['A', 'B'], ['A', 'B'])).toBe(true);
      expect(areAnswerValuesEqual(['A', 'B'], ['B', 'A'])).toBe(false);
      expect(areAnswerValuesEqual(['A'], ['A', 'B'])).toBe(false);
      expect(areAnswerValuesEqual(['A', 'B'], ['A'])).toBe(false);
    });

    it('compares maps regardless of key iteration order', () => {
      expect(areAnswerValuesEqual({}, {})).toBe(true);
      expect(areAnswerValuesEqual({ '1': 'A', '2': 'B' }, { '1': 'A', '2': 'B' })).toBe(true);
      expect(areAnswerValuesEqual({ '1': 'A', '2': 'B' }, { '2': 'B', '1': 'A' })).toBe(true);
      expect(areAnswerValuesEqual({ '1': 'A' }, { '1': 'B' })).toBe(false);
      expect(areAnswerValuesEqual({ '1': 'A' }, { '2': 'A' })).toBe(false);
      expect(areAnswerValuesEqual({ '1': 'A' }, { '1': 'A', '2': 'B' })).toBe(false);
      expect(areAnswerValuesEqual({ '1': 'A', '2': 'B' }, { '1': 'A' })).toBe(false);
    });

    it('returns false for cross-type mismatches', () => {
      expect(areAnswerValuesEqual('A', ['A'])).toBe(false);
      expect(areAnswerValuesEqual(['A'], 'A')).toBe(false);
      expect(areAnswerValuesEqual({ '0': 'A' }, ['A'])).toBe(false);
      expect(areAnswerValuesEqual(['A'], { '0': 'A' })).toBe(false);
      expect(areAnswerValuesEqual('A', { '0': 'A' })).toBe(false);
    });
  });
});

