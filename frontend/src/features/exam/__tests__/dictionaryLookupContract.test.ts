import { describe, expect, it } from 'vitest';
import { normalizeDictionaryLookupResponse } from '../api/dictionaryLookupContract';
import { buildDictionaryLookupRequest } from '../utils/dictionarySelection';
import type { SelectionState } from '../hooks/useTextSelection';

const rect = new DOMRect(10, 10, 80, 20);
const selection = (text: string, start: number, end: number): SelectionState => ({
  rect, text, start, end, documentId: 'reading-group-1', contentHash: 'hash-1',
  contextRevision: 4, contextKey: '42:4', scopeId: 'reading-group-1', scopeText: '',
});

describe('Practice dictionary contract', () => {
  it('builds a bounded context around the exact selected UTF-16 range', () => {
    const source = 'The old elms were planted beside the river.';
    const start = source.indexOf('elms');
    const request = buildDictionaryLookupRequest(selection('elms', start, start + 4), 7, 'en', source);
    expect(request).toMatchObject({
      partId: 7, documentId: 'reading-group-1', selectedText: 'elms',
      contextText: source,
    });
    expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('preserves Unicode selections and rejects out-of-range or oversized selections', () => {
    const source = 'Les arbres — café — grand';
    const start = source.indexOf('café');
    const request = buildDictionaryLookupRequest(selection('café', start, start + 4), 7, 'fr', source);
    expect(request.selectedText).toBe('café');
    expect(() => buildDictionaryLookupRequest(selection('outside', 0, 99), 7, source)).toThrow();
    expect(() => buildDictionaryLookupRequest(selection('one two three four five six', 0, 27), 7, source)).toThrow();
  });

  it('normalizes only a complete response matching the request identity', () => {
    const request = buildDictionaryLookupRequest(selection('elms', 4, 8), 7, 'en', 'The elms grow.');
    const raw = {
      requestId: request.requestId, attemptId: 42, partId: 7, documentId: request.documentId,
      selectedText: 'elms', sourceContext: 'The elms grow.', learningLanguage: 'en', meaningLanguage: 'vi',
      meaningVi: 'cây du', phonetic: null, partOfSpeech: 'noun', exampleEn: 'The elms grow.', exampleVi: 'Cây du mọc.',
    };
    const expected = { ...raw, contextText: request.contextText };
    expect(normalizeDictionaryLookupResponse({ success: true, data: raw }, request, 42)).toEqual(expected);
    expect(() => normalizeDictionaryLookupResponse({ success: true, data: { ...raw, attemptId: 43 } }, request, 42)).toThrow();
    expect(() => normalizeDictionaryLookupResponse({ success: true, data: { ...raw, meaningVi: '<script>x</script>' } }, request, 42)).toThrow();
    expect(() => normalizeDictionaryLookupResponse({ success: true, data: { ...raw, sourceContext: 'different passage' } }, request, 42)).toThrow();
  });
});
