import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { TestMode } from '../types/api.types';
import {
  getListeningPlayback,
  startListeningPlayback,
  ListeningPlaybackContractError,
  type ListeningPlaybackSnapshot,
  type ListeningPlaybackStatus,
  type ListeningPlaybackTrack,
} from '../api/listeningPlaybackApi';

/** How often the Mock timeline is recomputed from the anchored server clock. */
export const PLAYBACK_TICK_MS = 500;

export interface UseListeningPlaybackOptions {
  /** Attempt bound to the player; null disables server interaction. */
  attemptId: number | null;
  /** 'MOCK_TEST' uses the server timeline; 'PRACTICE' is fully user controlled. */
  mode?: TestMode | null;
  /** Mock only: the workspace summary says playback is available this turn. */
  enabled?: boolean;
  /** Current media source key (URL/Part); Practice speed resets when it changes. */
  url?: string | null;
  /** Element the controller drives directly. */
  mediaRef: RefObject<HTMLMediaElement | null>;
  /** Monotonic clock, injectable for deterministic tests. */
  now?: () => number;
  tickMs?: number;
}

export interface ListeningPlaybackController {
  mode: TestMode | null;
  isPractice: boolean;
  status: ListeningPlaybackStatus;
  activeTrack: ListeningPlaybackTrack | null;
  activePartId: string | null;
  activePartNumber: number | null;
  tracks: ListeningPlaybackTrack[];
  elapsedMs: number;
  positionMs: number;
  remainingMs: number;
  totalDurationMs: number;
  speed: number;
  playing: boolean;
  blocked: boolean;
  offline: boolean;
  loading: boolean;
  error: string | null;
  canStart: boolean;
  start(): Promise<void>;
  resume(): Promise<void>;
  rewind(seconds?: number): void;
  setSpeed(rate: number): void;
  refresh(): Promise<void>;
  bindMedia?: (element: HTMLMediaElement | null) => void;
}

