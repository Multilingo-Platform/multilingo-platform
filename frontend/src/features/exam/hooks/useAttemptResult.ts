import { useCallback, useEffect, useRef, useState } from 'react';
import { getAttemptResult } from '../api/attemptApi';
import { ResultContractError } from '../api/resultContract';
import type { ExamResultResponse } from '../types/api.types';

export type ResultErrorKind = 'invalid-id' | 'not-finalized' | 'unauthorized' | 'forbidden' | 'contract' | 'request';
export interface ResultLoadError {
  kind: ResultErrorKind;
  message: string;
  retryable: boolean;
}
interface ResultState {
  attemptId: number | null;
  data: ExamResultResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: ResultLoadError | null;
  refreshError: ResultLoadError | null;
}

function initialState(attemptId: number | null): ResultState {
  return { attemptId, data: null, loading: attemptId !== null, refreshing: false, refreshError: null,
    error: attemptId === null ? { kind: 'invalid-id', message: 'Mã bài làm không hợp lệ. Vui lòng mở lại từ lịch sử làm bài.', retryable: false } : null };
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return undefined;
  return typeof response.status === 'number' ? response.status : undefined;
}

function loadError(error: unknown): ResultLoadError {
  if (error instanceof ResultContractError) return { kind: 'contract', message: error.message, retryable: true };
  switch (httpStatus(error)) {
    case 400: return { kind: 'not-finalized', message: 'Chưa thể xem kết quả. Kiểm tra bài đã kết thúc rồi cập nhật lại.', retryable: true };
    case 401: return { kind: 'unauthorized', message: 'Cần đăng nhập để xem kết quả. Vui lòng đăng nhập lại.', retryable: false };
    case 403: return { kind: 'forbidden', message: 'Không có quyền xem kết quả này. Vui lòng mở bài làm của mình từ lịch sử.', retryable: false };
    default: return { kind: 'request', message: 'Không tải được kết quả. Vui lòng thử lại.', retryable: true };
  }
}

export function useAttemptResult(attemptId: number | null) {
  const [state, setState] = useState(() => initialState(attemptId));
  const active = useRef<{ controller: AbortController } | null>(null);
  // Identity, rather than just attempt ID, protects same-ID remount/replay and A→B→A.
  const reload = useCallback(async (): Promise<void> => {
    if (attemptId === null || active.current) return;
    const operation = { controller: new AbortController() };
    active.current = operation;
    setState(previous => {
      const data = previous.attemptId === attemptId ? previous.data : null;
      return { attemptId, data, loading: data === null, refreshing: data !== null, error: null, refreshError: null };
    });
    try {
      const data = await getAttemptResult(attemptId, { signal: operation.controller.signal });
      if (active.current !== operation) return;
      setState({ attemptId, data, loading: false, refreshing: false, error: null, refreshError: null });
    } catch (error: unknown) {
      if (active.current !== operation) return;
      const failure = loadError(error);
      const status = httpStatus(error);
      const transportFailure = !(error instanceof ResultContractError) && (status === undefined || status >= 500);
      setState(previous => {
        if (previous.attemptId === attemptId && previous.data && transportFailure) {
          return { ...previous, loading: false, refreshing: false, error: null,
            refreshError: { ...failure, message: 'Chưa cập nhật được kết quả. Đang hiển thị dữ liệu lần tải trước. Vui lòng thử lại.' } };
        }
        return { ...initialState(attemptId), loading: false, error: failure };
      });
    } finally {
      if (active.current === operation) active.current = null;
    }
  }, [attemptId]);

  useEffect(() => {
    setState(initialState(attemptId));
    void reload();
    return () => {
      const operation = active.current;
      active.current = null;
      operation?.controller.abort();
    };
  }, [attemptId, reload]);

  // Do not expose old private data even on the render before effect cleanup.
  const current = state.attemptId === attemptId ? state : initialState(attemptId);
  return { data: current.data, loading: current.loading, refreshing: current.refreshing,
    error: current.error, refreshError: current.refreshError, reload };
}
