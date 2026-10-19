import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toEditorParts, toOfficialExamRequest } from '../../exams/utils/examContentMapping';
import { normalizeAttemptReview } from '../api/reviewContract';
import axiosClient from '../../../core/api/axiosClient';
import answerReducer, { setAnswer } from '../store/answerSlice';
import useWorkspace from '../hooks/useWorkspace';
import WorkspacePage from '../pages/WorkspacePage';
import type { ReviewVerdict, WorkspaceResponse } from '../types/api.types';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);

function envelope(data: unknown) {
  return { success: true, code: 200, data, message: 'ok', timestamp: new Date().toISOString() };
}


type FixtureQuestion = {
  question_id: string;
  type: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_answer: string | undefined;
  explanation: string;
  media?: { type: string; url: string };
  answer_group?: { id: string; mode: string; question_ids: string[] };
};

function question(questionId: string, type = 'SINGLE_CHOICE'): FixtureQuestion {
  return {
    question_id: questionId,
    type,
    question_text: `Question ${questionId}`,
    options: type === 'ESSAY' ? [] : [{ id: 'A', text: 'Answer A' }, { id: 'B', text: 'Answer B' }],
    correct_answer: type === 'ESSAY' ? undefined : 'A',
    explanation: `Explanation ${questionId}`,
  };
}

function canonicalSource() {
  const parts = Array.from({ length: 9 }, (_, index) => {
    const partNumber = index + 1;
    const skillType = partNumber <= 4 ? 'LISTENING' : partNumber <= 7 ? 'READING' : 'WRITING';
    const count = [10, 10, 10, 10, 13, 13, 14, 1, 1][index];
    const prefix = partNumber <= 4 ? 'l' : partNumber <= 7 ? 'r' : 'w';
    const start = partNumber <= 4 ? (partNumber - 1) * 10 + 1
      : partNumber <= 7 ? [1, 14, 27][partNumber - 5]
      : partNumber - 7;
    const ids = Array.from({ length: count }, (_, offset) => `${prefix}_${String(start + offset).padStart(3, '0')}`);
    const group: { group_id: string; content_html: string; questions: FixtureQuestion[] } = {
      group_id: `part-${partNumber}-group-1`,
      content_html: skillType === 'READING' ? `<p>Passage ${partNumber - 4}</p>` : '',
      questions: ids.map(id => question(id, skillType === 'WRITING' ? 'ESSAY' : 'SINGLE_CHOICE')),
    };
    if (partNumber === 8) {
      group.questions[0].media = { type: 'image', url: 'https://res.cloudinary.com/example/image/upload/task-1.png' };
    }
    return {
      partNumber,
      contentData: {
        section_skill_type: skillType,
        section_duration_minutes: skillType === 'LISTENING' ? 30 : 60,
        shared_audio: skillType === 'LISTENING'
          ? { url: `https://res.cloudinary.com/example/video/upload/part-${partNumber}.m4a` }
          : undefined,
        question_groups: [group],
      },
    };
  });
  const pairQuestions = parts[1].contentData.question_groups[0].questions.filter(
    question => ['l_017', 'l_018'].includes(question.question_id)
  );
  pairQuestions[0].answer_group = {
    id: 'listening-17-18',
    mode: 'DISTINCT_UNORDERED',
    question_ids: ['l_017', 'l_018'],
  };
  pairQuestions[1].answer_group = {
    id: 'listening-17-18',
    mode: 'DISTINCT_UNORDERED',
    question_ids: ['l_017', 'l_018'],
  };
  return {
    title: 'Cambridge IELTS 20 Test 1',
    type: 'IELTS_ACADEMIC',
    examLanguage: 'en',
    published: false,
    sections: [
      { skillType: 'LISTENING', durationMinutes: 30, parts: parts.slice(0, 4) },
      { skillType: 'READING', durationMinutes: 60, parts: parts.slice(4, 7) },
      { skillType: 'WRITING', durationMinutes: 60, parts: parts.slice(7) },
    ],
  };
}

