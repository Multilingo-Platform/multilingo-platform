import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { initialState } from '../store/answerSlice';
import { usePracticeRetry } from '../hooks/usePracticeRetry';

function setupHook(initialProps?: {
  contextKey?: string | number | null;
  partId?: number | null;
}) {
  const store = createTestStore({
    answers: {
      ...initialState,
      attemptId: 42,
      contextRevision: 1,
      version: 7,
      answers: {
        10: {
          q1: 'A',
          q2: 'B',
        },
      },
    },
  });

  const hook = renderHook(
    (props: { contextKey: string | number | null; partId: number | null }) =>
      usePracticeRetry(props.contextKey, props.partId),
    {
      initialProps: {
        contextKey: initialProps?.contextKey !== undefined ? initialProps.contextKey : 'attempt-42-rev-1',
        partId: initialProps?.partId !== undefined ? initialProps.partId : 10,
      },
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    }
  );

  return { ...hook, store };
}

describe('TV3-16-03 usePracticeRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with active=false and questionIds=[]', () => {
    const { result } = setupHook();
    expect(result.current.active).toBe(false);
    expect(result.current.questionIds).toEqual([]);
  });

  it('activates retry and stores fixed snapshot when start is called with non-empty list', () => {
    const { result } = setupHook();

    act(() => {
      result.current.start(['q1', 'q3']);
    });

    expect(result.current.active).toBe(true);
    expect(result.current.questionIds).toEqual(['q1', 'q3']);
  });

  it('does NOT activate retry when start is called with empty list', () => {
    const { result } = setupHook();

    act(() => {
      result.current.start([]);
    });

    expect(result.current.active).toBe(false);
    expect(result.current.questionIds).toEqual([]);
  });

  it('turns off retry on stop() without mutating Redux answers', () => {
    const { result, store } = setupHook();

    act(() => {
      result.current.start(['q1', 'q2']);
    });
    expect(result.current.active).toBe(true);

    const answersBefore = { ...store.getState().answers.answers[10] };

    act(() => {
      result.current.stop();
    });

    expect(result.current.active).toBe(false);
    expect(result.current.questionIds).toEqual([]);
    // Redux answers are untouched
    expect(store.getState().answers.answers[10]).toEqual(answersBefore);
  });

  it('ends retry round synchronously when partId changes', () => {
    const { result, rerender } = setupHook({
      contextKey: 'attempt-42',
      partId: 10,
    });

    act(() => {
      result.current.start(['q1', 'q2']);
    });
    expect(result.current.active).toBe(true);

    // Switch part from 10 to 20
    rerender({
      contextKey: 'attempt-42',
      partId: 20,
    });

    // Must be deactivated immediately
    expect(result.current.active).toBe(false);
    expect(result.current.questionIds).toEqual([]);
  });

  it('ends retry round synchronously when contextKey changes (e.g. rehydrate or attempt switch)', () => {
    const { result, rerender } = setupHook({
      contextKey: 'attempt-42-rev-1',
      partId: 10,
    });

    act(() => {
      result.current.start(['q1']);
    });
    expect(result.current.active).toBe(true);

    // Context changes (e.g. rehydrate or new revision)
    rerender({
      contextKey: 'attempt-42-rev-2',
      partId: 10,
    });

    // Must be deactivated immediately
    expect(result.current.active).toBe(false);
    expect(result.current.questionIds).toEqual([]);
  });

  it('retains fixed snapshot even if external array passed to start is modified', () => {
    const { result } = setupHook();
    const ids = ['q1', 'q2'];

    act(() => {
      result.current.start(ids);
    });

    ids.push('q3'); // mutate original array

    expect(result.current.questionIds).toEqual(['q1', 'q2']);
  });
});
