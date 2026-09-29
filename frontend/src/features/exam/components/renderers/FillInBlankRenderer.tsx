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
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ width: '200px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
      placeholder="Nhập đáp án..."
    />
  </div>
);

export default FillInBlankRenderer;
