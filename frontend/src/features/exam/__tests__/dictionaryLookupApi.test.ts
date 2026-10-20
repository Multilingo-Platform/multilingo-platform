import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { lookupPracticeDictionary, DICTIONARY_LOOKUP_TIMEOUT_MS } from '../api/dictionaryLookupApi';
import type { DictionaryLookupRequest } from '../types/api.types';

vi.mock('../../../core/api/axiosClient', () => ({ default: { post: vi.fn() } }));
const post = vi.mocked(axiosClient.post);
const request: DictionaryLookupRequest = {
  requestId: 'a3f5b750-a7c8-4a4f-8328-4775b3d87d61', partId: 7, documentId: 'group-7',
  selectedText: 'elms', contextText: 'The elms grow.' ,
};
function response() {
  return { success: true, data: {
    requestId: request.requestId, attemptId: 42, partId: 7, documentId: 'group-7', selectedText: 'elms',
    sourceContext: 'The elms grow.', learningLanguage: 'en', meaningLanguage: 'vi', meaningVi: 'cây du',
    phonetic: null, partOfSpeech: 'noun', exampleEn: 'Elms grow.', exampleVi: 'Cây du mọc.',
  } };
}

describe('dictionary lookup API', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('posts the exact request with a bounded signal and normalizes the envelope', async () => {
    post.mockResolvedValue(response() as never);
    const result = await lookupPracticeDictionary(42, request);
    expect(post).toHaveBeenCalledWith('/v1/attempts/42/dictionary-lookups', request, expect.objectContaining({
      timeout: DICTIONARY_LOOKUP_TIMEOUT_MS, signal: expect.any(AbortSignal),
    }));
    expect(result.meaningVi).toBe('cây du');
  });

  it('rejects a stalled request at the 40-second deadline and honors cancellation', async () => {
    vi.useFakeTimers();
    post.mockReturnValue(new Promise(() => {}) as never);
    const pending = lookupPracticeDictionary(42, request);
    const assertion = expect(pending).rejects.toThrow(/quá thời gian/i);
    await vi.advanceTimersByTimeAsync(DICTIONARY_LOOKUP_TIMEOUT_MS);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
