import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
import type { AnswerValue } from '../../types/answer.types';
import type { Question } from '../../types/exam.types';
import type { PracticeQuestionFeedback } from '../../hooks/usePracticeFeedback';
import { PracticeQuestionFeedback as PracticeQuestionFeedbackView } from '../practice/PracticeQuestionFeedback';
import QuestionCard from './QuestionCard';
import type { ReferenceDoc } from './ReferencePane';

export interface ReadingQuestionView {
  question: Question;
  /** Canonical whole-exam number, or null when the source provides none. */
  number: number | null;
  value: AnswerValue;
  flagged: boolean;
}

export interface ReadingGroupView {
  groupId: string;
  instruction: string | null;
  questions: ReadingQuestionView[];
}

export interface ReadingPartContentProps {
  partId: number;
  groups: ReadingGroupView[];
  partInstruction?: string | null;
  /** Part 6/7: the reference documents live in the left pane, so this pane is questions only. */
  referenceInPane: boolean;
  disabled: boolean;
  practice: boolean;
  feedbackBusy: boolean;
  getFeedback: (questionId: string) => PracticeQuestionFeedback;
  onCheck: (questionId: string) => void;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onToggleFlag: (questionId: string) => void;
  /** Practice-only toolbar (blocked notice + retry controls) built by WorkspacePage. */
  toolbar?: React.ReactNode;
}

function readMediaUrls(node: any): string[] {
  const urls: string[] = [];
  const media = node?.shared_media ?? node?.sharedMedia ?? node?.content?.shared_media ?? node?.content?.sharedMedia;
  if (Array.isArray(media)) {
    for (const item of media) {
      if (typeof item === 'string' && item.trim().length > 0) urls.push(item);
      else if (typeof item?.url === 'string' && item.url.trim().length > 0) urls.push(item.url);
    }
  } else if (typeof media?.url === 'string' && media.url.trim().length > 0) {
    urls.push(media.url);
  }

  const images = node?.shared_images ?? node?.sharedImages ?? node?.content?.shared_images ?? node?.content?.sharedImages;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (typeof image === 'string' && image.trim().length > 0) urls.push(image);
      else if (typeof image?.url === 'string' && image.url.trim().length > 0) urls.push(image.url);
    }
  }
  return Array.from(new Set(urls));
}

/**
 * Collects the left-pane reading documents straight from the source shape, never from invented
 * structure: a whole-part HTML reference becomes one document (Part 7 keeps its group HTML intact),
 * otherwise every question group that carries its own HTML/image becomes one document (Part 6).
 * Content is never split on `<hr>` or other delimiters into fake sub-passages.
 */
export function readReferenceDocs(part: any, groups: any[]): ReferenceDoc[] {
  const partHtml =
    part?.contentHtml ?? part?.content_html ?? part?.content?.content_html ?? part?.content?.shared_content_html ?? null;
  const partMedia = readMediaUrls(part);
  const hasPartHtml = typeof partHtml === 'string' && partHtml.trim().length > 0;

  if (hasPartHtml) {
    const html = partHtml;
    const mediaUrls = partMedia.filter(url => !(html && html.includes(url)));
    return [
      {
        groupId: 'part',
        instruction: part?.instruction ?? part?.content?.instruction ?? null,
        html,
        mediaUrls,
      },
    ];
  }

  const docs: ReferenceDoc[] = [];

  // When part-level media exists without part-level HTML, keep that media as a top-level document
  // so images/diagrams are not lost, while still gathering every group's reading passages.
  if (partMedia.length > 0) {
    docs.push({
      groupId: 'part',
      instruction: part?.instruction ?? part?.content?.instruction ?? null,
      html: null,
      mediaUrls: partMedia,
    });
  }

  (groups ?? []).forEach((group, index) => {
    const rawHtml = group?.content_html ?? group?.context_html ?? null;
    const hasHtml = typeof rawHtml === 'string' && rawHtml.trim().length > 0;
    const html = hasHtml ? rawHtml : null;
    const mediaUrls = readMediaUrls(group).filter(url => !(html && html.includes(url)));
    if (!hasHtml && mediaUrls.length === 0) return;

    docs.push({
      groupId: String(group?.group_id ?? group?.groupId ?? `group-${index + 1}`),
      instruction: group?.instruction ?? null,
      html,
      mediaUrls,
    });
  });
  return docs;
}

/**
 * TOEIC Reading Part 5–7 question column. Part 5 is a single centered column of independent
 * questions; Part 6/7 render their question groups next to the reference pane. Layout follows the
 * groups/content shape, never a skill-only switch, and it reuses the shared question card so lock,
 * flag and Practice feedback keep the same behavior as the listening workspace.
 */
const ReadingPartContent: React.FC<ReadingPartContentProps> = ({
  partId,
  groups,
  partInstruction,
  referenceInPane,
  disabled,
  practice,
  feedbackBusy,
  getFeedback,
  onCheck,
  onAnswer,
  onToggleFlag,
  toolbar,
}) => {
  useExamLocale();
  const renderCard = (view: ReadingQuestionView) => (
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
      feedbackSlot={
        practice ? (
          <PracticeQuestionFeedbackView
            questionId={view.question.question_id}
            questionNumber={view.number ?? undefined}
            questionType={view.question.type}
            feedback={getFeedback(view.question.question_id)}
            onCheck={onCheck}
            busy={feedbackBusy}
            disabled={disabled}
          />
        ) : null
      }
    />
  );

  const renderGroups = () =>
    groups.map(group => (
      <section
        key={group.groupId}
        data-testid={`reading-group-${group.groupId}`}
        className="space-y-4"
      >
        {group.instruction && (
          <div className="p-3.5 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl text-sm text-slate-700">
            {group.instruction}
          </div>
        )}
        {group.questions.map(renderCard)}
      </section>
    ));

  const instructionCallout = partInstruction ? (
    <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl p-3.5 text-sm text-slate-700">
      <span className="font-bold text-amber-800 block mb-0.5">{em("Hướng dẫn làm bài:")}</span>
      {partInstruction}
    </div>
  ) : null;

  if (!referenceInPane) {
    return (
      <div
        data-testid="toeic-reading-single-column"
        className="toeic-workspace w-full max-w-[840px] mx-auto flex flex-col gap-4"
      >
        {toolbar}
        {instructionCallout}
        {renderGroups()}
      </div>
    );
  }

  return (
    <div
      data-testid="toeic-reading-questions"
      className="toeic-workspace w-full max-w-3xl mx-auto flex flex-col gap-4"
    >
      {toolbar}
      {instructionCallout}
      {renderGroups()}
    </div>
  );
};

export default ReadingPartContent;
