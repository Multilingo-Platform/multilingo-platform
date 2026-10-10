import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { AppDispatch, RootState } from '../../../app/store';
import { getWorkspace } from '../api/attemptApi';
import { setAttemptContext, clearAnswers } from '../store/answerSlice';
import type { WorkspaceResponse } from '../types/api.types';

export interface UseWorkspaceResult {
  workspace: WorkspaceResponse | null;
  loading: boolean;
  error: string | null;
  ready: boolean; // đúng route + latest successful authoritative hydration
  retry: () => void; // authoritative reload, no-op khi Redux saveStatus==='saving'
  refreshing: boolean;
  refreshError: string | null;
  refreshMetadata: () => Promise<boolean>; // false nếu lỗi/stale/unmount
}

function isValidAttemptId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id >= 1 && id <= 2147483647;
}

export default function useWorkspace(attemptId: number): UseWorkspaceResult {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();

  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(() => isValidAttemptId(attemptId));
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const currentAttemptIdRef = useRef<number>(attemptId);
  const generationRef = useRef<number>(0);
  const metadataGenRef = useRef<number>(0);
  const unmountedRef = useRef<boolean>(false);

  const isAuthoritativeLoadingRef = useRef<boolean>(isValidAttemptId(attemptId));
  const isReadyRef = useRef<boolean>(false);
  const latestWorkspaceRef = useRef<WorkspaceResponse | null>(null);

  // Sync attemptId changes immediately:
  if (!Object.is(currentAttemptIdRef.current, attemptId)) {
    currentAttemptIdRef.current = attemptId;
    isReadyRef.current = false;
    isAuthoritativeLoadingRef.current = isValidAttemptId(attemptId);
    latestWorkspaceRef.current = null;
    if (ready) setReady(false);
    if (workspace) setWorkspace(null);
    if (loading !== isValidAttemptId(attemptId)) setLoading(isValidAttemptId(attemptId));
    if (error !== null) setError(null);
    if (refreshing) setRefreshing(false);
    if (refreshError !== null) setRefreshError(null);
  }

  const fetchAuthoritative = useCallback(
    (targetId: number, gen: number) => {
      if (!isValidAttemptId(targetId) || !Object.is(targetId, currentAttemptIdRef.current)) {
        if (Object.is(targetId, currentAttemptIdRef.current)) {
          isAuthoritativeLoadingRef.current = false;
          isReadyRef.current = false;
          latestWorkspaceRef.current = null;
          setLoading(false);
          setError('ID phiên thi không hợp lệ');
          setReady(false);
          setWorkspace(null);
        }
        return;
      }

      isAuthoritativeLoadingRef.current = true;
      isReadyRef.current = false;
      setLoading(true);
      setError(null);
      setReady(false);

      getWorkspace(targetId)
        .then(data => {
          if (
            unmountedRef.current ||
            generationRef.current !== gen ||
            !Object.is(targetId, currentAttemptIdRef.current)
          ) {
            return;
          }
          isReadyRef.current = true;
          latestWorkspaceRef.current = data;
          setWorkspace(data);
          setReady(true);
          setError(null);
          dispatch(
            setAttemptContext({
              attemptId: data.attempt_id,
              version: data.version,
              savedAnswers: data.saved_answers,
              isLocked: data.status !== 'IN_PROGRESS' || (data.deadline !== null
                && Date.now() + data.serverTimeOffset >= Date.parse(data.deadline)),
            })
          );
        })
        .catch((err: unknown) => {
          if (
            unmountedRef.current ||
            generationRef.current !== gen ||
            !Object.is(targetId, currentAttemptIdRef.current)
          ) {
            return;
          }
          isReadyRef.current = false;
          setError(err instanceof Error ? err.message : 'Không thể tải phiên thi');
          setReady(false);
          // Do NOT clear Redux answers on retry/fetch failure
        })
        .finally(() => {
          if (
            !unmountedRef.current &&
            generationRef.current === gen &&
            Object.is(targetId, currentAttemptIdRef.current)
          ) {
            isAuthoritativeLoadingRef.current = false;
            setLoading(false);
          }
        });
    },
    [dispatch]
  );

  // Effect 1: Authoritative load on attemptId change
  useEffect(() => {
    generationRef.current += 1;
    metadataGenRef.current += 1; // cancel pending metadata
    isAuthoritativeLoadingRef.current = isValidAttemptId(attemptId);
    isReadyRef.current = false;
    setRefreshing(false);
    setRefreshError(null);
    const currentGen = generationRef.current;

    fetchAuthoritative(attemptId, currentGen);

    return () => {
      generationRef.current += 1;
      metadataGenRef.current += 1;
      setRefreshing(false);
      setRefreshError(null);
    };
  }, [attemptId, fetchAuthoritative]);

  // Effect 2: Track unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      isReadyRef.current = false;
      isAuthoritativeLoadingRef.current = false;
      latestWorkspaceRef.current = null;
    };
  }, []);

  // Effect 3: Cleanup Redux answers on route change or unmount
  useEffect(() => {
    return () => {
      dispatch(clearAnswers());
    };
  }, [attemptId, dispatch]);

  // Authoritative retry callback
  const retry = useCallback(() => {
    if (unmountedRef.current) return;
    // Stale callback guard: must match live route ID
    if (!Object.is(attemptId, currentAttemptIdRef.current)) return;
    if (!isValidAttemptId(attemptId)) return;

    // Check live Redux state: no-op if currently saving
    const currentSaveStatus = store.getState().answers?.saveStatus;
    if (currentSaveStatus === 'saving') {
      return;
    }

    generationRef.current += 1;
    metadataGenRef.current += 1; // cancel pending metadata
    isAuthoritativeLoadingRef.current = true;
    isReadyRef.current = false;
    setRefreshing(false);
    setRefreshError(null);
    const nextGen = generationRef.current;

    fetchAuthoritative(attemptId, nextGen);
  }, [attemptId, store, fetchAuthoritative]);

  // Metadata refresh callback: only updates workspace state, never modifies Redux answers
  const refreshMetadata = useCallback(async (): Promise<boolean> => {
    if (
      unmountedRef.current ||
      !isReadyRef.current ||
      isAuthoritativeLoadingRef.current ||
      !Object.is(attemptId, currentAttemptIdRef.current) ||
      !isValidAttemptId(attemptId) ||
      !latestWorkspaceRef.current ||
      !Object.is(latestWorkspaceRef.current.attempt_id, currentAttemptIdRef.current) ||
      !Object.is(store.getState().answers?.attemptId, currentAttemptIdRef.current)
    ) {
      return false;
    }

    metadataGenRef.current += 1;
    const currentMetaGen = metadataGenRef.current;
    const currentAuthGen = generationRef.current;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const data = await getWorkspace(attemptId);
      // Stale check
      if (
        unmountedRef.current ||
        !isReadyRef.current ||
        isAuthoritativeLoadingRef.current ||
        !Object.is(attemptId, currentAttemptIdRef.current) ||
        generationRef.current !== currentAuthGen ||
        metadataGenRef.current !== currentMetaGen
      ) {
        return false;
      }

      latestWorkspaceRef.current = data;
      setWorkspace(data);
      // DO NOT dispatch setAttemptContext
      return true;
    } catch (err: unknown) {
      if (
        !unmountedRef.current &&
        Object.is(attemptId, currentAttemptIdRef.current) &&
        generationRef.current === currentAuthGen &&
        metadataGenRef.current === currentMetaGen
      ) {
        setRefreshError(err instanceof Error ? err.message : 'Không thể làm mới metadata');
      }
      return false;
    } finally {
      if (
        !unmountedRef.current &&
        Object.is(attemptId, currentAttemptIdRef.current) &&
        generationRef.current === currentAuthGen &&
        metadataGenRef.current === currentMetaGen
      ) {
        setRefreshing(false);
      }
    }
  }, [attemptId, store]);

  return {
    workspace,
    loading,
    error,
    ready,
    retry,
    refreshing,
    refreshError,
    refreshMetadata,
  };
}
