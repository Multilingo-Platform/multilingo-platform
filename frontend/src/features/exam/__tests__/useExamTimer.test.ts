import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useExamTimer } from '../hooks/useExamTimer';

describe('useExamTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns isPractice=true when deadline is null', () => {
    const { result } = renderHook(() => useExamTimer(null));
    expect(result.current.isPractice).toBe(true);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeftMs).toBe(0);
  });

  it('computes timeLeftMs correctly from deadline', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 giờ nữa
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.timeLeftMs).toBeGreaterThan(59 * 60 * 1000);
    expect(result.current.isExpired).toBe(false);
  });

  it('decrements every 500ms by re-reading Date.now()', () => {
    const deadline = new Date(Date.now() + 10_000).toISOString(); // 10 giây
    const { result } = renderHook(() => useExamTimer(deadline));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.timeLeftMs).toBeLessThanOrEqual(5_000);
    expect(result.current.timeLeftMs).toBeGreaterThan(4_000);
  });

  it('sets isExpired=true when deadline is in the past', () => {
    const deadline = new Date(Date.now() - 1000).toISOString(); // đã qua
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeLeftMs).toBe(0);
  });

  it('formats displayTime as MM:SS for < 1 hour', () => {
    const deadline = new Date(Date.now() + 5 * 60 * 1000 + 30 * 1000).toISOString(); // 5:30
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.displayTime).toMatch(/^0?5:30$/);
  });

  it('formats displayTime as HH:MM:SS for >= 1 hour', () => {
    const deadline = new Date(Date.now() + 75 * 60 * 1000).toISOString(); // 1:15:00
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.displayTime).toMatch(/^1:1[45]:\d{2}$/);
  });

  it('applies serverTimeOffset to correct for client clock skew', () => {
    const clientNow = Date.now();
    vi.setSystemTime(clientNow);

    // Server is 5 minutes BEHIND client (serverOffset = serverClock - clientClock = -300_000)
    const serverOffset = -300_000;

    // Server's current time = clientNow + serverOffset = clientNow - 300_000
    // Deadline = server_now + 10 min = (clientNow + serverOffset) + 10*60_000
    const deadline = new Date(clientNow + serverOffset + 10 * 60_000).toISOString();

    const { result } = renderHook(() => useExamTimer(deadline, serverOffset));

    // serverAdjustedNow = Date.now() + serverOffset = clientNow - 300_000
    // remaining = deadline - serverAdjustedNow
    //           = (clientNow - 300_000 + 600_000) - (clientNow - 300_000)
    //           = 600_000 ms = 10 min ✓
    expect(result.current.timeLeftMs).toBeGreaterThan(9 * 60_000);
    expect(result.current.timeLeftMs).toBeLessThanOrEqual(10 * 60_000 + 500);
  });

  it('does not prematurely set isExpired=true when transitioning from null to a future deadline', () => {
    const { result, rerender } = renderHook(
      ({ dl }: { dl: string | null }) => useExamTimer(dl),
      { initialProps: { dl: null as string | null } }
    );
    expect(result.current.isPractice).toBe(true);
    expect(result.current.isExpired).toBe(false);

    const futureDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    rerender({ dl: futureDeadline });

    expect(result.current.isPractice).toBe(false);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeftMs).toBeGreaterThan(0);
  });
});
