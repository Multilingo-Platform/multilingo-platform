import { useCallback, useEffect, useState } from 'react';
import type { SelectionState } from './useTextSelection';

export interface HighlightClusterTarget {
  highlightId: string;
  namespace: string;
  rect: DOMRect;
  contextKey: string;
}

export function useWorkspaceSelectionPopover(selection: SelectionState | null, setSelection: (selection: SelectionState | null) => void, contextKey: string, enabled: boolean) {
  const [cluster, setCluster] = useState<HighlightClusterTarget | null>(null);
  const close = useCallback(() => { setCluster(null); setSelection(null); }, [setSelection]);
  useEffect(() => { close(); }, [contextKey, enabled, close]);
  useEffect(() => {
    if (!selection && !cluster) return;
    const outside = (event: MouseEvent | PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-selection-toolbar]')) return;
      close();
    };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const viewport = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-selection-toolbar]')) return;
      close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('scroll', viewport, true);
    window.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('resize', viewport);
    window.visualViewport?.addEventListener('scroll', viewport);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('scroll', viewport, true);
      window.removeEventListener('resize', viewport);
      window.visualViewport?.removeEventListener('resize', viewport);
      window.visualViewport?.removeEventListener('scroll', viewport);
    };
  }, [selection, cluster, close]);
  const openCluster = useCallback((target: Omit<HighlightClusterTarget, 'contextKey'>) => {
    setSelection(null); setCluster({ ...target, contextKey });
  }, [setSelection, contextKey]);
  return { cluster, setCluster, close, openCluster };
}
