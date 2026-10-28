import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import WorkspaceText from '../content/WorkspaceText';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: (ExamOption | string)[];
  value: string | null;
  onChange: (v: string) => void;
  questionId: string;
  /**
   * TOEIC Listening Part 1/2: the options are spoken, so only the letter may be rendered.
   * Defaults to `false` so IELTS/general renderers keep printing the option text.
   */
  labelOnly?: boolean;
  /** With `labelOnly`, reveal the source option text (Practice) after the answer was checked. */
  revealText?: boolean;
}

const SingleChoiceRenderer: React.FC<Props> = ({
  options,
  value,
  onChange,
  questionId,
  labelOnly = false,
  revealText = false,
}) => {
  useExamLocale();
  const normalizedOptions: ExamOption[] = (options ?? []).map((opt: any, idx: number) => {
    const letter = String.fromCharCode(65 + idx);
    if (typeof opt === 'string') {
      const text = opt.trim();
      const prefixRegex = new RegExp(`^${letter}[.)]\\s*`, 'i');
      const cleaned = text.replace(prefixRegex, '').trim();
      return { id: letter, text: cleaned || text };
    }
    const id = opt?.id ?? letter;
    const rawText = opt?.text ?? opt?.label ?? '';
    const prefixRegex = new RegExp(`^${id}[.)]\\s*`, 'i');
    const cleaned = typeof rawText === 'string' ? rawText.replace(prefixRegex, '').trim() : '';
    return {
      id,
      text: cleaned || rawText || '',
    };
  });

  return (
    <div role="radiogroup" className="space-y-2.5 my-2">
      {normalizedOptions.map((opt, idx) => {
        const isChecked = value === opt.id || (Boolean(opt.text) && value === opt.text);
        const letter = opt.id || String.fromCharCode(65 + idx);
        const hasText = typeof opt.text === 'string' && opt.text.trim().length > 0;
        const showText = hasText && (!labelOnly || revealText);

        return (
          <label
            key={opt.id || idx}
            onClick={() => onChange(opt.id)}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
              isChecked
                ? 'bg-amber-50/80 border-amber-400 text-amber-950 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name={`single-choice-${questionId}`}
              value={opt.id}
              checked={isChecked}
              onChange={() => onChange(opt.id)}
              aria-label={showText ? opt.text : em("Lựa chọn {{v0}}", { v0: letter })}
              className="mt-1 h-4 w-4 border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
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
            {labelOnly && !showText ? (
              <span
                data-testid={`option-label-${questionId}-${letter}`}
                className="text-sm sm:text-[15px] font-medium text-slate-500 pt-0.5 flex-1"
              >
                ({letter})
              </span>
            ) : (
              <WorkspaceText
                source={{ kind: 'OPTION_TEXT', questionId, optionId: opt.id }}
                format="TEXT"
                content={opt.text ? opt.text : em("Lựa chọn {{v0}}", { v0: letter })}
                className="text-sm sm:text-[15px] leading-relaxed pt-0.5 flex-1"
                as="span"
              />
            )}
          </label>
        );
      })}
    </div>
  );
};

export default SingleChoiceRenderer;
