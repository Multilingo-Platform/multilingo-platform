import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureSelectionSnapshot } from '../selectionSnapshot';

const rectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
beforeEach(() => Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
  configurable: true, value: () => new DOMRect(20, 20, 100, 20),
}));
afterEach(() => {
  window.getSelection()?.removeAllRanges(); document.body.replaceChildren();
  if (rectDescriptor) Object.defineProperty(Range.prototype, 'getBoundingClientRect', rectDescriptor);
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

function setup(html: string) {
  const container = document.createElement('div'); container.innerHTML = html; document.body.appendChild(container);
  return container;
}
function select(start: Node, startOffset: number, end: Node, endOffset: number) {
  const range = document.createRange(); range.setStart(start, startOffset); range.setEnd(end, endOffset);
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
}

describe('selection snapshots', () => {
  it('captures trimmed UTF-16 offsets through formatting, entity and combining characters without mutating the live range', () => {
    const container = setup('<div data-highlight-scope="part" data-highlight-hash="h"><p>前😀 <b> e\u0301 &amp; word </b>終</p></div>');
    const text = container.querySelector('b')!.firstChild!;
    select(text, 0, text, text.textContent!.length);
    const live = window.getSelection()!.getRangeAt(0);
    const snapshot = captureSelectionSnapshot(container, 2, 'A', container.firstElementChild as HTMLElement);
    expect(snapshot).toMatchObject({ start: 5, end: 14, text: 'e\u0301 & word', scopeText: '前😀  e\u0301 & word 終', documentId: 'part', contextKey: 'A' });
    expect(live.startContainer).toBe(text); expect(live.startOffset).toBe(0);
    // A frozen payload remains useful after its selected DOM is replaced by marks.
    container.innerHTML = '';
    expect(snapshot?.text).toBe('e\u0301 & word');
  });

  it('supports element boundaries and backwards browser selection', () => {
    const container = setup('<div data-highlight-scope="g1"><p>First <b>last</b></p></div>');
    const scope = container.firstElementChild!;
    select(scope, 0, scope, 1);
    expect(captureSelectionSnapshot(container, 0, 'A', scope as HTMLElement)?.text).toBe('First last');
    const text = container.querySelector('b')!.firstChild!;
    const sel = window.getSelection()!;
    sel.setBaseAndExtent(text, 4, text, 0);
    expect(captureSelectionSnapshot(container, 0, 'A', scope as HTMLElement)).toMatchObject({ text: 'last', start: 6, end: 10 });
  });

  it('clips only manual selection, and refuses automatic clipping or crossing documents', () => {
    const container = setup('<p>instruction</p><div data-highlight-scope="g1">passage</div><div data-highlight-scope="g2">other</div>');
    const scope = container.children[1] as HTMLElement;
    select(container.firstElementChild!.firstChild!, 0, scope.firstChild!, 4);
    expect(captureSelectionSnapshot(container, 0, 'A')?.text).toBe('pass');
    expect(captureSelectionSnapshot(container, 0, 'A', scope)).toBeNull();
    select(scope.firstChild!, 0, container.lastElementChild!.firstChild!, 3);
    expect(captureSelectionSnapshot(container, 0, 'A')).toBeNull();
  });

  it('refuses whitespace, collapsed and split-surrogate ranges', () => {
    const container = setup('<div data-highlight-scope="g1">😀  word</div>');
    const text = container.firstElementChild!.firstChild!;
    select(text, 1, text, 2);
    expect(captureSelectionSnapshot(container, 0, 'A')).toBeNull();
    select(text, 2, text, 4);
    expect(captureSelectionSnapshot(container, 0, 'A')).toBeNull();
    select(text, 4, text, 4);
    expect(captureSelectionSnapshot(container, 0, 'A')).toBeNull();
  });
});
