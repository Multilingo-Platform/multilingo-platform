import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseVocabTimerOptions {
  initialSeconds: number;
  onTimeUp?: () => void;
  autoStart?: boolean;
}

export interface UseVocabTimerReturn {
  secondsLeft: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: (newSeconds?: number) => void;
  deductTime: (penaltySeconds: number) => void;
  addTime: (bonusSeconds: number) => void;
}

/**
 * Custom Hook quản lý đồng hồ đếm ngược có tính năng phạt/thưởng thời gian
 * Tự động cleanup interval khi component unmount để chống rò rỉ bộ nhớ.
 */
export const useVocabTimer = ({
  initialSeconds,
  onTimeUp,
  autoStart = false,
}: UseVocabTimerOptions): UseVocabTimerReturn => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  // Cập nhật ref callback để không gây re-subscribe interval
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(
    (newSeconds?: number) => {
      clearTimer();
      setSecondsLeft(newSeconds !== undefined ? newSeconds : initialSeconds);
      setIsRunning(false);
    },
    [clearTimer, initialSeconds]
  );

  const deductTime = useCallback((penaltySeconds: number) => {
    setSecondsLeft((prev) => {
      const next = prev - penaltySeconds;
      return next > 0 ? next : 0;
    });
  }, []);

  const addTime = useCallback((bonusSeconds: number) => {
    setSecondsLeft((prev) => prev + bonusSeconds);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          if (onTimeUpRef.current) {
            onTimeUpRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimer();
    };
  }, [isRunning, clearTimer]);

  return {
    secondsLeft,
    isRunning,
    start,
    pause,
    reset,
    deductTime,
    addTime,
  };
};
