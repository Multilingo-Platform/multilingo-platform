import React from 'react';
import type { WritingFeedbackTask as WritingFeedbackTaskData } from '../../../types/api.types';
import {
  formatBandScore,
  getCriterionName,
  sortCriteriaCanonical,
  getTaskStatusLabel,
} from '../../../utils/writingFeedbackPresentation';
import { mapReasonCodeToMessage, ALLOWED_REASON_CODES } from '../../../utils/writingFeedbackErrors';
import { WritingDiffView } from './WritingDiffView';
import { WritingCorrectionsList } from './WritingCorrectionsList';

export interface WritingFeedbackTaskProps {
  task: WritingFeedbackTaskData;
  className?: string;
}

export const WritingFeedbackTask: React.FC<WritingFeedbackTaskProps> = ({
  task,
  className = '',
}) => {
  const isDone = task.status === 'DONE';
  const isTooShort = isDone && (task.source === 'SYSTEM' || task.reasonCode === 'TOO_SHORT');
  const isAiDone = isDone && !isTooShort;
  const canonicalCriteria = sortCriteriaCanonical(task.criteria ?? []);

  return (
    <article
      className={`rounded-xl border bg-card p-5 md:p-6 shadow-sm space-y-6 text-card-foreground ${className}`}
      data-testid={`writing-task-${task.questionId}`}
    >
      {/* Header: Label, Word count, Status, Source */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight break-words [overflow-wrap:anywhere]">
            {task.label || task.questionId}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium">
              <span>Độ dài:</span>
              <span className="font-semibold text-foreground">{task.wordCount}</span>
              <span>từ</span>
            </span>
            {task.language && (
              <>
                <span>•</span>
                <span>Ngôn ngữ: {task.language.toUpperCase()}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status badge */}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isDone
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : task.status === 'PENDING' || task.status === 'QUEUED'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {getTaskStatusLabel(task.status)}
          </span>

          {/* Source badge */}
          {isAiDone && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              Chấm bởi AI
            </span>
          )}
          {isTooShort && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              Đánh giá bởi: Hệ thống (SYSTEM)
            </span>
          )}
        </div>
      </header>

      {/* Case 1: DONE status */}
      {isDone && (
        <div className="space-y-6">
          {/* Overall score card */}
          <div className="rounded-lg border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Điểm Overall
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold text-primary">
                  {formatBandScore(task.overall)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / {formatBandScore(task.maxScore, '9,0')}
                </span>
              </div>
            </div>

            {isTooShort && (
              <p className="text-xs md:text-sm text-amber-700 dark:text-amber-400 font-medium max-w-md">
                Điểm 0 do bài viết quá ngắn (không đủ số từ tối thiểu để tiến hành chấm chi tiết).
              </p>
            )}
          </div>

          {/* Canonical Criteria Grid */}
          {canonicalCriteria.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Chi tiết tiêu chí chấm điểm
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {canonicalCriteria.map(criterion => (
                  <div
                    key={criterion.code}
                    className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                      <h4 className="text-sm font-bold text-foreground">
                        {getCriterionName(criterion.code)} ({criterion.code})
                      </h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-extrabold bg-primary/10 text-primary">
                        {formatBandScore(criterion.score)}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {criterion.feedback}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall feedback */}
          {task.overallFeedback && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <h4 className="text-sm font-bold text-foreground">
                Nhận xét tổng quan
              </h4>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {task.overallFeedback}
              </p>
            </div>
          )}

          {/* Visual observations (only when hasVisualContext && visualObservations) */}
          {task.hasVisualContext && task.visualObservations && (
            <div
              data-testid="visual-observations"
              className="rounded-lg border bg-card p-4 space-y-2 border-primary/20 bg-primary/5"
            >
              <h4 className="text-sm font-bold text-primary">
                Nhận xét ngữ cảnh hình ảnh / biểu đồ
              </h4>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {task.visualObservations}
              </p>
            </div>
          )}

          {/* Diff View */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">
              So sánh bài viết & đề xuất sửa đổi
            </h4>
            <WritingDiffView
              originalText={task.originalText}
              correctedEssay={task.correctedEssay}
              diff={task.diff}
            />
          </div>

          {/* Corrections List */}
          <WritingCorrectionsList corrections={task.corrections} />
        </div>
      )}

      {/* Case 2: PENDING / QUEUED status */}
      {(task.status === 'PENDING' || task.status === 'QUEUED') && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 space-y-2"
        >
          <div className="flex items-center gap-2 font-medium text-sm">
            <span>
              {task.status === 'QUEUED'
                ? 'Bài viết đang nằm trong hàng đợi chấm điểm.'
                : 'Bài viết đang được hệ thống xử lý chấm điểm.'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {task.reasonCode && ALLOWED_REASON_CODES.has(task.reasonCode)
              ? mapReasonCodeToMessage(task.reasonCode)
              : 'Vui lòng bấm nút "Cập nhật nhận xét" phía trên để kiểm tra kết quả khi hoàn tất.'}
          </p>
        </div>
      )}

      {/* Case 3: FAILED / UNAVAILABLE status */}
      {(task.status === 'FAILED' || task.status === 'UNAVAILABLE') && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm text-foreground">
            <span>{getTaskStatusLabel(task.status)}</span>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {task.reasonCode === 'UNSUPPORTED_LANGUAGE' && task.language?.split('-')[0].toLowerCase() === 'vi'
              ? 'Chưa hỗ trợ chấm Writing tiếng Việt.'
              : mapReasonCodeToMessage(task.reasonCode)}
          </p>
        </div>
      )}
    </article>
  );
};
