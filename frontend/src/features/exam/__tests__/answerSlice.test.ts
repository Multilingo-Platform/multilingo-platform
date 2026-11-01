import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { applyHighlights } from '../utils/htmlHighlight';
import { writeHighlightArchive, readHighlightArchive } from '../utils/highlightStorage';
import answerReducer, {
  setAttemptContext,
  setAnswer,
  clearAnswers,
  selectAnswer,
  selectAnsweredQuestionIds,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  markSaveConflict,
  markSaveStopped,
  initialState,
  reducer,
  toggleFlag,
  clearFlags,
  selectIsQuestionFlagged,
  addHighlightRecord,
  recolorHighlightSelection,
  deleteHighlightSelection,
  deleteHighlightCluster,
  removeHighlightRecord,
  restoreHighlightRecords,
} from '../store/answerSlice';

function makeStore() {
  return configureStore({ reducer: { answers: answerReducer } });
}

const operation = { attemptId: 1, contextRevision: 0, requestId: 'save-1', pendingVersion: 1 };

describe('TV3-09 scoped mutation lock', () => {
  function context() {
    return reducer(initialState, setAttemptContext({ attemptId: 42, version: 7, savedAnswers: [] }));
  }
  function lock(state: ReturnType<typeof context>, type = 'answers/lockAnswers', revision = state.contextRevision) {
    return reducer(state, { type, payload: { attemptId: 42, contextRevision: revision } });
  }
  it('blocks answer clears, flags and highlights without changing dirty counters', () => {
    let state = context();
    const highlightContext = { attemptId: state.attemptId!, contextRevision: state.contextRevision };
    state = reducer(state, setAnswer({ partId: 10, questionId: 'essay', value: 'B' }));
    state = reducer(state, toggleFlag({ partId: 10, questionId: 'essay' }));
    state = reducer(state, addHighlightRecord({ ...highlightContext, passageId: 'p', contentHash: 'hash', documentText: 'text', highlight: { id: 'h', start: 0, end: 4, text: 'text' } }));
    const locked = lock(state);
    for (const action of [
      setAnswer({ partId: 10, questionId: 'essay', value: null }),
      setAnswer({ partId: 10, questionId: 'essay', value: '' }),
      toggleFlag({ partId: 10, questionId: 'essay' }), clearFlags(),
      addHighlightRecord({ ...highlightContext, passageId: 'p', contentHash: 'hash', documentText: 'text', highlight: { id: 'h2', start: 5, end: 8, text: 'new' } }),
      removeHighlightRecord({ ...highlightContext, passageId: 'p', highlightId: 'h' }),
    ]) expect(reducer(locked, action)).toBe(locked);
  });
  it('ignores wrong attempt/revision and allows editing only after scoped unlock', () => {
    const state = context();
    expect(reducer(state, { type: 'answers/lockAnswers', payload: { attemptId: 43, contextRevision: state.contextRevision } })).toBe(state);
    expect(lock(state, 'answers/lockAnswers', state.contextRevision - 1)).toBe(state);
    const locked = lock(state);
    expect(lock(locked, 'answers/unlockAnswers', state.contextRevision - 1)).toBe(locked);
    const unlocked = lock(locked, 'answers/unlockAnswers');
    expect(reducer(unlocked, setAnswer({ partId: 10, questionId: 'essay', value: 'C' })).answers[10].essay).toBe('C');
    expect(locked).not.toBe(state);
  });
  it('accepts save acknowledgment and teardown while locked, and resets on hydration', () => {
    let state = context();
    state = reducer(state, setAnswer({ partId: 10, questionId: 'essay', value: 'B' }));
    const op = { attemptId: 42, contextRevision: state.contextRevision, requestId: 'pending', pendingVersion: state.pendingVersion };
    state = reducer(state, markSavePending(op));
    state = lock(state);
    state = reducer(state, markSaveSuccess({ ...op, savedAt: 123, serverVersion: 8 }));
    expect(state).toMatchObject({ version: 8, isDirty: false, saveStatus: 'saved', isLocked: true });
    const cleared = reducer(state, clearAnswers());
    expect(cleared).toMatchObject({ attemptId: null, answers: {}, isLocked: false, contextRevision: state.contextRevision + 1 });
    const hydrated = reducer(state, setAttemptContext({ attemptId: 42, version: 20, savedAnswers: [] }));
    expect(hydrated).toMatchObject({ version: 20, isLocked: false });
    const newLock = lock(hydrated);
    expect(lock(newLock, 'answers/unlockAnswers', state.contextRevision)).toBe(newLock);
  });
});

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

    it('markSaveSuccess resets isDirty to false, updates version to serverVersion and sets lastSavedAt', () => {
      let state = reducer(
        { ...initialState, attemptId: 1, activeSaveId: 'save-1', version: 1, isDirty: true, pendingVersion: 1 },
        markSaveSuccess({ ...operation, savedAt: 1000, serverVersion: 2 })
      );
      expect(state.isDirty).toBe(false);
      expect(state.version).toBe(2);
      expect(state.lastSavedAt).toBe(1000);
      expect(state.saveStatus).toBe('saved');
    });

    it('markSaveConflict sets saveStatus to conflict and preserves isDirty', () => {
      let state = reducer({ ...initialState, attemptId: 1, activeSaveId: 'save-1', isDirty: true }, markSaveConflict(operation));
      expect(state.isDirty).toBe(true);
      expect(state.saveStatus).toBe('conflict');
    });

    it('markSaveError keeps isDirty true', () => {
      let state = reducer({ ...initialState, attemptId: 1, activeSaveId: 'save-1', isDirty: true }, markSaveError(operation));
      expect(state.isDirty).toBe(true);
      expect(state.saveStatus).toBe('error');
    });

    it('markSavePending sets saveStatus to saving', () => {
      const state = reducer({ ...initialState, attemptId: 1 }, markSavePending(operation));
      expect(state.saveStatus).toBe('saving');
    });

    it('clearAnswers resets isDirty and saveStatus', () => {
      const dirty = { ...initialState, isDirty: true, saveStatus: 'error' as const };
      const state = reducer(dirty, clearAnswers());
      expect(state.isDirty).toBe(false);
      expect(state.saveStatus).toBe('idle');
    });

    it('RACE: markSaveSuccess does NOT reset isDirty if new edit arrived (pendingVersion mismatch) but updates version to serverVersion', () => {
      // pendingVersion starts at 1; one more edit arrives → pendingVersion becomes 2
      let state = reducer(
        { ...initialState, attemptId: 1, activeSaveId: 'save-1', version: 1, isDirty: true, pendingVersion: 1 },
        setAnswer({ partId: 1, questionId: 'q1', value: 'B' })
      );
      // In-flight save captured pendingVersion=1, server returns serverVersion=2 — responds now, but edit at pendingVersion=2 is still dirty
      state = reducer(state, markSaveSuccess({ ...operation, savedAt: 1000, serverVersion: 2 }));
      expect(state.isDirty).toBe(true);   // Must stay dirty
      expect(state.version).toBe(2);      // Version must be updated to server version
      expect(state.saveStatus).toBe('idle');
    });

    it('RACE: markSaveSuccess resets isDirty when pendingVersion matches (no new edit)', () => {
      let state = reducer(
        { ...initialState, attemptId: 1, version: 1, isDirty: true, pendingVersion: 1 },
        markSavePending(operation)
      );
      state = reducer(state, markSaveSuccess({ ...operation, savedAt: 2000, serverVersion: 2 }));
      expect(state.isDirty).toBe(false);
      expect(state.version).toBe(2);
      expect(state.lastSavedAt).toBe(2000);
    });

    it('handles highlight addition and removal', () => {
      let state = reducer(initialState, setAttemptContext({ attemptId: 5, version: 9, savedAnswers: [] }));
      const highlightContext = { attemptId: 5, contextRevision: state.contextRevision };
      state = reducer(
        state,
        addHighlightRecord({
          ...highlightContext,
          passageId: 'p1',
          contentHash: 'hash1',
          documentText: '0123456789',
          highlight: { id: '1', start: 5, end: 10, text: 'abc' },
        })
      );

      expect(state.highlights['p1'].items).toHaveLength(1);
      expect(state.isDirty).toBe(false);
      expect(state.pendingVersion).toBe(0);

      state = reducer(
        state,
        removeHighlightRecord({
          ...highlightContext,
          passageId: 'p1',
          highlightId: '1',
        })
      );

      expect(state.highlights['p1'].items).toHaveLength(0);
    });

    it('setAttemptContext resets lastSavedAt to null and hydration fields', () => {
      let state = reducer(initialState, setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
      const op = { attemptId: 5, contextRevision: state.contextRevision, requestId: 'save-2', pendingVersion: 0 };
      state = reducer(state, markSavePending(op));
      state = reducer(state, markSaveSuccess({ ...op, savedAt: 2000, serverVersion: 1 }));
      expect(state.lastSavedAt).toBe(2000);

      state = reducer(state, setAttemptContext({ attemptId: 5, version: 2, savedAnswers: [] }));
      expect(state.lastSavedAt).toBeNull();
      expect(state.isDirty).toBe(false);
      expect(state.saveStatus).toBe('idle');
      expect(state.pendingVersion).toBe(0);
    });

    it('setAttemptContext resets flags and highlights when switching to a different attemptId', () => {
      let state = reducer(initialState, setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
      state = reducer(state, toggleFlag({ partId: 1, questionId: 'q_1' }));
      state = reducer(state, addHighlightRecord({
        attemptId: 5,
        contextRevision: state.contextRevision,
        passageId: 'p1',
        contentHash: 'hash1',
        documentText: 'hello',
        highlight: { id: 'h1', start: 0, end: 5, text: 'hello' },
      }));
      expect(state.flags[1]?.['q_1']).toBe(true);
      expect(state.highlights['p1']?.items).toHaveLength(1);

      // Switch to different attemptId 6
      state = reducer(state, setAttemptContext({ attemptId: 6, version: 1, savedAnswers: [] }));
      expect(state.flags).toEqual({});
      expect(state.highlights).toEqual({});
    });

    it('setAttemptContext preserves flags and highlights when rehydrating the same attemptId', () => {
      let state = reducer(initialState, setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
      state = reducer(state, toggleFlag({ partId: 1, questionId: 'q_1' }));
      state = reducer(state, addHighlightRecord({
        attemptId: 5,
        contextRevision: state.contextRevision,
        passageId: 'p1',
        contentHash: 'hash1',
        documentText: 'hello',
        highlight: { id: 'h1', start: 0, end: 5, text: 'hello' },
      }));

      // Rehydrate same attemptId 5 (e.g. authoritative reload)
      state = reducer(state, setAttemptContext({ attemptId: 5, version: 2, savedAnswers: [] }));
      expect(state.flags[1]?.['q_1']).toBe(true);
      expect(state.highlights['p1']?.items).toHaveLength(1);
    });

    it('markSaveStopped sets saveStatus to stopped and preserves isDirty', () => {
      let state = reducer(initialState, setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
      state = reducer(state, setAnswer({ partId: 1, questionId: 'q1', value: 'A' }));
      const op = { attemptId: 5, contextRevision: state.contextRevision, requestId: 'save-1', pendingVersion: state.pendingVersion };
      state = reducer(state, markSavePending(op));
      expect(state.saveStatus).toBe('saving');
      state = reducer(state, markSaveStopped(op));
      expect(state.saveStatus).toBe('stopped');
      expect(state.isDirty).toBe(true);
      expect(state.activeSaveId).toBeNull();
    });
  });

  it('ignores highlight mutations from stale attempt/revision and restores only matching context', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 71, version: 12, savedAnswers: [] }));
    const revision = state.contextRevision;
    const stale = addHighlightRecord({
      attemptId: 72, contextRevision: revision, passageId: 'old', contentHash: 'h', documentText: 'text',
      highlight: { id: 'x', start: 0, end: 2, text: 'te' },
    });
    expect(reducer(state, stale)).toBe(state);
    state = reducer(state, restoreHighlightRecords({
      attemptId: 71, contextRevision: revision,
      highlights: { ns: { contentHash: 'hash', items: [{ id: 'r', start: 0, end: 1, text: 't' }] } },
    }));
    expect(state.highlights.ns.items).toHaveLength(1);
    expect(state).toMatchObject({ isDirty: false, pendingVersion: 0, version: 12 });
    expect(reducer(state, restoreHighlightRecords({ attemptId: 71, contextRevision: revision - 1, highlights: {} }))).toBe(state);
  });

  it('keeps the existing cluster id when a newly selected range expands it to the left', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 73, version: 2, savedAnswers: [] }));
    const context = { attemptId: 73, contextRevision: state.contextRevision };
    state = reducer(state, addHighlightRecord({
      ...context, passageId: 'stable-cluster', contentHash: 'h', documentText: '0123456789',
      highlight: { id: 'existing-id', start: 5, end: 9, text: 'wrong' },
    }));
    state = reducer(state, addHighlightRecord({
      ...context, passageId: 'stable-cluster', contentHash: 'h', documentText: '0123456789',
      highlight: { id: 'new-selection-id', start: 2, end: 6, text: 'also wrong' },
    }));
    expect(state.highlights['stable-cluster'].items).toEqual([
      { id: 'existing-id', start: 2, end: 9, text: '2345678', color: 'yellow' },
    ]);
  });
