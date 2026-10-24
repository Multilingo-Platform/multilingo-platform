import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import viExam from '../../../locales/vi/exam.json';
import enExam from '../../../locales/en/exam.json';

/** Stable message identifiers remain independent from operation UUIDs and request state. */
const sourceKeys = new Map<string, string>(Object.entries(viExam.ui)
  .map(([key, source]) => [source.replace(/\s+/gu, ' ').trim(), key] as const));
const englishKeys = new Map<string, string>(Object.entries(enExam.ui)
  .map(([key, source]) => [source.replace(/\s+/gu, ' ').trim(), key] as const));

export function examMessage(source: string, values: Record<string, string | number> = {}): string {
  const key = sourceKeys.get(source.replace(/\s+/gu, ' ').trim());
  return key ? String(i18n.t(`ui.${key}`, { ns: 'exam', ...values })) : source;
}

/** Subscribe only the view; never include locale in a request or hydration identity. */
export function useExamLocale(): void {
  useTranslation('exam');
}

export function examErrorMessage(source: string | null | undefined): string {
  if (!source) return '';
  const normalized = source.replace(/\s+/gu, ' ').trim();
  if (sourceKeys.has(normalized)) return examMessage(normalized);
  const englishKey = englishKeys.get(normalized);
  if (englishKey) return String(i18n.t(`ui.${englishKey}`, { ns: 'exam' }));
  if (examUiLocale() === 'vi-VN') return source;
  return String(i18n.t('errors.unexpected', { ns: 'exam' }));
}

export function examUiLocale(): string {
  return i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'vi-VN';
}
