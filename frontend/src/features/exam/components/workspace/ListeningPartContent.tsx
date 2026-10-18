import React from 'react';
import type { AnswerValue } from '../../types/answer.types';
import type { PracticeFeedbackResponse } from '../../types/api.types';
import type { ListeningDetail, Question, SharedMedia } from '../../types/exam.types';
import type { PracticeQuestionFeedback } from '../../hooks/usePracticeFeedback';
import { PracticeQuestionFeedback as PracticeQuestionFeedbackView } from '../practice/PracticeQuestionFeedback';
import MediaDisplay from '../content/MediaDisplay';
import QuestionCard from './QuestionCard';

export interface ListeningQuestionView {
  question: Question;
  /** Canonical whole-exam number, or null when the source provides none. */
  number: number | null;
  value: AnswerValue;
  flagged: boolean;
}

export interface ListeningGroupView {
  groupId: string;
  instruction: string | null;
  /** Group-level reference image (Part 1 photograph, Part 3/4 graphic). */
  mediaUrl: string | null;
  questions: ListeningQuestionView[];
}

export interface ListeningPartContentProps {
  partNumber: number;
  partId: number;
  groups: ListeningGroupView[];
  activeQuestionId: string | null;
  disabled: boolean;
  practice: boolean;
  feedbackBusy: boolean;
  getFeedback: (questionId: string) => PracticeQuestionFeedback;
  onCheck: (questionId: string) => void;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onToggleFlag: (questionId: string) => void;
  onStepQuestion: (delta: number) => void;
  canStepBack: boolean;
  canStepForward: boolean;
  /** Mock only: the Part the server timeline is currently playing. */
  playingPartNumber?: number | null;
}

export interface RevealedListeningDetail {
  transcript: string | null;
  options: Array<{ label: string; text: string }>;
}

/**
 * Reads the listening reveal from the verified practice feedback response.
 * Returns null when the response provides neither a transcript nor spoken option lines,
 * or when feedback has not been validated for this question, so the UI never invents content
 * or leaks transcripts from unverified sources.
 */
export function readListeningDetail(
  feedbackData: PracticeFeedbackResponse | null | undefined,
  questionId: string
): RevealedListeningDetail | null {
  if (!feedbackData) return null;

  let detail: ListeningDetail | null | undefined = null;
  if (feedbackData.questionId === questionId) {
    detail = feedbackData.listeningDetail;
  } else if (Array.isArray(feedbackData.groupResults)) {
    const member = feedbackData.groupResults.find(g => g.questionId === questionId);
    detail = member?.listeningDetail;
  }

  if (!detail || typeof detail !== 'object') return null;

  let transcript: string | null = null;
  const options: Array<{ label: string; text: string }> = [];

  if (typeof detail.transcript === 'string' && detail.transcript.trim().length > 0) {
    transcript = detail.transcript;
  }
  if (Array.isArray(detail.options)) {
    for (const option of detail.options) {
      if (
        option &&
        typeof option === 'object' &&
        typeof (option as { label?: unknown }).label === 'string' &&
        typeof (option as { text?: unknown }).text === 'string'
      ) {
        options.push({ label: (option as { label: string }).label, text: (option as { text: string }).text });
      }
    }
  }

  if (!transcript && options.length === 0) return null;
  return { transcript, options };
}

function asSharedMedia(url: string | null, alt: string): SharedMedia | null {
  if (!url) return null;
  return { type: 'image', url, display_config: { size_preset: 'large' } };
}

/**
 * Listening Part 1–4 content. Part 1 shows one photograph and labels-only options; Part 2 shows the
 * selected question next to the Part the server is playing; Parts 3/4 render each group with its own
 * reference image, one shared player for the whole Part.
 */
