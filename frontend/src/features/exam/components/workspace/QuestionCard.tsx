import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import WorkspaceText from '../content/WorkspaceText';
import type { AnswerValue } from '../../types/answer.types';
import type { Question } from '../../types/exam.types';
import QuestionRenderer from '../renderers/QuestionRenderer';
import SingleChoiceRenderer from '../renderers/SingleChoiceRenderer';

export interface QuestionCardProps {
  question: Question;
  partId: number;
  /** Canonical whole-exam number, or null when the source provides none. */
  questionNumber: number | null;
  value: AnswerValue;
  flagged: boolean;
  disabled: boolean;
  onAnswer: (value: AnswerValue) => void;
  onToggleFlag: () => void;
  /** Part 1/2: the prompt itself is spoken and must stay out of the DOM. */
  hidePrompt?: boolean;
  /** Part 1/2: hide the spoken option text until `revealOptions` becomes true. */
  hideOptionsText?: boolean;
  /** Practice: the source option text becomes available after the answer was checked. */
  revealOptions?: boolean;
  /** Practice: revealed listening transcript, only when the snapshot provides one. */
  revealContent?: React.ReactNode;
  /** Practice: answer-check feedback control (same controller as the rest of the workspace). */
  feedbackSlot?: React.ReactNode;
}

/**
 * One TOEIC question: canonical number badge, flag ("Đánh dấu"), the answer editor inside a
 * fieldset that follows the section lock, and the optional Practice reveal/feedback slots.
 */
const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  partId,
  questionNumber,
  value,
  flagged,
  disabled,
  onAnswer,
  onToggleFlag,
  hidePrompt = false,
  hideOptionsText = false,
  revealOptions = false,
  revealContent,
  feedbackSlot,
}) => {
  useExamLocale();
  const questionId = question.question_id;
  const answered = value !== null && value !== undefined && value !== '';

  return (
    <div
      id={`q-${questionId}`}
      data-testid={`listening-question-${questionId}`}
      data-question-id={questionId}
      className={`ed-card p-4 scroll-mt-4 transition-all duration-200 ${
        answered ? 'border-amber-200/80 bg-white' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {questionNumber !== null && (
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                answered ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {questionNumber}
            </span>
          )}
          {!hidePrompt && question.question_text && (
            <div className="font-heading font-semibold text-slate-900 text-sm leading-relaxed flex-1">
              <WorkspaceText
                source={{ kind: 'QUESTION_TEXT', questionId }}
                format="TEXT"
                content={question.question_text}
                as="div"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          data-testid={`flag-btn-${questionId}`}
          disabled={disabled}
          aria-pressed={flagged}
          onClick={() => {
            if (!disabled) onToggleFlag();
          }}
          title={flagged ? em("Bỏ đánh dấu câu hỏi này") : em("Đánh dấu câu hỏi này để xem lại sau")}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all shrink-0 shadow-2xs ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          } ${
            flagged
              ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-400/30'
              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <span>{flagged ? '🚩' : '🏳️'}</span>
          <span>{flagged ? em("Đã đánh dấu") : em("Đánh dấu")}</span>
        </button>
      </div>

      <div className="pl-0 sm:pl-10">
        <fieldset
          data-testid={`listening-answer-fieldset-${questionId}`}
          disabled={disabled}
          className="m-0 min-w-0 border-0 p-0"
        >
          {question.type === 'SINGLE_CHOICE' ? (
            <SingleChoiceRenderer
              options={question.options ?? []}
              value={value as string | null}
              onChange={onAnswer}
              questionId={questionId}
              labelOnly={hideOptionsText}
              revealText={revealOptions}
            />
          ) : (
            <QuestionRenderer
              question={question}
              partId={partId}
              currentAnswer={value}
              onChange={onAnswer}
            />
          )}
        </fieldset>

        {feedbackSlot}
        {revealContent}
      </div>
    </div>
  );
};

export default QuestionCard;
