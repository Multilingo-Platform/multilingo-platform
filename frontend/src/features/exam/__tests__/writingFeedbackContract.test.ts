import { describe, it, expect } from 'vitest';
import {
  normalizeWritingFeedback,
  WritingFeedbackContractError,
} from '../api/writingFeedbackContract';
import {
  validAiDoneTextOnlyWire,
  validAiDoneVisualWire,
  validTooShortSystemWire,
  validPendingWire,
  validQueuedWire,
  validFailedWire,
  validUnavailableWire,
  validSurrogateAndCrlfWire,
} from './fixtures/writingFeedback';

describe('writingFeedbackContract - normalizeWritingFeedback', () => {
  const expectedAttemptId = 101;
  const expectedPartId = 202;

  describe('TC_21_01 & TC_21_02: Valid DTO projections', () => {
    it('normalizes valid AI DONE text-only response preserving order, diff and scores', () => {
      const result = normalizeWritingFeedback(validAiDoneTextOnlyWire, expectedAttemptId, expectedPartId);

      expect(result.attemptId).toBe(101);
      expect(result.partId).toBe(202);
      expect(result.attemptStatus).toBe('COMPLETED');
      expect(result.partStatus).toBe('DONE');
      expect(result.tasks).toHaveLength(1);

      const task = result.tasks[0];
      expect(task.questionId).toBe('task_1');
      expect(task.label).toBe('Task 1: Academic Essay');
      expect(task.status).toBe('DONE');
      expect(task.wordCount).toBe(15);
      expect(task.language).toBe('en');
      expect(task.source).toBe('AI');
      expect(task.scoreUnit).toBe('BAND_0_9');
      expect(task.overall).toBe(7.0);
      expect(task.maxScore).toBe(9.0);
      expect(task.criteria).toHaveLength(4);
      expect(task.criteria.map((c) => c.code)).toEqual(['TR', 'CC', 'LR', 'GRA']);
      expect(task.originalText).toBe(
        'Environmental protection requires international agreements and active cooperation worldwide. Future generations depend on these decisions.'
      );
      expect(task.correctedEssay).toBe(
        'Environmental protection requires international agreements and active global cooperation worldwide. Future generations depend on these decisions.'
      );
      expect(task.corrections).toHaveLength(1);
      expect(task.diff).toHaveLength(3);
      expect(task.reasonCode).toBeNull();
      expect(task.hasVisualContext).toBe(false);
      expect(task.visualObservations).toBeNull();
      expect(task.displayMessage).toBe('Chấm điểm hoàn tất.');
    });

    it('normalizes valid AI DONE visual response preserving visualObservations', () => {
      const result = normalizeWritingFeedback(validAiDoneVisualWire, expectedAttemptId, expectedPartId);

      expect(result.partStatus).toBe('DONE');
      const task = result.tasks[0];
      expect(task.hasVisualContext).toBe(true);
      expect(task.visualObservations).toBe(
        'Biểu đồ cột thể hiện mức tiêu thụ năng lượng sạch tăng gấp đôi trong thập kỷ vừa qua.'
      );
    });

    it('normalizes valid TOO_SHORT SYSTEM response with overall 0.0 and no visualObservations', () => {
      const result = normalizeWritingFeedback(validTooShortSystemWire, expectedAttemptId, expectedPartId);

      expect(result.partStatus).toBe('DONE');
      const task = result.tasks[0];
      expect(task.source).toBe('SYSTEM');
      expect(task.reasonCode).toBe('TOO_SHORT');
      expect(task.overall).toBe(0.0);
      expect(task.maxScore).toBe(9.0);
      expect(task.corrections).toEqual([]);
      expect(task.correctedEssay).toBe(task.originalText);
      expect(task.hasVisualContext).toBe(false);
      expect(task.visualObservations).toBeNull();
    });

    it('normalizes valid PENDING, QUEUED, FAILED, UNAVAILABLE responses', () => {
      const pending = normalizeWritingFeedback(validPendingWire, expectedAttemptId, expectedPartId);
      expect(pending.partStatus).toBe('PENDING');
      expect(pending.tasks[0].overall).toBeNull();
      expect(pending.tasks[0].maxScore).toBeNull();
      expect(pending.tasks[0].criteria).toEqual([]);
      expect(pending.tasks[0].correctedEssay).toBeNull();

      const queued = normalizeWritingFeedback(validQueuedWire, expectedAttemptId, expectedPartId);
      expect(queued.partStatus).toBe('QUEUED');
      expect(queued.tasks[0].reasonCode).toBe('PROVIDER_DISABLED');

      const failed = normalizeWritingFeedback(validFailedWire, expectedAttemptId, expectedPartId);
      expect(failed.partStatus).toBe('FAILED');
      expect(failed.tasks[0].reasonCode).toBe('BLOCKED');

      const unavailable = normalizeWritingFeedback(validUnavailableWire, expectedAttemptId, expectedPartId);
      expect(unavailable.partStatus).toBe('UNAVAILABLE');
      expect(unavailable.tasks[0].reasonCode).toBe('UNSUPPORTED_LANGUAGE');
    });

    it('TC_21_10: preserves UTF-16 surrogate pairs (astral emojis), combining marks, and CRLF', () => {
      const result = normalizeWritingFeedback(validSurrogateAndCrlfWire, expectedAttemptId, expectedPartId);

      const task = result.tasks[0];
      expect(task.originalText).toContain('🌍');
      expect(task.originalText).toContain('\r\n');
      expect(task.originalText).toContain('cafe\u0301');
      expect(task.correctedEssay).toContain('Dedicated scientists research tirelessly');
      expect(task.diff).toHaveLength(4);
    });

    it('omits unknown fields and normalizes omitted nullable fields to null without mutating input', () => {
      const wireWithUnknown = {
        ...validAiDoneTextOnlyWire,
        internalJobId: 9999,
        __secret_token: 'should_not_leak',
        tasks: [
          {
            ...validAiDoneTextOnlyWire.tasks[0],
            internalTokens: 1500,
            rawPrompt: 'Ignore instructions',
          },
        ],
      };

      const copyBefore = JSON.parse(JSON.stringify(wireWithUnknown));
      const result = normalizeWritingFeedback(wireWithUnknown, expectedAttemptId, expectedPartId);

      expect(wireWithUnknown).toEqual(copyBefore);
      expect(result).not.toHaveProperty('internalJobId');
      expect(result).not.toHaveProperty('__secret_token');
      expect(result.tasks[0]).not.toHaveProperty('internalTokens');
      expect(result.tasks[0]).not.toHaveProperty('rawPrompt');
      expect(result.tasks[0].reasonCode).toBeNull();
      expect(result.tasks[0].visualObservations).toBeNull();
    });
  });

  describe('TC_21_06: Identity & Structural validation', () => {
    it('rejects non-object inputs', () => {
      expect(() => normalizeWritingFeedback(null, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
      expect(() => normalizeWritingFeedback(undefined, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
      expect(() => normalizeWritingFeedback('string', expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
      expect(() => normalizeWritingFeedback([], expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
      expect(() => normalizeWritingFeedback(123, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects mismatched attemptId or partId', () => {
      expect(() => normalizeWritingFeedback(validAiDoneTextOnlyWire, 999, expectedPartId)).toThrow(WritingFeedbackContractError);
      expect(() => normalizeWritingFeedback(validAiDoneTextOnlyWire, expectedAttemptId, 999)).toThrow(WritingFeedbackContractError);
    });

    it('rejects invalid or non-positive Java integer IDs', () => {
      const badAttempt = { ...validAiDoneTextOnlyWire, attemptId: -1 };
      expect(() => normalizeWritingFeedback(badAttempt, -1, expectedPartId)).toThrow(WritingFeedbackContractError);

      const floatPart = { ...validAiDoneTextOnlyWire, partId: 2.5 };
      expect(() => normalizeWritingFeedback(floatPart, expectedAttemptId, 2.5)).toThrow(WritingFeedbackContractError);

      const overflowAttempt = { ...validAiDoneTextOnlyWire, attemptId: 2147483648 };
      expect(() => normalizeWritingFeedback(overflowAttempt, 2147483648, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects IN_PROGRESS attempt status or unknown statuses', () => {
      const inProgress = { ...validAiDoneTextOnlyWire, attemptStatus: 'IN_PROGRESS' };
      expect(() => normalizeWritingFeedback(inProgress, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);

      const unknownStatus = { ...validAiDoneTextOnlyWire, attemptStatus: 'SOME_UNKNOWN' };
      expect(() => normalizeWritingFeedback(unknownStatus, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects empty tasks array or non-array tasks', () => {
      const emptyTasks = { ...validAiDoneTextOnlyWire, tasks: [] };
      expect(() => normalizeWritingFeedback(emptyTasks, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);

      const nonArrayTasks = { ...validAiDoneTextOnlyWire, tasks: null };
      expect(() => normalizeWritingFeedback(nonArrayTasks, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects duplicate questionIds within the part', () => {
      const dup = {
        ...validAiDoneTextOnlyWire,
        tasks: [validAiDoneTextOnlyWire.tasks[0], validAiDoneTextOnlyWire.tasks[0]],
      };
      expect(() => normalizeWritingFeedback(dup, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects blank or empty questionId', () => {
      const blank = {
        ...validAiDoneTextOnlyWire,
        tasks: [{ ...validAiDoneTextOnlyWire.tasks[0], questionId: '   ' }],
      };
      expect(() => normalizeWritingFeedback(blank, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('rejects negative or non-integer wordCount', () => {
      const neg = {
        ...validAiDoneTextOnlyWire,
        tasks: [{ ...validAiDoneTextOnlyWire.tasks[0], wordCount: -5 }],
      };
      expect(() => normalizeWritingFeedback(neg, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);

      const floatWc = {
        ...validAiDoneTextOnlyWire,
        tasks: [{ ...validAiDoneTextOnlyWire.tasks[0], wordCount: 12.3 }],
      };
      expect(() => normalizeWritingFeedback(floatWc, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Part status aggregation rules', () => {
    it('requires partStatus to be DONE when all tasks are DONE', () => {
      const mismatched = { ...validAiDoneTextOnlyWire, partStatus: 'PENDING' };
      expect(() => normalizeWritingFeedback(mismatched, expectedAttemptId, expectedPartId)).toThrow(WritingFeedbackContractError);
    });

    it('requires partStatus to follow precedence: PENDING > QUEUED > FAILED > UNAVAILABLE', () => {
      const multiTasks = {
        attemptId: 101,
        partId: 202,
        attemptStatus: 'AI_GRADING',
        partStatus: 'PENDING',
        tasks: [
          validAiDoneTextOnlyWire.tasks[0],
          validPendingWire.tasks[0],
        ],
      };
      expect(normalizeWritingFeedback(multiTasks, 101, 202).partStatus).toBe('PENDING');

      const queuedWithFailed = {
        attemptId: 101,
        partId: 202,
        attemptStatus: 'AI_GRADING_QUEUED',
        partStatus: 'QUEUED',
        tasks: [
          validQueuedWire.tasks[0],
          validFailedWire.tasks[0],
        ],
      };
      expect(normalizeWritingFeedback(queuedWithFailed, 101, 202).partStatus).toBe('QUEUED');

      const failedWithUnavail = {
        attemptId: 101,
        partId: 202,
        attemptStatus: 'GRADING_FAILED',
        partStatus: 'FAILED',
        tasks: [
          validFailedWire.tasks[0],
          validUnavailableWire.tasks[0],
        ],
      };
      expect(normalizeWritingFeedback(failedWithUnavail, 101, 202).partStatus).toBe('FAILED');
    });
  });

  describe('Scores and criteria boundary validation', () => {
    it('accepts scores at 0.0, 0.5, 9.0 and rejects quarter steps and out of range', () => {
      const validZero = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      validZero.tasks[0].overall = 0.0;
      expect(normalizeWritingFeedback(validZero, 101, 202).tasks[0].overall).toBe(0.0);

      const quarterStep = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      quarterStep.tasks[0].overall = 7.25;
      expect(() => normalizeWritingFeedback(quarterStep, 101, 202)).toThrow(WritingFeedbackContractError);

      const negativeScore = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      negativeScore.tasks[0].overall = -0.5;
      expect(() => normalizeWritingFeedback(negativeScore, 101, 202)).toThrow(WritingFeedbackContractError);

      const overMax = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      overMax.tasks[0].overall = 9.5;
      expect(() => normalizeWritingFeedback(overMax, 101, 202)).toThrow(WritingFeedbackContractError);

      const nanScore = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      nanScore.tasks[0].overall = NaN;
      expect(() => normalizeWritingFeedback(nanScore, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('TC_21_07: rejects DONE task with missing or duplicate criterion codes', () => {
      const missingCriterion = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      missingCriterion.tasks[0].criteria = [
        { code: 'TR', score: 7.0, feedback: 'f' },
        { code: 'CC', score: 7.0, feedback: 'f' },
        { code: 'LR', score: 7.0, feedback: 'f' },
      ];
      expect(() => normalizeWritingFeedback(missingCriterion, 101, 202)).toThrow(WritingFeedbackContractError);

      const dupCriterion = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      dupCriterion.tasks[0].criteria = [
        { code: 'TR', score: 7.0, feedback: 'f' },
        { code: 'TR', score: 7.0, feedback: 'f' },
        { code: 'LR', score: 7.0, feedback: 'f' },
        { code: 'GRA', score: 7.0, feedback: 'f' },
      ];
      expect(() => normalizeWritingFeedback(dupCriterion, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('rejects AI DONE task with empty criterion feedback or empty overall feedback', () => {
      const emptyCritFeedback = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      emptyCritFeedback.tasks[0].criteria[0].feedback = '   ';
      expect(() => normalizeWritingFeedback(emptyCritFeedback, 101, 202)).toThrow(WritingFeedbackContractError);

      const emptyOverallFeedback = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      emptyOverallFeedback.tasks[0].overallFeedback = '';
      expect(() => normalizeWritingFeedback(emptyOverallFeedback, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('rejects SYSTEM source if reasonCode is not TOO_SHORT or overall is non-zero', () => {
      const systemWrongReason = JSON.parse(JSON.stringify(validTooShortSystemWire));
      systemWrongReason.tasks[0].reasonCode = 'SOMETHING_ELSE';
      expect(() => normalizeWritingFeedback(systemWrongReason, 101, 202)).toThrow(WritingFeedbackContractError);

      const systemNonZero = JSON.parse(JSON.stringify(validTooShortSystemWire));
      systemNonZero.tasks[0].overall = 5.0;
      expect(() => normalizeWritingFeedback(systemNonZero, 101, 202)).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Visual observations validation', () => {
    it('TC_21_02: requires non-empty visualObservations on AI DONE when hasVisualContext is true', () => {
      const missingObs = JSON.parse(JSON.stringify(validAiDoneVisualWire));
      delete missingObs.tasks[0].visualObservations;
      expect(() => normalizeWritingFeedback(missingObs, 101, 202)).toThrow(WritingFeedbackContractError);

      const emptyObs = JSON.parse(JSON.stringify(validAiDoneVisualWire));
      emptyObs.tasks[0].visualObservations = '   ';
      expect(() => normalizeWritingFeedback(emptyObs, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('rejects visualObservations exceeding 1000 code points', () => {
      const overLimitObs = JSON.parse(JSON.stringify(validAiDoneVisualWire));
      overLimitObs.tasks[0].visualObservations = 'A'.repeat(1001);
      expect(() => normalizeWritingFeedback(overLimitObs, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('rejects visualObservations when hasVisualContext is false', () => {
      const unexpectedObs = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      unexpectedObs.tasks[0].visualObservations = 'Should not be here';
      expect(() => normalizeWritingFeedback(unexpectedObs, 101, 202)).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Diff & Corrections reconstruction', () => {
    it('TC_21_08: rejects diff that does not reconstruct originalText', () => {
      const badDiff = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      badDiff.tasks[0].diff[0].text = 'TAMPERED TEXT ';
      expect(() => normalizeWritingFeedback(badDiff, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('TC_21_08: rejects diff that does not reconstruct correctedEssay', () => {
      const badDiff = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      badDiff.tasks[0].diff[1].text = 'DIFFERENT INSERTION ';
      expect(() => normalizeWritingFeedback(badDiff, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('TC_21_08: rejects corrections that do not reconstruct correctedEssay', () => {
      const badCorrection = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      badCorrection.tasks[0].corrections[0].replacement = 'wrong replacement';
      expect(() => normalizeWritingFeedback(badCorrection, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('rejects overlapping corrections or out-of-order offsets', () => {
      const overlap = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      overlap.tasks[0].corrections = [
        { start: 10, end: 20, replacement: 'a', explanation: 'e' },
        { start: 15, end: 25, replacement: 'b', explanation: 'e' },
      ];
      expect(() => normalizeWritingFeedback(overlap, 101, 202)).toThrow(WritingFeedbackContractError);

      const outOfBounds = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      outOfBounds.tasks[0].corrections = [
        { start: 0, end: 99999, replacement: 'a', explanation: 'e' },
      ];
      expect(() => normalizeWritingFeedback(outOfBounds, 101, 202)).toThrow(WritingFeedbackContractError);
    });

    it('TC_21_09: rejects correction splitting a UTF-16 surrogate pair', () => {
      const splitSurrogate = JSON.parse(JSON.stringify(validSurrogateAndCrlfWire));
      // In validSurrogateAndCrlfWire, emoji 🌍 is at index 38-39 (start: 38, end: 40).
      // If a correction starts at 39, it splits the surrogate pair!
      splitSurrogate.tasks[0].corrections = [
        { start: 39, end: 40, replacement: 'X', explanation: 'Splits surrogate' },
      ];
      expect(() => normalizeWritingFeedback(splitSurrogate, 101, 202)).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Non-DONE task state purity', () => {
    it('rejects non-DONE task having overall, criteria, correctedEssay, diff, or corrections', () => {
      const pendingWithScore = JSON.parse(JSON.stringify(validPendingWire));
      pendingWithScore.tasks[0].overall = 5.0;
      expect(() => normalizeWritingFeedback(pendingWithScore, 101, 202)).toThrow(WritingFeedbackContractError);

      const failedWithDiff = JSON.parse(JSON.stringify(validFailedWire));
      failedWithDiff.tasks[0].diff = [{ type: 'EQUAL', text: 'Some text' }];
      expect(() => normalizeWritingFeedback(failedWithDiff, 101, 202)).toThrow(WritingFeedbackContractError);

      const queuedWithCriteria = JSON.parse(JSON.stringify(validQueuedWire));
      queuedWithCriteria.tasks[0].criteria = [{ code: 'TR', score: 5.0, feedback: 'f' }];
      expect(() => normalizeWritingFeedback(queuedWithCriteria, 101, 202)).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Review R2: correction limits with reconstructable data', () => {
    function withCorrections(original: string, replacements: string[], explanation: string) {
      const corrected = replacements.join('') + original.slice(replacements.length);
      return {
        ...validAiDoneTextOnlyWire,
        tasks: [{
          ...validAiDoneTextOnlyWire.tasks[0],
          originalText: original,
          correctedEssay: corrected,
          wordCount: 12,
          corrections: replacements.map((replacement, index) => ({
            start: index, end: index + 1, replacement, explanation,
          })),
          diff: [
            { type: 'DELETE', text: original },
            { type: 'INSERT', text: corrected },
          ],
        }],
      };
    }

    const essaySuffix = ' one two three four five six seven eight nine ten eleven';

    it.each([100, 101])('enforces the correction count cap at %i', (count) => {
      const wire = withCorrections('a'.repeat(count) + essaySuffix, Array<string>(count).fill('b'), 'Explanation');
      const normalize = () => normalizeWritingFeedback(wire, expectedAttemptId, expectedPartId);
      if (count === 100) expect(normalize().tasks[0].corrections).toHaveLength(count);
      else expect(normalize).toThrow(WritingFeedbackContractError);
    });

    it.each([
      ['ASCII', 'a', 2000], ['ASCII', 'a', 2001],
      ['supplementary Unicode', '\u{1F30D}', 2000], ['supplementary Unicode', '\u{1F30D}', 2001],
    ] as const)('enforces replacement cap for %s (%s) at %i code points', (_label, character, count) => {
      const replacement = character.repeat(count);
      const wire = withCorrections('a' + essaySuffix, [replacement], 'Explanation');
      const normalize = () => normalizeWritingFeedback(wire, expectedAttemptId, expectedPartId);
      if (count === 2000) {
        const task = normalize().tasks[0];
        expect(task.corrections[0].replacement).toBe(replacement);
        expect(task.correctedEssay).toBe(replacement + essaySuffix);
      } else expect(normalize).toThrow(WritingFeedbackContractError);
    });

    it.each([
      ['ASCII', 'a', 500], ['ASCII', 'a', 501],
      ['supplementary Unicode', '\u{1F30D}', 500], ['supplementary Unicode', '\u{1F30D}', 501],
    ] as const)('enforces explanation cap for %s (%s) at %i code points', (_label, character, count) => {
      const explanation = character.repeat(count);
      const wire = withCorrections('a' + essaySuffix, ['b'], explanation);
      const normalize = () => normalizeWritingFeedback(wire, expectedAttemptId, expectedPartId);
      if (count === 500) expect(normalize().tasks[0].corrections[0].explanation).toBe(explanation);
      else expect(normalize).toThrow(WritingFeedbackContractError);
    });
  });

  describe('Review R3: AI DONE fixture fidelity', () => {
    it.each([
      ['text-only', validAiDoneTextOnlyWire],
      ['visual', validAiDoneVisualWire],
    ] as const)('%s has the backend word count and exceeds the local short threshold', (_label, wire) => {
      const task = wire.tasks[0];
      // Java Pattern.UNICODE_CHARACTER_CLASS \S+ uses Unicode White_Space.
      const actualWordCount = task.originalText.match(/[^\p{White_Space}]+/gu)?.length ?? 0;
      expect(actualWordCount).toBeGreaterThan(10);
      expect(task.wordCount).toBe(actualWordCount);
      expect(normalizeWritingFeedback(wire, expectedAttemptId, expectedPartId).tasks[0].originalText)
        .toBe(task.originalText);
    });
  });

  describe('Review R4: rejects non-string types for nullable fields', () => {
    it('rejects language when not string or null/omitted', () => {
      const invalidLanguage = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      invalidLanguage.tasks[0].language = 42;
      expect(() => normalizeWritingFeedback(invalidLanguage, expectedAttemptId, expectedPartId))
        .toThrow(WritingFeedbackContractError);
    });

    it('rejects reasonCode when not string or null/omitted', () => {
      const invalidReasonCode = JSON.parse(JSON.stringify(validAiDoneTextOnlyWire));
      invalidReasonCode.tasks[0].reasonCode = { code: 'INVALID' };
      expect(() => normalizeWritingFeedback(invalidReasonCode, expectedAttemptId, expectedPartId))
        .toThrow(WritingFeedbackContractError);
    });

    it('rejects non-DONE originalText when not string or null/omitted', () => {
      const invalidOriginalText = JSON.parse(JSON.stringify(validPendingWire));
      invalidOriginalText.tasks[0].originalText = 42;
      expect(() => normalizeWritingFeedback(invalidOriginalText, expectedAttemptId, expectedPartId))
        .toThrow(WritingFeedbackContractError);
    });
  });

});
