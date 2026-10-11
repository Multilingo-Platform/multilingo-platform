import type { ExamResultResponse, ObjectiveResultStats, ResultSummary, ResultWritingStatus, ReviewPartNavigation } from '../types/api.types';

export class ResultContractError extends Error {
  constructor() {
    super('Phản hồi kết quả không hợp lệ. Vui lòng thử lại.');
    this.name = 'ResultContractError';
  }
}

function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new ResultContractError();
}

function record(value: unknown): Record<string, unknown> {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

export function parseResultAttemptId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return positiveId(value) ? value : null;
}

function nonnegative(value: unknown): number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return value;
}

function count(value: unknown): number {
  const number = nonnegative(value);
  requireValue(Number.isSafeInteger(number));
  return number;
}

function text(value: unknown): string {
  requireValue(typeof value === 'string');
  return value;
}

function instant(value: unknown): string {
  const string = text(value);
  requireValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(string)
    && Number.isFinite(Date.parse(string)));
  return string;
}

function enumeration<T extends string>(value: unknown, values: readonly T[]): T {
  requireValue(typeof value === 'string' && values.includes(value as T));
  return value as T;
}

function stats(value: unknown): ObjectiveResultStats {
  const source = record(value);
  const result = {
    rawScore: nonnegative(source.rawScore), correct: count(source.correct), incorrect: count(source.incorrect),
    unanswered: count(source.unanswered), total: count(source.total), accuracy: nonnegative(source.accuracy),
  };
  requireValue(result.accuracy <= 100 && result.correct + result.incorrect + result.unanswered === result.total);
  return result;
}

function items<T>(value: unknown, normalize: (item: unknown) => T): T[] {
  requireValue(Array.isArray(value));
  return value.map(normalize);
}

function writingStatus(value: unknown): ResultWritingStatus {
  return enumeration(value, ['PENDING', 'QUEUED', 'FAILED', 'UNAVAILABLE']);
}

function normalizeSummary(value: unknown): ResultSummary {
  const summary = record(value);
  const objective = record(summary.objective);
  requireValue(objective.scoreUnit === 'RAW_OBJECTIVE');
  const seenParts = new Set<number>();
  const byPart = items(objective.byPart, item => {
    const part = record(item);
    requireValue(positiveId(part.partId) && !seenParts.has(part.partId));
    seenParts.add(part.partId);
    return { ...stats(part), partId: part.partId, label: text(part.label), skill: text(part.skill) };
  });
  const bySkill = items(objective.bySkill, item => {
    const skill = record(item);
    return { ...stats(skill), skill: text(skill.skill) };
  });
  let writing: ResultSummary['writing'] = null;
  if (summary.writing != null) {
    const source = record(summary.writing);
    const seenTasks = new Set<string>();
    writing = {
      status: writingStatus(source.status),
      tasks: items(source.tasks, item => {
        const task = record(item);
        requireValue(positiveId(task.partId));
        const questionId = text(task.questionId);
        const key = JSON.stringify([task.partId, questionId]);
        requireValue(!seenTasks.has(key) && task.score === null && task.maxScore === null);
        seenTasks.add(key);
        return {
          partId: task.partId, questionId, label: text(task.label), status: writingStatus(task.status),
          wordCount: count(task.wordCount), score: null, maxScore: null,
        };
      }),
    };
  }
  return { objective: { ...stats(objective), scoreUnit: 'RAW_OBJECTIVE', byPart, bySkill }, writing };
}

function normalizeReviewParts(value: unknown): ReviewPartNavigation[] {
  if (value === undefined) return [];
  const seenIds = new Set<number>();
  return items(value, item => {
    const part = record(item);
    requireValue(positiveId(part.id) && !seenIds.has(part.id));
    seenIds.add(part.id);
    const label = text(part.label);
    requireValue(label.trim().length > 0);
    return {
      id: part.id,
      label,
    };
  });
}

export function normalizeAttemptResult(data: unknown, expectedAttemptId: number): ExamResultResponse {
  const source = record(data);
  requireValue(positiveId(expectedAttemptId) && source.attemptId === expectedAttemptId);
  requireValue(typeof source.summaryAvailable === 'boolean');
  if (!source.summaryAvailable) requireValue(source.resultSummary == null);
  return {
    attemptId: expectedAttemptId,
    status: enumeration(source.status, ['SUBMITTED', 'AI_GRADING', 'AI_GRADING_QUEUED', 'GRADING_FAILED', 'COMPLETED', 'EXPIRED']),
    testScope: enumeration(source.testScope, ['FULL_EXAM', 'SINGLE_SKILL', 'SINGLE_PART']),
    testMode: enumeration(source.testMode, ['MOCK_TEST', 'PRACTICE']), startTime: instant(source.startTime),
    endTime: source.endTime == null ? null : instant(source.endTime),
    timeSpentSeconds: source.timeSpentSeconds == null ? null : count(source.timeSpentSeconds),
    overallScore: source.overallScore == null ? null : nonnegative(source.overallScore),
    summaryAvailable: source.summaryAvailable,
    resultSummary: source.summaryAvailable ? normalizeSummary(source.resultSummary) : null,
    reviewParts: normalizeReviewParts(source.reviewParts),
  };
}
