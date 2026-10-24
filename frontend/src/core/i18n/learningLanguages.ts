export interface LearningLanguageOption {
  code: string;
  name: string;
  shortLabel: string;
}

export const SUPPORTED_LEARNING_LANGUAGES: readonly LearningLanguageOption[] = Object.freeze([
  { code: 'en', name: 'Tiếng Anh (English)', shortLabel: 'EN' },
  { code: 'vi', name: 'Tiếng Việt', shortLabel: 'VI' },
  { code: 'ko', name: 'Tiếng Hàn (한국어)', shortLabel: 'KO' },
  { code: 'zh', name: 'Tiếng Trung (中文)', shortLabel: 'ZH' },
  { code: 'ja', name: 'Tiếng Nhật (日本語)', shortLabel: 'JA' },
  { code: 'fr', name: 'Tiếng Pháp (Français)', shortLabel: 'FR' },
  { code: 'de', name: 'Tiếng Đức (Deutsch)', shortLabel: 'DE' },
  { code: 'es', name: 'Tiếng Tây Ban Nha (Español)', shortLabel: 'ES' },
]);

const SUPPORTED_BASES = new Set(SUPPORTED_LEARNING_LANGUAGES.map(({ code }) => code));
const ISO3_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  eng: 'en', vie: 'vi', kor: 'ko', zho: 'zh', jpn: 'ja', fra: 'fr', deu: 'de', spa: 'es',
});

/** Canonicalizes a valid language tag and aliases known to the backend catalog. */
export function canonicalizeBcp47LanguageTag(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const tag = raw.trim();
  if (tag.includes('_') || tag.includes('*') || tag.includes('--') || tag.startsWith('-') || tag.endsWith('-')) return null;
  if (/^(?:und|x)(?:-|$)/i.test(tag) || /-x-/i.test(tag)) return null;

  const match = tag.match(/^([A-Za-z]{2,8})(?:-([A-Za-z]{4}))?(?:-([A-Za-z]{2}|\d{3}))?$/);
  if (!match) return null;
  const rawBase = match[1].toLowerCase();
  const base = ISO3_ALIASES[rawBase] ?? rawBase;

  const parts = [base];
  if (match[2]) parts.push(`${match[2][0].toUpperCase()}${match[2].slice(1).toLowerCase()}`);
  if (match[3]) parts.push(/^\d/.test(match[3]) ? match[3] : match[3].toUpperCase());
  return parts.join('-');
}

/** Mirrors LearningLanguageCatalog.findNormalized with the configured eight-language default. */
export function canonicalizeLearningLanguage(raw: unknown): string | null {
  const canonical = canonicalizeBcp47LanguageTag(raw);
  return canonical && SUPPORTED_BASES.has(canonical.split('-')[0]) ? canonical : null;
}

export function isLearningLanguage(raw: unknown): raw is string {
  return canonicalizeLearningLanguage(raw) !== null;
}
