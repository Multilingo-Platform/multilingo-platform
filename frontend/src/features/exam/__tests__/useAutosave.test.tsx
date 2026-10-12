import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as attemptApiModule from '../api/attemptApi';
import { useAutosave } from '../hooks/useAutosave';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { Provider } from 'react-redux';
import { initialState, setAnswer, setAttemptContext } from '../store/answerSlice';

vi.mock('../api/attemptApi', () => ({
  autosaveAnswers: vi.fn(),
}));

const mockAutosave = attemptApiModule.autosaveAnswers as ReturnType<typeof vi.fn>;

function setup(preloadedState?: any) {
  const store = createTestStore({ answers: { ...initialState, ...preloadedState?.answers } });
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
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
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
    expect(setItemSpy).toHaveBeenCalledWith('exam_draft_42', JSON.stringify({ 1: { q1: 'A' } }));

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
        ...initialState,
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
    expect(mockAutosave).toHaveBeenCalledWith(42, expect.anything(), expect.anything());

    // Change attemptId before the API call resolves
    rerender({ id: 99 });

    // Now resolve the old request
    await act(async () => {
      resolveApi({ version: 2 });
    });

    // The store's version should NOT be updated by the stale response
    expect(store.getState().answers.version).toBe(1);
    expect(store.getState().answers.saveStatus).toBe('idle'); // cancelled, not stuck saving
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
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.version).toBe(3);
  });
});

