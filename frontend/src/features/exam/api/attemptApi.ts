import axiosClient from '../../../core/api/axiosClient';
import type {
  ApiResponse,
  AutosaveRequest,
  AutosaveResponse,
  CreateAttemptRequest,
  SubmitResult,
  WorkspaceResponse,
  ExamResultResponse,
  ExamReviewResponse,
  TestScope,
  TestMode
} from '../types/api.types';
import type { AttemptStatus, PartAnswers, UserAnswer, AnswerValue } from '../types/answer.types';
import { normalizeAttemptResult, ResultContractError } from './resultContract';

export class WorkspaceContractError extends Error {
  constructor(message: string = 'Dữ liệu phiên thi không hợp lệ. Vui lòng thử tải lại.') {
    super(message);
    this.name = 'WorkspaceContractError';
    Object.setPrototypeOf(this, WorkspaceContractError.prototype);
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

function pickField(
  raw: Record<string, unknown>,
  canonicalKey: string,
  aliasKey?: string
): unknown {
  if (canonicalKey in raw) {
    return raw[canonicalKey];
  }
  if (aliasKey && aliasKey in raw) {
    return raw[aliasKey];
  }
  return undefined;
}

function isValidIsoInstant(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const match = val.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
  );
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = parseInt(match[6], 10);

  if (month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;

  return !isNaN(Date.parse(val));
}

function isAnswerValue(val: unknown): val is AnswerValue {
  if (val === null || typeof val === 'string') return true;
  if (Array.isArray(val)) return val.every(item => typeof item === 'string');
  if (isRecord(val)) return Object.values(val).every(item => typeof item === 'string');
  return false;
}

const VALID_STATUSES: Set<AttemptStatus> = new Set([
  'IN_PROGRESS',
  'SUBMITTED',
  'GRADING_FAILED',
  'AI_GRADING',
  'AI_GRADING_QUEUED',
  'COMPLETED',
  'EXPIRED',
]);

function normalizeWorkspace(
  raw: unknown,
  clientMidpoint?: number,
  expectedAttemptId?: number
): WorkspaceResponse {
  if (!isRecord(raw)) {
    throw new WorkspaceContractError();
  }

  const attemptId = pickField(raw, 'attemptId', 'attempt_id');
  if (!isPositiveInt(attemptId)) {
    throw new WorkspaceContractError();
  }
  if (expectedAttemptId !== undefined && attemptId !== expectedAttemptId) {
    throw new WorkspaceContractError();
  }

  const version = raw.version;
  if (!isPositiveInt(version)) {
    throw new WorkspaceContractError();
  }

  const status = raw.status as AttemptStatus;
  if (!VALID_STATUSES.has(status)) {
    throw new WorkspaceContractError();
  }

  const testScope = pickField(raw, 'testScope', 'test_scope') as TestScope;
  if (testScope !== 'FULL_EXAM' && testScope !== 'SINGLE_SKILL' && testScope !== 'SINGLE_PART') {
    throw new WorkspaceContractError();
  }

  const testMode = pickField(raw, 'testMode', 'test_mode') as TestMode;
  if (testMode !== 'MOCK_TEST' && testMode !== 'PRACTICE') {
    throw new WorkspaceContractError();
  }

  const startTime = pickField(raw, 'startTime', 'start_time');
  if (!isValidIsoInstant(startTime)) {
    throw new WorkspaceContractError();
  }

  const serverTime = pickField(raw, 'serverTime', 'server_time');
  if (!isValidIsoInstant(serverTime)) {
    throw new WorkspaceContractError();
  }

  let deadline: string | null = null;
  const rawDeadline = raw.deadline;
  if (testMode === 'PRACTICE') {
    if (rawDeadline !== undefined && rawDeadline !== null) {
      throw new WorkspaceContractError();
    }
    deadline = null;
  } else {
    if (!isValidIsoInstant(rawDeadline)) {
      throw new WorkspaceContractError();
    }
    if (new Date(rawDeadline).getTime() < new Date(startTime).getTime()) {
      throw new WorkspaceContractError();
    }
    deadline = rawDeadline;
  }

  const gracePeriod = pickField(raw, 'gracePeriodSeconds', 'grace_period_seconds');
  if (typeof gracePeriod !== 'number' || !Number.isSafeInteger(gracePeriod) || gracePeriod < 0) {
    throw new WorkspaceContractError();
  }

  const lockedRaw = pickField(raw, 'lockedSections', 'locked_sections');
  if (
    !Array.isArray(lockedRaw) ||
    !lockedRaw.every(id => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
  ) {
    throw new WorkspaceContractError();
  }
  const lockedSections = [...lockedRaw];

  const snapshotRaw = pickField(raw, 'examSnapshot', 'exam_snapshot');
  if (!isRecord(snapshotRaw) || !Array.isArray(snapshotRaw.sections)) {
    throw new WorkspaceContractError();
  }

  const savedAnswersRaw = pickField(raw, 'savedAnswers', 'saved_answers');
  if (!Array.isArray(savedAnswersRaw)) {
    throw new WorkspaceContractError();
  }

  const saved_answers: PartAnswers[] = [];
  const seenPartIds = new Set<number>();

  for (const partRaw of savedAnswersRaw) {
    if (!isRecord(partRaw)) {
      throw new WorkspaceContractError();
    }
    const partId = pickField(partRaw, 'part_id', 'partId');
    if (!isPositiveInt(partId) || seenPartIds.has(partId)) {
      throw new WorkspaceContractError();
    }
    seenPartIds.add(partId);

    if (!Array.isArray(partRaw.answers)) {
      throw new WorkspaceContractError();
    }

    const answersList: UserAnswer[] = [];
    const seenQuestionIds = new Set<string>();

    for (const ansRaw of partRaw.answers) {
      if (!isRecord(ansRaw)) {
        throw new WorkspaceContractError();
      }
      const qId = pickField(ansRaw, 'question_id', 'questionId');
      if (typeof qId !== 'string' || qId.length === 0 || seenQuestionIds.has(qId)) {
        throw new WorkspaceContractError();
      }
      seenQuestionIds.add(qId);

      if (!isAnswerValue(ansRaw.answer)) {
        throw new WorkspaceContractError();
      }

      answersList.push({
        question_id: qId,
        answer: ansRaw.answer,
      });
    }

    saved_answers.push({
      part_id: partId,
      answers: answersList,
    });
  }

  const serverNowMs = new Date(serverTime).getTime();
  const safeOffset =
    clientMidpoint !== undefined && Number.isFinite(clientMidpoint)
      ? serverNowMs - clientMidpoint
      : 0;

  return {
    attempt_id: attemptId,
    status,
    test_scope: testScope,
    test_mode: testMode,
    startTime,
    deadline,
    serverTime,
    gracePeriodSeconds: gracePeriod,
    lockedSections,
    exam_snapshot: snapshotRaw as any,
    version,
    saved_answers,
    serverTimeOffset: Number.isFinite(safeOffset) ? safeOffset : 0,
  };
}

/**
 * POST /api/v1/attempts
 * Creates a new test attempt. Returns workspace without correct_answer.
 */
export async function createAttempt(req: CreateAttemptRequest): Promise<WorkspaceResponse> {
  const payload = {
    examId: req.exam_id,
    testScope: req.test_scope,
    testMode: req.test_mode,
    targetSectionId: req.section_id,
    targetPartId: req.part_id,
  };
  const clientBefore = Date.now();
  const res = await axiosClient.post<unknown, ApiResponse<any>>('/v1/attempts', payload);
  const clientAfter = Date.now();
  if (!res.success) {
    throw new Error(res.message || 'Failed to create attempt');
  }
  const clientMidpoint = Math.round((clientBefore + clientAfter) / 2);
  return normalizeWorkspace(res.data, clientMidpoint);
}

/**
 * GET /api/v1/attempts/:id/workspace
 * Loads workspace for an existing attempt. Returns workspace without correct_answer.
 */
export async function getWorkspace(attemptId: number): Promise<WorkspaceResponse> {
  const clientBefore = Date.now();
  const res = await axiosClient.get<unknown, ApiResponse<any>>(`/v1/attempts/${attemptId}/workspace`);
  const clientAfter = Date.now();
  if (!res.success) {
    throw new Error(res.message || 'Attempt not found');
  }
  const clientMidpoint = Math.round((clientBefore + clientAfter) / 2);
  return normalizeWorkspace(res.data, clientMidpoint, attemptId);
}

/**
 * PUT /api/v1/attempts/:id/answers
 * Autosave draft answers. Called by useAutosave hook every 15s when isDirty=true.
 */
export async function autosaveAnswers(
  attemptId: number,
  req: AutosaveRequest,
  options?: { signal?: AbortSignal }
): Promise<AutosaveResponse> {
  validateWriteContext(attemptId, req.version);
  const res = await boundedAttemptRequest(signal => axiosClient.put<unknown, ApiResponse<AutosaveResponse>>(
    `/v1/attempts/${attemptId}/answers`,
    { version: req.version, answers: req.answers },
    { signal, timeout: WRITE_TIMEOUT_MS }
  ), options?.signal);
  if (
    !res.success ||
    !res.data ||
    typeof res.data.version !== 'number' ||
    !Number.isSafeInteger(res.data.version) ||
    res.data.version <= 0 ||
    res.data.version > 2147483647
  ) {
    throw new Error(res.message || 'Invalid autosave response: missing version');
  }
  return res.data;
}

export interface SubmitAttemptApiRequest {
  reason: 'MANUAL' | 'TIMEOUT_CLIENT';
  baseVersion: number;
  finalAnswers: PartAnswers[];
}

const WRITE_TIMEOUT_MS = 10_000;

function validateWriteContext(attemptId: number, version: number): void {
  if (![attemptId, version].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 2147483647)) {
    throw new Error('ID phiên thi hoặc version không hợp lệ');
  }
}

/** Axios timeout does not include time queued behind the refresh interceptor. */
async function boundedAttemptRequest<T>(execute: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new Error('Yêu cầu đã bị hủy'));
      controller.abort();
    };
    external?.addEventListener('abort', cancel, { once: true });
    if (external?.aborted) cancel();
    timer = setTimeout(() => {
      reject(new Error('Yêu cầu quá thời gian. Vui lòng thử lại.'));
      controller.abort();
    }, WRITE_TIMEOUT_MS);
  });
  try {
    if (controller.signal.aborted) return await deadline;
    return await Promise.race([deadline, execute(controller.signal)]);
  } finally {
    clearTimeout(timer);
    if (cancel) external?.removeEventListener('abort', cancel);
  }
}

