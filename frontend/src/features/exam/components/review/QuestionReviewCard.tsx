import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import type { ReviewQuestionDto, ReviewOptionDto, ResultSummary } from '../../types/api.types';
import HtmlContent from '../content/HtmlContent';
import { ReviewText } from '../content/ReviewText';
import { canonicalQuestionOptionTokens, matchingInformationChoices } from '../../utils/workspaceTextDocuments';
import { ExplanationBox } from './ExplanationBox';
import {
  formatUserAnswer,
  formatCorrectAnswer,
  formatScore,
  getVerdictBadgeInfo,
  getWritingEvaluationStatus,
} from '../../utils/reviewPresentation';

export interface QuestionReviewCardProps {
  question: ReviewQuestionDto;
  partId?: number;
  resultSummary?: ResultSummary | null;
  index: number;
  isSelected?: boolean;
}

function answerMatchesOption(answer: unknown, optionId: string, optionText: string): boolean {
  const values = Array.isArray(answer) ? answer : [answer];
  const hasOptionText = optionText.trim().length > 0;

  return values.some(value =>
    value === optionId || (hasOptionText && value === optionText)
  );
}

function isUnanswered(answer: unknown): boolean {
  return answer === null || answer === undefined || answer === '' ||
    (Array.isArray(answer) && answer.length === 0);
}

