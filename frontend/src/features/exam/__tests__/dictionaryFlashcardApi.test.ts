import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { addDictionaryFlashcard, createDictionaryDeck, DictionaryFlashcardDuplicateError, getDictionaryDecks } from '../api/dictionaryFlashcardApi';
import type { DictionaryLookupResponse } from '../types/api.types';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);
const ownedDeck = { id: 3, userId: 21, name: 'My words', targetLanguage: 'en', sourceLanguage: 'vi', isPublic: false };
const result: DictionaryLookupResponse = {
  requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', attemptId: 42, partId: 7, documentId: 'g1', selectedText: 'elms',
  contextText: 'The elms grow.', sourceContext: 'The elms grow.', learningLanguage: 'en', meaningLanguage: 'vi', meaningVi: 'cây du',
  phonetic: '/elm/', partOfSpeech: 'noun', exampleEn: 'Elms grow.', exampleVi: 'Cây du mọc.',
};

describe('dictionary Flashcard API adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists only private owner-owned en/vi decks', async () => {
    http.get.mockResolvedValue({ success: true, data: [ownedDeck, { ...ownedDeck, id: 4, userId: 22 }, { ...ownedDeck, id: 5, isPublic: true }, { ...ownedDeck, id: 6, targetLanguage: 'ja' }] } as never);
    await expect(getDictionaryDecks(21)).resolves.toEqual([ownedDeck]);
  });

  it('creates a private en/vi deck and stores verified meaning plus source context', async () => {
    http.post.mockResolvedValueOnce({ success: true, data: ownedDeck } as never);
    await createDictionaryDeck(21, 'My words');
    expect(http.post).toHaveBeenNthCalledWith(1, '/v1/vocab/decks', expect.objectContaining({ name: 'My words', targetLanguage: 'en', sourceLanguage: 'vi', isPublic: false }), expect.any(Object));
    http.post.mockResolvedValueOnce({ success: true, data: { id: 8, deckId: 3, customWord: 'elms', customMeaning: 'cây du', exampleSentence: 'The elms grow.' } } as never);
    await addDictionaryFlashcard(ownedDeck as any, 21, result);
    expect(http.post).toHaveBeenNthCalledWith(2, '/v1/vocab/decks/3/cards', {
      customWord: 'elms', customMeaning: 'cây du', exampleSentence: 'The elms grow.', phonetic: '/elm/', pos: 'noun',
    }, expect.any(Object));
  });

  it('maps only duplicate conflict 1210 and rejects malformed successful responses', async () => {
    http.post.mockRejectedValueOnce({ response: { data: { code: 1210 } } } as never);
    await expect(addDictionaryFlashcard(ownedDeck as any, 21, result)).rejects.toBeInstanceOf(DictionaryFlashcardDuplicateError);
    http.post.mockResolvedValueOnce({ success: true, data: { id: 8, deckId: 99, customWord: 'elms', customMeaning: 'cây du', exampleSentence: 'The elms grow.' } } as never);
    await expect(addDictionaryFlashcard(ownedDeck as any, 21, result)).rejects.toThrow(/dữ liệu bộ thẻ/i);
  });
});
