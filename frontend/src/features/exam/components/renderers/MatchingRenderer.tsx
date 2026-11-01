import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import type { ExamOption } from '../../types/exam.types';
import WorkspaceText from '../content/WorkspaceText';

interface Props {
  options: (ExamOption | string)[];
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
  questionId?: string;
}

const MatchingRenderer: React.FC<Props> = ({
  options,
  value,
  onChange,
  questionText,
  questionId = 'unknown',
}) => {
  useExamLocale();
  const normalizedOptions: ExamOption[] = (options ?? []).map((opt, idx) => {
    if (typeof opt === 'string') {
      return { id: String.fromCharCode(65 + idx), text: opt };
    }
    return opt;
  });

  return (
    <div className="space-y-3">
      {questionText && (
        <div className="font-medium text-slate-800">
          <WorkspaceText
            source={{ kind: 'QUESTION_TEXT', questionId }}
            format="TEXT"
            content={questionText}
            as="p"
          />
        </div>
      )}

      {normalizedOptions.length > 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm space-y-1.5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            {em("Danh sách lựa chọn:")}
          </div>
          {normalizedOptions.map((opt) => (
            <div key={opt.id} className="flex items-start gap-2 text-slate-700">
              <span className="font-bold text-slate-900 shrink-0">{opt.id}.</span>
              <WorkspaceText
                source={{ kind: 'OPTION_TEXT', questionId, optionId: opt.id }}
                format="TEXT"
                content={opt.text}
                as="span"
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          {em("Chọn đáp án:")}
        </label>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 min-w-[180px]"
        >
          <option value="">{em("-- Chọn --")}</option>
          {normalizedOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.id}{opt.text ? `. ${opt.text}` : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MatchingRenderer;
