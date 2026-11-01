import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SelectionToolbar } from '../SelectionToolbar';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('SelectionToolbar', () => {
  it('renders Highlight and AI buttons when selection is present and showAi is true', () => {
    const onHighlight = vi.fn();
    const onAiLookup = vi.fn();

    const selection = {
      rect: { top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 } as DOMRect,
      text: 'hello',
      start: 0, end: 5, documentId: 'part', contentHash: 'hash', contextRevision: 0, contextKey: 'attempt:part',
    };

    render(
      <SelectionToolbar
        selection={selection}
        showAi={true}
        onHighlight={onHighlight}
        onAiLookup={onAiLookup}
      />
    );

    const highlightBtn = screen.getByText('Highlight');
    const aiBtn = screen.getByText('Tra từ AI');

    expect(highlightBtn).toBeDefined();
    expect(aiBtn).toBeDefined();
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    aiBtn.dispatchEvent(pointerDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(aiBtn.closest('[data-selection-toolbar]')).not.toBeNull();

    fireEvent.click(highlightBtn);
    expect(onHighlight).toHaveBeenCalledTimes(1);
  });

  it('uses fixed positioning and clamps its action surface inside the viewport', () => {
    const selection = {
      rect: { top: 740, bottom: 760, left: 980, right: 1000, width: 20, height: 20 } as DOMRect,
      text: 'passage', start: 0, end: 7, scopeId: 'part', documentId: 'part', contentHash: 'hash', contextRevision: 0, contextKey: 'attempt:part',
    };
    render(<SelectionToolbar selection={selection} showAi={false} onHighlight={vi.fn()} onAiLookup={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' });
    expect(toolbar).toHaveStyle({ position: 'fixed' });
    expect(Number.parseFloat((toolbar as HTMLElement).style.left)).toBeLessThan(window.innerWidth);
    expect(Number.parseFloat((toolbar as HTMLElement).style.top)).toBeLessThan(window.innerHeight);
  });

  it('measures the manual confirmation toolbar and gives it keyboard focus', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 80));
    vi.stubGlobal('innerWidth', 320); vi.stubGlobal('innerHeight', 400);
    const selection = { rect: new DOMRect(300, 370, 10, 10), text: 'word', start: 0, end: 4,
      documentId: 'part', contentHash: 'hash', contextRevision: 0, contextKey: 'key' };
    render(<SelectionToolbar selection={selection} showAi={false} onHighlight={vi.fn()} onAiLookup={vi.fn()} />);
    expect(screen.getByRole('toolbar')).toHaveStyle({ left: '112px', top: '282px', maxWidth: '304px', maxHeight: '384px' });
    expect(screen.getByRole('button', { name: 'Highlight' })).toHaveFocus();
  });

  it('can hide Highlight while keeping an independently eligible AI action', () => {
    const selection = {
      rect: { top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 } as DOMRect,
      text: 'hello', start: 0, end: 5, documentId: 'part', contentHash: 'hash', contextRevision: 0, contextKey: 'attempt:part',
    };
    render(<SelectionToolbar selection={selection} showAi onHighlight={vi.fn()} onAiLookup={vi.fn()} showHighlight={false} />);
    expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tra từ AI' })).toBeDefined();
  });

  it('does not render an empty toolbar when both actions are unavailable', () => {
    const selection = {
      rect: { top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 } as DOMRect,
      text: 'hello', start: 0, end: 5, documentId: 'part', contentHash: 'hash', contextRevision: 0, contextKey: 'attempt:part',
    };
    render(<SelectionToolbar selection={selection} showAi={false} onHighlight={vi.fn()} onAiLookup={vi.fn()} showHighlight={false} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
