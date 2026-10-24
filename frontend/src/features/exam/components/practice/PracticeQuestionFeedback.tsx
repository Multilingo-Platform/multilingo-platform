import { examMessage as em, useExamLocale, examErrorMessage as ee } from '../../i18n/examMessages';
import React from 'react';
import type { QuestionType } from '../../types/exam.types';
import type { PracticeQuestionFeedback as FeedbackState } from '../../hooks/usePracticeFeedback';
import { VALID_PRACTICE_OBJECTIVE_TYPES } from '../../api/practiceFeedbackContract';
import HtmlContent from '../content/HtmlContent';
import {
  formatUserAnswer,
  formatCorrectAnswer,
  formatScore,
  getVerdictBadgeInfo,
} from '../../utils/reviewPresentation';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';

export interface PracticeQuestionFeedbackProps {
  questionId: string;
  questionNumber?: number | string;
  questionType: QuestionType | string;
  feedback: FeedbackState;
  onCheck: (questionId: string) => void | Promise<void>;
  onReload?: () => void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}

function getVerdictInfo(verdict?: string | null) {
  switch (verdict) {
    case 'CORRECT':
      return {
        label: em("Chính xác"),
        badgeClass: 'bg-green-100 text-green-800 border-green-200',
        cardBorder: 'border-green-200',
        Icon: CheckCircle2,
      };
    case 'WRONG':
      return {
        label: em("Chưa chính xác"),
        badgeClass: 'bg-red-100 text-red-800 border-red-200',
        cardBorder: 'border-red-200',
        Icon: XCircle,
      };
    case 'PARTIAL':
      return {
        label: em("Một phần"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        cardBorder: 'border-amber-200',
        Icon: HelpCircle,
      };
    case 'BLANK':
      return {
        label: em("Chưa làm"),
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        cardBorder: 'border-slate-200',
        Icon: HelpCircle,
      };
    case 'PENDING':
      return {
        label: em("Chưa chấm"),
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        cardBorder: 'border-amber-200',
        Icon: HelpCircle,
      };
    default: {
      const fallback = getVerdictBadgeInfo(verdict as any);
      return {
        label: fallback.label,
        badgeClass: fallback.badgeClass,
        cardBorder: 'border-slate-200',
        Icon: HelpCircle,
      };
    }
  }
}

export const PracticeQuestionFeedback: React.FC<PracticeQuestionFeedbackProps> = ({
  questionId,
  questionNumber,
  questionType,
  feedback,
  onCheck,
  onReload,
  busy = false,
  disabled = false,
  className = '',
}) => {
  useExamLocale();
  // ESSAY question notice
  if (questionType === 'ESSAY') {
    return (
      <div
        className={`mt-3 p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-sm text-blue-900 flex items-center gap-2 ${className}`}
      >
        <Info className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
        <span className="break-words">{em("Câu tự luận chưa hỗ trợ kiểm tra tức thì")}</span>
      </div>
    );
  }

  // Unsupported question types hide feedback controls entirely
  if (!VALID_PRACTICE_OBJECTIVE_TYPES.has(questionType as any)) {
    return null;
  }

  const accessibleName =
    questionNumber !== undefined
      ? em("Kiểm tra đáp án cho câu {{v0}}", { v0: questionNumber })
      : em("Kiểm tra đáp án cho câu {{v0}}", { v0: questionId });

  const retryAccessibleName =
    questionNumber !== undefined
      ? em("Thử lại kiểm tra đáp án cho câu {{v0}}", { v0: questionNumber })
      : em("Thử lại kiểm tra đáp án cho câu {{v0}}", { v0: questionId });

  const { phase, data, error } = feedback;

  return (
    <div className={`mt-3 space-y-3 ${className}`}>
      {/* Check button (idle & checking) */}
      {(phase === 'idle' || phase === 'checking') && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCheck(questionId)}
            disabled={busy || disabled || phase === 'checking'}
            aria-label={accessibleName}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {phase === 'checking' && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            )}
            <span>{em("Kiểm tra đáp án")}</span>
          </button>
        </div>
      )}

      {/* Checking indicator */}
      {phase === 'checking' && (
        <div
          role="status"
          aria-live="polite"
          className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-center gap-2"
        >
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" aria-hidden="true" />
          <span>{em("Đang kiểm tra đáp án...")}</span>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900 space-y-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-xs break-words font-medium">
              {error?.message ? ee(error.message) : em("Có lỗi xảy ra khi kiểm tra đáp án. Vui lòng thử lại.")}
            </span>
          </div>

          {error?.retryable && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onCheck(questionId)}
                disabled={busy || disabled}
                aria-label={retryAccessibleName}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>{em("Thử lại")}</span>
              </button>
            </div>
          )}

          {!error?.retryable && onReload && error?.message?.includes('tải lại trang') && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onReload}
                aria-label={em("Tải lại trang")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>{em("Tải lại trang")}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ready feedback card */}
      {phase === 'ready' && data && (
        <div
          role="status"
          aria-live="polite"
          className={`bg-white rounded-lg border p-4 shadow-2xs space-y-3 min-w-0 ${getVerdictInfo(data.verdict).cardBorder}`}
        >
          {/* Card Header: Verdict, Practice note, Score */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getVerdictInfo(data.verdict).badgeClass}`}
              >
                {getVerdictInfo(data.verdict).label}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {em("(Phản hồi luyện tập)")}</span>
            </div>

            <div className="text-xs font-semibold text-slate-700">
              {em("Điểm:")}{' '}{formatScore(data.score)}
            </div>
          </div>

          {/* Answers: User answer & Correct answer */}
          <div className="space-y-2 min-w-0">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md min-w-0">
              <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                {em("Câu trả lời của bạn:")}</div>
              <div
                data-testid="feedback-user-answer"
                className="text-xs text-slate-900 whitespace-pre-wrap font-sans break-words"
              >
                {formatUserAnswer(data.userAnswer)}
              </div>
            </div>

            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md min-w-0">
              <div className="text-2xs font-bold text-emerald-700 uppercase tracking-wider mb-0.5">
                {em("Đáp án chuẩn:")}</div>
              <div
                data-testid="feedback-correct-answer"
                className="text-xs text-emerald-950 whitespace-pre-wrap font-sans break-words"
              >
                {formatCorrectAnswer(data.correctAnswer)}
              </div>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-md text-xs text-slate-800 space-y-1 min-w-0">
            <div className="font-semibold text-amber-900 flex items-center gap-1">
              <span>💡</span>
              <span>{em("Giải thích chi tiết:")}</span>
            </div>
            {data.explanation && data.explanation.trim() ? (
              <HtmlContent
                html={data.explanation}
                className="prose prose-sm max-w-none text-slate-800 break-words"
              />
            ) : (
              <div className="text-slate-500 italic">
                {em("Chưa có giải thích")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
