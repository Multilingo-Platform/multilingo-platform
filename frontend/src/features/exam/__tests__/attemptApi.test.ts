import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as axiosClientModule from '../../../core/api/axiosClient';
import { autosaveAnswers, submitAttempt } from '../api/attemptApi';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { put: vi.fn(), post: vi.fn(), get: vi.fn() },
}));

const mockAxios = axiosClientModule.default as any;

describe('autosaveAnswers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PUT /v1/attempts/:id/answers with correct payload', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: true, data: null });
    await autosaveAnswers(42, { version: 3, answers: [] });
    expect(mockAxios.put).toHaveBeenCalledWith('/v1/attempts/42/answers', {
      version: 3,
      answers: [],
    });
  });

  it('throws when API returns success=false', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: false, message: 'conflict' });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow('conflict');
  });
});

describe('submitAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /v1/attempts/:id/submit and returns normalized result', async () => {
    mockAxios.post.mockResolvedValueOnce({
      success: true,
      data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' },
    });
    const result = await submitAttempt(42, { version: 5, answers: [] });
    expect(mockAxios.post).toHaveBeenCalledWith('/v1/attempts/42/submit', {
      version: 5,
      answers: [],
    });
    expect(result).toEqual({
      attempt_id: 42,
      status: 'COMPLETED',
      redirect_url: '/attempts/42/result',
    });
  });

  it('throws when server returns error', async () => {
    mockAxios.post.mockResolvedValueOnce({ success: false, message: 'not found' });
    await expect(submitAttempt(99, { version: 1, answers: [] })).rejects.toThrow('not found');
  });
});
