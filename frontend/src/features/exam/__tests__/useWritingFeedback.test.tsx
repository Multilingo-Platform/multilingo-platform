import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { useWritingFeedback } from '../hooks/useWritingFeedback';
import { validAiDoneTextOnlyWire } from './fixtures/writingFeedback';
import { REFRESH_WARNING_MESSAGE } from '../utils/writingFeedbackErrors';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const mockHttp = vi.mocked(axiosClient);

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function createFeedbackEnvelope(data: unknown = validAiDoneTextOnlyWire) {
  return {
    success: true,
    data,
  };
}

describe('useWritingFeedback hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TC_21_03: does not load when enabled is false', async () => {
    const { result } = renderHook(() => useWritingFeedback(101, 202, false));

    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockHttp.get).not.toHaveBeenCalled();
  });

  it('TC_21_01: loads data on first open (enabled=true) and normalizes response', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());

    const { result } = renderHook(() => useWritingFeedback(101, 202, true));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.attemptId).toBe(101);
    expect(result.current.data?.partId).toBe(202);
    expect(result.current.data?.tasks[0].criteria).toHaveLength(4);
    expect(result.current.error).toBeNull();
    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(mockHttp.get).toHaveBeenCalledWith(
      '/v1/attempts/101/writing-feedback',
      expect.objectContaining({ params: { partId: 202 } })
    );
  });

  it('TC_21_11: merges concurrent reload double-clicks into single flight', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());
    const { result } = renderHook(() => useWritingFeedback(101, 202, true));

    await waitFor(() => expect(result.current.data).not.toBeNull());

    const refreshDef = deferred();
    mockHttp.get.mockReturnValueOnce(refreshDef.promise as never);

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.reload();
      p2 = result.current.reload();
    });

    expect(result.current.refreshing).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(2); // Initial (1) + Refresh (1)

    await act(async () => {
      refreshDef.resolve(createFeedbackEnvelope());
      await Promise.all([p1, p2]);
    });

    expect(result.current.refreshing).toBe(false);
    expect(mockHttp.get).toHaveBeenCalledTimes(2);
  });

  it('TC_21_13: retains validated data on refresh transient error (network, timeout, 5xx)', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());
    const { result } = renderHook(() => useWritingFeedback(101, 202, true));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    // 1. Refresh with 500 error
    mockHttp.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { message: 'INTERNAL_ERROR' } },
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.attemptId).toBe(101);
    expect(result.current.refreshError?.message).toBe(REFRESH_WARNING_MESSAGE);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);

    // 2. Refresh with Network Error
    mockHttp.get.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'Network Error',
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.refreshError?.message).toBe(REFRESH_WARNING_MESSAGE);
  });

  it('TC_21_14: clears previous data on refresh 401, 403, 404, 400 or contract error', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());
    const { result } = renderHook(() => useWritingFeedback(101, 202, true));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Refresh returns 403 Forbidden
    mockHttp.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403, data: { message: 'FORBIDDEN' } },
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.kind).toBe('forbidden');
    expect(result.current.error?.message).toMatch(/quyền/i);
    expect(result.current.refreshError).toBeNull();
  });

  it('TC_21_14: clears previous data on malformed refresh contract error', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());
    const { result } = renderHook(() => useWritingFeedback(101, 202, true));
    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Refresh returns corrupted payload (mismatched attemptId)
    mockHttp.get.mockResolvedValueOnce({
      success: true,
      data: { ...validAiDoneTextOnlyWire, attemptId: 999 },
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.kind).toBe('contract');
    expect(result.current.error?.message).toMatch(/cấu trúc/i);
  });

  it('TC_21_12: aborts previous request on identity change (A -> B -> A) and rejects stale completion', async () => {
    const oldA = deferred();
    const b = deferred();
    const newA = deferred();

    mockHttp.get
      .mockReturnValueOnce(oldA.promise as never)
      .mockReturnValueOnce(b.promise as never)
      .mockReturnValueOnce(newA.promise as never);

    const { result, rerender } = renderHook(
      ({ partId }) => useWritingFeedback(101, partId, true),
      { initialProps: { partId: 202 } }
    );

    expect(result.current.loading).toBe(true);

    // Switch to part B, then back to A
    rerender({ partId: 303 });
    rerender({ partId: 202 });

    // Old A signal must be aborted
    expect(mockHttp.get.mock.calls[0][1]?.signal?.aborted).toBe(true);

    // Late settlements of old requests should not affect current state
    await act(async () => {
      oldA.resolve(createFeedbackEnvelope());
      b.reject(new Error('b error'));
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    // New A settles
    await act(async () => {
      newA.resolve(createFeedbackEnvelope());
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('TC_21_12: unmount aborts in-flight request and cleans up', async () => {
    const pending = deferred();
    mockHttp.get.mockReturnValueOnce(pending.promise as never);

    const { unmount } = renderHook(() => useWritingFeedback(101, 202, true));

    unmount();

    expect(mockHttp.get.mock.calls[0][1]?.signal?.aborted).toBe(true);

    // Resolving after unmount shouldn't throw state errors
    await act(async () => {
      pending.resolve(createFeedbackEnvelope());
    });
  });

  it('TC_21_12: StrictMode aborts duplicate invocation cleanly', async () => {
    const old = deferred();
    mockHttp.get
      .mockReturnValueOnce(old.promise as never)
      .mockResolvedValueOnce(createFeedbackEnvelope());

    const { result, unmount } = renderHook(() => useWritingFeedback(101, 202, true), {
      wrapper: StrictMode,
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(mockHttp.get.mock.calls[0][1]?.signal?.aborted).toBe(true);

    await act(async () => {
      old.resolve(createFeedbackEnvelope());
    });

    expect(result.current.data?.attemptId).toBe(101);
    unmount();
  });

  it('TC_21_16: multiple hooks for different parts load independently without cross-blocking', async () => {
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope());
    mockHttp.get.mockResolvedValueOnce({
      success: true,
      data: { ...validAiDoneTextOnlyWire, partId: 203 },
    });

    const hookPart1 = renderHook(() => useWritingFeedback(101, 202, true));
    const hookPart2 = renderHook(() => useWritingFeedback(101, 203, true));

    await waitFor(() => {
      expect(hookPart1.result.current.data).not.toBeNull();
      expect(hookPart2.result.current.data).not.toBeNull();
    });

    expect(hookPart1.result.current.data?.partId).toBe(202);
    expect(hookPart2.result.current.data?.partId).toBe(203);
  });

  it('handles invalid IDs without dispatching HTTP', async () => {
    const { result } = renderHook(() => useWritingFeedback(0, 202, true));

    expect(result.current.error?.kind).toBe('invalid_request');
    expect(result.current.loading).toBe(false);
    expect(mockHttp.get).not.toHaveBeenCalled();
  });

  it.each(['part', 'attempt'] as const)('R1: loaded A -> pending B -> A reloads for changed %s', async (identity) => {
    const b = deferred();
    const nextA = deferred();
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope())
      .mockReturnValueOnce(b.promise as never).mockReturnValueOnce(nextA.promise as never);
    const a = { attemptId: 101, partId: 202 };
    const other = identity === 'part' ? { ...a, partId: 303 } : { ...a, attemptId: 102 };
    const { result, rerender } = renderHook(
      ({ attemptId, partId }) => useWritingFeedback(attemptId, partId, true), { initialProps: a }
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    rerender(other);
    expect(result.current.data).toBeNull();
    rerender(a);
    expect(mockHttp.get).toHaveBeenCalledTimes(3);
    expect(mockHttp.get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => { b.resolve(createFeedbackEnvelope({ ...validAiDoneTextOnlyWire, ...other })); });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => { nextA.resolve(createFeedbackEnvelope()); });
    expect(result.current.data?.attemptId).toBe(101);
    expect(result.current.data?.partId).toBe(202);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('R2: disable/enable preserves data without GET and unmount aborts a subsequent refresh', async () => {
    const refresh = deferred();
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope()).mockReturnValueOnce(refresh.promise as never);
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useWritingFeedback(101, 202, enabled), { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const validated = result.current.data;
    rerender({ enabled: false });
    rerender({ enabled: true });
    expect(result.current.data).toBe(validated);
    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    let operation!: Promise<void>;
    act(() => { operation = result.current.reload(); });
    expect(result.current.refreshing).toBe(true);
    unmount();
    expect(mockHttp.get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => { refresh.resolve(createFeedbackEnvelope()); await operation; });
  });

  it.each(['resolve', 'reject'] as const)('R2: identity change after reopen aborts refresh and ignores late %s/finally', async (settlement) => {
    const refreshA = deferred();
    const pendingB = deferred();
    mockHttp.get.mockResolvedValueOnce(createFeedbackEnvelope())
      .mockReturnValueOnce(refreshA.promise as never).mockReturnValueOnce(pendingB.promise as never);
    const { result, rerender } = renderHook(
      ({ partId, enabled }) => useWritingFeedback(101, partId, enabled),
      { initialProps: { partId: 202, enabled: true } }
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());
    rerender({ partId: 202, enabled: false });
    rerender({ partId: 202, enabled: true });
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.reload(); });
    rerender({ partId: 303, enabled: true });
    expect(mockHttp.get.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(3);
    expect(mockHttp.get.mock.calls[2][1]?.params).toEqual({ partId: 303 });
    await act(async () => {
      if (settlement === 'resolve') refreshA.resolve(createFeedbackEnvelope());
      else refreshA.reject({ response: { status: 403 } });
      await refresh;
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    // A stale finally must not clear B's active marker: concurrent reload still joins B.
    let joined!: Promise<void>;
    act(() => { joined = result.current.reload(); });
    expect(mockHttp.get).toHaveBeenCalledTimes(3);
    await act(async () => {
      pendingB.resolve(createFeedbackEnvelope({ ...validAiDoneTextOnlyWire, partId: 303 }));
      await joined;
    });
    expect(result.current.data?.partId).toBe(303);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();
  });

  it('R4: reload cancelled by disable resets refreshing/loading, preserves data on reopen, ignores late resolve, and allows next manual reload', async () => {
    const initial = deferred();
    const refresh = deferred();
    const nextManual = deferred();

    mockHttp.get
      .mockReturnValueOnce(initial.promise as never)
      .mockReturnValueOnce(refresh.promise as never)
      .mockReturnValueOnce(nextManual.promise as never);

    const { result, rerender } = renderHook(
      ({ enabled }) => useWritingFeedback(101, 202, enabled),
      { initialProps: { enabled: true } }
    );

    // Initial load settles
    await act(async () => {
      initial.resolve(createFeedbackEnvelope());
    });
    expect(result.current.data?.attemptId).toBe(101);
    const originalData = result.current.data;
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(mockHttp.get).toHaveBeenCalledTimes(1);

    // Start manual reload
    let reloadPromise!: Promise<void>;
    act(() => {
      reloadPromise = result.current.reload();
    });
    expect(result.current.refreshing).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(2);

    // Disable while reload is in-flight
    rerender({ enabled: false });

    // When disabled, state must not report request active
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(mockHttp.get.mock.calls[1][1]?.signal?.aborted).toBe(true);

    // Wait for cancelled reload promise to settle
    await act(async () => {
      await reloadPromise;
    });

    // Reopen (enabled: true)
    rerender({ enabled: true });

    // Assert data is preserved, loading/refreshing are false, no redundant GET on reopen
    expect(result.current.data).toBe(originalData);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBeNull();
    expect(mockHttp.get).toHaveBeenCalledTimes(2); // Still 2, no extra GET

    // Late resolve of aborted refresh must be ignored (no change to data or flags)
    await act(async () => {
      refresh.resolve(createFeedbackEnvelope({ ...validAiDoneTextOnlyWire, wordCount: 99 }));
    });
    expect(result.current.data).toBe(originalData);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);

    // Subsequent manual reload must function normally
    let manualPromise!: Promise<void>;
    act(() => {
      manualPromise = result.current.reload();
    });
    expect(result.current.refreshing).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(3);

    await act(async () => {
      nextManual.resolve(createFeedbackEnvelope());
      await manualPromise;
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('R4: reload cancelled by disable ignores late reject without polluting state or errors', async () => {
    const initial = deferred();
    const refresh = deferred();

    mockHttp.get
      .mockReturnValueOnce(initial.promise as never)
      .mockReturnValueOnce(refresh.promise as never);

    const { result, rerender } = renderHook(
      ({ enabled }) => useWritingFeedback(101, 202, enabled),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      initial.resolve(createFeedbackEnvelope());
    });
    const originalData = result.current.data;

    let reloadPromise!: Promise<void>;
    act(() => {
      reloadPromise = result.current.reload();
    });
    expect(result.current.refreshing).toBe(true);

    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      await reloadPromise;
    });

    rerender({ enabled: true });
    expect(result.current.data).toBe(originalData);
    expect(result.current.refreshing).toBe(false);

    // Late reject with 403 or 500 must not evict data or set error
    await act(async () => {
      refresh.reject({ response: { status: 403 } });
    });

    expect(result.current.data).toBe(originalData);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBeNull();
  });

  it('R4: initial load cancelled by disable resets loading and resumes clean fetch on reopen', async () => {
    const initial = deferred();
    const resumed = deferred();

    mockHttp.get
      .mockReturnValueOnce(initial.promise as never)
      .mockReturnValueOnce(resumed.promise as never);

    const { result, rerender } = renderHook(
      ({ enabled }) => useWritingFeedback(101, 202, enabled),
      { initialProps: { enabled: true } }
    );

    expect(result.current.loading).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(1);

    // Disable before initial request finishes
    rerender({ enabled: false });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toBeNull();
    expect(mockHttp.get.mock.calls[0][1]?.signal?.aborted).toBe(true);

    // Late settlement of aborted initial request is ignored
    await act(async () => {
      initial.resolve(createFeedbackEnvelope());
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);

    // Reopen (enabled: true) triggers fresh initial fetch
    rerender({ enabled: true });
    expect(result.current.loading).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(2);

    await act(async () => {
      resumed.resolve(createFeedbackEnvelope());
    });

    expect(result.current.data?.attemptId).toBe(101);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

