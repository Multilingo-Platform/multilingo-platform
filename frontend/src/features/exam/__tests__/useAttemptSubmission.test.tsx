import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { initialState, setAnswer, setAttemptContext } from '../store/answerSlice';
import { useAutosave } from '../hooks/useAutosave';
import { useAttemptSubmission } from '../hooks/useAttemptSubmission';
import { autosaveAnswers, submitAttempt } from '../api/attemptApi';
import type { WorkspaceResponse } from '../types/api.types';

vi.mock('../api/attemptApi', () => ({ autosaveAnswers: vi.fn(), submitAttempt: vi.fn() }));
const receipt = { attempt_id: 42, status: 'COMPLETED' as const, redirect_url: '/attempts/42/result' };
const workspace: WorkspaceResponse = {
  attempt_id: 42, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: 'PRACTICE',
  startTime: '2026-10-10T00:00:00Z', serverTime: '2026-10-10T00:00:00Z', deadline: null,
  gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [], serverTimeOffset: 0,
  exam_snapshot: { exam_id: 1, code: 'T', type: 'IELTS', title: 'Exam', sections: [] },
};
function setup(data = workspace) {
  const store = createTestStore({ answers: { ...initialState, attemptId: 42, version: 7, isDirty: true, pendingVersion: 1, answers: { 10: { essay: '  Bài viết B  ', clear: null } } } });
  const hook = renderHook(({ data }) => {
    const autosave = useAutosave(data?.attempt_id ?? null, data ?? undefined);
    return useAttemptSubmission(data, autosave);
  }, { initialProps: { data: data as WorkspaceResponse | null }, wrapper: ({ children }) => <Provider store={store}>{children}</Provider> });
  return { ...hook, store };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks(); localStorage.clear();
  vi.mocked(submitAttempt).mockResolvedValue(receipt);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useAttemptSubmission', () => {
  it('posts full finalAnswers without an extra PUT and keeps the backup after success', async () => {
    const { result } = setup();
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(autosaveAnswers).not.toHaveBeenCalled();
    expect(submitAttempt).toHaveBeenCalledWith(42, {
      reason: 'MANUAL', baseVersion: 7, finalAnswers: [{ part_id: 10, answers: [
        { question_id: 'essay', answer: '  Bài viết B  ' }, { question_id: 'clear', answer: null },
      ] }],
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.result).toEqual(receipt);
    expect(result.current.isLocked()).toBe(true);
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });
  it('waits for current PUT, blocks duplicate submit and captures latest answers/version afterward', async () => {
    let resolve!: (value: { version: number }) => void;
    vi.mocked(autosaveAnswers).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, store } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    act(() => { store.dispatch(setAnswer({ partId: 10, questionId: 'essay', value: 'C' })); });
    let submission!: Promise<void>;
    act(() => { submission = result.current.submit('MANUAL'); void result.current.submit('TIMEOUT_CLIENT'); });
    expect(result.current.isLocked()).toBe(true);
    expect(submitAttempt).not.toHaveBeenCalled();
    await act(async () => { resolve({ version: 8 }); await submission; });
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(autosaveAnswers).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitAttempt).mock.calls[0][1]).toEqual({ reason: 'MANUAL', baseVersion: 8, finalAnswers: [{ part_id: 10, answers: [
      { question_id: 'essay', answer: 'C' }, { question_id: 'clear', answer: null },
    ] }] });
  });
  it('can submit full answers after a non-conflict pending PUT failure', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(autosaveAnswers).mockReturnValueOnce(new Promise((_, r) => { reject = r; }));
    const { result } = setup();
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    let pending!: Promise<void>;
    act(() => { pending = result.current.submit('MANUAL'); });
    await act(async () => { reject(new Error('offline')); await pending; });
    expect(vi.mocked(submitAttempt).mock.calls[0][1].baseVersion).toBe(7);
    expect(result.current.phase).toBe('succeeded');
  });
  it('keeps errors and draft, unlocks manual editing and does not produce result', async () => {
    vi.mocked(submitAttempt).mockRejectedValueOnce(new Error('offline'));
    const { result } = setup();
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(result.current.phase).toBe('error');
    expect(result.current.result).toBeNull();
    expect(result.current.isLocked()).toBe(false);
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });
  it.each([401, 403])('does not produce a result from HTTP %s', async status => {
    vi.mocked(submitAttempt).mockRejectedValueOnce({ response: { status } });
    const { result } = setup();
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(result.current.phase).toBe('error');
    expect(result.current.result).toBeNull();
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });
  it('keeps TIMEOUT_CLIENT on explicit retry and never creates a result from a 409', async () => {
    vi.mocked(submitAttempt).mockRejectedValueOnce({ response: { status: 409, data: { code: 409 } } });
    const { result } = setup({ ...workspace, test_mode: 'MOCK_TEST', deadline: new Date(Date.now() - 1).toISOString() });
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(result.current.result).toBeNull();
    expect(result.current.isLocked()).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(vi.mocked(submitAttempt).mock.calls.map(call => call[1].reason)).toEqual(['TIMEOUT_CLIENT', 'TIMEOUT_CLIENT']);
    expect(result.current.result).toEqual(receipt);
  });
  it('marks version conflict and refuses further POST until authoritative hydration', async () => {
    vi.mocked(submitAttempt).mockRejectedValueOnce({ response: { status: 409, data: { code: 1601 } } });
    const { result, store } = setup();
    await act(async () => { await result.current.submit('MANUAL'); await result.current.retry(); });
    expect(store.getState().answers.saveStatus).toBe('conflict');
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(result.current.result).toBeNull();
  });
  it('does not accept an old POST completion after same-attempt hydration', async () => {
    let resolve!: (value: typeof receipt) => void;
    vi.mocked(submitAttempt).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, store } = setup();
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.submit('MANUAL'); });
    const signal = vi.mocked(submitAttempt).mock.calls[0][2]!.signal!;
    act(() => { store.dispatch(setAttemptContext({ attemptId: 42, version: 20, savedAnswers: [] })); });
    await act(async () => { resolve(receipt); await pending; });
    expect(signal.aborted).toBe(true);
    expect(result.current.result).toBeNull();
    expect(result.current.phase).toBe('idle');
    expect(result.current.isLocked()).toBe(false);
  });
  it('warns on storage failure but still sends finalAnswers', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = setup();
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(result.current.draftWarning).toBeTruthy();
    expect(result.current.phase).toBe('succeeded');
    expect(submitAttempt).toHaveBeenCalledTimes(1);
  });
  it('does not POST when the route has no active matching workspace', async () => {
    const { result, rerender } = setup();
    rerender({ data: null });
    await act(async () => { await result.current.submit('MANUAL'); });
    expect(submitAttempt).not.toHaveBeenCalled();
  });
});
