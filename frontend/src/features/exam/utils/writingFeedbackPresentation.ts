import { examMessage as em, examUiLocale } from '../i18n/examMessages';
import type {
  WritingCriterionCode,
  WritingFeedbackTaskStatus,
} from '../types/api.types';

export const CANONICAL_CRITERIA_CODES: readonly WritingCriterionCode[] = [
  'TR',
  'CC',
  'LR',
  'GRA',
] as const;

export const CRITERIA_NAMES: Record<WritingCriterionCode, string> = {
  TR: 'Task Response',
  CC: 'Coherence & Cohesion',
  LR: 'Lexical Resource',
  GRA: 'Grammatical Range & Accuracy',
};

const bandScoreFormatter = () => new Intl.NumberFormat(examUiLocale(), {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatBandScore(
  score: number | null | undefined,
  fallback: string = em("Chưa có điểm")
): string {
  if (score === null || score === undefined || typeof score !== 'number' || Number.isNaN(score)) {
    return fallback;
  }
  return bandScoreFormatter().format(score);
}

const CANONICAL_ORDER: Record<string, number> = {
  TR: 0,
  CC: 1,
  LR: 2,
  GRA: 3,
};

export function getCriterionName(code: WritingCriterionCode): string {
  return em(CRITERIA_NAMES[code] ?? code);
}

export function sortCriteriaCanonical<T extends { code: WritingCriterionCode }>(
  criteria: readonly T[]
): T[] {
  return [...criteria].sort((a, b) => {
    const orderA = CANONICAL_ORDER[a.code] ?? 99;
    const orderB = CANONICAL_ORDER[b.code] ?? 99;
    return orderA - orderB;
  });
}

export function getTaskStatusLabel(status: WritingFeedbackTaskStatus): string {
  switch (status) {
    case 'DONE':
      return em("Đã có kết quả");
    case 'PENDING':
      return em("Đang chờ chấm");
    case 'QUEUED':
      return em("Đang trong hàng đợi");
    case 'FAILED':
      return em("Chấm điểm thất bại");
    case 'UNAVAILABLE':
      return em("Chưa có nhận xét");
    default:
      return em("Chưa rõ");
  }
}
