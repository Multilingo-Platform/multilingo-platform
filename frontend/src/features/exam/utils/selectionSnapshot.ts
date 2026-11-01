import { rangeToOffsets, trimOffsets } from './domOffsetUtils';
import { normalizeAgainstText } from './highlightUtils';

export interface SelectionState {
  rect: DOMRect;
  text: string;
  start: number;
  end: number;
  documentId: string;
  contentHash: string | null;
  contextRevision: number;
  contextKey: string;
  scopeId?: string | null;
  scopeText?: string;
}

export const HIGHLIGHT_SCOPE_ATTRIBUTE = 'data-highlight-scope';
const SCOPE_SELECTOR = `[${HIGHLIGHT_SCOPE_ATTRIBUTE}]`;

export function highlightScopeFor(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement;
  const scope = element?.closest(SCOPE_SELECTOR);
  return scope instanceof HTMLElement ? scope : null;
}

export function resolveHighlightScopeElement(range: Range, container?: HTMLElement | null): HTMLElement | null {
  const start = highlightScopeFor(range.startContainer);
  const end = highlightScopeFor(range.endContainer);
  if (!start || start !== end || (container && !container.contains(start))) return null;
  return start;
}

export function resolveHighlightScope(range: Range, container?: HTMLElement | null): string | null {
  return resolveHighlightScopeElement(range, container)?.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE) ?? null;
}

/** Captures primitives before a render can replace the selected DOM. Never modifies the live Range. */
export function captureSelectionSnapshot(
  container: HTMLElement | null,
  contextRevision: number,
  contextKey: string,
  strictScope?: HTMLElement,
): SelectionState | null {
  const selected = window.getSelection();
  if (!container || !selected || selected.isCollapsed || selected.rangeCount !== 1) return null;
  const range = selected.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const startScope = highlightScopeFor(range.startContainer);
  const endScope = highlightScopeFor(range.endContainer);
  if (startScope && endScope && startScope !== endScope) return null;
  const scope = startScope ?? endScope;
  if (!scope || !container.contains(scope)) return null;
  // Automatic commit never clips an out-of-passage boundary into the beginning of a document.
  if (strictScope && (startScope !== strictScope || endScope !== strictScope)) return null;
  const clipped = range.cloneRange();
  if (!scope.contains(clipped.startContainer)) clipped.setStart(scope, 0);
  if (!scope.contains(clipped.endContainer)) clipped.setEnd(scope, scope.childNodes.length);
  try {
    const offsets = trimOffsets(clipped.toString(), rangeToOffsets(scope, clipped));
    const scopeText = scope.textContent ?? '';
    const text = scopeText.slice(offsets.start, offsets.end);
    if (!text.trim() || offsets.start >= offsets.end) return null;
    if (!normalizeAgainstText([{ id: 'selection', text, ...offsets }], scopeText).length) return null;
    const bounds = typeof clipped.getBoundingClientRect === 'function'
      ? clipped.getBoundingClientRect() : range.getBoundingClientRect();
    if (!bounds || (!bounds.width && !bounds.height)) return null;
    return {
      rect: new DOMRect(bounds.left, bounds.top, bounds.width, bounds.height),
      text, ...offsets, scopeText,
      documentId: scope.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE) ?? 'part',
      scopeId: scope.getAttribute(HIGHLIGHT_SCOPE_ATTRIBUTE),
      contentHash: scope.getAttribute('data-highlight-hash'),
      contextRevision, contextKey,
    };
  } catch {
    return null;
  }
}
