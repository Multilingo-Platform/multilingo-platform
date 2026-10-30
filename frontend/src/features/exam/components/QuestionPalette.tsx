import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import type { Question } from '../types/exam.types';
import { isAnswered } from '../utils/answerUtils';
import { resolveQuestionNumber } from '../utils/toeicWorkspaceModel';

export interface QuestionPaletteProps {
  allParts?: any[];
  activePartId?: number;
  activeQuestionId?: string | null;
  questions?: Question[];
  partId?: number;
  lockedPartIds?: Set<number> | number[];
  visibleQuestionIds?: readonly string[] | ReadonlySet<string>;
  /** True only for verified TOEIC snapshots; other exams keep their own question numbering. */
  isToeicExam?: boolean;
  onNavigate: ((partId: number, questionId: string) => void) | ((questionId: string) => void);
}

/**
 * Questions of a Part, preferring the flat list and otherwise walking the nested groups in
 * server order (camelCase, snake_case or wrapped in `content`).
 */
function extractQuestions(part: any): any[] {
  if (Array.isArray(part?.questions) && part.questions.length > 0) return part.questions;
  const groups =
    part?.questionGroups ??
    part?.question_groups ??
    part?.content?.questionGroups ??
    part?.content?.question_groups;
  if (Array.isArray(groups)) {
    return groups.flatMap(group => (Array.isArray(group?.questions) ? group.questions : []));
  }
  return [];
}

