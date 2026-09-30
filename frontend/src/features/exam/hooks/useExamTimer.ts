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

export function useExamTimer(deadline: string | null): ExamTimerResult {
  const isPractice = deadline === null;

  const computeTimeLeft = (): number => {
    if (isPractice || !deadline) return 0;
    return Math.max(0, Date.parse(deadline) - Date.now());
  };

  const [timeLeftMs, setTimeLeftMs] = useState<number>(computeTimeLeft);

  useEffect(() => {
    if (isPractice) return;

    setTimeLeftMs(computeTimeLeft());

    // Refresh mỗi 500ms để tránh giật khi quay lại từ tab ẩn
    const id = setInterval(() => {
      setTimeLeftMs(computeTimeLeft());
    }, 500);

    return () => clearInterval(id);
  }, [deadline, isPractice]);

  return {
    timeLeftMs,
    isExpired: !isPractice && timeLeftMs === 0,
    displayTime: isPractice ? '' : formatTime(timeLeftMs),
    isPractice,
  };
}