it('recolorHighlightSelection recolors subrange and preserves outer ranges without dirtying answers', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 80, version: 1, savedAnswers: [] }));
    const context = { attemptId: 80, contextRevision: state.contextRevision };
    const docText = 'The quick brown fox jumps over the lazy dog';
    // Add initial yellow highlight: 'brown fox jumps' (10..25)
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-1',
      contentHash: 'hash-doc-1',
      documentText: docText,
      highlight: { id: 'hl-1', start: 10, end: 25, text: 'brown fox jumps', color: 'yellow' },
    }));
    expect(state.isDirty).toBe(false);
    expect(state.pendingVersion).toBe(0);

    // Recolor 'fox' (16..19) to 'green'
    state = reducer(state, recolorHighlightSelection({
      ...context,
      passageId: 'doc-1',
      contentHash: 'hash-doc-1',
      documentText: docText,
      highlight: { id: 'hl-green', start: 16, end: 19, text: 'fox', color: 'green' },
    }));

    expect(state.isDirty).toBe(false);
    expect(state.pendingVersion).toBe(0);
    const items = state.highlights['doc-1'].items;
    expect(items).toEqual([
      { id: 'hl-1', start: 10, end: 16, text: 'brown ', color: 'yellow' },
      { id: 'hl-green', start: 16, end: 19, text: 'fox', color: 'green' },
      { id: expect.any(String), start: 19, end: 25, text: ' jumps', color: 'yellow' },
    ]);
  });

  it('deleteHighlightSelection cuts out subrange and deleteHighlightCluster removes entire cluster', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 81, version: 1, savedAnswers: [] }));
    const context = { attemptId: 81, contextRevision: state.contextRevision };
    const docText = '0123456789abcdefghij';
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-cut',
      contentHash: 'hash-cut',
      documentText: docText,
      highlight: { id: 'c1', start: 0, end: 10, text: '0123456789', color: 'pink' },
    }));
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-cut',
      contentHash: 'hash-cut',
      documentText: docText,
      highlight: { id: 'c2', start: 15, end: 20, text: 'fghij', color: 'blue' },
    }));

    // Cut subrange 4..7 from c1
    state = reducer(state, deleteHighlightSelection({
      ...context,
      passageId: 'doc-cut',
      contentHash: 'hash-cut',
      documentText: docText,
      start: 4,
      end: 7,
    }));
    expect(state.isDirty).toBe(false);
    expect(state.pendingVersion).toBe(0);
    expect(state.highlights['doc-cut'].items).toEqual([
      { id: 'c1', start: 0, end: 4, text: '0123', color: 'pink' },
      { id: expect.any(String), start: 7, end: 10, text: '789', color: 'pink' },
      { id: 'c2', start: 15, end: 20, text: 'fghij', color: 'blue' },
    ]);

    // Delete cluster c2
    state = reducer(state, deleteHighlightCluster({
      ...context,
      passageId: 'doc-cut',
      highlightId: 'c2',
    }));
    expect(state.isDirty).toBe(false);
    expect(state.highlights['doc-cut'].items).toHaveLength(2);
    expect(state.highlights['doc-cut'].items.find(h => h.id === 'c2')).toBeUndefined();
  });

  it('RD04-R01: recoloring middle creates distinct cluster IDs and deleting one cluster leaves the other intact', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 82, version: 1, savedAnswers: [] }));
    const context = { attemptId: 82, contextRevision: state.contextRevision };
    const docText = 'abcdefghij';
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-r1',
      contentHash: 'hash-r1',
      documentText: docText,
      highlight: { id: 'old', start: 0, end: 10, text: 'abcdefghij', color: 'yellow' },
    }));

    // Recolor def (3..6) to blue
    state = reducer(state, recolorHighlightSelection({
      ...context,
      passageId: 'doc-r1',
      contentHash: 'hash-r1',
      documentText: docText,
      highlight: { id: 'blue', start: 3, end: 6, text: 'def', color: 'blue' },
    }));

    const items = state.highlights['doc-r1'].items;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ id: 'old', start: 0, end: 3, text: 'abc', color: 'yellow' });
    expect(items[1]).toMatchObject({ id: 'blue', start: 3, end: 6, text: 'def', color: 'blue' });
    expect(items[2]).toMatchObject({ start: 6, end: 10, text: 'ghij', color: 'yellow' });

    const rightClusterId = items[2].id;
    expect(rightClusterId).not.toBe('old');
    expect(rightClusterId).not.toBe('blue');

    // Deleting cluster 'old' must ONLY remove [0, 3) and preserve [6, 10) and [3, 6)
    state = reducer(state, deleteHighlightCluster({
      ...context,
      passageId: 'doc-r1',
      highlightId: 'old',
    }));
    expect(state.highlights['doc-r1'].items).toHaveLength(2);
    expect(state.highlights['doc-r1'].items.find(h => h.id === 'old')).toBeUndefined();
    expect(state.highlights['doc-r1'].items.find(h => h.id === 'blue')).toBeDefined();
    expect(state.highlights['doc-r1'].items.find(h => h.id === rightClusterId)).toBeDefined();

    // Deleting cluster rightClusterId must ONLY remove [6, 10) and preserve [3, 6)
    state = reducer(state, deleteHighlightCluster({
      ...context,
      passageId: 'doc-r1',
      highlightId: rightClusterId,
    }));
    expect(state.highlights['doc-r1'].items).toHaveLength(1);
    expect(state.highlights['doc-r1'].items[0].id).toBe('blue');
  });

  it('RD04-R02: deleteHighlightSelection handles surrogate boundaries without corrupting or dropping highlights', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 83, version: 1, savedAnswers: [] }));
    const context = { attemptId: 83, contextRevision: state.contextRevision };
    const docText = 'A😀B';
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-surrogate',
      contentHash: 'hash-surrogate',
      documentText: docText,
      highlight: { id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' },
    }));

    // Invalid deletion that splits the surrogate pair of 😀 (offset 2)
    state = reducer(state, deleteHighlightSelection({
      ...context,
      passageId: 'doc-surrogate',
      contentHash: 'hash-surrogate',
      documentText: docText,
      start: 1,
      end: 2,
    }));
    // Highlights must remain intact
    expect(state.highlights['doc-surrogate'].items).toHaveLength(1);
    expect(state.highlights['doc-surrogate'].items[0]).toMatchObject({
      id: 'emoji',
      start: 0,
      end: 4,
      text: 'A😀B',
      color: 'yellow',
    });

    // Invalid out-of-bounds deletion
    state = reducer(state, deleteHighlightSelection({
      ...context,
      passageId: 'doc-surrogate',
      contentHash: 'hash-surrogate',
      documentText: docText,
      start: 1,
      end: 10,
    }));
    expect(state.highlights['doc-surrogate'].items).toHaveLength(1);

    // Valid deletion that deletes the entire emoji [1, 3)
    state = reducer(state, deleteHighlightSelection({
      ...context,
      passageId: 'doc-surrogate',
      contentHash: 'hash-surrogate',
      documentText: docText,
      start: 1,
      end: 3,
    }));
    // Must preserve both A [0, 1) and B [3, 4)
    expect(state.highlights['doc-surrogate'].items).toHaveLength(2);
    expect(state.highlights['doc-surrogate'].items[0]).toMatchObject({
      id: 'emoji',
      start: 0,
      end: 1,
      text: 'A',
      color: 'yellow',
    });
    expect(state.highlights['doc-surrogate'].items[1]).toMatchObject({
      start: 3,
      end: 4,
      text: 'B',
      color: 'yellow',
    });
  });

  it('RD04-R03: chain of splits creating long IDs (>100 chars) preserves DOM identity and delete-cluster target', () => {
    let state = reducer(initialState, setAttemptContext({ attemptId: 84, version: 1, savedAnswers: [] }));
    const context = { attemptId: 84, contextRevision: state.contextRevision };
    const docText = 'x'.repeat(200);
    const initialUuid = '12345678-1234-1234-1234-123456789abc';

    // 1. Initial highlight: [0, 200) yellow with 36-char UUID
    state = reducer(state, addHighlightRecord({
      ...context,
      passageId: 'doc-long-id',
      contentHash: 'hash-long',
      documentText: docText,
      highlight: { id: initialUuid, start: 0, end: 200, text: docText, color: 'yellow' },
    }));

    // 2. Perform 25 recolor operations: [1, 2), [3, 4), ..., [49, 50) recolored to blue
    for (let i = 0; i < 25; i++) {
      const start = 2 * i + 1;
      const end = 2 * i + 2;
      state = reducer(state, recolorHighlightSelection({
        ...context,
        passageId: 'doc-long-id',
        contentHash: 'hash-long',
        documentText: docText,
        highlight: { id: `blue-${i}`, start, end, text: 'x', color: 'blue' },
      }));
    }

    const items = state.highlights['doc-long-id'].items;
    // 25 blue clusters + 26 yellow clusters = 51 clusters total
    expect(items).toHaveLength(51);

    // The last yellow cluster has inherited multiple _r suffixes, making its ID > 100 characters
    const lastYellow = items[items.length - 1];
    expect(lastYellow.color).toBe('yellow');
    expect(lastYellow.id.length).toBeGreaterThan(100);

    // 3. Render highlights via applyHighlights
    const html = `<p>${docText}</p>`;
    const renderedHtml = applyHighlights(html, items);

    // Parse the rendered HTML into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedHtml, 'text/html');
    const marks = doc.querySelectorAll('mark[data-hl-id]');

    // Find the mark corresponding to the last yellow cluster (the last mark in DOM)
    const targetMark = marks[marks.length - 1];
    expect(targetMark).toBeDefined();

    // The DOM attribute data-hl-id must match the full store ID without truncation
    const domId = targetMark.getAttribute('data-hl-id');
    expect(domId).toBe(lastYellow.id);
    expect(domId!.length).toBe(lastYellow.id.length);
    expect(domId!.length).toBeGreaterThan(100);

    // 4. Dispatch delete action using the ID retrieved from the DOM attribute (like click handler)
    state = reducer(state, deleteHighlightCluster({
      ...context,
      passageId: 'doc-long-id',
      highlightId: domId!,
    }));

    // Exactly one cluster removed: beforeCount was 51, afterCount is 50
    const remainingItems = state.highlights['doc-long-id'].items;
    expect(remainingItems).toHaveLength(50);
    // The target cluster is completely removed
    expect(remainingItems.find((h) => h.id === lastYellow.id)).toBeUndefined();
    // All other 50 clusters remain intact
    for (let i = 0; i < 50; i++) {
      expect(remainingItems[i].id).toBe(items[i].id);
    }

    // 5. Verify round-trip storage with the remaining 50 clusters (some with length > 100)
    const archive = {
      schemaVersion: 2 as const,
      ownerId: 'user-r03',
      attemptId: 84,
      updatedAt: new Date().toISOString(),
      documents: [
        {
          partId: 1,
          documentId: 'doc-long-id',
          contentHash: 'hash-long',
          items: remainingItems,
        },
      ],
    };

    expect(writeHighlightArchive(archive)).toBe(true);
    const read = readHighlightArchive('user-r03', 84);
    expect(read.failed).toBe(false);
    expect(read.archive?.documents[0].items).toHaveLength(50);
    expect(read.archive?.documents[0].items[0].id).toBe(remainingItems[0].id);
    expect(read.archive?.documents[0].items[49].id).toBe(remainingItems[49].id);
  });
});
