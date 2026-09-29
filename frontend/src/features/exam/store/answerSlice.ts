import { createSlice, createSelector, PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';

interface AnswerState {
  attemptId: number | null;
  version: number;
  /** answers[partId][questionId] = AnswerValue */
  answers: Record<number, Record<string, AnswerValue>>;
}

const initialState: AnswerState = {
  attemptId: null,
  version: 0,
  answers: {},
};

const answerSlice = createSlice({
  name: 'answers',
  initialState,
  reducers: {
    setAttemptContext(
      state,
      action: PayloadAction<{ attemptId: number; version: number; savedAnswers: PartAnswers[] }>
    ) {
      const { attemptId, version, savedAnswers } = action.payload;
      state.attemptId = attemptId;
      state.version = version;
      state.answers = {};
      for (const part of savedAnswers) {
        state.answers[part.part_id] = {};
        for (const ua of part.answers) {
          state.answers[part.part_id][ua.question_id] = ua.answer;
        }
      }
    },

    setAnswer(
      state,
      action: PayloadAction<{ partId: number; questionId: string; value: AnswerValue }>
    ) {
      // Invariant: no writes when no active attempt
      if (state.attemptId === null) return;
      const { partId, questionId, value } = action.payload;
      if (!state.answers[partId]) {
        state.answers[partId] = {};
      }
      state.answers[partId][questionId] = value;
    },

    clearAnswers() {
      return initialState;
    },
  },
});

export const { setAttemptContext, setAnswer, clearAnswers } = answerSlice.actions;

// Selectors — typed loosely to avoid circular imports
type RootLike = { answers: AnswerState };

export function selectAnswer(state: RootLike, partId: number, questionId: string): AnswerValue {
  return state.answers.answers?.[partId]?.[questionId] ?? null;
}

/**
 * Memoized selector — returns the same array reference when answers for
 * this partId haven't changed, preventing unnecessary QuestionPalette re-renders.
 */
export const selectAnsweredQuestionIds = createSelector(
  [(state: RootLike) => state.answers.answers, (_: RootLike, partId: number) => partId],
  (answers, partId): string[] => {
    const partAnswers = answers[partId];
    if (!partAnswers) return [];
    return Object.entries(partAnswers)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);
  }
);

export default answerSlice.reducer;
