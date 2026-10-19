import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props {
  options: (ExamOption | string)[];
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
}

const MatchingRenderer: React.FC<Props> = ({ options, value, onChange, questionText }) => {
  const normalizedOptions: ExamOption[] = (options ?? []).map((opt, idx) => {
    if (typeof opt === 'string') {
      return { id: String.fromCharCode(65 + idx), text: opt };
    }
    return opt;
  });

  return (
    <div>
      <p>{questionText}</p>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '4px 8px', minWidth: '160px' }}
      >
        <option value="">-- Chọn --</option>
        {normalizedOptions.map(opt => (
          <option key={opt.id} value={opt.id}>
            {opt.id}{opt.text ? `. ${opt.text}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MatchingRenderer;
