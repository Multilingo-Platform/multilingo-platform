import React from 'react';
import { RotateCcw, LayoutGrid } from 'lucide-react';

export interface PracticeRetryToolbarProps {
  wrongCount: number;
  retryActive: boolean;
  onStartRetry: () => void;
  onStopRetry: () => void;
  disabled?: boolean;
  className?: string;
}

export const PracticeRetryToolbar: React.FC<PracticeRetryToolbarProps> = ({
  wrongCount,
  retryActive,
  onStartRetry,
  onStopRetry,
  disabled = false,
  className = '',
}) => {
  const isRetryDisabled = disabled || retryActive || wrongCount === 0;

  return (
    <div
      role="toolbar"
      aria-label="Thanh công cụ luyện lại câu sai"
      className={`bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs min-w-0 ${className}`}
    >
      {/* Left: Wrong count status & Active mode indicator */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="retry-wrong-count"
          className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" aria-hidden="true" />
          <span>{wrongCount} câu sai trong phần này</span>
        </span>

        {retryActive && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            Đang luyện lại câu sai
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onStartRetry}
          disabled={isRetryDisabled}
          aria-label="Luyện lại câu sai"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
          <span>Luyện lại câu sai</span>
        </button>

        {retryActive && (
          <button
            type="button"
            onClick={onStopRetry}
            disabled={disabled}
            aria-label="Về toàn bộ câu"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span>Về toàn bộ câu</span>
          </button>
        )}
      </div>
    </div>
  );
};
