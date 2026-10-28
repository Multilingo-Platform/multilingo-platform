import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { captureSelectionSnapshot, highlightScopeFor, type SelectionState } from '../utils/selectionSnapshot';
export { HIGHLIGHT_SCOPE_ATTRIBUTE, resolveHighlightScope, resolveHighlightScopeElement } from '../utils/selectionSnapshot';
export type { SelectionState } from '../utils/selectionSnapshot';

interface TextSelectionOptions {
  onPointerCommit?: (snapshot: SelectionState) => boolean;
}
type Interaction = 'manual' | 'manual-confirmed' | 'pointer-committed' | null;

export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  contextRevision = 0,
  contextKey = String(contextRevision),
  options: TextSelectionOptions = {},
) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const commitRef = useRef(options.onPointerCommit);
  commitRef.current = options.onPointerCommit;
  const trailingClick = useRef<number | null>(null);
  const manualCommitted = useRef(false);
  const confirmSelection = useCallback(() => {
    manualCommitted.current = true;
    setInteraction('manual-confirmed');
  }, []);
  // Cancellation must survive effect replacement during same-attempt hydration.
  // A late mouseup must not turn an old native range into a new-context snapshot.
  const requireFreshInput = useRef(false);
  const consumeCommittedClick = useCallback((event: MouseEvent) => {
    if (trailingClick.current === null || event.detail === 0) return false;
    if ('pointerId' in event && event.pointerId !== trailingClick.current) return false;
    trailingClick.current = null;
    return true;
  }, []);

  useEffect(() => {
    setSelection(null);
    setInteraction(null);
    trailingClick.current = null;
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let gesture: { pointerId: number; scope: HTMLElement; hash: string | null } | null = null;
    let committed = false;
    let cancelled = requireFreshInput.current;
    const clear = () => {
      clearTimeout(timer);
      manualCommitted.current = false;
      setSelection(null);
      setInteraction(null);
      committed = false;
    };
    const cancel = () => {
      gesture = null;
      cancelled = true;
      requireFreshInput.current = true;
      trailingClick.current = null;
      clear();
    };
    const captureManual = () => {
      clearTimeout(timer);
      if (document.activeElement instanceof Element && document.activeElement.closest('[data-selection-toolbar]')) return;
      if (gesture || committed || cancelled || manualCommitted.current) return;
      timer = setTimeout(() => {
        if (gesture || committed || cancelled || manualCommitted.current) return;
        if (document.activeElement instanceof Element && document.activeElement.closest('[data-selection-toolbar]')) return;
        const snapshot = captureSelectionSnapshot(containerRef.current, contextRevision, contextKey);
        setSelection(snapshot);
        setInteraction(snapshot ? 'manual' : null);
      }, 100);
    };
    const isControl = (target: EventTarget | null) => target instanceof Element
      && !!target.closest('[data-selection-toolbar]');
    const pointerDown = (event: PointerEvent) => {
      // A toolbar button uses the frozen snapshot; its pointerdown must not discard it.
      if (isControl(event.target)) return;
      gesture = null;
      cancelled = false;
      requireFreshInput.current = false;
      trailingClick.current = null;
      clear();
      if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
      const scope = highlightScopeFor(event.target instanceof Node ? event.target : null);
      if (!scope || !containerRef.current?.contains(scope)) return;
      gesture = { pointerId: event.pointerId, scope, hash: scope.getAttribute('data-highlight-hash') };
    };
    const pointerUp = (event: PointerEvent) => {
      if (!gesture) { captureManual(); return; }
      if (event.pointerId !== gesture.pointerId) return;
      const completed = gesture;
      gesture = null;
      clearTimeout(timer);
      if (event.button !== 0 || !completed.scope.isConnected
        || completed.scope.getAttribute('data-highlight-hash') !== completed.hash) { cancel(); return; }
      const snapshot = captureSelectionSnapshot(containerRef.current, contextRevision, contextKey, completed.scope);
      if (!snapshot) { cancel(); return; }
      if (!commitRef.current) {
        setSelection(snapshot); setInteraction('manual'); return;
      }
      if (!commitRef.current(snapshot)) { cancel(); return; }
      committed = true;
      trailingClick.current = event.pointerId;
      setSelection(snapshot);
      setInteraction('pointer-committed');
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancel(); return; }
      if (event.shiftKey || /^(Arrow|Home|End)/.test(event.key) || ((event.ctrlKey || event.metaKey) && event.key === 'a')) {
        manualCommitted.current = false;
        committed = false; cancelled = false; requireFreshInput.current = false; trailingClick.current = null;
      }
    };
    const viewportChange = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-selection-toolbar]')) return;
      // Native drag autoscroll must keep the original anchor and the pending gesture.
      if (!gesture) clear();
    };
    const mouseDown = (event: MouseEvent) => {
      if (!isControl(event.target) && event.target instanceof Node && !containerRef.current?.contains(event.target)) clear();
    };
    const visibilityChange = () => { if (document.visibilityState === 'hidden') cancel(); };

    document.addEventListener('pointerdown', pointerDown);
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('selectionchange', captureManual);
    document.addEventListener('mouseup', captureManual);
    document.addEventListener('touchend', captureManual);
    document.addEventListener('mousedown', mouseDown);
    document.addEventListener('keydown', keyDown);
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('blur', cancel);
    window.addEventListener('scroll', viewportChange, true);
    window.addEventListener('resize', cancel);
    return () => {
      clearTimeout(timer);
      gesture = null;
      requireFreshInput.current = true;
      trailingClick.current = null;
      document.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('selectionchange', captureManual);
      document.removeEventListener('mouseup', captureManual);
      document.removeEventListener('touchend', captureManual);
      document.removeEventListener('mousedown', mouseDown);
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('scroll', viewportChange, true);
      window.removeEventListener('resize', cancel);
    };
  }, [containerRef, enabled, contextRevision, contextKey]);

  return { selection, setSelection, interaction, confirmSelection, consumeCommittedClick };
}
