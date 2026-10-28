import { examErrorMessage as ee } from '../../i18n/examMessages';
import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import { useEffect, useRef, useState } from 'react';
import type { DictionaryLookupFailure, DictionaryResult } from '../../types/api.types';
import { ExplanationLanguageSelect } from './ExplanationLanguageSelect';
import { DictionaryFlashcardForm } from './DictionaryFlashcardForm';

interface Props {
  nativeOnly?: boolean;
  word: string;
  x: number;
  y: number;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  data: DictionaryResult | null;
  error: DictionaryLookupFailure | null;
  learningLanguage: string | null;
  defaultExplanationLanguage: string | null;
  supportedExplanationLanguages: readonly string[];
  onClose: () => void;
  onRetry: () => void;
  onLookup: (meaningLanguage: string | null) => void;
  ownerId: number | null;
}

export function PracticeDictionaryPopover({
  word, x, y, phase, data, error, learningLanguage, defaultExplanationLanguage,
  supportedExplanationLanguages, onClose, onRetry, onLookup, ownerId, nativeOnly = false,
}: Props) {
  useExamLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [meaningLanguage, setMeaningLanguage] = useState<string | null>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => setMeaningLanguage(null), [word]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  const width = Math.min(360, Math.max(260, window.innerWidth - 24));
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, x - width / 2));
  const top = Math.max(12, Math.min(window.innerHeight - 420, y));

  return (
    <section role="dialog" aria-label={em("Tra từ AI: {{v0}}", { v0: word })} aria-modal="false" data-dictionary-popover="true"
      className="fixed z-[70] w-[min(22.5rem,calc(100vw-1.5rem))] max-h-[min(30rem,calc(100vh-1.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      style={{ left, top, width }}>
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <h2 className="break-words font-semibold text-slate-900" lang={learningLanguage ?? undefined}>{word}</h2>
          <p className="text-xs text-amber-700">{em("Nghĩa do AI gợi ý")}</p>
          {learningLanguage && <p className="text-xs text-slate-500">{em("Ngôn ngữ đề:")}{' '}{learningLanguage}</p>}
        </div>
        <button ref={closeRef} type="button" aria-label={em("Đóng tra từ AI")} onClick={onClose}
          className="min-h-11 min-w-11 rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {phase === 'idle' && nativeOnly && <p role="status">{em('Đang tra nghĩa theo ngữ cảnh bài đọc…')}</p>}
      {phase === 'idle' && !nativeOnly && (
        <div className="space-y-3">
          <ExplanationLanguageSelect value={meaningLanguage} defaultLanguage={defaultExplanationLanguage}
            supportedLanguages={supportedExplanationLanguages} onChange={setMeaningLanguage} id="dictionary-meaning-language" />
          <button type="button" onClick={() => onLookup(meaningLanguage)} disabled={!learningLanguage || supportedExplanationLanguages.length === 0}
            className="min-h-11 rounded-lg bg-amber-600 px-3 font-medium text-white disabled:opacity-50">{em("Tra từ")}</button>
        </div>
      )}
      {phase === 'loading' && <p role="status" aria-live="polite">{em("Đang tra nghĩa theo ngữ cảnh bài đọc…")}</p>}
      {phase === 'error' && error && (
        <div role="alert" className="space-y-3 text-sm text-red-700">
          <p>{ee(error.message)}</p>
          {error.retryAfterSeconds !== null && <p>{em("Thử lại sau")}{' '}{error.retryAfterSeconds} {em("giây.")}</p>}
          {error.retryable && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg bg-amber-600 px-3 font-medium text-white">{em("Thử lại")}</button>}
        </div>
      )}
      {phase === 'ready' && data && (
        <div className="space-y-3 text-sm" lang={data.definition.meaningLanguage}>
          <p className="font-medium text-slate-900">{data.definition.meaning}</p>
          {(data.definition.phonetic || data.definition.partOfSpeech) && <p className="text-xs text-slate-600">{[data.definition.phonetic, data.definition.partOfSpeech].filter(Boolean).join(' · ')}</p>}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{em("Ví dụ")}</p>
            <p lang={data.definition.learningLanguage} className="mt-1">{data.definition.example}</p>
            <p lang={data.definition.meaningLanguage} className="text-slate-600">{data.definition.exampleTranslation}</p>
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-slate-600">{em("Ngữ cảnh trong bài")}</summary>
            <p lang={data.definition.learningLanguage} className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-700">{data.sourceContext}</p>
          </details>
          <DictionaryFlashcardForm ownerId={ownerId} result={data} />
        </div>
      )}
    </section>
  );
}
