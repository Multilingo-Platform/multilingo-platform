import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axiosClient from '../../../core/api/axiosClient';
import answerReducer, {
  initialState,
  lockAnswers,
  markSavePending,
  markSaveSuccess,
  setAnswer,
  setAttemptContext,
  toggleFlag,
} from '../store/answerSlice';
import { getWorkspace } from '../api/attemptApi';
import { useListeningPlayback } from '../hooks/useListeningPlayback';
import { buildToeicWorkspaceModel } from '../utils/toeicWorkspaceModel';
import WorkspacePage from '../pages/WorkspacePage';
import type { TestMode } from '../types/api.types';

/**
 * TW-09 — cross-cutting TOEIC workspace contract.
 *
 * Everything below runs the real view model, the real Redux reducers, the real API normalizers
 * (`attemptApi`/`listeningPlaybackApi`), the real playback hook and the real `WorkspacePage`. Only
 * the HTTP boundary (`axiosClient`) and browser media elements are mocked.
 */

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const httpGet = vi.mocked(axiosClient.get);
const httpPost = vi.mocked(axiosClient.post);

const ATTEMPT_ID = 42;
const LETTERS = ['A', 'B', 'C', 'D'];
const SECRET_PROMPT = 'SECRET_SPOKEN_PROMPT_MUST_NOT_RENDER';
const SECRET_OPTION = 'SECRET_SPOKEN_OPTION_MUST_NOT_RENDER';

function envelope(data: unknown) {
  return { success: true, code: 200, message: 'ok', data, timestamp: '2026-10-18T00:00:00Z' };
}

function question(id: string, text: string, optionText?: string[]) {
  return {
    question_id: id,
    questionId: id,
    type: 'SINGLE_CHOICE',
    question_text: text,
    options: (optionText ?? LETTERS.map((_, i) => `option-${id}-${i}`)).map((t, i) => ({
      id: LETTERS[i],
      text: t,
    })),
    media: null,
  };
}

interface PartSpec {
  partNumber: number;
  partId: number;
  skill: 'LISTENING' | 'READING';
  /** Number of questions per question group; one entry per group. */
  groupSizes: number[];
  contentHtml?: boolean;
  secret?: boolean;
  audioUrl?: string;
  mediaUrl?: string;
  /** Part 1 convention: every one-question group owns its own photograph. */
  mediaPerGroup?: boolean;
}

/** Canonical 7-Part TOEIC layout: q_001..q_200 across Listening (P1–4) and Reading (P5–7). */
const PART_SPECS: PartSpec[] = [
  { partNumber: 1, partId: 101, skill: 'LISTENING', groupSizes: [6], secret: true, audioUrl: 'https://cdn.test/p1.mp3', mediaUrl: 'https://cdn.test/p1-photo.png' },
  { partNumber: 2, partId: 102, skill: 'LISTENING', groupSizes: [25], secret: true, audioUrl: 'https://cdn.test/p2.mp3' },
  { partNumber: 3, partId: 103, skill: 'LISTENING', groupSizes: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], audioUrl: 'https://cdn.test/p3.mp3' },
  { partNumber: 4, partId: 104, skill: 'LISTENING', groupSizes: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3], audioUrl: 'https://cdn.test/p4.mp3', mediaUrl: 'https://cdn.test/p4-graphic.png' },
  { partNumber: 5, partId: 105, skill: 'READING', groupSizes: [30] },
  { partNumber: 6, partId: 106, skill: 'READING', groupSizes: [4, 4, 4, 4], contentHtml: true },
  { partNumber: 7, partId: 107, skill: 'READING', groupSizes: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 2, 2], contentHtml: true },
];

let questionCursor = 0;

function buildPart(spec: PartSpec) {
  const groups = spec.groupSizes.map((size, groupIndex) => {
    const questions = Array.from({ length: size }, () => {
      questionCursor += 1;
      const id = `q_${String(questionCursor).padStart(3, '0')}`;
      const secretHere = spec.secret === true && groupIndex === 0;
      return question(id, secretHere ? SECRET_PROMPT : `Prompt ${id}`, secretHere ? [SECRET_OPTION, 'b', 'c', 'd'] : undefined);
    });
    return {
      group_id: `p${spec.partNumber}-g${groupIndex + 1}`,
      instruction: groupIndex === 0 ? `Questions for Part ${spec.partNumber}` : null,
      ...(spec.contentHtml ? { content_html: `<p>Passage p${spec.partNumber}-g${groupIndex + 1}</p>` } : {}),
      ...(spec.mediaUrl && (spec.mediaPerGroup || groupIndex === 0)
        ? { shared_media: { type: 'image', url: spec.mediaPerGroup ? `${spec.mediaUrl}?g=${groupIndex + 1}` : spec.mediaUrl } }
        : {}),
      questions,
    };
  });

  return {
    id: spec.partId,
    part_id: spec.partId,
    part_number: spec.partNumber,
    title: `Part ${spec.partNumber}`,
    instruction: `Instruction for Part ${spec.partNumber}`,
    ...(spec.audioUrl ? { shared_audio: { url: spec.audioUrl } } : {}),
    question_groups: groups,
    questionGroups: groups,
  };
}

