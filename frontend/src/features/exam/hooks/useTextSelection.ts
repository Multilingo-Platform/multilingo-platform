import { useState, useEffect, type RefObject } from 'react';
import { rangeToOffsets, trimOffsets } from '../utils/domOffsetUtils';

export interface SelectionState {
  rect: DOMRect;
  text: string;
  start: number;
  end: number;
  documentId: string;
  contentHash: string | null;
  contextRevision: number;
  contextKey: string;
  /** Nearest `data-highlight-scope` id of the selection, or null when the region is unscoped. */
  scopeId?: string | null;
  /** Passage text captured with the selection so an action never re-reads mutable browser selection. */
  scopeText?: string;
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

export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  contextRevision = 0,
  contextKey = String(contextRevision)
) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    setSelection(null);
    if (!enabled) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleSelectionChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          return;
        }

        const range = sel.getRangeAt(0);
        const container = containerRef.current;
        if (!container) return setSelection(null);
        if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
          setSelection(null);
          return;
        }
        const startElement = elementFor(range.startContainer);
        const endElement = elementFor(range.endContainer);
        const startScope = startElement?.closest(SCOPE_SELECTOR);
        const endScope = endElement?.closest(SCOPE_SELECTOR);
        if (startScope && endScope && startScope !== endScope) return setSelection(null);
        const scope = (startScope ?? endScope) as HTMLElement | null;
        if (!scope || !container.contains(scope)) return setSelection(null);
        const clippedRange = range.cloneRange();
        if (!scope.contains(clippedRange.startContainer)) clippedRange.setStart(scope, 0);
        if (!scope.contains(clippedRange.endContainer)) clippedRange.setEnd(scope, scope.childNodes.length);
        const offsetBase = scope;
        let offsets: { start: number; end: number };
        try {
          offsets = rangeToOffsets(offsetBase, clippedRange);
        } catch {
          return setSelection(null);
        }
        const rawText = clippedRange.toString();
        offsets = trimOffsets(rawText, offsets);
        const text = (offsetBase.textContent ?? '').slice(offsets.start, offsets.end);
        if (!text.trim() || offsets.start >= offsets.end) return setSelection(null);

        const rect = typeof clippedRange.getBoundingClientRect === 'function'
          ? clippedRange.getBoundingClientRect()
          : range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return setSelection(null);

        setSelection({
          rect,
          text,
          start: offsets.start,
          end: offsets.end,
          scopeId: scope?.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE) ?? null,
          scopeText: offsetBase.textContent ?? '',
          documentId: scope?.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE) ?? 'part',
          contentHash: scope?.getAttribute('data-highlight-hash') ?? null,
          contextRevision,
          contextKey,
        });
      }, 100);
    };

    const clearSelection = () => setSelection(null);

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    const activeContainer = containerRef.current;
    activeContainer?.addEventListener('touchend', handleSelectionChange);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    const closeOnViewportChange = () => clearSelection();
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', closeOnViewportChange, true);
    window.addEventListener('resize', closeOnViewportChange);
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
      document.removeEventListener('mouseup', handleSelectionChange);
      activeContainer?.removeEventListener('touchend', handleSelectionChange);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', closeOnViewportChange, true);
      window.removeEventListener('resize', closeOnViewportChange);
    };
  }, [containerRef, enabled, contextRevision, contextKey]);

  return { selection, setSelection };
}