function buildCambridgeWorkspaceFixture(partIds: Partial<Record<number, number>> = {}): WorkspaceResponse {
  const source = canonicalSource();
  const request = toOfficialExamRequest(source.title, source.type, toEditorParts(source), false);

  let globalPartIndex = 0;
  const sections = request.sections.map((section, sIdx) => ({
    id: sIdx + 1,
    skill_type: section.skillType as 'READING' | 'LISTENING' | 'WRITING',
    name: section.skillType,
    title: `${section.skillType} Section`,
    duration_minutes: section.durationMinutes,
    parts: section.parts.map((part) => {
      globalPartIndex += 1;
      const partId = partIds[globalPartIndex] ?? globalPartIndex;
      return {
        id: partId,
        part_id: partId,
        part_number: part.partNumber,
        partNumber: part.partNumber,
        title: `Part ${part.partNumber}`,
        instruction: `Instruction for Part ${part.partNumber}`,
        questionGroups: part.contentData.question_groups.map((g: any) => ({
          ...g,
          questions: g.questions.map((q: any) => ({
            ...q,
            id: q.question_id,
            questionId: q.question_id,
            question_number: q.question_id,
            questionNumber: q.question_id,
          })),
        })),
        question_groups: part.contentData.question_groups.map((g: any) => ({
          ...g,
          questions: g.questions.map((q: any) => ({
            ...q,
            id: q.question_id,
            questionId: q.question_id,
            question_number: q.question_id,
            questionNumber: q.question_id,
          })),
        })),
        shared_audio: part.contentData.shared_audio,
        sharedAudio: part.contentData.shared_audio,
      };
    }),
  }));

  return {
    attempt_id: 42,
    status: 'IN_PROGRESS',
    test_scope: 'FULL_EXAM',
    test_mode: 'PRACTICE',
    startTime: new Date().toISOString(),
    deadline: null,
    serverTime: new Date().toISOString(),
    gracePeriodSeconds: 15,
    lockedSections: [],
    version: 1,
    saved_answers: [],
    serverTimeOffset: 0,
    exam_snapshot: {
      exam_id: 20,
      code: 'IELTS-CAMBRIDGE-20-T1-V2',
      title: 'Cambridge IELTS 20 Test 1',
      type: 'IELTS_ACADEMIC',
      sections,
    },
  };
}

