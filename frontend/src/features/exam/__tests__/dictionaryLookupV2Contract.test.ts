import { describe, expect, it } from 'vitest';
import {
  normalizeDictionaryLookupV2Response,
  validateDictionaryLookupV2Request,
} from '../api/dictionaryLookupV2Contract';
import type { DictionaryLookupV2Request } from '../types/api.types';

const request: DictionaryLookupV2Request = {
  requestId: 'a3f5b750-a7c8-4a4f-8328-4775b3d87d61',
  partId: 7,
  documentId: 'group-7',
  selectedText: 'elms',
  contextText: 'The elms grow beside the river.',
  meaningLanguage: 'fr-CA',
};

function response(overrides: Record<string, unknown> = {}) {
  return { success: true, data: {
    requestId: request.requestId,
    attemptId: 42,
    partId: 7,
    documentId: 'group-7',
    selectedText: 'elms',
    sourceContext: 'The elms grow beside the river.',
    definition: {
      schemaVersion: 2,
      learningLanguage: 'en',
      meaningLanguage: 'fr-CA',
      meaning: 'ormes',
      phonetic: null,
      partOfSpeech: 'noun',
      example: 'The elms grow by the river.',
      exampleTranslation: 'Les ormes poussent près de la rivière.',
    },
    ...overrides,
  } };
}

describe('Dictionary v2 contract', () => {
  it('projects the nested schema-v2 definition after matching operation identity and languages', () => {
    const normalized = normalizeDictionaryLookupV2Response(response(), request, 42, 'en');
    expect(normalized.definition).toEqual(expect.objectContaining({
      schemaVersion: 2,
      learningLanguage: 'en',
      meaningLanguage: 'fr-CA',
      meaning: 'ormes',
      example: 'The elms grow by the river.',
      exampleTranslation: 'Les ormes poussent près de la rivière.',
    }));
    expect(normalized).not.toHaveProperty('meaningVi');
  });

  it.each([
    ['wrong request id', response({ requestId: 'other' })],
    ['wrong part', response({ partId: 8 })],
    ['wrong document', response({ documentId: 'other-group' })],
    ['legacy v1 fields', { success: true, data: { ...response().data,
      definition: { schemaVersion: 1, learningLanguage: 'en', meaningLanguage: 'fr', meaning: 'ormes' } } }],
    ['wrong meaning language', response({ definition: { ...response().data.definition, meaningLanguage: 'de' } })],
    ['extra private field', response({ definition: { ...response().data.definition, internalPrompt: 'secret' } })],
  ])('rejects %s', (_case, payload) => {
    expect(() => normalizeDictionaryLookupV2Response(payload, request, 42, 'en')).toThrow();
  });

  it('validates meaning-language intent before transport', () => {
    expect(() => validateDictionaryLookupV2Request(42, { ...request, meaningLanguage: 'fre' })).toThrow();
    expect(() => validateDictionaryLookupV2Request(42, { ...request, meaningLanguage: 'fr-CA' })).not.toThrow();
  });
});
