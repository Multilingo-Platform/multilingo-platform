import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse } from '../types/api.types';

/** Bounded timeout for playback reads/starts; the caller may abort sooner. */
export const PLAYBACK_TIMEOUT_MS = 10_000;

export type ListeningPlaybackStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'FINISHED'
  | 'LOCKED'
  | 'CLOSED'
  | 'UNAVAILABLE';

const PLAYBACK_STATUSES: ReadonlySet<string> = new Set([
  'NOT_STARTED',
  'RUNNING',
  'FINISHED',
  'LOCKED',
  'CLOSED',
  'UNAVAILABLE',
]);

export interface ListeningPlaybackTrack {
  partId: string;
  partNumber: number;
  audioUrl: string;
  durationMs: number;
  startOffsetMs: number;
}

export interface ListeningPlaybackSnapshot {
  attemptId: number;
  status: ListeningPlaybackStatus;
  serverTime: string;
  startedAt: string | null;
  activePartId: string | null;
  activePartNumber: number | null;
  positionMs: number;
  elapsedMs: number;
  remainingMs: number;
  totalDurationMs: number;
  tracks: ListeningPlaybackTrack[];
}

export class ListeningPlaybackContractError extends Error {
  constructor(message: string = 'Dữ liệu phát audio không hợp lệ.') {
    super(message);
    this.name = 'ListeningPlaybackContractError';
    Object.setPrototypeOf(this, ListeningPlaybackContractError.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidIsoInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeTrack(raw: unknown): ListeningPlaybackTrack {
  if (!isRecord(raw)) throw new ListeningPlaybackContractError();
  const partId = raw.partId;
  if (typeof partId !== 'string' || partId.length === 0) throw new ListeningPlaybackContractError();
  if (!isPositiveInt(raw.partNumber)) throw new ListeningPlaybackContractError();
  const audioUrl = raw.audioUrl;
  if (typeof audioUrl !== 'string' || audioUrl.length === 0) throw new ListeningPlaybackContractError();
  if (!isPositiveInt(raw.durationMs)) throw new ListeningPlaybackContractError();
  if (!isNonNegativeInt(raw.startOffsetMs)) throw new ListeningPlaybackContractError();
  return {
    partId,
    partNumber: raw.partNumber,
    audioUrl,
    durationMs: raw.durationMs,
    startOffsetMs: raw.startOffsetMs,
  };
}

function optionalPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (!isPositiveInt(value)) throw new ListeningPlaybackContractError();
  return value;
}

function optionalNonNegativeInt(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (!isNonNegativeInt(value)) throw new ListeningPlaybackContractError();
  return value;
}

function optionalTrackId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0) throw new ListeningPlaybackContractError();
  return value;
}

/**
 * Validates and normalizes a wire playback payload. Server-omitted optional fields
 * (NON_NULL) become explicit nulls/zeroes so consumers never read `undefined`.
 */
export function normalizeListeningPlayback(
  raw: unknown,
  expectedAttemptId?: number
): ListeningPlaybackSnapshot {
  if (!isRecord(raw)) throw new ListeningPlaybackContractError();
  const attemptId = raw.attemptId;
  if (!isPositiveInt(attemptId)) throw new ListeningPlaybackContractError();
  if (expectedAttemptId !== undefined && attemptId !== expectedAttemptId) {
    throw new ListeningPlaybackContractError();
  }
  const status = raw.status;
  if (typeof status !== 'string' || !PLAYBACK_STATUSES.has(status)) {
    throw new ListeningPlaybackContractError();
  }
  if (!isValidIsoInstant(raw.serverTime)) throw new ListeningPlaybackContractError();

  const tracksRaw = raw.tracks;
  if (!Array.isArray(tracksRaw)) throw new ListeningPlaybackContractError();
  const tracks = tracksRaw.map(normalizeTrack);

  let startedAt: string | null = null;
  if (raw.startedAt !== undefined && raw.startedAt !== null) {
    if (!isValidIsoInstant(raw.startedAt)) throw new ListeningPlaybackContractError();
    startedAt = raw.startedAt;
  }

  const running = status === 'RUNNING';
  if (running) {
    if (startedAt === null) throw new ListeningPlaybackContractError();
  }

  const activePartId = optionalTrackId(raw.activePartId);
  const activePartNumber = optionalPositiveInt(raw.activePartNumber);
  if (running && (activePartId === null || activePartNumber === null)) {
    throw new ListeningPlaybackContractError();
  }

  return {
    attemptId,
    status: status as ListeningPlaybackStatus,
    serverTime: raw.serverTime,
    startedAt,
    activePartId,
    activePartNumber,
    positionMs: optionalNonNegativeInt(raw.positionMs),
    elapsedMs: optionalNonNegativeInt(raw.elapsedMs),
    remainingMs: optionalNonNegativeInt(raw.remainingMs),
    totalDurationMs: optionalNonNegativeInt(raw.totalDurationMs),
    tracks,
  };
}

function assertAttemptId(attemptId: number): void {
  if (!isPositiveInt(attemptId)) throw new ListeningPlaybackContractError('ID phiên thi không hợp lệ.');
}

/** GET /api/v1/attempts/:id/listening-playback — pure read of the server timeline. */
export async function getListeningPlayback(
  attemptId: number,
  options?: { signal?: AbortSignal }
): Promise<ListeningPlaybackSnapshot> {
  assertAttemptId(attemptId);
  const res = await axiosClient.get<unknown, ApiResponse<unknown>>(
    `/v1/attempts/${attemptId}/listening-playback`,
    { signal: options?.signal, timeout: PLAYBACK_TIMEOUT_MS }
  );
  if (!isRecord(res) || res.success !== true || res.data === null || res.data === undefined) {
    throw new ListeningPlaybackContractError();
  }
  return normalizeListeningPlayback(res.data, attemptId);
}

/** POST /api/v1/attempts/:id/listening-playback/start — idempotent start. */
export async function startListeningPlayback(
  attemptId: number,
  options?: { signal?: AbortSignal }
): Promise<ListeningPlaybackSnapshot> {
  assertAttemptId(attemptId);
  const res = await axiosClient.post<unknown, ApiResponse<unknown>>(
    `/v1/attempts/${attemptId}/listening-playback/start`,
    null,
    { signal: options?.signal, timeout: PLAYBACK_TIMEOUT_MS }
  );
  if (!isRecord(res) || res.success !== true || res.data === null || res.data === undefined) {
    throw new ListeningPlaybackContractError();
  }
  return normalizeListeningPlayback(res.data, attemptId);
}