interface PlaybackState {
  status: ListeningPlaybackStatus;
  activeTrack: ListeningPlaybackTrack | null;
  activePartId: string | null;
  activePartNumber: number | null;
  tracks: ListeningPlaybackTrack[];
  elapsedMs: number;
  positionMs: number;
  remainingMs: number;
  totalDurationMs: number;
  speed: number;
  playing: boolean;
  blocked: boolean;
  offline: boolean;
  loading: boolean;
  error: string | null;
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function idleState(mode: TestMode | null): PlaybackState {
  return {
    status: mode === 'PRACTICE' ? 'NOT_STARTED' : 'UNAVAILABLE',
    activeTrack: null,
    activePartId: null,
    activePartNumber: null,
    tracks: [],
    elapsedMs: 0,
    positionMs: 0,
    remainingMs: 0,
    totalDurationMs: 0,
    speed: 1,
    playing: false,
    blocked: false,
    offline: false,
    loading: false,
    error: null,
  };
}

/** Server-authoritative track + position for a monotonic elapsed time. */
function deriveActive(
  tracks: ListeningPlaybackTrack[],
  elapsedMs: number
): { track: ListeningPlaybackTrack | null; positionMs: number } {
  if (tracks.length === 0) return { track: null, positionMs: 0 };
  for (const track of tracks) {
    const end = track.startOffsetMs + track.durationMs;
    if (elapsedMs >= track.startOffsetMs && elapsedMs < end) {
      return { track, positionMs: elapsedMs - track.startOffsetMs };
    }
  }
  const first = [...tracks].sort((a, b) => a.startOffsetMs - b.startOffsetMs)[0];
  if (elapsedMs < first.startOffsetMs) return { track: first, positionMs: 0 };
  return { track: null, positionMs: 0 };
}

export function useListeningPlayback(options: UseListeningPlaybackOptions): ListeningPlaybackController {
  const [state, setState] = useState<PlaybackState>(() => idleState(options.mode ?? null));
  const stateRef = useRef(state);
  stateRef.current = state;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mountedRef = useRef(false);
  const attemptRef = useRef<number | null>(options.attemptId);
  const requestRef = useRef<AbortController | null>(null);
  const anchorRef = useRef<{ elapsedMs: number; mono: number } | null>(null);
  const pendingSyncRef = useRef(false);
  const readinessCleanupRef = useRef<(() => void) | null>(null);
  const mediaEpochRef = useRef(0);
  const internalMediaRef = useRef<HTMLMediaElement | null>(null);

  const getMediaEl = useCallback(() => {
    return optionsRef.current.mediaRef?.current ?? internalMediaRef.current;
  }, []);

  const update = useCallback((patch: Partial<PlaybackState>) => {
    // Media events can arrive before React commits the corresponding state update.
    stateRef.current = { ...stateRef.current, ...patch };
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const readNow = useCallback(() => (optionsRef.current.now ?? defaultNow)(), []);

  const cancelMediaSync = useCallback(() => {
    readinessCleanupRef.current?.();
    readinessCleanupRef.current = null;
    pendingSyncRef.current = false;
    mediaEpochRef.current += 1;
  }, []);

  const pauseMedia = useCallback(() => {
    cancelMediaSync();
    getMediaEl()?.pause();
  }, [cancelMediaSync, getMediaEl]);

  const playMedia = useCallback(async () => {
    const el = getMediaEl();
    if (!el) return;
    const epoch = mediaEpochRef.current;
    const isCurrent = () => mountedRef.current && epoch === mediaEpochRef.current && getMediaEl() === el;
    try {
      await el.play();
      if (!isCurrent()) return;
      update({ playing: true, blocked: false });
    } catch {
      if (!isCurrent()) return;
      update({ playing: false, blocked: true });
    }
  }, [getMediaEl, update]);

  // Every entry point (snapshot, bind, tick and media readiness) uses the live server anchor.
  // Pending work is a request to resync, never a captured offset or autoplay decision.
  const syncMedia = useCallback(function syncCurrentMedia() {
    cancelMediaSync();
    const current = stateRef.current;
    const o = optionsRef.current;
    const anchor = anchorRef.current;
    if (
      !mountedRef.current || o.attemptId !== attemptRef.current || o.mode !== 'MOCK_TEST'
      || o.enabled !== true || current.status !== 'RUNNING' || current.offline || current.blocked || !anchor
    ) return;

    const elapsedMs = Math.min(current.totalDurationMs, anchor.elapsedMs + (readNow() - anchor.mono));
    const { track, positionMs } = deriveActive(current.tracks, elapsedMs);
    if (!track || elapsedMs >= current.totalDurationMs) {
      getMediaEl()?.pause();
      return;
    }
    if (track.partId !== current.activePartId) {
      update({
        activeTrack: track,
        activePartId: track.partId,
        activePartNumber: track.partNumber,
        elapsedMs,
        positionMs,
        remainingMs: current.totalDurationMs - elapsedMs,
      });
    }

    pendingSyncRef.current = true;
    const el = getMediaEl();
    if (!el) return;
    const currentSrc = (typeof el.getAttribute === 'function' ? el.getAttribute('src') : null) || el.src;
    if (currentSrc && currentSrc !== track.audioUrl && !currentSrc.endsWith(track.audioUrl)) {
      el.pause();
      return; // AudioPlayer will bind again after committing the new source.
    }
    if (el.readyState < 1 && typeof el.addEventListener === 'function') {
      const onReady = () => syncCurrentMedia();
      el.addEventListener('loadedmetadata', onReady);
      el.addEventListener('canplay', onReady);
      readinessCleanupRef.current = () => {
        el.removeEventListener('loadedmetadata', onReady);
        el.removeEventListener('canplay', onReady);
      };
      return;
    }

    pendingSyncRef.current = false;
    try {
      el.currentTime = Math.max(0, positionMs) / 1000;
    } catch {
      // Media may detach during a source change.
    }
    void playMedia();
  }, [cancelMediaSync, getMediaEl, playMedia, readNow, update]);

  const bindMedia = useCallback((element: HTMLMediaElement | null) => {
    if (!element) pauseMedia();
    internalMediaRef.current = element;
    if (optionsRef.current.mediaRef) optionsRef.current.mediaRef.current = element;
    if (element) syncMedia();
  }, [pauseMedia, syncMedia]);

  const applySnapshot = useCallback((snapshot: ListeningPlaybackSnapshot) => {
    const total = snapshot.totalDurationMs;
    if (snapshot.status === 'RUNNING') {
      anchorRef.current = { elapsedMs: snapshot.elapsedMs, mono: readNow() };
      const { track, positionMs } = deriveActive(snapshot.tracks, snapshot.elapsedMs);
      update({
        status: 'RUNNING',
        activeTrack: track,
        activePartId: track?.partId ?? null,
        activePartNumber: track?.partNumber ?? null,
        tracks: snapshot.tracks,
        elapsedMs: snapshot.elapsedMs,
        positionMs,
        remainingMs: snapshot.remainingMs,
        totalDurationMs: total,
        loading: false,
        error: null,
        blocked: false,
      });
      syncMedia();
      return;
    }
    anchorRef.current = null;
    pauseMedia();
    if (snapshot.status === 'FINISHED') {
      update({
        status: 'FINISHED',
        activeTrack: null,
        activePartId: null,
        activePartNumber: null,
        tracks: snapshot.tracks,
        elapsedMs: snapshot.totalDurationMs,
        positionMs: 0,
        remainingMs: 0,
        totalDurationMs: total,
        playing: false,
        blocked: false,
        loading: false,
        error: null,
      });
      return;
    }
    if (snapshot.status === 'NOT_STARTED') {
      const { track } = deriveActive(snapshot.tracks, 0);
      update({
        status: 'NOT_STARTED',
        activeTrack: track,
        activePartId: track?.partId ?? null,
        activePartNumber: track?.partNumber ?? null,
        tracks: snapshot.tracks,
        elapsedMs: 0,
        positionMs: 0,
        remainingMs: snapshot.remainingMs,
        totalDurationMs: total,
        playing: false,
        blocked: false,
        loading: false,
        error: null,
      });
      return;
    }
    update({
      ...idleState('MOCK_TEST'),
      status: snapshot.status,
      loading: false,
      error: null,
    });
  }, [pauseMedia, readNow, syncMedia, update]);

  const tick = useCallback(() => {
    const anchor = anchorRef.current;
    const current = stateRef.current;
    if (!anchor || current.status !== 'RUNNING') return;
    const total = current.totalDurationMs;
    const elapsed = Math.min(total, anchor.elapsedMs + (readNow() - anchor.mono));
    if (elapsed >= total) {
      anchorRef.current = null;
      pauseMedia();
      update({
        status: 'FINISHED',
        activeTrack: null,
        activePartId: null,
        activePartNumber: null,
        elapsedMs: total,
        positionMs: 0,
        remainingMs: 0,
        playing: false,
      });
      return;
    }
    const { track, positionMs } = deriveActive(current.tracks, elapsed);
    const partId = track?.partId ?? null;
    const changed = partId !== current.activePartId;
    update({
      elapsedMs: elapsed,
      positionMs,
      remainingMs: total - elapsed,
      activeTrack: changed ? track : current.activeTrack,
      activePartId: changed ? partId : current.activePartId,
      activePartNumber: changed ? track?.partNumber ?? null : current.activePartNumber,
    });
    if (changed || pendingSyncRef.current) syncMedia();
  }, [pauseMedia, readNow, syncMedia, update]);

  const applyIfCurrent = useCallback((snapshot: ListeningPlaybackSnapshot, attemptId: number) => {
    if (!mountedRef.current || attemptRef.current !== attemptId) return;
    applySnapshot(snapshot);
  }, [applySnapshot]);

  const loadSnapshot = useCallback(async (kind: 'get' | 'start', attemptId: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    update({ loading: true, error: null });
    try {
      const snapshot = kind === 'start'
        ? await startListeningPlayback(attemptId, { signal: controller.signal })
        : await getListeningPlayback(attemptId, { signal: controller.signal });
      if (!controller.signal.aborted) applyIfCurrent(snapshot, attemptId);
    } catch (error) {
      if (!mountedRef.current || attemptRef.current !== attemptId) return;
      if (controller.signal.aborted) return;
      const message = error instanceof ListeningPlaybackContractError
        ? error.message
        : 'Không thể tải trạng thái phát audio.';
      update({ loading: false, error: message });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [applyIfCurrent, update]);

  const refresh = useCallback(async () => {
    const o = optionsRef.current;
    if (o.mode !== 'MOCK_TEST' || o.enabled !== true) return;
    const attemptId = attemptRef.current;
    if (attemptId === null) return;
    await loadSnapshot('get', attemptId);
  }, [loadSnapshot]);

  const start = useCallback(async () => {
    const o = optionsRef.current;
    if (o.mode !== 'MOCK_TEST' || o.enabled !== true) return;
    const attemptId = attemptRef.current;
    if (attemptId === null) return;
    if (stateRef.current.status !== 'NOT_STARTED') return;
    await loadSnapshot('start', attemptId);
  }, [loadSnapshot]);

  const resume = useCallback(async () => {
    const o = optionsRef.current;
    if (o.mode !== 'MOCK_TEST') return;
    const attemptId = attemptRef.current;
    if (attemptId === null) return;
    update({ blocked: false });
    await loadSnapshot('get', attemptId);
  }, [loadSnapshot, update]);

  const rewind = useCallback((seconds = 10) => {
    const o = optionsRef.current;
    if (o.mode !== 'PRACTICE') return;
    const el = getMediaEl();
    if (!el) return;
    el.currentTime = Math.max(0, el.currentTime - seconds);
    void playMedia();
  }, [getMediaEl, playMedia]);

  const setSpeed = useCallback((rate: number) => {
    const o = optionsRef.current;
    if (o.mode !== 'PRACTICE') return;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return;
    const el = getMediaEl();
    if (el) el.playbackRate = rate;
    update({ speed: rate });
  }, [getMediaEl, update]);

  // Also supports callers that expose an external ref after the snapshot has arrived.
  useEffect(() => {
    if (pendingSyncRef.current) syncMedia();
  });

  // Mock: preload the server timeline once; Practice/disabled: no server traffic.
  useEffect(() => {
    mountedRef.current = true;
    attemptRef.current = options.attemptId;
    const mode = options.mode ?? null;

    pauseMedia();
    anchorRef.current = null;

    if (mode === 'MOCK_TEST' && options.enabled === true && options.attemptId !== null) {
      update({ ...idleState(mode), loading: true });
      void loadSnapshot('get', options.attemptId);
    } else {
      update(idleState(mode));
    }
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
      pauseMedia();
      anchorRef.current = null;
    };
  }, [options.attemptId, options.mode, options.enabled, loadSnapshot, pauseMedia, update]);

  // Advancing the Mock timeline; paused entirely while offline.
  useEffect(() => {
    if (state.status !== 'RUNNING' || state.offline) return;
    const tickMs = optionsRef.current.tickMs ?? PLAYBACK_TICK_MS;
    const id = setInterval(() => tick(), tickMs);
    return () => clearInterval(id);
  }, [state.status, state.offline, tick]);

  // Practice: a new source always restarts at normal speed.
  useEffect(() => {
    if (options.mode !== 'PRACTICE') return;
    const el = getMediaEl();
    if (el) el.playbackRate = 1;
    update({ speed: 1 });
  }, [options.url, options.mode, getMediaEl, update]);

  useEffect(() => {
    const handleOffline = () => {
      pauseMedia();
      update({ offline: true, playing: false });
    };
    const handleOnline = () => {
      update({ offline: false });
      void refresh();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [pauseMedia, refresh, update]);

  const isMock = options.mode === 'MOCK_TEST';
  return {
    mode: options.mode ?? null,
    isPractice: options.mode === 'PRACTICE',
    status: state.status,
    activeTrack: state.activeTrack,
    activePartId: state.activePartId,
    activePartNumber: state.activePartNumber,
    tracks: state.tracks,
    elapsedMs: state.elapsedMs,
    positionMs: state.positionMs,
    remainingMs: state.remainingMs,
    totalDurationMs: state.totalDurationMs,
    speed: state.speed,
    playing: state.playing,
    blocked: state.blocked,
    offline: state.offline,
    loading: state.loading,
    error: state.error,
    canStart: isMock && options.enabled === true && state.status === 'NOT_STARTED' && !state.loading,
    start,
    resume,
    rewind,
    setSpeed,
    refresh,
    bindMedia,
  };
}
