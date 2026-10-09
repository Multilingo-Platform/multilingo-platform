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

  it('calls autosaveAnswers after 15s when isDirty=true and syncs server version', async () => {
    mockAutosave.mockResolvedValueOnce({ version: 3 });
    const { store } = setup({
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
    expect(store.getState().answers.version).toBe(3);
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.isDirty).toBe(false);
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

  it('does NOT call API when saveStatus=conflict (guard)', async () => {
    setup({
      answers: {
        attemptId: 42,
        isDirty: true,
        version: 1,
        answers: { 1: { q1: 'A' } },
        saveStatus: 'conflict',
        lastSavedAt: null,
        pendingVersion: 1,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('dispatches markSaveError when API throws network error', async () => {
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
    mockAutosave.mockResolvedValueOnce({ version: 2 });
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

  it('dispatches markSaveConflict on 409 error (VERSION_CONFLICT or ATTEMPT_EXPIRED) and skips subsequent autosaves via guard', async () => {
    const error409 = new Error('Version conflict');
    (error409 as any).response = { status: 409, data: { code: 1601 } };
    mockAutosave.mockRejectedValue(error409);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

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
    expect(store.getState().answers.saveStatus).toBe('conflict');
    expect(store.getState().answers.isDirty).toBe(true);
    // 409 conflict does not write draft to localStorage
    expect(setItemSpy).not.toHaveBeenCalled();

    // Advance another 15s: should NOT call API again because timer was cleared
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).toHaveBeenCalledTimes(1);
    setItemSpy.mockRestore();
  });

  it('does NOT dispatch markSaveSuccess if attemptId changed while request was in flight', async () => {
    let resolveApi: any;
    const promise = new Promise((resolve) => { resolveApi = resolve; });
    mockAutosave.mockReturnValueOnce(promise);

    const store = createTestStore({
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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { rerender } = renderHook(({ id }) => useAutosave(id), {
      wrapper,
      initialProps: { id: 42 },
    });

    // Trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockAutosave).toHaveBeenCalledWith(42, expect.anything());

    // Change attemptId before the API call resolves
    rerender({ id: 99 });

    // Now resolve the old request
    await act(async () => {
      resolveApi({ version: 2 });
    });

    // The store's version should NOT be updated by the stale response
    expect(store.getState().answers.version).toBe(1);
    expect(store.getState().answers.saveStatus).toBe('saving'); // still saving since we ignored the resolution
  });
});

describe('useAutosave regression test', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resumes autosave after an authoritative reload (hydrate) clears the 409 conflict state', async () => {
    const error409 = new Error('Version conflict');
    (error409 as any).response = { status: 409, data: { code: 1601 } };
    mockAutosave.mockRejectedValueOnce(error409); // First call returns 409

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

    // 1. Tick to trigger first autosave, which hits 409
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(store.getState().answers.saveStatus).toBe('conflict');

    // 2. Simulate authoritative reload (hydrate Redux state like useWorkspace.retry does)
    act(() => {
      store.dispatch({
        type: 'answers/setAttemptContext',
        payload: { attemptId: 42, version: 2, savedAnswers: [{ part_id: 1, answers: [{ question_id: 'q1', answer: 'Server Value' }] }] },
      });
    });

    expect(store.getState().answers.saveStatus).toBe('idle');
    expect(store.getState().answers.version).toBe(2);
    expect(store.getState().answers.isDirty).toBe(false);

    // 3. User makes a new edit
    act(() => {
      store.dispatch({
        type: 'answers/setAnswer',
        payload: { partId: 1, questionId: 'q1', value: 'B' },
      });
    });
    expect(store.getState().answers.isDirty).toBe(true);

    // 4. Tick to trigger second autosave (should resume properly!)
    mockAutosave.mockResolvedValueOnce({ version: 3 });
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });

    // Verify the second autosave call happened with the newly hydrated version 2
    expect(mockAutosave).toHaveBeenCalledTimes(2);
    expect(mockAutosave).toHaveBeenLastCalledWith(42, {
      version: 2,
      answers: [{ part_id: 1, answers: [{ question_id: 'q1', answer: 'B' }] }],
    });
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.version).toBe(3);
  });
});
