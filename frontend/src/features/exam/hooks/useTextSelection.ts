import { useState, useEffect, type RefObject } from 'react';

export interface SelectionState {
  rect: DOMRect;
  text: string;
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

        setSelection({ rect, text });
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
