import { useCallback, useState } from 'react';

export interface PracticeRetryController {
  active: boolean;
  questionIds: string[];
  start(ids: readonly string[]): void;
  stop(): void;
}

export function usePracticeRetry(
  contextKey: string | number | null,
  partId: number | null
): PracticeRetryController {
  const [state, setState] = useState<{
    contextKey: string | number | null;
    partId: number | null;
    active: boolean;
    questionIds: string[];
  }>({
    contextKey,
    partId,
    active: false,
    questionIds: [],
  });

  // Synchronously end retry round on render if contextKey or partId changes
  const isMatch = state.contextKey === contextKey && state.partId === partId;
  const active = isMatch ? state.active : false;
  const questionIds = isMatch ? state.questionIds : [];

  if (!isMatch) {
    setState({
      contextKey,
      partId,
      active: false,
      questionIds: [],
    });
  }

  const start = useCallback(
    (ids: readonly string[]) => {
      if (!ids || ids.length === 0) {
        setState({
          contextKey,
          partId,
          active: false,
          questionIds: [],
        });
        return;
      }
      setState({
        contextKey,
        partId,
        active: true,
        questionIds: [...ids],
      });
    },
    [contextKey, partId]
  );

  const stop = useCallback(() => {
    setState({
      contextKey,
      partId,
      active: false,
      questionIds: [],
    });
  }, [contextKey, partId]);

  return {
    active,
    questionIds,
    start,
    stop,
  };
}
