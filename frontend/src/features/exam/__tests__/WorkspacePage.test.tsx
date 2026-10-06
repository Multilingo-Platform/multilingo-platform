import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
