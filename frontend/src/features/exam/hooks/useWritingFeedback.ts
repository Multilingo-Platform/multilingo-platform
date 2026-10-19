import { useCallback, useEffect, useRef, useState } from 'react';
import type { WritingFeedbackResponse } from '../types/api.types';
import { getWritingFeedback } from '../api/attemptApi';
import {
  classifyWritingFeedbackError,
  REFRESH_WARNING_MESSAGE,
  type WritingFeedbackLoadError,
} from '../utils/writingFeedbackErrors';

export interface UseWritingFeedbackResult {
  data: WritingFeedbackResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: WritingFeedbackLoadError | null;
  refreshError: WritingFeedbackLoadError | null;
  reload(): Promise<void>;
}

interface WritingFeedbackState {
  attemptId: number;
  partId: number;
  data: WritingFeedbackResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: WritingFeedbackLoadError | null;
  refreshError: WritingFeedbackLoadError | null;
}

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

function initialFeedbackState(
  attemptId: number,
  partId: number,
  enabled: boolean
): WritingFeedbackState {
  const valid = isPositiveInt(attemptId) && isPositiveInt(partId);
  return {
    attemptId,
    partId,
    data: null,
    loading: valid && enabled,
    refreshing: false,
    error: valid
      ? null
      : {
          kind: 'invalid_request',
          message: 'ID phiên thi hoặc phần thi không hợp lệ.',
          isTransient: false,
        },
    refreshError: null,
  };
}

export function useWritingFeedback(
  attemptId: number,
  partId: number,
  enabled: boolean
): UseWritingFeedbackResult {
  const [state, setState] = useState<WritingFeedbackState>(() =>
    initialFeedbackState(attemptId, partId, enabled)
  );

  const activeRef = useRef<{ key: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const lifecycleKeyRef = useRef<string | null>(null);

  const currentKey = `${attemptId}:${partId}`;

  const reload = useCallback(async (): Promise<void> => {
    if (!isPositiveInt(attemptId) || !isPositiveInt(partId)) {
      return;
    }

    const previousOperation = activeRef.current;
    if (previousOperation?.key === currentKey) {
      return previousOperation.promise;
    }
    activeRef.current = null;
    previousOperation?.controller.abort();

    const controller = new AbortController();

    setState(previous => {
      const hasData =
        previous.attemptId === attemptId && previous.partId === partId && previous.data !== null;
      return {
        attemptId,
        partId,
        data: hasData ? previous.data : null,
        loading: !hasData,
        refreshing: hasData,
        error: null,
        refreshError: null,
      };
    });

    const promise = (async () => {
      try {
        const result = await getWritingFeedback(attemptId, partId, {
          signal: controller.signal,
        });

        if (activeRef.current?.controller !== controller) return;

        loadedKeyRef.current = currentKey;

        setState({
          attemptId,
          partId,
          data: result,
          loading: false,
          refreshing: false,
          error: null,
          refreshError: null,
        });
      } catch (err: unknown) {
        if (activeRef.current?.controller !== controller) return;
        if (controller.signal.aborted) {
          setState(previous => {
            if (
              previous.attemptId === attemptId &&
              previous.partId === partId &&
              (previous.loading || previous.refreshing)
            ) {
              return {
                ...previous,
                loading: false,
                refreshing: false,
              };
            }
            return previous;
          });
          return;
        }

        const failure = classifyWritingFeedbackError(err);

        setState(previous => {
          const hasData =
            previous.attemptId === attemptId &&
            previous.partId === partId &&
            previous.data !== null;

          if (hasData && failure.isTransient) {
            return {
              ...previous,
              loading: false,
              refreshing: false,
              error: null,
              refreshError: {
                ...failure,
                message: REFRESH_WARNING_MESSAGE,
              },
            };
          }

          loadedKeyRef.current = null;

          return {
            attemptId,
            partId,
            data: null,
            loading: false,
            refreshing: false,
            error: failure,
            refreshError: null,
          };
        });
      } finally {
        if (activeRef.current?.controller === controller) {
          activeRef.current = null;
        }
      }
    })();

    const operation = { key: currentKey, controller, promise };
    activeRef.current = operation;
    return promise;
  }, [attemptId, partId, currentKey]);

  useEffect(() => {
    // Loaded data belongs only to the current identity, not a per-key cache.
    if (lifecycleKeyRef.current !== currentKey) {
      loadedKeyRef.current = null;
      lifecycleKeyRef.current = currentKey;
    }

    if (enabled && isPositiveInt(attemptId) && isPositiveInt(partId)
        && loadedKeyRef.current !== currentKey) {
      void reload();
    }

    // Cleanup is required even when reopening reuses already loaded data.

    return () => {
      const operation = activeRef.current;
      activeRef.current = null;
      operation?.controller.abort();
      if (operation) {
        setState(previous => {
          if (
            previous.attemptId === attemptId &&
            previous.partId === partId &&
            (previous.loading || previous.refreshing)
          ) {
            return {
              ...previous,
              loading: false,
              refreshing: false,
            };
          }
          return previous;
        });
      }
    };
  }, [attemptId, partId, enabled, currentKey, reload]);

  // Isolate current identity: do not expose stale identity state during render transitions
  const current =
    state.attemptId === attemptId && state.partId === partId
      ? state
      : initialFeedbackState(attemptId, partId, enabled);

  return {
    data: current.data,
    loading: current.loading,
    refreshing: current.refreshing,
    error: current.error,
    refreshError: current.refreshError,
    reload,
  };
}
