import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer, { initialState, setAnswer } from '../store/answerSlice';
import ToeicWorkspace from '../components/workspace/ToeicWorkspace';
import WorkspacePage from '../pages/WorkspacePage';
import { usePracticeFeedback } from '../hooks/usePracticeFeedback';
import type { PracticeFeedbackController } from '../hooks/usePracticeFeedback';
import * as workspaceHookModule from '../hooks/useWorkspace';
import { useAutosave } from '../hooks/useAutosave';
import { getListeningPlayback, startListeningPlayback } from '../api/listeningPlaybackApi';
import { checkPracticeAnswer } from '../api/attemptApi';
import type { AnswerValue } from '../types/answer.types';
import type { Question } from '../types/exam.types';
import type {
  PracticeFeedbackResponse,
  WorkspaceListeningPlaybackSummary,
  WorkspaceResponse,
} from '../types/api.types';

vi.mock('../api/listeningPlaybackApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/listeningPlaybackApi')>();
  return { ...actual, getListeningPlayback: vi.fn(), startListeningPlayback: vi.fn() };
});
vi.mock('../api/attemptApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../api/attemptApi')>();
  return { ...actual, checkPracticeAnswer: vi.fn() };
});
vi.mock('../hooks/useWorkspace');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

const TRACK = {
  partId: '12',
  partNumber: 2,
  audioUrl: 'https://cdn.example.test/part2.mp3',
  durationMs: 60000,
  startOffsetMs: 0,
};

function playbackSnapshot(status: 'NOT_STARTED' | 'RUNNING') {
  return {
    attemptId: 42,
    status,
    serverTime: '2026-10-18T00:00:00Z',
    startedAt: status === 'RUNNING' ? '2026-10-18T00:00:00Z' : null,
    activePartId: '12',
    activePartNumber: 2,
    positionMs: 0,
    elapsedMs: 0,
    remainingMs: 60000,
    totalDurationMs: 60000,
    tracks: [TRACK],
  };
}

function correctFeedback(questionId = 'q_007'): PracticeFeedbackResponse {
  return {
    attemptId: 42,
    partId: 12,
    questionId,
    type: 'SINGLE_CHOICE',
    userAnswer: 'A',
    verdict: 'CORRECT',
    score: 1,
    correctAnswer: 'A',
    explanation: 'Vì đáp án A đúng.',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  vi.mocked(getListeningPlayback).mockResolvedValue(playbackSnapshot('NOT_STARTED') as never);
  vi.mocked(startListeningPlayback).mockResolvedValue(playbackSnapshot('RUNNING') as never);
  vi.mocked(checkPracticeAnswer).mockResolvedValue(correctFeedback());
  vi.mocked(useAutosave).mockReturnValue({
    pauseAndWait: vi.fn().mockResolvedValue({ status: 'ready' }),
    resume: vi.fn(),
    draftWarning: null,
  } as never);
});
afterEach(() => cleanup());

const PHOTO_ONE = 'https://cdn.example.test/p1-photo-1.png';
const PHOTO_THREE = 'https://cdn.example.test/p3-graphic.png';

interface GroupInput {
  groupId: string;
  questions: string[];
  mediaUrl?: string | null;
  optionText?: string[];
  questionText?: string;
  listeningDetail?: Record<string, unknown> | null;
}

function normalizeQuestionLike(raw: any, fallback: number): Question {
  return {
    ...raw,
    question_id: raw.question_id ?? raw.questionId ?? String(raw.id),
    question_number: raw.question_number ?? fallback,
    type: raw.type === 'MCQ' ? 'SINGLE_CHOICE' : raw.type,
    question_text: raw.question_text || '',
    options: raw.options ?? null,
    media: raw.media ?? null,
  } as Question;
}

