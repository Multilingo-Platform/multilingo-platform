import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse, LearnerExamStructure } from '../types/api.types';

/**
 * GET /api/v1/exams/:id/structure
 * Fetches published exam structure for learners.
 */
export async function getExamStructure(examId: number): Promise<LearnerExamStructure> {
  try {
    const res = await axiosClient.get<unknown, ApiResponse<LearnerExamStructure>>(
      `/v1/exams/${examId}/structure`
    );
    if (!res.success) {
      throw new Error(res.message || 'Failed to fetch exam structure');
    }
    if (!res.data) {
      throw new Error('Failed to fetch exam structure');
    }
    const hasCamel = res.data.examLanguage !== undefined;
    const wire = (res.data as LearnerExamStructure & { exam_language?: string | null }).exam_language;
    const hasSnake = wire !== undefined;

    let resolvedLanguage: string | null = null;
    if (hasCamel && hasSnake) {
      if (typeof res.data.examLanguage === 'string' && typeof wire === 'string') {
        const normCamel = normalizeLanguage(res.data.examLanguage);
        const normSnake = normalizeLanguage(wire);
        if (normCamel !== null && normCamel === normSnake) {
          resolvedLanguage = normCamel;
        } else {
          resolvedLanguage = null;
        }
      } else {
        resolvedLanguage = null;
      }
    } else if (hasCamel) {
      resolvedLanguage = normalizeLanguage(res.data.examLanguage);
    } else if (hasSnake) {
      resolvedLanguage = normalizeLanguage(wire);
    }

    return {
      ...res.data,
      ...((hasCamel || hasSnake)
        ? { examLanguage: resolvedLanguage }
        : {}),
    };
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch exam structure');
  }
}

const LANGUAGE_ALIASES: Record<string, string> = {
  eng: 'en', vie: 'vi', kor: 'ko', zho: 'zh', jpn: 'ja', fra: 'fr', deu: 'de', spa: 'es',
};
const SUPPORTED_LANGUAGES = new Set(['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es']);

function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('_') || trimmed.includes('*') || trimmed.includes('--') || trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (lower === 'und' || lower.startsWith('und-') || lower.startsWith('x-') || lower.includes('-x-')) {
    return null;
  }
  const subtags = trimmed.split('-');
  if (subtags.length > 3) return null;
  const rawBase = subtags[0];
  const base = LANGUAGE_ALIASES[rawBase.toLowerCase()] ?? rawBase.toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(base)) return null;

  let script = '';
  let region = '';

  if (subtags.length === 2) {
    const sub = subtags[1];
    if (/^[A-Za-z]{4}$/.test(sub)) {
      script = sub[0].toUpperCase() + sub.slice(1).toLowerCase();
    } else if (/^[A-Za-z]{2}$/.test(sub) || /^\d{3}$/.test(sub)) {
      region = /^\d/.test(sub) ? sub : sub.toUpperCase();
    } else {
      return null;
    }
  } else if (subtags.length === 3) {
    const sub1 = subtags[1];
    const sub2 = subtags[2];
    if (!/^[A-Za-z]{4}$/.test(sub1)) return null;
    script = sub1[0].toUpperCase() + sub1.slice(1).toLowerCase();
    if (!/^[A-Za-z]{2}$/.test(sub2) && !/^\d{3}$/.test(sub2)) return null;
    region = /^\d/.test(sub2) ? sub2 : sub2.toUpperCase();
  }

  return [base, script, region].filter(Boolean).join('-');
}
