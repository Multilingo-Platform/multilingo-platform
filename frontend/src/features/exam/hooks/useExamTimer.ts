import { useState, useEffect } from 'react';

export interface ExamTimerResult {
  timeLeftMs: number;
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

/**
 * @param deadline  ISO-8601 deadline string from server, or null for practice mode.
 * @param serverTimeOffset  (optional) ms difference: serverClock − clientClock at workspace
 *   fetch time. Positive = server ahead; negative = server behind. Defaults to 0.
 */
export function useExamTimer(
  deadline: string | null,
  serverTimeOffset: number = 0
): ExamTimerResult {
  const isPractice = deadline === null;

  const computeTimeLeft = (dl: string | null): number => {
    if (dl === null || !dl) return 0;
    // Adjust client's "now" by the server-client clock difference
    const serverAdjustedNow = Date.now() + serverTimeOffset;
    return Math.max(0, Date.parse(dl) - serverAdjustedNow);
  };

  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => computeTimeLeft(deadline));
  const [prevDeadline, setPrevDeadline] = useState<string | null>(deadline);

  // Synchronize state immediately during render if deadline prop changes
  if (deadline !== prevDeadline) {
    setPrevDeadline(deadline);
    setTimeLeftMs(computeTimeLeft(deadline));
  }

  useEffect(() => {
    if (isPractice || !deadline) return;

    setTimeLeftMs(computeTimeLeft(deadline));

    // Refresh mỗi 500ms để tránh giật khi quay lại từ tab ẩn
    const id = setInterval(() => {
      setTimeLeftMs(computeTimeLeft(deadline));
    }, 500);

    return () => clearInterval(id);
  }, [deadline, isPractice, serverTimeOffset]);

  const hasExpired = !isPractice && deadline !== null && timeLeftMs === 0;

  return {
    timeLeftMs,
    isExpired: hasExpired,
    displayTime: isPractice ? '' : formatTime(timeLeftMs),
    isPractice,
  };
}
