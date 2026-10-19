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

const bandScoreFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatBandScore(
  score: number | null | undefined,
  fallback: string = 'Chưa có điểm'
): string {
  if (score === null || score === undefined || typeof score !== 'number' || Number.isNaN(score)) {
    return fallback;
  }
  return bandScoreFormatter.format(score);
}

const CANONICAL_ORDER: Record<string, number> = {
  TR: 0,
  CC: 1,
  LR: 2,
  GRA: 3,
};

export function getCriterionName(code: WritingCriterionCode): string {
  return CRITERIA_NAMES[code] ?? code;
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
      return 'Đã có kết quả';
    case 'PENDING':
      return 'Đang chờ chấm';
    case 'QUEUED':
      return 'Đang trong hàng đợi';
    case 'FAILED':
      return 'Chấm điểm thất bại';
    case 'UNAVAILABLE':
      return 'Chưa có nhận xét';
    default:
      return 'Chưa rõ';
  }
}
