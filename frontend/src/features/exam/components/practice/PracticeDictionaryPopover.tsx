import { useEffect, useRef } from 'react';
import type { DictionaryLookupFailure, DictionaryLookupResponse } from '../../types/api.types';
import { DictionaryFlashcardForm } from './DictionaryFlashcardForm';

interface Props {
  word: string;
  x: number;
  y: number;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  data: DictionaryLookupResponse | null;
  error: DictionaryLookupFailure | null;
  onClose: () => void;
  onRetry: () => void;
  ownerId: number | null;
}

export function PracticeDictionaryPopover({ word, x, y, phase, data, error, onClose, onRetry, ownerId }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  const width = Math.min(360, Math.max(260, window.innerWidth - 24));
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, x - width / 2));
  const top = Math.max(12, Math.min(window.innerHeight - 300, y));

  if (phase === 'idle') return null;

  return (
    <section
      role="dialog"
      aria-label={`Tra từ AI: ${word}`}
      aria-modal="false"
      data-dictionary-popover="true"
      className="fixed z-[70] w-[min(22.5rem,calc(100vw-1.5rem))] max-h-[min(24rem,calc(100vh-1.5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      style={{ left, top, width }}
    >
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <h2 className="break-words font-semibold text-slate-900">{word}</h2>
          <p className="text-xs text-amber-700">Nghĩa do AI gợi ý</p>
        </div>
        <button ref={closeRef} type="button" aria-label="Đóng tra từ AI" onClick={onClose}
          className="min-h-11 min-w-11 rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {phase === 'loading' && <p role="status" aria-live="polite">Đang tra nghĩa theo ngữ cảnh bài đọc…</p>}
      {phase === 'error' && error && (
        <div role="alert" className="space-y-3 text-sm text-red-700">
          <p>{error.message}</p>
          {error.retryAfterSeconds !== null && <p>Thử lại sau {error.retryAfterSeconds} giây.</p>}
          {error.retryable && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg bg-amber-600 px-3 font-medium text-white">Thử lại</button>}
        </div>
      )}
      {phase === 'ready' && data && (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-slate-900">{data.meaningVi}</p>
          {(data.phonetic || data.partOfSpeech) && <p className="text-xs text-slate-600">{[data.phonetic, data.partOfSpeech].filter(Boolean).join(' · ')}</p>}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ví dụ</p>
            <p lang="en" className="mt-1">{data.exampleEn}</p>
            <p lang="vi" className="text-slate-600">{data.exampleVi}</p>
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-slate-600">Ngữ cảnh trong bài</summary>
            <p className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-700">{data.sourceContext}</p>
          </details>
          <DictionaryFlashcardForm ownerId={ownerId} result={data} />
        </div>
      )}
    </section>
  );
}
