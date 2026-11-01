import React from 'react';
import WorkspaceText from '../content/WorkspaceText';
import { canonicalQuestionOptionTokens } from '../../utils/workspaceTextDocuments';

interface Props {
  variant: 'TRUE_FALSE_NOT_GIVEN' | 'YES_NO_NOT_GIVEN';
  value: string | null;
  onChange: (v: string) => void;
  questionId?: string;
}

const TFNGRenderer: React.FC<Props> = ({ variant, value, onChange, questionId = 'unknown' }) => {
  const options = canonicalQuestionOptionTokens(variant) ?? [];

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: '6px 14px',
            fontWeight: value === opt ? 'bold' : 'normal',
            border: value === opt ? '2px solid #3498db' : '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: value === opt ? '#ebf5fb' : '#fff',
          }}
        >
          <WorkspaceText
            source={{ kind: 'OPTION_TEXT', questionId, optionId: opt }}
            format="TEXT"
            content={opt}
            as="span"
          />
        </button>
      ))}
    </div>
  );
};

export default TFNGRenderer;
