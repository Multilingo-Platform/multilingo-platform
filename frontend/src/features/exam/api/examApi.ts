import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse, LearnerExamStructure } from '../types/api.types';

/**
 * GET /api/v1/exams/:id/structure
 * Fetches published exam structure for learners.
 */
export async function getExamStructure(examId: number): Promise<LearnerExamStructure> {
  try {
    const res = await axiosClient.get<unknown, ApiResponse<LearnerExamStructure>>(
      `/v1/exams/${examId}/structure`
    );
    if (!res.success) {
      throw new Error(res.message || 'Failed to fetch exam structure');
    }
    if (!res.data) {
      throw new Error('Failed to fetch exam structure');
    }
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch exam structure');
  }
}
