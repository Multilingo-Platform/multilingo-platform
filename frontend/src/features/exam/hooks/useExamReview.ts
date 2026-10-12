import { useState, useEffect, useRef, useCallback } from 'react';
import { getAttemptReview } from '../api/attemptApi';
import { ReviewContractError } from '../api/reviewContract';
import type { ExamReviewResponse } from '../types/api.types';

export type ReviewErrorKind =
  | 'INVALID_SELECTION'
  | 'NOT_AUTHORIZED'
  | 'NOT_SUBMITTED'
  | 'NOT_FOUND'
  | 'CONTRACT_ERROR'
  | 'REQUEST_ERROR';

export class ExamReviewError extends Error {
  readonly kind: ReviewErrorKind;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    kind: ReviewErrorKind,
    message: string,
    status?: number,
    cause?: unknown
  ) {
    super(message);
    this.name = 'ExamReviewError';
    this.kind = kind;
    this.status = status;
    this.cause = cause;
    Object.setPrototypeOf(this, ExamReviewError.prototype);
  }
}

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

export function classifyReviewError(err: unknown): ExamReviewError {
  if (err instanceof ExamReviewError) return err;
  if (err instanceof ReviewContractError) {
    return new ExamReviewError('CONTRACT_ERROR', err.message, undefined, err);
  }

  const axiosErr = err as {
    response?: {
      status?: number;
      data?: { code?: number; message?: string };
    };
    code?: string;
    message?: string;
  };

  const status =
    axiosErr.response?.status ??
    (typeof axiosErr.response?.data?.code === 'number'
      ? axiosErr.response?.data?.code
      : undefined);
  const msg =
    axiosErr.response?.data?.message ||
    axiosErr.message ||
    'Lỗi không xác định khi tải dữ liệu ôn tập';

  if (status === 401 || status === 403) {
    return new ExamReviewError('NOT_AUTHORIZED', msg, status, err);
  }
  if (status === 404) {
    return new ExamReviewError('NOT_FOUND', msg, status, err);
  }
  if (status === 400) {
    const isNotSubmitted = /not submitted|in[ -]?progress|chưa nộp/i.test(msg);
    return new ExamReviewError(
      isNotSubmitted ? 'NOT_SUBMITTED' : 'REQUEST_ERROR',
      msg,
      status,
      err
    );
  }

  return new ExamReviewError('REQUEST_ERROR', msg, status, err);
}

export interface UseExamReviewResult {
  data: ExamReviewResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: ExamReviewError | null;
  refreshError: ExamReviewError | null;
  reload: () => void;
}

export function useExamReview(
  attemptId: number | null,
  partId: number | null
): UseExamReviewResult {
  const [dataState, setDataState] = useState<{
    selectionKey: string | null;
    data: ExamReviewResponse | null;
  }>({ selectionKey: null, data: null });

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<ExamReviewError | null>(null);
  const [refreshError, setRefreshError] = useState<ExamReviewError | null>(null);

  const generationRef = useRef<number>(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);

  const selectionValid = isPositiveInt(attemptId) && isPositiveInt(partId);
  const selectionKey = selectionValid ? `${attemptId}:${partId}` : null;

  // Uncouple stale data synchronously: if current selection differs from loaded data's key, data is null
  const currentData =
    selectionKey !== null && dataState.selectionKey === selectionKey
      ? dataState.data
      : null;

  const reload = useCallback(() => {
    setReloadTrigger(n => n + 1);
  }, []);

  useEffect(() => {
    // Check if idle (null props)
    if (attemptId === null || partId === null) {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      generationRef.current += 1;
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setRefreshError(null);
      setDataState({ selectionKey: null, data: null });
      return;
    }

    // Check if invalid ID selection
    if (!isPositiveInt(attemptId) || !isPositiveInt(partId)) {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      generationRef.current += 1;
      setLoading(false);
      setRefreshing(false);
      setError(
        new ExamReviewError(
          'INVALID_SELECTION',
          'Lựa chọn bài thi hoặc phần thi không hợp lệ'
        )
      );
      setRefreshError(null);
      setDataState({ selectionKey: null, data: null });
      return;
    }

    // Valid selection: fetch review
    const generation = ++generationRef.current;
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    const isRefresh =
      dataState.selectionKey === selectionKey && dataState.data !== null;

    if (isRefresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setError(null);
      setRefreshError(null);
      setDataState({ selectionKey, data: null });
    }

    getAttemptReview(attemptId, partId, { signal: controller.signal })
      .then(res => {
        if (generation !== generationRef.current || controller.signal.aborted) {
          return;
        }
        setDataState({ selectionKey, data: res });
        setError(null);
        setRefreshError(null);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        if (generation !== generationRef.current || controller.signal.aborted) {
          return;
        }
        const classified = classifyReviewError(err);
        if (isRefresh) {
          const is4xx =
            typeof classified.status === 'number' &&
            classified.status >= 400 &&
            classified.status < 500;
          if (!is4xx && classified.kind === 'REQUEST_ERROR') {
            setRefreshError(classified);
          } else {
            setDataState({ selectionKey: null, data: null });
            setError(classified);
          }
          setRefreshing(false);
        } else {
          setDataState({ selectionKey, data: null });
          setError(classified);
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [attemptId, partId, reloadTrigger]);

  return {
    data: currentData,
    loading,
    refreshing,
    error,
    refreshError,
    reload,
  };
}
