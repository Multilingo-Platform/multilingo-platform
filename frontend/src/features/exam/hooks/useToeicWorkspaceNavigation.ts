import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToeicWorkspaceModel } from '../utils/toeicWorkspaceModel';

export interface UseToeicWorkspaceNavigationOptions {
  /** Route identity: changing it resets the active question (new attempt). */
  attemptId: number | null | undefined;
  model: ToeicWorkspaceModel;
  /** Parts whose section is locked; navigation into them is refused. */
  lockedPartIds?: Iterable<number> | null;
}

export interface ToeicWorkspaceNavigation {
  activePartId: number | null;
  activeQuestionId: string | null;
  isLocked: (partId: number) => boolean;
  /** Navigates to a Part/question pair; returns false when locked, unknown or mismatched. */
  navigate: (partId: number, questionId: string) => boolean;
  navigateToQuestion: (questionId: string) => boolean;
  nextQuestion: () => boolean;
  previousQuestion: () => boolean;
}

interface ActiveQuestion {
  partId: number;
  questionId: string;
}

/**
 * Owns the active Part/question for the TOEIC workspace. The active question is independent of
 * the active Part: Part switching and question selection are both explicit, locked Parts are
 * never entered, and the state resets when the route identity (attemptId) changes.
 */
export function useToeicWorkspaceNavigation({
  attemptId,
  model,
  lockedPartIds,
}: UseToeicWorkspaceNavigationOptions): ToeicWorkspaceNavigation {
  const locked = useMemo(() => new Set(lockedPartIds ? Array.from(lockedPartIds) : []), [lockedPartIds]);
  const isLocked = useCallback((partId: number) => locked.has(partId), [locked]);

  const navigableQuestions = useMemo(
    () => model.questions.filter(question => !locked.has(question.partId)),
    [model, locked]
  );

  const firstActive = useCallback((): ActiveQuestion | null => {
    const first = navigableQuestions[0];
    return first ? { partId: first.partId, questionId: first.questionId } : null;
  }, [navigableQuestions]);

  const [active, setActive] = useState<ActiveQuestion | null>(() => firstActive());

  const firstActiveRef = useRef(firstActive);
  firstActiveRef.current = firstActive;
  const attemptRef = useRef(attemptId);

  useEffect(() => {
    if (attemptRef.current !== attemptId) {
      attemptRef.current = attemptId;
      setActive(firstActiveRef.current());
      return;
    }

    setActive(prev => {
      if (prev && navigableQuestions.some(q => q.questionId === prev.questionId && q.partId === prev.partId)) {
        return prev;
      }
      return firstActiveRef.current();
    });
  }, [attemptId, navigableQuestions]);

  const partByQuestionId = useMemo(() => {
    const map = new Map<string, number>();
    model.questions.forEach(question => map.set(question.questionId, question.partId));
    return map;
  }, [model]);

  const navigate = useCallback(
    (partId: number, questionId: string): boolean => {
      const ownerPartId = partByQuestionId.get(questionId);
      if (ownerPartId === undefined || ownerPartId !== partId) return false;
      if (locked.has(partId)) return false;
      setActive({ partId, questionId });
      return true;
    },
    [partByQuestionId, locked]
  );

  const navigateToQuestion = useCallback(
    (questionId: string): boolean => {
      const ownerPartId = partByQuestionId.get(questionId);
      if (ownerPartId === undefined || locked.has(ownerPartId)) return false;
      setActive({ partId: ownerPartId, questionId });
      return true;
    },
    [partByQuestionId, locked]
  );

  const step = useCallback(
    (delta: number): boolean => {
      if (navigableQuestions.length === 0) return false;
      const currentIndex = active
        ? navigableQuestions.findIndex(question => question.questionId === active.questionId)
        : -1;
      const nextIndex =
        currentIndex === -1 ? (delta > 0 ? 0 : navigableQuestions.length - 1) : currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= navigableQuestions.length) return false;

      const target = navigableQuestions[nextIndex];
      setActive({ partId: target.partId, questionId: target.questionId });
      return true;
    },
    [navigableQuestions, active]
  );

  const nextQuestion = useCallback(() => step(1), [step]);
  const previousQuestion = useCallback(() => step(-1), [step]);

  return {
    activePartId: active?.partId ?? null,
    activeQuestionId: active?.questionId ?? null,
    isLocked,
    navigate,
    navigateToQuestion,
    nextQuestion,
    previousQuestion,
  };
}

export default useToeicWorkspaceNavigation;
