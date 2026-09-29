import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import answerReducer from '../store/answerSlice';
import useWorkspace from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';
import type { WorkspaceResponse } from '../types/api.types';

function makeWrapper() {
  const store = configureStore({ reducer: { answers: answerReducer } });
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

const mockWorkspace: WorkspaceResponse = {
  attempt_id: 5,
  status: 'IN_PROGRESS',
  test_scope: 'FULL_EXAM',
  test_mode: 'MOCK_TEST',
  deadline: null,
  exam_snapshot: { exam_id: 1, code: 'IE01', title: 'IELTS Mock', type: 'IELTS', sections: [] },
  version: 1,
  saved_answers: [],
};

describe('useWorkspace', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('TC_WS_ROUTE_01: starts loading, then returns workspace', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValueOnce(mockWorkspace);
    const { result } = renderHook(() => useWorkspace(5), { wrapper: makeWrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspace).toEqual(mockWorkspace);
    expect(result.current.error).toBeNull();
  });

  it('TC_WS_ROUTE_03: sets error on 404', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockRejectedValueOnce(new Error('Attempt not found'));
    const { result } = renderHook(() => useWorkspace(999), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Attempt not found');
    expect(result.current.workspace).toBeNull();
  });

  it('retry re-fetches workspace', async () => {
    const spy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockWorkspace);
    const { result } = renderHook(() => useWorkspace(5), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    // Wrap retry in act to flush subsequent state updates
    await act(async () => { result.current.retry(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspace).toEqual(mockWorkspace);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('REGRESSION: retry does not dispatch clearAnswers during re-fetch cycle', async () => {
    // If clearAnswers fires on retry, Redux answers are wiped mid-flight.
    // This verifies that attemptId in store remains set after retry resolves.
    vi.spyOn(attemptApi, 'getWorkspace')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockWorkspace);
    const store = configureStore({ reducer: { answers: answerReducer } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(() => useWorkspace(5), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.retry(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // After retry succeeds, Redux should be hydrated (attemptId set, not null from clearAnswers)
    expect(store.getState().answers.attemptId).toBe(5);
  });
});
