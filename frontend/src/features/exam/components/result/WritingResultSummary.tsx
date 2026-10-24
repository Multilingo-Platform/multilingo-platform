import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React, { useMemo, useState } from 'react';
import type { ResultSummary } from '../../types/api.types';
import { WritingFeedbackPanel } from './writing/WritingFeedbackPanel';
import { useTranslation } from 'react-i18next';

export interface WritingResultSummaryProps {
  writing: ResultSummary['writing'];
  attemptId?: number | null;
}

export function WritingResultSummary({ writing, attemptId }: WritingResultSummaryProps) {
  useExamLocale();
  if (!writing || !writing.tasks || writing.tasks.length === 0) return null;

  return (
    <WritingResultSummaryContent
      key={typeof attemptId === 'number' ? `attempt-${attemptId}` : 'no-attempt'}
      writing={writing}
      attemptId={attemptId}
    />
  );
}

interface WritingResultSummaryContentProps {
  writing: NonNullable<ResultSummary['writing']>;
  attemptId?: number | null;
}

function WritingResultSummaryContent({ writing, attemptId }: WritingResultSummaryContentProps) {
  useExamLocale();
  const { t } = useTranslation('exam');
  const [openParts, setOpenParts] = useState<Record<number, boolean>>({});
  const [mountedParts, setMountedParts] = useState<Record<number, boolean>>({});

  // Group tasks by partId in order of first appearance
  const partGroups = useMemo(() => {
    const groups: Array<{ partId: number; tasks: typeof writing.tasks }> = [];
    const map = new Map<number, typeof writing.tasks>();

    for (const task of writing.tasks) {
      let group = map.get(task.partId);
      if (!group) {
        group = [];
        map.set(task.partId, group);
        groups.push({ partId: task.partId, tasks: group });
      }
      group.push(task);
    }
    return groups;
  }, [writing.tasks]);

  const togglePart = (partId: number) => {
    setOpenParts(prev => ({
      ...prev,
      [partId]: !prev[partId],
    }));
    setMountedParts(prev => ({
      ...prev,
      [partId]: true,
    }));
  };

  const hasValidAttempt = typeof attemptId === 'number' && Number.isSafeInteger(attemptId) && attemptId > 0;

  return (
    <section aria-label={t('result.writing')} className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{t('result.writing')}</h2>
        <p className="text-sm text-slate-700">{t(`status.${writing.status.toLowerCase()}`)}</p>
      </div>

      <div className="space-y-6">
        {partGroups.map(({ partId, tasks }) => {
          const isOpen = !!openParts[partId];
          const isMounted = !!mountedParts[partId];
          const panelId = `writing-feedback-part-${partId}`;

          return (
            <div key={partId} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">
                  {t('result.part', { partId })}
                </h3>

                {hasValidAttempt && (
                  <button
                    type="button"
                    onClick={() => togglePart(partId)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 cursor-pointer"
                  >
                    {isOpen ? t('result.hideFeedback') : t('result.showFeedback')}
                  </button>
                )}
              </div>

              {/* Tasks cards grid for this part */}
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                {tasks.map(task => (
                  <article
                    key={JSON.stringify([task.partId, task.questionId])}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <h4 className="break-words font-semibold text-sm [overflow-wrap:anywhere]">{task.label}</h4>
                    <p className="mt-1 break-words text-xs text-slate-600 [overflow-wrap:anywhere]">
                      {t('result.question', { partId: task.partId, questionId: task.questionId })}
                    </p>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div>
                        <dt className="text-slate-600">{t('result.status')}</dt>
                        <dd>{t(`status.${task.status.toLowerCase()}`)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">{em("Số từ")}</dt>
                        <dd className="tabular-nums"><span>{task.lengthMetric?.value ?? task.wordCount}</span>{' '}
                          {task.lengthMetric?.unit === 'CHARACTERS' ? em('ký tự') : em('từ')}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">{t('result.score')}</dt>
                        <dd>{task.score === null || task.maxScore === null
                          ? em("Chưa có điểm")
                          : `${task.score} / ${task.maxScore}${task.rubricCode === 'WRITING_GENERIC_V1' ? ` · ${t('writing.practiceScore')}` : ` · ${t('writing.bandScore')}`}`}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {/* Feedback Panel (wrapper present with stable ID and hidden from start for valid ARIA IDREF; panel mounted on first open) */}
              {hasValidAttempt && (
                <div id={panelId} hidden={!isOpen} className="pt-2 border-t border-slate-100">
                  {isMounted && (
                    <WritingFeedbackPanel attemptId={attemptId} partId={partId} isOpen={isOpen} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
