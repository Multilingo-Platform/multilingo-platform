import { useMemo } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import answerReducer, { addHighlightRecord, removeHighlightRecord, setAttemptContext } from '../store/answerSlice';
import { useReadingHighlights } from '../hooks/useReadingHighlights';
import ReferencePane from '../components/workspace/ReferencePane';
import { highlightArchiveKey } from '../utils/highlightStorage';
import type { RootState } from '../../../app/store';

const ownerId = 'contract-owner';
const attemptId = 81;
const partId = 7;
const source = '<p>Reading passage for a local highlight contract.</p>';

function Harness() {
  const dispatch = useDispatch();
  const answerState = useSelector((state: RootState) => state.answers);
  const docs = useMemo(() => [{ groupId: 'group-1', instruction: null, html: source, mediaUrls: [] }], []);
  const highlight = useReadingHighlights({
    ownerId, attemptId, partId, contextRevision: answerState.contextRevision,
    enabled: true, partHtml: '', referenceDocs: docs, useReferenceDocs: true,
  });
  const doc = highlight.documents[0];
  const namespace = doc ? highlight.namespaceFor(doc.documentId, doc.contentHash) : null;
  return (
    <>
      <ReferencePane docs={highlight.renderedReferences} testId="contract-reference" />
      <button type="button" onClick={() => {
        if (!doc || !namespace) return;
        dispatch(addHighlightRecord({
          attemptId, contextRevision: answerState.contextRevision, passageId: namespace,
          contentHash: doc.contentHash, documentText: doc.text,
          highlight: { id: 'contract-highlight', start: 0, end: 7, text: 'stale text' },
        }));
      }}>Create highlight</button>
      <button type="button" onClick={() => {
        if (namespace) dispatch(removeHighlightRecord({
          attemptId, contextRevision: answerState.contextRevision,
          passageId: namespace, highlightId: 'contract-highlight',
        }));
      }}>Delete highlight</button>
      <output data-testid="answer-state">{JSON.stringify({
        dirty: answerState.isDirty, version: answerState.version,
        pendingVersion: answerState.pendingVersion,
      })}</output>
    </>
  );
}

function makeStore() {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: ownerId } }) => state,
      answers: answerReducer,
    },
  });
  store.dispatch(setAttemptContext({ attemptId, version: 9, savedAnswers: [] }));
  return store;
}

describe('Reading highlight contract', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('creates, persists, restores and deletes a passage mark without changing answer state', async () => {
    const firstStore = makeStore();
    const first = render(<Provider store={firstStore}><Harness /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Create highlight' }));
    expect(screen.getByTestId('contract-reference').querySelector('mark')?.textContent).toBe('Reading');
    expect(JSON.parse(screen.getByTestId('answer-state').textContent ?? '{}')).toEqual({
      dirty: false, version: 9, pendingVersion: 0,
    });
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(localStorage.getItem(highlightArchiveKey(ownerId, attemptId))).toContain('contract-highlight');
    first.unmount();

    const secondStore = makeStore();
    const second = render(<Provider store={secondStore}><Harness /></Provider>);
    expect(screen.getByTestId('contract-reference').querySelector('mark')?.textContent).toBe('Reading');
    expect(JSON.parse(screen.getByTestId('answer-state').textContent ?? '{}')).toEqual({
      dirty: false, version: 9, pendingVersion: 0,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete highlight' }));
    expect(screen.getByTestId('contract-reference').querySelector('mark')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(JSON.parse(localStorage.getItem(highlightArchiveKey(ownerId, attemptId)) ?? 'null').documents).toEqual([]);
    second.unmount();
  });
});
