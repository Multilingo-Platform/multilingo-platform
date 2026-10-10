import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import { markSavePending, markSaveSuccess, markSaveError, markSaveConflict, markSaveStopped, markSaveCancelled, type SaveOperation } from '../store/answerSlice';
import { autosaveAnswers } from '../api/attemptApi';
import { serializeAnswers } from '../utils/answerSnapshot';
import { persistAnswerDraft, removeAnswerDraft } from '../utils/answerDraft';
import { isHttpConflict, isVersionConflict } from '../utils/attemptErrors';

export interface AutosaveController {
  pauseAndWait(): Promise<{ status: 'ready' | 'conflict' | 'stale' }>;
  resume(): void;
  draftWarning: string | null;
}

let saveSequence = 0;
const STORAGE_WARNING = 'Không thể lưu bản dự phòng trên thiết bị. Không đóng trang khi chưa nộp bài thành công.';

export function useAutosave(
  attemptId: number | null,
  timing?: { deadline: string | null; serverTimeOffset: number }
): AutosaveController {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const revision = useSelector((state: RootState) => state.answers.contextRevision);
  const live = useRef({ attemptId, revision, timing });
  live.current = { attemptId, revision, timing };
  const lifecycle = useRef(0);
  const paused = useRef(false);
  const blocked = useRef(false);
  const active = useRef<{ operation: SaveOperation; abort: AbortController; promise: Promise<void> } | null>(null);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);

  useEffect(() => {
    const generation = ++lifecycle.current;
    paused.current = false;
    blocked.current = false;
    setDraftWarning(null);
    if (!attemptId) return;
    const isCurrent = () => lifecycle.current === generation
      && live.current.attemptId === attemptId && live.current.revision === revision
      && store.getState().answers.attemptId === attemptId
      && store.getState().answers.contextRevision === revision;
    const backupLatest = () => {
      if (!isCurrent()) return;
      setDraftWarning(persistAnswerDraft(attemptId, store.getState().answers.answers) ? null : STORAGE_WARNING);
    };

    const timer = setInterval(() => {
      const state = store.getState().answers;
      const clock = live.current.timing;
      const expired = clock?.deadline != null && Date.now() + clock.serverTimeOffset >= Date.parse(clock.deadline);
      if (!isCurrent() || paused.current || blocked.current || active.current || expired
          || !state.isDirty || state.saveStatus === 'saving' || state.saveStatus === 'conflict' || state.version < 1) return;
      const operation: SaveOperation = { attemptId, contextRevision: revision, requestId: `save-${++saveSequence}`, pendingVersion: state.pendingVersion };
      const abort = new AbortController();
      dispatch(markSavePending(operation));
      if (store.getState().answers.activeSaveId !== operation.requestId) return;
      const promise = Promise.resolve().then(async () => {
        try {
          const result = await autosaveAnswers(attemptId, { version: state.version, answers: serializeAnswers(state.answers) }, { signal: abort.signal });
          if (!isCurrent() || abort.signal.aborted) return;
          dispatch(markSaveSuccess({ ...operation, savedAt: Date.now(), serverVersion: result.version }));
          if (store.getState().answers.isDirty) backupLatest();
          else setDraftWarning(removeAnswerDraft(attemptId) ? null : 'Không thể xóa bản dự phòng đã đồng bộ trên thiết bị.');
        } catch (error) {
          if (!isCurrent() || abort.signal.aborted) return;
          if (isVersionConflict(error)) {
            blocked.current = true;
            dispatch(markSaveConflict(operation));
          } else if (isHttpConflict(error)) {
            blocked.current = true;
            dispatch(markSaveStopped(operation));
          } else {
            dispatch(markSaveError(operation));
          }
          backupLatest();
        } finally {
          if (active.current?.operation.requestId === operation.requestId) active.current = null;
        }
      });
      active.current = { operation, abort, promise };
    }, 15000);

    return () => {
      clearInterval(timer);
      lifecycle.current += 1;
      const request = active.current;
      active.current = null;
      if (request) {
        request.abort.abort();
        dispatch(markSaveCancelled(request.operation));
      }
    };
  }, [attemptId, revision, dispatch, store]);

  const pauseAndWait = useCallback(async () => {
    const context = live.current;
    const generation = lifecycle.current;
    paused.current = true;
    await active.current?.promise;
    const state = store.getState().answers;
    if (generation !== lifecycle.current || context.attemptId !== live.current.attemptId
        || context.revision !== live.current.revision || state.attemptId !== context.attemptId
        || state.contextRevision !== context.revision) return { status: 'stale' as const };
    return { status: state.saveStatus === 'conflict' ? 'conflict' as const : 'ready' as const };
  }, [store]);
  const resume = useCallback(() => { paused.current = false; }, []);
  return useMemo(() => ({ pauseAndWait, resume, draftWarning }), [pauseAndWait, resume, draftWarning]);
}