const ListeningPartContent: React.FC<ListeningPartContentProps> = ({
  partNumber,
  partId,
  groups,
  activeQuestionId,
  disabled,
  practice,
  feedbackBusy,
  getFeedback,
  onCheck,
  onAnswer,
  onToggleFlag,
  onStepQuestion,
  canStepBack,
  canStepForward,
  playingPartNumber = null,
}) => {
  const labelsOnlyOptions = partNumber === 1 || partNumber === 2;
  const hidePrompt = partNumber === 1 || partNumber === 2;

  const renderCard = (view: ListeningQuestionView) => {
    const feedback = getFeedback(view.question.question_id);
    const revealed = practice && feedback.phase === 'ready';
    const detail = revealed ? readListeningDetail(feedback.data, view.question.question_id) : null;

    return (
      <QuestionCard
        key={view.question.question_id}
        question={view.question}
        partId={partId}
        questionNumber={view.number}
        value={view.value}
        flagged={view.flagged}
        disabled={disabled}
        onAnswer={value => onAnswer(view.question.question_id, value)}
        onToggleFlag={() => onToggleFlag(view.question.question_id)}
        hidePrompt={hidePrompt}
        hideOptionsText={labelsOnlyOptions}
        revealOptions={revealed}
        revealContent={
          detail ? (
            <div
              data-testid={`listening-transcript-${view.question.question_id}`}
              className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1"
            >
              <div className="font-semibold text-slate-800">Nội dung nghe (luyện tập)</div>
              {detail.transcript && <p className="whitespace-pre-wrap">{detail.transcript}</p>}
              {detail.options.map(option => (
                <p key={option.label} className="whitespace-pre-wrap">
                  ({option.label}) {option.text}
                </p>
              ))}
            </div>
          ) : null
        }
        feedbackSlot={
          practice ? (
            <PracticeQuestionFeedbackView
              questionId={view.question.question_id}
              questionNumber={view.number ?? undefined}
              questionType={view.question.type}
              feedback={feedback}
              onCheck={onCheck}
              busy={feedbackBusy}
              disabled={disabled}
            />
          ) : null
        }
      />
    );
  };

  if (partNumber === 1) {
    const activeGroup =
      groups.find(group => group.questions.some(view => view.question.question_id === activeQuestionId)) ??
      groups[0] ??
      null;
    if (!activeGroup) return null;
    return (
      <div className="space-y-4">
        {activeGroup.mediaUrl && (
          <div data-testid="listening-photo" className="rounded-xl border border-slate-200 bg-white p-3">
            <MediaDisplay media={asSharedMedia(activeGroup.mediaUrl, 'Ảnh Part 1')} alt="Ảnh mô tả Part 1" />
          </div>
        )}
        {activeGroup.instruction && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
            {activeGroup.instruction}
          </div>
        )}
        {activeGroup.questions.map(renderCard)}
      </div>
    );
  }

  if (partNumber === 2) {
    const activeView =
      groups.flatMap(group => group.questions).find(view => view.question.question_id === activeQuestionId) ??
      groups[0]?.questions[0] ??
      null;
    return (
      <div className="space-y-3">
        {playingPartNumber !== null && (
          <div
            data-testid="toeic-playback-pill"
            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
          >
            <span aria-hidden="true">🎧</span>
            <span>Part {playingPartNumber}</span>
          </div>
        )}
        <p data-testid="toeic-cue-note" className="text-xs text-slate-500">
          Audio phát liên tục theo Part; câu đang xem không có mốc thời gian riêng.
        </p>
        {activeView && renderCard(activeView)}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => onStepQuestion(-1)}
            disabled={!canStepBack}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            ← Câu trước
          </button>
          <button
            type="button"
            onClick={() => onStepQuestion(1)}
            disabled={!canStepForward}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
          >
            Câu sau →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <section
          key={group.groupId}
          data-testid={`listening-group-${group.groupId}`}
          className="space-y-3"
        >
          {group.instruction && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              {group.instruction}
            </div>
          )}
          {group.mediaUrl && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <MediaDisplay media={asSharedMedia(group.mediaUrl, `${group.groupId} graphic`)} alt={`${group.groupId} graphic`} />
            </div>
          )}
          {group.questions.map(renderCard)}
        </section>
      ))}
    </div>
  );
};

export default ListeningPartContent;
