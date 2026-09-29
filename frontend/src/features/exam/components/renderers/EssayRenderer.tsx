import React from 'react';

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
}

const EssayRenderer: React.FC<Props> = ({ value, onChange, questionText }) => {
  const text = value ?? '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div>
      <p>{questionText}</p>
      <textarea
        rows={10}
        value={text}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
        placeholder="Viết câu trả lời của bạn..."
      />
      <small style={{ color: '#666' }}>Số từ: {wordCount}</small>
    </div>
  );
};

export default EssayRenderer;
