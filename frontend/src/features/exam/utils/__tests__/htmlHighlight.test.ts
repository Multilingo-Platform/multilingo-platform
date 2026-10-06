import { describe, it, expect } from 'vitest';
import { applyHighlights } from '../htmlHighlight';
import type { Highlight } from '../highlightUtils';

describe('applyHighlights', () => {
  it('injects mark tags without breaking HTML structure', () => {
    const html = 'Hello <b>world</b>!';
    const highlights: Highlight[] = [
      { id: '1', start: 4, end: 8, text: 'o wo' },
    ];

    const result = applyHighlights(html, highlights);
    expect(result).toBe('Hell<mark data-hl-id="1" class="bg-yellow-200 rounded-sm">o </mark><b><mark data-hl-id="1" class="bg-yellow-200 rounded-sm">wo</mark>rld</b>!');
  });
});
