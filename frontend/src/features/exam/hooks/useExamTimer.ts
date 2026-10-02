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

  // Compute offset only ONCE when serverTime or explicitOffset is provided
  const offsetRef = useRef<number | null>(null);
  const serverTimeRef = useRef<string | null>(initialServerTime);

  if (offsetRef.current === null || serverTimeRef.current !== initialServerTime) {
    serverTimeRef.current = initialServerTime;
    if (explicitOffset !== null) {
      offsetRef.current = explicitOffset;
    } else if (initialServerTime) {
      offsetRef.current = new Date(initialServerTime).getTime() - Date.now();
    } else {
      offsetRef.current = 0;
    }
  }

  const computeTimeLeft = useCallback((dl: string | null): number => {
    if (dl === null || !dl) return 0;
    const serverAdjustedNow = Date.now() + (offsetRef.current ?? 0);
    return Math.max(0, Date.parse(dl) - serverAdjustedNow);
  }, []);

  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => computeTimeLeft(resolvedDeadline));
  const [prevDeadline, setPrevDeadline] = useState<string | null>(resolvedDeadline);

  // Synchronize state immediately during render if deadline changes
  if (resolvedDeadline !== prevDeadline) {
    setPrevDeadline(resolvedDeadline);
    setTimeLeftMs(computeTimeLeft(resolvedDeadline));
  }

  useEffect(() => {
    if (isPractice || !resolvedDeadline) return;

    const tick = () => {
      setTimeLeftMs(computeTimeLeft(resolvedDeadline));
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

  const hasExpired = !isPractice && resolvedDeadline !== null && timeLeftMs === 0;
  const remainingSeconds = Math.max(0, Math.floor(timeLeftMs / 1000));

  return {
    timeLeftMs,
    remainingSeconds,
    isExpired: hasExpired,
    displayTime: isPractice ? '' : formatTime(timeLeftMs),
    isPractice,
  };
}
