import { describe, expect, it } from 'vitest';
import { normalizeAttemptResult, parseResultAttemptId, ResultContractError } from '../api/resultContract';
import {
  attemptResultFixture,
  multiPartAttemptResultFixture,
  summaryUnavailableAttemptResultFixture,
  writingOnlyAttemptResultFixture,
} from './fixtures/attemptResult';

describe('result route ID', () => {
  it.each(['0', '-1', '1.5', '1e2', ' 42', '42 ', '042', '12abc', '2147483648', '', '１２', undefined])('rejects %s', raw => {
    expect(parseResultAttemptId(raw)).toBeNull();
  });
  it.each([['1', 1], ['42', 42], ['2147483647', 2147483647]])('accepts %s', (raw, expected) => {
    expect(parseResultAttemptId(raw as string)).toBe(expected);
  });
});

describe('TV3-11 result projection', () => {
  it('keeps raw score greater than count and ignores legacy fields without mutating response', () => {
    const wire = attemptResultFixture(); const original = structuredClone(wire);
    const result = normalizeAttemptResult(wire, 42);
    expect(result).toMatchObject({ attemptId: 42, resultSummary: { objective: { rawScore: 5.5, total: 3, accuracy: 33.33 } } });
    expect(result).not.toHaveProperty('resultSummary.partResults');
    expect(wire).toEqual(original);
  });
  it('normalizes omitted nullable fields, never falling back to legacy score', () => {
    const wire = { ...attemptResultFixture(), summaryAvailable: false, resultSummary: undefined,
      endTime: undefined, timeSpentSeconds: undefined, overallScore: undefined };
    expect(normalizeAttemptResult(wire, 42)).toMatchObject({ resultSummary: null, endTime: null, timeSpentSeconds: null, overallScore: null });
  });
  it('preserves real zero and allows Writing-only empty objective groups', () => {
    const wire = attemptResultFixture();
    wire.timeSpentSeconds = 0; wire.overallScore = 0;
    wire.resultSummary.objective = { rawScore: 0, correct: 0, incorrect: 0, unanswered: 0, total: 0, accuracy: 0,
      scoreUnit: 'RAW_OBJECTIVE', bySkill: [], byPart: [] };
    expect(normalizeAttemptResult(wire, 42)).toMatchObject({ timeSpentSeconds: 0, overallScore: 0, resultSummary: { objective: { total: 0 } } });
  });
  it('identifies Writing tasks by part and question, preserving strings', () => {
    const wire = attemptResultFixture();
    wire.resultSummary.writing.tasks.push({ ...wire.resultSummary.writing.tasks[0], partId: 21, label: '  <b>Tiếng Việt</b>  ' });
    expect(normalizeAttemptResult(wire, 42)).toHaveProperty('resultSummary.writing.tasks.1.label', '  <b>Tiếng Việt</b>  ');
  });
  it.each([
    { attemptId: 43 }, { status: 'IN_PROGRESS' }, { status: 'UNKNOWN' }, { testScope: 'UNKNOWN' },
    { testMode: 'UNKNOWN' }, { startTime: '2026-10-11T00:00:00' }, { summaryAvailable: 'true' },
    { summaryAvailable: false }, { resultSummary: null }, { timeSpentSeconds: -1 }, { timeSpentSeconds: 1.5 },
    { overallScore: Infinity }, { overallScore: -1 },
  ])('rejects invalid top-level contract %j', override => {
    expect(() => normalizeAttemptResult({ ...attemptResultFixture(), ...override }, 42)).toThrow(ResultContractError);
  });
  it.each([
    { rawScore: NaN }, { rawScore: -1 }, { correct: 2 }, { total: 3.5 }, { accuracy: 101 },
    { unanswered: -1 }, { scoreUnit: 'IELTS_BAND' }, { bySkill: null }, { byPart: null },
  ])('rejects invalid objective %j', override => {
    const wire = attemptResultFixture();
    Object.assign(wire.resultSummary.objective, override);
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });
  it('rejects duplicate parts, duplicate Writing identities and object labels', () => {
    const duplicate = attemptResultFixture();
    duplicate.resultSummary.objective.byPart.push({ ...duplicate.resultSummary.objective.byPart[0] });
    expect(() => normalizeAttemptResult(duplicate, 42)).toThrow(ResultContractError);
    const tasks = attemptResultFixture();
    tasks.resultSummary.writing.tasks.push({ ...tasks.resultSummary.writing.tasks[0] });
    expect(() => normalizeAttemptResult(tasks, 42)).toThrow(ResultContractError);
    const label = attemptResultFixture(); Object.assign(label.resultSummary.objective.byPart[0], { label: {} });
    expect(() => normalizeAttemptResult(label, 42)).toThrow(ResultContractError);
  });
  it.each([{ status: 'COMPLETED' }, { wordCount: -1 }, { score: 0 }, { maxScore: 9 }, { questionId: {} }])('rejects invalid Writing task %j', override => {
    const wire = attemptResultFixture(); Object.assign(wire.resultSummary.writing.tasks[0], override);
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });
  it('accepts nullable absent Writing', () => {
    const wire = attemptResultFixture(); Object.assign(wire.resultSummary, { writing: undefined });
    expect(normalizeAttemptResult(wire, 42)).toHaveProperty('resultSummary.writing', null);
  });

  it.each(['PENDING', 'DONE'])('preserves independent CJK character and legacy word counts for %s Writing', status => {
    const wire = attemptResultFixture();
    wire.resultSummary.writing.status = status;
    Object.assign(wire.resultSummary.writing.tasks[0], {
      status, wordCount: 1,
      lengthMetric: { value: 6, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' },
      ...(status === 'DONE' ? {
        score: 10, maxScore: 10, rubricCode: 'WRITING_GENERIC_V1',
        scoreUnit: 'PRACTICE_0_10', feedbackLanguage: 'ja',
      } : {}),
    });
    const original = structuredClone(wire);

    expect(normalizeAttemptResult(wire, 42).resultSummary?.writing?.tasks[0]).toMatchObject({
      wordCount: 1, lengthMetric: { value: 6, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' },
    });
    expect(wire).toEqual(original);
  });

  it.each([
    { wordCount: -1 }, { wordCount: 1.5 },
    { lengthMetric: { value: -1, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' } },
    { lengthMetric: { value: 1.5, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' } },
    { lengthMetric: { value: 6, unit: 'BYTES', policyVersion: 'TV3_LENGTH_V1' } },
    { lengthMetric: { value: 6, unit: 'CHARACTERS', policyVersion: 'UNKNOWN' } },
  ])('still rejects invalid independent Writing counts %j', override => {
    const wire = attemptResultFixture();
    Object.assign(wire.resultSummary.writing.tasks[0], {
      wordCount: 1, lengthMetric: { value: 6, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' }, ...override,
    });
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });
});

describe('TV3-14 reviewParts contract', () => {
  it('normalizes absent reviewParts to empty array without deriving from objective parts', () => {
    const wire = attemptResultFixture();
    const result = normalizeAttemptResult(wire, 42);
    expect(result.reviewParts).toEqual([]);
    expect(result.resultSummary?.objective.byPart.length).toBeGreaterThan(0);
  });

  it('preserves backend order, positive IDs, labels, and optional metadata from wire', () => {
    const wire = multiPartAttemptResultFixture();
    const original = structuredClone(wire);
    const result = normalizeAttemptResult(wire, 42);

    expect(result.reviewParts).toEqual([
      { id: 10, label: 'Phần đọc tiếng Việt' },
      { id: 15, label: 'Phần nghe tiếng Việt' },
      { id: 20, label: 'Bài viết tiếng Việt' },
    ]);
    expect(wire).toEqual(original);
  });

  it('keeps non-standard backend order without sorting by id', () => {
    const wire = {
      ...attemptResultFixture(),
      reviewParts: [
        { id: 99, label: 'Phần 99' },
        { id: 2, label: 'Phần 2' },
        { id: 50, label: 'Phần 50' },
      ],
    };
    const result = normalizeAttemptResult(wire, 42);
    expect(result.reviewParts.map(p => p.id)).toEqual([99, 2, 50]);
  });

  it('normalizes Writing-only exam with reviewParts', () => {
    const wire = writingOnlyAttemptResultFixture();
    const result = normalizeAttemptResult(wire, 42);
    expect(result.reviewParts).toEqual([{ id: 20, label: 'Phần viết' }]);
    expect(result.resultSummary?.objective.total).toBe(0);
  });

  it('normalizes reviewParts when summaryAvailable is false', () => {
    const wire = summaryUnavailableAttemptResultFixture(42, [{ id: 10, label: 'Phần 10' }]);
    const result = normalizeAttemptResult(wire, 42);
    expect(result.summaryAvailable).toBe(false);
    expect(result.resultSummary).toBeNull();
    expect(result.reviewParts).toEqual([{ id: 10, label: 'Phần 10' }]);
  });

  it('normalizes absent reviewParts to empty array when summaryAvailable is false', () => {
    const wire = summaryUnavailableAttemptResultFixture(42);
    const result = normalizeAttemptResult(wire, 42);
    expect(result.summaryAvailable).toBe(false);
    expect(result.resultSummary).toBeNull();
    expect(result.reviewParts).toEqual([]);
  });

  it('strips extraneous or legacy fields from reviewParts items', () => {
    const wire = {
      ...attemptResultFixture(),
      reviewParts: [
        {
          id: 10,
          label: 'Phần 1',
          correctAnswer: 'A',
          explanation: 'Secret explanation',
          questions: [{ id: 1 }],
          score: 10,
        },
      ],
    };
    const result = normalizeAttemptResult(wire, 42);
    expect(result.reviewParts).toEqual([{ id: 10, label: 'Phần 1' }]);
    expect(result.reviewParts[0]).not.toHaveProperty('correctAnswer');
    expect(result.reviewParts[0]).not.toHaveProperty('explanation');
    expect(result.reviewParts[0]).not.toHaveProperty('questions');
  });

  it.each([
    null,
    {},
    'invalid',
    123,
    false,
    true,
  ])('rejects non-array present reviewParts %j', reviewParts => {
    const wire = { ...attemptResultFixture(), reviewParts };
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });

  it.each([
    [null],
    ['invalid'],
    [123],
    [true],
    [[]],
  ])('rejects non-object item in reviewParts: %j', item => {
    const wire = { ...attemptResultFixture(), reviewParts: [item] };
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });

  it.each([
    { id: 0, label: 'Part 1' },
    { id: -1, label: 'Part 1' },
    { id: 1.5, label: 'Part 1' },
    { id: '10', label: 'Part 1' },
    { id: 2147483648, label: 'Part 1' },
    { id: NaN, label: 'Part 1' },
    { id: Infinity, label: 'Part 1' },
    { label: 'Part 1' },
  ])('rejects invalid part id %j', part => {
    const wire = { ...attemptResultFixture(), reviewParts: [part] };
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });

  it.each([
    { id: 10, label: '' },
    { id: 10, label: '   ' },
    { id: 10, label: 123 },
    { id: 10, label: null },
    { id: 10, label: {} },
    { id: 10, label: [] },
    { id: 10 },
  ])('rejects invalid part label %j', part => {
    const wire = { ...attemptResultFixture(), reviewParts: [part] };
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });

  it('rejects duplicate part IDs in reviewParts', () => {
    const wire = {
      ...attemptResultFixture(),
      reviewParts: [
        { id: 10, label: 'Part 1' },
        { id: 10, label: 'Part 1 Duplicate' },
      ],
    };
    expect(() => normalizeAttemptResult(wire, 42)).toThrow(ResultContractError);
  });
});
