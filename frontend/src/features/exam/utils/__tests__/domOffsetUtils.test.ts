import { describe, it, expect } from 'vitest';
import { rangeToOffsets } from '../domOffsetUtils';

describe('domOffsetUtils', () => {
  it('calculates absolute text offsets accurately across HTML tags', () => {
    document.body.innerHTML = '<div id="container">Hello <b>world</b>!</div>';
    const container = document.getElementById('container')!;

    // select "o wo"
    const textNode1 = container.childNodes[0]; // "Hello "
    const textNode2 = container.childNodes[1].childNodes[0]; // "world"

    const range = document.createRange();
    range.setStart(textNode1, 4); // "o "
    range.setEnd(textNode2, 2); // "wo"

    const offsets = rangeToOffsets(container, range);
    expect(offsets).toEqual({ start: 4, end: 8 });
  });
});
