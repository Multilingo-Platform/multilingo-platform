import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { setAttemptContext } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import * as workspaceHookModule from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';
import type { WorkspaceResponse } from '../types/api.types';
import { useAutosave } from '../hooks/useAutosave';

vi.mock('../hooks/useWorkspace');
vi.mock('../api/attemptApi');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

const baseWorkspace: WorkspaceResponse = {
  attempt_id: 99,
  status: 'IN_PROGRESS' as const,
  test_scope: 'FULL_EXAM' as const,
  test_mode: 'MOCK_TEST' as const,
  startTime: new Date(Date.now() - 60_000).toISOString(),
  deadline: new Date(Date.now() + 3600_000).toISOString(),
  serverTime: new Date().toISOString(),
  gracePeriodSeconds: 15,
  lockedSections: [],
  exam_snapshot: { exam_id: 1, code: 'T', title: 'Test Exam', type: 'IELTS', sections: [] },
  version: 1,
  saved_answers: [],
  serverTimeOffset: 0,
};

function makeStore(isDirty = false) {
  return configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        attemptId: 99,
        version: 1,
        answers: (isDirty ? { 1: { q1: 'A' } } : {}) as Record<number, Record<string, import('../types/answer.types').AnswerValue>>,
        isDirty,
        lastSavedAt: null,
        saveStatus: 'idle' as const,
        pendingVersion: isDirty ? 1 : 0,
        flags: {},
        highlights: {},
      },
    },
  });
}

