import { useState, useEffect, type RefObject } from 'react';

export interface SelectionState {
  rect: DOMRect;
  text: string;
  /** Nearest `data-highlight-scope` id of the selection, or null when the region is unscoped. */
  scopeId?: string | null;
}

/** Attribute used to scope a selection (and its highlight offsets) to one reference document. */
export const HIGHLIGHT_SCOPE_ATTRIBUTE = 'data-highlight-scope';

const SCOPE_SELECTOR = `[${HIGHLIGHT_SCOPE_ATTRIBUTE}]`;

function elementFor(node: Node | null): Element | null {
  if (!node) return null;
  if (node.nodeType === 1) return node as Element;
  return node.parentElement ?? null;
}

/**
 * Resolves the nearest ancestor (or the start element itself) carrying `data-highlight-scope`.
 * Returns null when the range is outside the container or lives in an unscoped region, so callers
 * never attribute a selection (or its offsets) to the wrong document.
 */
export function resolveHighlightScopeElement(
  range: Range,
  container?: HTMLElement | null
): HTMLElement | null {
  const start = elementFor(range.startContainer);
  const end = elementFor(range.endContainer);
  if (!start || !end) return null;
  if (container && (!container.contains(start) || !container.contains(end))) return null;

  const startScoped = start.closest(SCOPE_SELECTOR);
  const endScoped = end.closest(SCOPE_SELECTOR);
  if (!startScoped || !(startScoped instanceof HTMLElement)) return null;
  if (!endScoped || !(endScoped instanceof HTMLElement)) return null;

  if (startScoped !== endScoped) return null;
  if (container && !container.contains(startScoped)) return null;
  return startScoped;
}

/** Scope id for a range; see {@link resolveHighlightScopeElement}. */
export function resolveHighlightScope(range: Range, container?: HTMLElement | null): string | null {
  return resolveHighlightScopeElement(range, container)?.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE) ?? null;
}

export function useTextSelection(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
      return;
    }

    let timeoutId: any;

    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }

        const range = sel.getRangeAt(0);
        if (!containerRef.current?.contains(range.commonAncestorContainer)) {
          setSelection(null);
          return;
        }

        const text = sel.toString().trim();
        if (!text) {
          setSelection(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelection(null);
          return;
        }

        setSelection({ rect, text, scopeId: resolveHighlightScope(range, containerRef.current) });
      }, 100);
    };

    const clearSelection = () => setSelection(null);

    document.addEventListener('selectionchange', handleSelectionChange);
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clearSelection();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef, enabled]);

  return { selection, setSelection };
}
