import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: ExamOption[];
  value: string[];
  onChange: (v: string[]) => void;
  maxSelections?: number;
}

const MultipleChoiceRenderer: React.FC<Props> = ({ options, value, onChange, maxSelections }) => {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      if (maxSelections && value.length >= maxSelections) {
        return; // Prevent selecting more than allowed
      }
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-2.5 my-2">
      {options.map((opt, idx) => {
        const isChecked = value.includes(opt.id);
        const letter = opt.id || String.fromCharCode(65 + idx);
        return (
          <label
            key={opt.id || idx}
            onClick={(e) => {
              e.preventDefault();
              toggle(opt.id);
            }}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
              isChecked
                ? 'bg-amber-50/80 border-amber-400 text-amber-950 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              readOnly
              aria-label={opt.text}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center font-heading font-bold text-xs shrink-0 transition-colors ${
                isChecked
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {letter}
            </span>
            <span className="text-sm sm:text-[15px] leading-relaxed pt-0.5 flex-1">
              {opt.text}
            </span>
          </label>
        );
      })}

      {maxSelections !== undefined && (
        <div className="flex items-center gap-2 pt-1 px-1">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-md ${
              value.length === maxSelections
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {value.length === maxSelections
              ? `✓ Đã chọn đủ ${maxSelections} đáp án`
              : `Đã chọn ${value.length}/${maxSelections} đáp án (Chọn đúng ${maxSelections} đáp án)`}
          </span>
        </div>
      )}
    </div>
  );
};

export default MultipleChoiceRenderer;
