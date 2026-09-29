import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: ExamOption[];
  value: string[];
  onChange: (v: string[]) => void;
}

const MultipleChoiceRenderer: React.FC<Props> = ({ options, value, onChange }) => {
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
    onChange(next);
  };

  return (
    <div>
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'block', margin: '6px 0', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value.includes(opt.id)}
            onChange={() => toggle(opt.id)}
            aria-label={opt.text}
          />
          {' '}{opt.id}. {opt.text}
        </label>
      ))}
    </div>
  );
};

export default MultipleChoiceRenderer;
