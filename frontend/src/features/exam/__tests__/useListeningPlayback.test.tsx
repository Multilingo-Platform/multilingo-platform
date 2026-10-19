import React from 'react';
import { renderHook, render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioPlayer from '../components/AudioPlayer';
import axiosClient from '../../../core/api/axiosClient';
import {
  getListeningPlayback,
  startListeningPlayback,
  ListeningPlaybackContractError,
  PLAYBACK_TIMEOUT_MS,
} from '../api/listeningPlaybackApi';
import {
  PLAYBACK_TICK_MS,
  useListeningPlayback,
  type UseListeningPlaybackOptions,
} from '../hooks/useListeningPlayback';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const httpGet = vi.mocked(axiosClient.get);
const httpPost = vi.mocked(axiosClient.post);

const TRACKS = [
  { partId: '101', partNumber: 1, audioUrl: 'https://cdn/a.mp3', durationMs: 30000, startOffsetMs: 0 },
  { partId: '102', partNumber: 2, audioUrl: 'https://cdn/b.mp3', durationMs: 30000, startOffsetMs: 30000 },
];
const TOTAL_MS = 60000;

function envelope(data: unknown) {
  return { success: true, code: 200, message: 'ok', data, timestamp: '2026-10-18T00:00:00Z' };
}

function running(elapsedMs: number, attemptId = 42) {
  const active = TRACKS.find(t => elapsedMs >= t.startOffsetMs && elapsedMs < t.startOffsetMs + t.durationMs) ?? TRACKS[0];
  return {
    attemptId,
    status: 'RUNNING',
    serverTime: '2026-10-18T00:00:00Z',
    startedAt: '2026-10-18T00:00:00Z',
    activePartId: active.partId,
    activePartNumber: active.partNumber,
    positionMs: elapsedMs - active.startOffsetMs,
    elapsedMs,
    remainingMs: TOTAL_MS - elapsedMs,
    totalDurationMs: TOTAL_MS,
    tracks: TRACKS,
  };
}

function notStarted(attemptId = 42) {
  return {
    attemptId,
    status: 'NOT_STARTED',
    serverTime: '2026-10-18T00:00:00Z',
    activePartId: '101',
    activePartNumber: 1,
    positionMs: 0,
    elapsedMs: 0,
    remainingMs: TOTAL_MS,
    totalDurationMs: TOTAL_MS,
    tracks: TRACKS,
  };
}

interface FakeMedia {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  currentTime: number;
  playbackRate: number;
  src: string;
}

function createMedia(): FakeMedia {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    currentTime: 0,
    playbackRate: 1,
    src: '',
  };
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function settle(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

function setup(overrides: Partial<UseListeningPlaybackOptions> = {}) {
  const media = createMedia();
  const mediaRef = { current: media as unknown as HTMLMediaElement };
  let clock = 1000;
  const now = () => clock;
  const initial: UseListeningPlaybackOptions = {
    attemptId: 42, mode: 'MOCK_TEST', enabled: true, mediaRef, now, ...overrides,
  };
  const hook = renderHook((props: UseListeningPlaybackOptions) => useListeningPlayback(props), {
    initialProps: initial,
  });
  return {
    ...hook,
    media,
    mediaRef,
    advance: (ms: number) => { clock += ms; },
    rerender: (o: Partial<UseListeningPlaybackOptions> = {}) => hook.rerender({ ...initial, ...o }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window.HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(1);
  httpGet.mockReset();
  httpPost.mockReset();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('listeningPlaybackApi contract', () => {
  it('GET reads the exact endpoint with bounded config and returns a validated snapshot', async () => {
    const controller = new AbortController();
    httpGet.mockResolvedValueOnce(envelope(running(0)) as never);
    const snapshot = await getListeningPlayback(42, { signal: controller.signal });
    expect(httpGet).toHaveBeenCalledWith(
      '/v1/attempts/42/listening-playback',
      expect.objectContaining({ signal: controller.signal, timeout: PLAYBACK_TIMEOUT_MS })
    );
    expect(snapshot.attemptId).toBe(42);
    expect(snapshot.tracks).toHaveLength(2);
    expect(snapshot.tracks[1].startOffsetMs).toBe(30000);
  });

  it('POST start hits the idempotent start endpoint', async () => {
    const controller = new AbortController();
    httpPost.mockResolvedValueOnce(envelope(running(0)) as never);
    await startListeningPlayback(42, { signal: controller.signal });
    expect(httpPost).toHaveBeenCalledWith(
      '/v1/attempts/42/listening-playback/start',
      null,
      expect.objectContaining({ signal: controller.signal, timeout: PLAYBACK_TIMEOUT_MS })
    );
  });

  it.each([0, -1, 1.5, NaN, 2147483648])('invalid attempt id %s never reaches HTTP', async id => {
    await expect(getListeningPlayback(id)).rejects.toThrow();
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('rejects a malformed envelope with the fixed contract error', async () => {
    httpGet.mockResolvedValueOnce({ success: false, message: 'raw server detail' } as never);
    await expect(getListeningPlayback(42)).rejects.toBeInstanceOf(ListeningPlaybackContractError);
  });

  it('rejects RUNNING snapshots missing server timeline fields', async () => {
    const broken = { ...running(0), startedAt: undefined, activePartId: undefined };
    httpGet.mockResolvedValueOnce(envelope(broken) as never);
    await expect(getListeningPlayback(42)).rejects.toBeInstanceOf(ListeningPlaybackContractError);
  });

  it('rejects tracks with a non-positive duration', async () => {
    const broken = { ...running(0), tracks: [{ ...TRACKS[0], durationMs: 0 }] };
    httpGet.mockResolvedValueOnce(envelope(broken) as never);
    await expect(getListeningPlayback(42)).rejects.toBeInstanceOf(ListeningPlaybackContractError);
  });

  it('preserves HTTP errors for hook classification', async () => {
    const error = { response: { status: 409, data: { message: 'private detail' } } };
    httpGet.mockRejectedValueOnce(error);
    await expect(getListeningPlayback(42)).rejects.toBe(error);
  });
});

describe('useListeningPlayback — Mock (server-authoritative)', () => {
  it('preloads NOT_STARTED with GET only and never starts before the user acts', async () => {
    httpGet.mockResolvedValueOnce(envelope(notStarted()) as never);
    const { result, media } = setup();
    await settle();
    expect(httpGet).toHaveBeenCalledTimes(1);
    expect(httpPost).not.toHaveBeenCalled();
    expect(result.current.status).toBe('NOT_STARTED');
    expect(result.current.canStart).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(media.play).not.toHaveBeenCalled();
  });

  it('starts only on explicit user action and plays from the server position', async () => {
    httpGet.mockResolvedValueOnce(envelope(notStarted()) as never);
    const { result, media } = setup();
    await settle();
    httpPost.mockResolvedValueOnce(envelope(running(0)) as never);
    await act(async () => { await result.current.start(); });
    expect(httpPost).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('RUNNING');
    expect(result.current.playing).toBe(true);
    expect(media.play).toHaveBeenCalled();
  });

  it('resumes an already-running timeline on reload without replaying past audio', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(45000)) as never);
    const { result, media } = setup();
    await settle();
    expect(httpPost).not.toHaveBeenCalled();
    expect(result.current.activePartId).toBe('102');
    expect(result.current.positionMs).toBe(15000);
    expect(media.currentTime).toBeCloseTo(15, 3);
    expect(media.play).toHaveBeenCalled();
  });

  it('lets the server clock switch Part and position without client control', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const { result, media, advance } = setup();
    await settle();
    expect(result.current.activePartId).toBe('101');
    expect(media.currentTime).toBeCloseTo(5, 3);
    advance(26000);
    await settle(PLAYBACK_TICK_MS);
    expect(result.current.activePartId).toBe('102');
    expect(result.current.positionMs).toBe(1000);
    expect(media.currentTime).toBeCloseTo(1, 3);
  });

  it('treats FINISHED as terminal with no active track and no playback', async () => {
    httpGet.mockResolvedValueOnce(envelope({
      attemptId: 42, status: 'FINISHED', serverTime: '2026-10-18T00:00:00Z',
      startedAt: '2026-10-18T00:00:00Z', positionMs: 0, elapsedMs: TOTAL_MS,
      remainingMs: 0, totalDurationMs: TOTAL_MS, tracks: TRACKS,
    }) as never);
    const { result, media } = setup();
    await settle();
    expect(result.current.status).toBe('FINISHED');
    expect(result.current.activeTrack).toBeNull();
    expect(result.current.canStart).toBe(false);
    expect(media.play).not.toHaveBeenCalled();
  });

  it('keeps the server timeline moving when autoplay is blocked and resumes safely', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(0)) as never);
    const { result, media, advance } = setup();
    media.play.mockRejectedValueOnce(new Error('NotAllowedError'));
    await settle();
    expect(result.current.blocked).toBe(true);
    expect(result.current.playing).toBe(false);
    const before = result.current.elapsedMs;
    advance(4000);
    await settle(PLAYBACK_TICK_MS);
    expect(result.current.elapsedMs).toBeGreaterThan(before);
    httpGet.mockResolvedValueOnce(envelope(running(4000)) as never);
    await act(async () => { await result.current.resume(); });
    expect(result.current.blocked).toBe(false);
    expect(result.current.playing).toBe(true);
    expect(media.play).toHaveBeenCalledTimes(2);
    expect(media.currentTime).toBeCloseTo(4, 3);
  });

  it('pauses while offline and resyncs, skipping missed audio, when back online', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(0)) as never);
    const { result, media } = setup();
    await settle();
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current.offline).toBe(true);
    expect(media.pause).toHaveBeenCalled();
    httpGet.mockResolvedValueOnce(envelope(running(12000)) as never);
    act(() => { window.dispatchEvent(new Event('online')); });
    await settle();
    expect(result.current.offline).toBe(false);
    expect(result.current.positionMs).toBe(12000);
    expect(media.currentTime).toBeCloseTo(12, 3);
  });

  it('ignores a stale response from a previous attempt', async () => {
    const first = deferred();
    httpGet.mockReturnValueOnce(first.promise as never);
    const { result, rerender } = setup({ attemptId: 42 });
    const second = deferred();
    httpGet.mockReturnValueOnce(second.promise as never);
    rerender({ attemptId: 43 });
    first.resolve(envelope(running(0, 42)));
    await settle();
    expect(result.current.status).not.toBe('RUNNING');
    second.resolve(envelope(running(0, 43)));
    await settle();
    expect(result.current.status).toBe('RUNNING');
  });

  it('stops and resets previous attempt playback when attemptId changes while running', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(5000, 42)) as never);
    const { result, media, rerender } = setup({ attemptId: 42 });
    await settle();

    expect(result.current.status).toBe('RUNNING');
    expect(result.current.activePartId).toBe('101');
    expect(result.current.playing).toBe(true);
    expect(media.play).toHaveBeenCalled();

    const deferredB = deferred();
    httpGet.mockReturnValueOnce(deferredB.promise as never);
    rerender({ attemptId: 43 });

    expect(media.pause).toHaveBeenCalled();
    expect(result.current.status).not.toBe('RUNNING');
    expect(result.current.activeTrack).toBeNull();
    expect(result.current.activePartId).toBeNull();
    expect(result.current.playing).toBe(false);

    const tracksB = [
      { partId: '201', partNumber: 1, audioUrl: 'https://cdn/b1.mp3', durationMs: 20000, startOffsetMs: 0 },
    ];
    deferredB.resolve(envelope({
      attemptId: 43,
      status: 'RUNNING',
      serverTime: '2026-10-18T00:00:00Z',
      startedAt: '2026-10-18T00:00:00Z',
      activePartId: '201',
      activePartNumber: 1,
      positionMs: 2000,
      elapsedMs: 2000,
      remainingMs: 18000,
      totalDurationMs: 20000,
      tracks: tracksB,
    }));
    await settle();

    expect(result.current.status).toBe('RUNNING');
    expect(result.current.activePartId).toBe('201');
    expect(result.current.positionMs).toBe(2000);
    expect(media.currentTime).toBeCloseTo(2, 3);
  });

  it.each(['resolve', 'reject'])('ignores a pending play() %s after going offline', async outcome => {
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const playback = deferred<void>();
    const { result, media } = setup();
    media.play.mockReturnValueOnce(playback.promise);
    await settle();
    act(() => window.dispatchEvent(new Event('offline')));
    await act(async () => {
      if (outcome === 'resolve') playback.resolve();
      else playback.reject(new Error('AbortError'));
    });
    expect(result.current.offline).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(result.current.blocked).toBe(false);
  });

  it('ignores an aborted snapshot that resolves after playback is disabled', async () => {
    const snapshot = deferred();
    httpGet.mockReturnValueOnce(snapshot.promise as never);
    const { result, media, rerender } = setup();
    rerender({ enabled: false });
    snapshot.resolve(envelope(running(5000)));
    await settle();
    expect(result.current.status).toBe('UNAVAILABLE');
    expect(result.current.activeTrack).toBeNull();
    expect(media.play).not.toHaveBeenCalled();
  });

  it('cleans up in-flight requests on unmount under StrictMode', async () => {
    const signals: AbortSignal[] = [];
    httpGet.mockImplementation((_url, config) => {
      const signal = (config as { signal?: AbortSignal } | undefined)?.signal;
      if (signal) signals.push(signal);
      return deferred().promise as never;
    });
    const media = createMedia();
    const mediaRef = { current: media as unknown as HTMLMediaElement };
    const { unmount } = renderHook(
      () => useListeningPlayback({ attemptId: 42, mode: 'MOCK_TEST', enabled: true, mediaRef, now: () => 1000 }),
      { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> }
    );
    await settle();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every(signal => signal.aborted)).toBe(false);
    unmount();
    expect(signals.every(signal => signal.aborted)).toBe(true);
  });

  it('seeks and plays once the media element mounts after a RUNNING reload', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(45000)) as never);
    const media = createMedia();
    // The player mounts after the snapshot on reload/reconnect, so the ref is initially empty.
    const mediaRef = { current: null as HTMLMediaElement | null };
    const initialProps: UseListeningPlaybackOptions = {
      attemptId: 42, mode: 'MOCK_TEST', enabled: true, mediaRef, now: () => 1000,
    };
    const hook = renderHook((props: UseListeningPlaybackOptions) => useListeningPlayback(props), {
      initialProps,
    });

    await settle();
    expect(hook.result.current.status).toBe('RUNNING');
    expect(hook.result.current.positionMs).toBe(15000);
    // No element yet: nothing may be played, the desired position is remembered.
    expect(media.play).not.toHaveBeenCalled();

    // Model <AudioPlayer> mounting and exposing its element.
    mediaRef.current = media as unknown as HTMLMediaElement;
    await act(async () => { hook.rerender(initialProps); });
    await settle();

    expect(media.currentTime).toBeCloseTo(15, 3);
    expect(media.play).toHaveBeenCalled();
    expect(hook.result.current.playing).toBe(true);
  });

  it('seeks and plays immediately via bindMedia callback without requiring hook rerender', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(12000)) as never);
    const media = createMedia();
    const mediaRef = { current: null as HTMLMediaElement | null };
    const initialProps: UseListeningPlaybackOptions = {
      attemptId: 42, mode: 'MOCK_TEST', enabled: true, mediaRef, now: () => 1000,
    };
    const hook = renderHook((props: UseListeningPlaybackOptions) => useListeningPlayback(props), {
      initialProps,
    });

    await settle();
    expect(hook.result.current.status).toBe('RUNNING');
    expect(media.play).not.toHaveBeenCalled();

    // Directly bind media as <AudioPlayer> effect does
    act(() => {
      hook.result.current.bindMedia?.(media as unknown as HTMLMediaElement);
    });
    await settle();

    expect(media.currentTime).toBeCloseTo(12, 3);
    expect(media.play).toHaveBeenCalled();
    expect(hook.result.current.playing).toBe(true);
  });

  it('TWR-F6: starts next track with correct offset and play() when timeline crosses part boundary on the same AudioPlayer', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    let clock = 1000;

    function Harness() {
      const mediaRef = React.useRef<HTMLMediaElement | null>(null);
      const playback = useListeningPlayback({
        attemptId: 42,
        mode: 'MOCK_TEST',
        enabled: true,
        mediaRef,
        now: () => clock,
      });

      return (
        <div>
          {playback.activeTrack && (
            <AudioPlayer
              variant="server"
              url={playback.activeTrack.audioUrl}
              isActive={true}
              mediaRef={playback.bindMedia}
            />
          )}
        </div>
      );
    }

    const { container } = render(<Harness />);
    await settle();

    const audio = container.querySelector('audio') as HTMLAudioElement;
    expect(audio).not.toBeNull();
    expect(audio.getAttribute('src')).toBe('https://cdn/a.mp3');
    expect(audio.currentTime).toBeCloseTo(5, 1);
    expect(audio.play).toHaveBeenCalledTimes(1);

    // Advance timeline across track boundary (startOffset of track 2 is 30,000ms)
    // Advancing 26,000ms moves elapsed from 5,000ms to 31,000ms -> 1,000ms into track 2
    clock += 26000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PLAYBACK_TICK_MS);
    });

    expect(audio.getAttribute('src')).toBe('https://cdn/b.mp3');
    expect(audio.currentTime).toBeCloseTo(1, 1);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it('does not read the server timeline when the summary is unavailable', async () => {
    const { result } = setup({ enabled: false });
    await settle();
    expect(httpGet).not.toHaveBeenCalled();
    expect(result.current.status).toBe('UNAVAILABLE');
    expect(result.current.canStart).toBe(false);
  });
});

