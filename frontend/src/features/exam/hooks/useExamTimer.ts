import { useState, useEffect, useRef, useCallback } from 'react';

export interface ExamTimerResult {
  timeLeftMs: number;
  remainingSeconds: number;
  isExpired: boolean;
  displayTime: string;
  isPractice: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function useExamTimer(
  arg1: string | null,
  arg2?: string | number | null
): ExamTimerResult {
  let resolvedDeadline: string | null = null;
  let initialServerTime: string | null = null;
  let explicitOffset: number | null = null;

  if (typeof arg2 === 'string' || (arg2 === null && arguments.length >= 2)) {
    // Calling convention: (serverTime, deadline)
    initialServerTime = arg1;
    resolvedDeadline = arg2;
  } else {
    // Calling convention: (deadline, serverTimeOffset?)
    resolvedDeadline = arg1;
    if (typeof arg2 === 'number') {
      explicitOffset = arg2;
    }
  }

  const isPractice = resolvedDeadline === null;

  // Track initialServerTime to calculate offset once when serverTime changes
  const computedServerOffsetRef = useRef<number | null>(null);
  const prevServerTimeRef = useRef<string | null>(initialServerTime);
  if (computedServerOffsetRef.current === null || prevServerTimeRef.current !== initialServerTime) {
    prevServerTimeRef.current = initialServerTime;
    computedServerOffsetRef.current = initialServerTime ? (new Date(initialServerTime).getTime() - Date.now()) : 0;
  }

  const currentOffset = explicitOffset !== null ? explicitOffset : (computedServerOffsetRef.current ?? 0);
  const currentOffsetRef = useRef<number>(currentOffset);
  currentOffsetRef.current = currentOffset;

  const computeTimeLeft = useCallback((dl: string | null, offset: number): number => {
    if (dl === null || !dl) return 0;
    const serverAdjustedNow = Date.now() + offset;
    return Math.max(0, Date.parse(dl) - serverAdjustedNow);
  }, []);

  const [prevDeadline, setPrevDeadline] = useState<string | null>(resolvedDeadline);
  const [prevOffset, setPrevOffset] = useState<number>(currentOffset);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => computeTimeLeft(resolvedDeadline, currentOffset));

  let effectiveTimeLeft = timeLeftMs;
  if (resolvedDeadline !== prevDeadline || currentOffset !== prevOffset) {
    setPrevDeadline(resolvedDeadline);
    setPrevOffset(currentOffset);
    effectiveTimeLeft = computeTimeLeft(resolvedDeadline, currentOffset);
    setTimeLeftMs(effectiveTimeLeft);
  }

  useEffect(() => {
    if (isPractice || !resolvedDeadline) return;

    const tick = () => {
      setTimeLeftMs(computeTimeLeft(resolvedDeadline, currentOffsetRef.current));
    };

    tick();

    const intervalId = setInterval(tick, 500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resolvedDeadline, isPractice, computeTimeLeft]);

  const hasExpired = !isPractice && resolvedDeadline !== null && effectiveTimeLeft === 0;
  const remainingSeconds = Math.max(0, Math.floor(effectiveTimeLeft / 1000));

  return {
    timeLeftMs: effectiveTimeLeft,
    remainingSeconds,
    isExpired: hasExpired,
    displayTime: isPractice ? '' : formatTime(effectiveTimeLeft),
    isPractice,
  };
}
