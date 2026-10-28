import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSelectionPopover } from '../components/content/WorkspaceSelectionPopover';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('WorkspaceSelectionPopover', () => {
  it('measures the real surface and clamps it inside a narrow viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 120));
    vi.stubGlobal('innerWidth', 320); vi.stubGlobal('innerHeight', 400);
    const color = vi.fn();
    render(<WorkspaceSelectionPopover anchor={new DOMRect(300, 370, 10, 10)} color="yellow" cluster={false} practice
      lookupAllowed={false} onColor={color} onDelete={vi.fn()} onLookup={vi.fn()} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' });
    expect(toolbar).toHaveStyle({ left: '32px', top: '242px' });
    expect(toolbar).toHaveStyle({ maxWidth: '304px', maxHeight: '384px' });
    expect(screen.getByRole('button', { name: 'Tra từ AI' })).toBeDisabled();
    expect(screen.getByText(/tối đa 80 ký tự/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tím' }));
    expect(color).toHaveBeenCalledWith('purple');
  });

  it('uses the offset and size of a zoomed visual viewport', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 160, 80));
    vi.stubGlobal('visualViewport', { offsetLeft: 40, offsetTop: 50, width: 200, height: 300 });
    render(<WorkspaceSelectionPopover anchor={new DOMRect(230, 310, 10, 10)} color="yellow" cluster={false} practice={false}
      lookupAllowed={false} onColor={vi.fn()} onDelete={vi.fn()} onLookup={vi.fn()} />);
    expect(screen.getByRole('toolbar')).toHaveStyle({ left: '72px', top: '222px', maxWidth: '184px', maxHeight: '284px' });
    expect(screen.queryByRole('button', { name: 'Tra từ AI' })).toBeNull();
  });
});
