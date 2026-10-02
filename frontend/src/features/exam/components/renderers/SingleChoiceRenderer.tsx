import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: ExamOption[];
  value: string | null;
  onChange: (v: string) => void;
  questionId: string;
}

const SingleChoiceRenderer: React.FC<Props> = ({ options, value, onChange, questionId }) => (
  <div role="radiogroup">
    {options.map(opt => (
      <label key={opt.id} style={{ display: 'block', margin: '6px 0', cursor: 'pointer' }}>
        <input
          type="radio"
          name={`single-choice-${questionId}`}
          value={opt.id}
          checked={value === opt.id}
          onChange={() => onChange(opt.id)}
          aria-label={opt.text}
        />
        {' '}{opt.id}. {opt.text}
      </label>
    ))}
  </div>
);

export default SingleChoiceRenderer;
