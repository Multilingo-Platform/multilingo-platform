import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';
import { applyHighlightOverlay, deleteHighlightFromRange, type Highlight } from '../utils/highlightUtils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'stopped';

export interface AnswerState {
  attemptId: number | null;
  contextRevision: number;
  activeSaveId: string | null;
  /** Blocks learner mutations, not authoritative hydration or save acknowledgment. */
  isLocked: boolean;
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
  contextRevision: 0,
  activeSaveId: null,
  isLocked: false,
  version: 0,
  answers: {},
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',
  pendingVersion: 0,
  flags: {},
  highlights: {},
};

export interface SaveOperation {
  attemptId: number;
  contextRevision: number;
  requestId: string;
  pendingVersion: number;
}

function matchesContext(state: AnswerState, op: Pick<SaveOperation, 'attemptId' | 'contextRevision'>) {
  return state.attemptId === op.attemptId && state.contextRevision === op.contextRevision;
}
function matchesSave(state: AnswerState, op: SaveOperation) {
  return matchesContext(state, op) && state.activeSaveId === op.requestId;
}

const answerSlice = createSlice({
  name: 'answers',
  initialState,
  reducers: {
    setAttemptContext(
      state,
      action: PayloadAction<{ attemptId: number; version: number; savedAnswers: PartAnswers[]; isLocked?: boolean }>
    ) {
      const { attemptId, version, savedAnswers } = action.payload;
      const isDifferentAttempt = state.attemptId !== null && state.attemptId !== attemptId;
      state.contextRevision += 1;
      state.activeSaveId = null;
      state.isLocked = action.payload.isLocked ?? false;
      state.attemptId = attemptId;
      state.version = version;
      state.answers = {};
      state.isDirty = false;
      state.lastSavedAt = null;
      state.saveStatus = 'idle';
      state.pendingVersion = 0;
      if (isDifferentAttempt) {
        state.flags = {};
        state.highlights = {};
      }
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
      if (state.attemptId === null || state.isLocked) return;
      const { partId, questionId, value } = action.payload;
      if (!state.answers[partId]) {
        state.answers[partId] = {};
      }
      state.answers[partId][questionId] = value;
      state.isDirty = true;
      state.pendingVersion += 1;
    },

    lockAnswers(state, action: PayloadAction<Pick<SaveOperation, 'attemptId' | 'contextRevision'>>) {
      if (!matchesContext(state, action.payload)) return;
      state.isLocked = true;
    },

    unlockAnswers(state, action: PayloadAction<Pick<SaveOperation, 'attemptId' | 'contextRevision'>>) {
      if (!matchesContext(state, action.payload)) return;
      state.isLocked = false;
    },

    markSavePending(state, action: PayloadAction<SaveOperation>) {
      if (!matchesContext(state, action.payload) || state.activeSaveId !== null) return;
      state.activeSaveId = action.payload.requestId;
      state.saveStatus = 'saving';
    },

    markSaveSuccess(
      state,
      action: PayloadAction<SaveOperation & { savedAt: number; serverVersion: number }>
    ) {
      if (!matchesSave(state, action.payload)) return;
      state.activeSaveId = null;
      state.lastSavedAt = action.payload.savedAt;
      state.version = action.payload.serverVersion;
      // Only clear isDirty when no new edit arrived after the HTTP call was launched
      if (state.pendingVersion === action.payload.pendingVersion) {
        state.isDirty = false;
      }
      state.saveStatus = state.isDirty ? 'idle' : 'saved';
    },

    markSaveConflict(state, action: PayloadAction<SaveOperation>) {
      if (!matchesSave(state, action.payload)) return;
      state.activeSaveId = null;
      state.saveStatus = 'conflict';
      // isDirty remains true so changes are not lost
    },

    markSaveStopped(state, action: PayloadAction<SaveOperation>) {
      if (!matchesSave(state, action.payload)) return;
      state.activeSaveId = null;
      state.saveStatus = 'stopped';
      // isDirty remains true so changes are not lost
    },

    markSaveError(state, action: PayloadAction<SaveOperation>) {
      if (!matchesSave(state, action.payload)) return;
      state.activeSaveId = null;
      state.saveStatus = 'error';
      // isDirty remains true — retry on next interval
    },

    markSaveCancelled(state, action: PayloadAction<SaveOperation>) {
      if (!matchesSave(state, action.payload)) return;
      state.activeSaveId = null;
      state.saveStatus = 'idle';
    },

    markSubmissionConflict(state, action: PayloadAction<Pick<SaveOperation, 'attemptId' | 'contextRevision'>>) {
      if (!matchesContext(state, action.payload)) return;
      state.saveStatus = 'conflict';
    },

    toggleFlag(
      state,
      action: PayloadAction<{ partId: number; questionId: string }>
    ) {
      if (state.isLocked) return;
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
      if (state.isLocked) return;
      state.flags = {};
    },

    clearAnswers(state) {
      return { ...initialState, contextRevision: state.contextRevision + 1 };
    },

    addHighlightRecord(
      state,
      action: PayloadAction<{
        attemptId: number; contextRevision: number; passageId: string; contentHash: string;
        documentText: string; highlight: Highlight;
      }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      const { passageId, contentHash, documentText, highlight } = action.payload;
      if (!state.highlights) state.highlights = {};
      const previousItems = state.highlights[passageId]?.contentHash === contentHash
        ? state.highlights[passageId].items
        : [];
      const updatedItems = applyHighlightOverlay(previousItems, highlight, documentText);
      state.highlights[passageId] = {
        contentHash,
        items: updatedItems,
      };
    },

    recolorHighlightSelection(
      state,
      action: PayloadAction<{
        attemptId: number; contextRevision: number; passageId: string; contentHash: string;
        documentText: string; highlight: Highlight;
      }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      const { passageId, contentHash, documentText, highlight } = action.payload;
      if (!state.highlights) state.highlights = {};
      const previousItems = state.highlights[passageId]?.contentHash === contentHash
        ? state.highlights[passageId].items
        : [];
      const updatedItems = applyHighlightOverlay(previousItems, highlight, documentText);
      state.highlights[passageId] = {
        contentHash,
        items: updatedItems,
      };
    },

    deleteHighlightSelection(
      state,
      action: PayloadAction<{
        attemptId: number; contextRevision: number; passageId: string; contentHash: string;
        documentText: string; start: number; end: number;
      }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      const { passageId, contentHash, documentText, start, end } = action.payload;
      if (!state.highlights?.[passageId]) return;
      if (state.highlights[passageId].contentHash !== contentHash) return;
      const previousItems = state.highlights[passageId].items;
      const updatedItems = deleteHighlightFromRange(previousItems, start, end, documentText);
      state.highlights[passageId] = {
        contentHash,
        items: updatedItems,
      };
    },

    deleteHighlightCluster(
      state,
      action: PayloadAction<{ attemptId: number; contextRevision: number; passageId: string; highlightId: string }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      const { passageId, highlightId } = action.payload;
      if (state.highlights?.[passageId]) {
        state.highlights[passageId].items = state.highlights[passageId].items.filter(item => item.id !== highlightId);
      }
    },

    removeHighlightRecord(
      state,
      action: PayloadAction<{ attemptId: number; contextRevision: number; passageId: string; highlightId: string }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      const { passageId, highlightId } = action.payload;
      if (state.highlights?.[passageId]) {
        state.highlights[passageId].items = state.highlights[passageId].items.filter(item => item.id !== highlightId);
      }
    },

    restoreHighlightRecords(
      state,
      action: PayloadAction<{
        attemptId: number; contextRevision: number;
        highlights: Record<string, { contentHash: string; items: Highlight[] }>;
      }>
    ) {
      if (state.isLocked || !matchesContext(state, action.payload)) return;
      state.highlights = { ...state.highlights, ...action.payload.highlights };
    },
  },
});

export const {
  setAttemptContext,
  setAnswer,
  lockAnswers,
  unlockAnswers,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  markSaveConflict,
  markSaveStopped,
  markSaveCancelled,
  markSubmissionConflict,
  toggleFlag,
  clearFlags,
  clearAnswers,
  addHighlightRecord,
  removeHighlightRecord,
  recolorHighlightSelection,
  deleteHighlightSelection,
  deleteHighlightCluster,
  restoreHighlightRecords,
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
