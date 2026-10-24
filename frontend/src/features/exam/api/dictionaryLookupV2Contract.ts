import { canonicalizeLearningLanguage } from '../../../core/i18n/learningLanguages';
import type { DictionaryLookupV2Request, DictionaryLookupV2Response } from '../types/api.types';

export class DictionaryLookupV2ContractError extends Error {
  constructor() {
    super('Phản hồi tra từ không hợp lệ. Vui lòng thử lại.');
    this.name = 'DictionaryLookupV2ContractError';
  }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESPONSE_FIELDS = new Set([
  'requestId', 'attemptId', 'partId', 'documentId', 'selectedText', 'sourceContext', 'definition',
]);
const DEFINITION_FIELDS = new Set([
  'schemaVersion', 'learningLanguage', 'meaningLanguage', 'meaning', 'phonetic', 'partOfSpeech', 'example', 'exampleTranslation',
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function boundedText(value: unknown, max: number, nullable = false): value is string | null {
  return (typeof value === 'string' && Array.from(value).length <= max && value.trim().length > 0) ||
    (nullable && value === null);
}

function hasNoMarkup(value: string): boolean {
  return !/<\/?[a-z][^>]*>/i.test(value);
}

export function validateDictionaryLookupV2Request(attemptId: number, request: DictionaryLookupV2Request): void {
  const selected = Array.from(request?.selectedText ?? '');
  if (!positiveId(attemptId) || !record(request) || !UUID_V4.test(request.requestId) || !positiveId(request.partId) ||
      typeof request.documentId !== 'string' || request.documentId.trim().length === 0 || Array.from(request.documentId).length > 128 ||
      selected.length < 1 || selected.length > 80 || typeof request.contextText !== 'string' ||
      Array.from(request.contextText).length > 1000 || !request.contextText.toLocaleLowerCase().includes(request.selectedText.toLocaleLowerCase()) ||
      (request.meaningLanguage !== undefined && !canonicalizeLearningLanguage(request.meaningLanguage))) {
    throw new DictionaryLookupV2ContractError();
  }
}

export function normalizeDictionaryLookupV2Response(
  raw: unknown,
  request: DictionaryLookupV2Request,
  attemptId: number,
  expectedLearningLanguage: string,
): DictionaryLookupV2Response {
  if (!record(raw) || raw.success !== true || !record(raw.data)) throw new DictionaryLookupV2ContractError();
  const value = raw.data;
  const definition = value.definition;
  const expectedSource = canonicalizeLearningLanguage(expectedLearningLanguage);
  if (!record(definition) || Object.keys(value).some(key => !RESPONSE_FIELDS.has(key)) ||
      Object.keys(definition).some(key => !DEFINITION_FIELDS.has(key)) || !expectedSource ||
      value.requestId !== request.requestId || value.attemptId !== attemptId || value.partId !== request.partId ||
      value.documentId !== request.documentId || value.selectedText !== request.selectedText ||
      !boundedText(value.sourceContext, 1000) || !hasNoMarkup(value.sourceContext as string) ||
      !(value.sourceContext as string).toLocaleLowerCase().includes(request.selectedText.toLocaleLowerCase()) ||
      definition.schemaVersion !== 2 || definition.learningLanguage !== expectedSource ||
      !canonicalizeLearningLanguage(definition.meaningLanguage) ||
      (request.meaningLanguage !== undefined && canonicalizeLearningLanguage(request.meaningLanguage) !== definition.meaningLanguage) ||
      !boundedText(definition.meaning, 1000) || !boundedText(definition.phonetic, 150, true) ||
      !boundedText(definition.partOfSpeech, 50, true) || !boundedText(definition.example, 1000) ||
      !boundedText(definition.exampleTranslation, 1000) ||
      ![definition.meaning, definition.example, definition.exampleTranslation].every(text => hasNoMarkup(text as string))) {
    throw new DictionaryLookupV2ContractError();
  }

  return {
    requestId: value.requestId as string,
    attemptId: value.attemptId as number,
    partId: value.partId as number,
    documentId: value.documentId as string,
    selectedText: value.selectedText as string,
    sourceContext: value.sourceContext as string,
    definition: {
      schemaVersion: 2,
      learningLanguage: definition.learningLanguage as string,
      meaningLanguage: canonicalizeLearningLanguage(definition.meaningLanguage) as string,
      meaning: definition.meaning as string,
      phonetic: definition.phonetic as string | null,
      partOfSpeech: definition.partOfSpeech as string | null,
      example: definition.example as string,
      exampleTranslation: definition.exampleTranslation as string,
    },
  };
}
