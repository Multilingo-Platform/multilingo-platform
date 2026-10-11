import { describe, expect, it } from 'vitest';
import { normalizeAttemptResult, parseResultAttemptId, ResultContractError } from '../api/resultContract';
import { attemptResultFixture } from './fixtures/attemptResult';

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
});
