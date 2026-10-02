import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store/store';
import {
  markSavePending,
  markSaveSuccess,
  markSaveError,
  selectSaveStatus,
} from '../store/answerSlice';
import { autosaveAnswers } from '../api/attemptApi';

const AUTOSAVE_INTERVAL_MS = 15_000;

export function useAutosave(attemptId: number | null): void {
  const dispatch = useDispatch<AppDispatch>();
  const { isDirty, saveStatus, pendingVersion } = useSelector(
    (state: RootState) => selectSaveStatus(state)
  );
  const answersState = useSelector((state: RootState) => state.answers);

  // Dùng ref để tránh closure stale trong setInterval
  const stateRef = useRef({ isDirty, saveStatus, answersState, pendingVersion });
  stateRef.current = { isDirty, saveStatus, answersState, pendingVersion };

  useEffect(() => {
    if (!attemptId) return;

    let timerId: ReturnType<typeof setInterval> | null = null;

    const stopAutosave = () => {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    timerId = setInterval(async () => {
      const {
        isDirty: currentIsDirty,
        saveStatus: currentSaveStatus,
        answersState: currentAnswersState,
        pendingVersion: capturedVersion,
      } = stateRef.current;

      // Guard: bỏ qua nếu không dirty hoặc đang save
      if (!currentIsDirty || currentSaveStatus === 'saving') return;

      dispatch(markSavePending(capturedVersion));

      // Chuyển answers Record thành mảng PartAnswers
      const answers = Object.entries(currentAnswersState.answers).map(([partId, qMap]) => ({
        part_id: Number(partId),
        answers: Object.entries(qMap).map(([question_id, answer]) => ({ question_id, answer })),
      }));

      try {
        await autosaveAnswers(attemptId, { version: currentAnswersState.version, answers });
        dispatch(markSaveSuccess({ savedAt: Date.now(), version: capturedVersion }));
        // Remove localStorage draft after successful server sync
        try { localStorage.removeItem(`exam_draft_${attemptId}`); } catch { /* ignore */ }
      } catch (err: any) {
        dispatch(markSaveError());
        const is409 = err?.response?.status === 409 || err?.message?.includes('409') || err?.code === 409;
        if (is409) {
          stopAutosave();
          return;
        }
        // Keep draft in localStorage as offline fallback
        try {
          localStorage.setItem(
            `exam_draft_${attemptId}`,
            JSON.stringify(currentAnswersState.answers)
          );
        } catch { /* ignore storage quota errors */ }
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => stopAutosave();
  }, [attemptId, dispatch]);
}
