export interface PopoverViewport {
  width: number;
  height: number;
  offsetTop?: number;
  offsetLeft?: number;
}

export function fitPopoverToViewport(
  x: number,
  y: number,
  contentWidth: number,
  contentHeight: number,
  viewport: PopoverViewport,
) {
  const width = Math.min(contentWidth, Math.max(1, viewport.width - 24));
  const height = Math.min(contentHeight, Math.max(1, viewport.height - 24));
  const visibleLeft = (viewport.offsetLeft ?? 0) + 12;
  const visibleRight = (viewport.offsetLeft ?? 0) + viewport.width - 12;
  const left = Math.max(visibleLeft, Math.min(visibleRight - width, x - width / 2));
  const visibleTop = (viewport.offsetTop ?? 0) + 12;
  const visibleBottom = (viewport.offsetTop ?? 0) + viewport.height - 12;
  const top = Math.max(visibleTop, Math.min(visibleBottom - height, y));
  return { left, top, width, height };
}
