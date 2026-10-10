import type { AnswerState } from '../store/answerSlice';
import type { AnswerValue, PartAnswers } from '../types/answer.types';

function copyAnswer(value: unknown): AnswerValue {
  if (value === null || typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return [...value];
  if (typeof value === 'object' && value !== null && !Array.isArray(value)
      && Object.getPrototypeOf(value) === Object.prototype
      && Object.values(value).every(item => typeof item === 'string')) {
    return { ...value } as Record<string, string>;
  }
  throw new Error('Đáp án không hợp lệ');
}

/** Preserve explicit clears and essay whitespace; snapshot must not share mutable values. */
export function serializeAnswers(answers: AnswerState['answers']): PartAnswers[] {
  return Object.entries(answers).map(([key, questions]) => {
    const partId = Number(key);
    if (!Number.isSafeInteger(partId) || partId < 1 || partId > 2147483647) {
      throw new Error('ID phần thi không hợp lệ');
    }
    return { part_id: partId, answers: Object.entries(questions).map(([questionId, answer]) => {
      if (!questionId) throw new Error('ID câu hỏi không hợp lệ');
      return { question_id: questionId, answer: copyAnswer(answer) };
    }) };
  });
}