export const QuestionReviewCard: React.FC<QuestionReviewCardProps> = ({
  question,
  partId,
  resultSummary,
  index,
  isSelected = false,
}) => {
  useExamLocale();
  const verdictInfo = getVerdictBadgeInfo(question.verdict);
  const labelText = question.label || em("Câu {{v0}}", { v0: index + 1 });
  const tokens = canonicalQuestionOptionTokens(question.type);
  const matchingOptions = question.type === 'MATCHING_INFORMATION'
    ? matchingInformationChoices((question.options ?? []).map((option, optionIndex) =>
      typeof option === 'string' ? { id: String.fromCharCode(65 + optionIndex), text: option } : option))
      .map(choice => ({
        id: choice.optionId,
        text: choice.label ?? '',
        isCorrect: question.options?.find(option => typeof option === 'object' && option !== null &&
          String(option.id) === choice.optionId)?.isCorrect,
      }))
    : null;
  const options: ReviewOptionDto[] = tokens
    ? tokens.map(id => ({ id, text: id }))
    : matchingOptions ?? question.options ?? [];
  const hasOptions = options.length > 0;
  const hasOptionWithoutText = question.type !== 'MATCHING_INFORMATION' && hasOptions && options.some(option => {
    const optionText = option.text || option.content || '';
    return optionText.trim().length === 0;
  });

  const isWritingQuestion = question.type === 'ESSAY' || question.verdict === 'PENDING';
  const writingInfo =
    isWritingQuestion && partId !== undefined && resultSummary
      ? getWritingEvaluationStatus(partId, question.questionId, resultSummary)
      : null;

  let badgeLabel = verdictInfo.label;
  let badgeClass = verdictInfo.badgeClass;
  let borderStyle = 'border-slate-200';

  if (writingInfo) {
    badgeLabel = writingInfo.label;
    if (writingInfo.status === 'FAILED') {
      badgeClass = 'bg-red-100 text-[#DC2626] border-red-200';
      borderStyle = 'border-red-200';
    } else if (writingInfo.status === 'QUEUED') {
      badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
      borderStyle = 'border-blue-200';
    } else if (writingInfo.status === 'PENDING') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
      borderStyle = 'border-amber-200';
    } else {
      badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
      borderStyle = 'border-slate-200';
    }
  } else if (question.verdict === 'CORRECT') {
    borderStyle = 'border-green-200';
  } else if (question.verdict === 'WRONG') {
    borderStyle = 'border-red-200';
  } else if (question.verdict === 'PENDING') {
    borderStyle = 'border-amber-200';
  }

  if (isSelected) {
    borderStyle = 'border-amber-500 ring-2 ring-amber-300';
  }

  return (
    <div
      id={`review-question-${question.questionId}`}
      data-testid={`question-card-${question.questionId}`}
      className={`bg-white rounded-lg border p-6 shadow-xs transition-all ${borderStyle}`}
    >
      {/* Header: Label, Verdict, Score */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-slate-800">{labelText}</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        </div>

        <div className="text-sm font-medium text-slate-600">
          <span>{em("Điểm:")}{' '}{formatScore(writingInfo ? writingInfo.score : question.score)}</span>
        </div>
      </div>

      {/* Context / Stimulus snippet if present */}
      {(question.contextHtml || question.context) && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-sm">
          <HtmlContent html={question.contextHtml || question.context} />
        </div>
      )}

      {/* Prompt */}
      {question.prompt && (
        <div className="mb-3 text-slate-700 text-sm font-medium">
          <ReviewText source={{ kind: 'QUESTION_TEXT', questionId: String(question.questionId) }} content={question.prompt} />
        </div>
      )}

      {/* Question Text */}
      {question.questionText && question.questionText !== question.prompt && (
        <div className="mb-4 text-base font-semibold text-slate-900">
          <ReviewText source={{ kind: 'QUESTION_TEXT', questionId: String(question.questionId) }} content={question.questionText} />
        </div>
      )}

      {/* Choice Options */}
      {hasOptions ? (
        <div className="space-y-2.5 mb-4">
          {isUnanswered(question.userAnswer) && (
            <div className="text-xs text-slate-500 italic mb-2">
              {em("Lựa chọn của bạn:")}<span>{em("Chưa trả lời")}</span>
            </div>
          )}
          {hasOptionWithoutText && (
            <p className="text-xs text-slate-500" role="note">
              {em("Chưa có lời thoại cho các lựa chọn. Vui lòng nghe audio để đối chiếu.")}</p>
          )}
          {options.map((opt: ReviewOptionDto, optIdx: number) => {
            const optContent = opt.text || opt.content || '';
            const isUserChoice = answerMatchesOption(question.userAnswer, opt.id, optContent);
            const isCorrectOption =
              opt.isCorrect === true ||
              answerMatchesOption(question.correctAnswer, opt.id, optContent);

            let optionClasses = 'border-slate-200 bg-white text-slate-700';
            if (isCorrectOption) {
              optionClasses = 'border-[#16A34A] bg-green-50/70 text-green-950 font-medium';
            } else if (isUserChoice && !isCorrectOption) {
              optionClasses = 'border-[#DC2626] bg-red-50/70 text-red-950 line-through';
            }

            return (
              <div
                key={opt.id || optIdx}
                className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${optionClasses}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    checked={Boolean(isUserChoice)}
                    disabled
                    readOnly
                    className="h-4 w-4 text-amber-600 cursor-not-allowed shrink-0"
                  />
                  <span
                    className="font-semibold text-slate-800 shrink-0"
                    data-testid={`review-option-id-${question.questionId}-${opt.id}`}
                  >
                    {question.type === 'MATCHING_INFORMATION'
                      ? <ReviewText source={{ kind: 'OPTION_TEXT', questionId: String(question.questionId), optionId: opt.id }} content={opt.id.toUpperCase()} />
                      : opt.id}
                  </span>
                  {optContent.trim().length > 0 && (
                    <ReviewText source={{ kind: 'OPTION_TEXT', questionId: String(question.questionId), optionId: opt.id }} content={optContent} className="inline-block" />
                  )}
                </div>
                <div className="text-xs font-bold shrink-0">
                  {isCorrectOption && (
                    <span className="text-[#16A34A]">{em("Đáp án đúng")}</span>
                  )}
                  {isUserChoice && !isCorrectOption && (
                    <span className="text-[#DC2626]">{em("Lựa chọn của bạn")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Non-choice questions (Text, Essay, Fill-in-the-blank) */
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              {em("Câu trả lời của bạn:")}</div>
            <div className="text-sm text-slate-900 whitespace-pre-wrap font-sans">
              {formatUserAnswer(question.userAnswer)}
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              {em("Đáp án chuẩn / Gợi ý:")}</div>
            <div className="text-sm text-emerald-950 whitespace-pre-wrap font-sans">
              {formatCorrectAnswer(question.correctAnswer)}
            </div>
          </div>
        </div>
      )}

      {/* Explanation Box */}
      <ExplanationBox htmlContent={question.explanation} />
    </div>
  );
};
