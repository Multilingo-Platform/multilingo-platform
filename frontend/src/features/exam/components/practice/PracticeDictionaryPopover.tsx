import { examErrorMessage as ee } from '../../i18n/examMessages';
import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DictionaryLookupFailure, DictionaryResult } from '../../types/api.types';
import { ExplanationLanguageSelect } from './ExplanationLanguageSelect';
import { DictionaryFlashcardForm } from './DictionaryFlashcardForm';
import { fitPopoverToViewport, type PopoverViewport } from '../../utils/popoverGeometry';

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
  const popoverRef = useRef<HTMLElement>(null);
  const [meaningLanguage, setMeaningLanguage] = useState<string | null>(null);
  const [viewport, setViewport] = useState<PopoverViewport>(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [contentHeight, setContentHeight] = useState(() => Math.min(480, window.innerHeight - 24));
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => setMeaningLanguage(null), [word]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  useLayoutEffect(() => {
    const syncGeometry = () => {
      const visualViewport = window.visualViewport;
      setViewport({
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
        offsetTop: visualViewport?.offsetTop ?? 0,
        offsetLeft: visualViewport?.offsetLeft ?? 0,
      });
      // Measure intrinsic content, not the previous viewport-constrained height.
      const popover = popoverRef.current;
      const previousMaxHeight = popover?.style.maxHeight;
      if (popover) popover.style.maxHeight = 'none';
      const measuredHeight = popover?.getBoundingClientRect().height;
      if (popover) popover.style.maxHeight = previousMaxHeight ?? '';
      if (measuredHeight && measuredHeight > 0) setContentHeight(measuredHeight);
    };
    syncGeometry();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncGeometry);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    // Expanded context and new-deck fields can grow while the outer box stays capped.
    const contentObserver = new MutationObserver(syncGeometry);
    if (popoverRef.current) contentObserver.observe(popoverRef.current, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['open'],
    });
    window.addEventListener('resize', syncGeometry);
    window.visualViewport?.addEventListener('resize', syncGeometry);
    window.visualViewport?.addEventListener('scroll', syncGeometry);
    return () => {
      observer?.disconnect();
      contentObserver.disconnect();
      window.removeEventListener('resize', syncGeometry);
      window.visualViewport?.removeEventListener('resize', syncGeometry);
      window.visualViewport?.removeEventListener('scroll', syncGeometry);
    };
  }, [x, y, phase, data, error]);

  const geometry = fitPopoverToViewport(x, y, 360, contentHeight, viewport);

  return (
    <section ref={popoverRef} role="dialog" aria-label={em("Tra từ AI: {{v0}}", { v0: word })} aria-modal="false" data-dictionary-popover="true"
      className="fixed z-[70] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      style={{ left: geometry.left, top: geometry.top, width: geometry.width, maxHeight: geometry.height }}>
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
      {phase === 'idle' && nativeOnly && <div className="min-h-0 flex-1 overflow-y-auto"><p role="status">{em('Đang tra nghĩa theo ngữ cảnh bài đọc…')}</p></div>}
      {phase === 'idle' && !nativeOnly && (
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3">
          <ExplanationLanguageSelect value={meaningLanguage} defaultLanguage={defaultExplanationLanguage}
            supportedLanguages={supportedExplanationLanguages} onChange={setMeaningLanguage} id="dictionary-meaning-language" />
          <button type="button" onClick={() => onLookup(meaningLanguage)} disabled={!learningLanguage || supportedExplanationLanguages.length === 0}
            className="min-h-11 rounded-lg bg-amber-600 px-3 font-medium text-white disabled:opacity-50">{em("Tra từ")}</button>
        </div>
        </div>
      )}
      {phase === 'loading' && <div className="min-h-0 flex-1 overflow-y-auto"><p role="status" aria-live="polite">{em("Đang tra nghĩa theo ngữ cảnh bài đọc…")}</p></div>}
      {phase === 'error' && error && (
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div role="alert" className={`space-y-2 rounded-lg p-3 text-sm ${error.kind === 'quota' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'text-red-700'}`}>
          <div className="flex items-start gap-2">
            {error.kind === 'quota' && (
              <span className="text-base leading-none select-none" aria-hidden="true">⚠️</span>
            )}
            <div className="space-y-1">
              <p className={error.kind === 'quota' ? 'font-semibold' : ''}>{ee(error.message)}</p>
              {error.kind === 'quota' && (
                <p className="text-xs text-amber-800">
                  {em("Hạn mức tra từ AI trong ngày đã hết. Bạn có thể tiếp tục làm bài và tra từ lại vào ngày mai.")}
                </p>
              )}
              {error.kind === 'quota' && (
                <div className="pt-1.5">
                  <a
                    href="/student/premium"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors"
                  >
                    <span>{em("Nâng cấp Premium (500 lượt/ngày)")}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
          {error.retryAfterSeconds !== null && <p>{em("Thử lại sau")}{' '}{error.retryAfterSeconds} {em("giây.")}</p>}
          {error.retryable && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg bg-amber-600 px-3 font-medium text-white">{em("Thử lại")}</button>}
        </div>
        </div>
      )}
      {phase === 'ready' && data && (
        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 text-sm" lang={data.definition.meaningLanguage}>
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
        </div>
      )}
      {phase === 'ready' && data && <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-slate-100 pt-3"><DictionaryFlashcardForm ownerId={ownerId} result={data} /></div>}
    </section>
  );
}
