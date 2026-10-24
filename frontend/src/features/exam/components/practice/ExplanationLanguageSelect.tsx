import { examMessage as em, useExamLocale, examUiLocale } from '../../i18n/examMessages';
import { canonicalizeLearningLanguage, SUPPORTED_LEARNING_LANGUAGES } from '../../../../core/i18n/learningLanguages';

export interface ExplanationLanguageSelectProps {
  value: string | null;
  defaultLanguage: string | null;
  supportedLanguages: readonly string[];
  disabled?: boolean;
  id?: string;
  onChange(language: string | null): void;
}

function labelFor(tag: string): string {
  if (examUiLocale() === 'en-US') return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag;
  const base = tag.split('-')[0];
  const language = SUPPORTED_LEARNING_LANGUAGES.find((option) => option.code === base);
  return language ? `${language.name}${tag === base ? '' : ` — ${tag}`}` : tag;
}

export function ExplanationLanguageSelect({
  value,
  defaultLanguage,
  supportedLanguages = [],
  disabled = false,
  id = 'explanation-language',
  onChange,
}: ExplanationLanguageSelectProps) {
  useExamLocale();
  const validOptions = [...new Set(supportedLanguages
    .map(canonicalizeLearningLanguage)
    .filter((tag): tag is string => tag !== null))];
  const canonicalValue = value ? canonicalizeLearningLanguage(value) : null;
  const canonicalDefault = defaultLanguage ? canonicalizeLearningLanguage(defaultLanguage) : null;

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">{em("Ngôn ngữ giải thích")}</label>
      <select
        id={id}
        value={canonicalValue ?? ''}
        disabled={disabled || validOptions.length === 0}
        onChange={(event) => onChange(event.target.value || null)}
        className="min-h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <option value="">{em("Mặc định (")}{canonicalDefault ? labelFor(canonicalDefault) : em("ngôn ngữ đề")})</option>
        {validOptions.map((tag) => <option key={tag} value={tag}>{labelFor(tag)}</option>)}
      </select>
    </div>
  );
}
