import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { useAttemptResult } from '../hooks/useAttemptResult';
import { attemptResultFixture, resultEnvelope } from './fixtures/attemptResult';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn() } }));
const http = vi.mocked(axiosClient);
function deferred() {
  let resolve!: (value: unknown) => void; let reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe('scoped result hook', () => {
  it('loads directly and refreshes once despite repeated clicks', async () => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    const { result } = renderHook(() => useAttemptResult(42));
    await waitFor(() => expect(result.current.data?.attemptId).toBe(42));
    const refresh = deferred(); http.get.mockReturnValueOnce(refresh.promise as never);
    let pending!: Promise<void>;
    act(() => { pending = result.current.reload(); void result.current.reload(); });
    expect(result.current.refreshing).toBe(true); expect(result.current.data?.attemptId).toBe(42);
    expect(http.get).toHaveBeenCalledTimes(2);
    await act(async () => { refresh.resolve(resultEnvelope({ ...attemptResultFixture(), status: 'COMPLETED' })); await pending; });
    expect(result.current.data?.status).toBe('COMPLETED'); expect(result.current.refreshing).toBe(false);
  });
  it('invalid route has a nonretryable error without HTTP', async () => {
    const { result } = renderHook(() => useAttemptResult(null));
    expect(result.current.error?.kind).toBe('invalid-id');
    await act(async () => { await result.current.reload(); });
    expect(http.get).not.toHaveBeenCalled();
  });
  it.each([[400, 'not-finalized', true], [401, 'unauthorized', false], [403, 'forbidden', false],
    [409, 'request', true], [500, 'request', true]])('classifies HTTP %s without server detail', async (status, kind, retryable) => {
    http.get.mockRejectedValueOnce({ response: { status, data: { message: 'SECRET' } } });
    const { result } = renderHook(() => useAttemptResult(42));
    await waitFor(() => expect(result.current.error?.kind).toBe(kind));
    expect(result.current.error?.retryable).toBe(retryable);
    expect(result.current.error?.message).not.toContain('SECRET'); expect(result.current.data).toBeNull();
  });
  it.each([undefined, 500, 503])('retains validated data on refresh transport/5xx %s', async status => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    const { result } = renderHook(() => useAttemptResult(42));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    http.get.mockRejectedValueOnce(status ? { response: { status } } : new Error('network SECRET'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.data?.attemptId).toBe(42); expect(result.current.refreshError?.message).toMatch(/Chưa cập nhật/i);
    expect(result.current.error).toBeNull();
  });
  it.each([400, 401, 403, 404, 409, 429])('clears previous private result after refresh HTTP %s', async status => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    const { result } = renderHook(() => useAttemptResult(42));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    http.get.mockRejectedValueOnce({ response: { status } });
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toBeNull(); expect(result.current.error).not.toBeNull();
  });
  it('clears previous data on malformed refresh and replaces it on unavailable refresh', async () => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    const { result } = renderHook(() => useAttemptResult(42));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    http.get.mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), attemptId: 43 }) as never);
    await act(async () => { await result.current.reload(); });
    expect(result.current.data).toBeNull(); expect(result.current.error?.kind).toBe('contract');
    http.get.mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), summaryAvailable: false, resultSummary: null }) as never);
    await act(async () => { await result.current.reload(); });
    expect(result.current.data?.summaryAvailable).toBe(false); expect(result.current.data?.resultSummary).toBeNull();
  });
  it('hides previous result on route change and ignores A→B→A late settlement/finally', async () => {
    const oldA = deferred(); const b = deferred(); const newA = deferred();
    http.get.mockReturnValueOnce(oldA.promise as never).mockReturnValueOnce(b.promise as never).mockReturnValueOnce(newA.promise as never);
    const { result, rerender } = renderHook(({ id }) => useAttemptResult(id), { initialProps: { id: 42 } });
    rerender({ id: 43 }); rerender({ id: 42 });
    expect(http.get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => { oldA.resolve(resultEnvelope()); b.reject(new Error('old failure')); });
    expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true); expect(result.current.error).toBeNull();
    await act(async () => { newA.resolve(resultEnvelope({ ...attemptResultFixture(), status: 'COMPLETED' })); });
    expect(result.current.data?.status).toBe('COMPLETED'); expect(result.current.loading).toBe(false);
  });
  it('never exposes ready A while B loads', async () => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    const { result, rerender } = renderHook(({ id }) => useAttemptResult(id), { initialProps: { id: 42 } });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const b = deferred(); http.get.mockReturnValueOnce(b.promise as never);
    rerender({ id: 43 }); expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true);
    await act(async () => { b.resolve(resultEnvelope(attemptResultFixture(43))); });
    expect(result.current.data?.attemptId).toBe(43);
  });
  it('StrictMode aborts replay request; late completion cannot replace current data', async () => {
    const old = deferred();
    http.get.mockReturnValueOnce(old.promise as never).mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), status: 'COMPLETED' }) as never);
    const { result, unmount } = renderHook(() => useAttemptResult(42), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.data?.status).toBe('COMPLETED'));
    expect(http.get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => { old.resolve(resultEnvelope()); });
    expect(result.current.data?.status).toBe('COMPLETED'); unmount();
  });
  it('unmount aborts and a fresh same-ID mount has no cached result', async () => {
    const old = deferred(); const fresh = deferred();
    http.get.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(fresh.promise as never);
    const first = renderHook(() => useAttemptResult(42)); first.unmount();
    const second = renderHook(() => useAttemptResult(42));
    await act(async () => { old.resolve(resultEnvelope()); });
    expect(second.result.current.data).toBeNull(); expect(second.result.current.loading).toBe(true);
    await act(async () => { fresh.resolve(resultEnvelope()); });
    expect(second.result.current.data?.attemptId).toBe(42);
  });
  it('timeout unlocks initial request for explicit retry, never auto retries', async () => {
    vi.useFakeTimers(); http.get.mockReturnValueOnce(new Promise(() => {}) as never);
    const { result } = renderHook(() => useAttemptResult(42));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(result.current.error?.kind).toBe('request'); expect(result.current.loading).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(http.get).toHaveBeenCalledOnce();
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    await act(async () => { await result.current.reload(); });
    expect(result.current.data?.attemptId).toBe(42);
  });
});
