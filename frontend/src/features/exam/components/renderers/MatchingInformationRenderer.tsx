import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import type { ExamOption } from '../../types/exam.types';
import WorkspaceText from '../content/WorkspaceText';
import { matchingInformationChoices } from '../../utils/workspaceTextDocuments';

interface Props {
  options?: (ExamOption | string)[] | null;
  value: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  questionId?: string;
}

const MatchingInformationRenderer: React.FC<Props> = ({ options, value, onChange, disabled, questionId }) => {
  useExamLocale();
  const normalizedOptions = matchingInformationChoices(options);

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
          {em("Chọn đoạn văn chứa thông tin:")}</span>
        {value && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            {em("Đã chọn: Đoạn")}{' '}{value}
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
              title={opt.label ?? em("Đoạn {{v0}}", { v0: opt.letter })}
              className={`min-w-11 h-10 px-3.5 rounded-lg font-heading font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                isSelected
                  ? 'bg-amber-500 text-white border-2 border-amber-600 shadow-sm scale-105 ring-2 ring-amber-300/50'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-900 active:scale-95'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {questionId ? <WorkspaceText source={{ kind: 'OPTION_TEXT', questionId, optionId: opt.optionId }} content={opt.letter} /> : opt.letter}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MatchingInformationRenderer;