function declaredPartNumber(part: any): number | null {
  const raw = part?.part_number ?? part?.partNumber;
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

function parseQuestionNumberFromId(questionId: unknown): number | null {
  if (typeof questionId !== 'string') return null;
  const trimmed = questionId.trim();
  const match = /(\d+)$/.exec(trimmed);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

/**
 * Cell label for a question. TOEIC uses the canonical whole-exam number (1..200) and never the
 * array index, the Part ordinal or the DB id. Every other exam (IELTS/Writing/general) keeps its
 * own explicit numbering so the shared palette cannot renumber it.
 */
function questionCellLabel(
  question: any,
  partNumber: number | null,
  isToeicExam: boolean,
  fallbackIndex?: number | null
): { display: string; aria: string } {
  if (isToeicExam) {
    const number = resolveQuestionNumber(question, partNumber).number;
    return number !== null
      ? { display: String(number), aria: String(number) }
      : { display: '–', aria: em("chưa xác định") };
  }

  const explicitNumber =
    (typeof question?.question_number === 'number' && question.question_number > 0)
      ? question.question_number
      : (typeof question?.questionNumber === 'number' && question.questionNumber > 0)
        ? question.questionNumber
        : (typeof question?.id === 'number' && question.id > 0)
          ? question.id
          : null;

  if (explicitNumber !== null) {
    const text = String(explicitNumber);
    return { display: text, aria: text };
  }

  const idStr = question?.question_id ?? (typeof question?.id === 'string' ? question.id : null);
  const parsedFromId = parseQuestionNumberFromId(idStr);
  if (parsedFromId !== null) {
    const text = String(parsedFromId);
    return { display: text, aria: text };
  }

  if (typeof fallbackIndex === 'number' && fallbackIndex > 0) {
    const text = String(fallbackIndex);
    return { display: text, aria: text };
  }

  const raw = question?.question_number ?? question?.questionNumber ?? question?.id;
  const text = raw === undefined || raw === null ? '–' : String(raw);
  return { display: text, aria: text };
}

const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  allParts,
  activePartId,
  activeQuestionId,
  questions,
  partId: singlePartId,
  lockedPartIds,
  visibleQuestionIds,
  isToeicExam = false,
  onNavigate,
}) => {
  useExamLocale();
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
    const qList = extractQuestions(p);

    total += qList.length;

    qList.forEach((q: any) => {
      const qId = q.question_id || String(q.id);
      const val = answers[pId]?.[qId];
      if (isAnswered(val, q.type)) answeredCount++;
      if (flags?.[pId]?.[qId]) flaggedCount++;
    });
  });

  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const handleCellClick = (pId: number, qId: string) => {
    if (allParts && allParts.length > 0) {
      (onNavigate as (partId: number, questionId: string) => void)(pId, qId);
    } else {
      (onNavigate as (questionId: string) => void)(qId);
    }
  };

  const visibleQuestionIdSet = useMemo(() => {
    if (!visibleQuestionIds) return null;
    return visibleQuestionIds instanceof Set ? visibleQuestionIds : new Set(visibleQuestionIds);
  }, [visibleQuestionIds]);

  return (
    <div style={{ padding: '1.25rem' }}>
      {/* Header with Title and Total Count Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.95rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#1f2937',
            margin: 0,
          }}
        >
          {em("Bảng câu hỏi")}
        </h3>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: '#ea580c',
            backgroundColor: '#fff7ed',
            border: '1px solid #ffedd5',
            padding: '2px 8px',
            borderRadius: '9999px',
          }}
        >
          {total} {em("câu")}
        </span>
      </div>

      {/* Progress Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px' }}>
          <span>{em("Tiến độ hoàn thành")}</span>
          <span style={{ fontWeight: 600, color: '#111827' }}>
            {answeredCount}/{total} {em("câu")}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={em("Tiến độ bài thi")}
          style={{ width: '100%', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#ea580c',
              borderRadius: '9999px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Question Groups per Part */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {normalizedParts.map((p: any, index: number) => {
          const pId = p.part_id ?? p.id;
          const pNumber = declaredPartNumber(p);
          const qList = extractQuestions(p);
          if (qList.length === 0) return null;

          const isPartLocked = lockedPartIds instanceof Set
            ? lockedPartIds.has(pId)
            : Array.isArray(lockedPartIds)
              ? lockedPartIds.includes(pId)
              : false;

          const isCurrentActivePart = activePartId ? pId === activePartId : true;

          return (
            <div key={pId}>
              {normalizedParts.length > 1 && (
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', fontFamily: 'var(--font-heading)', color: '#1f2937', marginBottom: '8px' }}>
                  {p.title || p.content?.part_title || `Part ${pNumber ?? index + 1}`}
                </div>
              )}
              <nav
                aria-label={em("Điều hướng câu hỏi phần {{v0}}", { v0: index + 1 })}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}
              >
                {qList.map((q: any, qIdx: number) => {
                  const qId = q.question_id || String(q.id);
                  const val = answers[pId]?.[qId];
                  const answered = isAnswered(val, q.type);
                  const isFlagged = !!flags?.[pId]?.[qId];
                  const isActive = activePartId ? pId === activePartId : true;
                  const { display: displayNumber, aria: ariaNumber } = questionCellLabel(q, pNumber, isToeicExam, qIdx + 1);
                  const isCurrentQuestion = activeQuestionId != null && activeQuestionId === qId;

                  const isExcludedFromRetry = isCurrentActivePart && visibleQuestionIdSet !== null && !visibleQuestionIdSet.has(qId);
                  const isCellDisabled = isPartLocked || Boolean(isExcludedFromRetry);

                  // Compute styles based on 3 states: Flagged, Answered, Unanswered, Current
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
                  } else if (isCurrentQuestion) {
                    bg = '#fffbeb';
                    color = '#b45309';
                    border = '2px solid #d97706';
                    shadow = '0 0 0 2px rgba(217, 119, 6, 0.25)';
                  }

                  return (
                    <button
                      type="button"
                      key={qId}
                      data-testid={`palette-${qId}`}
                      data-answered={answered ? 'true' : 'false'}
                      data-flagged={isFlagged ? 'true' : 'false'}
                      data-status={isFlagged ? 'flagged' : answered ? 'answered' : 'unanswered'}
                      disabled={isCellDisabled}
                      aria-disabled={isCellDisabled ? 'true' : 'false'}
                      aria-current={isCurrentQuestion ? 'true' : undefined}
                      aria-label={em("Câu {{v0}}{{v1}}{{v2}}", { v0: ariaNumber, v1: isFlagged ? ' (đã gắn cờ)' : '', v2: answered ? ' (đã trả lời)' : ' (chưa trả lời)' })}
                      onClick={() => { if (!isCellDisabled) handleCellClick(pId, qId); }}
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        cursor: isCellDisabled ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        fontFamily: 'var(--font-heading)',
                        transition: 'all 0.15s ease',
                        backgroundColor: bg,
                        color,
                        border,
                        boxShadow: shadow,
                        opacity: isCellDisabled ? 0.35 : (isActive ? 1 : 0.65),
                      }}
                    >
                      {/* Flag icon pill on top right corner */}
                      {isFlagged && (
                        <span
                          aria-hidden="true"
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
                          title={em("Đã đánh dấu xem lại")}
                        >
                          🚩
                        </span>
                      )}
                      {displayNumber}
                    </button>
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
          {em("Đã làm (")}{answeredCount})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#6b7280' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ffffff', border: '1px solid #d1d5db', display: 'inline-block' }} />
          {em("Chưa làm (")}{total - answeredCount})
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.7rem', fontWeight: 500, color: '#b45309' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#fef3c7', border: '1px solid #f59e0b', display: 'inline-block' }} />
          {em("Đánh dấu xem lại (")}{flaggedCount})
        </span>
      </div>
    </div>
  );
};

export { QuestionPalette };
export default QuestionPalette;
