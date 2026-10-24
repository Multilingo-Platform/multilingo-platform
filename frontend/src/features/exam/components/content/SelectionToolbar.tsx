import { examMessage as em, useExamLocale } from '../../i18n/examMessages';
import React from 'react';
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
  if (!selection || (!showAi && !showHighlight)) return null;

  // Fixed viewport coordinates avoid scroll-offset drift and keep the menu inside the screen.
  const estimatedWidth = showAi && showHighlight ? 220 : 132;
  const estimatedHeight = 44;
  const gap = 8;
  const top = selection.rect.bottom + estimatedHeight + gap <= window.innerHeight
    ? selection.rect.bottom + gap
    : Math.max(8, selection.rect.top - estimatedHeight - gap);
  const left = Math.max(8, Math.min(
    window.innerWidth - estimatedWidth - 8,
    selection.rect.left + selection.rect.width / 2 - estimatedWidth / 2
  ));

  return createPortal(
    <div
      role="toolbar"
      aria-label={em("Thao tác với đoạn văn đã chọn")}
      className="fixed z-50 flex items-center bg-gray-900 shadow-lg rounded-md overflow-hidden"
      style={{ top, left, position: 'fixed' }}
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
