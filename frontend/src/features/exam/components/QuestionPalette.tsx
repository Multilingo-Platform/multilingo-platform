import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import type { Question } from '../types/exam.types';
import { isAnswered } from '../utils/answerUtils';

interface QuestionPaletteProps {
  allParts?: any[];
  activePartId?: number;
  questions?: Question[];
  partId?: number;
  onNavigate: ((partId: number, questionId: string) => void) | ((questionId: string) => void);
}

const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  allParts,
  activePartId,
  questions,
  partId: singlePartId,
  onNavigate,
}) => {
  const answers = useSelector((state: RootState) => state.answers.answers);
  const flags = useSelector((state: RootState) => state.answers.flags);

  const normalizedParts = useMemo(() => {
    if (allParts && allParts.length > 0) return allParts;
    if (questions && questions.length > 0) {
      return [{ id: singlePartId ?? 1, part_id: singlePartId ?? 1, title: 'Questions', questions }];
    }
    return [];
  }, [allParts, questions, singlePartId]);

  // Compute total, answered, and flagged across all parts
  let answeredCount = 0;
  let flaggedCount = 0;
  let total = 0;

  normalizedParts.forEach((p: any) => {
    const pId = p.part_id ?? p.id;
    const qList = Array.isArray(p.questions) && p.questions.length > 0
      ? p.questions
      : p.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];

    total += qList.length;

    qList.forEach((q: any) => {
      const qId = q.question_id || String(q.id);
      const val = answers[pId]?.[qId];
      if (isAnswered(val, q.type)) {
        answeredCount++;
      }
      if (flags?.[pId]?.[qId]) {
        flaggedCount++;
      }
    });
  });

  const progress = total > 0 ? (answeredCount / total) * 100 : 0;

  const handleCellClick = (pId: number, qId: string) => {
    if (allParts && allParts.length > 0) {
      (onNavigate as (partId: number, questionId: string) => void)(pId, qId);
    } else {
      (onNavigate as (questionId: string) => void)(qId);
    }
  };

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '1rem' }}>
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

      {/* Grid of Parts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {normalizedParts.map((p: any, index: number) => {
          const pId = p.part_id ?? p.id;
          const qList = Array.isArray(p.questions) && p.questions.length > 0
            ? p.questions
            : p.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];

          if (qList.length === 0) return null;

          return (
            <div key={pId}>
              {normalizedParts.length > 1 && (
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: '#1f2937', marginBottom: '8px' }}>
                  {p.title || p.content?.part_title || `Part ${index + 1}`}
                </div>
              )}
              <nav
                aria-label={`Điều hướng câu hỏi phần ${index + 1}`}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
              >
                {qList.map((q: any) => {
                  const qId = q.question_id || String(q.id);
                  const val = answers[pId]?.[qId];
                  const answered = isAnswered(val, q.type);
                  const isFlagged = !!flags?.[pId]?.[qId];
                  const isActive = activePartId ? pId === activePartId : true;

                  // Compute styles based on 3 states: Flagged, Answered, Unanswered
                  let bg = '#ffffff';
                  let color = '#374151';
                  let border = '1px solid #d1d5db';
                  let shadow = '0 1px 2px rgba(0,0,0,0.04)';

                  if (isFlagged) {
                    if (answered) {
                      bg = '#10b981';
                      color = '#ffffff';
                      border = '2px solid #f59e0b';
                      shadow = '0 0 0 2px rgba(245, 158, 11, 0.4)';
                    } else {
                      bg = '#fef3c7';
                      color = '#92400e';
                      border = '2px solid #f59e0b';
                      shadow = '0 1px 3px rgba(245, 158, 11, 0.3)';
                    }
                  } else if (answered) {
                    bg = '#10b981';
                    color = '#ffffff';
                    border = '1px solid #059669';
                    shadow = '0 1px 2px rgba(16,185,129,0.3)';
                  }

                  return (
                    <div
                      key={qId}
                      data-testid={`palette-${qId}`}
                      data-answered={answered ? 'true' : 'false'}
                      data-flagged={isFlagged ? 'true' : 'false'}
                      data-status={isFlagged ? 'flagged' : answered ? 'answered' : 'unanswered'}
                      role="button"
                      tabIndex={0}
                      aria-label={`Câu ${q.question_number ?? q.id}${isFlagged ? ' (đã gắn cờ)' : ''}${answered ? ' (đã trả lời)' : ' (chưa trả lời)'}`}
                      onClick={() => handleCellClick(pId, qId)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCellClick(pId, qId); }}
                      style={{
                        position: 'relative',
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
                        backgroundColor: bg,
                        color,
                        border,
                        boxShadow: shadow,
                        opacity: isActive ? 1 : 0.65,
                      }}
                    >
                      {/* Flag icon pill on top right corner */}
                      {isFlagged && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#f59e0b',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            color: '#ffffff',
                            lineHeight: 1,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          }}
                          title="Đã đánh dấu xem lại"
                        >
                          🚩
                        </span>
                      )}
                      {q.question_number ?? q.id}
                    </div>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Legend with 3 states */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#4b5563' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981', display: 'inline-block' }} />
          Đã làm ({answeredCount})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#6b7280' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ffffff', border: '1px solid #d1d5db', display: 'inline-block' }} />
          Chưa làm ({total - answeredCount})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#b45309' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#fef3c7', border: '1px solid #f59e0b', display: 'inline-block' }} />
          Đánh dấu xem lại ({flaggedCount})
        </span>
      </div>
    </div>
  );
};

export { QuestionPalette };
export default QuestionPalette;
