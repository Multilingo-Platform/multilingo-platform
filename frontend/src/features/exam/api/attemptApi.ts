import axiosClient from '../../../api/axiosClient';
import type { ApiResponse, CreateAttemptRequest, WorkspaceResponse } from '../types/api.types';

/**
 * POST /api/v1/attempts
 * Creates a new test attempt. Returns workspace without correct_answer.
 */
export async function createAttempt(req: CreateAttemptRequest): Promise<WorkspaceResponse> {
  const res = await axiosClient.post<unknown, ApiResponse<WorkspaceResponse>>('/v1/attempts', req);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Failed to create attempt');
  }
  return res.data;
}

/**
 * GET /api/v1/attempts/:id/workspace
 * Loads workspace for an existing attempt. Returns workspace without correct_answer.
 */
export async function getWorkspace(attemptId: number): Promise<WorkspaceResponse> {
  const res = await axiosClient.get<unknown, ApiResponse<WorkspaceResponse>>(`/v1/attempts/${attemptId}/workspace`);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Attempt not found');
  }
  return res.data;
}
