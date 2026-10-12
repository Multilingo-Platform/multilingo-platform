import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '../../../app/store';
import type {
  WorkspaceResponse,
  PracticeFeedbackResponse,
} from '../types/api.types';
import type { Question } from '../types/exam.types';
import type { AnswerValue } from '../types/answer.types';
import { checkPracticeAnswer } from '../api/attemptApi';
import {
  areAnswerValuesEqual,
  PracticeFeedbackContractError,
} from '../api/practiceFeedbackContract';

export interface PracticeQuestionFeedback {
  phase: 'idle' | 'checking' | 'ready' | 'error';
  data: PracticeFeedbackResponse | null;
  error: { message: string; retryable: boolean } | null;
}

export interface PracticeFeedbackController {
  busy: boolean;
  blockedMessage: string | null;
  wrongQuestionIds: string[];
  getFeedback(questionId: string): PracticeQuestionFeedback;
  check(questionId: string): Promise<void>;
  hideFeedback(questionIds: readonly string[]): void;
  suspend(): void;
}

export interface UsePracticeFeedbackOptions {
  workspace: WorkspaceResponse | null;
  partId: number | null;
  questions?: readonly Question[];
  isLocked?: boolean;
}

interface ActiveFlight {
  flightId: number;
  partId: number;
  questionId: string;
  abortController: AbortController;
}

function cloneAnswerValue(val: AnswerValue): AnswerValue {
  if (val === null || typeof val === 'string') return val;
  if (Array.isArray(val)) return [...val];
  return { ...val };
}

function extractHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const axiosErr = err as {
      response?: {
        status?: number;
        data?: { code?: number; status?: number };
      };
    };
    return (
      axiosErr.response?.status ??
      axiosErr.response?.data?.status ??
      axiosErr.response?.data?.code
    );
  }
  return undefined;
}

function isTimeoutError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const axiosErr = err as { code?: string; message?: string };
    return axiosErr.code === 'ECONNABORTED' || /timeout/i.test(axiosErr.message ?? '');
  }
  return false;
}

function isAbortError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const error = err as { name?: string; message?: string };
    return (
      error.name === 'CanceledError' ||
      error.name === 'AbortError' ||
      /hủy|cancel|abort/i.test(error.message ?? '')
    );
  }
  return false;
}

