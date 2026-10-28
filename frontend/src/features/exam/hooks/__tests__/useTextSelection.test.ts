import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '../useTextSelection';

describe('useTextSelection', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  function pointer(target: EventTarget, type: string, pointerType = 'mouse', button = 0, pointerId = 1) {
    const event = new MouseEvent(type, { bubbles: true, button });
    Object.defineProperties(event, {
      pointerType: { value: pointerType }, pointerId: { value: pointerId }, isPrimary: { value: true },
    });
    target.dispatchEvent(event);
  }

  function gestureFixture() {
    const container = document.createElement('div');
    container.innerHTML = '<div data-highlight-scope="g1" data-highlight-hash="h1">Before <b>chosen words</b> after</div><div data-highlight-scope="g2" data-highlight-hash="h2">Other document</div>';
    document.body.appendChild(container);
    const text = container.querySelector('b')!.firstChild!;
    function select(start = 0, end = 6, endNode: Node = text) {
      const range = document.createRange();
      range.setStart(text, start); range.setEnd(endNode, end);
      Object.defineProperty(range, 'getBoundingClientRect', { value: () => new DOMRect(10, 10, 50, 20) });
      window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    }
    return { container, text, select };
  }

  it.each([100, 1000, 2000, 5000])('commits only the final selection on primary mouse release after %ims', (hold) => {
    vi.useFakeTimers();
    const { container, text, select } = gestureFixture();
    const ref = { current: container };
    const commit = vi.fn(() => true);
    const { result, unmount } = renderHook(() => useTextSelection(ref, true, 4, 'owner:1:g1', { onPointerCommit: commit }));
    act(() => { pointer(text, 'pointerdown'); select(); vi.advanceTimersByTime(hold); });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.selection).toBeNull();
    act(() => { select(7, 12); pointer(text, 'pointerup'); });
    expect(commit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      text: 'words', start: 14, end: 19, documentId: 'g1', contentHash: 'h1', contextRevision: 4, contextKey: 'owner:1:g1',
    }));
    expect(result.current.interaction).toBe('pointer-committed');
    // Clearing native selection and compatibility events cannot discard the AI snapshot or commit twice.
    act(() => {
      window.getSelection()!.removeAllRanges(); document.dispatchEvent(new Event('selectionchange'));
      document.dispatchEvent(new MouseEvent('mouseup')); vi.advanceTimersByTime(200);
    });
    expect(result.current.selection?.text).toBe('words');
    expect(commit).toHaveBeenCalledTimes(1);
    unmount(); container.remove();
  });

  it.each(['pointercancel', 'escape', 'blur', 'hidden', 'context', 'disabled'])('does not commit after %s cancels a gesture', (reason) => {
    vi.useFakeTimers();
    const { container, text, select } = gestureFixture();
    const ref = { current: container };
    const commit = vi.fn(() => true);
    const { rerender, unmount } = renderHook(({ key, enabled }) => useTextSelection(ref, enabled, 4, key, { onPointerCommit: commit }), {
      initialProps: { key: 'A', enabled: true },
    });
    act(() => { pointer(text, 'pointerdown'); select(); });
    act(() => {
      if (reason === 'pointercancel') pointer(text, 'pointercancel');
      if (reason === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'hidden') {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    if (reason === 'context') rerender({ key: 'B', enabled: true });
    if (reason === 'disabled') rerender({ key: 'A', enabled: false });
    act(() => { pointer(text, 'pointerup'); document.dispatchEvent(new MouseEvent('mouseup')); vi.advanceTimersByTime(200); });
    expect(commit).not.toHaveBeenCalled();
    vi.restoreAllMocks(); unmount(); container.remove();
  });

  it('rejects cross-document release, changed hash and gestures starting outside the passage', () => {
    const { container, text, select } = gestureFixture();
    const ref = { current: container };
    const commit = vi.fn(() => true);
    const { unmount } = renderHook(() => useTextSelection(ref, true, 1, 'A', { onPointerCommit: commit }));
    act(() => { pointer(text, 'pointerdown'); select(0, 5, container.lastElementChild!.firstChild!); pointer(text, 'pointerup'); });
    act(() => { pointer(text, 'pointerdown'); select(); container.firstElementChild!.setAttribute('data-highlight-hash', 'changed'); pointer(text, 'pointerup'); });
    act(() => { pointer(container, 'pointerdown'); select(); pointer(text, 'pointerup'); });
    expect(commit).not.toHaveBeenCalled(); unmount(); container.remove();
  });

  it.each(['touch', 'pen'])('keeps %s selection manual without automatic commits', (kind) => {
    vi.useFakeTimers();
    const { container, text, select } = gestureFixture();
    const ref = { current: container };
    const commit = vi.fn(() => true);
    const { result, unmount } = renderHook(() => useTextSelection(ref, true, 1, 'A', { onPointerCommit: commit }));
    act(() => { pointer(text, 'pointerdown', kind); select(); pointer(text, 'pointerup', kind); document.dispatchEvent(new MouseEvent('mouseup')); vi.advanceTimersByTime(200); });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.selection?.text).toBe('chosen');
    expect(result.current.interaction).toBe('manual'); unmount(); container.remove();
  });

  it('allows autoscroll during a drag and consumes only its trailing pointer click', () => {
    const { container, text, select } = gestureFixture();
    const ref = { current: container };
    const commit = vi.fn(() => true);
    const { result, unmount } = renderHook(() => useTextSelection(ref, true, 1, 'A', { onPointerCommit: commit }));
    act(() => { pointer(text, 'pointerdown'); select(); window.dispatchEvent(new Event('scroll')); pointer(text, 'pointerup'); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.consumeCommittedClick(new MouseEvent('click', { detail: 0 }))).toBe(false);
    expect(result.current.consumeCommittedClick(new MouseEvent('click', { detail: 1 }))).toBe(true);
    expect(result.current.consumeCommittedClick(new MouseEvent('click', { detail: 1 }))).toBe(false);
    act(() => { pointer(text, 'pointerdown'); select(); pointer(text, 'pointerup'); });
    act(() => pointer(text, 'pointerdown'));
    expect(result.current.consumeCommittedClick(new MouseEvent('click', { detail: 1 }))).toBe(false);
    unmount(); container.remove();
  });
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
