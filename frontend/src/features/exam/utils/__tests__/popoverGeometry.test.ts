import { describe, expect, it } from 'vitest';
import { fitPopoverToViewport } from '../popoverGeometry';

describe('fitPopoverToViewport', () => {
  it('keeps the popup inside a horizontally panned visual viewport', () => {
    const viewport = { width: 200, height: 400, offsetTop: 300, offsetLeft: 150 };
    expect(fitPopoverToViewport(220, 650, 360, 480, viewport)).toEqual({
      left: 162, top: 312, width: 176, height: 376,
    });
  });
  it('keeps the popup inside the viewport when selection is near its bottom edge', () => {
    expect(fitPopoverToViewport(350, 760, 360, 480, { width: 390, height: 800 })).toEqual({
      left: 18, top: 308, width: 360, height: 480,
    });
  });

  it('limits height and respects the visible mobile viewport after the keyboard opens', () => {
    expect(fitPopoverToViewport(100, 650, 360, 480, { width: 390, height: 360, offsetTop: 400 })).toEqual({
      left: 12, top: 412, width: 360, height: 336,
    });
  });

  it('never exceeds a very short visible viewport', () => {
    const fitted = fitPopoverToViewport(20, 10, 360, 480, { width: 180, height: 100, offsetTop: 0 });
    expect(fitted.height).toBe(76);
    expect(fitted.top).toBe(12);
    expect(fitted.top + fitted.height).toBe(88);
  });
});
