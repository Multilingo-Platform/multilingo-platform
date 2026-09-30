import axiosClient from '../../../api/axiosClient';
import type {
  ApiResponse,
  AutosaveRequest,
  CreateAttemptRequest,
  SubmitResult,
  WorkspaceResponse,
} from '../types/api.types';

function normalizeWorkspace(data: any): WorkspaceResponse {
  return {
    attempt_id: data.attemptId ?? data.attempt_id,
    status: data.status,
    test_scope: data.testScope ?? data.test_scope,
    test_mode: data.testMode ?? data.test_mode,
    deadline: data.deadline ?? null,
    exam_snapshot: data.examSnapshot ?? data.exam_snapshot ?? {},
    version: data.version ?? 0,
    saved_answers: data.savedAnswers ?? data.saved_answers ?? [],
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
  const res = await axiosClient.post<unknown, ApiResponse<any>>('/v1/attempts', payload);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Failed to create attempt');
  }
  return normalizeWorkspace(res.data);
}

/**
 * GET /api/v1/attempts/:id/workspace
 * Loads workspace for an existing attempt. Returns workspace without correct_answer.
 */
export async function getWorkspace(attemptId: number): Promise<WorkspaceResponse> {
  const res = await axiosClient.get<unknown, ApiResponse<any>>(`/v1/attempts/${attemptId}/workspace`);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Attempt not found');
  }
  return normalizeWorkspace(res.data);
}

/**
 * PUT /api/v1/attempts/:id/answers
 * Autosave draft answers. Called by useAutosave hook every 15s when isDirty=true.
 */
export async function autosaveAnswers(attemptId: number, req: AutosaveRequest): Promise<void> {
  const res = await axiosClient.put<unknown, ApiResponse<null>>(
    `/v1/attempts/${attemptId}/answers`,
    { version: req.version, answers: req.answers }
  );
  if (!res.success) {
    throw new Error(res.message || 'Autosave failed');
  }
}

/**
 * POST /api/v1/attempts/:id/submit
 * Submit attempt. Idempotent — safe to call multiple times.
 */
export async function submitAttempt(attemptId: number, req: AutosaveRequest): Promise<SubmitResult> {
  const res = await axiosClient.post<unknown, ApiResponse<any>>(
    `/v1/attempts/${attemptId}/submit`,
    { version: req.version, answers: req.answers }
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Submit failed');
  }
  return {
    attempt_id: res.data.attemptId ?? res.data.attempt_id,
    status: res.data.status,
    redirect_url: res.data.redirectUrl ?? res.data.redirect_url,
  };
}
