import React from 'react';
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
  status: 'IN_PROGRESS',
  test_scope: 'FULL_EXAM',
  test_mode: 'MOCK_TEST',
  deadline: null,
  exam_snapshot: { title: 'Test Exam', sections: [] },
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
        answers: isDirty ? { 1: { q1: 'A' } } : {},
        isDirty,
        lastSavedAt: null,
        saveStatus: 'idle' as const,
        pendingVersion: isDirty ? 1 : 0,
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
});
