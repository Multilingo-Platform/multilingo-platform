import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import type { SubmitResult, WorkspaceResponse } from '../types/api.types';
import type { AutosaveController } from './useAutosave';
import { submitAttempt } from '../api/attemptApi';
import { markSubmissionConflict } from '../store/answerSlice';
import { serializeAnswers } from '../utils/answerSnapshot';
import { persistAnswerDraft } from '../utils/answerDraft';
import { isHttpConflict, isVersionConflict } from '../utils/attemptErrors';

export type SubmissionPhase = 'idle' | 'waiting' | 'submitting' | 'error' | 'conflict' | 'succeeded';
type SubmitReason = 'MANUAL' | 'TIMEOUT_CLIENT';

export function useAttemptSubmission(workspace: WorkspaceResponse | null, autosave: AutosaveController) {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const revision = useSelector((state: RootState) => state.answers.contextRevision);
  const attemptId = workspace?.attempt_id ?? null;
  const live = useRef({ workspace, autosave, revision });
  live.current = { workspace, autosave, revision };
  const generation = useRef(0);
  const busy = useRef(false);
  const succeeded = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const reason = useRef<SubmitReason>('MANUAL');
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [draftWarning, setDraftWarning] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    generation.current += 1;
    busy.current = false;
    succeeded.current = false;
    reason.current = 'MANUAL';
    setPhase('idle'); setError(null); setDraftWarning(null); setResult(null);
    return () => {
      generation.current += 1;
      abort.current?.abort();
      abort.current = null;
    };
  }, [attemptId, revision]);

  const expired = useCallback(() => {
    const current = live.current.workspace;
    return current?.deadline != null && Date.now() + current.serverTimeOffset >= Date.parse(current.deadline);
  }, []);
  const isLocked = useCallback(() => busy.current || succeeded.current || expired(), [expired]);

  const submit = useCallback(async (requestedReason: SubmitReason): Promise<void> => {
    const current = live.current;
    const data = current.workspace;
    const state = store.getState().answers;
    if (!data || data.status !== 'IN_PROGRESS' || state.attemptId !== data.attempt_id
        || state.contextRevision !== current.revision || state.version < 1) return;
    if (busy.current || succeeded.current) return;
    if (requestedReason === 'TIMEOUT_CLIENT' || expired()) reason.current = 'TIMEOUT_CLIENT';
    const opGeneration = generation.current;
    const isCurrent = () => generation.current === opGeneration
      && live.current.workspace?.attempt_id === data.attempt_id
      && live.current.revision === current.revision
      && store.getState().answers.attemptId === data.attempt_id
      && store.getState().answers.contextRevision === current.revision;
    const conflict = () => {
      dispatch(markSubmissionConflict({ attemptId: data.attempt_id, contextRevision: current.revision }));
      setPhase('conflict');
      setError('Đáp án đã thay đổi trên máy chủ. Tải lại phiên thi để tiếp tục.');
    };
    busy.current = true;
    setPhase('waiting'); setError(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const barrier = await current.autosave.pauseAndWait();
      if (!isCurrent() || barrier.status === 'stale') return;
      if (barrier.status === 'conflict' || store.getState().answers.saveStatus === 'conflict') {
        conflict();
        return;
      }
      const latest = store.getState().answers;
      const finalAnswers = serializeAnswers(latest.answers);
      setDraftWarning(persistAnswerDraft(data.attempt_id, latest.answers) ? null
        : 'Không thể lưu bản dự phòng trên thiết bị. Bài vẫn đang được gửi lên máy chủ.');
      if (expired()) reason.current = 'TIMEOUT_CLIENT';
      setPhase('submitting');
      const receipt = await submitAttempt(data.attempt_id, {
        reason: reason.current, baseVersion: latest.version, finalAnswers,
      }, { signal: controller.signal });
      if (!isCurrent() || controller.signal.aborted) return;
      succeeded.current = true;
      setResult(receipt); setPhase('succeeded');
      // A successful receipt does not acknowledge that this final snapshot was accepted.
    } catch (failure) {
      if (!isCurrent() || controller.signal.aborted) return;
      if (!persistAnswerDraft(data.attempt_id, store.getState().answers.answers)) {
        setDraftWarning('Không thể lưu bản dự phòng trên thiết bị. Không đóng trang khi chưa nộp bài thành công.');
      }
      if (isVersionConflict(failure)) conflict();
      else {
        setPhase('error');
        setError(failure instanceof Error ? failure.message : 'Không thể nộp bài. Vui lòng thử lại.');
        if (reason.current === 'MANUAL' && !expired() && !isHttpConflict(failure)) current.autosave.resume();
      }
    } finally {
      if (isCurrent()) {
        busy.current = false;
        if (abort.current === controller) abort.current = null;
      }
    }
  }, [dispatch, store, expired]);
  const retry = useCallback(() => submit(reason.current), [submit]);
  return { phase, error, draftWarning, result, submit, retry, isLocked };
}
