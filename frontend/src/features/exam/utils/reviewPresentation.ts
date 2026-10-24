import { examMessage as em } from '../i18n/examMessages';
import type { ReviewQuestionDto, ReviewVerdict, ResultSummary, ResultWritingStatus } from '../types/api.types';

/**
 * Format user answer safely as readable text.
 * Preserves Unicode and multiline formatting without truncation.
 */
export function formatUserAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) {
    return em("Chưa trả lời");
  }

  if (typeof answer === 'string') {
    return answer.trim().length === 0 ? em("Chưa trả lời") : answer;
  }

  if (typeof answer === 'boolean') {
    return answer ? em("Đúng") : em("Sai");
  }

  if (typeof answer === 'number') {
    return String(answer);
  }

  if (Array.isArray(answer)) {
    if (answer.length === 0) return em("Chưa trả lời");
    const nonNullItems = answer
      .filter((item) => item !== null && item !== undefined && String(item).trim().length > 0)
      .map(String);
    return nonNullItems.length === 0 ? em("Chưa trả lời") : nonNullItems.join(', ');
  }

  if (typeof answer === 'object') {
    const entries = Object.entries(answer as Record<string, unknown>);
    if (entries.length === 0) return em("Chưa trả lời");
    return entries.map(([key, val]) => `${key}: ${String(val)}`).join('\n');
  }

  return String(answer);
}

/**
 * Format correct answer safely as text.
 * Returns 'Chưa có dữ liệu' if unavailable; NEVER fabricates answers.
 */
export function formatCorrectAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) {
    return em("Chưa có dữ liệu");
  }

  if (typeof answer === 'string') {
    return answer.trim().length === 0 ? em("Chưa có dữ liệu") : answer;
  }

  if (typeof answer === 'boolean') {
    return answer ? em("Đúng") : em("Sai");
  }

  if (typeof answer === 'number') {
    return String(answer);
  }

  if (Array.isArray(answer)) {
    if (answer.length === 0) return em("Chưa có dữ liệu");
    const items = answer
      .filter((item) => item !== null && item !== undefined && String(item).trim().length > 0)
      .map(String);
    return items.length === 0 ? em("Chưa có dữ liệu") : items.join(', ');
  }

  if (typeof answer === 'object') {
    const entries = Object.entries(answer as Record<string, unknown>);
    if (entries.length === 0) return em("Chưa có dữ liệu");
    return entries.map(([key, val]) => `${key}: ${String(val)}`).join('\n');
  }

  return String(answer);
}

/**
 * Format score. Returns '--' when null/undefined (never transforms null to 0).
 */
export function formatScore(score: unknown): string {
  if (score === null || score === undefined) {
    return '--';
  }

  if (typeof score === 'number') {
    if (!Number.isFinite(score)) return '--';
    return String(score);
  }

  const parsed = Number(score);
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
    return String(parsed);
  }

  return String(score);
}

export interface VerdictBadgeInfo {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

/**
 * Returns accessible styling and labels for a question verdict.
 */
export function getVerdictBadgeInfo(verdict?: ReviewVerdict | string): VerdictBadgeInfo {
  switch (verdict) {
    case 'CORRECT':
      return {
        label: em("Chính xác"),
        bgClass: 'bg-green-100',
        textClass: 'text-green-800',
        borderClass: 'border-green-300',
        badgeClass: 'bg-green-100 text-[#16A34A] border-green-200',
      };
    case 'WRONG':
      return {
        label: em("Chưa chính xác"),
        bgClass: 'bg-red-100',
        textClass: 'text-red-800',
        borderClass: 'border-red-300',
        badgeClass: 'bg-red-100 text-[#DC2626] border-red-200',
      };
    case 'BLANK':
      return {
        label: em("Chưa làm"),
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-300',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    case 'PENDING':
      return {
        label: em("Đang chấm"),
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-300',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    default:
      return {
        label: em("Chưa xác định"),
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-300',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
}

export type ReviewFilter = 'ALL' | 'CORRECT' | 'WRONG' | 'BLANK' | 'PENDING';

/**
 * Filters review questions according to user selection.
 */
export function filterReviewQuestions(
  questions: ReviewQuestionDto[],
  filter: ReviewFilter
): ReviewQuestionDto[] {
  if (filter === 'ALL') return questions;
  return questions.filter((q) => q.verdict === filter);
}

export interface WritingStatusInfo {
  status: ResultWritingStatus;
  label: string;
  score: number | null;
  wordCount?: number | null;
}

/**
 * Maps Writing evaluation metadata by (partId, questionId) tuple from backend summary.
 * Null score is preserved as null (never converted to 0).
 */
export function getWritingEvaluationStatus(
  partId: number,
  questionId: string,
  resultSummary?: ResultSummary | null
): WritingStatusInfo {
  if (!resultSummary?.writing?.tasks || !Array.isArray(resultSummary.writing.tasks)) {
    return {
      status: 'UNAVAILABLE',
      label: em("Chưa có thông tin chấm bài"),
      score: null,
      wordCount: null,
    };
  }

  const task = resultSummary.writing.tasks.find(
    (t) => t.partId === partId && String(t.questionId) === String(questionId)
  );

  if (!task) {
    return {
      status: 'UNAVAILABLE',
      label: em("Chưa có thông tin chấm bài"),
      score: null,
      wordCount: null,
    };
  }

  switch (task.status) {
    case 'PENDING':
      return { status: 'PENDING', label: em("Đang chấm"), score: null, wordCount: task.wordCount };
    case 'QUEUED':
      return { status: 'QUEUED', label: em("Đang chờ chấm"), score: null, wordCount: task.wordCount };
    case 'FAILED':
      return { status: 'FAILED', label: em("Chấm điểm không thành công"), score: null, wordCount: task.wordCount };
    case 'UNAVAILABLE':
    default:
      return { status: 'UNAVAILABLE', label: em("Chưa có thông tin chấm bài"), score: null, wordCount: task.wordCount };
  }
}