function renderPage(store: ReturnType<typeof makeStore>, route = '/attempts/99/workspace') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          <Route path="/attempts/:attemptId/result" element={<div data-testid="result-route-sentinel">Result Page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

function mockHookResult(overrides: Partial<workspaceHookModule.UseWorkspaceResult> = {}): workspaceHookModule.UseWorkspaceResult {
  return {
    workspace: baseWorkspace,
    loading: false,
    error: null,
    ready: true,
    retry: vi.fn(),
    refreshing: false,
    refreshError: null,
    refreshMetadata: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('WorkspacePage', () => {
  it('renders Timer when mode is MOCK_TEST', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: { ...baseWorkspace, deadline: new Date(Date.now() + 3600_000).toISOString() },
      })
    );
    renderPage(makeStore());
    expect(screen.getByText(/:\d{2}$/)).toBeDefined();
  });

  it('does not crash with empty sections', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
    expect(() => renderPage(makeStore())).not.toThrow();
  });

  it('renders questions directly from part.questions array and renders passageHtml', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'IELTS Test',
            type: 'IELTS',
            sections: [
              {
                id: 1,
                skill_type: 'READING' as const,
                title: 'Reading',
                duration_minutes: 60,
                parts: [
                  {
                    id: 1,
                    title: 'Reading Part 1',
                    contentHtml: '<p>Direct passage test</p>',
                    questions: [
                      {
                        id: 1,
                        question_id: 'q_1',
                        question_number: 1,
                        type: 'SINGLE_CHOICE',
                        question_text: 'Direct question text',
                        options: [{ id: 'A', text: 'Option A' }],
                      },
                    ],
                  } as any,
                ],
              },
            ],
          },
        },
      })
    );
    renderPage(makeStore());
    expect(screen.getByText('Direct question text')).toBeDefined();
    expect(screen.getByText('Direct passage test')).toBeDefined();
  });

  it('renders canonical reading question groups in order with group instructions and stable answer ids', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'IELTS Test',
            type: 'IELTS',
            sections: [
              {
                id: 1,
                skill_type: 'READING' as const,
                title: 'Reading',
                duration_minutes: 60,
                parts: [
                  {
                    id: 42,
                    title: 'Reading Part 1',
                    content: {
                      part_title: 'Reading Part 1',
                      instruction: 'Read the passage and answer all questions.',
                      shared_audio: null,
                      shared_media: null,
                      content_html: '<p>Canonical reading passage</p>',
                      question_groups: [
                        {
                          group_id: 'reading-group-1',
                          instruction: 'Group one instruction',
                          context_html: null,
                          shared_audio: null,
                          shared_media: null,
                          questions: [
                            {
                              question_id: 'reading-q-1',
                              question_number: 1,
                              type: 'SINGLE_CHOICE',
                              question_text: 'First grouped question',
                              options: [{ id: 'A', text: 'First option' }],
                              media: null,
                            },
                          ],
                        },
                        {
                          group_id: 'reading-group-2',
                          instruction: 'Group two instruction',
                          context_html: null,
                          shared_audio: null,
                          shared_media: null,
                          questions: [
                            {
                              question_id: 'reading-q-2',
                              question_number: 2,
                              type: 'SINGLE_CHOICE',
                              question_text: 'Second grouped question',
                              options: [{ id: 'B', text: 'Second option' }],
                              media: null,
                            },
                          ],
                        },
                      ],
                    },
                  } as any,
                ],
              },
            ],
          },
        },
      })
    );

    const store = makeStore();
    renderPage(store);

    const groups = screen.getAllByTestId(/^question-group-/);
    expect(groups.map(group => group.getAttribute('data-group-id'))).toEqual([
      'reading-group-1',
      'reading-group-2',
    ]);
    expect(within(groups[0]).getByText('Group one instruction')).toBeInTheDocument();
    expect(within(groups[0]).getByText('First grouped question')).toBeInTheDocument();
    expect(within(groups[1]).getByText('Group two instruction')).toBeInTheDocument();
    expect(within(groups[1]).getByText('Second grouped question')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'First option' }));
    expect(store.getState().answers.answers[42]?.['reading-q-1']).toBe('A');
  });

  it('renders listening part and group audio/media/content in canonical order', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'IELTS Listening Test',
            type: 'IELTS',
            sections: [
              {
                id: 2,
                skill_type: 'LISTENING' as const,
                title: 'Listening',
                duration_minutes: 40,
                parts: [
                  {
                    id: 7,
                    title: 'Listening Part 1',
                    content: {
                      part_title: 'Listening Part 1',
                      instruction: 'Listen and answer the questions.',
                      shared_audio: { url: 'https://cdn.example/part.mp3' },
                      shared_media: { type: 'image', url: 'https://cdn.example/part.png' },
                      content_html: '<p>Part listening context</p><script>window.__xss=1</script>',
                      question_groups: [
                        {
                          group_id: 'listening-group-1',
                          instruction: 'Listen to this conversation.',
                          context_html: '<p>Group listening context</p>',
                          shared_audio: { url: 'https://cdn.example/group.mp3' },
                          shared_media: { type: 'image', url: 'https://cdn.example/group.png' },
                          questions: [
                            {
                              question_id: 'listening-q-1',
                              question_number: 1,
                              type: 'SINGLE_CHOICE',
                              question_text: 'What is the speaker discussing?',
                              options: [{ id: 'A', text: 'A schedule' }],
                              media: { type: 'image', url: 'https://cdn.example/question.png' },
                            },
                          ],
                        },
                      ],
                    },
                  } as any,
                ],
              },
            ],
          },
        },
      })
    );

    const view = renderPage(makeStore());

    expect(screen.getByText('Listen and answer the questions.')).toBeInTheDocument();
    expect(screen.getByText('Listen to this conversation.')).toBeInTheDocument();
    expect(screen.getByText('Part listening context')).toBeInTheDocument();
    expect(screen.getByText('Group listening context')).toBeInTheDocument();
    expect(view.container.querySelectorAll('audio')).toHaveLength(2);
    expect(Array.from(view.container.querySelectorAll('img')).map(img => img.getAttribute('src'))).toEqual([
      'https://cdn.example/part.png',
      'https://cdn.example/group.png',
      'https://cdn.example/question.png',
    ]);
    expect(view.container.querySelector('script')).toBeNull();
  });

  it('disables controls and prevents answer updates in locked MOCK_TEST sections', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          test_mode: 'MOCK_TEST' as const,
          test_scope: 'SINGLE_SKILL' as const,
          lockedSections: [91],
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'Locked section test',
            type: 'IELTS',
            sections: [
              {
                id: 91,
                skill_type: 'READING' as const,
                title: 'Reading',
                duration_minutes: 60,
                parts: [
                  {
                    id: 903,
                    content: {
                      part_title: 'Reading Part 1',
                      instruction: 'Locked section instruction',
                      shared_audio: null,
                      shared_media: null,
                      content_html: '<p>Locked passage</p>',
                      question_groups: [
                        {
                          group_id: 'locked-group',
                          instruction: null,
                          context_html: null,
                          shared_audio: null,
                          shared_media: null,
                          questions: [
                            {
                              question_id: 'locked-question-id',
                              question_number: 1,
                              type: 'SINGLE_CHOICE',
                              question_text: 'Locked question',
                              options: [{ id: 'A', text: 'Locked option' }],
                              media: null,
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      })
    );

    const store = makeStore();
    renderPage(store);

    const control = screen.getByRole('radio', { name: 'Locked option' });
    expect(control).toBeDisabled();
    expect(screen.getByTestId('flag-btn-locked-question-id')).toBeDisabled();
    fireEvent.click(control);
    expect(store.getState().answers.answers[903]).toBeUndefined();
  });

  it('renders real PartFixture questionGroups once and numbers canonical questions by order', () => {
    const groupedQuestions = [
      {
        question_id: 'backend-reading-alpha',
        type: 'SINGLE_CHOICE',
        question_text: 'Backend first question',
        options: [{ id: 'A', text: 'Backend first option' }],
        media: null,
      },
      {
        question_id: 'backend-reading-beta',
        type: 'SINGLE_CHOICE',
        question_text: 'Backend second question',
        options: [{ id: 'B', text: 'Backend second option' }],
        media: null,
      },
    ];
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'Real backend snapshot',
            type: 'IELTS',
            sections: [{
              id: 1,
              skill_type: 'READING' as const,
              title: 'Reading',
              duration_minutes: 60,
              parts: [{
                id: 42,
                partNumber: 1,
                title: 'Reading Part 1',
                partTitle: 'Backend Reading Part',
                instruction: 'Backend reading instruction',
                contentHtml: '<p>Backend reading passage</p>',
                sharedAudio: null,
                sharedMedia: null,
                questionGroups: [
                  {
                    group_id: 'backend-reading-group-1',
                    instruction: 'Backend group one instruction',
                    content_html: null,
                    shared_audio: null,
                    shared_media: null,
                    questions: [groupedQuestions[0]],
                  },
                  {
                    group_id: 'backend-reading-group-2',
                    instruction: 'Backend group two instruction',
                    content_html: null,
                    shared_audio: null,
                    shared_media: null,
                    questions: [groupedQuestions[1]],
                  },
                ],
                questions: groupedQuestions,
              } as any],
            }],
          },
        },
      })
    );

    const store = makeStore();
    const view = renderPage(store);

    const groups = screen.getAllByTestId(/^question-group-backend-reading-group-/);
    expect(groups.map(group => group.getAttribute('data-group-id'))).toEqual([
      'backend-reading-group-1',
      'backend-reading-group-2',
    ]);
    expect(screen.getAllByText('Backend first question')).toHaveLength(1);
    expect(screen.getAllByText('Backend second question')).toHaveLength(1);
    expect(within(view.container.querySelector('#q-backend-reading-alpha') as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(view.container.querySelector('#q-backend-reading-beta') as HTMLElement).getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Backend first option' }));
    expect(store.getState().answers.answers[42]?.['backend-reading-alpha']).toBe('A');
  });

  it('renders real PartFixture camelCase content and nested group media hierarchy', () => {
    const question = {
      question_id: 'backend-listening-id',
      type: 'SINGLE_CHOICE',
      question_text: 'Backend listening question',
      options: [{ id: 'A', text: 'Backend listening option' }],
      media: { type: 'image', url: 'https://cdn.example/backend-question.png' },
    };
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'Real backend listening snapshot',
            type: 'IELTS',
            sections: [{
              id: 2,
              skill_type: 'LISTENING' as const,
              title: 'Listening',
              duration_minutes: 40,
              parts: [{
                id: 84,
                partNumber: 1,
                title: 'Listening Part 1',
                partTitle: 'Backend Listening Part',
                instruction: 'Backend listening instruction',
                contentHtml: '<p>Backend listening context</p><script>window.__xss=1</script>',
                sharedAudio: { url: 'https://cdn.example/backend-part.mp3' },
                sharedMedia: { type: 'image', url: 'https://cdn.example/backend-part.png' },
                questionGroups: [{
                  group_id: 'backend-listening-group',
                  instruction: 'Backend listening group instruction',
                  content_html: '<p>Backend group context</p>',
                  shared_audio: { url: 'https://cdn.example/backend-group.mp3' },
                  shared_media: { type: 'image', url: 'https://cdn.example/backend-group.png' },
                  questions: [question],
                }],
                questions: [question],
              } as any],
            }],
          },
        },
      })
    );

    const view = renderPage(makeStore());

    expect(screen.getByText('Backend listening context')).toBeInTheDocument();
    expect(screen.getByText('Backend group context')).toBeInTheDocument();
    expect(view.container.querySelectorAll('audio')).toHaveLength(2);
    expect(Array.from(view.container.querySelectorAll('img')).map(img => img.getAttribute('src'))).toEqual([
      'https://cdn.example/backend-part.png',
      'https://cdn.example/backend-group.png',
      'https://cdn.example/backend-question.png',
    ]);
    expect(screen.getAllByText('Backend listening question')).toHaveLength(1);
    expect(view.container.querySelector('script')).toBeNull();
  });

  it('renders pane divider and flag toggle button on question card', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: {
            exam_id: 1,
            code: 'T',
            title: 'IELTS Test',
            type: 'IELTS',
            sections: [
              {
                id: 1,
                skill_type: 'READING' as const,
                title: 'Reading',
                duration_minutes: 60,
                parts: [
                  {
                    id: 1,
                    title: 'Reading Part 1',
                    contentHtml: '<p>Direct passage test</p>',
                    questions: [
                      {
                        id: 1,
                        question_id: 'q_1',
                        question_number: 1,
                        type: 'SINGLE_CHOICE',
                        question_text: 'Direct question text',
                        options: [{ id: 'A', text: 'Option A' }],
                      },
                    ],
                  } as any,
                ],
              },
            ],
          },
        },
      })
    );

    const store = makeStore();
    renderPage(store);

    // Verify pane divider exists
    const divider = screen.getByTestId('pane-divider');
    expect(divider).toBeInTheDocument();

    // Verify flag button exists and can be clicked
    const flagBtn = screen.getByTestId('flag-btn-q_1');
    expect(flagBtn).toBeInTheDocument();
    expect(flagBtn).toHaveTextContent('Xem lại');

    fireEvent.click(flagBtn);
    expect(store.getState().answers.flags?.[1]?.['q_1']).toBe(true);
    expect(flagBtn).toHaveTextContent('Đã xem lại');
  });
});