function buildFullSnapshot() {
  questionCursor = 0;
  const parts = PART_SPECS.map(buildPart);
  return {
    exam_id: 1,
    code: 'TOEIC-ETS-2024-T1-V2',
    title: 'ETS TOEIC 2024 Test 1',
    type: 'TOEIC',
    sections: [
      { id: 10, section_id: 10, skill_type: 'LISTENING', title: 'Listening', parts: parts.slice(0, 4) },
      { id: 20, section_id: 20, skill_type: 'READING', title: 'Reading', parts: parts.slice(4) },
    ],
  };
}

/**
 * Listening-only snapshot for page-level playback tests. Rendering all 200 questions is not needed
 * to prove playback and made the default-worker suite exceed the per-test budget.
 */
function buildListeningSnapshot() {
  questionCursor = 0;
  const parts = PART_SPECS.slice(0, 2).map(buildPart);
  return {
    exam_id: 1,
    code: 'TOEIC-ETS-2024-T1-V2',
    title: 'ETS TOEIC 2024 Test 1',
    type: 'TOEIC',
    sections: [{ id: 10, section_id: 10, skill_type: 'LISTENING', title: 'Listening', parts }],
  };
}

/** R1 layout: six Part 1 photograph groups plus one Part 2 group with all 25 questions. */
const R1_PART_SPECS: PartSpec[] = [
  {
    partNumber: 1,
    partId: 101,
    skill: 'LISTENING',
    groupSizes: [1, 1, 1, 1, 1, 1],
    secret: true,
    mediaPerGroup: true,
    audioUrl: 'https://cdn.test/p1.mp3',
    mediaUrl: 'https://cdn.test/p1-photo.png',
  },
  {
    partNumber: 2,
    partId: 102,
    skill: 'LISTENING',
    groupSizes: [25],
    secret: true,
    audioUrl: 'https://cdn.test/p2.mp3',
  },
];

function buildR1Snapshot() {
  questionCursor = 0;
  const parts = R1_PART_SPECS.map(buildPart);
  return {
    exam_id: 1,
    code: 'TOEIC-ETS-2024-T1-V2',
    title: 'ETS TOEIC 2024 Test 1',
    type: 'TOEIC',
    sections: [{ id: 10, section_id: 10, skill_type: 'LISTENING', title: 'Listening', parts }],
  };
}

/** A single-Part TOEIC snapshot (Reading P5/P6/P7) with the canonical layout for that Part. */
function buildReadingSnapshot(partNumber: 5 | 6 | 7) {
  questionCursor = 0;
  const spec = PART_SPECS.find(candidate => candidate.partNumber === partNumber)!;
  // Start the cursor at the canonical first question of the Part so ids match the whole exam.
  const first = partNumber === 5 ? 101 : partNumber === 6 ? 131 : 147;
  questionCursor = first - 1;
  const part = buildPart(spec);
  return {
    exam_id: 1,
    code: 'TOEIC-ETS-2024-T1-V2',
    title: 'ETS TOEIC 2024 Test 1',
    type: 'TOEIC',
    sections: [{ id: 20, section_id: 20, skill_type: 'READING', title: 'Reading', parts: [part] }],
  };
}

function serverWorkspace(snapshot: unknown, mode: TestMode) {
  return {
    attempt_id: ATTEMPT_ID,
    attemptId: ATTEMPT_ID,
    status: 'IN_PROGRESS',
    test_scope: 'FULL_EXAM',
    testScope: 'FULL_EXAM',
    test_mode: mode,
    testMode: mode,
    startTime: '2026-10-18T00:00:00Z',
    start_time: '2026-10-18T00:00:00Z',
    serverTime: '2026-10-18T00:00:00Z',
    server_time: '2026-10-18T00:00:00Z',
    deadline: mode === 'MOCK_TEST' ? '2030-01-01T00:00:00Z' : null,
    gracePeriodSeconds: 15,
    grace_period_seconds: 15,
    lockedSections: [],
    locked_sections: [],
    version: 1,
    savedAnswers: [],
    saved_answers: [],
    // The backend (TW-04) attaches this summary for TOEIC Mock attempts.
    listeningPlayback: mode === 'MOCK_TEST' ? { status: 'NOT_STARTED', available: true } : undefined,
    exam_snapshot: snapshot,
    examSnapshot: snapshot,
  };
}

