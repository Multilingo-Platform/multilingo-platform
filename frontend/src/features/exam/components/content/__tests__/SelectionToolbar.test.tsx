import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SelectionToolbar } from '../SelectionToolbar';

describe('SelectionToolbar', () => {
  it('renders Highlight and AI buttons when selection is present and showAi is true', () => {
    const onHighlight = vi.fn();
    const onAiLookup = vi.fn();

    const selection = {
      rect: { top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20 } as DOMRect,
      text: 'hello',
    };

    render(
      <SelectionToolbar
        selection={selection}
        showAi={true}
        onHighlight={onHighlight}
        onAiLookup={onAiLookup}
      />
    );

    const highlightBtn = screen.getByText('Highlight');
    const aiBtn = screen.getByText('Tra từ AI');

    expect(highlightBtn).toBeDefined();
    expect(aiBtn).toBeDefined();

    fireEvent.click(highlightBtn);
    expect(onHighlight).toHaveBeenCalledTimes(1);
  });
});
