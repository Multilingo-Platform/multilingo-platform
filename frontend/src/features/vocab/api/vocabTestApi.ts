import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse } from '../types/vocab.types';
import type {
  VocabTestExam,
  VocabTestResumeResponse,
  VocabTestResult,
  VocabTestReviewDetail,
  VocabTestHistoryItem,
  VocabTestAnswerItem,
} from '../types/vocabTest.types';

export const vocabTestApi = {
  /**
   * 1. Sinh đề thi thử mới cho bộ thẻ
   */
  generateTest: async (deckId: number, limit: number = 10): Promise<VocabTestExam> => {
    const res = (await axiosClient.post(`/v1/vocab/decks/${deckId}/tests/generate`, {
      limit,
    })) as unknown as ApiResponse<VocabTestExam>;
    return res.data;
  },

  /**
   * 2. Khôi phục bài thi khi F5 hoặc đổi thiết bị (Resume)
   */
  resumeTest: async (testToken: string): Promise<VocabTestResumeResponse> => {
    const res = (await axiosClient.get(`/v1/vocab/tests/${testToken}`)) as unknown as ApiResponse<VocabTestResumeResponse>;
    return res.data;
  },

  /**
   * 3. Tự động lưu tiến độ làm bài (Autosave CAS)
   */
  saveProgress: async (
    testToken: string,
    expectedVersion: number,
    answers: VocabTestAnswerItem[]
  ): Promise<{ progressVersion: number }> => {
    const res = (await axiosClient.put(`/v1/vocab/tests/${testToken}/progress`, {
      expectedVersion,
      answers,
    })) as unknown as ApiResponse<{ progressVersion: number }>;
    return res.data;
  },

  /**
   * 4. Nộp bài thi
   */
  submitTest: async (
    testToken: string,
    expectedVersion: number,
    answers: VocabTestAnswerItem[],
    idempotencyKey?: string
  ): Promise<VocabTestResult> => {
    const res = (await axiosClient.post(`/v1/vocab/tests/${testToken}/submit`, {
      idempotencyKey: idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`),
      expectedVersion,
      answers,
    })) as unknown as ApiResponse<VocabTestResult>;
    return res.data;
  },

  /**
   * 5. Xem lại chi tiết đáp án và giải thích sau khi nộp
   */
  reviewAnswers: async (testToken: string): Promise<VocabTestReviewDetail> => {
    const res = (await axiosClient.get(`/v1/vocab/tests/${testToken}/review`)) as unknown as ApiResponse<VocabTestReviewDetail>;
    return res.data;
  },

  /**
   * 6. Lấy danh sách lịch sử thi thử của bộ thẻ
   */
  getDeckTestHistory: async (
    deckId: number,
    page: number = 0,
    size: number = 10
  ): Promise<{ items: VocabTestHistoryItem[]; totalElements: number; totalPages: number }> => {
    const res = (await axiosClient.get(`/v1/vocab/decks/${deckId}/tests`, {
      params: { page, size },
    })) as unknown as ApiResponse<{ items: VocabTestHistoryItem[]; totalElements: number; totalPages: number }>;
    return res.data;
  },
};
