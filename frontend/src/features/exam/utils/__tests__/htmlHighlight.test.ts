import { describe, it, expect } from 'vitest';
import { applyHighlights } from '../htmlHighlight';
import type { Highlight } from '../highlightUtils';

describe('applyHighlights', () => {
  it('injects mark tags with color metadata and class without breaking HTML structure', () => {
    const html = 'Hello <b>world</b>!';
    const highlights: Highlight[] = [
      { id: '1', start: 4, end: 8, text: 'o wo', color: 'yellow' },
    ];

    const result = applyHighlights(html, highlights);
    expect(result).toBe(
      'Hell<mark data-hl-id="1" data-hl-color="yellow" class="bg-yellow-200 rounded-sm">o </mark><b><mark data-hl-id="1" data-hl-color="yellow" class="bg-yellow-200 rounded-sm">wo</mark>rld</b>!'
    );
  });

  it('supports highlights in different colors across the markup', () => {
    const html = '<p>First second third</p>';
    const highlights: Highlight[] = [
      { id: 'h1', start: 0, end: 5, text: 'First', color: 'green' },
      { id: 'h2', start: 6, end: 12, text: 'second', color: 'pink' },
    ];

    const result = applyHighlights(html, highlights);
    expect(result).toContain('data-hl-color="green" class="bg-green-200 rounded-sm"');
    expect(result).toContain('data-hl-color="pink" class="bg-pink-200 rounded-sm"');
  });

  it('RD04-R03: preserves full highlight ID on data-hl-id attribute without truncating to 100 characters', () => {
    const html = '<p>A long passage that gets highlighted with a long ID.</p>';
    const longId = '12345678-1234-1234-1234-123456789abc_r2_r4_r6_r8_r10_r12_r14_r16_r18_r20_r22_r24_r26_r28_r30_r32_r34_r36_r38_r40';
    expect(longId.length).toBeGreaterThan(100);

    const highlights: Highlight[] = [
      { id: longId, start: 0, end: 6, text: 'A long', color: 'yellow' },
    ];

    const result = applyHighlights(html, highlights);
    expect(result).toContain(`data-hl-id="${longId}"`);
    expect(result).not.toContain(`data-hl-id="${longId.slice(0, 100)}" class`);
  });
});
