import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAttemptContext } from '../store/answerSlice';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { usePracticeDictionary } from '../hooks/usePracticeDictionary';
import { initialState } from '../store/answerSlice';
import type { WorkspaceResponse } from '../types/api.types';
import type { SelectionState } from '../hooks/useTextSelection';
import { getWorkspace } from '../api/attemptApi';
import { DICTIONARY_LOOKUP_TIMEOUT_MS } from '../api/dictionaryLookupApi';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const post = vi.mocked(axiosClient.post);

function workspace(attemptId = 42, mode: 'PRACTICE' | 'MOCK_TEST' = 'PRACTICE', sourceLanguage = 'en'): WorkspaceResponse {
  return {
    attempt_id: attemptId, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: mode,
    startTime: '2026-10-13T07:00:00Z', serverTime: '2026-10-13T07:00:00Z', deadline: null,
    gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [], serverTimeOffset: 0,
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: sourceLanguage, defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es'] },
    exam_snapshot: { exam_id: 1, code: 'T', title: 'T', type: 'IELTS', examLanguage: sourceLanguage, sections: [{ id: 3, skill_type: 'READING', title: 'Reading', duration_minutes: 60, parts: [{ id: 7, question_groups: [{ group_id: 'g1', instruction: null, context_html: sourceLanguage === 'ja' ? '水は大切です。' : 'The elms grow.', shared_audio: null, shared_media: null, questions: [] }], questions: [] }] }] },
  };
}
const selected: SelectionState = {
  rect: new DOMRect(1, 1, 20, 10), text: 'elms', start: 4, end: 8,
  documentId: 'g1', contentHash: 'h1', contextRevision: 1, contextKey: '42:1', scopeId: 'g1', scopeText: 'The elms grow.',
};
function envelope(body: any, sourceLanguage = 'en') {
  const { contextText: _contextText, ...response } = body;
  return { success: true, data: { requestId: response.requestId, attemptId: 42, partId: 7, documentId: 'g1', selectedText: response.selectedText, sourceContext: sourceLanguage === 'ja' ? '水は大切です。' : 'The elms grow.', definition: { schemaVersion: 2, learningLanguage: sourceLanguage, meaningLanguage: response.meaningLanguage ?? 'vi', meaning: 'nghĩa', phonetic: null, partOfSpeech: null, example: sourceLanguage === 'ja' ? '水は大切です。' : 'Elms grow.', exampleTranslation: 'Nghĩa ví dụ.' } } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

describe('usePracticeDictionary', () => {
  it('cancels the previous language intent for the same selection and ignores its late response', async () => {
    const pending = deferred<any>();
    post.mockReturnValueOnce(pending.promise as never).mockImplementationOnce(async (_url, payload) => envelope(payload) as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    act(() => { void hook.result.current.lookup(selected, 'vi'); });
    await act(async () => { await hook.result.current.lookup(selected, 'fr'); });
    expect(post).toHaveBeenCalledTimes(2);
    expect((post.mock.calls[0][2]!.signal as AbortSignal).aborted).toBe(true);
    pending.resolve(envelope(post.mock.calls[0][1]));
    await act(async () => { await Promise.resolve(); });
    expect(hook.result.current.data?.definition.meaningLanguage).toBe('fr');
  });
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('posts once for the selected snapshot and publishes the normalized result', async () => {
    post.mockImplementation(async (_url, payload) => {
      expect(payload).toMatchObject({ partId: 7, documentId: 'g1', selectedText: 'elms' });
      const result = envelope(payload);
      return result as never;
    });
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => hook.result.current.lookup(selected));
    expect(post).toHaveBeenCalledTimes(1);
    expect(hook.result.current.phase, hook.result.current.error?.message).toBe('ready');
    expect(hook.result.current.data?.definition.meaning).toBe('nghĩa');
    expect(hook.result.current.phase).toBe('ready');
  });

  it.each(['snake', 'camel', 'database'] as const)('looks up a %s wire snapshot through the real workspace normalizer', async (format) => {
    const ws = workspace();
    const wire = {
      ...ws,
      exam_snapshot: { ...ws.exam_snapshot, sections: [{
        ...(format === 'database' ? { id: 3, name: 'READING' }
          : format === 'snake' ? { section_id: 3, skill_type: 'READING' } : { sectionId: 3, skill_type: 'READING' }),
        parts: [{
          ...(format === 'database' ? { id: 7 } : format === 'snake' ? { part_id: 7 } : { partId: 7 }),
          question_groups: ws.exam_snapshot.sections[0].parts[0].question_groups,
        }],
      }] },
    };
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ success: true, data: wire } as never);
    const normalized = await getWorkspace(42);
    post.mockImplementation(async (_url, payload) => envelope(payload) as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: normalized, partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => hook.result.current.lookup(selected));
    expect(hook.result.current.phase).toBe('ready');
    expect(hook.result.current.data?.definition.meaning).toBe('nghĩa');

    normalized.lockedSections = [3];
    await act(async () => hook.result.current.lookup(selected));
    expect(post).toHaveBeenCalledTimes(1);
    expect(hook.result.current.phase).toBe('error');
    expect(hook.result.current.data).toBeNull();
  });

  it('shows a context error rather than idle when a selected document is rejected before dispatch', async () => {
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => hook.result.current.lookup({ ...selected, documentId: 'missing' }));
    expect(post).not.toHaveBeenCalled();
    expect(hook.result.current.phase).toBe('error');
    expect(hook.result.current.error?.retryable).toBe(false);
  });

  it('leaves loading at the deadline when the HTTP transport never settles', async () => {
    vi.useFakeTimers();
    post.mockReturnValueOnce(new Promise(() => {}) as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    let request!: Promise<void>;
    act(() => { request = hook.result.current.lookup(selected); });
    expect(hook.result.current.phase).toBe('loading');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DICTIONARY_LOOKUP_TIMEOUT_MS);
      await request;
    });
    expect(hook.result.current.phase).toBe('error');
    expect(hook.result.current.error?.retryable).toBe(true);
  });

  it('keeps one in-flight request for a repeated selection and does not change answer state', async () => {
    const pending = deferred<any>();
    post.mockReturnValueOnce(pending.promise as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    act(() => { void hook.result.current.lookup(selected); void hook.result.current.lookup(selected); });
    expect(post).toHaveBeenCalledTimes(1);
    expect(store.getState().answers.isDirty).toBe(false);
    pending.resolve(envelope(post.mock.calls[0][1]));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.data?.definition.meaning).toBe('nghĩa');
  });

  it('does not call the API in Mock and invalidates a late response after context change', async () => {
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook((props: { ws: WorkspaceResponse }) => usePracticeDictionary({ workspace: props.ws, partId: 7, ownerId: 21, isLocked: () => false }), {
      initialProps: { ws: workspace(42, 'MOCK_TEST') }, wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => hook.result.current.lookup(selected));
    expect(post).not.toHaveBeenCalled();
  });

  it('does not call the API when the Reading section is locked or context cannot be verified', async () => {
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const locked = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => true }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => locked.result.current.lookup(selected));
    const ready = renderHook(() => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => ready.result.current.lookup({ ...selected, documentId: 'unknown-group' }));
    expect(post).not.toHaveBeenCalled();
  });

  it('supports a one-character Japanese lookup and permits explanation in the same language', async () => {
    const japanese: SelectionState = { ...selected, text: '水', start: 0, end: 1, scopeText: '水は大切です。' };
    post.mockImplementationOnce(async (_url, payload) => envelope(payload, 'ja') as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook(() => usePracticeDictionary({ workspace: workspace(42, 'PRACTICE', 'ja'), partId: 7, ownerId: 21, isLocked: () => false }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    await act(async () => hook.result.current.lookup(japanese, 'ja'));
    expect(post).toHaveBeenCalledWith('/v2/attempts/42/dictionary-lookups', expect.objectContaining({ selectedText: '水', meaningLanguage: 'ja' }), expect.any(Object));
    expect(hook.result.current.data?.definition).toMatchObject({ learningLanguage: 'ja', meaningLanguage: 'ja' });
  });

  it('invalidates a late result when the signed-in owner changes', async () => {
    const pending = deferred<any>();
    post.mockReturnValueOnce(pending.promise as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook((props: { ownerId: number }) => usePracticeDictionary({ workspace: workspace(), partId: 7, ownerId: props.ownerId, isLocked: () => false }), {
      initialProps: { ownerId: 21 }, wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    act(() => { void hook.result.current.lookup(selected); });
    hook.rerender({ ownerId: 22 });
    expect(hook.result.current.phase).toBe('idle');
    pending.resolve(envelope(post.mock.calls[0][1]));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.data).toBeNull();
  });

  it('ignores a response that settles after attempt hydration changes', async () => {
    const pending = deferred<any>();
    post.mockReturnValueOnce(pending.promise as never);
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1 } });
    const hook = renderHook((props: { ws: WorkspaceResponse }) => usePracticeDictionary({ workspace: props.ws, partId: 7, ownerId: 21, isLocked: () => false }), {
      initialProps: { ws: workspace() }, wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });
    act(() => { void hook.result.current.lookup(selected); });
    expect(hook.result.current.phase).toBe('loading');
    act(() => { store.dispatch(setAttemptContext({ attemptId: 42, version: 9, savedAnswers: [] })); });
    expect(hook.result.current.phase).toBe('idle');
    pending.resolve(envelope(post.mock.calls[0][1]));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(hook.result.current.data).toBeNull();
    expect(store.getState().answers.isDirty).toBe(false);
  });
});
