import type { Question } from '../types/exam.types';

/**
 * Selects question IDs for retry in the exact natural order of the current Part questions,
 * eliminating duplicates and dropping any IDs that do not belong to the Part.
 */
export function selectRetryQuestionIds(
  questions: readonly Question[],
  wrongQuestionIds: readonly string[]
): string[] {
  if (!questions || questions.length === 0 || !wrongQuestionIds || wrongQuestionIds.length === 0) {
    return [];
  }
  const wrongSet = new Set(wrongQuestionIds);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const q of questions) {
    const qId = q.question_id;
    if (wrongSet.has(qId) && !seen.has(qId)) {
      seen.add(qId);
      result.push(qId);
    }
  }

  return result;
}

/**
 * Filters question groups to only include questions in the questionIds set.
 * Omits groups that have no matching questions.
 * Preserves all group metadata, context, media, and instruction without mutating input.
 */
export function filterRetryGroups<T extends { questions: Question[] }>(
  groups: readonly T[],
  questionIds: ReadonlySet<string>
): T[] {
  if (!groups || groups.length === 0 || !questionIds || questionIds.size === 0) {
    return [];
  }
  const result: T[] = [];

  for (const group of groups) {
    const matchingQuestions = group.questions.filter((q) => questionIds.has(q.question_id));
    if (matchingQuestions.length > 0) {
      result.push({
        ...group,
        questions: matchingQuestions,
      });
    }
  }

  return result;
}
