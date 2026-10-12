import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface QuizOptionButtonProps {
  /** Nhãn chữ cái đại diện: 'A', 'B', 'C', 'D' */
  label: string;
  /** Nội dung phương án nghĩa từ vựng */
  optionText: string;
  /** Người dùng có chọn phương án này không */
  isSelected: boolean;
  /** Phương án này có phải đáp án đúng không */
  isCorrect: boolean;
  /** Câu hỏi đã được trả lời chưa (để hiển thị kết quả) */
  isAnswered: boolean;
  /** Phím tắt tương ứng: '1', '2', '3', '4' */
  shortcutKey: string;
  /** Callback khi người dùng nhấp chọn */
  onSelect: () => void;
}

/**
 * Component Nút Phương Án Trắc Nghiệm (QuizOptionButton)
 *
 * Chuẩn thiết kế:
 * - Bo góc vừa phải (rounded-lg cho ô, rounded-md cho nhãn A/B/C/D).
 * - Viền phẳng tinh tế, không bóng bẩy hay tròn ủng.
 * - Icon trạng thái tối giản, không gây xao nhãng.
 */
export const QuizOptionButton: React.FC<QuizOptionButtonProps> = ({
  label,
  optionText,
  isSelected,
  isCorrect,
  isAnswered,
  shortcutKey,
  onSelect,
}) => {
  // Xác định style động theo trạng thái
  let containerStyle =
    'group relative flex items-center gap-3.5 w-full min-h-[58px] sm:min-h-[64px] px-4 sm:px-5 py-3.5 sm:py-4 rounded-lg border text-left font-medium text-sm sm:text-base transition-all duration-150 select-none';

  if (!isAnswered) {
    containerStyle +=
      ' border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/30 text-slate-800 active:scale-[0.99] cursor-pointer shadow-2xs';
  } else if (isCorrect) {
    containerStyle +=
      ' border-emerald-500 bg-emerald-50/80 text-emerald-950 shadow-2xs cursor-default';
  } else if (isSelected) {
    containerStyle +=
      ' border-rose-400 bg-rose-50/80 text-rose-950 shadow-2xs cursor-default';
  } else {
    containerStyle +=
      ' border-slate-200 bg-slate-50/50 text-slate-400 opacity-60 cursor-default';
  }

  // Style cho huy hiệu chữ cái A, B, C, D
  let badgeStyle =
    'shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs sm:text-sm font-bold transition-colors';

  if (!isAnswered) {
    badgeStyle +=
      ' bg-slate-100 text-slate-600 group-hover:bg-amber-100 group-hover:text-amber-800';
  } else if (isCorrect) {
    badgeStyle += ' bg-emerald-600 text-white';
  } else if (isSelected) {
    badgeStyle += ' bg-rose-500 text-white';
  } else {
    badgeStyle += ' bg-slate-200 text-slate-400';
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isAnswered}
      className={containerStyle}
      aria-label={`Phương án ${label}: ${optionText}`}
    >
      {/* Huy hiệu chữ cái A, B, C, D */}
      <span className={badgeStyle}>
        {label}
      </span>

      {/* Nội dung phương án nghĩa */}
      <span className="flex-1 leading-normal break-words font-medium">
        {optionText}
      </span>

      {/* Trạng thái khi đã trả lời */}
      {isAnswered && isCorrect && (
        <span className="shrink-0 flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
          <span className="hidden sm:inline">Đáp án đúng</span>
          <CheckCircle2 className="w-4 h-4" />
        </span>
      )}

      {isAnswered && isSelected && !isCorrect && (
        <span className="shrink-0 flex items-center gap-1.5 text-rose-500 text-xs font-semibold">
          <span className="hidden sm:inline">Đã chọn</span>
          <XCircle className="w-4 h-4" />
        </span>
      )}

      {/* Phím tắt số khi chưa trả lời (chỉ hiển thị trên desktop) */}
      {!isAnswered && (
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-400 border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
          {shortcutKey}
        </kbd>
      )}
    </button>
  );
};
