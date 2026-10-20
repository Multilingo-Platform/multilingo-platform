import { describe, expect, it } from 'vitest';
import { prepareReadingDocument } from '../readingHighlightDocument';

describe('prepareReadingDocument', () => {
  it('prepares one sanitized, stable HTML/text/hash representation and strips old highlight markers', () => {
    const prepared = prepareReadingDocument(
      '<p>Hello <b>thế giới 👋</b> &amp; tree</p><script>bad()</script><mark data-hl-id="old">old</mark>'
    );

    expect(prepared.html).not.toContain('<script');
    expect(prepared.html).not.toContain('data-hl-id');
    expect(prepared.text).toContain('Hello thế giới 👋 & tree');
    expect(prepared.contentHash).toBeTruthy();
    expect(prepareReadingDocument(prepared.html).contentHash).toBe(prepared.contentHash);
  });

  it('keeps passage text and table/image structure while excluding executable media', () => {
    const prepared = prepareReadingDocument(
      '<table><tbody><tr><td>New York</td></tr></tbody></table><img src="/chart.png"><iframe src="https://bad.test"></iframe>'
    );
    expect(prepared.text).toContain('New York');
    expect(prepared.html).toContain('<table');
    expect(prepared.html).toContain('<img');
    expect(prepared.html).not.toContain('iframe');
  });
});