describe('TV3-08 autosave coordination', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  const dirty = { answers: { ...initialState, attemptId: 42, version: 7, isDirty: true, pendingVersion: 1, answers: { 1: { q1: 'B' } } } };
  it('starts at exactly 15000ms, not 14999ms', async () => {
    mockAutosave.mockResolvedValueOnce({ version: 8 });
    setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(14999); });
    expect(mockAutosave).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mockAutosave).toHaveBeenCalledOnce();
  });
  it('ignores an old A response after A to B to A hydration', async () => {
    let resolve!: (value: { version: number }) => void;
    mockAutosave.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { store } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    act(() => { store.dispatch(setAttemptContext({ attemptId: 99, version: 15, savedAnswers: [] })); });
    act(() => { store.dispatch(setAttemptContext({ attemptId: 42, version: 20, savedAnswers: [] })); });
    localStorage.setItem('exam_draft_42', 'new-context');
    await act(async () => { resolve({ version: 8 }); });
    expect(store.getState().answers.version).toBe(20);
    expect(store.getState().answers.saveStatus).toBe('idle');
    expect(localStorage.getItem('exam_draft_42')).toBe('new-context');
  });
  it('keeps newer edits dirty and retains draft when an older snapshot succeeds', async () => {
    let resolve!: (value: { version: number }) => void;
    mockAutosave.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { store } = setup(dirty);
    localStorage.setItem('exam_draft_42', 'backup');
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    act(() => { store.dispatch(setAnswer({ partId: 1, questionId: 'q1', value: 'C' })); });
    await act(async () => { resolve({ version: 8 }); });
    expect(store.getState().answers.version).toBe(8);
    expect(store.getState().answers.isDirty).toBe(true);
    expect(store.getState().answers.saveStatus).toBe('idle');
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });
  it('stores latest edits rather than the request snapshot on failure', async () => {
    let reject!: (error: Error) => void;
    mockAutosave.mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
    const { store } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    act(() => { store.dispatch(setAnswer({ partId: 1, questionId: 'q1', value: 'C' })); });
    await act(async () => { reject(new Error('offline')); });
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 1: { q1: 'C' } });
  });
  it('pauses new cycles while awaiting and applying the current acknowledgment', async () => {
    let resolve!: (value: { version: number }) => void;
    mockAutosave.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, store } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    let barrier!: ReturnType<NonNullable<typeof result.current>['pauseAndWait']>;
    act(() => { barrier = result.current.pauseAndWait(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mockAutosave).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ version: 8 }); expect(await barrier).toEqual({ status: 'ready' }); });
    expect(store.getState().answers.version).toBe(8);
  });
  it('ignores stale success after rehydrating the same attempt', async () => {
    let resolve!: (value: { version: number }) => void;
    mockAutosave.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { store } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    act(() => { store.dispatch(setAttemptContext({ attemptId: 42, version: 20, savedAnswers: [] })); });
    localStorage.setItem('exam_draft_42', 'new-context');
    await act(async () => { resolve({ version: 8 }); });
    expect(store.getState().answers.version).toBe(20);
    expect(localStorage.getItem('exam_draft_42')).toBe('new-context');
  });
  it('does not start PUT after the authoritative deadline', async () => {
    const store = createTestStore(dirty);
    renderHook(() => useAutosave(42, { deadline: new Date(Date.now() + 10000).toISOString(), serverTimeOffset: 0 }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mockAutosave).not.toHaveBeenCalled();
  });
  it('marks non-version 409 as stopped, stops automatic PUT retries, and preserves draft', async () => {
    mockAutosave.mockRejectedValue({ response: { status: 409, data: { code: 409 } } });
    const { store } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(45000); });
    expect(store.getState().answers.saveStatus).toBe('stopped');
    expect(mockAutosave).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });

  it('distinguishes active retry on network error from stopped autosave on non-1601 HTTP 409 conflict', async () => {
    // 1. Network error: saveStatus is 'error', actively retries on next interval
    mockAutosave.mockRejectedValueOnce(new Error('temporary network hiccup'));
    const { store, result } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mockAutosave).toHaveBeenCalledTimes(1);
    expect(store.getState().answers.saveStatus).toBe('error');

    // On next 15s tick, it DOES retry (mock successful retry)
    mockAutosave.mockResolvedValueOnce({ version: 8 });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mockAutosave).toHaveBeenCalledTimes(2);
    expect(store.getState().answers.saveStatus).toBe('saved');

    // 2. Edit again, but this time server returns non-1601 HTTP 409 conflict
    act(() => { store.dispatch(setAnswer({ partId: 1, questionId: 'q1', value: 'B' })); });
    mockAutosave.mockRejectedValue({ response: { status: 409, data: { code: 409 } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mockAutosave).toHaveBeenCalledTimes(3);
    expect(store.getState().answers.saveStatus).toBe('stopped');

    // On subsequent ticks, it is BLOCKED and does NOT retry PUT
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mockAutosave).toHaveBeenCalledTimes(3);

    // pauseAndWait returns 'ready' on non-version 409 stopped autosave
    const barrier = await result.current.pauseAndWait();
    expect(barrier.status).toBe('ready');

    // 3. Authoritative reload clears stopped status and resumes autosave
    act(() => {
      store.dispatch(setAttemptContext({ attemptId: 42, version: 10, savedAnswers: [{ part_id: 1, answers: [{ question_id: 'q1', answer: 'server_value' }] }] }));
    });
    expect(store.getState().answers.saveStatus).toBe('idle');

    // Editing after authoritative reload triggers autosave cleanly
    act(() => { store.dispatch(setAnswer({ partId: 1, questionId: 'q1', value: 'C' })); });
    mockAutosave.mockResolvedValueOnce({ version: 11 });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(mockAutosave).toHaveBeenCalledTimes(4);
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.version).toBe(11);
  });

  it('differentiates pauseAndWait for version conflict 1601 vs non-version 409', async () => {
    // Version conflict 1601 returns status 'conflict'
    mockAutosave.mockRejectedValueOnce({ response: { status: 409, data: { code: 1601 } } });
    const { store, result } = setup(dirty);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(store.getState().answers.saveStatus).toBe('conflict');
    const barrier1601 = await result.current.pauseAndWait();
    expect(barrier1601.status).toBe('conflict');
  });
  it('recovers after invalid snapshot serialization without leaving an active request stuck', async () => {
    const { store } = setup({ answers: { ...dirty.answers, answers: { 1: { q1: 123 } } } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(store.getState().answers.saveStatus).toBe('error');
    act(() => { store.dispatch(setAnswer({ partId: 1, questionId: 'q1', value: 'valid' })); });
    mockAutosave.mockResolvedValueOnce({ version: 8 });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(store.getState().answers.saveStatus).toBe('saved');
    expect(store.getState().answers.version).toBe(8);
  });
});
