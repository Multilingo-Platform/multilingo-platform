import React from 'react';

interface Props {
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}

const DiagramLabelingRenderer: React.FC<Props> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder ?? 'Điền nhãn...'}
    style={{ width: '160px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
  />
);

export default DiagramLabelingRenderer;
