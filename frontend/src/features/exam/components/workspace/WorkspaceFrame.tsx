import { examMessage as em } from '../../i18n/examMessages';
import React from 'react';
import WorkspaceText from '../content/WorkspaceText';

export interface WorkspaceFrameProps {
  /** Part instruction callout rendered above the audio/media header. */
  instruction?: string | null;
  /** Practice-only toolbar (blocked notice + retry controls). */
  toolbar?: React.ReactNode;
  /**
   * Sticky top slot for the custom media player and its status. It is intentionally a slot so the
   * frame never renders a second set of audio controls.
   */
  header?: React.ReactNode;
  /** Accessible name of the questions region. */
  questionsLabel?: string;
  children: React.ReactNode;
}

/**
 * Shared TOEIC workspace frame: instruction, sticky media header and the question region.
 * IELTS/general rendering keeps its existing layout and never mounts this frame.
 */
const WorkspaceFrame: React.FC<WorkspaceFrameProps> = ({
  instruction,
  toolbar,
  header,
  questionsLabel = em("Câu hỏi"),
  children,
}) => (
  <div data-testid="toeic-workspace-frame" className="toeic-workspace w-full max-w-3xl mx-auto">
    {instruction && (
      <div
        data-testid="toeic-part-instruction"
        className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-xl p-3.5 text-sm text-slate-700 mb-4"
      >
        <span className="font-bold text-amber-800 block mb-0.5">{em("Hướng dẫn làm bài:")}</span>
        <WorkspaceText source={{ kind: 'PART_INSTRUCTION' }} content={instruction} />
      </div>
    )}

    {toolbar}

    {header && (
      <div
        data-testid="toeic-workspace-header"
        className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm pb-3 mb-4 space-y-2"
      >
        {header}
      </div>
    )}

    <div
      data-testid="toeic-questions"
      role="group"
      aria-label={questionsLabel}
      className="flex flex-col gap-4"
    >
      {children}
    </div>
  </div>
);

export default WorkspaceFrame;
