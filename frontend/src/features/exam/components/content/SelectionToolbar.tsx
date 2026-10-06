import React from 'react';
import { createPortal } from 'react-dom';
import type { SelectionState } from '../../hooks/useTextSelection';

interface Props {
  selection: SelectionState | null;
  showAi: boolean;
  onHighlight: () => void;
  onAiLookup: () => void;
}

export const SelectionToolbar: React.FC<Props> = ({ selection, showAi, onHighlight, onAiLookup }) => {
  if (!selection) return null;

  // Position below the selection to avoid native mobile menus
  const top = selection.rect.bottom + window.scrollY + 8;
  const left = Math.max(16, selection.rect.left + window.scrollX + selection.rect.width / 2 - 60);

  return createPortal(
    <div
      className="absolute z-50 flex items-center bg-gray-900 shadow-lg rounded-md overflow-hidden"
      style={{ top, left }}
      onPointerDown={(e) => e.preventDefault()} // Keep selection active while clicking
    >
      <button
        onClick={onHighlight}
        className="px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 border-r border-gray-700 cursor-pointer"
      >
        Highlight
      </button>
      {showAi && (
        <button
          onClick={onAiLookup}
          className="px-4 py-2 text-sm font-medium text-amber-400 hover:bg-gray-800 cursor-pointer"
        >
          Tra từ AI
        </button>
      )}
    </div>,
    document.body
  );
};
