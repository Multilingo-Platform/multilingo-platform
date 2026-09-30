import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store/store';
import { markSavePending, markSaveSuccess, markSaveError, selectSaveStatus } from '../store/answerSlice';
import { autosaveAnswers } from '../api/attemptApi';

const AUTOSAVE_INTERVAL_MS = 15_000;

export function useAutosave(attemptId: number | null): void {
  const dispatch = useDispatch<AppDispatch>();
  const { isDirty, saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));
  const answersState = useSelector((state: RootState) => state.answers);

  // Dùng ref để tránh closure stale trong setInterval
  const stateRef = useRef({ isDirty, saveStatus, answersState });
  stateRef.current = { isDirty, saveStatus, answersState };

  useEffect(() => {
    if (!attemptId) return;

    const id = setInterval(async () => {
      const { isDirty: currentIsDirty, saveStatus: currentSaveStatus, answersState: currentAnswersState } = stateRef.current;
      // Guard: bỏ qua nếu không dirty hoặc đang save
      if (!currentIsDirty || currentSaveStatus === 'saving') return;

      dispatch(markSavePending());

      // Chuyển answers Record thành mảng PartAnswers
      const answers = Object.entries(currentAnswersState.answers).map(([partId, qMap]) => ({
        part_id: Number(partId),
        answers: Object.entries(qMap).map(([question_id, answer]) => ({ question_id, answer })),
      }));

      try {
        await autosaveAnswers(attemptId, { version: currentAnswersState.version, answers });
        dispatch(markSaveSuccess({ savedAt: Date.now() }));
        // Ghi vào localStorage làm fallback
        try {
          localStorage.setItem(`exam_draft_${attemptId}`, JSON.stringify(currentAnswersState.answers));
        } catch {
          // Ignore storage quota errors
        }
      } catch {
        dispatch(markSaveError());
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [attemptId, dispatch]);
}