// Exercise real page, hydration, autosave, submission, serialization and Redux. Only HTTP is fake.
function mountWritingWorkspace() {
  const fixture = buildCambridgeWorkspaceFixture({ 8: 3087, 9: 4093 });
  http.get.mockResolvedValueOnce(envelope(fixture) as never);
  const store = configureStore({ reducer: { answers: answerReducer } });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/42/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          <Route path="/attempts/:attemptId/result" element={<div data-testid="cambridge-result">Result</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { store, ...view };
}

function writeEssay(questionId: 'w_001' | 'w_002', essay: string) {
  fireEvent.click(screen.getByTestId(`palette-${questionId}`));
  fireEvent.change(screen.getByPlaceholderText('Viết bài tự luận của bạn tại đây...'), {
    target: { value: essay },
  });
}

async function advance(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Cambridge IELTS V2 workspace/review contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    window.scrollTo = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('preserves all nine parts, canonical IDs, pair metadata, passages and Writing media', () => {
    const source = canonicalSource();
    const request = toOfficialExamRequest(source.title, source.type, toEditorParts(source), false);
    const parts = request.sections.flatMap(section => section.parts);
    const questions = parts.flatMap(part => part.contentData.question_groups.flatMap(
      (group: { questions: FixtureQuestion[] }) => group.questions
    ));

    expect(request.sections).toHaveLength(3);
    expect(parts).toHaveLength(9);
    expect(questions).toHaveLength(82);
    expect(questions.map(item => item.question_id)).toEqual([
      ...Array.from({ length: 40 }, (_, i) => `l_${String(i + 1).padStart(3, '0')}`),
      ...Array.from({ length: 40 }, (_, i) => `r_${String(i + 1).padStart(3, '0')}`),
      'w_001', 'w_002',
    ]);
    expect(questions.find(item => item.question_id === 'l_017')?.answer_group).toEqual(
      expect.objectContaining({ mode: 'DISTINCT_UNORDERED', question_ids: ['l_017', 'l_018'] })
    );
    expect(parts.find(part => part.partNumber === 6)?.contentData.question_groups[0].content_html)
      .toContain('Passage 2');
    expect(questions.find(item => item.question_id === 'w_001')?.media).toEqual(
      expect.objectContaining({ type: 'image' })
    );
  });

  it('accepts and normalizes review explanations for all 82 questions across 9 parts without treating Writing as objective grading', () => {
    const partQuestionCounts = [10, 10, 10, 10, 13, 13, 14, 1, 1];
    let qOffset = 0;
    const allNormalizedQuestions: any[] = [];

    for (let pIdx = 0; pIdx < 9; pIdx++) {
      const partNumber = pIdx + 1;
      const count = partQuestionCounts[pIdx];
      const partQuestions = Array.from({ length: count }, (_, i) => {
        const globalIdx = qOffset + i;
        const qId = globalIdx < 40
          ? `l_${String(globalIdx + 1).padStart(3, '0')}`
          : globalIdx < 80
          ? `r_${String(globalIdx - 39).padStart(3, '0')}`
          : `w_00${globalIdx - 79}`;
        const isEssay = globalIdx >= 80;

        return {
          questionId: qId,
          partId: partNumber,
          type: isEssay ? 'ESSAY' : 'SINGLE_CHOICE',
          verdict: (isEssay ? 'PENDING' : 'CORRECT') as ReviewVerdict,
          explanation: `Detailed explanation for ${qId}`,
          correctAnswer: isEssay ? null : 'A',
          userAnswer: isEssay ? 'My candidate essay response' : 'A',
          score: isEssay ? null : 1,
        };
      });
      qOffset += count;

      const review = normalizeAttemptReview({
        attemptId: 42,
        partId: partNumber,
        partStats: {
          score: partNumber >= 8 ? 0 : count,
          correctCount: partNumber >= 8 ? 0 : count,
          incorrectCount: 0,
          unansweredCount: partNumber >= 8 ? count : 0,
          totalQuestions: count,
          accuracy: partNumber >= 8 ? 0 : 100,
          isCorrectFlags: null,
        },
        questions: partQuestions,
      }, 42, partNumber);

      expect(review.questions).toHaveLength(count);
      allNormalizedQuestions.push(...review.questions);
    }

    expect(allNormalizedQuestions).toHaveLength(82);

    // Assert all 82 IDs
    const expectedIds = [
      ...Array.from({ length: 40 }, (_, i) => `l_${String(i + 1).padStart(3, '0')}`),
      ...Array.from({ length: 40 }, (_, i) => `r_${String(i + 1).padStart(3, '0')}`),
      'w_001', 'w_002',
    ];
    expect(allNormalizedQuestions.map(q => q.questionId)).toEqual(expectedIds);

    // Assert all 82 explanations are present and non-empty
    for (const q of allNormalizedQuestions) {
      expect(q.explanation).toBeTruthy();
      expect(q.explanation).toContain(q.questionId);
    }

    // Assert Writing tasks (w_001, w_002) are not objectively graded
    const writingReviews = allNormalizedQuestions.filter(q => q.questionId === 'w_001' || q.questionId === 'w_002');
    expect(writingReviews).toHaveLength(2);
    for (const wq of writingReviews) {
      expect(wq.type).toBe('ESSAY');
      expect(wq.verdict).toBe('PENDING');
      expect(wq.correctAnswer).toBeNull();
      expect(wq.score).toBeNull();
      expect(wq.explanation).toBe(`Detailed explanation for ${wq.questionId}`);
    }
  });

  it('hydrates real workspace hook and answers reducer with Cambridge V2 fixture and records learner responses for all sections', async () => {
    const fixture = buildCambridgeWorkspaceFixture();
    http.get.mockResolvedValueOnce(envelope(fixture) as never);

    const store = configureStore({ reducer: { answers: answerReducer } });
    const { result } = renderHook(() => useWorkspace(42), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace?.exam_snapshot?.sections).toHaveLength(3);

    // Verify all 82 questions exist across the 9 parts in the hydrated snapshot
    const snapshotSections = result.current.workspace?.exam_snapshot?.sections ?? [];
    const allSnapshotParts = snapshotSections.flatMap(s => s.parts ?? []);
    expect(allSnapshotParts).toHaveLength(9);

    const allQuestions = allSnapshotParts.flatMap(p =>
      (p.questionGroups ?? p.question_groups ?? []).flatMap((g: any) => g.questions ?? [])
    );
    expect(allQuestions).toHaveLength(82);

    // Verify Redux was hydrated
    expect(store.getState().answers.attemptId).toBe(42);
    expect(store.getState().answers.version).toBe(1);
    expect(store.getState().answers.isLocked).toBe(false);

    // Test answering across Listening, Reading, and both Writing tasks
    act(() => {
      store.dispatch(setAnswer({ partId: 1, questionId: 'l_001', value: 'B' }));
      store.dispatch(setAnswer({ partId: 5, questionId: 'r_001', value: 'C' }));
      store.dispatch(setAnswer({ partId: 8, questionId: 'w_001', value: 'Essay response for Task 1' }));
      store.dispatch(setAnswer({ partId: 9, questionId: 'w_002', value: 'Essay response for Task 2' }));
    });

    const state = store.getState().answers.answers;
    expect(state[1]?.['l_001']).toBe('B');
    expect(state[5]?.['r_001']).toBe('C');
    expect(state[8]?.['w_001']).toBe('Essay response for Task 1');
    expect(state[9]?.['w_002']).toBe('Essay response for Task 2');
  });

  it('renders WorkspacePage with Cambridge V2 fixture, navigating all 82 questions and interacting with Writing tasks', async () => {
    const fixture = buildCambridgeWorkspaceFixture();
    http.get.mockResolvedValueOnce(envelope(fixture) as never);

    const store = configureStore({
      reducer: { answers: answerReducer },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/attempts/42/workspace']}>
          <Routes>
            <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Wait for workspace page to load and render exam title
    await waitFor(() => {
      expect(screen.getByText('Cambridge IELTS 20 Test 1')).toBeInTheDocument();
    });

    // Verify question palette has 82 questions
    const questionButtons = screen.getAllByTestId(/^palette-/);
    expect(questionButtons).toHaveLength(82);

    // Find and click question w_001 (Writing Task 1)
    const task1Button = screen.getByTestId('palette-w_001');
    expect(task1Button).toBeDefined();
    fireEvent.click(task1Button);

    // Verify textarea is available for writing task
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Viết bài tự luận của bạn tại đây...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Viết bài tự luận của bạn tại đây...');
    fireEvent.change(textarea, { target: { value: 'This is my comprehensive IELTS Task 1 report based on the provided chart.' } });

    // Word count badge should reflect words
    expect(screen.getByTestId('essay-word-count')).toHaveTextContent(/13 \/ 150 từ/);

    // Verify Redux state updated with the essay answer for part 8
    expect(store.getState().answers.answers[8]?.['w_001']).toBe(
      'This is my comprehensive IELTS Task 1 report based on the provided chart.'
    );
  });
  it('autosaves both Cambridge Writing tasks using snapshot Part IDs and accepts the server version', async () => {
    vi.useFakeTimers();
    const { store } = mountWritingWorkspace();
    http.put.mockResolvedValueOnce(envelope({ version: 7 }) as never);
    await advance();

    expect(screen.getByText('Cambridge IELTS 20 Test 1')).toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith('/v1/attempts/42/workspace');
    writeEssay('w_001', '  Task 1 report — biểu đồ 😀  ');
    writeEssay('w_002', 'Task 2 essay\nA second paragraph.');
    expect(store.getState().answers.isDirty).toBe(true);
    await advance(14999);
    expect(http.put).not.toHaveBeenCalled();
    await advance(1);

    expect(http.put).toHaveBeenCalledExactlyOnceWith('/v1/attempts/42/answers', {
      version: 1,
      answers: [
        { part_id: 3087, answers: [{ question_id: 'w_001', answer: '  Task 1 report — biểu đồ 😀  ' }] },
        { part_id: 4093, answers: [{ question_id: 'w_002', answer: 'Task 2 essay\nA second paragraph.' }] },
      ],
    }, expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 10000 }));
    expect(store.getState().answers.version).toBe(7);
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.isDirty).toBe(false);
    await advance(15000);
    expect(http.put).toHaveBeenCalledTimes(1);
  });

  it('waits for in-flight Cambridge Writing autosave before submitting both latest essays with the acknowledged version', async () => {
    vi.useFakeTimers();
    const { store } = mountWritingWorkspace();
    let acknowledgeSave!: (value: unknown) => void;
    http.put.mockReturnValueOnce(new Promise(resolve => { acknowledgeSave = resolve; }) as never);
    let acknowledgeSubmit!: (value: unknown) => void;
    http.post.mockReturnValueOnce(new Promise(resolve => { acknowledgeSubmit = resolve; }) as never);
    await advance();

    writeEssay('w_001', 'Task 1 report');
    writeEssay('w_002', 'Task 2 draft');
    await advance(15000);
    expect(http.put).toHaveBeenCalledExactlyOnceWith('/v1/attempts/42/answers', {
      version: 1,
      answers: [
        { part_id: 3087, answers: [{ question_id: 'w_001', answer: 'Task 1 report' }] },
        { part_id: 4093, answers: [{ question_id: 'w_002', answer: 'Task 2 draft' }] },
      ],
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(store.getState().answers.saveStatus).toBe('saving');

    writeEssay('w_002', '  Task 2 final essay\nGiữ nguyên nội dung.  ');
    fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));
    await advance(2000); // The real confirmation dialog waits because other questions are unanswered.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nộp bài ngay' }));
    await advance();
    expect(screen.getByPlaceholderText('Viết bài tự luận của bạn tại đây...')).toBeDisabled();
    expect(http.post).not.toHaveBeenCalled();

    await act(async () => { acknowledgeSave(envelope({ version: 7 })); });
    expect(store.getState().answers.version).toBe(7);
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/v1/attempts/42/submit', {
      reason: 'MANUAL',
      baseVersion: 7,
      finalAnswers: [
        { part_id: 3087, answers: [{ question_id: 'w_001', answer: 'Task 1 report' }] },
        { part_id: 4093, answers: [{ question_id: 'w_002', answer: '  Task 2 final essay\nGiữ nguyên nội dung.  ' }] },
      ],
    }, expect.objectContaining({ signal: expect.any(AbortSignal), timeout: 10000 }));
    await act(async () => {
      acknowledgeSubmit(envelope({ attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' }));
    });
    expect(screen.getByTestId('cambridge-result')).toBeInTheDocument();
    await advance(15000);
    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledTimes(1);
  });

});
