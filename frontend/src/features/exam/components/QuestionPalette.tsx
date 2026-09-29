import React from 'react';
import { useSelector } from 'react-redux';
import type { Question } from '../types/exam.types';
import { selectAnsweredQuestionIds } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

interface QuestionPaletteProps {
  questions: Question[];
  partId: number;
  onNavigate: (questionId: string) => void;
}

const QuestionPalette: React.FC<QuestionPaletteProps> = ({ questions, partId, onNavigate }) => {
  const answeredIds = useSelector((state: RootState) => selectAnsweredQuestionIds(state, partId));
  const answeredSet = new Set(answeredIds);

  return (
    <nav
      aria-label="Điều hướng câu hỏi"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px' }}
    >
      {questions.map(q => {
        const answered = answeredSet.has(q.question_id);
        return (
          <div
            key={q.question_id}
            data-testid={`palette-${q.question_id}`}
            data-answered={answered ? 'true' : 'false'}
            role="button"
            tabIndex={0}
            aria-label={`Câu ${q.question_number}${answered ? ' (đã trả lời)' : ' (chưa trả lời)'}`}
            onClick={() => onNavigate(q.question_id)}
            onKeyDown={e => { if (e.key === 'Enter') onNavigate(q.question_id); }}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: answered ? '#2ecc71' : '#ecf0f1',
              color: answered ? '#fff' : '#2c3e50',
              border: answered ? '1px solid #27ae60' : '1px solid #bdc3c7',
            }}
          >
            {q.question_number}
          </div>
        );
      })}
    </nav>
  );
};

export default QuestionPalette;
