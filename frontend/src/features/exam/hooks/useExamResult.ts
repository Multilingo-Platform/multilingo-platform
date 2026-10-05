import { useState, useEffect } from 'react';
import { getAttemptResult, ResultNotReadyError } from '../api/attemptApi';
import type { ExamResultResponse } from '../types/api.types';

interface UseExamResultReturn {
  result: ExamResultResponse | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
}

export function useExamResult(attemptId: number): UseExamResultReturn {
  const [result, setResult] = useState<ExamResultResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    setResult(null);
    setIsPolling(false);

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await getAttemptResult(attemptId);
        
        if (cancelled) return;
        setResult(data);
        setIsPolling(false);
      } catch (err: unknown) {
        if (cancelled) return;

        if (err instanceof ResultNotReadyError) {
          setIsPolling(true);
          // Wait for retryAfter seconds before trying again
          timer = setTimeout(fetchData, err.retryAfter * 1000);
        } else {
          setIsPolling(false);
          setError(err instanceof Error ? err.message : 'Lỗi khi tải kết quả');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [attemptId]);

  return { result, loading, error, isPolling };
}
