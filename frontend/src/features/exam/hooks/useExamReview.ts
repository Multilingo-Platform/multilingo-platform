import { useState, useEffect } from 'react';
import { getAttemptReview } from '../api/attemptApi';
import type { ExamReviewResponse } from '../types/api.types';

export function useExamReview(attemptId: number, partId: number | null) {
  const [data, setData] = useState<ExamReviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!attemptId || !partId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setData(null);
    setError(null);

    getAttemptReview(attemptId, partId)
      .then((res) => {
        if (isMounted) {
          setData(res);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [attemptId, partId]);

  return { data, loading, error };
}
