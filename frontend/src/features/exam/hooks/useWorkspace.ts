import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store/store';
import { getWorkspace } from '../api/attemptApi';
import { setAttemptContext, clearAnswers } from '../store/answerSlice';
import type { WorkspaceResponse } from '../types/api.types';

interface UseWorkspaceResult {
  workspace: WorkspaceResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export default function useWorkspace(attemptId: number): UseWorkspaceResult {
  const dispatch = useDispatch<AppDispatch>();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Effect 1: Fetch workspace. Cancels in-flight request on re-run (retry or attemptId change).
  // Does NOT dispatch clearAnswers — avoids wiping Redux state between retry cycles.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getWorkspace(attemptId)
      .then(data => {
        if (cancelled) return;
        setWorkspace(data);
        dispatch(setAttemptContext({
          attemptId: data.attempt_id,
          version: data.version,
          savedAnswers: data.saved_answers,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không thể tải phiên thi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Do NOT dispatch clearAnswers here — retry cycles should preserve Redux state
    };
  }, [attemptId, retryCount, dispatch]);

  // Effect 2: Cleanup Redux answers only when leaving this attempt entirely
  // (attemptId changes or component unmounts — NOT on retry).
  useEffect(() => {
    return () => {
      dispatch(clearAnswers());
    };
  }, [attemptId, dispatch]);

  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  return { workspace, loading, error, retry };
}