/**
 * POST /api/v1/attempts/:id/submit
 * Submit attempt. Idempotent - safe to call multiple times.
 */
export async function submitAttempt(
  attemptId: number,
  req: SubmitAttemptApiRequest,
  options?: { signal?: AbortSignal }
): Promise<SubmitResult> {
  validateWriteContext(attemptId, req?.baseVersion);
  if (!req || !['MANUAL', 'TIMEOUT_CLIENT'].includes(req.reason) || !Array.isArray(req.finalAnswers)) {
    throw new Error('Payload nộp bài không hợp lệ');
  }
  const payload = {
    reason: req.reason,
    baseVersion: req.baseVersion,
    finalAnswers: req.finalAnswers,
  };
  const res = await boundedAttemptRequest(signal => axiosClient.post<unknown, ApiResponse<any>>(
    `/v1/attempts/${attemptId}/submit`,
    payload,
    { signal, timeout: WRITE_TIMEOUT_MS }
  ), options?.signal);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Submit failed');
  }
  const result = {
    attempt_id: res.data.attemptId ?? res.data.attempt_id,
    status: res.data.status,
    redirect_url: res.data.redirectUrl ?? res.data.redirect_url,
  };
  if (result.attempt_id !== attemptId
      || !['SUBMITTED', 'GRADING_FAILED', 'AI_GRADING', 'AI_GRADING_QUEUED', 'COMPLETED', 'EXPIRED'].includes(result.status)
      || result.redirect_url !== `/attempts/${attemptId}/result`) {
    throw new Error('Phản hồi nộp bài không hợp lệ');
  }
  return result;
}

