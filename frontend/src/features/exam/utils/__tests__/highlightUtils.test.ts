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
});
