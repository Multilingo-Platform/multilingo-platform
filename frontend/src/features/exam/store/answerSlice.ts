import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';
import { normalize, removeAt, type Highlight } from '../utils/highlightUtils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AnswerState {
  attemptId: number | null;
  version: number;
  /** answers[partId][questionId] = AnswerValue */
  answers: Record<number, Record<string, AnswerValue>>;
  /** true khi có đáp án chưa được autosave lên server thành công */
  isDirty: boolean;
  /** null cho đến lần autosave thành công đầu tiên */
  lastSavedAt: number | null;
  saveStatus: SaveStatus;
  /**
   * Monotonically increasing counter — incremented every time setAnswer fires.
   * useAutosave snapshots this before sending the HTTP request; markSaveSuccess
   * only resets isDirty if no new edit has arrived since then (pendingVersion unchanged).
   */
  pendingVersion: number;
  /** flags[partId][questionId] = boolean */
  flags: Record<number, Record<string, boolean>>;
  /** highlights[passageId] = { contentHash, items: Highlight[] } */
  highlights: Record<string, { contentHash: string; items: Highlight[] }>;
}

export const initialState: AnswerState = {
  attemptId: null,
  version: 0,
  answers: {},
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',
  pendingVersion: 0,
  flags: {},
  highlights: {},
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
      state.pendingVersion = 0;
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
      state.pendingVersion += 1;
    },

    /** Pass the pendingVersion snapshot taken just before launching the HTTP request. */
    markSavePending(state, action: PayloadAction<number>) {
      void action; // version snapshot held by useAutosave — not stored here
      state.saveStatus = 'saving';
    },

    markSaveSuccess(state, action: PayloadAction<{ savedAt: number; version: number }>) {
      state.lastSavedAt = action.payload.savedAt;
      state.saveStatus = 'saved';
      // Only clear isDirty when no new edit arrived after the HTTP call was launched
      if (state.pendingVersion === action.payload.version) {
        state.isDirty = false;
      }
    },

    markSaveError(state) {
      state.saveStatus = 'error';
      // isDirty remains true — retry on next interval
    },

    toggleFlag(
      state,
      action: PayloadAction<{ partId: number; questionId: string }>
    ) {
      const { partId, questionId } = action.payload;
      if (!state.flags) {
        state.flags = {};
      }
      if (!state.flags[partId]) {
        state.flags[partId] = {};
      }
      state.flags[partId][questionId] = !state.flags[partId][questionId];
    },

    clearFlags(state) {
      state.flags = {};
    },

    clearAnswers() {
      return initialState;
    },

    addHighlightRecord(
      state,
      action: PayloadAction<{ passageId: string; contentHash: string; highlight: Highlight }>
    ) {
      const { passageId, contentHash, highlight } = action.payload;
      if (!state.highlights) state.highlights = {};
      if (!state.highlights[passageId] || state.highlights[passageId].contentHash !== contentHash) {
        state.highlights[passageId] = { contentHash, items: [] };
      }
      state.highlights[passageId].items.push(highlight);
      state.highlights[passageId].items = normalize(state.highlights[passageId].items);
      state.isDirty = true;
      state.pendingVersion += 1;
    },

    removeHighlightRecord(
      state,
      action: PayloadAction<{ passageId: string; offset: number }>
    ) {
      const { passageId, offset } = action.payload;
      if (state.highlights?.[passageId]) {
        state.highlights[passageId].items = removeAt(state.highlights[passageId].items, offset);
        state.isDirty = true;
        state.pendingVersion += 1;
      }
    },
  },
});

export const {
  setAttemptContext,
  setAnswer,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  toggleFlag,
  clearFlags,
  clearAnswers,
  addHighlightRecord,
  removeHighlightRecord,
} = answerSlice.actions;

type RootLike = { answers: AnswerState };

export function selectHighlights(state: RootLike, passageId: string) {
  return state.answers.highlights?.[passageId];
}

export function selectAnswer(state: RootLike, partId: number, questionId: string): AnswerValue {
  return state.answers.answers?.[partId]?.[questionId] ?? null;
}

export function selectIsQuestionFlagged(state: RootLike, partId: number, questionId: string): boolean {
  return !!state.answers.flags?.[partId]?.[questionId];
}

export function selectFlaggedQuestions(state: RootLike): Record<number, Record<string, boolean>> {
  return state.answers.flags ?? {};
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
    (state: RootLike) => state.answers.pendingVersion,
  ],
  (isDirty, saveStatus, lastSavedAt, pendingVersion) => ({
    isDirty,
    saveStatus,
    lastSavedAt,
    pendingVersion,
  })
);

// Export for tests
export const reducer = answerSlice.reducer;
export default answerSlice.reducer;