export function usePracticeFeedback(
  optionsOrWorkspace: UsePracticeFeedbackOptions | WorkspaceResponse | null,
  legacyPartId?: number | null,
  legacyQuestions?: readonly Question[],
  legacyIsLocked?: boolean
): PracticeFeedbackController {
  let workspace: WorkspaceResponse | null = null;
  let partId: number | null = null;
  let questions: readonly Question[] | undefined = undefined;
  let isLocked: boolean = false;

  if (
    optionsOrWorkspace !== null &&
    typeof optionsOrWorkspace === 'object' &&
    ('workspace' in optionsOrWorkspace ||
      'isLocked' in optionsOrWorkspace ||
      !('attempt_id' in optionsOrWorkspace))
  ) {
    const opts = optionsOrWorkspace as UsePracticeFeedbackOptions;
    workspace = opts.workspace ?? null;
    partId = opts.partId ?? null;
    questions = opts.questions;
    isLocked = !!opts.isLocked;
  } else {
    workspace = optionsOrWorkspace as WorkspaceResponse | null;
    partId = legacyPartId ?? null;
    questions = legacyQuestions;
    isLocked = !!legacyIsLocked;
  }

  const store = useStore<RootState>();

  const live = useRef({ workspace, partId, questions, isLocked });
  live.current = { workspace, partId, questions, isLocked };

  const [feedbacksByPart, setFeedbacksByPart] = useState<
    Record<number, Record<string, PracticeQuestionFeedback>>
  >({});
  const [busy, setBusy] = useState<boolean>(false);
  const busyRef = useRef<boolean>(false);

  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const blockedMessageRef = useRef<string | null>(null);

  const activeFlightRef = useRef<ActiveFlight | null>(null);
  const flightSequence = useRef<number>(0);
  const unmountedRef = useRef<boolean>(false);

  const currentAttemptIdRef = useRef<number | null>(store.getState().answers.attemptId);
  const currentContextRevisionRef = useRef<number>(store.getState().answers.contextRevision);

  // Per-question monotonic revision tracker: key is `${partId}:${questionId}`
  const questionRevisions = useRef<Record<string, number>>({});
  // Per-part, per-question last known answers from store
  const lastKnownAnswers = useRef<Record<number, Record<string, AnswerValue>>>(
    (() => {
      const initial: Record<number, Record<string, AnswerValue>> = {};
      const storeAnswers = store.getState().answers.answers ?? {};
      for (const [pIdStr, qMap] of Object.entries(storeAnswers)) {
        const pId = Number(pIdStr);
        initial[pId] = {};
        for (const [qId, val] of Object.entries(qMap ?? {})) {
          initial[pId][qId] = cloneAnswerValue(val);
        }
      }
      return initial;
    })()
  );

  // Sync busyRef and blockedMessageRef with states
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    blockedMessageRef.current = blockedMessage;
  }, [blockedMessage]);

  // Handle unmount lifecycle
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (activeFlightRef.current) {
        activeFlightRef.current.abortController.abort();
        activeFlightRef.current = null;
      }
    };
  }, []);

  const abortActiveFlight = useCallback(() => {
    if (!activeFlightRef.current) return;
    const flight = activeFlightRef.current;
    flight.abortController.abort();
    activeFlightRef.current = null;
    busyRef.current = false;
    setBusy(false);
    setFeedbacksByPart((prev) => {
      const partFb = prev[flight.partId];
      if (!partFb || !partFb[flight.questionId]) return prev;
      return {
        ...prev,
        [flight.partId]: {
          ...partFb,
          [flight.questionId]: { phase: 'idle', data: null, error: null },
        },
      };
    });
  }, []);

  // When isLocked prop changes to true: abort in-flight flight
  useEffect(() => {
    if (isLocked && activeFlightRef.current) {
      abortActiveFlight();
    }
  }, [isLocked, abortActiveFlight]);

  // When partId changes: abort in-flight flight for different part
  useEffect(() => {
    if (activeFlightRef.current && activeFlightRef.current.partId !== partId) {
      abortActiveFlight();
    }
  }, [partId, abortActiveFlight]);

  // Synchronous store subscription to track answer mutations per question and detect context resets
  useEffect(() => {
    const initialState = store.getState().answers;
    currentAttemptIdRef.current = initialState.attemptId;
    currentContextRevisionRef.current = initialState.contextRevision;

    for (const [pIdStr, qMap] of Object.entries(initialState.answers ?? {})) {
      const pId = Number(pIdStr);
      if (!lastKnownAnswers.current[pId]) {
        lastKnownAnswers.current[pId] = {};
      }
      for (const [qId, val] of Object.entries(qMap ?? {})) {
        lastKnownAnswers.current[pId][qId] = cloneAnswerValue(val);
      }
    }

    const unsubscribe = store.subscribe(() => {
      if (unmountedRef.current) return;
      const currentState = store.getState().answers;

      // Abort in-flight feedback immediately if submission isLocked is activated in Redux
      if (currentState.isLocked && activeFlightRef.current) {
        abortActiveFlight();
      }

      // Detect rehydrate or new attempt context
      if (
        currentState.attemptId !== currentAttemptIdRef.current ||
        currentState.contextRevision !== currentContextRevisionRef.current
      ) {
        currentAttemptIdRef.current = currentState.attemptId;
        currentContextRevisionRef.current = currentState.contextRevision;
        if (activeFlightRef.current) {
          activeFlightRef.current.abortController.abort();
          activeFlightRef.current = null;
        }
        busyRef.current = false;
        setBusy(false);
        blockedMessageRef.current = null;
        setBlockedMessage(null);
        setFeedbacksByPart({});
        questionRevisions.current = {};

        const newBaseline: Record<number, Record<string, AnswerValue>> = {};
        for (const [pIdStr, qMap] of Object.entries(currentState.answers ?? {})) {
          const pId = Number(pIdStr);
          newBaseline[pId] = {};
          for (const [qId, val] of Object.entries(qMap ?? {})) {
            newBaseline[pId][qId] = cloneAnswerValue(val);
          }
        }
        lastKnownAnswers.current = newBaseline;
        return;
      }

      // Detect changes to individual question answers
      const storeAnswers = currentState.answers ?? {};
      const invalidatedByPart: Record<number, Set<string>> = {};
      let hasChange = false;

      for (const [pIdStr, qMap] of Object.entries(storeAnswers)) {
        const pId = Number(pIdStr);
        if (!lastKnownAnswers.current[pId]) {
          lastKnownAnswers.current[pId] = {};
        }
        for (const [qId, currVal] of Object.entries(qMap ?? {})) {
          const prevVal = lastKnownAnswers.current[pId][qId] ?? null;
          if (!areAnswerValuesEqual(prevVal, currVal)) {
            lastKnownAnswers.current[pId][qId] = cloneAnswerValue(currVal);
            const revKey = `${pId}:${qId}`;
            questionRevisions.current[revKey] = (questionRevisions.current[revKey] ?? 0) + 1;

            if (!invalidatedByPart[pId]) {
              invalidatedByPart[pId] = new Set();
            }
            invalidatedByPart[pId].add(qId);
            hasChange = true;
          }
        }
      }

      if (hasChange) {
        setFeedbacksByPart((prev) => {
          let modified = false;
          const next = { ...prev };
          for (const [pIdStr, qIds] of Object.entries(invalidatedByPart)) {
            const pId = Number(pIdStr);
            const partFb = next[pId];
            if (!partFb) continue;
            let partModified = false;
            const nextPartFb = { ...partFb };
            for (const qId of qIds) {
              if (
                nextPartFb[qId] &&
                (nextPartFb[qId].phase !== 'idle' ||
                  nextPartFb[qId].data !== null ||
                  nextPartFb[qId].error !== null)
              ) {
                nextPartFb[qId] = { phase: 'idle', data: null, error: null };
                partModified = true;
              }
            }
            if (partModified) {
              next[pId] = nextPartFb;
              modified = true;
            }
          }
          return modified ? next : prev;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [store, abortActiveFlight]);

  const currentPartFeedbacks = useMemo(() => {
    return (partId !== null ? feedbacksByPart[partId] : null) ?? {};
  }, [feedbacksByPart, partId]);

  const wrongQuestionIds = useMemo(() => {
    if (partId === null || !questions || questions.length === 0) return [];
    return questions
      .filter((q) => {
        const fb = currentPartFeedbacks[q.question_id];
        return fb?.phase === 'ready' && fb.data?.verdict === 'WRONG';
      })
      .map((q) => q.question_id);
  }, [partId, questions, currentPartFeedbacks]);

  const getFeedback = useCallback(
    (questionId: string): PracticeQuestionFeedback => {
      if (partId === null) {
        return { phase: 'idle', data: null, error: null };
      }
      const partFb = feedbacksByPart[partId];
      return partFb?.[questionId] ?? { phase: 'idle', data: null, error: null };
    },
    [feedbacksByPart, partId]
  );

  const check = useCallback(
    async (questionId: string): Promise<void> => {
      const current = live.current;
      const ws = current.workspace;
      const pId = current.partId;

      if (!ws || ws.status !== 'IN_PROGRESS' || ws.test_mode !== 'PRACTICE') return;
      if (current.isLocked) return;

      const storeState = store.getState().answers;
      if (storeState.isLocked) return;
      if (busyRef.current || blockedMessageRef.current !== null) return;
      if (pId === null || !Number.isSafeInteger(pId) || pId < 1 || pId > 2147483647) return;

      if (storeState.attemptId !== ws.attempt_id) return;

      if (!current.questions || current.questions.length === 0) return;

      const targetQ = current.questions.find((q) => q.question_id === questionId);
      if (!targetQ) return;

      if (targetQ.type === 'ESSAY') {
        setFeedbacksByPart((prev) => ({
          ...prev,
          [pId]: {
            ...prev[pId],
            [questionId]: {
              phase: 'error',
              data: null,
              error: {
                message: 'Câu tự luận chưa hỗ trợ kiểm tra tức thì',
                retryable: false,
              },
            },
          },
        }));
        return;
      }

      const expectedQuestionType = targetQ.type;

      const rawAnswer = storeState.answers?.[pId]?.[questionId] ?? null;
      const answerToSend = cloneAnswerValue(rawAnswer);

      const targetRevision = questionRevisions.current[`${pId}:${questionId}`] ?? 0;
      const targetAttemptId = ws.attempt_id;
      const targetContextRevision = storeState.contextRevision;
      const targetPartId = pId;

      const abortController = new AbortController();
      const flightId = ++flightSequence.current;

      activeFlightRef.current = {
        flightId,
        partId: pId,
        questionId,
        abortController,
      };
      busyRef.current = true;
      setBusy(true);

      setFeedbacksByPart((prev) => ({
        ...prev,
        [pId]: {
          ...prev[pId],
          [questionId]: {
            phase: 'checking',
            data: null,
            error: null,
          },
        },
      }));

      try {
        const response = await checkPracticeAnswer(
          targetAttemptId,
          {
            partId: targetPartId,
            questionId,
            answer: answerToSend,
          },
          { signal: abortController.signal }
        );

        if (unmountedRef.current) return;
        if (activeFlightRef.current?.flightId !== flightId) return;

        const latestState = store.getState().answers;
        if (
          latestState.attemptId !== targetAttemptId ||
          latestState.contextRevision !== targetContextRevision ||
          latestState.isLocked ||
          live.current.isLocked
        ) {
          return;
        }

        if (live.current.partId !== targetPartId) return;

        const currentRevision =
          questionRevisions.current[`${targetPartId}:${questionId}`] ?? 0;
        if (currentRevision !== targetRevision) {
          // Discard response because answer was modified during flight (A -> B -> A)
          setFeedbacksByPart((prev) => {
            const partFb = prev[targetPartId];
            if (!partFb || !partFb[questionId]) return prev;
            return {
              ...prev,
              [targetPartId]: {
                ...partFb,
                [questionId]: { phase: 'idle', data: null, error: null },
              },
            };
          });
          return;
        }

        if (response.type !== expectedQuestionType) {
          throw new PracticeFeedbackContractError(
            'Dữ liệu phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại.'
          );
        }

        setFeedbacksByPart((prev) => ({
          ...prev,
          [targetPartId]: {
            ...prev[targetPartId],
            [questionId]: {
              phase: 'ready',
              data: response,
              error: null,
            },
          },
        }));
      } catch (err: unknown) {
        if (unmountedRef.current) return;
        if (activeFlightRef.current?.flightId !== flightId) return;
        if (isAbortError(err)) return;

        const latestState = store.getState().answers;
        if (
          latestState.attemptId !== targetAttemptId ||
          latestState.contextRevision !== targetContextRevision ||
          live.current.partId !== targetPartId
        ) {
          return;
        }

        const status = extractHttpStatus(err);

        if (status === 401 || status === 403) {
          const msg = 'Phiên làm việc đã hết hạn hoặc không có quyền kiểm tra đáp án.';
          blockedMessageRef.current = msg;
          setBlockedMessage(msg);
          setFeedbacksByPart({
            [targetPartId]: {
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: msg,
                  retryable: false,
                },
              },
            },
          });
          return;
        }

        if (status === 409) {
          const msg =
            'Dữ liệu bài thi đã thay đổi trên máy chủ. Vui lòng tải lại trang để tiếp tục.';
          blockedMessageRef.current = msg;
          setBlockedMessage(msg);
          setFeedbacksByPart((prev) => ({
            ...prev,
            [targetPartId]: {
              ...(prev[targetPartId] ?? {}),
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: msg,
                  retryable: false,
                },
              },
            },
          }));
          return;
        }

        if (status === 400 || status === 404 || status === 422) {
          const msg =
            'Dữ liệu câu hỏi hoặc bài thi không hợp lệ. Vui lòng tải lại trang.';
          blockedMessageRef.current = msg;
          setBlockedMessage(msg);
          setFeedbacksByPart((prev) => ({
            ...prev,
            [targetPartId]: {
              ...(prev[targetPartId] ?? {}),
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: msg,
                  retryable: false,
                },
              },
            },
          }));
          return;
        }

        const currentRevision =
          questionRevisions.current[`${targetPartId}:${questionId}`] ?? 0;
        if (currentRevision !== targetRevision) {
          setFeedbacksByPart((prev) => {
            const partFb = prev[targetPartId];
            if (!partFb || !partFb[questionId]) return prev;
            return {
              ...prev,
              [targetPartId]: {
                ...partFb,
                [questionId]: { phase: 'idle', data: null, error: null },
              },
            };
          });
          return;
        }

        if (isTimeoutError(err)) {
          setFeedbacksByPart((prev) => ({
            ...prev,
            [targetPartId]: {
              ...prev[targetPartId],
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: 'Hết thời gian chờ phản hồi từ máy chủ. Vui lòng thử lại.',
                  retryable: true,
                },
              },
            },
          }));
        } else if (
          err instanceof PracticeFeedbackContractError ||
          (err as any)?.name === 'PracticeFeedbackContractError'
        ) {
          setFeedbacksByPart((prev) => ({
            ...prev,
            [targetPartId]: {
              ...prev[targetPartId],
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: 'Dữ liệu phản hồi từ máy chủ không hợp lệ. Vui lòng thử lại.',
                  retryable: true,
                },
              },
            },
          }));
        } else {
          setFeedbacksByPart((prev) => ({
            ...prev,
            [targetPartId]: {
              ...prev[targetPartId],
              [questionId]: {
                phase: 'error',
                data: null,
                error: {
                  message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
                  retryable: true,
                },
              },
            },
          }));
        }
      } finally {
        if (activeFlightRef.current?.flightId === flightId) {
          activeFlightRef.current = null;
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [store]
  );

  const hideFeedback = useCallback((questionIds: readonly string[]) => {
    const currentPartId = live.current.partId;
    if (currentPartId === null || questionIds.length === 0) return;
    setFeedbacksByPart((prev) => {
      const partFb = prev[currentPartId];
      if (!partFb) return prev;
      const nextPartFb = { ...partFb };
      let changed = false;
      for (const qId of questionIds) {
        if (nextPartFb[qId]) {
          nextPartFb[qId] = { phase: 'idle', data: null, error: null };
          changed = true;
        }
      }
      return changed ? { ...prev, [currentPartId]: nextPartFb } : prev;
    });
  }, []);

  const suspend = useCallback(() => {
    if (activeFlightRef.current) {
      activeFlightRef.current.abortController.abort();
      activeFlightRef.current = null;
    }
    busyRef.current = false;
    setBusy(false);
    setFeedbacksByPart({});
  }, []);

  return {
    busy,
    blockedMessage,
    wrongQuestionIds,
    getFeedback,
    check,
    hideFeedback,
    suspend,
  };
}
