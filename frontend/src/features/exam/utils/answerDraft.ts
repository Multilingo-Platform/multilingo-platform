import type { AnswerState } from '../store/answerSlice';

export function persistAnswerDraft(attemptId: number, answers: AnswerState['answers']): boolean {
  try {
    localStorage.setItem(`exam_draft_${attemptId}`, JSON.stringify(answers));
    return true;
  } catch {
    return false;
  }
}
export function removeAnswerDraft(attemptId: number): boolean {
  try {
    localStorage.removeItem(`exam_draft_${attemptId}`);
    return true;
  } catch {
    return false;
  }
}
