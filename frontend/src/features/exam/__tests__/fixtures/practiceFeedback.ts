import type { PracticeFeedbackResponse } from '../../types/api.types';

/** Standard wire response for practice-feedback endpoint */
export function practiceFeedbackFixture(
  overrides?: Partial<PracticeFeedbackResponse>
): PracticeFeedbackResponse {
  return {
    attemptId: 42,
    partId: 10,
    questionId: 'q1',
    type: 'SINGLE_CHOICE',
    userAnswer: 'A',
    verdict: 'CORRECT',
    score: 1,
    correctAnswer: 'A',
    explanation: 'Giải thích chi tiết cho câu q1.',
    ...overrides,
  };
}

/** Standard envelope wrapper for practice-feedback endpoint */
export function practiceFeedbackEnvelope(data: unknown = practiceFeedbackFixture()) {
  return {
    success: true,
    code: 200,
    message: 'Success',
    data,
    timestamp: '2026-10-12T01:00:00Z',
  };
}
