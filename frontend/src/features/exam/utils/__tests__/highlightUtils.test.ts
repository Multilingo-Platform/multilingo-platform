import { describe, it, expect } from 'vitest';
import { normalize, removeAt, type Highlight } from '../highlightUtils';

describe('highlightUtils', () => {
  it('merges overlapping and adjacent ranges', () => {
    const ranges: Highlight[] = [
      { id: '1', start: 10, end: 20, text: 'abc' },
      { id: '2', start: 15, end: 25, text: 'def' }, // overlaps 1
      { id: '3', start: 25, end: 30, text: 'ghi' }, // adjacent to 2
      { id: '4', start: 40, end: 50, text: 'jkl' }, // separate
    ];

    const result = normalize(ranges);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(10);
    expect(result[0].end).toBe(30);
    expect(result[0].id).toBe('1');
    expect(result[1].start).toBe(40);
    expect(result[1].end).toBe(50);
  });

  it('removes the highlight containing the offset', () => {
    const ranges: Highlight[] = [
      { id: '1', start: 10, end: 30, text: 'abc' },
      { id: '2', start: 40, end: 50, text: 'def' },
    ];

    const result = removeAt(ranges, 15);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('does not mutate inputs and derives merged text from the canonical passage', async () => {
    const { normalizeAgainstText } = await import('../highlightUtils');
    const ranges: Highlight[] = [
      { id: 'first', start: 0, end: 3, text: 'wrong' },
      { id: 'second', start: 3, end: 6, text: 'also wrong' },
    ];
    const before = structuredClone(ranges);

    const result = normalizeAgainstText(ranges, 'abcdef');

    expect(result).toEqual([{ id: 'first', start: 0, end: 6, text: 'abcdef', color: 'yellow' }]);
    expect(ranges).toEqual(before);
  });

  it('drops invalid or out-of-bounds ranges when normalizing against a document', async () => {
    const { normalizeAgainstText } = await import('../highlightUtils');
    expect(normalizeAgainstText([
      { id: 'nan', start: Number.NaN, end: 2, text: '' },
      { id: 'negative', start: -1, end: 2, text: '' },
      { id: 'outside', start: 1, end: 9, text: '' },
      { id: 'empty', start: 2, end: 2, text: '' },
      { id: 'ok', start: 0, end: 2, text: 'x' },
    ], 'ab')).toEqual([{ id: 'ok', start: 0, end: 2, text: 'ab', color: 'yellow' }]);
  });

  it('rejects UTF-16 ranges that split an emoji while keeping neighbouring Unicode unchanged', async () => {
    const { normalizeAgainstText } = await import('../highlightUtils');
    const text = '水😀e\u0301';
    expect(normalizeAgainstText([{ id: 'broken', start: 1, end: 2, text: '' }], text)).toEqual([]);
    expect(normalizeAgainstText([{ id: 'valid', start: 1, end: 3, text: '' }], text))
      .toEqual([{ id: 'valid', start: 1, end: 3, text: '😀', color: 'yellow' }]);
  });
});
