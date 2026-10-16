import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options?: (ExamOption | string)[] | null;
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const MatchingInformationRenderer: React.FC<Props> = ({ options, value, onChange, disabled }) => {
  const defaultLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  const normalizedOptions: { letter: string; label: string }[] = (
    options && options.length > 0
      ? options.map((opt, idx) => {
          if (typeof opt === 'string') {
            const trimmed = opt.trim();
            const letterMatch = trimmed.match(/^[A-Z]$/i) || trimmed.match(/^(?:Section|Paragraph|Đoạn)\s*([A-Z])/i);
            const letter = letterMatch ? (letterMatch[1] || letterMatch[0]).toUpperCase() : String.fromCharCode(65 + idx);
            return { letter, label: trimmed || `Đoạn ${letter}` };
          }
          const letter = (opt.id || String.fromCharCode(65 + idx)).trim().toUpperCase();
          return { letter, label: opt.text || `Đoạn ${letter}` };
        })
      : defaultLetters.map(letter => ({ letter, label: `Đoạn ${letter}` }))
  );

  const handleSelect = (letter: string) => {
    if (disabled) return;
    if (value === letter) {
      onChange('');
    } else {
      onChange(letter);
    }
  };

  return (
    <div className="my-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Chọn đoạn văn chứa thông tin:
        </span>
        {value && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            Đã chọn: Đoạn {value}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {normalizedOptions.map((opt) => {
          const isSelected = value?.toUpperCase() === opt.letter.toUpperCase();
          return (
            <button
              key={opt.letter}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(opt.letter)}
              title={opt.label}
              className={`min-w-11 h-10 px-3.5 rounded-lg font-heading font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                isSelected
                  ? 'bg-amber-500 text-white border-2 border-amber-600 shadow-sm scale-105 ring-2 ring-amber-300/50'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-900 active:scale-95'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingInformationRenderer;
