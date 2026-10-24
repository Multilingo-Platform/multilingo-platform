import { describe, expect, it } from 'vitest';
import { buildDictionaryLookupRequest } from '../utils/dictionarySelection';
import type { SelectionState } from '../hooks/useTextSelection';

function selection(text: string, scopeText: string): SelectionState {
  const start = scopeText.indexOf(text);
  return { rect: new DOMRect(), text, start, end: start + text.length, documentId: 'g1', contentHash: 'h1',
    contextRevision: 1, contextKey: 'attempt:1', scopeId: 'g1', scopeText };
}

describe('dictionary selection request', () => {
  it.each([['水', 'ja'], ['a', 'en'], ['I', 'en']])('accepts a one-code-point selection %s', (word, language) => {
    expect(buildDictionaryLookupRequest(selection(word, `Read ${word} here.`), 7, language).selectedText).toBe(word);
  });

  it('measures context limits by code point and keeps Unicode intact', () => {
    const word = '日本語';
    const request = buildDictionaryLookupRequest(selection(word, `${'語'.repeat(500)} ${word} ${'語'.repeat(500)}`), 7, 'ja');
    expect(Array.from(request.contextText).length).toBeLessThanOrEqual(1000);
    expect(request.contextText).toContain(word);
  });

  it('keeps the five-word cap for spaced languages but does not infer words in CJK', () => {
    const phrase = 'one two three four five six';
    expect(() => buildDictionaryLookupRequest(selection(phrase, phrase), 7, 'en')).toThrow();
    expect(buildDictionaryLookupRequest(selection('東京都の大学', '東京都の大学です。'), 7, 'ja').selectedText).toBe('東京都の大学');
  });
});
