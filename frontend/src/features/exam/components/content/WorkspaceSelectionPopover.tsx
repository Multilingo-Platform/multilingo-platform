import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { examMessage as em } from '../../i18n/examMessages';
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_CONFIGS, type HighlightColor } from '../../utils/highlightColors';

interface Props {
  anchor: DOMRect;
  color: HighlightColor;
  cluster: boolean;
  practice: boolean;
  lookupAllowed: boolean;
  focusOnOpen?: boolean;
  onColor: (color: HighlightColor) => void;
  onDelete: () => void;
  onLookup: () => void;
}

/** Position from the rendered dimensions, including a zoomed visual viewport. */
export function WorkspaceSelectionPopover({ anchor, color, cluster, practice, lookupAllowed, focusOnOpen = false, onColor, onDelete, onLookup }: Props) {
  const { t } = useTranslation('exam');
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const margin = 8;
    node.style.maxWidth = `${Math.max(0, width - 2 * margin)}px`;
    node.style.maxHeight = `${Math.max(0, height - 2 * margin)}px`;
    const place = () => {
      const bounds = node.getBoundingClientRect();
      const left = Math.max(leftEdge + margin, Math.min(anchor.left + anchor.width / 2 - bounds.width / 2, leftEdge + width - bounds.width - margin));
      const below = anchor.bottom + margin;
      const preferredTop = below + bounds.height <= topEdge + height - margin ? below : anchor.top - bounds.height - margin;
      const top = Math.max(topEdge + margin, Math.min(preferredTop, topEdge + height - bounds.height - margin));
      setPosition(previous => previous.left === left && previous.top === top ? previous : { left, top });
    };
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(node);
    if (focusOnOpen) node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      observer?.disconnect();
      if (node.contains(document.activeElement) && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [anchor, focusOnOpen]);

  return createPortal(
    <div ref={ref} role="toolbar" aria-label={em('Thao tác với đoạn văn đã chọn')} data-selection-toolbar
      className="fixed z-50 flex max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] flex-wrap items-center gap-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
      style={{ left: position.left, top: position.top }} onPointerDown={event => event.preventDefault()}>
      {!cluster && HIGHLIGHT_COLORS.map(id => (
        <button key={id} type="button" aria-label={t(`selection.colors.${id}`)} aria-pressed={color === id}
          title={t(`selection.colors.${id}`)} onClick={() => onColor(id)}
          className="h-11 w-11 rounded-md border-2 border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          style={{ backgroundColor: HIGHLIGHT_COLOR_CONFIGS[id].hex }} />
      ))}
      <button type="button" onClick={onDelete} className="min-h-11 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">{em('Xóa highlight')}</button>
      {!cluster && practice && <div>
        <button type="button" onClick={onLookup} disabled={!lookupAllowed} aria-describedby={!lookupAllowed ? 'selection-lookup-reason' : undefined}
          className="min-h-11 rounded-md px-3 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">{em('Tra từ AI')}</button>
        {!lookupAllowed && <p id="selection-lookup-reason" className="max-w-64 text-xs text-slate-700">{t('selection.lookupUnavailable')}</p>}
      </div>}
    </div>, document.body,
  );
}
