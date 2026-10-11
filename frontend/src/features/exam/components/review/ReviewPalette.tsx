import React from 'react';
import type { ReviewQuestionDto, ReviewVerdict, ResultSummary } from '../../types/api.types';
import { getWritingEvaluationStatus, type ReviewFilter } from '../../utils/reviewPresentation';

export interface ReviewPaletteProps {
  questions: Array<ReviewQuestionDto | { id: number; content?: string; [key: string]: any }>;
  partId?: number;
  resultSummary?: ResultSummary | null;
  isCorrectFlags?: Record<string, boolean>;
  userAnswers?: Record<string, any>;
  selectedQuestionId?: string | number | null;
  onSelectQuestion?: (questionId: any) => void;
  activeFilter?: ReviewFilter;
  onFilterChange?: (filter: ReviewFilter) => void;
}

export const ReviewPalette: React.FC<ReviewPaletteProps> = ({
  questions = [],
  partId,
  resultSummary,
  isCorrectFlags,
  userAnswers,
  selectedQuestionId,
  onSelectQuestion,
  activeFilter = 'ALL',
  onFilterChange,
}) => {
  let correctCount = 0;
  let incorrectCount = 0;
  let blankCount = 0;
  let pendingCount = 0;
  let queuedCount = 0;
  let failedWritingCount = 0;
  let unavailableWritingCount = 0;

  // Process questions with verdict normalization
  const parsedQuestions = questions.map((q, idx) => {
    const rawId = (q as any).questionId !== undefined ? (q as any).questionId : (q as any).id;
    const strId = String(rawId);
    const label = (q as any).label || ((q as any).id !== undefined ? String((q as any).id) : String(idx + 1));

    let verdict: ReviewVerdict = 'BLANK';
    if ((q as any).verdict) {
      verdict = (q as any).verdict as ReviewVerdict;
    } else {
      const hasAnswer =
        userAnswers &&
        userAnswers[strId] !== undefined &&
        userAnswers[strId] !== null &&
        userAnswers[strId] !== '';
      if (!hasAnswer) {
        verdict = 'BLANK';
      } else if (isCorrectFlags && isCorrectFlags[strId] === true) {
        verdict = 'CORRECT';
      } else {
        verdict = 'WRONG';
      }
    }

    if (verdict === 'CORRECT') {
      correctCount++;
    } else if (verdict === 'WRONG') {
      incorrectCount++;
    } else if (verdict === 'PENDING') {
      const isWriting = (q as any).type === 'ESSAY' || verdict === 'PENDING';
      const writingInfo =
        isWriting && partId !== undefined && resultSummary
          ? getWritingEvaluationStatus(partId, strId, resultSummary)
          : null;

      if (writingInfo?.status === 'FAILED') {
        failedWritingCount++;
      } else if (writingInfo?.status === 'QUEUED') {
        queuedCount++;
      } else if (writingInfo?.status === 'PENDING') {
        pendingCount++;
      } else if (writingInfo?.status === 'UNAVAILABLE') {
        unavailableWritingCount++;
      } else {
        pendingCount++;
      }
    } else {
      blankCount++;
    }

    return {
      rawId,
      strId,
      label,
      verdict,
    };
  });

  // Filter questions if activeFilter is not ALL
  const displayQuestions =
    activeFilter === 'ALL'
      ? parsedQuestions
      : parsedQuestions.filter((q) => q.verdict === activeFilter);

  return (
    <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-4">
      <h3 className="text-base font-bold text-slate-900 mb-3">Bảng câu hỏi</h3>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#16A34A] shrink-0" />
          <span className="text-slate-700 font-medium">{correctCount} Đúng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#DC2626] shrink-0" />
          <span className="text-slate-700 font-medium">{incorrectCount} Sai</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0" />
          <span className="text-slate-600 font-medium">{blankCount} Chưa làm</span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 col-span-3">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
            <span className="text-amber-800 font-medium">
              {pendingCount} {partId !== undefined && resultSummary ? 'Đang chấm' : 'Chờ kết quả'}
            </span>
          </div>
        )}
        {queuedCount > 0 && (
          <div className="flex items-center gap-1.5 col-span-3">
            <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
            <span className="text-blue-800 font-medium">{queuedCount} Đang chờ chấm</span>
          </div>
        )}
        {failedWritingCount > 0 && (
          <div className="flex items-center gap-1.5 col-span-3">
            <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
            <span className="text-red-800 font-medium">{failedWritingCount} Chấm không thành công</span>
          </div>
        )}
        {unavailableWritingCount > 0 && (
          <div className="flex items-center gap-1.5 col-span-3">
            <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
            <span className="text-slate-700 font-medium">{unavailableWritingCount} Chưa có thông tin</span>
          </div>
        )}
      </div>

      {/* Quick Filter Buttons if onFilterChange is available */}
      {onFilterChange && (
        <div className="flex flex-wrap gap-1 mb-3 pb-3 border-b border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => onFilterChange('ALL')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            aria-label="Chỉ xem câu đúng"
            onClick={() => onFilterChange('CORRECT')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              activeFilter === 'CORRECT'
                ? 'bg-green-700 text-white'
                : 'bg-green-50 text-green-800 hover:bg-green-100'
            }`}
          >
            Đúng ({correctCount})
          </button>
          <button
            type="button"
            aria-label="Chỉ xem câu sai"
            onClick={() => onFilterChange('WRONG')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              activeFilter === 'WRONG'
                ? 'bg-red-700 text-white'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            Sai ({incorrectCount})
          </button>
          <button
            type="button"
            aria-label="Chỉ xem câu chưa làm"
            onClick={() => onFilterChange('BLANK')}
            className={`px-2 py-1 rounded font-medium transition cursor-pointer ${
              activeFilter === 'BLANK'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Chưa làm ({blankCount})
          </button>
        </div>
      )}

      {/* Grid of question buttons */}
      <div className="grid grid-cols-5 gap-2 max-h-[420px] overflow-y-auto p-1">
        {displayQuestions.map((q) => {
          let colorClasses = 'bg-gray-200 text-gray-700 hover:bg-gray-300';
          if (q.verdict === 'CORRECT') {
            colorClasses = 'bg-[#16A34A] text-white hover:bg-green-700';
          } else if (q.verdict === 'WRONG') {
            colorClasses = 'bg-[#DC2626] text-white hover:bg-red-700';
          } else if (q.verdict === 'PENDING') {
            colorClasses = 'bg-amber-500 text-white hover:bg-amber-600';
          }

          const isSelected =
            selectedQuestionId !== null &&
            selectedQuestionId !== undefined &&
            (String(selectedQuestionId) === q.strId || selectedQuestionId === q.rawId);

          const ringClass = isSelected ? 'ring-2 ring-offset-2 ring-[#0F172A]' : '';

          return (
            <button
              key={q.strId}
              type="button"
              onClick={() => onSelectQuestion?.(q.rawId)}
              className={`h-9 rounded-md text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer ${colorClasses} ${ringClass}`}
              aria-label={`Câu ${q.label}`}
              title={`Câu ${q.label}`}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Also export as QuestionPalette for plan consistency
export const QuestionPalette = ReviewPalette;
