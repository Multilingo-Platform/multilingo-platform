import React from 'react';

export interface MatchTileProps {
  id: string;
  cardId: number;
  text: string;
  type: 'WORD' | 'MEANING';
  isSelected: boolean;
  isWrong: boolean;
  isMatched: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Component MatchTile - Ô thẻ ghép từ vựng tối giản
 * - Không có icon hay nhãn phân loại thừa.
 * - Bo góc vừa phải (rounded-lg).
 * - Cỡ chữ vừa vặn, font sans tự nhiên, dễ đọc.
 */
export const MatchTile: React.FC<MatchTileProps> = ({
  text,
  isSelected,
  isWrong,
  isMatched,
  disabled = false,
  onClick,
}) => {
  if (isMatched) {
    return (
      <div
        className="invisible opacity-0 pointer-events-none p-3 sm:p-4 min-h-[100px] sm:min-h-[120px] rounded-lg select-none"
        aria-hidden="true"
      />
    );
  }

  let stateClasses =
    'bg-white border-slate-200 text-slate-800 hover:border-amber-400 hover:bg-amber-50/20 hover:shadow-xs';

  if (isWrong) {
    stateClasses =
      'bg-red-50 border-red-500 text-red-700 animate-shake shadow-xs ring-2 ring-red-400/30';
  } else if (isSelected) {
    stateClasses =
      'bg-amber-50/80 border-amber-500 text-amber-950 shadow-xs ring-2 ring-amber-400/40';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isMatched}
      className={`relative flex items-center justify-center p-3 sm:p-5 min-h-[100px] sm:min-h-[120px] w-full rounded-lg border-2 text-center transition-all duration-150 select-none shadow-xs active:scale-[0.98] focus:outline-hidden ${stateClasses}`}
    >
      <span className="text-sm sm:text-base font-bold font-sans line-clamp-3 leading-snug break-words px-2 text-slate-800">
        {text}
      </span>
    </button>
  );
};
