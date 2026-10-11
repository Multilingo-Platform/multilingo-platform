import React from 'react';
import { ArrowLeft, Clock, X } from 'lucide-react';
import { formatSecondsToMmSs } from '../../utils/vocabFormatters';

export interface ModeHeaderProps {
  title: string;
  deckName: string;
  currentIndex?: number;
  totalItems?: number;
  secondsLeft?: number;
  showTimer?: boolean;
  onBack: () => void;
  confirmOnBack?: boolean;
}

export const ModeHeader: React.FC<ModeHeaderProps> = ({
  title,
  deckName,
  currentIndex,
  totalItems,
  secondsLeft,
  showTimer = false,
  onBack,
}) => {
  const progressPercent =
    currentIndex !== undefined && totalItems && totalItems > 0
      ? Math.min(100, Math.round((currentIndex / totalItems) * 100))
      : 0;

  return (
    <header className="w-full bg-white border-b border-slate-200/90 shrink-0 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Nút quay lại & Tiêu đề chế độ */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer focus:outline-none shrink-0"
            title="Thoát phiên học"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thoát</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 hidden sm:inline">
                {deckName}
              </span>
            </h1>
          </div>
        </div>

        {/* Góc phải: Bộ đếm tiến độ thẻ & Nút Dừng */}
        <div className="flex items-center gap-3 shrink-0">
          {currentIndex !== undefined && totalItems !== undefined && (
            <div className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs sm:text-sm font-bold text-slate-700">
              Thẻ <span className="text-amber-600">{currentIndex}</span> / {totalItems}
            </div>
          )}

          {showTimer && secondsLeft !== undefined && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold transition-colors ${
                secondsLeft <= 10
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatSecondsToMmSs(secondsLeft)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Dừng phiên học"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Thanh tiến độ học tập mảnh */}
      {totalItems !== undefined && totalItems > 0 && (
        <div className="w-full h-1.5 bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </header>
  );
};
