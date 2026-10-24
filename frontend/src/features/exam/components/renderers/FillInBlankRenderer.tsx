import { examMessage as em } from '../../i18n/examMessages';
import React from 'react';

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
}

const FillInBlankRenderer: React.FC<Props> = ({ value, onChange, questionText }) => (
  <div>
    <p>{questionText}</p>
    <input
      type="text"
      aria-label={questionText || em("Nhập đáp án")}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ width: '200px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
      placeholder={em("Nhập đáp án...")}
    />
  </div>
);

export default FillInBlankRenderer;
