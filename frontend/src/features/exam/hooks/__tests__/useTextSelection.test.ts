import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '../useTextSelection';

describe('useTextSelection', () => {
  it('returns null selection initially or when disabled', () => {
    const container = document.createElement('div');
    const containerRef = { current: container };

    const { result } = renderHook(() => useTextSelection(containerRef, false));
    expect(result.current.selection).toBeNull();
  });

  it('captures immutable document offsets and identity when a scoped selection is made', async () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    container.innerHTML = '<div data-highlight-scope="group-7" data-highlight-hash="hash-7">Read <b>this passage</b>.</div>';
    document.body.appendChild(container);
    const range = document.createRange();
    const scope = container.firstElementChild!;
    const boldText = scope.querySelector('b')!.firstChild!;
    range.setStart(boldText, 0);
    range.setEnd(boldText, 4);
    Object.defineProperty(range, 'getBoundingClientRect', {
      value: () => ({ top: 10, bottom: 20, left: 30, right: 80, width: 50, height: 10 }),
    });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const ref = { current: container };

    const { result, unmount, rerender } = renderHook(
      ({ revision, key }) => useTextSelection(ref, true, revision, key),
      { initialProps: { revision: 12, key: 'attempt-1:part-7' } },
    );
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
      vi.advanceTimersByTime(100);
    });

    expect(result.current.selection).toMatchObject({
      text: 'this', start: 5, end: 9, scopeId: 'group-7', contentHash: 'hash-7', contextRevision: 12,
      contextKey: 'attempt-1:part-7',
    });
    rerender({ revision: 12, key: 'attempt-1:part-8' });
    expect(result.current.selection).toBeNull();
    unmount();
    container.remove();
    vi.useRealTimers();
  });

  it('clips a selection that enters one document from outside, but rejects selections spanning documents', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    container.innerHTML = '<p>prompt</p><div data-highlight-scope="g1" data-highlight-hash="h1">passage</div><div data-highlight-scope="g2" data-highlight-hash="h2">other</div>';
    document.body.appendChild(container);
    const outside = container.querySelector('p')!.firstChild!;
    const g1 = container.querySelector('[data-highlight-scope="g1"]')!.firstChild!;
    const g2 = container.querySelector('[data-highlight-scope="g2"]')!.firstChild!;
    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(g1, 7);
    Object.defineProperty(range, 'getBoundingClientRect', { value: () => ({ top: 1, bottom: 2, left: 1, right: 2, width: 1, height: 1 }) });
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    const ref = { current: container };
    const { result, unmount } = renderHook(() => useTextSelection(ref, true, 1));
    act(() => { document.dispatchEvent(new Event('selectionchange')); vi.advanceTimersByTime(100); });
    expect(result.current.selection).toMatchObject({ text: 'passage', start: 0, end: 7, documentId: 'g1' });

    const cross = document.createRange();
    cross.setStart(g1, 0); cross.setEnd(g2, 2);
    selection.removeAllRanges(); selection.addRange(cross);
    act(() => { document.dispatchEvent(new Event('selectionchange')); vi.advanceTimersByTime(100); });
    expect(result.current.selection).toBeNull();
    unmount(); container.remove(); vi.useRealTimers();
  });
});
