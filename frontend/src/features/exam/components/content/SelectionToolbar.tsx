import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SelectionState } from '../../hooks/useTextSelection';

interface Props {
  selection: SelectionState | null;
  showAi: boolean;
  showHighlight?: boolean;
  onHighlight: () => void;
  onAiLookup: () => void;
}

export const SelectionToolbar: React.FC<Props> = ({ selection, showAi, showHighlight = true, onHighlight, onAiLookup }) => {
  useExamLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !selection) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const margin = 8;
    node.style.maxWidth = `${Math.max(0, width - 2 * margin)}px`;
    node.style.maxHeight = `${Math.max(0, height - 2 * margin)}px`;
    const bounds = node.getBoundingClientRect();
    const left = Math.max(leftEdge + margin, Math.min(selection.rect.left + selection.rect.width / 2 - bounds.width / 2, leftEdge + width - bounds.width - margin));
    const below = selection.rect.bottom + margin;
    const preferredTop = below + bounds.height <= topEdge + height - margin ? below : selection.rect.top - bounds.height - margin;
    const top = Math.max(topEdge + margin, Math.min(preferredTop, topEdge + height - bounds.height - margin));
    setPosition({ top, left });
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => { if (node.contains(document.activeElement) && previousFocus?.isConnected) previousFocus.focus(); };
  }, [selection, showAi, showHighlight]);
  if (!selection || (!showAi && !showHighlight)) return null;

  return createPortal(
    <div
      ref={ref}
      role="toolbar"
      data-selection-toolbar
      aria-label={em("Thao tác với đoạn văn đã chọn")}
      className="fixed z-50 flex items-center bg-gray-900 shadow-lg rounded-md overflow-auto"
      style={{ ...position, position: 'fixed' }}
      onPointerDown={(e) => e.preventDefault()} // Keep selection active while clicking
    >
      {showHighlight && (
        <button
          type="button"
          onClick={onHighlight}
          className="px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 border-r border-gray-700 cursor-pointer"
        >
          Highlight
        </button>
      )}
      {showAi && (
        <button
          type="button"
          onClick={onAiLookup}
          className="px-4 py-2 text-sm font-medium text-amber-400 hover:bg-gray-800 cursor-pointer"
        >
          {em("Tra từ AI")}</button>
      )}
    </div>,
    document.body
  );
};
