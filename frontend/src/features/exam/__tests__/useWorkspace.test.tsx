import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import answerReducer, { setAnswer, markSavePending } from '../store/answerSlice';
import useWorkspace from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';
import type { WorkspaceResponse } from '../types/api.types';

function makeWrapper() {
  const store = configureStore({ reducer: { answers: answerReducer } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, wrapper };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockWorkspace: WorkspaceResponse = {
  attempt_id: 5,
  status: 'IN_PROGRESS' as const,
  test_scope: 'FULL_EXAM' as const,
  test_mode: 'MOCK_TEST' as const,
  startTime: new Date(0).toISOString(),
  deadline: new Date(3600000).toISOString(),
  serverTime: new Date(1000).toISOString(),
  gracePeriodSeconds: 15,
  lockedSections: [100],
  exam_snapshot: { exam_id: 1, code: 'IE01', title: 'IELTS Mock', type: 'IELTS', sections: [] },
  version: 7,
  saved_answers: [
    {
      part_id: 10,
      answers: [{ question_id: 'q_1', answer: 'ORIGINAL' }],
    },
  ],
  serverTimeOffset: 2000,
};

describe('useWorkspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('TC_WS_ROUTE_01: starts loading, then returns workspace and sets ready=true', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValueOnce(mockWorkspace);
    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.ready).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace).toEqual(mockWorkspace);
    expect(result.current.error).toBeNull();

    // Verify Redux was hydrated
    expect(store.getState().answers.attemptId).toBe(5);
    expect(store.getState().answers.version).toBe(7);
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('ORIGINAL');
  });

  it('TC_WS_ROUTE_03: sets error on 404, ready remains false', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockRejectedValueOnce(new Error('Attempt not found'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(999), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Attempt not found');
    expect(result.current.workspace).toBeNull();
    expect(result.current.ready).toBe(false);
  });

  it('out-of-order race: attempt A pending -> route changes to B -> response A arrives; response A is discarded', async () => {
    const deferA = deferred<WorkspaceResponse>();
    const deferB = deferred<WorkspaceResponse>();

    vi.spyOn(attemptApi, 'getWorkspace').mockImplementation((id: number) => {
      if (id === 5) return deferA.promise;
      if (id === 6) return deferB.promise;
      return Promise.reject(new Error('unknown'));
    });

    const { store, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ id }) => useWorkspace(id), {
      wrapper,
      initialProps: { id: 5 },
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.ready).toBe(false);

    // Switch route to attempt 6 while 5 is still pending
    rerender({ id: 6 });

    expect(result.current.ready).toBe(false);
    expect(result.current.workspace).toBeNull();

    // Response A resolves now (stale)
    await act(async () => {
      deferA.resolve(mockWorkspace);
    });

    // Stale response A must not have been published
    expect(result.current.workspace).toBeNull();
    expect(result.current.ready).toBe(false);
    expect(store.getState().answers.attemptId).toBeNull();

    // Response B resolves
    const mockWorkspaceB: WorkspaceResponse = {
      ...mockWorkspace,
      attempt_id: 6,
      version: 1,
      saved_answers: [],
    };
    await act(async () => {
      deferB.resolve(mockWorkspaceB);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(store.getState().answers.attemptId).toBe(6);
  });

  it('unmount in-flight: unmounting while request is pending does not throw, and dispatches clearAnswers', async () => {
    const defer = deferred<WorkspaceResponse>();
    vi.spyOn(attemptApi, 'getWorkspace').mockReturnValueOnce(defer.promise);

    const { store, wrapper } = makeWrapper();
    const { result, unmount } = renderHook(() => useWorkspace(5), { wrapper });

    expect(result.current.loading).toBe(true);
    unmount();

    // Response resolves after unmount
    await act(async () => {
      defer.resolve(mockWorkspace);
    });

    expect(store.getState().answers.attemptId).toBeNull();
  });

  it('retry out-of-order: retry 1 resolves after retry 2; only retry 2 is published', async () => {
    const defer1 = deferred<WorkspaceResponse>();
    const defer2 = deferred<WorkspaceResponse>();

    const getSpy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockReturnValueOnce(defer1.promise)
      .mockReturnValueOnce(defer2.promise);

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    // Launch retry 2 before retry 1 resolves
    await act(async () => {
      result.current.retry();
    });

    expect(getSpy).toHaveBeenCalledTimes(2);

    // Resolve retry 2 first with v8
    const mockV8: WorkspaceResponse = { ...mockWorkspace, version: 8 };
    await act(async () => {
      defer2.resolve(mockV8);
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workspace?.version).toBe(8);
    expect(store.getState().answers.version).toBe(8);

    // Resolve retry 1 late with v7 (stale)
    await act(async () => {
      defer1.resolve(mockWorkspace);
    });

    // Must still be v8, not overwritten by stale v7
    expect(result.current.workspace?.version).toBe(8);
    expect(store.getState().answers.version).toBe(8);
  });

  it('route invalid (0, negative, NaN): does not call API, sets loading=false, ready=false, and error message', async () => {
    const getSpy = vi.spyOn(attemptApi, 'getWorkspace');
    const { wrapper } = makeWrapper();

    const { result: resZero } = renderHook(() => useWorkspace(0), { wrapper });
    expect(resZero.current.loading).toBe(false);
    expect(resZero.current.ready).toBe(false);
    expect(resZero.current.error).toBeTruthy();
    expect(getSpy).not.toHaveBeenCalled();

    const { result: resNeg } = renderHook(() => useWorkspace(-5), { wrapper });
    expect(resNeg.current.loading).toBe(false);
    expect(resNeg.current.ready).toBe(false);
    expect(resNeg.current.error).toBeTruthy();
    expect(getSpy).not.toHaveBeenCalled();

    const { result: resNan } = renderHook(() => useWorkspace(NaN), { wrapper });
    expect(resNan.current.loading).toBe(false);
    expect(resNan.current.ready).toBe(false);
    expect(resNan.current.error).toBeTruthy();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('retry is no-op when Redux saveStatus is saving', async () => {
    const getSpy = vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValue(mockWorkspace);
    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Put Redux in 'saving' status
    act(() => {
      store.dispatch(markSavePending(1));
    });
    expect(store.getState().answers.saveStatus).toBe('saving');

    // Call retry() while saving
    act(() => {
      result.current.retry();
    });

    // Should be no-op: no new getWorkspace call, loading remains false
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it('retry failure preserves existing Redux answers', async () => {
    vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace)
      .mockRejectedValueOnce(new Error('Network error on retry'));

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('ORIGINAL');

    // Trigger retry which fails
    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error on retry');
    expect(result.current.ready).toBe(false);

    // Existing Redux answers must be preserved, not cleared
    expect(store.getState().answers.attemptId).toBe(5);
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('ORIGINAL');
  });

  it('refreshMetadata during local dirty edit: updates workspace metadata without modifying Redux answers or pendingVersion', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValueOnce(mockWorkspace);

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Candidate edits question 1 to "NEW" (dirty)
    act(() => {
      store.dispatch(setAnswer({ partId: 10, questionId: 'q_1', value: 'NEW' }));
    });
    const beforeState = store.getState().answers;
    expect(beforeState.isDirty).toBe(true);
    expect(beforeState.pendingVersion).toBe(1);
    expect(beforeState.answers[10]?.['q_1']).toBe('NEW');

    // Server metadata changed: lockedSections now has [100, 200]
    const updatedMetadata: WorkspaceResponse = {
      ...mockWorkspace,
      version: 8,
      lockedSections: [100, 200],
      saved_answers: [
        {
          part_id: 10,
          answers: [{ question_id: 'q_1', answer: 'ORIGINAL' }],
        },
      ],
    };
    vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValueOnce(updatedMetadata);

    let refreshOk: boolean = false;
    await act(async () => {
      refreshOk = await result.current.refreshMetadata();
    });

    expect(refreshOk).toBe(true);
    // Workspace metadata updated
    expect(result.current.workspace?.lockedSections).toEqual([100, 200]);

    // Redux answers, isDirty, pendingVersion remain completely untouched!
    const afterState = store.getState().answers;
    expect(afterState.answers).toEqual(beforeState.answers);
    expect(afterState.isDirty).toBe(true);
    expect(afterState.pendingVersion).toBe(1);
    expect(afterState.version).toBe(beforeState.version); // Redux version not overwritten by metadata
  });

  it('refreshMetadata error does not clear context or trigger whole-page loading, sets refreshError and returns false', async () => {
    vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace)
      .mockRejectedValueOnce(new Error('Metadata network failure'));

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    let refreshOk: boolean = true;
    await act(async () => {
      refreshOk = await result.current.refreshMetadata();
    });

    expect(refreshOk).toBe(false);
    expect(result.current.refreshError).toBe('Metadata network failure');
    expect(result.current.error).toBeNull(); // Page error remains null
    expect(result.current.loading).toBe(false); // Whole-page loading remains false
    expect(result.current.ready).toBe(true); // Still ready
    expect(store.getState().answers.attemptId).toBe(5); // Redux untouched
  });

  it('refreshMetadata returns false if initial hydration is not ready', async () => {
    const defer = deferred<WorkspaceResponse>();
    vi.spyOn(attemptApi, 'getWorkspace').mockReturnValueOnce(defer.promise);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    expect(result.current.ready).toBe(false);

    let refreshOk: boolean = true;
    await act(async () => {
      refreshOk = await result.current.refreshMetadata();
    });

    expect(refreshOk).toBe(false);
  });

  it('stale retry callback from route A after switching to route B is no-op, does not fetch A, does not overwrite B workspace or Redux answers', async () => {
    const mockA: WorkspaceResponse = { ...mockWorkspace, attempt_id: 5, version: 1, saved_answers: [{ part_id: 10, answers: [{ question_id: 'q_1', answer: 'SERVER_A' }] }] };
    const mockB: WorkspaceResponse = { ...mockWorkspace, attempt_id: 6, version: 1, saved_answers: [{ part_id: 10, answers: [{ question_id: 'q_1', answer: 'SERVER_B' }] }] };

    const getSpy = vi.spyOn(attemptApi, 'getWorkspace').mockImplementation(async (id: number) => {
      if (id === 5) return mockA;
      if (id === 6) return mockB;
      throw new Error('unknown');
    });

    const { store, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ id }) => useWorkspace(id), {
      wrapper,
      initialProps: { id: 5 },
    });

    await waitFor(() => expect(result.current.ready).toBe(true));
    const capturedRetryA = result.current.retry;
    const capturedRefreshA = result.current.refreshMetadata;
    expect(store.getState().answers.attemptId).toBe(5);

    // Navigate to route 6
    rerender({ id: 6 });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(store.getState().answers.attemptId).toBe(6);

    // Candidate edits on route 6
    act(() => {
      store.dispatch(setAnswer({ partId: 10, questionId: 'q_1', value: 'LOCAL_B' }));
    });
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('LOCAL_B');
    expect(store.getState().answers.isDirty).toBe(true);

    const callCountBefore = getSpy.mock.calls.length;

    // Call captured retry from route A
    act(() => {
      capturedRetryA();
    });

    // Must NOT call API for attempt 5
    expect(getSpy.mock.calls.length).toBe(callCountBefore);
    // Workspace must still be route 6
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(result.current.ready).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    // Redux must still have attempt 6 and LOCAL_B
    expect(store.getState().answers.attemptId).toBe(6);
    expect(store.getState().answers.answers[10]?.['q_1']).toBe('LOCAL_B');

    // Call captured refreshMetadata from route A
    let refreshRes: boolean = true;
    await act(async () => {
      refreshRes = await capturedRefreshA();
    });
    expect(refreshRes).toBe(false);
    expect(getSpy.mock.calls.length).toBe(callCountBefore);
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(store.getState().answers.attemptId).toBe(6);
  });

  it('deferred lockSection completion calls captured retry after route change: does not reload old route', async () => {
    const mockA: WorkspaceResponse = { ...mockWorkspace, attempt_id: 5 };
    const mockB: WorkspaceResponse = { ...mockWorkspace, attempt_id: 6 };

    vi.spyOn(attemptApi, 'getWorkspace').mockImplementation(async (id: number) => {
      if (id === 5) return mockA;
      if (id === 6) return mockB;
      throw new Error('unknown');
    });

    const { store, wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ id }) => useWorkspace(id), {
      wrapper,
      initialProps: { id: 5 },
    });

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Consumer initiates lockSection on attempt 5, capturing retry
    const retryOnLockComplete = result.current.retry;
    const lockDeferred = deferred<void>();

    const lockPromise = lockDeferred.promise.then(() => {
      retryOnLockComplete();
    });

    // Route changes to attempt 6 before lock completes
    rerender({ id: 6 });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(store.getState().answers.attemptId).toBe(6);

    // lockSection completes now and fires retryOnLockComplete
    await act(async () => {
      lockDeferred.resolve();
      await lockPromise;
    });

    // Must remain on attempt 6, not hijacked by attempt 5
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(store.getState().answers.attemptId).toBe(6);
    expect(result.current.ready).toBe(true);
  });

  it('authoritative reload (retry) cancels pending metadata refresh and resets refreshing to false', async () => {
    const deferMeta = deferred<WorkspaceResponse>();
    const deferRetry = deferred<WorkspaceResponse>();

    vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace) // initial load
      .mockReturnValueOnce(deferMeta.promise) // refreshMetadata
      .mockReturnValueOnce(deferRetry.promise); // retry

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    // Start metadata refresh (pending)
    let metaPromise: Promise<boolean>;
    act(() => {
      metaPromise = result.current.refreshMetadata();
    });
    expect(result.current.refreshing).toBe(true);

    // Call retry() while metadata is pending
    act(() => {
      result.current.retry();
    });

    // refreshing must be reset to false immediately by retry
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();
    expect(result.current.loading).toBe(true);

    // Resolve retry with v8
    const mockV8: WorkspaceResponse = { ...mockWorkspace, version: 8 };
    await act(async () => {
      deferRetry.resolve(mockV8);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace?.version).toBe(8);
    expect(result.current.refreshing).toBe(false);

    // Old metadata reply arrives late
    await act(async () => {
      deferMeta.resolve({ ...mockWorkspace, version: 7 });
    });

    const metaResult = await metaPromise!;
    expect(metaResult).toBe(false);
    expect(result.current.workspace?.version).toBe(8);
    expect(result.current.refreshing).toBe(false);
  });

  it('route change cancels pending metadata refresh, resets refreshing to false and clears refreshError', async () => {
    const deferMetaA = deferred<WorkspaceResponse>();
    const mockB: WorkspaceResponse = { ...mockWorkspace, attempt_id: 6 };

    vi.spyOn(attemptApi, 'getWorkspace').mockImplementation((id: number) => {
      if (id === 5) return deferMetaA.promise;
      if (id === 6) return Promise.resolve(mockB);
      return Promise.reject(new Error('unknown'));
    });

    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ id }) => useWorkspace(id), {
      wrapper,
      initialProps: { id: 5 },
    });

    // Initially resolves load 5
    await act(async () => {
      deferMetaA.resolve(mockWorkspace);
    });
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Set refreshError by a failing refresh
    const deferFail = deferred<WorkspaceResponse>();
    vi.spyOn(attemptApi, 'getWorkspace').mockReturnValueOnce(deferFail.promise);
    let failPromise: Promise<boolean>;
    act(() => {
      failPromise = result.current.refreshMetadata();
    });
    expect(result.current.refreshing).toBe(true);
    await act(async () => {
      deferFail.reject(new Error('Previous refresh failed'));
    });
    await failPromise!;
    expect(result.current.refreshError).toBe('Previous refresh failed');
    expect(result.current.refreshing).toBe(false);

    // Start another refresh on A (pending)
    const deferPendingA = deferred<WorkspaceResponse>();
    vi.spyOn(attemptApi, 'getWorkspace').mockReturnValueOnce(deferPendingA.promise);
    act(() => {
      result.current.refreshMetadata();
    });
    expect(result.current.refreshing).toBe(true);

    // Route change to 6
    rerender({ id: 6 });

    // refreshing must be false, refreshError must be cleared on new route
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workspace?.attempt_id).toBe(6);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();
  });

  it('retained refreshMetadata callback during authoritative retry (loading=true, ready=false): returns false, does not fetch, and preserves authoritative response', async () => {
    const deferRetry = deferred<WorkspaceResponse>();
    const getSpy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace) // 1. Initial hydration (v7, locks [100])
      .mockReturnValueOnce(deferRetry.promise); // 2. Authoritative retry

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    const retainedRefresh = result.current.refreshMetadata;
    expect(getSpy).toHaveBeenCalledTimes(1);

    // Start authoritative retry on attempt 5
    act(() => {
      result.current.retry();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.ready).toBe(false);
    expect(getSpy).toHaveBeenCalledTimes(2);

    // Call retained refreshMetadata while authoritative reload is in-flight (barrier is active)
    let refreshResult: boolean = true;
    await act(async () => {
      refreshResult = await retainedRefresh();
    });

    // Barrier must reject retained callback immediately: no HTTP request made!
    expect(refreshResult).toBe(false);
    expect(getSpy).toHaveBeenCalledTimes(2); // Still 2 calls, not 3!

    // Authoritative reload completes with version 8, locks [100, 200]
    const mockV8: WorkspaceResponse = {
      ...mockWorkspace,
      version: 8,
      lockedSections: [100, 200],
    };
    await act(async () => {
      deferRetry.resolve(mockV8);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    // Workspace must retain version 8 and locks [100, 200]
    expect(result.current.workspace?.version).toBe(8);
    expect(result.current.workspace?.lockedSections).toEqual([100, 200]);
    expect(store.getState().answers.version).toBe(8);
  });

  it('retained refreshMetadata called immediately after retry in the same event tick returns false without opening HTTP request', async () => {
    const deferRetry = deferred<WorkspaceResponse>();
    const getSpy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace)
      .mockReturnValueOnce(deferRetry.promise);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    const retainedRefresh = result.current.refreshMetadata;

    let refreshOk: boolean = true;
    await act(async () => {
      result.current.retry();
      refreshOk = await retainedRefresh();
    });

    expect(refreshOk).toBe(false);
    expect(getSpy).toHaveBeenCalledTimes(2); // Only initial + retry
  });

  it('async completion using retained refreshMetadata while retry is pending returns false and does not overwrite authoritative reload', async () => {
    const deferRetry = deferred<WorkspaceResponse>();
    const deferAsync = deferred<void>();

    const getSpy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockResolvedValueOnce(mockWorkspace)
      .mockReturnValueOnce(deferRetry.promise);

    const { store, wrapper } = makeWrapper();
    const { result } = renderHook(() => useWorkspace(5), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    const retainedRefresh = result.current.refreshMetadata;

    let asyncRefreshOk: boolean = true;
    const asyncOperationPromise = deferAsync.promise.then(async () => {
      asyncRefreshOk = await retainedRefresh();
    });

    // Retry starts
    act(() => {
      result.current.retry();
    });

    // Async operation completes and calls retainedRefresh while retry is in flight
    await act(async () => {
      deferAsync.resolve();
      await asyncOperationPromise;
    });

    expect(asyncRefreshOk).toBe(false);
    expect(getSpy).toHaveBeenCalledTimes(2);

    // Authoritative reload finishes with version 9
    const mockV9: WorkspaceResponse = { ...mockWorkspace, version: 9 };
    await act(async () => {
      deferRetry.resolve(mockV9);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ready).toBe(true);
    expect(result.current.workspace?.version).toBe(9);
    expect(store.getState().answers.version).toBe(9);
  });
});