/** Builds normalized groups/questions exactly like WorkspacePage, plus the raw Part + snapshot. */
function buildPart(partNumber: number, partId: number, groups: GroupInput[]) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const rawGroups = groups.map(group => ({
    group_id: group.groupId,
    instruction: null,
    shared_audio: null,
    shared_media: group.mediaUrl ? { type: 'image', url: group.mediaUrl } : null,
    content_html: null,
    questions: group.questions.map(questionId => ({
      question_id: questionId,
      type: 'SINGLE_CHOICE',
      question_text: group.questionText ?? '',
      options: (group.optionText ?? []).map((text, index) => ({ id: letters[index], text })),
      media: null,
      ...(group.listeningDetail ? { listening_detail: group.listeningDetail } : {}),
    })),
  }));

  let number = 1;
  const normalizedGroups = rawGroups.map(group => ({
    ...group,
    questions: group.questions.map(question => normalizeQuestionLike(question, number++)),
  }));
  const questions = normalizedGroups.flatMap(group => group.questions);

  const part = {
    id: partId,
    part_number: partNumber,
    title: `Part ${partNumber}`,
    instruction: `Instruction for Part ${partNumber}`,
    shared_audio: null,
    question_groups: rawGroups,
  };
  const snapshot = {
    exam_id: 1,
    code: 'TOEIC-TEST',
    title: 'TOEIC Test',
    type: 'TOEIC',
    sections: [{ id: 900 + partNumber, skill_type: 'LISTENING', title: 'Listening', parts: [part] }],
  };
  return { part, snapshot, groups: normalizedGroups, questions };
}

function makeController(overrides: Partial<PracticeFeedbackController> = {}): PracticeFeedbackController {
  return {
    busy: false,
    blockedMessage: null,
    wrongQuestionIds: [],
    getFeedback: () => ({ phase: 'idle', data: null, error: null }),
    check: vi.fn().mockResolvedValue(undefined),
    hideFeedback: vi.fn(),
    suspend: vi.fn(),
    ...overrides,
  };
}

interface BuildPropsInput {
  partNumber?: number;
  groups?: GroupInput[];
  testMode?: 'MOCK_TEST' | 'PRACTICE';
  listeningPlayback?: WorkspaceListeningPlaybackSummary;
  practiceFeedback?: PracticeFeedbackController;
  disabled?: boolean;
  answers?: Record<string, AnswerValue>;
  flags?: Record<string, boolean>;
  partSharedAudio?: { url: string } | null;
  requestedQuestionId?: string | null;
}

function buildProps(input: BuildPropsInput = {}) {
  const partNumber = input.partNumber ?? 1;
  const partId = 10 + partNumber;
  const groups = input.groups ?? [{ groupId: `p${partNumber}-g1`, questions: ['q_001'] }];
  const built = buildPart(partNumber, partId, groups);
  const onAnswer = vi.fn();
  const onToggleFlag = vi.fn();
  const props = {
    attemptId: 42,
    part: built.part,
    partId,
    partTitle: `Part ${partNumber}`,
    partInstruction: `Instruction for Part ${partNumber}`,
    partSharedAudio: input.partSharedAudio ?? null,
    partSharedMedia: null,
    snapshot: built.snapshot,
    groups: built.groups,
    questions: built.questions,
    answers: input.answers ?? {},
    flags: input.flags ?? {},
    disabled: input.disabled ?? false,
    practice: (input.testMode ?? 'PRACTICE') === 'PRACTICE',
    testMode: input.testMode ?? ('PRACTICE' as const),
    listeningPlayback: input.listeningPlayback,
    practiceFeedback: input.practiceFeedback ?? makeController(),
    requestedQuestionId: input.requestedQuestionId ?? null,
    onAnswer,
    onToggleFlag,
  };
  return { props, onAnswer, onToggleFlag, built, partId };
}

function renderWorkspace(input: BuildPropsInput = {}) {
  const built = buildProps(input);
  const view = render(<ToeicWorkspace {...built.props} />);
  return { ...built, ...view };
}

const MOCK_AVAILABLE: WorkspaceListeningPlaybackSummary = { status: 'NOT_STARTED', available: true };