function mockPlaybackSnapshot(status: 'NOT_STARTED' | 'RUNNING' = 'NOT_STARTED') {
  return {
    attemptId: ATTEMPT_ID,
    status,
    serverTime: '2026-10-18T00:00:00Z',
    startedAt: status === 'RUNNING' ? '2026-10-18T00:00:00Z' : null,
    activePartId: status === 'RUNNING' ? '101' : null,
    activePartNumber: status === 'RUNNING' ? 1 : null,
    positionMs: 0,
    elapsedMs: 0,
    remainingMs: 180000,
    totalDurationMs: 180000,
    tracks: [
      {
        partId: '101',
        partNumber: 1,
        audioUrl: 'https://cdn.test/p1.mp3',
        durationMs: 180000,
        startOffsetMs: 0,
      },
    ],
  };
}

function renderWorkspacePage(
  snapshot: unknown,
  mode: TestMode = 'MOCK_TEST',
  playbackPayload?: unknown,
  workspaceModifier?: (ws: ReturnType<typeof serverWorkspace>) => ReturnType<typeof serverWorkspace>,
) {
  httpGet.mockImplementation((url: string) => {
    if (url.includes('/workspace')) {
      const baseWs = serverWorkspace(snapshot, mode);
      const ws = workspaceModifier ? workspaceModifier(baseWs) : baseWs;
      return Promise.resolve(envelope(ws) as never);
    }
    if (url.includes('/listening-playback')) {
      return Promise.resolve(
        envelope(playbackPayload ?? mockPlaybackSnapshot('NOT_STARTED')) as never,
      );
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });

  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState: { answers: { ...initialState } },
  });

  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/attempts/${ATTEMPT_ID}/workspace`]}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return { ...result, store };
}

beforeEach(() => {
  vi.clearAllMocks();
  httpPost.mockRejectedValue(new Error('unexpected POST'));
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom always provides localStorage */
  }
});

afterEach(() => {
  cleanup();
  window.innerWidth = 1024;
});

/* ------------------------------------------------------------------ */
/* 1. Canonical 1..200 view model across all 7 Parts                   */
/* ------------------------------------------------------------------ */

describe('TW-09 — view model: canonical 1..200 across 7 Parts', () => {
  it('numbers every question 1..200 once, in order, without index/id fallbacks', () => {
    const model = buildToeicWorkspaceModel(buildFullSnapshot());

    expect(model.valid).toBe(true);
    expect(model.issues).toEqual([]);
    expect(model.parts).toHaveLength(7);
    expect(model.questions).toHaveLength(200);

    const numbers = model.questions.map(question => question.questionNumber);
    expect(numbers).toEqual(Array.from({ length: 200 }, (_, index) => index + 1));
    expect(new Set(numbers).size).toBe(200);
    expect(model.questions.every(question => question.numberSource === 'canonical_id')).toBe(true);

    // Part 3/4 are three-question groups; Reading keeps its group boundaries.
    const part3 = model.parts.find(part => part.partNumber === 3)!;
    const part4 = model.parts.find(part => part.partNumber === 4)!;
    expect(part3.groups).toHaveLength(13);
    expect(part3.groups.every(group => group.questions.length === 3)).toBe(true);
    expect(part4.groups.every(group => group.questions.length === 3)).toBe(true);
    expect(model.parts.find(part => part.partNumber === 6)!.groups).toHaveLength(4);
    expect(model.parts.find(part => part.partNumber === 7)!.groups).toHaveLength(15);

    // Part 7 ends the whole exam at 200.
    const part7Numbers = model.questions.filter(question => question.partNumber === 7).map(q => q.questionNumber);
    expect(part7Numbers[0]).toBe(147);
    expect(part7Numbers[part7Numbers.length - 1]).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Mock page: canonical palette, labels-only options, no leak       */
/* ------------------------------------------------------------------ */

describe('TW-09 — Mock page through the real normalizer + WorkspacePage', () => {
  it('renders the canonical 1..200 palette for the whole exam', async () => {
    renderWorkspacePage(buildFullSnapshot());

    const first = await screen.findByTestId('palette-q_001');
    expect(first.textContent).toBe('1');
    expect(first.getAttribute('aria-label')).toContain('Câu 1');

    const last = screen.getByTestId('palette-q_200');
    expect(last.textContent).toBe('200');
    expect(last.getAttribute('aria-label')).toContain('Câu 200');
  });

  it('marks the active question in the palette (aria-current) for the workspace Part', async () => {
    renderWorkspacePage(buildFullSnapshot());

    await screen.findByTestId('palette-q_001');
    // Part 1 defaults to its first question; the page must forward the active question so the
    // sidebar can indicate it instead of rendering a passive grid.
    await waitFor(() => {
      expect(screen.getByTestId('palette-q_001')).toHaveAttribute('aria-current', 'true');
    });
    expect(screen.getByTestId('palette-q_002')).not.toHaveAttribute('aria-current', 'true');
  });

  it('Part 1 keeps spoken prompt/option text out of the DOM and shows labels only', async () => {
    const { store } = renderWorkspacePage(buildFullSnapshot());

    await screen.findByTestId('listening-question-q_001');
    expect(screen.getByTestId('listening-photo-p1-g1')).toBeInTheDocument();
    expect(screen.getByTestId('option-label-q_001-A').textContent).toContain('(A)');
    expect(screen.getByTestId('option-label-q_001-D').textContent).toContain('(D)');

    const text = document.body.textContent ?? '';
    expect(text).not.toContain(SECRET_PROMPT);
    expect(text).not.toContain(SECRET_OPTION);

    // Playback must not touch answer state: version stays server-provided, answers stay empty.
    expect(store.getState().answers.version).toBe(1);
    expect(store.getState().answers.answers).toEqual({});
  });

  it('a Mock TOEIC attempt with available playback enables start button, starts playback to render server audio, and handles reload', async () => {
    const runningSnapshot = mockPlaybackSnapshot('RUNNING');
    httpPost.mockImplementation((url: string) => {
      if (url.includes('/listening-playback/start')) {
        return Promise.resolve(envelope(runningSnapshot) as never);
      }
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    renderWorkspacePage(buildListeningSnapshot());

    // 1. Initial page load: timeline is NOT_STARTED -> Start button is rendered
    const startBtn = await screen.findByRole('button', { name: /bắt đầu phát audio/i }, { timeout: 4000 });
    expect(startBtn).toBeInTheDocument();
    expect(screen.queryByTestId('toeic-audio-server')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toeic-audio-unavailable')).not.toBeInTheDocument();

    // 2. Click start button -> POST start -> switches to toeic-audio-server
    fireEvent.click(startBtn);

    expect(await screen.findByTestId('toeic-audio-server', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /bắt đầu phát audio/i })).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('a Mock TOEIC attempt reloads/reconnects directly into server audio if timeline is already RUNNING', async () => {
    // Reload/reconnect scenario: timeline GET already returns RUNNING
    renderWorkspacePage(buildListeningSnapshot(), 'MOCK_TEST', mockPlaybackSnapshot('RUNNING'));

    expect(await screen.findByTestId('toeic-audio-server', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bắt đầu phát audio/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('toeic-audio-unavailable')).not.toBeInTheDocument();
  });

  it('a Mock TOEIC attempt with available: false displays unavailable notice', async () => {
    renderWorkspacePage(
      buildFullSnapshot(),
      'MOCK_TEST',
      undefined,
      (ws) => ({
        ...ws,
        listeningPlayback: { status: 'UNAVAILABLE', available: false },
      }),
    );

    expect(await screen.findByTestId('toeic-audio-unavailable', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bắt đầu phát audio/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('toeic-audio-server')).not.toBeInTheDocument();
  });

  it('flag state toggles through the shared question card', async () => {
    const { store } = renderWorkspacePage(buildFullSnapshot());
    const flag = await screen.findByTestId('flag-btn-q_001');

    expect(flag.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(flag);
    expect(flag.getAttribute('aria-pressed')).toBe('true');
    expect(store.getState().answers.flags[101]?.q_001).toBe(true);

    fireEvent.click(flag);
    expect(flag.getAttribute('aria-pressed')).toBe('false');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Reading layout follows content shape (P5 one column, P7 split)    */
/* ------------------------------------------------------------------ */

describe('TW-09 — Reading layout and pane boundaries', () => {
  it('Part 5 renders one centered column with no reference pane or divider', async () => {
    renderWorkspacePage(buildReadingSnapshot(5));
    expect(await screen.findByTestId('toeic-reading-single-column')).toBeInTheDocument();
    expect(screen.queryByTestId('toeic-reference-pane')).toBeNull();
    expect(screen.queryByTestId('toeic-reading-divider')).toBeNull();
  });

  it('Part 7 splits into scoped reference pane and an independent question pane', async () => {
    const { container } = renderWorkspacePage(buildReadingSnapshot(7));

    const referencePane = await screen.findByTestId('toeic-reference-pane');
    expect(referencePane).toBeInTheDocument();
    // Each group document is a distinct highlight scope so selections cannot cross groups.
    expect(container.querySelector('[data-highlight-scope="p7-g1"]')).not.toBeNull();
    expect(container.querySelector('[data-highlight-scope="p7-g2"]')).not.toBeNull();
    // The reference pane never creates native embedded media controls.
    expect(referencePane.querySelector('audio')).toBeNull();
    expect(referencePane.textContent).toContain('Passage p7-g1');

    expect(screen.getByTestId('toeic-reading-questions')).toBeInTheDocument();
    expect(screen.getByTestId('reading-group-p7-g1')).toBeInTheDocument();
    expect(screen.getByTestId('toeic-reading-divider')).toBeInTheDocument();

    // Independent scrolling: both the reference pane container and the question column scroll.
    expect(container.querySelectorAll('.overflow-y-auto').length).toBeGreaterThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Server-authoritative playback timeline                           */
/* ------------------------------------------------------------------ */

const TRACKS = [
  { partId: '101', partNumber: 1, audioUrl: 'https://cdn.test/p1.mp3', durationMs: 30000, startOffsetMs: 0 },
  { partId: '102', partNumber: 2, audioUrl: 'https://cdn.test/p2.mp3', durationMs: 30000, startOffsetMs: 30000 },
];
const TOTAL_MS = 60000;

function playbackSnapshot(status: 'NOT_STARTED' | 'RUNNING' | 'FINISHED', elapsedMs = 0) {
  const active = TRACKS.find(t => elapsedMs >= t.startOffsetMs && elapsedMs < t.startOffsetMs + t.durationMs) ?? TRACKS[0];
  return {
    attemptId: ATTEMPT_ID,
    status,
    serverTime: '2026-10-18T00:00:00Z',
    startedAt: status === 'NOT_STARTED' ? null : '2026-10-18T00:00:00Z',
    activePartId: status === 'FINISHED' ? null : active.partId,
    activePartNumber: status === 'FINISHED' ? null : active.partNumber,
    positionMs: status === 'FINISHED' ? 0 : elapsedMs - active.startOffsetMs,
    elapsedMs: status === 'FINISHED' ? TOTAL_MS : elapsedMs,
    remainingMs: status === 'FINISHED' ? 0 : TOTAL_MS - elapsedMs,
    totalDurationMs: TOTAL_MS,
    tracks: TRACKS,
  };
}

function fakeMedia() {
  return { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), currentTime: 0, playbackRate: 1, src: '' };
}

describe('TW-09 — Mock playback contract (real hook + real API normalizer)', () => {
  it('start is a single idempotent POST and switches to the running server timeline', async () => {
    httpGet.mockResolvedValue(envelope(playbackSnapshot('NOT_STARTED')) as never);
    httpPost.mockResolvedValue(envelope(playbackSnapshot('RUNNING', 2000)) as never);

    const media = fakeMedia();
    const mediaRef = { current: media as unknown as HTMLMediaElement };
    const { result } = renderHook(() =>
      useListeningPlayback({ attemptId: ATTEMPT_ID, mode: 'MOCK_TEST', enabled: true, mediaRef, now: () => 1000 }),
    );

    await waitFor(() => expect(result.current.status).toBe('NOT_STARTED'));
    expect(httpGet).toHaveBeenCalledWith(`/v1/attempts/${ATTEMPT_ID}/listening-playback`, expect.anything());

    await act(async () => {
      await result.current.start();
    });

    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost).toHaveBeenCalledWith(
      `/v1/attempts/${ATTEMPT_ID}/listening-playback/start`,
      null,
      expect.anything(),
    );
    expect(result.current.status).toBe('RUNNING');
    expect(result.current.activePartNumber).toBe(1);
  });

  it('reload/reconnect jumps to the current server position instead of replaying a missed track', async () => {
    // Simulates a fresh mount (reload) where the server is already 45s into the 60s playlist.
    httpGet.mockResolvedValue(envelope(playbackSnapshot('RUNNING', 45000)) as never);

    const media = fakeMedia();
    const mediaRef = { current: media as unknown as HTMLMediaElement };
    const { result } = renderHook(() =>
      useListeningPlayback({ attemptId: ATTEMPT_ID, mode: 'MOCK_TEST', enabled: true, mediaRef, now: () => 5000 }),
    );

    await waitFor(() => expect(result.current.status).toBe('RUNNING'));
    expect(result.current.activePartNumber).toBe(2);
    expect(result.current.positionMs).toBe(15000);
    expect(media.currentTime).toBe(15); // 15000ms into the second track, no replay of Part 1
    expect(result.current.remainingMs).toBe(15000);
  });

  it('Practice stays fully client-controlled and never touches the server timeline', async () => {
    const media = fakeMedia();
    const mediaRef = { current: media as unknown as HTMLMediaElement };
    const { result } = renderHook(() =>
      useListeningPlayback({ attemptId: ATTEMPT_ID, mode: 'PRACTICE', enabled: false, mediaRef, now: () => 1000 }),
    );

    await waitFor(() => expect(result.current.status).toBe('NOT_STARTED'));
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpPost).not.toHaveBeenCalled();

    media.currentTime = 30;
    act(() => result.current.rewind(10));
    expect(media.currentTime).toBe(20);

    act(() => result.current.setSpeed(1.5));
    expect(media.playbackRate).toBe(1.5);
    expect(result.current.speed).toBe(1.5);

    // Practice replay controls must not exist for Mock.
    expect(result.current.isPractice).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Persistence invariants: playback/UI never change answer version   */
/* ------------------------------------------------------------------ */

describe('TW-09 — autosave/submit version invariants', () => {
  it('only a server save acknowledgement advances the answer version', () => {
    const store = configureStore({ reducer: { answers: answerReducer }, preloadedState: { answers: { ...initialState } } });
    store.dispatch(setAttemptContext({ attemptId: ATTEMPT_ID, version: 5, savedAnswers: [] }));

    store.dispatch(setAnswer({ partId: 101, questionId: 'q_001', value: 'A' }));
    store.dispatch(setAnswer({ partId: 101, questionId: 'q_002', value: 'B' }));
    // Local edits never move the version, only pendingVersion/dirty.
    expect(store.getState().answers.version).toBe(5);
    expect(store.getState().answers.pendingVersion).toBe(2);
    expect(store.getState().answers.isDirty).toBe(true);

    const op = { attemptId: ATTEMPT_ID, contextRevision: store.getState().answers.contextRevision, requestId: 'save-1', pendingVersion: 2 };
    store.dispatch(markSavePending(op));
    store.dispatch(markSaveSuccess({ ...op, savedAt: Date.now(), serverVersion: 6 }));
    expect(store.getState().answers.version).toBe(6);
    expect(store.getState().answers.isDirty).toBe(false);
  });

  it('a locked section rejects further answer/flag mutations', () => {
    const store = configureStore({ reducer: { answers: answerReducer }, preloadedState: { answers: { ...initialState } } });
    store.dispatch(setAttemptContext({ attemptId: ATTEMPT_ID, version: 2, savedAnswers: [] }));
    store.dispatch(lockAnswers({ attemptId: ATTEMPT_ID, contextRevision: store.getState().answers.contextRevision }));

    store.dispatch(setAnswer({ partId: 101, questionId: 'q_001', value: 'A' }));
    store.dispatch(toggleFlag({ partId: 101, questionId: 'q_001' }));

    expect(store.getState().answers.answers).toEqual({});
    expect(store.getState().answers.flags).toEqual({});
    expect(store.getState().answers.pendingVersion).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 6. Desktop viewports: keyboard resize, focus, flag/answered states    */
/* ------------------------------------------------------------------ */

describe.each([1366, 1440, 1920])('TW-09 — desktop viewport %ipx', width => {
  it('keeps the reading split keyboard-resizable and focusable within 30–70%', async () => {
    window.innerWidth = width;
    renderWorkspacePage(buildReadingSnapshot(7));
    fireEvent(window, new Event('resize'));

    const divider = await screen.findByTestId('toeic-reading-divider');
    expect(divider.getAttribute('role')).toBe('separator');
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    expect(divider.tabIndex).toBe(0);
    expect(divider.className).toContain('focus-visible:ring-2');
    expect(divider.getAttribute('aria-valuenow')).toBe('50');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider.getAttribute('aria-valuenow')).toBe('55');

    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider.getAttribute('aria-valuenow')).toBe('70');

    fireEvent.keyDown(divider, { key: 'ArrowRight' }); // clamped at the max
    expect(divider.getAttribute('aria-valuenow')).toBe('70');

    fireEvent.keyDown(divider, { key: 'Home' });
    expect(divider.getAttribute('aria-valuenow')).toBe('30');

    fireEvent.keyDown(divider, { key: 'ArrowLeft' }); // clamped at the min
    expect(divider.getAttribute('aria-valuenow')).toBe('30');

    // Reset control returns to the 50/50 default.
    fireEvent.click(screen.getByLabelText('Đặt lại tỉ lệ 50/50'));
    expect(divider.getAttribute('aria-valuenow')).toBe('50');
  });
});

/* ------------------------------------------------------------------ */
/* 7. P1 — required behaviour that the current normalizer breaks        */
/* ------------------------------------------------------------------ */

describe('TW-09 — P1 finding (REQUIRED, currently RED)', () => {
  it('P1: the workspace API normalizer must preserve the Mock listeningPlayback summary', async () => {
    httpGet.mockResolvedValueOnce(
      envelope(serverWorkspace(buildFullSnapshot(), 'MOCK_TEST')) as never,
    );

    const workspace = await getWorkspace(ATTEMPT_ID);

    // AC-05: Mock audio is enabled from the server summary; losing it disables the whole timeline.
    expect(workspace.listeningPlayback).toEqual({ status: 'NOT_STARTED', available: true });
  });
});

/* ------------------------------------------------------------------ */
/* 8. TV3-22 / R1 — Part 1 six photos, Part 2 twenty-five questions     */
/* ------------------------------------------------------------------ */

describe('TV3-22 R1 — TOEIC Part 1/Part 2 workspace regression', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView | undefined;

  beforeEach(() => {
    originalScrollIntoView = Element.prototype.scrollIntoView;
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  function listeningQuestionCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="listening-question-"]'),
    );
  }

  it('renders six Part 1 questions and six photographs at once with canonical palette numbers', async () => {
    const { store } = renderWorkspacePage(buildR1Snapshot(), 'PRACTICE');

    await screen.findByTestId('listening-question-q_001');

    // All six Part 1 questions stay mounted simultaneously; none is swapped out one at a time.
    expect(listeningQuestionCards()).toHaveLength(6);
    for (let number = 1; number <= 6; number += 1) {
      const id = `q_${String(number).padStart(3, '0')}`;
      expect(screen.getByTestId(`listening-question-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`listening-photo-p1-g${number}`)).toBeInTheDocument();
      expect(screen.getByTestId(`palette-${id}`).textContent).toBe(String(number));
    }
    // Spoken Part 1 prompts/options stay out of the DOM.
    expect(document.body.textContent).not.toContain(SECRET_PROMPT);
    expect(document.body.textContent).not.toContain(SECRET_OPTION);

    // Answer/flag are persisted in Redux and reflected by the palette while the Part stays mounted.
    fireEvent.click(within(screen.getByTestId('listening-answer-fieldset-q_001'))
      .getByRole('radio', { name: 'Lựa chọn A' }));
    fireEvent.click(screen.getByTestId('flag-btn-q_002'));

    expect(store.getState().answers.answers[101]?.q_001).toBe('A');
    expect(store.getState().answers.flags[101]?.q_002).toBe(true);
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_002')).toHaveAttribute('data-flagged', 'true');

    // Palette navigation scrolls to the target card without unmounting the other questions.
    fireEvent.click(screen.getByTestId('palette-q_006'));
    await waitFor(() => {
      expect(screen.getByTestId('palette-q_006')).toHaveAttribute('aria-current', 'true');
    });
    expect(scrollIntoView).toHaveBeenCalled();
    expect(listeningQuestionCards()).toHaveLength(6);
  });

  it('renders all 25 Part 2 questions at once and keeps answers/flags across Part switches', async () => {
    const { store } = renderWorkspacePage(buildR1Snapshot(), 'PRACTICE');
    await screen.findByTestId('listening-question-q_001');

    fireEvent.click(screen.getByRole('button', { name: /^Part 2/ }));
    await screen.findByTestId('listening-question-q_007');

    // Part 2 is one continuous group: every one of the 25 questions is in the DOM.
    expect(listeningQuestionCards()).toHaveLength(25);
    expect(screen.getByTestId('listening-question-q_007')).toBeInTheDocument();
    expect(screen.getByTestId('listening-question-q_031')).toBeInTheDocument();
    expect(screen.getByTestId('palette-q_007').textContent).toBe('7');
    expect(screen.getByTestId('palette-q_031').textContent).toBe('31');

    fireEvent.click(within(screen.getByTestId('listening-answer-fieldset-q_007'))
      .getByRole('radio', { name: 'Lựa chọn B' }));
    fireEvent.click(screen.getByTestId('flag-btn-q_008'));

    // Palette navigation to the last question keeps the whole Part mounted and marks the target.
    fireEvent.click(screen.getByTestId('palette-q_031'));
    await waitFor(() => {
      expect(screen.getByTestId('palette-q_031')).toHaveAttribute('aria-current', 'true');
    });
    expect(listeningQuestionCards()).toHaveLength(25);

    // Round-trip Part 2 → Part 1 → Part 2: answer/flag state is never lost.
    fireEvent.click(screen.getByRole('button', { name: /^Part 1/ }));
    await screen.findByTestId('listening-question-q_001');
    expect(listeningQuestionCards()).toHaveLength(6);
    expect(screen.getByTestId('palette-q_007')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_008')).toHaveAttribute('data-flagged', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Part 2/ }));
    await screen.findByTestId('listening-question-q_007');
    expect(store.getState().answers.answers[102]?.q_007).toBe('B');
    expect(store.getState().answers.flags[102]?.q_008).toBe(true);
    expect(within(screen.getByTestId('listening-answer-fieldset-q_007'))
      .getByRole('radio', { name: 'Lựa chọn B' })).toBeChecked();
  });

  it('Practice retry keeps only the wrong Part 2 questions in scope and filters the palette', async () => {
    renderWorkspacePage(buildR1Snapshot(), 'PRACTICE');
    await screen.findByTestId('listening-question-q_001');

    fireEvent.click(screen.getByRole('button', { name: /^Part 2/ }));
    await screen.findByTestId('listening-question-q_007');

    const q7 = screen.getByTestId('listening-question-q_007');
    fireEvent.click(within(screen.getByTestId('listening-answer-fieldset-q_007'))
      .getByRole('radio', { name: 'Lựa chọn B' }));

    httpPost.mockResolvedValueOnce(envelope({
      attemptId: ATTEMPT_ID,
      partId: 102,
      questionId: 'q_007',
      type: 'SINGLE_CHOICE',
      userAnswer: 'B',
      verdict: 'WRONG',
      score: 0,
      correctAnswer: 'A',
      explanation: 'The photograph shows the correct option A.',
    }) as never);

    fireEvent.click(within(q7).getByRole('button', { name: 'Kiểm tra đáp án cho câu 7' }));

    await waitFor(() => {
      expect(within(q7).getByText('Chưa chính xác')).toBeInTheDocument();
    });
    expect(httpPost).toHaveBeenCalledWith(
      `/v1/attempts/${ATTEMPT_ID}/practice-feedback`,
      { partId: 102, questionId: 'q_007', answer: 'B' },
      expect.anything(),
    );
    expect(screen.getByTestId('retry-wrong-count').textContent).toContain('1 câu sai');

    fireEvent.click(screen.getByRole('button', { name: 'Luyện lại câu sai' }));

    // Only the wrong question of the active Part remains rendered.
    await waitFor(() => {
      expect(listeningQuestionCards()).toHaveLength(1);
    });
    expect(screen.getByTestId('listening-question-q_007')).toBeInTheDocument();
    expect(screen.queryByTestId('listening-question-q_008')).not.toBeInTheDocument();

    // Palette cells outside the retry set are disabled, but only within the active Part.
    expect(screen.getByTestId('palette-q_007')).not.toBeDisabled();
    expect(screen.getByTestId('palette-q_008')).toBeDisabled();
    expect(screen.getByTestId('palette-q_001')).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Về toàn bộ câu' }));
    await waitFor(() => {
      expect(screen.getByTestId('listening-question-q_008')).toBeInTheDocument();
    });
    expect(listeningQuestionCards()).toHaveLength(25);
  });

  it('Mock playback starts from the server timeline and keeps exactly one media element', async () => {
    const running = {
      ...mockPlaybackSnapshot('RUNNING'),
      elapsedMs: 2000,
      positionMs: 2000,
      remainingMs: 178000,
    };
    httpPost.mockImplementation((url: string) => {
      if (url.includes('/listening-playback/start')) {
        return Promise.resolve(envelope(running) as never);
      }
      return Promise.reject(new Error(`unexpected POST ${url}`));
    });

    renderWorkspacePage(buildR1Snapshot(), 'MOCK_TEST');

    const startBtn = await screen.findByRole('button', { name: /bắt đầu phát audio/i }, { timeout: 4000 });
    fireEvent.click(startBtn);

    expect(await screen.findByTestId('toeic-audio-server', {}, { timeout: 4000 })).toBeInTheDocument();

    const audioElements = Array.from(document.querySelectorAll('audio'));
    expect(audioElements).toHaveLength(1);
    const audio = audioElements[0] as HTMLAudioElement;
    expect(audio.getAttribute('src')).toBe('https://cdn.test/p1.mp3');
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(audio.getAttribute('controlsList')).toContain('nodownload');

    // The server position is applied once the media element reports readiness. jsdom keeps
    // `readyState` at 0, so expose a ready element before dispatching the browser event.
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
    fireEvent(audio, new Event('loadedmetadata'));
    await waitFor(() => {
      expect(audio.currentTime).toBeGreaterThanOrEqual(2);
    });

    // The page only asks its API for workspace/timeline; it never fetches media directly.
    expect(httpGet.mock.calls.every(([url]) => !String(url).includes('cdn.test'))).toBe(true);
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(httpPost).toHaveBeenCalledWith(
      `/v1/attempts/${ATTEMPT_ID}/listening-playback/start`,
      null,
      expect.anything(),
    );
  });
});