describe('useListeningPlayback — Practice (user controls)', () => {
  it('exposes rewind-10s and speed without touching the server', async () => {
    const { result, media } = setup({ mode: 'PRACTICE' });
    await settle();
    expect(httpGet).not.toHaveBeenCalled();
    expect(httpPost).not.toHaveBeenCalled();
    expect(result.current.isPractice).toBe(true);
    media.currentTime = 25;
    act(() => { result.current.rewind(); });
    expect(media.currentTime).toBe(15);
    expect(media.play).toHaveBeenCalled();
    act(() => { result.current.setSpeed(1.5); });
    expect(result.current.speed).toBe(1.5);
    expect(media.playbackRate).toBe(1.5);
  });

  it('resets Practice speed to 1 when the source changes', async () => {
    const { result, media, rerender } = setup({ mode: 'PRACTICE', url: 'https://cdn/a.mp3' });
    await settle();
    act(() => { result.current.setSpeed(2); });
    expect(media.playbackRate).toBe(2);
    rerender({ url: 'https://cdn/b.mp3' });
    expect(result.current.speed).toBe(1);
    expect(media.playbackRate).toBe(1);
  });

  it('never exposes rewind/speed controls in Mock mode', async () => {
    httpGet.mockResolvedValueOnce(envelope(running(0)) as never);
    const { result } = setup();
    await settle();
    expect(result.current.isPractice).toBe(false);
    expect(result.current.speed).toBe(1);
  });
});


