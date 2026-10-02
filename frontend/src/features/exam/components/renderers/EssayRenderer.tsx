import React from 'react';

import type { SharedMedia } from '../../types/exam.types';

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
  media?: SharedMedia | null;
  minWords?: number;
}

const EssayRenderer: React.FC<Props> = ({ value, onChange, questionText, media, minWords = 150 }) => {
  const text = value ?? '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isMet = wordCount >= minWords;
  const isEmpty = wordCount === 0;
  const status = isEmpty ? 'empty' : isMet ? 'success' : 'warning';

  return (
    <div className="flex flex-col h-full relative">
      <div className="lg:hidden mb-4 space-y-4">
        <p className="font-medium text-slate-800 whitespace-pre-wrap">{questionText}</p>
        {media?.url && (
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-2">
            <img src={media.url} alt="Writing Prompt Graph" className="max-w-full h-auto max-h-[40vh] object-contain" />
          </div>
        )}
      </div>

      <div className="relative flex-1 flex flex-col">
        <textarea
          rows={14}
          value={text}
          onChange={e => onChange(e.target.value)}
          className="w-full p-4 pb-14 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-y font-sans text-[15px] leading-relaxed text-slate-800 bg-white shadow-inner transition-colors duration-200"
          placeholder="Viết bài tự luận của bạn tại đây..."
        />

        {/* Fixed bottom bar inside editor */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none">
          <div
            data-testid="essay-word-count"
            data-status={status}
            className={`pointer-events-auto px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all duration-200 ${
              isEmpty
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : isMet
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200 animate-pulse'
            }`}
          >
            {isEmpty ? (
              <>
                <span>📝</span>
                <span>0 / {minWords} từ</span>
              </>
            ) : isMet ? (
              <>
                <span className="text-emerald-600">✓</span>
                <span>{wordCount} từ (Đạt yêu cầu)</span>
              </>
            ) : (
              <>
                <span className="text-rose-600">⚠️</span>
                <span>{wordCount} / {minWords} từ (Chưa đủ số từ tối thiểu)</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EssayRenderer;
