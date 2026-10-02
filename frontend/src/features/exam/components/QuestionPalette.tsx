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
  const answeredCount = answeredSet.size;
  const total = questions.length;
  const progress = total > 0 ? (answeredCount / total) * 100 : 0;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 600, color: '#4b5563' }}>
            Tiến độ hoàn thành
          </span>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#111827' }}>
            {answeredCount}/{total} câu
          </span>
        </div>
        <div style={{
          width: '100%', height: '6px',
          background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 ? '#10b981' : '#d97706',
            borderRadius: '9999px',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Grid */}
      <nav
        aria-label="Điều hướng câu hỏi"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
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
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '700',
                fontFamily: 'var(--font-heading)',
                transition: 'all 0.15s ease',
                backgroundColor: answered ? '#10b981' : '#ffffff',
                color: answered ? '#ffffff' : '#374151',
                border: answered ? '1px solid #059669' : '1px solid #d1d5db',
                boxShadow: answered ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {q.question_number}
            </div>
          );
        })}
      </nav>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.875rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#4b5563' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} />
          Đã trả lời ({answeredCount})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#6b7280' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ffffff', border: '1px solid #d1d5db', display: 'inline-block' }} />
          Chưa làm ({total - answeredCount})
        </span>
      </div>
    </div>
  );
};

export { QuestionPalette };
export default QuestionPalette;
