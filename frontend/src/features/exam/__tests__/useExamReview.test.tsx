import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExamReview, ExamReviewError } from '../hooks/useExamReview';
import * as attemptApi from '../api/attemptApi';
import { ReviewContractError } from '../api/reviewContract';
import { attemptReviewFixture } from './fixtures/attemptReview';

vi.mock('../api/attemptApi');

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useExamReview hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial load fetches and returns review data with correct status', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview').mockResolvedValueOnce(fixture as any);

    const { result } = renderHook(() => useExamReview(42, 10));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(fixture);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it('idle when attemptId or partId is null', () => {
    const spy = vi.spyOn(attemptApi, 'getAttemptReview');
    const { result } = renderHook(() => useExamReview(null, 10));

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    const { result: r2 } = renderHook(() => useExamReview(42, null));
    expect(spy).not.toHaveBeenCalled();
    expect(r2.current.loading).toBe(false);
    expect(r2.current.data).toBeNull();
    expect(r2.current.error).toBeNull();
  });

  it.each([
    [0, 10],
    [-1, 10],
    [1.5, 10],
    [42, 0],
    [42, -5],
    [42, 2.5],
  ])('sets INVALID_SELECTION error and does not call API when IDs are invalid (%j, %j)', (attId, pId) => {
    const spy = vi.spyOn(attemptApi, 'getAttemptReview');
    const { result } = renderHook(() => useExamReview(attId, pId));

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.kind).toBe('INVALID_SELECTION');
  });

  it('manual reload sets refreshing true while keeping existing data visible', async () => {
    const fixture1 = attemptReviewFixture(42, 10);
    const fixture2 = { ...fixture1, partTitle: 'Updated Passage 1' };
    const def = deferred<any>();

    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture1 as any)
      .mockReturnValueOnce(def.promise);

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(fixture1);

    // Trigger manual reload
    act(() => {
      result.current.reload();
    });

    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);
    // Data remains visible during refresh!
    expect(result.current.data).toEqual(fixture1);

    act(() => {
      def.resolve(fixture2);
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.data).toEqual(fixture2);
    expect(result.current.refreshError).toBeNull();
  });

  it('double click reload aborts previous in-flight reload and commits only latest', async () => {
    const fixture1 = attemptReviewFixture(42, 10);
    const def1 = deferred<any>();
    const def2 = deferred<any>();

    const spy = vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture1 as any)
      .mockReturnValueOnce(def1.promise)
      .mockReturnValueOnce(def2.promise);

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Double reload (successive rapid clicks)
    act(() => {
      result.current.reload();
    });
    act(() => {
      result.current.reload();
    });

    expect(spy).toHaveBeenCalledTimes(3);

    // Resolve def1 late with stale title
    act(() => {
      def1.resolve({ ...fixture1, partTitle: 'Stale 1' });
    });

    // Resolve def2 with latest title
    act(() => {
      def2.resolve({ ...fixture1, partTitle: 'Latest 2' });
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.data?.partTitle).toBe('Latest 2');
  });

  it.each([
    [{ response: { status: 403, data: { message: 'Forbidden' } } }, 'NOT_AUTHORIZED'],
    [{ response: { status: 404, data: { message: 'Part not found' } } }, 'NOT_FOUND'],
    [{ response: { status: 400, data: { message: 'Attempt is in progress and not submitted' } } }, 'NOT_SUBMITTED'],
    [new ReviewContractError('Invalid contract'), 'CONTRACT_ERROR'],
    [new Error('Network error'), 'REQUEST_ERROR'],
  ])('classifies API rejection %j into %s', async (errorObj, expectedKind) => {
    vi.spyOn(attemptApi, 'getAttemptReview').mockRejectedValueOnce(errorObj);

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.kind).toBe(expectedKind);
  });

  it('refresh network error preserves existing data and sets refreshError warning', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture as any)
      .mockRejectedValueOnce(new Error('Network disconnected'));

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(fixture);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));

    // Data must be preserved on transient network error!
    expect(result.current.data).toEqual(fixture);
    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBeInstanceOf(ExamReviewError);
    expect(result.current.refreshError?.kind).toBe('REQUEST_ERROR');
  });

  it('refresh permission/contract error clears data and sets fatal error', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture as any)
      .mockRejectedValueOnce({ response: { status: 403, data: { message: 'Access revoked' } } });

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));

    // Data must be cleared on permission revocation!
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.kind).toBe('NOT_AUTHORIZED');
    expect(result.current.refreshError).toBeNull();
  });

  it('refresh generic HTTP 400 (without not-submitted message) clears data and sets fatal error with status 400', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture as any)
      .mockRejectedValueOnce({ response: { status: 400, data: { message: 'Invalid request' } } });

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(fixture);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));

    // Per AC-06, any HTTP 4xx must clear data and set fatal error
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.status).toBe(400);
    expect(result.current.refreshError).toBeNull();
  });

  it('refresh HTTP 422 clears data and sets fatal error with status 422', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture as any)
      .mockRejectedValueOnce({ response: { status: 422, data: { message: 'Unprocessable entity' } } });

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(fixture);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.status).toBe(422);
    expect(result.current.refreshError).toBeNull();
  });

  it('refresh contract error clears data and sets fatal CONTRACT_ERROR', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture as any)
      .mockRejectedValueOnce(new ReviewContractError('Corrupted payload'));

    const { result } = renderHook(() => useExamReview(42, 10));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(fixture);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.refreshing).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExamReviewError);
    expect(result.current.error?.kind).toBe('CONTRACT_ERROR');
    expect(result.current.refreshError).toBeNull();
  });

  it('race condition A -> B -> A does not let late B overwrite current Part A', async () => {
    const defA1 = deferred<any>();
    const defB = deferred<any>();
    const defA2 = deferred<any>();

    const spy = vi.spyOn(attemptApi, 'getAttemptReview')
      .mockReturnValueOnce(defA1.promise)
      .mockReturnValueOnce(defB.promise)
      .mockReturnValueOnce(defA2.promise);

    // Initial render: Part 10
    const { result, rerender } = renderHook(
      ({ partId }) => useExamReview(42, partId),
      { initialProps: { partId: 10 } }
    );
    expect(spy).toHaveBeenCalledWith(42, 10, expect.any(Object));

    // Switch to Part 20
    rerender({ partId: 20 });
    expect(result.current.data).toBeNull();
    expect(spy).toHaveBeenCalledWith(42, 20, expect.any(Object));

    // Switch back to Part 10
    rerender({ partId: 10 });
    expect(result.current.data).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);

    // Late resolve defB for Part 20
    act(() => {
      defB.resolve(attemptReviewFixture(42, 20));
    });

    // Current selection is Part 10; Part 20 must NOT be set!
    expect(result.current.data).toBeNull();

    // Late resolve defA1 for first Part 10 generation
    act(() => {
      defA1.resolve({ ...attemptReviewFixture(42, 10), partTitle: 'Stale A1' });
    });
    expect(result.current.data).toBeNull();

    // Resolve defA2 for current Part 10 generation
    act(() => {
      defA2.resolve({ ...attemptReviewFixture(42, 10), partTitle: 'Current A2' });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.partTitle).toBe('Current A2');
    expect(result.current.data?.partId).toBe(10);
  });

  it('props change immediately uncouples previous data before effect resolves', async () => {
    const fixture10 = attemptReviewFixture(42, 10);
    const def20 = deferred<any>();

    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixture10 as any)
      .mockReturnValueOnce(def20.promise);

    const { result, rerender } = renderHook(
      ({ partId }) => useExamReview(42, partId),
      { initialProps: { partId: 10 } }
    );

    await waitFor(() => expect(result.current.data).toEqual(fixture10));

    // Rerender with Part 20
    rerender({ partId: 20 });

    // Synchronously, data must be null, never showing Part 10 data under Part 20 props!
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    act(() => {
      def20.resolve(attemptReviewFixture(42, 20));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.partId).toBe(20);
  });

  it('unmount aborts in-flight request and does not set state', async () => {
    let capturedSignal: AbortSignal | undefined;
    const def = deferred<any>();

    vi.spyOn(attemptApi, 'getAttemptReview').mockImplementation((_attId, _pId, options) => {
      capturedSignal = options?.signal;
      return def.promise;
    });

    const { unmount } = renderHook(() => useExamReview(42, 10));

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);

    // Resolving late after unmount does not throw or error
    act(() => {
      def.resolve(attemptReviewFixture(42, 10));
    });
  });

  it('attemptId change with same partId immediately uncouples data and fetches new attempt review', async () => {
    const fixtureAtt1 = attemptReviewFixture(42, 10);
    const fixtureAtt2 = attemptReviewFixture(99, 10);
    const defAtt2 = deferred<any>();

    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(fixtureAtt1 as any)
      .mockReturnValueOnce(defAtt2.promise);

    const { result, rerender } = renderHook(
      ({ attemptId }) => useExamReview(attemptId, 10),
      { initialProps: { attemptId: 42 } }
    );

    await waitFor(() => expect(result.current.data).toEqual(fixtureAtt1));

    // Rerender with different attemptId
    rerender({ attemptId: 99 });

    // Synchronously decoupled
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    act(() => {
      defAtt2.resolve(fixtureAtt2);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.attemptId).toBe(99);
  });

  it('transition from valid selection to idle immediately aborts and clears data', async () => {
    const fixture = attemptReviewFixture(42, 10);
    vi.spyOn(attemptApi, 'getAttemptReview').mockResolvedValueOnce(fixture as any);

    const { result, rerender } = renderHook(
      ({ attemptId, partId }) => useExamReview(attemptId, partId),
      { initialProps: { attemptId: 42 as number | null, partId: 10 as number | null } }
    );

    await waitFor(() => expect(result.current.data).toEqual(fixture));

    rerender({ attemptId: null, partId: null });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