export async function lockSection(attemptId: number, sectionId: number): Promise<void> {
  const res = await axiosClient.post<unknown, ApiResponse<null>>(`/v1/attempts/${attemptId}/sections/${sectionId}/lock`);
  if (!res.success) {
    throw new Error(res.message || 'Lock section failed');
  }
}

/**
 * GET /api/v1/attempts/:id/result
 */
export async function getAttemptResult(
  attemptId: number,
  options?: { signal?: AbortSignal }
): Promise<ExamResultResponse> {
  if (!isPositiveInt(attemptId)) throw new ResultContractError();
  const res = await boundedAttemptRequest(signal => axiosClient.get<unknown, ApiResponse<unknown>>(
    `/v1/attempts/${attemptId}/result`, { signal, timeout: WRITE_TIMEOUT_MS }
  ), options?.signal);
  if (!isRecord(res) || res.success !== true || res.data == null) throw new ResultContractError();
  return normalizeAttemptResult(res.data, attemptId);
}

/**
 * GET /api/v1/attempts/:id/review/:partId
 */
export async function getAttemptReview(attemptId: number, partId: number): Promise<ExamReviewResponse> {
  try {
    const res = await axiosClient.get<unknown, ApiResponse<ExamReviewResponse>>(`/v1/attempts/${attemptId}/review/${partId}`);
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Failed to fetch review');
    }
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch review');
  }
}
