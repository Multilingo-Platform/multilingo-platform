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
  return enumeration(value, ['PENDING', 'QUEUED', 'DONE', 'FAILED', 'UNAVAILABLE']);
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
        requireValue(!seenTasks.has(key));
        seenTasks.add(key);
        let score: number | null = null;
        let maxScore: number | null = null;
        let rubricCode: 'WRITING_EN_V1' | 'WRITING_GENERIC_V1' | null = null;
        let feedbackLanguage: string | null = null;
        let scoreUnit: 'BAND_0_9' | 'PRACTICE_0_10' | null = null;
        if (task.score !== null || task.maxScore !== null) {
          requireValue(typeof task.score === 'number' && Number.isFinite(task.score) && task.score >= 0
            && typeof task.maxScore === 'number' && Number.isFinite(task.maxScore));
          requireValue((task.rubricCode === 'WRITING_EN_V1' && task.scoreUnit === 'BAND_0_9' && task.maxScore === 9)
            || (task.rubricCode === 'WRITING_GENERIC_V1' && task.scoreUnit === 'PRACTICE_0_10' && task.maxScore === 10));
          requireValue(task.score <= task.maxScore && Number.isInteger(task.score * 2));
          requireValue(typeof task.feedbackLanguage === 'string' && task.feedbackLanguage.trim().length > 0);
          score = task.score;
          maxScore = task.maxScore;
          rubricCode = task.rubricCode;
          feedbackLanguage = task.feedbackLanguage;
          scoreUnit = task.scoreUnit;
        } else {
          requireValue(task.score === null && task.maxScore === null && task.rubricCode == null
            && task.feedbackLanguage == null && task.scoreUnit == null);
        }
        let lengthMetric: NonNullable<ResultSummary['writing']>['tasks'][number]['lengthMetric'] = null;
        if (task.lengthMetric != null) {
          const metric = record(task.lengthMetric);
          requireValue(metric.policyVersion === 'TV3_LENGTH_V1' && (metric.unit === 'WORDS' || metric.unit === 'CHARACTERS'));
          lengthMetric = { value: count(metric.value), unit: metric.unit, policyVersion: 'TV3_LENGTH_V1' };
        }
        return {
          partId: task.partId, questionId, label: text(task.label), status: writingStatus(task.status),
          wordCount: count(task.wordCount), lengthMetric, score, maxScore, rubricCode, feedbackLanguage, scoreUnit,
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
