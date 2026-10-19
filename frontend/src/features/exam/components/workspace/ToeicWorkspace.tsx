import React, { useEffect, useMemo, useRef } from 'react';
import type { AnswerValue } from '../../types/answer.types';
import type { Question } from '../../types/exam.types';
import type { TestMode, WorkspaceListeningPlaybackSummary } from '../../types/api.types';
import type { PracticeFeedbackController } from '../../hooks/usePracticeFeedback';
import { useListeningPlayback } from '../../hooks/useListeningPlayback';
import { useToeicWorkspaceNavigation } from '../../hooks/useToeicWorkspaceNavigation';
import { buildToeicWorkspaceModel, type ToeicWorkspaceModel } from '../../utils/toeicWorkspaceModel';
import AudioPlayer from '../AudioPlayer';
import MediaDisplay from '../content/MediaDisplay';
import WorkspaceFrame from './WorkspaceFrame';
import ListeningPartContent, { type ListeningGroupView } from './ListeningPartContent';

export interface ToeicWorkspaceProps {
  attemptId: number;
  /** Raw Part from the workspace snapshot. */
  part: any;
  partId: number;
  partTitle: string;
  partInstruction?: string | null;
  partSharedAudio?: { url?: string | null } | null;
  partSharedMedia?: { url?: string | null } | null;
  /** Workspace exam snapshot; feeds the TW-05 view model (Part + whole-exam question numbers). */
  snapshot: unknown;
  /** Normalized groups in server order (the shape WorkspacePage already builds). */
  groups: any[];
  /** Flattened normalized questions in server order. */
  questions: Question[];
  answers?: Record<string, AnswerValue> | null;
  flags?: Record<string, boolean> | null;
  disabled?: boolean;
  practice?: boolean;
  testMode: TestMode;
  listeningPlayback?: WorkspaceListeningPlaybackSummary;
  practiceFeedback: PracticeFeedbackController;
  /** Practice-only toolbar (blocked notice + retry controls) built by WorkspacePage. */
  practiceTools?: React.ReactNode;
  /** A palette/part-switcher request to show a specific question. */
  requestedQuestionId?: string | null;
  /** Reports the currently active question so the shared palette can mark it (aria-current). */
  onActiveQuestionChange?: (questionId: string | null) => void;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onToggleFlag: (questionId: string) => void;
}

function readUrl(node: any): string | null {
  if (!node) return null;
  const url = typeof node.url === 'string' ? node.url : typeof node === 'string' ? node : null;
  return url && url.trim().length > 0 ? url : null;
}

function readGroupMediaUrl(node: any): string | null {
  const media = node?.shared_media ?? node?.sharedMedia ?? null;
  return readUrl(media);
}

/**
 * TOEIC Listening workspace (Part 1–4). Owns the view model binding, the active question and the
 * single mode-aware audio element; WorkspacePage keeps owning autosave/submit/lock/palette.
 */
