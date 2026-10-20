import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import answerReducer, { addHighlightRecord, setAttemptContext } from '../store/answerSlice';
import authReducer from '../../auth/store/authSlice';
import { useHighlightPersistence } from '../hooks/useHighlightPersistence';
import { buildHighlightNamespace } from '../utils/highlightUtils';
import { highlightArchiveKey } from '../utils/highlightStorage';

describe('useHighlightPersistence', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('waits for validated workspace context, then restores and debounces scoped highlight writes without dirtying answers', async () => {
    const store = configureStore({ reducer: { answers: answerReducer, auth: authReducer } });
    store.dispatch(setAttemptContext({ attemptId: 41, version: 7, savedAnswers: [] }));
    localStorage.setItem(highlightArchiveKey('user-1', 41), JSON.stringify({
      schemaVersion: 1, ownerId: 'user-1', attemptId: 41, updatedAt: new Date().toISOString(),
      documents: [{ partId: 7, documentId: 'part', contentHash: 'hash-7', items: [{ id: 'restored', start: 0, end: 4, text: 'old' }] }],
    }));
    const documents = [{ partId: 7, documentId: 'part', contentHash: 'hash-7', text: 'read passage' }];
    const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>;
    const disabled = renderHook(() => useHighlightPersistence({
      ownerId: 'user-1', attemptId: 41, contextRevision: store.getState().answers.contextRevision,
      enabled: false, documents,
    }), { wrapper });
    expect(disabled.result.current.ready).toBe(false);
    disabled.unmount();

    const { result } = renderHook(() => useHighlightPersistence({
      ownerId: 'user-1', attemptId: 41, contextRevision: store.getState().answers.contextRevision,
      enabled: true, documents,
    }), { wrapper });
    expect(result.current.ready).toBe(true);
    const namespace = buildHighlightNamespace({ ownerId: 'user-1', attemptId: 41, partId: 7, groupId: 'part', contentHash: 'hash-7' });
    expect(store.getState().answers.highlights[namespace].items[0].text).toBe('read');
    expect(store.getState().answers).toMatchObject({ isDirty: false, pendingVersion: 0, version: 7 });

    act(() => store.dispatch(addHighlightRecord({
      attemptId: 41, contextRevision: store.getState().answers.contextRevision,
      passageId: namespace, contentHash: 'hash-7', documentText: 'read passage',
      highlight: { id: 'new', start: 5, end: 12, text: 'stale' },
    })));
    expect(localStorage.getItem(highlightArchiveKey('user-1', 41))).not.toContain('new');
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(localStorage.getItem(highlightArchiveKey('user-1', 41))).toContain('new');
    expect(store.getState().answers).toMatchObject({ isDirty: false, pendingVersion: 0, version: 7 });
  });

  it('flushes the previous passage before switching documents, even before the debounce expires', () => {
    const store = configureStore({ reducer: { answers: answerReducer, auth: authReducer } });
    store.dispatch(setAttemptContext({ attemptId: 42, version: 3, savedAnswers: [] }));
    const firstDoc = { partId: 7, documentId: 'group-a', contentHash: 'hash-a', text: 'first passage' };
    const secondDoc = { partId: 7, documentId: 'group-b', contentHash: 'hash-b', text: 'second passage' };
    const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}>{children}</Provider>;
    const { rerender } = renderHook(
      ({ docs }) => useHighlightPersistence({ ownerId: 'user-1', attemptId: 42, contextRevision: store.getState().answers.contextRevision, enabled: true, documents: docs }),
      { initialProps: { docs: [firstDoc] }, wrapper },
    );
    const namespace = buildHighlightNamespace({ ownerId: 'user-1', attemptId: 42, partId: 7, groupId: 'group-a', contentHash: 'hash-a' });
    act(() => store.dispatch(addHighlightRecord({
      attemptId: 42, contextRevision: store.getState().answers.contextRevision,
      passageId: namespace, contentHash: 'hash-a', documentText: firstDoc.text,
      highlight: { id: 'before-switch', start: 0, end: 5, text: 'first' },
    })));

    rerender({ docs: [secondDoc] });
    const archive = JSON.parse(localStorage.getItem(highlightArchiveKey('user-1', 42)) ?? 'null');
    expect(archive.documents).toContainEqual(expect.objectContaining({
      partId: 7, documentId: 'group-a', contentHash: 'hash-a',
      items: [expect.objectContaining({ id: 'before-switch', start: 0, end: 5 })],
    }));
  });
});
