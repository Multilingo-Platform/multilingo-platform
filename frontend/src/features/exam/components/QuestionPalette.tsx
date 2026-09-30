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
          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-heading)', fontWeight: 500, color: '#94A3B8' }}>
            Đã làm
          </span>
          <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-heading)', fontWeight: 600, color: '#e2e8f0' }}>
            {answeredCount}/{total}
          </span>
        </div>
        <div style={{
          width: '100%', height: '4px',
          background: '#1E293B', borderRadius: '9999px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: progress === 100 ? '#10B981' : '#2151DA',
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
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: '700',
                fontFamily: 'var(--font-heading)',
                transition: 'all 0.15s',
                backgroundColor: answered ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.8)',
                color: answered ? '#10B981' : '#64748b',
                border: answered ? '1px solid rgba(16,185,129,0.4)' : '1px solid #334155',
              }}
            >
              {q.question_number}
            </div>
          );
        })}
      </nav>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: '#94A3B8' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.4)', display: 'inline-block' }} />
          Đã trả lời
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: '#94A3B8' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', display: 'inline-block' }} />
          Chưa trả lời
        </span>
      </div>
    </div>
  );
};

export { QuestionPalette };
export default QuestionPalette;
