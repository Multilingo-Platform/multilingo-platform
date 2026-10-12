import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as axiosClientModule from '../../../core/api/axiosClient';
import { getExamStructure } from '../api/examApi';
import type { LearnerExamStructure } from '../types/api.types';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const mockAxios = axiosClientModule.default as any;

describe('getExamStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls exact path /v1/exams/42/structure and returns typed camelCase response data', async () => {
    const mockStructure: LearnerExamStructure = {
      id: 42,
      code: 'IELTS-TEST-1',
      title: 'IELTS Practice Test 1',
      type: 'IELTS',
      durationMinutes: 120,
      sections: [
        {
          id: 70,
          skillType: 'READING',
          title: 'Reading Section',
          durationMinutes: 60,
          orderIndex: 1,
          parts: [
            {
              id: 701,
              partNumber: 1,
              title: 'Reading Part 1',
            },
          ],
        },
      ],
    };

    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      message: 'Success',
      data: mockStructure,
      timestamp: '2026-10-09T18:00:00Z',
    });

    const result = await getExamStructure(42);

    expect(mockAxios.get).toHaveBeenCalledWith('/v1/exams/42/structure');
    expect(result).toEqual(mockStructure);
  });

  it('throws error when envelope returns success=false', async () => {
    mockAxios.get.mockResolvedValueOnce({
      success: false,
      code: 1401,
      message: 'Exam not found',
      data: null,
      timestamp: '2026-10-09T18:00:00Z',
    });

    await expect(getExamStructure(42)).rejects.toThrow('Exam not found');
  });

  it('throws error when envelope returns data=null', async () => {
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      code: 200,
      message: 'Success',
      data: null,
      timestamp: '2026-10-09T18:00:00Z',
    });

    await expect(getExamStructure(42)).rejects.toThrow('Failed to fetch exam structure');
  });

  it('extracts error message from Axios 404 response', async () => {
    const axios404Error = {
      name: 'AxiosError',
      message: 'Request failed with status code 404',
      response: {
        status: 404,
        data: {
          success: false,
          code: 1401,
          message: 'Không tìm thấy đề thi yêu cầu',
        },
      },
    };

    mockAxios.get.mockRejectedValueOnce(axios404Error);

    await expect(getExamStructure(42)).rejects.toThrow('Không tìm thấy đề thi yêu cầu');
  });

  it('extracts error message from Axios 403 response', async () => {
    const axios403Error = {
      name: 'AxiosError',
      message: 'Request failed with status code 403',
      response: {
        status: 403,
        data: {
          message: 'Access Denied',
        },
      },
    };

    mockAxios.get.mockRejectedValueOnce(axios403Error);

    await expect(getExamStructure(42)).rejects.toThrow('Access Denied');
  });
});
