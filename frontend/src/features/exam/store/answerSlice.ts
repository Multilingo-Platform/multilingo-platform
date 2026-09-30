import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AnswerState {
  attemptId: number | null;
  version: number;
  /** answers[partId][questionId] = AnswerValue */
  answers: Record<number, Record<string, AnswerValue>>;
  /** true khi có đáp án chưa được autosave lên server thành công */
  isDirty: boolean;
  /** null cho đến lần autosave thành công đầu tiên */
  lastSavedAt: number | null;
  saveStatus: SaveStatus;
}

export const initialState: AnswerState = {
  attemptId: null,
  version: 0,
  answers: {},
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',
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
      state.isDirty = false;
      state.saveStatus = 'idle';
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
      if (state.attemptId === null) return;
      const { partId, questionId, value } = action.payload;
      if (!state.answers[partId]) {
        state.answers[partId] = {};
      }
      state.answers[partId][questionId] = value;
      state.isDirty = true;
    },

    markSavePending(state) {
      state.saveStatus = 'saving';
    },

    markSaveSuccess(state, action: PayloadAction<{ savedAt: number }>) {
      state.isDirty = false;
      state.lastSavedAt = action.payload.savedAt;
      state.saveStatus = 'saved';
    },

    markSaveError(state) {
      state.saveStatus = 'error';
      // isDirty remains true — retry on next interval
    },

    clearAnswers() {
      return initialState;
    },
  },
});

export const {
  setAttemptContext,
  setAnswer,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  clearAnswers,
} = answerSlice.actions;

type RootLike = { answers: AnswerState };

export function selectAnswer(state: RootLike, partId: number, questionId: string): AnswerValue {
  return state.answers.answers?.[partId]?.[questionId] ?? null;
}

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

export const selectSaveStatus = createSelector(
  [
    (state: RootLike) => state.answers.isDirty,
    (state: RootLike) => state.answers.saveStatus,
    (state: RootLike) => state.answers.lastSavedAt,
  ],
  (isDirty, saveStatus, lastSavedAt) => ({ isDirty, saveStatus, lastSavedAt })
);

// Export for tests
export const reducer = answerSlice.reducer;
export default answerSlice.reducer;