describe('WorkspacePage submit flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
  });

  it('flushes dirty answers to server before submitting', async () => {
    const mockAutoSave = vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce({ version: 2 } as any);
    const mockSubmit = vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/result',
    });

    const store = makeStore(true); // isDirty = true
    renderPage(store);

    // Submit button must be enabled even when isDirty=true
    const submitBtn = screen.getByRole('button', { name: /nộp bài/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    // Modal confirm button — also labelled "Nộp bài" (second occurrence)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    const confirmBtn = screen.getAllByRole('button', { name: /nộp bài/i })[1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockAutoSave).toHaveBeenCalledTimes(1);
      expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    // autosave must be called BEFORE submit
    const autoSaveOrder = mockAutoSave.mock.invocationCallOrder[0];
    const submitOrder = mockSubmit.mock.invocationCallOrder[0];
    expect(autoSaveOrder).toBeLessThan(submitOrder);
  });

  it('does NOT call autosave before submit when isDirty=false', async () => {
    vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/result',
    });

    const store = makeStore(false); // isDirty = false
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    await waitFor(() => {
      expect(vi.mocked(attemptApi.autosaveAnswers)).not.toHaveBeenCalled();
      expect(vi.mocked(attemptApi.submitAttempt)).toHaveBeenCalledTimes(1);
    });
  });

  it('removes localStorage draft after successful submit', async () => {
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce({ version: 2 });
    vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/result',
    });
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');

    const store = makeStore(true);
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith('exam_draft_99');
    });
    removeSpy.mockRestore();
  });

  it('renders dynamic skill header "Task 1 / 2" instead of "Passage" when in Writing section', async () => {
    const mockWritingWorkspace = {
      ...baseWorkspace,
      test_mode: 'PRACTICE' as const,
      exam_snapshot: {
        exam_id: 1,
        code: 'IE01',
        title: 'IELTS Mock Test – Full',
        type: 'IELTS',
        sections: [
          {
            id: 1,
            skill_type: 'READING' as const,
            title: 'Reading',
            duration_minutes: 60,
            parts: [
              { id: 1, title: 'Reading Part 1' },
              { id: 2, title: 'Reading Part 2' },
              { id: 3, title: 'Reading Part 3' },
            ],
          },
          {
            id: 2,
            skill_type: 'WRITING' as const,
            title: 'Writing',
            duration_minutes: 60,
            parts: [
              { id: 6, title: 'Writing Task 2', questions: [{ id: 8, question_id: 'q8', question_number: 8, type: 'ESSAY' as const, question_text: 'Task 2 prompt' }] },
              { id: 7, title: 'Writing Task 1', questions: [{ id: 9, question_id: 'q9', question_number: 9, type: 'ESSAY' as const, question_text: 'Task 1 prompt' }] },
            ],
          },
        ],
      },
    };

    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: mockWritingWorkspace as any,
      })
    );

    renderPage(makeStore());

    // Click to select Writing Task 1
    const task1Btn = screen.getByRole('button', { name: /writing task 1/i });
    fireEvent.click(task1Btn);

    const headerBadge = screen.getByTestId('header-part-badge');
    expect(headerBadge.textContent).toBe('Task 1 / 2');
    expect(headerBadge.textContent).not.toContain('Passage');
  });

  it('passes dynamic minWords extracted from question text to EssayRenderer', async () => {
    const mockWritingWorkspace = {
      ...baseWorkspace,
      exam_snapshot: {
        exam_id: 1,
        code: 'IE01',
        title: 'IELTS Mock Test',
        type: 'IELTS',
        sections: [
          {
            id: 2,
            skill_type: 'WRITING' as const,
            title: 'Writing',
            duration_minutes: 60,
            parts: [
              {
                id: 7,
                title: 'Writing Task 1',
                questions: [
                  {
                    id: 9,
                    question_id: 'q9',
                    question_number: 9,
                    type: 'ESSAY' as const,
                    question_text: 'Summarize the key trends shown in global language adoption. (Minimum 100 words)',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: mockWritingWorkspace as any,
      })
    );

    renderPage(makeStore());

    expect(screen.getByText(/0 \/ 100 từ/i)).toBeDefined();
  });
});


describe('WorkspacePage TV3-06 Server-Authoritative Autosave & Pre-Submit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
  });

  it('serializes pre-submit flush with background autosave to avoid overlapping requests with the same version', async () => {
    const store = makeStore(true);
    // Simulate background autosave is in flight
    store.dispatch({ type: 'answers/markSavePending', payload: 1 });

    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    // Submit handler should wait while saveStatus === 'saving'
    await new Promise(r => setTimeout(r, 150));
    expect(vi.mocked(attemptApi.autosaveAnswers)).not.toHaveBeenCalled();

    // User made an edit during background save, so isDirty remains true when background completes
    store.dispatch({
      type: 'answers/setAnswer',
      payload: { partId: 1, questionId: 'q2', value: 'B' },
    });

    // Mock direct flush and submit responses
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce({ version: 3 });
    const mockSubmit = vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/attempts/99/result',
    });

    // Background autosave completes with serverVersion: 2
    store.dispatch({
      type: 'answers/markSaveSuccess',
      payload: { savedAt: Date.now(), pendingVersion: 1, serverVersion: 2 },
    });

    // Submit handler exits loop, reads state.version = 2, and flushes with version 2
    await waitFor(() => {
      expect(vi.mocked(attemptApi.autosaveAnswers)).toHaveBeenCalledWith(
        99,
        expect.objectContaining({ version: 2 })
      );
    });

    // Submit should use the updated server version 3 from direct flush
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        99,
        expect.objectContaining({ version: 3, baseVersion: 3 })
      );
    });
  });

  it('handles 1601 Version Conflict from direct flush without navigating to result page', async () => {
    const conflictError = Object.assign(new Error('Conflict'), {
      response: { data: { code: 1601 } },
    });
    vi.mocked(attemptApi.autosaveAnswers).mockRejectedValueOnce(conflictError);
    const mockSubmit = vi.mocked(attemptApi.submitAttempt);

    const store = makeStore(true);
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    // SaveStatus must transition to conflict
    await waitFor(() => {
      expect(store.getState().answers.saveStatus).toBe('conflict');
    });

    // SubmitAttempt must NOT have been called
    expect(mockSubmit).not.toHaveBeenCalled();
    // isDirty must remain true
    expect(store.getState().answers.isDirty).toBe(true);
    // Overlay must be closed so user can view conflict badge
    expect(screen.queryByTestId('submit-overlay')).not.toBeInTheDocument();
  });

  it('releases saving status to error when direct flush fails on network error and allows retry', async () => {
    vi.mocked(attemptApi.autosaveAnswers).mockRejectedValueOnce(new Error('Network offline'));
    const mockSubmit = vi.mocked(attemptApi.submitAttempt);

    const store = makeStore(true);
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    // SaveStatus must transition to error, NOT left in saving
    await waitFor(() => {
      expect(store.getState().answers.saveStatus).toBe('error');
    });

    expect(mockSubmit).not.toHaveBeenCalled();
    expect(store.getState().answers.isDirty).toBe(true);
    // Draft saved to localStorage
    expect(localStorage.getItem('exam_draft_99')).not.toBeNull();

    // Submit overlay displays retry button
    const retryBtn = screen.getByRole('button', { name: /thử nộp lại/i });
    expect(retryBtn).toBeInTheDocument();

    // Mock retry success
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce({ version: 2 });
    mockSubmit.mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/attempts/99/result',
    });

    // Click retry
    fireEvent.click(retryBtn);

    // Direct flush should run again and submit should succeed
    await waitFor(() => {
      expect(vi.mocked(attemptApi.autosaveAnswers)).toHaveBeenCalledTimes(2);
      expect(mockSubmit).toHaveBeenCalledWith(
        99,
        expect.objectContaining({ version: 2, baseVersion: 2 })
      );
    });
  });

  it('releases saving status to error when direct flush fails due to invalid response', async () => {
    vi.mocked(attemptApi.autosaveAnswers).mockRejectedValueOnce(
      new Error('Invalid version response: NaN')
    );

    const store = makeStore(true);
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    await waitFor(() => {
      expect(store.getState().answers.saveStatus).toBe('error');
    });

    expect(vi.mocked(attemptApi.submitAttempt)).not.toHaveBeenCalled();
    expect(store.getState().answers.isDirty).toBe(true);
  });

  it('preserves newly synced server version in Redux store when submitAttempt fails', async () => {
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce({ version: 5 });
    vi.mocked(attemptApi.submitAttempt).mockRejectedValueOnce(new Error('Submit 500 error'));

    const store = makeStore(true);
    renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    // Redux store version must be updated to 5 from flush response even though submit failed
    await waitFor(() => {
      expect(store.getState().answers.version).toBe(5);
    });
    expect(store.getState().answers.saveStatus).toBe('saved');
  });

  it('passes retry callback from useWorkspace to SaveStatusBadge', () => {
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        retry: mockRetry,
      })
    );

    const store = makeStore(false);
    store.dispatch({ type: 'answers/markSaveConflict' });

    renderPage(store);

    const reloadBtn = screen.getByRole('button', { name: /tải lại bản mới nhất/i });
    expect(reloadBtn).toBeInTheDocument();
    fireEvent.click(reloadBtn);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('pre-submit flush ignores delayed response if component unmounts before completion', async () => {
    let resolveFlush: (val: any) => void = () => {};
    const deferredFlush = new Promise(resolve => {
      resolveFlush = resolve;
    });

    vi.mocked(attemptApi.autosaveAnswers).mockReturnValueOnce(deferredFlush as any);
    const mockSubmit = vi.mocked(attemptApi.submitAttempt);

    const store = makeStore(true);
    const view = renderPage(store);

    fireEvent.click(screen.getByRole('button', { name: /nộp bài/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);

    // Wait for autosaveAnswers to be called
    await waitFor(() => {
      expect(vi.mocked(attemptApi.autosaveAnswers)).toHaveBeenCalledTimes(1);
    });

    // Unmount before flush resolves
    view.unmount();

    // Now resolve flush
    resolveFlush({ version: 2 });
    await new Promise(r => setTimeout(r, 100));

    // submitAttempt should not be called after unmount
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('WorkspacePage TV3-07-05 Resume UX, Timer & Terminal/Locked State', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult());
  });

  it('calls useAutosave with null when not ready, loading, error, attemptId mismatch, or terminal status, and with attemptId when active IN_PROGRESS', () => {
    // 1. ready = false
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult({ ready: false }));
    const view1 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(null);
    view1.unmount();

    // 2. loading = true
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult({ loading: true, ready: false }));
    const view2 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(null);
    view2.unmount();

    // 3. error present
    vi.mocked(workspaceHookModule.default).mockReturnValue(mockHookResult({ error: 'Failed', ready: false }));
    const view3 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(null);
    view3.unmount();

    // 4. attemptId mismatch (route 99, workspace attempt_id 88)
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({ workspace: { ...baseWorkspace, attempt_id: 88 } })
    );
    const view4 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(null);
    view4.unmount();

    // 5. terminal status
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({ workspace: { ...baseWorkspace, status: 'COMPLETED' } })
    );
    const view5 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(null);
    view5.unmount();

    // 6. active IN_PROGRESS
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({ workspace: { ...baseWorkspace, attempt_id: 99, status: 'IN_PROGRESS' }, ready: true })
    );
    const view6 = renderPage(makeStore());
    expect(useAutosave).toHaveBeenLastCalledWith(99);
    view6.unmount();
  });

  const terminalStatuses: import('../types/answer.types').AttemptStatus[] = [
    'SUBMITTED',
    'AI_GRADING_QUEUED',
    'AI_GRADING',
    'GRADING_FAILED',
    'COMPLETED',
    'EXPIRED',
  ];

  it.each(terminalStatuses)(
    'navigates to result route sentinel and triggers neither autosave nor submit for terminal status %s',
    async (status) => {
      vi.mocked(workspaceHookModule.default).mockReturnValue(
        mockHookResult({
          ready: true,
          workspace: { ...baseWorkspace, status },
        })
      );

      renderPage(makeStore());

      await waitFor(() => {
        expect(screen.getByTestId('result-route-sentinel')).toBeInTheDocument();
      });

      expect(useAutosave).toHaveBeenLastCalledWith(null);
      expect(attemptApi.autosaveAnswers).not.toHaveBeenCalled();
      expect(attemptApi.submitAttempt).not.toHaveBeenCalled();
    }
  );

  it('does not submit when stale expired workspace of attempt A is on route of attempt B', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        ready: true,
        workspace: {
          ...baseWorkspace,
          attempt_id: 88,
          deadline: new Date(Date.now() - 60_000).toISOString(),
        },
      })
    );

    renderPage(makeStore(), '/attempts/99/workspace');

    expect(screen.queryByTestId('time-up-modal')).not.toBeInTheDocument();
    expect(attemptApi.submitAttempt).not.toHaveBeenCalled();
  });

  const multiSectionSnapshot = {
    exam_id: 1,
    code: 'IELTS-TEST',
    title: 'IELTS Academic Mock',
    type: 'IELTS',
    sections: [
      {
        id: 100,
        section_id: 100,
        skill_type: 'LISTENING' as const,
        title: 'Listening Section',
        duration_minutes: 30,
        parts: [
          {
            id: 10,
            part_id: 10,
            title: 'Listening Part 1',
            questions: [
              {
                id: 1,
                question_id: 'q1',
                question_number: 1,
                type: 'SINGLE_CHOICE',
                question_text: 'Question 1',
                options: [{ id: 'A', text: 'Opt A' }],
              },
            ],
          },
        ],
      },
      {
        id: 200,
        section_id: 200,
        skill_type: 'READING' as const,
        title: 'Reading Section',
        duration_minutes: 60,
        parts: [
          {
            id: 20,
            part_id: 20,
            title: 'Reading Part 2',
            contentHtml: '<p>Reading passage</p>',
            questions: [
              {
                id: 2,
                question_id: 'q2',
                question_number: 2,
                type: 'SINGLE_CHOICE',
                question_text: 'Question 2',
                options: [{ id: 'B', text: 'Opt B' }],
              },
            ],
          },
        ],
      },
    ],
  };

  it('resumes with first section locked: selects first part of unlocked section and disables locked section questions', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [100],
        },
      })
    );

    renderPage(makeStore());

    // Reading Part 2 should be selected because Section 100 is locked
    expect(screen.getAllByText('Reading Part 2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Question 2')).toBeInTheDocument();

    // In QuestionPalette, q1 in locked Part 10 is disabled
    const q1Btn = screen.getByTestId('palette-q1');
    expect(q1Btn).toBeDisabled();

    // q2 in unlocked Part 20 is enabled
    const q2Btn = screen.getByTestId('palette-q2');
    expect(q2Btn).not.toBeDisabled();
  });

  it('renders read-only shell when all sections are locked without fake targets or auto-submit, allowing normal submit', async () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [100, 200],
        },
      })
    );

    const store = configureStore({
      reducer: { answers: answerReducer },
      preloadedState: {
        answers: {
          attemptId: 99,
          version: 1,
          answers: {
            10: { q1: 'A' },
            20: { q2: 'B' },
          },
          isDirty: false,
          lastSavedAt: null,
          saveStatus: 'idle' as const,
          pendingVersion: 0,
          flags: {},
          highlights: {},
        },
      },
    });
    renderPage(store);

    // QuestionPalette buttons should be disabled
    expect(screen.getByTestId('palette-q1')).toBeDisabled();
    expect(screen.getByTestId('palette-q2')).toBeDisabled();

    // No auto-submit triggered just because locked
    expect(attemptApi.submitAttempt).not.toHaveBeenCalled();

    // User can still submit validly
    const submitBtn = screen.getByRole('button', { name: /nộp bài/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /nộp bài/i }).length).toBe(2));
    const confirmBtn = screen.getAllByRole('button', { name: /nộp bài/i })[1];

    vi.mocked(attemptApi.submitAttempt).mockResolvedValueOnce({
      attempt_id: 99,
      status: 'COMPLETED',
      redirect_url: '/attempts/99/result',
    });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(attemptApi.submitAttempt).toHaveBeenCalledWith(
        99,
        expect.objectContaining({ version: 1, baseVersion: 1 })
      );
    });
  });

  it('calls lockSection and refreshMetadata when switching sections without calling retry/hydrate', async () => {
    const mockRefreshMetadata = vi.fn().mockResolvedValue(true);
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [],
        },
        refreshMetadata: mockRefreshMetadata,
        retry: mockRetry,
      })
    );
    vi.mocked(attemptApi.lockSection).mockResolvedValueOnce();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage(makeStore());

    // Current part is Listening Part 1 (id: 10) in section 100
    // Click Part 20 (Reading Part 2) in section 200
    const part2Btn = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn);

    await waitFor(() => {
      expect(attemptApi.lockSection).toHaveBeenCalledWith(99, 100);
      expect(mockRefreshMetadata).toHaveBeenCalledTimes(1);
    });
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it('POST lockSection succeeds -> metadata pending then reject: immediately disables section 100 inputs/fieldset/palette, blocks Redux edits, preserves dirty answers/version, and recovers to section 200 via retry metadata', async () => {
    let _resolveMeta!: (val: boolean) => void;
    let rejectMeta!: (err: unknown) => void;
    const metaPromise = new Promise<boolean>((resolve, reject) => {
      _resolveMeta = resolve;
      rejectMeta = reject;
    });

    const mockRefreshMetadata = vi.fn().mockImplementation(() => metaPromise);
    const mockRetry = vi.fn();

    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [],
        },
        refreshMetadata: mockRefreshMetadata,
        retry: mockRetry,
      })
    );
    vi.mocked(attemptApi.lockSection).mockResolvedValueOnce();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const store = configureStore({
      reducer: { answers: answerReducer },
      preloadedState: {
        answers: {
          attemptId: 99,
          version: 5,
          answers: {
            10: { q1: 'initial_val' },
          },
          isDirty: true,
          lastSavedAt: null,
          saveStatus: 'idle' as const,
          pendingVersion: 0,
          flags: {},
          highlights: {},
        },
      },
    });

    renderPage(store);

    // Initial state: question 1 is unlocked, palette button enabled, radio option enabled
    expect(screen.getByTestId('palette-q1')).not.toBeDisabled();
    const radioOptA = screen.getByRole('radio', { name: /Opt A/i });
    expect(radioOptA).not.toBeDisabled();

    // Trigger switch to Section 200 (Reading Part 2)
    const part2Btn = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn);

    // POST lockSection resolves immediately, metadata refresh is pending
    await waitFor(() => {
      expect(attemptApi.lockSection).toHaveBeenCalledWith(99, 100);
      expect(mockRefreshMetadata).toHaveBeenCalledTimes(1);
    });

    // 1. WHILE METADATA IS PENDING:
    // UI must lock section 100 immediately
    await waitFor(() => {
      expect(screen.getByTestId('palette-q1')).toBeDisabled();
    });
    expect(document.querySelector('fieldset')).toBeDisabled();
    expect(radioOptA).toBeDisabled();
    expect(screen.getByTestId('flag-btn-q1')).toBeDisabled();

    // Attempting to edit Question 1 does not mutate Redux answers
    fireEvent.click(radioOptA);
    fireEvent.change(radioOptA, { target: { value: 'A' } });
    expect(store.getState().answers.answers[10]['q1']).toBe('initial_val');
    expect(store.getState().answers.version).toBe(5);
    expect(store.getState().answers.isDirty).toBe(true);

    // 2. METADATA REJECTS:
    await act(async () => {
      rejectMeta(new Error('Network failure'));
    });

    // Section 100 remains locked even after metadata error
    expect(screen.getByTestId('palette-q1')).toBeDisabled();
    expect(document.querySelector('fieldset')).toBeDisabled();
    expect(radioOptA).toBeDisabled();
    expect(store.getState().answers.answers[10]['q1']).toBe('initial_val');
    expect(store.getState().answers.version).toBe(5);
    expect(store.getState().answers.isDirty).toBe(true);

    // Notice banner appears with role="alert" and "Thử lại" button
    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toBeInTheDocument();

    // 3. RECOVERY VIA RETRY METADATA:
    mockRefreshMetadata.mockResolvedValueOnce(true);
    const retryBtn = within(alertBanner).getByRole('button', { name: /thử lại/i });
    fireEvent.click(retryBtn);

    // Successfully recovers and transitions to Section 200 (Reading Part 2)
    await waitFor(() => {
      expect(screen.getAllByText('Reading Part 2').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('Question 2')).toBeInTheDocument();
  });

  it('navigating to section 200 after section 100 is locked does not re-lock or prompt confirmation', async () => {
    const mockRefreshMetadata = vi.fn().mockResolvedValue(false);
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [],
        },
        refreshMetadata: mockRefreshMetadata,
      })
    );
    vi.mocked(attemptApi.lockSection).mockResolvedValueOnce();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage(makeStore());

    // Switch to Section 200
    const part2Btn = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn);

    await waitFor(() => {
      expect(attemptApi.lockSection).toHaveBeenCalledTimes(1);
    });

    // Now section 100 is locked. User clicks Part 20 again
    confirmSpy.mockClear();
    fireEvent.click(part2Btn);

    // Should NOT prompt confirm or call lockSection again
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(attemptApi.lockSection).toHaveBeenCalledTimes(1);
    // Transitions to Part 20
    await waitFor(() => {
      expect(screen.getAllByText('Reading Part 2').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('deferred lock completion from route A arriving after route B locks does not overwrite B locks, preserves disabled UI and Redux state on B without fetching A', async () => {
    let resolveLockA!: () => void;
    const lockAPromise = new Promise<void>((resolve) => {
      resolveLockA = resolve;
    });

    const mockRefreshMetaA = vi.fn().mockResolvedValue(true);
    const mockRefreshMetaB = vi.fn().mockResolvedValue(false);

    vi.mocked(attemptApi.lockSection).mockImplementation((attemptId: number) => {
      if (attemptId === 99) return lockAPromise;
      if (attemptId === 88) return Promise.resolve();
      return Promise.reject(new Error('unknown attempt'));
    });

    vi.mocked(workspaceHookModule.default).mockImplementation((attemptId: number) => {
      if (attemptId === 99) {
        return mockHookResult({
          workspace: {
            ...baseWorkspace,
            attempt_id: 99,
            exam_snapshot: multiSectionSnapshot as any,
            lockedSections: [],
          },
          refreshMetadata: mockRefreshMetaA,
        });
      }
      if (attemptId === 88) {
        return mockHookResult({
          workspace: {
            ...baseWorkspace,
            attempt_id: 88,
            exam_snapshot: multiSectionSnapshot as any,
            lockedSections: [],
          },
          refreshMetadata: mockRefreshMetaB,
        });
      }
      return mockHookResult({ workspace: null });
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const store = configureStore({
      reducer: { answers: answerReducer },
      preloadedState: {
        answers: {
          attemptId: 99,
          version: 1,
          answers: { 10: { q1: 'ans_99' } },
          isDirty: false,
          lastSavedAt: null,
          saveStatus: 'idle' as const,
          pendingVersion: 0,
          flags: {},
          highlights: {},
        },
      },
    });

    let navigateTo!: (url: string) => void;
    function NavHelper() {
      const nav = useNavigate();
      navigateTo = nav;
      return null;
    }

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/attempts/99/workspace']}>
          <NavHelper />
          <Routes>
            <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
            <Route path="/attempts/:attemptId/result" element={<div>Result</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // 1. On route 99: Trigger section lock (Section 100 -> Section 200)
    const part2Btn99 = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn99);

    expect(attemptApi.lockSection).toHaveBeenCalledWith(99, 100);

    // 2. While lock POST on 99 is pending, user navigates to Attempt 88
    act(() => {
      // Update Redux attempt context for 88
      store.dispatch(setAttemptContext({ attemptId: 88, version: 10, savedAnswers: [] }));
      navigateTo('/attempts/88/workspace');
    });

    // Wait for route 88 workspace to be rendered
    await waitFor(() => {
      expect(workspaceHookModule.default).toHaveBeenCalledWith(88);
    });

    // On route 88: Trigger section lock on 88
    const part2Btn88 = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn88);

    await waitFor(() => {
      expect(attemptApi.lockSection).toHaveBeenCalledWith(88, 100);
      expect(mockRefreshMetaB).toHaveBeenCalledTimes(1);
    });

    // On Attempt 88: Section 100 is locked, fieldset & palette are disabled
    await waitFor(() => {
      expect(screen.getByTestId('palette-q1')).toBeDisabled();
    });
    expect(document.querySelector('fieldset')).toBeDisabled();
    expect(screen.getByTestId('flag-btn-q1')).toBeDisabled();

    // 3. Late lock A completion arrives!
    await act(async () => {
      resolveLockA();
    });

    // Crucial assertions on B:
    // B must remain locked! fieldset, palette, flag-btn must still be disabled
    expect(screen.getByTestId('palette-q1')).toBeDisabled();
    expect(document.querySelector('fieldset')).toBeDisabled();
    expect(screen.getByTestId('flag-btn-q1')).toBeDisabled();

    // Attempting to edit Question 1 on B must NOT change Redux answers of B
    const radioOptA = screen.getByRole('radio', { name: /Opt A/i });
    expect(radioOptA).toBeDisabled();
    fireEvent.click(radioOptA);
    fireEvent.change(radioOptA, { target: { value: 'A' } });
    expect(store.getState().answers.attemptId).toBe(88);
    expect(store.getState().answers.version).toBe(10);
    expect(store.getState().answers.isDirty).toBe(false);

    // No extra GET was made for A after switching to B
    expect(mockRefreshMetaA).not.toHaveBeenCalled();
  });

  it('delayed metadata retry completion across route boundary does not overwrite new attempt state', async () => {
    let resolveRetryA!: (val: boolean) => void;
    const retryAPromise = new Promise<boolean>((resolve) => {
      resolveRetryA = resolve;
    });

    const mockRefreshMetaA = vi.fn().mockImplementation(() => retryAPromise);
    const mockRefreshMetaB = vi.fn().mockResolvedValue(true);

    vi.mocked(attemptApi.lockSection).mockResolvedValue();

    vi.mocked(workspaceHookModule.default).mockImplementation((attemptId: number) => {
      if (attemptId === 99) {
        return mockHookResult({
          workspace: {
            ...baseWorkspace,
            attempt_id: 99,
            exam_snapshot: multiSectionSnapshot as any,
            lockedSections: [100],
          },
          refreshError: 'Lỗi metadata cũ',
          refreshMetadata: mockRefreshMetaA,
        });
      }
      if (attemptId === 88) {
        return mockHookResult({
          workspace: {
            ...baseWorkspace,
            attempt_id: 88,
            exam_snapshot: multiSectionSnapshot as any,
            lockedSections: [],
          },
          refreshMetadata: mockRefreshMetaB,
        });
      }
      return mockHookResult({ workspace: null });
    });

    const store = makeStore();
    let navigateTo!: (url: string) => void;
    function NavHelper() {
      const nav = useNavigate();
      navigateTo = nav;
      return null;
    }

    const { unmount } = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/attempts/99/workspace']}>
          <NavHelper />
          <Routes>
            <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Click retry on alert banner on 99
    const alertEl = screen.getByRole('alert');
    const retryBtn = within(alertEl).getByRole('button', { name: /thử lại/i });
    fireEvent.click(retryBtn);

    expect(mockRefreshMetaA).toHaveBeenCalledTimes(1);

    // While retry is pending, route switches to 88
    act(() => {
      navigateTo('/attempts/88/workspace');
    });

    await waitFor(() => {
      expect(workspaceHookModule.default).toHaveBeenCalledWith(88);
    });

    // Old retry on A completes
    await act(async () => {
      resolveRetryA(true);
    });

    // Attempt 88 must NOT have errors or state from A
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Verify unmount safety
    unmount();
  });

  it('concurrent lock requests on same attempt: POST 1 succeeds and POST 2 rejects, preserves confirmed locks, disabled inputs/palette, and prevents Redux edits', async () => {
    let resolveLock1!: () => void;
    const lock1Promise = new Promise<void>((resolve) => {
      resolveLock1 = resolve;
    });
    let rejectLock2!: (err: Error) => void;
    const lock2Promise = new Promise<void>((_, reject) => {
      rejectLock2 = reject;
    });

    const mockRefreshMetadata = vi.fn().mockResolvedValue(true);

    vi.mocked(attemptApi.lockSection)
      .mockImplementationOnce(() => lock1Promise)
      .mockImplementationOnce(() => lock2Promise);

    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        workspace: {
          ...baseWorkspace,
          attempt_id: 99,
          exam_snapshot: multiSectionSnapshot as any,
          lockedSections: [],
        },
        refreshMetadata: mockRefreshMetadata,
      })
    );

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const store = configureStore({
      reducer: { answers: answerReducer },
      preloadedState: {
        answers: {
          attemptId: 99,
          version: 1,
          answers: { 10: { q1: 'initial_val' } },
          isDirty: false,
          lastSavedAt: null,
          saveStatus: 'idle' as const,
          pendingVersion: 0,
          flags: {},
          highlights: {},
        },
      },
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/attempts/99/workspace']}>
          <Routes>
            <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    // Initial state: Section 100 Part 10 is active, not locked
    expect(screen.getByTestId('palette-q1')).not.toBeDisabled();
    expect(document.querySelector('fieldset')).not.toBeDisabled();

    // 1. First click to lock Section 100 -> Section 200
    const part2Btn = screen.getByRole('button', { name: /Reading Part 2/i });
    fireEvent.click(part2Btn);
    expect(attemptApi.lockSection).toHaveBeenCalledTimes(1);

    // 2. Second click while POST 1 is still pending
    fireEvent.click(part2Btn);
    expect(attemptApi.lockSection).toHaveBeenCalledTimes(2);

    // 3. POST 1 succeeds
    await act(async () => {
      resolveLock1();
    });

    // 4. POST 2 rejects
    await act(async () => {
      rejectLock2(new Error('Network lock failure'));
    });

    // Alert should have been shown for POST 2 failure
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Network lock failure'));

    // Crucial assertions: Section 100 acknowledged lock MUST be preserved!
    expect(screen.getByTestId('palette-q1')).toBeDisabled();
    expect(document.querySelector('fieldset')).toBeDisabled();
    expect(screen.getByTestId('flag-btn-q1')).toBeDisabled();

    // Verify radio Option A is disabled and clicking/changing it does NOT mutate Redux
    const radioA = screen.getByRole('radio', { name: /Opt A/i });
    expect(radioA).toBeDisabled();

    fireEvent.click(radioA);
    fireEvent.change(radioA, { target: { value: 'A' } });

    expect(store.getState().answers.answers[10]?.['q1']).toBe('initial_val');
    expect(store.getState().answers.isDirty).toBe(false);
  });

  it('renders refreshError alert banner with retry button that calls refreshMetadata and preserves Redux answers', async () => {
    const mockRefreshMetadata = vi.fn().mockResolvedValue(true);
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        refreshError: 'Lỗi đồng bộ metadata',
        refreshMetadata: mockRefreshMetadata,
      })
    );

    const store = makeStore(true);
    renderPage(store);

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toHaveTextContent('Lỗi đồng bộ metadata');

    const retryBtn = within(alertBanner).getByRole('button', { name: /thử lại/i });
    fireEvent.click(retryBtn);

    expect(mockRefreshMetadata).toHaveBeenCalledTimes(1);
    // Redux dirty answers remain intact
    expect(store.getState().answers.isDirty).toBe(true);
    expect(store.getState().answers.answers[1]['q1']).toBe('A');
  });

  it('dirty conflict reload: cancel does not retry; confirm saves draft to localStorage and retries', () => {
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        retry: mockRetry,
      })
    );

    const store = makeStore(true);
    store.dispatch({ type: 'answers/markSaveConflict' });
    renderPage(store);

    const reloadBtn = screen.getByRole('button', { name: /tải lại bản mới nhất/i });

    // Case 1: Cancel confirmation
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(reloadBtn);
    expect(mockRetry).not.toHaveBeenCalled();
    expect(localStorage.getItem('exam_draft_99')).toBeNull();

    // Case 2: Confirm confirmation
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(reloadBtn);
    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('exam_draft_99')).toBe(
      JSON.stringify(store.getState().answers.answers)
    );
  });

  it('alerts and aborts reload if localStorage.setItem fails when saving draft', () => {
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        retry: mockRetry,
      })
    );

    const store = makeStore(true);
    store.dispatch({ type: 'answers/markSaveConflict' });
    renderPage(store);

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const reloadBtn = screen.getByRole('button', { name: /tải lại bản mới nhất/i });
    fireEvent.click(reloadBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Không thể giữ bản nháp trên thiết bị. Hãy sao chép bài làm trước khi tải lại.')
    );
    expect(mockRetry).not.toHaveBeenCalled();
  });

  it('displays local draft notice when exam_draft_${attemptId} exists in localStorage', () => {
    localStorage.setItem('exam_draft_99', JSON.stringify({ 1: { q1: 'saved_locally' } }));

    renderPage(makeStore(false));

    expect(screen.getByTestId('local-draft-notice')).toBeInTheDocument();
    expect(
      screen.getByText(/Đang dùng bản đã lưu trên máy chủ; bản nháp trên thiết bị chưa được khôi phục/i)
    ).toBeInTheDocument();
  });

  it('parses invalid route attemptId to 0 and displays error alert with accessible retry button', () => {
    const mockRetry = vi.fn();
    vi.mocked(workspaceHookModule.default).mockReturnValue(
      mockHookResult({
        ready: false,
        loading: false,
        error: 'ID phiên thi không hợp lệ',
        workspace: null,
        retry: mockRetry,
      })
    );

    renderPage(makeStore(false), '/attempts/42abc/workspace');

    expect(workspaceHookModule.default).toHaveBeenCalledWith(0);
    const alertEl = screen.getByRole('alert');
    expect(alertEl).toHaveTextContent('ID phiên thi không hợp lệ');

    const retryBtn = within(alertEl).getByRole('button', { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});
