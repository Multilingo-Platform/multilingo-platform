import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: ExamOption[];
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

const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Label letters follow the option order, so an option without a letter id still gets A, B, C… */
function optionLetter(index: number): string {
  return OPTION_LETTERS[index] ?? String(index + 1);
}

const SingleChoiceRenderer: React.FC<Props> = ({
  options,
  value,
  onChange,
  questionId,
  labelOnly = false,
  revealText = false,
}) => (
  <div role="radiogroup">
    {options.map((opt, index) => {
      const letter = optionLetter(index);
      const hasText = typeof opt.text === 'string' && opt.text.trim().length > 0;
      const showText = hasText && (!labelOnly || revealText);
      return (
        <label key={opt.id} style={{ display: 'block', margin: '6px 0', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`single-choice-${questionId}`}
            value={opt.id}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            aria-label={showText ? opt.text : `Lựa chọn ${letter}`}
          />
          {labelOnly && !showText ? (
            <span data-testid={`option-label-${questionId}-${letter}`}>{' '}({letter})</span>
          ) : (
            <>{' '}{opt.id}. {opt.text}</>
          )}
        </label>
      );
    })}
  </div>
);

export default SingleChoiceRenderer;
