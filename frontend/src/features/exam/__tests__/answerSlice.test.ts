import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, {
  setAttemptContext,
  setAnswer,
  clearAnswers,
  selectAnswer,
  selectAnsweredQuestionIds,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  initialState,
  reducer,
  toggleFlag,
  clearFlags,
  selectIsQuestionFlagged,
  addHighlightRecord,
  removeHighlightRecord,
} from '../store/answerSlice';

function makeStore() {
  return configureStore({ reducer: { answers: answerReducer } });
}

describe('answerSlice', () => {
  describe('flags', () => {
    it('toggles question flag on and off', () => {
      let state = reducer(initialState, toggleFlag({ partId: 1, questionId: 'q_001' }));
      expect(selectIsQuestionFlagged({ answers: state }, 1, 'q_001')).toBe(true);

      state = reducer(state, toggleFlag({ partId: 1, questionId: 'q_001' }));
      expect(selectIsQuestionFlagged({ answers: state }, 1, 'q_001')).toBe(false);
    });

    it('clears all flags on clearFlags', () => {
      let state = reducer(initialState, toggleFlag({ partId: 1, questionId: 'q_001' }));
      expect(selectIsQuestionFlagged({ answers: state }, 1, 'q_001')).toBe(true);

      state = reducer(state, clearFlags());
      expect(selectIsQuestionFlagged({ answers: state }, 1, 'q_001')).toBe(false);
      expect(state.flags).toEqual({});
    });
  });
  it('TC_WS_ANS_01: setAnswer stores string for SINGLE_CHOICE', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
  });

  it('TC_WS_ANS_02: switching part does not erase answers from previous part', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(setAnswer({ partId: 2, questionId: 'q_010', value: 'B' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
    expect(selectAnswer(store.getState(), 2, 'q_010')).toBe('B');
  });

  it('TC_WS_ANS_03: MULTIPLE_CHOICE stores string array', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: ['B', 'C'] }));
    expect(selectAnswer(store.getState(), 1, 'q_002')).toEqual(['B', 'C']);
  });

  it('TC_WS_ANS_04: MULTIPLE_CHOICE cleared to empty array (not null)', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: [] }));
    expect(selectAnswer(store.getState(), 1, 'q_002')).toEqual([]);
    expect(selectAnswer(store.getState(), 1, 'q_002')).not.toBeNull();
  });

  it('setAttemptContext hydrates savedAnswers from server', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({
      attemptId: 5,
      version: 3,
      savedAnswers: [
        { part_id: 1, answers: [{ question_id: 'q_001', answer: 'A' }] }
      ],
    }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
  });

  it('setAnswer is a no-op when attemptId is null', () => {
    const store = makeStore();
    // Do NOT call setAttemptContext — attemptId stays null
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBeNull();
  });

  it('clearAnswers resets state', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(clearAnswers());
    expect(store.getState().answers.attemptId).toBeNull();
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBeNull();
  });

  it('selectAnsweredQuestionIds returns ids with non-null answers', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: null }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_003', value: ['B'] }));
    const ids = selectAnsweredQuestionIds(store.getState(), 1);
    expect(ids).toContain('q_001');
    expect(ids).toContain('q_003');
    expect(ids).not.toContain('q_002');
  });

  it('REGRESSION: selectAnsweredQuestionIds returns same reference when state unchanged', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    const first = selectAnsweredQuestionIds(store.getState(), 1);
    // Call again with same state — should be referentially identical (memoized)
    const second = selectAnsweredQuestionIds(store.getState(), 1);
    expect(first).toBe(second); // strict reference equality — fails without createSelector
  });

  describe('isDirty flag', () => {
    it('isDirty starts false', () => {
      const state = reducer(undefined, { type: '@@INIT' });
      expect(state.isDirty).toBe(false);
    });

    it('setAnswer marks isDirty = true', () => {
      let state = reducer({ ...initialState, attemptId: 1 }, setAttemptContext({ attemptId: 1, version: 0, savedAnswers: [] }));
      state = reducer(state, setAnswer({ partId: 1, questionId: 'q1', value: 'A' }));
      expect(state.isDirty).toBe(true);
    });

    it('markSaveSuccess resets isDirty to false and sets lastSavedAt', () => {
      let state = reducer(
        { ...initialState, attemptId: 1, isDirty: true, pendingVersion: 1 },
        markSaveSuccess({ savedAt: 1000, version: 1 })
      );
      expect(state.isDirty).toBe(false);
      expect(state.lastSavedAt).toBe(1000);
      expect(state.saveStatus).toBe('saved');
    });

    it('markSaveError keeps isDirty true', () => {
      let state = reducer({ ...initialState, isDirty: true }, markSaveError());
      expect(state.isDirty).toBe(true);
      expect(state.saveStatus).toBe('error');
    });

    it('markSavePending sets saveStatus to saving', () => {
      const state = reducer(initialState, markSavePending(0));
      expect(state.saveStatus).toBe('saving');
    });

    it('clearAnswers resets isDirty and saveStatus', () => {
      const dirty = { ...initialState, isDirty: true, saveStatus: 'error' as const };
      const state = reducer(dirty, clearAnswers());
      expect(state.isDirty).toBe(false);
      expect(state.saveStatus).toBe('idle');
    });

    it('RACE: markSaveSuccess does NOT reset isDirty if new edit arrived (version mismatch)', () => {
      // pendingVersion starts at 1; one more edit arrives → pendingVersion becomes 2
      let state = reducer(
        { ...initialState, attemptId: 1, isDirty: true, pendingVersion: 1 },
        setAnswer({ partId: 1, questionId: 'q1', value: 'B' })
      );
      // In-flight save captured version=1 — responds now, but edit at version=2 is still dirty
      state = reducer(state, markSaveSuccess({ savedAt: 1000, version: 1 }));
      expect(state.isDirty).toBe(true);   // Must stay dirty
      expect(state.saveStatus).toBe('saved');
    });

    it('RACE: markSaveSuccess resets isDirty when version matches (no new edit)', () => {
      let state = reducer(
        { ...initialState, attemptId: 1, isDirty: true, pendingVersion: 1 },
        markSavePending(1)
      );
      state = reducer(state, markSaveSuccess({ savedAt: 2000, version: 1 }));
      expect(state.isDirty).toBe(false);
      expect(state.lastSavedAt).toBe(2000);
    });

    it('handles highlight addition and removal', () => {
      let state = reducer(
        initialState,
        addHighlightRecord({
          passageId: 'p1',
          contentHash: 'hash1',
          highlight: { id: '1', start: 5, end: 10, text: 'abc' },
        })
      );

      expect(state.highlights['p1'].items).toHaveLength(1);
      expect(state.isDirty).toBe(true);

      state = reducer(
        state,
        removeHighlightRecord({
          passageId: 'p1',
          offset: 7,
        })
      );

      expect(state.highlights['p1'].items).toHaveLength(0);
    });
  });
});
