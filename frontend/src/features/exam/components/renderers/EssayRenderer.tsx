import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';

import type { SharedMedia } from '../../types/exam.types';
import { countWritingLength } from '../../utils/writingLength';

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
  media?: SharedMedia | null;
  minWords?: number;
  learningLanguage?: string | null;
  showPrompt?: boolean;
}

const EssayRenderer: React.FC<Props> = ({
  value,
  onChange,
  questionText,
  media,
  minWords = 150,
  learningLanguage = 'en',
  showPrompt = true,
}) => {
  useExamLocale();
  const text = value ?? '';
  const lengthMetric = countWritingLength(text, learningLanguage);
  const length = lengthMetric.value;
  const unitLabel = lengthMetric.unit === 'CHARACTERS' ? em("ký tự") : em("từ");
  const hasRequirement = minWords > 0;
  const isMet = hasRequirement && length >= minWords;
  const isEmpty = length === 0;
  const status = isEmpty ? 'empty' : !hasRequirement ? 'neutral' : isMet ? 'success' : 'warning';

  return (
    <div className="flex flex-col h-full relative">
      {showPrompt && (
        <div className="lg:hidden mb-4 space-y-4">
          <p className="font-medium text-slate-800 whitespace-pre-wrap">{questionText}</p>
          {media?.url && (
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex justify-center p-2">
              <img src={media.url} alt="Writing Prompt Graph" className="max-w-full h-auto max-h-[40vh] object-contain" />
            </div>
          )}
        </div>
      )}

      <div className="relative flex-1 flex flex-col min-h-[280px] lg:min-h-[320px]">
        <textarea
          rows={14}
          value={text}
          onChange={e => onChange(e.target.value)}
          aria-label={questionText ? em("Bài làm cho: {{v0}}", { v0: questionText.slice(0, 60) }) : em("Bài tự luận")}
          lang={learningLanguage || undefined}
          className="w-full flex-1 min-h-[240px] lg:min-h-[280px] p-4 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-y font-sans text-[15px] leading-relaxed text-slate-800 bg-white shadow-inner transition-colors duration-200"
          placeholder={em("Viết bài tự luận của bạn tại đây...")}
        />

        {/* Word count bar placed in layout flow below textarea */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400 font-medium">
            {hasRequirement ? em("Yêu cầu tối thiểu {{v0}} {{v1}}", { v0: minWords, v1: unitLabel }) : null}
          </div>
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
            {!hasRequirement && !isEmpty ? (
              <span>{length} {unitLabel}</span>
            ) : isEmpty ? (
              <>
                <span>📝</span>
                <span>{hasRequirement ? `0 / ${minWords} ${unitLabel}` : `0 ${unitLabel}`}</span>
              </>
            ) : isMet ? (
              <>
                <span className="text-emerald-600">✓</span>
                <span>{length} {unitLabel} {em("(Đạt yêu cầu)")}</span>
              </>
            ) : (
              <>
                <span className="text-rose-600">⚠️</span>
                <span>{length} / {minWords} {unitLabel} {em("(Chưa đủ số lượng tối thiểu)")}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EssayRenderer;
