import axiosClient from '../../../api/axiosClient';
import type { ApiResponse, CreateAttemptRequest, WorkspaceResponse } from '../types/api.types';

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