describe('ToeicListeningWorkspace', () => {
  it('TC_TWF_01: Part 1 renders every photograph and question in server order without exposing spoken text', () => {
    const { container } = renderWorkspace({
      partNumber: 1,
      groups: Array.from({ length: 6 }, (_, index) => ({
        groupId: `p1-g${index + 1}`,
        questions: [`q_00${index + 1}`],
        mediaUrl: `https://cdn.example.test/part1-photo-${index + 1}.png`,
        questionText: `Spoken statement ${index + 1}`,
        optionText: ['', '', '', ''],
      })),
      testMode: 'MOCK_TEST',
    });

    expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(6);
    expect(screen.getAllByTestId(/^listening-photo-/)).toHaveLength(6);
    expect(container.querySelectorAll('img')).toHaveLength(6);
    expect(screen.getAllByRole('radio')).toHaveLength(24);
    expect(screen.queryByText('Spoken statement 1')).toBeNull();
    expect(container.textContent).not.toMatch(/spoken/i);
  });

  it('TC_TWF_02: Part 2 renders all 25 questions without previous/next controls', async () => {
    const questionIds = Array.from({ length: 25 }, (_, index) => `q_${String(index + 7).padStart(3, '0')}`);
    renderWorkspace({
      partNumber: 2,
      groups: [
        {
          groupId: 'p2-g1',
          questions: questionIds,
          optionText: ['', '', ''],
          questionText: 'Where is the meeting?',
        },
      ],
      testMode: 'MOCK_TEST',
      listeningPlayback: { status: 'RUNNING', available: true },
    });

    const cards = await screen.findAllByTestId(/^listening-question-/);
    expect(cards).toHaveLength(25);
    expect(cards.map(card => card.getAttribute('data-question-id'))).toEqual(questionIds);
    expect(screen.getAllByRole('radio')).toHaveLength(75);
    expect(screen.queryByRole('button', { name: /câu trước/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /câu sau/i })).toBeNull();
    expect(screen.queryByText('Where is the meeting?')).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('toeic-playback-pill').textContent).toMatch(/Part 2/);
    });
    expect(screen.getByTestId('toeic-cue-note')).toBeDefined();
  });

  it('TC_TW_LS_03: Part 3 renders each group with its media once and a single audio element', () => {
    const { container } = renderWorkspace({
      partNumber: 3,
      groups: [
        { groupId: 'p3-g1', questions: ['q_032', 'q_033', 'q_034'], mediaUrl: PHOTO_THREE },
        { groupId: 'p3-g2', questions: ['q_035', 'q_036', 'q_037'], mediaUrl: 'https://cdn.example.test/p3-graphic-2.png' },
      ],
      partSharedAudio: { url: 'https://cdn.example.test/part3.mp3' },
    });

    expect(screen.getByTestId('listening-group-p3-g1')).toBeDefined();
    expect(screen.getByTestId('listening-group-p3-g2')).toBeDefined();
    expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(6);
    expect(container.querySelectorAll(`img[src="${PHOTO_THREE}"]`)).toHaveLength(1);
    expect(container.querySelectorAll('audio')).toHaveLength(1);
    expect(screen.getByTestId('toeic-audio-practice')).toBeDefined();
  });

  it('TC_TW_LS_04: Part 4 renders the group graphic and its three questions', () => {
    const { container } = renderWorkspace({
      partNumber: 4,
      groups: [
        { groupId: 'p4-g1', questions: ['q_071', 'q_072', 'q_073'], mediaUrl: 'https://cdn.example.test/p4-graphic.png' },
      ],
    });

    expect(screen.getByTestId('listening-group-p4-g1')).toBeDefined();
    expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(3);
    expect(container.querySelector('img[src="https://cdn.example.test/p4-graphic.png"]')).not.toBeNull();
  });

  it('TC_TW_LS_05: Mock DOM never contains a transcript or spoken option text', async () => {
    const { container } = renderWorkspace({
      partNumber: 2,
      groups: [
        {
          groupId: 'p2-g1',
          questions: ['q_007'],
          optionText: ['SPOKEN OPTION A (In the room)', 'SPOKEN OPTION B (Tomorrow)', 'SPOKEN OPTION C (Yes, I did)'],
          questionText: 'Where is the meeting?',
          listeningDetail: { transcript: 'SPOKEN SECRET TRANSCRIPT' },
        },
      ],
      testMode: 'MOCK_TEST',
      listeningPlayback: MOCK_AVAILABLE,
    });

    await waitFor(() => expect(screen.getByRole('button', { name: /bắt đầu phát audio/i })).toBeDefined());
    expect(container.textContent).not.toMatch(/SPOKEN SECRET TRANSCRIPT/);
    expect(container.textContent).not.toMatch(/SPOKEN OPTION/);
    expect(container.innerHTML).not.toMatch(/SPOKEN OPTION/);
    screen.getAllByRole('radio').forEach(radio => {
      expect(radio.getAttribute('aria-label')).not.toMatch(/SPOKEN OPTION/);
    });
    expect(screen.queryByTestId(/^listening-transcript-/)).toBeNull();
  });

  it('TC_TW_LS_06: Mock starts once from a user action and hides native controls', async () => {
    const getSpy = vi.mocked(getListeningPlayback);
    const startSpy = vi.mocked(startListeningPlayback);

    const { container } = renderWorkspace({
      partNumber: 2,
      groups: [{ groupId: 'p2-g1', questions: ['q_007'], optionText: ['', '', ''] }],
      testMode: 'MOCK_TEST',
      listeningPlayback: MOCK_AVAILABLE,
    });

    const startButton = await screen.findByRole('button', { name: /bắt đầu phát audio/i });
    expect(getSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(startButton);

    await waitFor(() => expect(startSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const audio = container.querySelector('audio');
      expect(audio).not.toBeNull();
      expect(audio!.hasAttribute('controls')).toBe(false);
      expect(audio!.getAttribute('controlslist')).toContain('nodownload');
    });
    expect(screen.queryByRole('button', { name: /tua lại 10 giây/i })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('TC_TW_LS_07: Practice reveals the transcript only when the feedback response provides it, not from snapshot', async () => {
    vi.mocked(checkPracticeAnswer).mockResolvedValueOnce({
      ...correctFeedback('q_007'),
      listeningDetail: { transcript: 'Is the room ready? Yes, it is.' },
    });

    const { props, built, partId } = buildProps({
      partNumber: 2,
      groups: [
        {
          groupId: 'p2-g1',
          questions: ['q_007'],
          optionText: ['Yes, it is.', 'No, thanks.', 'Not yet.'],
          questionText: 'Is the room ready?',
          // Snapshot does not provide transcript
        },
      ],
    });
    const harness = renderPracticeHarness(props, partId, built.questions);

    expect(screen.queryByTestId('listening-transcript-q_007')).toBeNull();

    await act(async () => {
      await harness.controller.check('q_007');
    });

    await waitFor(() => expect(screen.getByTestId('listening-transcript-q_007')).toBeDefined());
    expect(screen.getByTestId('listening-transcript-q_007').textContent).toMatch(/Is the room ready\? Yes, it is\./);
  });

  it('TC_TW_LS_07b: Practice does not reveal transcript if feedback response omits it, even when snapshot has one', async () => {
    // Response omits listeningDetail
    vi.mocked(checkPracticeAnswer).mockResolvedValueOnce(correctFeedback('q_007'));

    const { props, built, partId } = buildProps({
      partNumber: 2,
      groups: [
        {
          groupId: 'p2-g1',
          questions: ['q_007'],
          optionText: ['Yes, it is.', 'No, thanks.', 'Not yet.'],
          questionText: 'Is the room ready?',
          // Snapshot contains transcript!
          listeningDetail: { transcript: 'SNAPSHOT SECRET TRANSCRIPT' },
        },
      ],
    });
    const harness = renderPracticeHarness(props, partId, built.questions);

    await act(async () => {
      await harness.controller.check('q_007');
    });

    await waitFor(() => expect(screen.getByText('Chính xác')).toBeDefined());
    // Must NOT reveal transcript from snapshot
    expect(screen.queryByTestId('listening-transcript-q_007')).toBeNull();
    expect(screen.queryByTestId(/^listening-transcript-/)).toBeNull();
  });

  it('TC_TW_LS_08: Practice does not reveal a transcript when neither response nor snapshot has listening detail', async () => {
    const { props, built, partId } = buildProps({
      partNumber: 2,
      groups: [{ groupId: 'p2-g1', questions: ['q_007'], optionText: ['Yes', 'No', 'Maybe'], questionText: 'Is the room ready?' }],
    });
    const harness = renderPracticeHarness(props, partId, built.questions);

    await act(async () => {
      await harness.controller.check('q_007');
    });

    await waitFor(() => expect(screen.getByText('Chính xác')).toBeDefined());
    expect(screen.queryByTestId(/^listening-transcript-/)).toBeNull();
  });

  it('TC_TW_LS_09: changing the answer invalidates the revealed feedback state', async () => {
    vi.mocked(checkPracticeAnswer).mockResolvedValueOnce({
      ...correctFeedback('q_007'),
      listeningDetail: { transcript: 'Is the room ready? Yes, it is.' },
    });
    const { props, built, partId } = buildProps({
      partNumber: 2,
      groups: [
        {
          groupId: 'p2-g1',
          questions: ['q_007'],
          optionText: ['Yes, it is.', 'No, thanks.', 'Not yet.'],
          questionText: 'Is the room ready?',
        },
      ],
    });
    const harness = renderPracticeHarness(props, partId, built.questions, { q_007: 'A' });

    await act(async () => {
      await harness.controller.check('q_007');
    });
    await waitFor(() => expect(screen.getByTestId('listening-transcript-q_007')).toBeDefined());

    fireEvent.click(screen.getByRole('radio', { name: 'No, thanks.' }));

    await waitFor(() => expect(screen.queryByTestId('listening-transcript-q_007')).toBeNull());
  });

  it('TC_TW_LS_10: the flag control is labelled Đánh dấu and reflects the stored flag', () => {
    const first = renderWorkspace({
      partNumber: 3,
      groups: [{ groupId: 'p3-g1', questions: ['q_032'] }],
    });
    const flag = screen.getByTestId('flag-btn-q_032');
    expect(flag.textContent).toMatch(/Đánh dấu/);
    expect(flag.textContent).not.toMatch(/Xem lại/);
    fireEvent.click(flag);
    expect(first.onToggleFlag).toHaveBeenCalledWith('q_032');
    first.unmount();

    renderWorkspace({
      partNumber: 3,
      groups: [{ groupId: 'p3-g1', questions: ['q_032'] }],
      flags: { q_032: true },
    });
    expect(screen.getByTestId('flag-btn-q_032').textContent).toMatch(/Đã đánh dấu/);
  });

  it('TC_TW_LS_11: answers stay disabled while the section is locked or submitting', () => {
    renderWorkspace({
      partNumber: 1,
      groups: [{ groupId: 'p1-g1', questions: ['q_001'], mediaUrl: PHOTO_ONE, optionText: ['', '', '', ''] }],
      disabled: true,
    });

    expect(screen.getByTestId('listening-answer-fieldset-q_001')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Lựa chọn A' })).toBeDisabled();
    expect(screen.getByTestId('flag-btn-q_001')).toBeDisabled();
  });

  it('TC_TWF_03: selecting another active Part 2 question keeps every rendered card in the DOM', async () => {
    const { props, rerender } = renderWorkspace({
      partNumber: 2,
      groups: [{ groupId: 'p2-g1', questions: ['q_007', 'q_008', 'q_009'], optionText: ['', '', ''] }],
    });

    expect(screen.getByTestId('listening-question-q_007')).toBeDefined();
    expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(3);
    rerender(<ToeicWorkspace {...props} requestedQuestionId="q_008" />);
    await waitFor(() => expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(3));
    expect(screen.getByTestId('listening-question-q_007')).toBeDefined();
    expect(screen.getByTestId('listening-question-q_008')).toBeDefined();
    expect(screen.getByTestId('listening-question-q_009')).toBeDefined();
  });

  it('TC_TW_LS_13: audio unavailable is stated without inventing a player', () => {
    renderWorkspace({
      partNumber: 3,
      groups: [{ groupId: 'p3-g1', questions: ['q_032'] }],
      testMode: 'MOCK_TEST',
      listeningPlayback: { status: 'UNAVAILABLE', available: false },
    });

    expect(screen.getByTestId('toeic-audio-unavailable')).toBeDefined();
    expect(screen.queryByRole('button', { name: /bắt đầu phát audio/i })).toBeNull();
  });
});

/** WorkspacePage integration: the TOEIC listening branch must not disturb the generic renderer. */
function toeicWorkspaceResponse(
  snapshot: unknown,
  testMode: 'MOCK_TEST' | 'PRACTICE' = 'MOCK_TEST',
): WorkspaceResponse {
  return {
    attempt_id: 99,
    status: 'IN_PROGRESS',
    test_scope: 'SINGLE_PART',
    test_mode: testMode,
    startTime: '2026-10-18T00:00:00Z',
    deadline: null,
    serverTime: '2026-10-18T00:00:00Z',
    gracePeriodSeconds: 15,
    lockedSections: [],
    exam_snapshot: snapshot as WorkspaceResponse['exam_snapshot'],
    version: 1,
    saved_answers: [],
    serverTimeOffset: 0,
  } as unknown as WorkspaceResponse;
}

function renderWorkspacePage(workspace: WorkspaceResponse) {
  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState: { answers: { ...initialState, attemptId: 99, version: 1 } },
  });
  vi.mocked(workspaceHookModule.default).mockReturnValue({
    workspace,
    loading: false,
    error: null,
    ready: true,
    retry: vi.fn(),
    refreshing: false,
    refreshError: null,
    refreshMetadata: vi.fn().mockResolvedValue(true),
  } as never);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/99/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('WorkspacePage TOEIC listening branch', () => {
  it('TC_TW_LS_14: mounts the TOEIC workspace frame for a TOEIC listening part', async () => {
    const part = {
      id: 12,
      part_number: 2,
      title: 'Part 2',
      instruction: 'Instruction for Part 2',
      questionGroups: [
        {
          group_id: 'p2-g1',
          instruction: null,
          shared_audio: null,
          shared_media: null,
          questions: [
            {
              question_id: 'q_007',
              type: 'SINGLE_CHOICE',
              question_text: '',
              options: [
                { id: 'A', text: '' },
                { id: 'B', text: '' },
                { id: 'C', text: '' },
              ],
              media: null,
            },
          ],
        },
      ],
    };
    const snapshot = {
      exam_id: 1,
      code: 'TOEIC-TEST',
      title: 'TOEIC',
      type: 'TOEIC',
      sections: [{ id: 902, skill_type: 'LISTENING', title: 'Listening', parts: [part] }],
    };

    renderWorkspacePage(toeicWorkspaceResponse(snapshot));

    expect(await screen.findByTestId('toeic-workspace-frame')).toBeDefined();
    expect(screen.queryByTestId(/^question-group-/)).toBeNull();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0].getAttribute('aria-label')).toBe('Lựa chọn A');
  });

  it('TC_TW_LS_15: keeps the generic renderer for a non-TOEIC snapshot', async () => {
    const part = {
      id: 7,
      part_number: 2,
      title: 'Part 2',
      instruction: 'Instruction',
      questionGroups: [
        {
          group_id: 'g1',
          questions: [
            {
              question_id: 'q1',
              type: 'SINGLE_CHOICE',
              question_text: 'Prompt',
              options: [{ id: 'A', text: 'Option A' }],
              media: null,
            },
          ],
        },
      ],
    };
    const snapshot = {
      exam_id: 2,
      code: 'IELTS-X',
      title: 'IELTS',
      type: 'IELTS',
      sections: [{ id: 1, skill_type: 'READING', title: 'Reading', parts: [part] }],
    };

    renderWorkspacePage(toeicWorkspaceResponse(snapshot));

    expect(await screen.findByTestId('question-group-g1')).toBeDefined();
    expect(screen.queryByTestId('toeic-workspace-frame')).toBeNull();
  });

  it('TC_TWF_04: palette navigation keeps every Part 2 question rendered and updates aria-current', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    const part = {
      id: 12,
      part_number: 2,
      title: 'Part 2',
      instruction: 'Instruction',
      questionGroups: [
        {
          group_id: 'g1',
          questions: [
            { question_id: 'q_007', type: 'SINGLE_CHOICE', question_text: 'Prompt 7', options: [{ id: 'A', text: 'Option A' }] },
            { question_id: 'q_008', type: 'SINGLE_CHOICE', question_text: 'Prompt 8', options: [{ id: 'A', text: 'Option A' }] },
          ],
        },
      ],
    };
    const snapshot = {
      exam_id: 1,
      code: 'TOEIC-TEST',
      title: 'TOEIC',
      type: 'TOEIC',
      sections: [{ id: 902, skill_type: 'LISTENING', title: 'Listening', parts: [part] }],
    };

    try {
      renderWorkspacePage(toeicWorkspaceResponse(snapshot));

      expect(await screen.findByTestId('toeic-workspace-frame')).toBeDefined();
      expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(2);
      expect(screen.getByTestId('palette-q_007')).toHaveAttribute('aria-current', 'true');
      expect(screen.getByTestId('palette-q_008')).not.toHaveAttribute('aria-current');

      fireEvent.click(screen.getByTestId('palette-q_008'));

      await waitFor(() => expect(screen.getByTestId('palette-q_008')).toHaveAttribute('aria-current', 'true'));
      expect(screen.getByTestId('palette-q_007')).not.toHaveAttribute('aria-current', 'true');
      expect(screen.getAllByTestId(/^listening-question-/)).toHaveLength(2);
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it('TWR-F6: real workspace keeps its media binding after timeline renders, pauses offline and resumes on the new track', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    const ready = vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(1);
    const second = {
      ...TRACK, partId: '13', partNumber: 3, audioUrl: 'https://media.test/next.mp3',
      startOffsetMs: 6000, durationMs: 54000,
    };
    const initial = {
      ...playbackSnapshot('RUNNING'), elapsedMs: 5000, positionMs: 5000, remainingMs: 55000,
      tracks: [{ ...TRACK, durationMs: 6000 }, second],
    };
    vi.mocked(getListeningPlayback).mockResolvedValueOnce(initial as never).mockResolvedValueOnce({
      ...initial, elapsedMs: 7000, positionMs: 1000, activePartId: '13', activePartNumber: 3,
    } as never);
    const playedUrls: string[] = [];
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(function(this: HTMLMediaElement) {
      playedUrls.push(this.src);
      return Promise.resolve();
    });
    const view = renderWorkspace({
      partNumber: 2, testMode: 'MOCK_TEST', listeningPlayback: MOCK_AVAILABLE,
      groups: [{ groupId: 'p2-g1', questions: ['q_007', 'q_008'] }],
    });
    try {
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      const audio = view.container.querySelector('audio')!;
      expect(playedUrls).toContain(TRACK.audioUrl);
      vi.mocked(audio.pause).mockClear();
      act(() => window.dispatchEvent(new Event('offline')));
      expect(audio.pause).toHaveBeenCalled();
      act(() => window.dispatchEvent(new Event('online')));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(view.container.querySelector('audio')).toBe(audio);
      expect(audio.getAttribute('src')).toBe(second.audioUrl);
      expect(playedUrls).toContain(second.audioUrl);
      expect(audio.currentTime).toBeCloseTo(1, 2);
    } finally {
      view.unmount();
      ready.mockRestore();
      vi.useRealTimers();
    }
  });

});

/** Practice harness: the real feedback controller drives the reveal, the store owns answers. */
function renderPracticeHarness(
  props: ReturnType<typeof buildProps>['props'],
  partId: number,
  questions: Question[],
  answers: Record<string, AnswerValue> = {},
) {
  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        ...initialState,
        attemptId: 42,
        version: 1,
        contextRevision: 1,
        answers: Object.keys(answers).length > 0 ? { [partId]: answers } : {},
      },
    },
  });
  const workspace = {
    attempt_id: 42,
    status: 'IN_PROGRESS',
    test_scope: 'SINGLE_PART',
    test_mode: 'PRACTICE',
    startTime: '2026-10-18T00:00:00Z',
    serverTime: '2026-10-18T00:00:00Z',
    deadline: null,
    gracePeriodSeconds: 15,
    lockedSections: [],
    version: 1,
    saved_answers: [],
    serverTimeOffset: 0,
    exam_snapshot: props.snapshot,
  } as unknown as WorkspaceResponse;

  let controller!: PracticeFeedbackController;
  const Harness: React.FC = () => {
    controller = usePracticeFeedback({ workspace, partId, questions, isLocked: false });
    return (
      <ToeicWorkspace
        {...props}
        answers={answers}
        onAnswer={(questionId, value) => {
          store.dispatch(setAnswer({ partId, questionId, value }));
        }}
        practiceFeedback={controller}
      />
    );
  };
  render(
    <Provider store={store}>
      <Harness />
    </Provider>,
  );
  return {
    get controller() {
      return controller;
    },
    store,
  };
}
