import { renderHook, waitFor } from '@testing-library/react';
import { useExamReview } from '../useExamReview';
import * as attemptApi from '../../api/attemptApi';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../api/attemptApi');

describe('useExamReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return review data', async () => {
    const mockData = {
      attemptId: 1,
      partId: 1,
      partResult: {},
      userAnswers: {},
      examData: {},
    };
    vi.spyOn(attemptApi, 'getAttemptReview').mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useExamReview(1, 1));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should reset data when partId changes', async () => {
    const mockData1 = { attemptId: 1, partId: 1, partResult: {}, userAnswers: {}, examData: {} };
    const mockData2 = { attemptId: 1, partId: 2, partResult: {}, userAnswers: {}, examData: {} };
    vi.spyOn(attemptApi, 'getAttemptReview')
      .mockResolvedValueOnce(mockData1 as any)
      .mockResolvedValueOnce(mockData2 as any);

    const { result, rerender } = renderHook(({ partId }) => useExamReview(1, partId), {
      initialProps: { partId: 1 },
    });

    await waitFor(() => expect(result.current.data).toEqual(mockData1));

    rerender({ partId: 2 });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.data).toEqual(mockData2));
  });

  it('should handle API errors gracefully', async () => {
    vi.spyOn(attemptApi, 'getAttemptReview').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useExamReview(1, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.data).toBeNull();
  });
});