const ToeicWorkspace: React.FC<ToeicWorkspaceProps> = ({
  attemptId,
  part,
  partId,
  partTitle,
  partInstruction,
  partSharedAudio,
  partSharedMedia,
  snapshot,
  groups,
  questions,
  answers,
  flags,
  disabled = false,
  practice = false,
  testMode,
  listeningPlayback,
  practiceFeedback,
  practiceTools,
  requestedQuestionId,
  onActiveQuestionChange,
  onAnswer,
  onToggleFlag,
}) => {
  // Whole-exam view model: Part number and canonical whole-exam question numbers.
  const fullModel = useMemo(() => buildToeicWorkspaceModel(snapshot), [snapshot]);
  const modelPart = useMemo(
    () => fullModel.parts.find(candidate => candidate.partId === partId) ?? null,
    [fullModel, partId]
  );
  const partNumber = modelPart?.partNumber ?? null;

  const questionNumbers = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of fullModel.questions) {
      if (question.partId === partId && question.questionNumber !== null) {
        map.set(question.questionId, question.questionNumber);
      }
    }
    return map;
  }, [fullModel, partId]);

  // Part-scoped model for the navigation hook: previous/next never leaves the current Part.
  const partModel = useMemo<ToeicWorkspaceModel>(
    () => ({
      parts: fullModel.parts.filter(candidate => candidate.partId === partId),
      questions: fullModel.questions.filter(question => question.partId === partId),
      valid: true,
      issues: [],
    }),
    [fullModel, partId]
  );

  const navigation = useToeicWorkspaceNavigation({ attemptId, model: partModel });
  const { activeQuestionId, navigateToQuestion } = navigation;

  useEffect(() => {
    if (requestedQuestionId) navigateToQuestion(requestedQuestionId);
  }, [requestedQuestionId, navigateToQuestion]);

  // Publish the active question to the shared palette (aria-current) while this workspace owns the
  // TOEIC navigation state, and clear it on unmount so a stale Part cannot stay highlighted.
  useEffect(() => {
    onActiveQuestionChange?.(activeQuestionId);
  }, [activeQuestionId, onActiveQuestionChange]);

  useEffect(() => () => onActiveQuestionChange?.(null), [onActiveQuestionChange]);

  const groupViews = useMemo<ListeningGroupView[]>(
    () =>
      groups.map((group: any) => ({
        groupId: String(group.group_id ?? group.groupId ?? ''),
        instruction: group.instruction ?? null,
        mediaUrl: readGroupMediaUrl(group),
        questions: (group.questions ?? []).map((question: Question) => ({
          question,
          number: questionNumbers.get(question.question_id) ?? question.question_number ?? null,
          value: answers?.[question.question_id] ?? null,
          flagged: Boolean(flags?.[question.question_id]),
        })),
      })),
    [groups, questionNumbers, answers, flags]
  );

  const groupAudioUrl = useMemo(
    () => groups.map((group: any) => readUrl(group?.shared_audio ?? group?.sharedAudio)).find(Boolean) ?? null,
    [groups]
  );
  const practiceAudioUrl = readUrl(partSharedAudio) ?? groupAudioUrl;
  const partMediaUrl = readUrl(partSharedMedia);

  const mediaRef = useRef<HTMLMediaElement | null>(null);

  const mockEnabled = testMode === 'MOCK_TEST' && listeningPlayback?.available === true;
  const playback = useListeningPlayback({
    attemptId,
    mode: testMode,
    enabled: mockEnabled,
    url: practiceAudioUrl,
    mediaRef,
  });

  const bindMedia = playback.bindMedia;

  const renderAudioHeader = () => {
    if (testMode === 'MOCK_TEST') {
      if (!mockEnabled) {
        return (
          <div data-testid="toeic-audio-unavailable" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
            Audio không khả dụng cho lượt thi này.
          </div>
        );
      }
      if (playback.status === 'NOT_STARTED' && playback.canStart) {
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-white p-3">
            <span className="text-xs text-slate-600">Audio chỉ bắt đầu một lần và phát liên tục theo thời gian thi.</span>
            <button
              type="button"
              onClick={() => void playback.start()}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              Bắt đầu phát audio
            </button>
          </div>
        );
      }
      if (playback.activeTrack) {
        return (
          <div data-testid="toeic-audio-server" className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <AudioPlayer
              variant="server"
              url={playback.activeTrack.audioUrl}
              isActive
              mediaRef={bindMedia}
              blocked={playback.blocked}
              onResume={() => void playback.resume()}
            />
          </div>
        );
      }
      if (playback.loading) {
        return <div role="status" className="text-xs text-slate-500">Đang tải audio…</div>;
      }
      return (
        <div data-testid="toeic-audio-unavailable" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          Audio không khả dụng cho lượt thi này.
        </div>
      );
    }

    if (practiceAudioUrl) {
      return (
        <div data-testid="toeic-audio-practice" className="rounded-lg border border-slate-200 bg-white p-3">
          <AudioPlayer
            variant="practice"
            url={practiceAudioUrl}
            isActive
            mediaRef={bindMedia}
            speed={playback.speed}
            canRewind
            onRewind={() => playback.rewind(10)}
            onSpeedChange={playback.setSpeed}
          />
        </div>
      );
    }

    return (
      <div data-testid="toeic-audio-unavailable" className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
        Không có audio cho phần này.
      </div>
    );
  };

  if (partNumber === null) return null;
  if (partNumber > 4) return null;

  return (
    <WorkspaceFrame
      instruction={partInstruction}
      toolbar={practiceTools}
      questionsLabel={`Câu hỏi ${partTitle}`}
      header={
        <>
          {renderAudioHeader()}
          {playback.offline && (
            <p role="status" className="text-xs text-amber-700">
              Mất kết nối; audio sẽ tiếp tục theo thời gian thi khi kết nối lại.
            </p>
          )}
          {playback.error && (
            <p role="alert" className="text-xs text-red-700">{playback.error}</p>
          )}
        </>
      }
    >
      {partMediaUrl && !groupViews.some(group => group.mediaUrl) && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <MediaDisplay media={{ type: 'image', url: partMediaUrl, display_config: { size_preset: 'large' } }} alt={`${partTitle} media`} />
        </div>
      )}
      <ListeningPartContent
        partNumber={partNumber}
        partId={partId}
        groups={groupViews}
        disabled={disabled}
        practice={practice}
        feedbackBusy={practiceFeedback.busy}
        getFeedback={practiceFeedback.getFeedback}
        onCheck={practiceFeedback.check}
        onAnswer={onAnswer}
        onToggleFlag={onToggleFlag}
        playingPartNumber={testMode === 'MOCK_TEST' ? playback.activePartNumber : null}
      />
    </WorkspaceFrame>
  );
};

export default ToeicWorkspace;
