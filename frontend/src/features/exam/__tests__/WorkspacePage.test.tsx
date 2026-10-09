import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import * as workspaceHookModule from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';

vi.mock('../hooks/useWorkspace');
vi.mock('../api/attemptApi');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

const baseWorkspace = {
  attempt_id: 99,
  status: 'IN_PROGRESS' as const,
  test_scope: 'FULL_EXAM' as const,
  test_mode: 'MOCK_TEST' as const,
  deadline: null as string | null,
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

function renderPage(store: ReturnType<typeof makeStore>) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/99/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('WorkspacePage', () => {
  it('renders Timer when mode is MOCK_TEST', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue({
      workspace: { ...baseWorkspace, deadline: new Date(Date.now() + 3600_000).toISOString() },
      loading: false,
      error: null,
      retry: vi.fn(),
    });
    renderPage(makeStore());
    expect(screen.getByText(/:\d{2}$/)).toBeDefined();
  });

  it('does not crash with empty sections', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue({
      workspace: baseWorkspace,
      loading: false,
      error: null,
      retry: vi.fn(),
    });
    expect(() => renderPage(makeStore())).not.toThrow();
  });

  it('renders questions directly from part.questions array and renders passageHtml', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });
    renderPage(makeStore());
    expect(screen.getByText('Direct question text')).toBeDefined();
    expect(screen.getByText('Direct passage test')).toBeDefined();
  });

  it('renders canonical reading question groups in order with group instructions and stable answer ids', () => {
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.mocked(workspaceHookModule.default).mockReturnValue({
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
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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
    vi.clearAllMocks();
    vi.mocked(workspaceHookModule.default).mockReturnValue({
      workspace: baseWorkspace,
      loading: false,
      error: null,
      retry: vi.fn(),
    });
  });

  it('flushes dirty answers to server before submitting', async () => {
    const mockAutoSave = vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce(undefined);
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
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce(undefined);
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
    vi.mocked(attemptApi.autosaveAnswers).mockResolvedValueOnce(undefined);
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

    vi.mocked(workspaceHookModule.default).mockReturnValue({
      workspace: mockWritingWorkspace as any,
      loading: false,
      error: null,
      retry: vi.fn(),
    });

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

    vi.mocked(workspaceHookModule.default).mockReturnValue({
      workspace: mockWritingWorkspace as any,
      loading: false,
      error: null,
      retry: vi.fn(),
    });

    renderPage(makeStore());

    expect(screen.getByText(/0 \/ 100 từ/i)).toBeDefined();
  });
});
