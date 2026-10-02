import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as attemptApiModule from '../api/attemptApi';
import { useAutosave } from '../hooks/useAutosave';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { Provider } from 'react-redux';

vi.mock('../api/attemptApi', () => ({
  autosaveAnswers: vi.fn(),
}));

const mockAutosave = attemptApiModule.autosaveAnswers as ReturnType<typeof vi.fn>;

function setup(preloadedState?: any) {
  const store = createTestStore(preloadedState);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(() => useAutosave(42), { wrapper });
  return { ...hook, store };
}

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT call API when isDirty=false', async () => {
    setup({
      answers: {
        attemptId: 42,
        isDirty: false,
        version: 0,
        answers: {},
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 0,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('calls autosaveAnswers after 15s when isDirty=true', async () => {
    mockAutosave.mockResolvedValueOnce(undefined);
    setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 2,
        answers: { 1: { q1: 'A' } },
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).toHaveBeenCalledWith(42, {
      version: 2,
      answers: [{ part_id: 1, answers: [{ question_id: 'q1', answer: 'A' }] }],
    });
  });

  it('does NOT call API when saveStatus=saving (guard)', async () => {
    setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: {},
        saveStatus: 'saving',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('dispatches markSaveError when API throws', async () => {
    mockAutosave.mockRejectedValueOnce(new Error('network error'));
    const { store } = setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: {},
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(store.getState().answers.saveStatus).toBe('error');
    expect(store.getState().answers.isDirty).toBe(true);
  });

  it('removes localStorage draft after successful save', async () => {
    mockAutosave.mockResolvedValueOnce(undefined);
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: { 1: { q1: 'A' } },
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(removeSpy).toHaveBeenCalledWith('exam_draft_42');
    removeSpy.mockRestore();
  });

  it('writes localStorage draft on network failure', async () => {
    mockAutosave.mockRejectedValueOnce(new Error('network error'));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: { 1: { q1: 'A' } },
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(setItemSpy).toHaveBeenCalledWith('exam_draft_42', expect.any(String));
    setItemSpy.mockRestore();
  });

  it('clears interval on 409 error (ATTEMPT_EXPIRED)', async () => {
    const error409 = new Error('Attempt expired');
    (error409 as any).response = { status: 409, data: { code: 'ATTEMPT_EXPIRED' } };
    mockAutosave.mockRejectedValue(error409);

    const { store } = setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: { 1: { q1: 'A' } },
        saveStatus: 'idle',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });

    // Advance 15s to trigger first autosave which returns 409
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).toHaveBeenCalledTimes(1);
    expect(store.getState().answers.saveStatus).toBe('error');

    // Advance another 15s: should NOT call API again because timer was cleared
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).toHaveBeenCalledTimes(1);
  });
});

