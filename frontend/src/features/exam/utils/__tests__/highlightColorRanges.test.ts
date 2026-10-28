import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_CONFIGS,
  isValidHighlightColor,
  type HighlightColor,
} from '../highlightColors';
import {
  applyHighlightOverlay,
  deleteHighlightFromRange,
  normalize,
  normalizeAgainstText,
  type Highlight,
} from '../highlightUtils';

describe('RD-04 — Highlight Colors & Overlay Ranges', () => {
  describe('Color Allowlist & Configs', () => {
    it('defines exactly 5 approved colors with fixed hex and accessibility labels', () => {
      expect(HIGHLIGHT_COLORS).toEqual(['yellow', 'green', 'blue', 'pink', 'purple']);
      expect(DEFAULT_HIGHLIGHT_COLOR).toBe('yellow');

      expect(HIGHLIGHT_COLOR_CONFIGS.yellow.hex).toBe('#FEF08A');
      expect(HIGHLIGHT_COLOR_CONFIGS.green.hex).toBe('#BBF7D0');
      expect(HIGHLIGHT_COLOR_CONFIGS.blue.hex).toBe('#BAE6FD');
      expect(HIGHLIGHT_COLOR_CONFIGS.pink.hex).toBe('#FBCFE8');
      expect(HIGHLIGHT_COLOR_CONFIGS.purple.hex).toBe('#DDD6FE');

      for (const color of HIGHLIGHT_COLORS) {
        expect(HIGHLIGHT_COLOR_CONFIGS[color].label).toBeTruthy();
        expect(HIGHLIGHT_COLOR_CONFIGS[color].className).toBeTruthy();
      }
    });

    it('validates color allowlist and rejects unapproved values', () => {
      expect(isValidHighlightColor('yellow')).toBe(true);
      expect(isValidHighlightColor('green')).toBe(true);
      expect(isValidHighlightColor('blue')).toBe(true);
      expect(isValidHighlightColor('pink')).toBe(true);
      expect(isValidHighlightColor('purple')).toBe(true);

      expect(isValidHighlightColor('red')).toBe(false);
      expect(isValidHighlightColor('#FEF08A')).toBe(false);
      expect(isValidHighlightColor('')).toBe(false);
      expect(isValidHighlightColor(null)).toBe(false);
      expect(isValidHighlightColor(undefined)).toBe(false);
      expect(isValidHighlightColor(123)).toBe(false);
    });
  });

  describe('Pure Overlay Algorithm (applyHighlightOverlay)', () => {
    const documentText = 'The quick brown fox jumps over the lazy dog.';

    it('adds a new highlight when no existing highlights intersect', () => {
      const existing: Highlight[] = [];
      const newRange: Highlight = {
        id: 'h1',
        start: 4,
        end: 9,
        text: 'quick',
        color: 'yellow',
      };

      const result = applyHighlightOverlay(existing, newRange, documentText);
      expect(result).toEqual([
        { id: 'h1', start: 4, end: 9, text: 'quick', color: 'yellow' },
      ]);
    });

    it('recolors only the intersecting sub-range when overlapping a different color (split into 3)', () => {
      // Existing: [0, 15) "The quick brown" in yellow
      const existing: Highlight[] = [
        { id: 'h-yellow', start: 0, end: 15, text: 'The quick brown', color: 'yellow' },
      ];
      // Overlay [4, 9) "quick" with green
      const greenSelection: Highlight = {
        id: 'h-green',
        start: 4,
        end: 9,
        text: 'quick',
        color: 'green',
      };

      const before = structuredClone(existing);
      const result = applyHighlightOverlay(existing, greenSelection, documentText);

      // Verify pure function (no mutation)
      expect(existing).toEqual(before);

      // Expect [0, 4) in yellow, [4, 9) in green, [9, 15) in yellow
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ id: 'h-yellow', start: 0, end: 4, text: 'The ', color: 'yellow' });
      expect(result[1]).toMatchObject({ id: 'h-green', start: 4, end: 9, text: 'quick', color: 'green' });
      expect(result[2]).toMatchObject({ start: 9, end: 15, text: ' brown', color: 'yellow' });
    });

    it('merges overlapping and adjacent ranges of the SAME color', () => {
      const existing: Highlight[] = [
        { id: 'h1', start: 0, end: 9, text: 'The quick', color: 'yellow' },
      ];
      const newRange: Highlight = {
        id: 'h2',
        start: 4,
        end: 15,
        text: 'quick brown',
        color: 'yellow',
      };

      const result = applyHighlightOverlay(existing, newRange, documentText);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'h1', start: 0, end: 15, text: 'The quick brown', color: 'yellow' });
    });

    it('does NOT merge adjacent ranges of DIFFERENT colors', () => {
      const existing: Highlight[] = [
        { id: 'h1', start: 0, end: 4, text: 'The ', color: 'yellow' },
      ];
      const newRange: Highlight = {
        id: 'h2',
        start: 4,
        end: 9,
        text: 'quick',
        color: 'blue',
      };

      const result = applyHighlightOverlay(existing, newRange, documentText);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'h1', start: 0, end: 4, text: 'The ', color: 'yellow' });
      expect(result[1]).toMatchObject({ id: 'h2', start: 4, end: 9, text: 'quick', color: 'blue' });
    });

    it('handles selection spanning multiple existing clusters of different colors', () => {
      // Existing: [0, 5) in yellow, [10, 15) in green
      const existing: Highlight[] = [
        { id: 'h-y', start: 0, end: 5, text: 'The q', color: 'yellow' },
        { id: 'h-g', start: 10, end: 15, text: 'brown', color: 'green' },
      ];
      // New pink selection: [3, 12) spanning part of yellow, gap, and part of green
      const pinkRange: Highlight = {
        id: 'h-pink',
        start: 3,
        end: 12,
        text: ' quick br',
        color: 'pink',
      };

      const result = applyHighlightOverlay(existing, pinkRange, documentText);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ id: 'h-y', start: 0, end: 3, text: 'The', color: 'yellow' });
      expect(result[1]).toMatchObject({ id: 'h-pink', start: 3, end: 12, text: ' quick br', color: 'pink' });
      expect(result[2]).toMatchObject({ start: 12, end: 15, text: 'own', color: 'green' });
    });

    it('replaces completely covered existing ranges regardless of color', () => {
      const existing: Highlight[] = [
        { id: 'h1', start: 4, end: 9, text: 'quick', color: 'yellow' },
        { id: 'h2', start: 10, end: 15, text: 'brown', color: 'blue' },
      ];
      const widePurple: Highlight = {
        id: 'h-purple',
        start: 0,
        end: 19,
        text: 'The quick brown fox',
        color: 'purple',
      };

      const result = applyHighlightOverlay(existing, widePurple, documentText);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'h-purple', start: 0, end: 19, text: 'The quick brown fox', color: 'purple' });
    });
  });

  describe('Selection Deletion (deleteHighlightFromRange)', () => {
    const documentText = 'The quick brown fox jumps over the lazy dog.';

    it('cuts out the selected sub-range from an existing highlight', () => {
      const existing: Highlight[] = [
        { id: 'h1', start: 0, end: 15, text: 'The quick brown', color: 'yellow' },
      ];

      // Delete [4, 9) "quick"
      const result = deleteHighlightFromRange(existing, 4, 9, documentText);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'h1', start: 0, end: 4, text: 'The ', color: 'yellow' });
      expect(result[1]).toMatchObject({ start: 9, end: 15, text: ' brown', color: 'yellow' });
    });

    it('removes completely covered highlights when deleting a wide range', () => {
      const existing: Highlight[] = [
        { id: 'h1', start: 0, end: 4, text: 'The ', color: 'yellow' },
        { id: 'h2', start: 4, end: 9, text: 'quick', color: 'green' },
        { id: 'h3', start: 10, end: 15, text: 'brown', color: 'blue' },
      ];

      // Delete [3, 16)
      const result = deleteHighlightFromRange(existing, 3, 16, documentText);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'h1', start: 0, end: 3, text: 'The', color: 'yellow' });
    });

    it('RD04-R01: assigns distinct IDs to split clusters when recoloring in the middle', () => {
      const doc = 'abcdefghij';
      const existing: Highlight[] = [
        { id: 'old', start: 0, end: 10, text: 'abcdefghij', color: 'yellow' },
      ];
      const overlay: Highlight = {
        id: 'blue',
        start: 3,
        end: 6,
        text: 'def',
        color: 'blue',
      };

      const result = applyHighlightOverlay(existing, overlay, doc);
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ id: 'old', start: 0, end: 3, text: 'abc', color: 'yellow' });
      expect(result[1]).toMatchObject({ id: 'blue', start: 3, end: 6, text: 'def', color: 'blue' });
      expect(result[2]).toMatchObject({ start: 6, end: 10, text: 'ghij', color: 'yellow' });

      // The right cluster must have its own unique ID, not reusing 'old'
      expect(result[2].id).not.toBe('old');
      expect(result[2].id).not.toBe('blue');
      expect(new Set(result.map((h) => h.id)).size).toBe(3);
    });

    it('RD04-R02: rejects deletions that split surrogate pairs and leaves highlights unchanged', () => {
      const text = 'A😀B';
      const existing: Highlight[] = [
        { id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' },
      ];

      // Offset 2 splits between high (offset 1) and low (offset 2) surrogate of 😀
      const result = deleteHighlightFromRange(existing, 1, 2, text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' });
    });

    it('RD04-R02: rejects out-of-bounds deletion and leaves highlights unchanged', () => {
      const text = 'A😀B';
      const existing: Highlight[] = [
        { id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' },
      ];

      const result = deleteHighlightFromRange(existing, 1, 10, text);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' });
    });

    it('RD04-R02: cleanly deletes full emoji range without dropping outer text', () => {
      const text = 'A😀B';
      const existing: Highlight[] = [
        { id: 'emoji', start: 0, end: 4, text: 'A😀B', color: 'yellow' },
      ];

      // Deleting [1, 3) cleanly removes 😀 without splitting surrogates
      const result = deleteHighlightFromRange(existing, 1, 3, text);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'emoji', start: 0, end: 1, text: 'A', color: 'yellow' });
      expect(result[1]).toMatchObject({ start: 3, end: 4, text: 'B', color: 'yellow' });
      expect(result[1].id).not.toBe('emoji');
    });
  });

  describe('Normalizing with Color & Legacy Compatibility', () => {
    it('defaults omitted color to yellow in normalize and normalizeAgainstText', () => {
      const legacy: Highlight[] = [
        { id: 'legacy-1', start: 0, end: 5, text: 'hello' },
      ];

      const normalized = normalize(legacy);
      expect(normalized[0].color).toBe('yellow');

      const againstText = normalizeAgainstText(legacy, 'hello world');
      expect(againstText[0].color).toBe('yellow');
    });

    it('preserves specified colors across normalization', () => {
      const ranges: Highlight[] = [
        { id: '1', start: 0, end: 5, text: 'hello', color: 'green' },
        { id: '2', start: 10, end: 15, text: 'world', color: 'purple' },
      ];

      const result = normalizeAgainstText(ranges, 'hello     world');
      expect(result[0].color).toBe('green');
      expect(result[1].color).toBe('purple');
    });

    it('rejects invalid color values during normalization', () => {
      const ranges = [
        { id: '1', start: 0, end: 5, text: 'hello', color: 'invalid-red' as unknown as HighlightColor },
      ];

      const result = normalizeAgainstText(ranges, 'hello world');
      expect(result).toHaveLength(0);
    });

    it('does not merge ranges across whitespace gaps', () => {
      const text = 'word1 word2';
      const ranges: Highlight[] = [
        { id: '1', start: 0, end: 5, text: 'word1', color: 'yellow' },
        { id: '2', start: 6, end: 11, text: 'word2', color: 'yellow' },
      ];

      const result = normalizeAgainstText(ranges, text);
      expect(result).toHaveLength(2);
      expect(result[0].end).toBe(5);
      expect(result[1].start).toBe(6);
    });
  });
});
