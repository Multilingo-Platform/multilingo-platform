import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, {
  setAttemptContext,
  setAnswer,
  clearAnswers,
  selectAnswer,
  selectAnsweredQuestionIds,
} from '../store/answerSlice';

function makeStore() {
  return configureStore({ reducer: { answers: answerReducer } });
}

describe('answerSlice', () => {
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
});