describe('TWR-F7 media readiness follows the live timeline', () => {
  function Harness({ attemptId = 42, enabled = true, now }: { attemptId?: number; enabled?: boolean; now: () => number }) {
    const mediaRef = React.useRef<HTMLMediaElement | null>(null);
    const playback = useListeningPlayback({ attemptId, enabled, mode: 'MOCK_TEST', mediaRef, now });
    return playback.activeTrack ? (
      <AudioPlayer url={playback.activeTrack.audioUrl} isActive variant="server" mediaRef={playback.bindMedia} />
    ) : null;
  }

  it.each(['loadedmetadata', 'canplay'])('seeks the current server offset after delayed %s', async event => {
    let ready = 0;
    let clock = 1000;
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(() => ready);
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const view = render(<Harness now={() => clock} />);
    await settle();
    const audio = view.container.querySelector('audio')!;
    clock += 5000;
    await settle(PLAYBACK_TICK_MS);
    clock += 250; // Readiness arrives between ticks: use the anchor, not the last rendered position.
    ready = 1;
    act(() => audio.dispatchEvent(new Event(event)));
    await settle();
    expect(audio.currentTime).toBeCloseTo(10.25, 3);
    expect(audio.play).toHaveBeenCalled();
  });

  it('does not play when metadata arrives after the server timeline has finished', async () => {
    let ready = 0;
    let clock = 1000;
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(() => ready);
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const view = render(<Harness now={() => clock} />);
    await settle();
    const audio = view.container.querySelector('audio')!;
    clock += TOTAL_MS;
    ready = 1;
    act(() => audio.dispatchEvent(new Event('loadedmetadata')));
    await settle();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
  });

  it('does not seek or play from an old readiness event after going offline', async () => {
    let ready = 0;
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(() => ready);
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const view = render(<Harness now={() => 1000} />);
    await settle();
    const audio = view.container.querySelector('audio')!;
    act(() => window.dispatchEvent(new Event('offline')));
    audio.currentTime = 0;
    vi.mocked(audio.play).mockClear();
    ready = 1;
    act(() => {
      audio.dispatchEvent(new Event('loadedmetadata'));
      audio.dispatchEvent(new Event('canplay'));
    });
    await settle();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
  });

  it('discards the old source offset when metadata arrives after a Part transition', async () => {
    let ready = 0;
    let clock = 1000;
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(() => ready);
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never);
    const positions: number[] = [];
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(function(this: HTMLMediaElement) {
      positions.push(this.currentTime);
      return Promise.resolve();
    });
    const view = render(<Harness now={() => clock} />);
    await settle();
    const audio = view.container.querySelector('audio')!;
    clock += 26000;
    await settle(PLAYBACK_TICK_MS);
    expect(audio.getAttribute('src')).toBe(TRACKS[1].audioUrl);
    positions.length = 0;
    ready = 1;
    act(() => audio.dispatchEvent(new Event('loadedmetadata')));
    await settle();
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every(position => Math.abs(position - 1) < 0.001)).toBe(true);
    expect(audio.currentTime).toBeCloseTo(1, 3);
  });

  it.each(['attempt', 'disabled', 'unmount'])('cancels readiness work on %s context cleanup', async context => {
    let ready = 0;
    vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockImplementation(() => ready);
    httpGet.mockResolvedValueOnce(envelope(running(5000)) as never)
      .mockResolvedValueOnce(envelope(notStarted(43)) as never);
    const now = () => 1000;
    const view = render(<Harness now={now} />);
    await settle();
    const audio = view.container.querySelector('audio')!;
    if (context === 'unmount') view.unmount();
    else view.rerender(<Harness now={now} attemptId={context === 'attempt' ? 43 : 42} enabled={context !== 'disabled'} />);
    await settle();
    audio.currentTime = 0;
    vi.mocked(audio.play).mockClear();
    ready = 1;
    act(() => {
      audio.dispatchEvent(new Event('loadedmetadata'));
      audio.dispatchEvent(new Event('canplay'));
    });
    await settle();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
  });
});
