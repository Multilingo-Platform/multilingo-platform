import type { ApiResponse, DictionaryLookupRequest, DictionaryLookupResponse } from '../types/api.types';

export class DictionaryLookupContractError extends Error {
  constructor() {
    super('Phản hồi tra từ không hợp lệ. Vui lòng thử lại.');
    this.name = 'DictionaryLookupContractError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function positiveId(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 1 && value <= 2147483647;
}
function text(value: unknown, max: number, required = true): value is string | null {
  return (typeof value === 'string' && Array.from(value).length <= max && (!required || value.trim().length > 0)) ||
    (!required && value === null);
}
function plainText(value: string): boolean {
  return !/<\/?[a-z][^>]*>/i.test(value);
}

export function validateDictionaryLookupRequest(attemptId: number, request: DictionaryLookupRequest): void {
  const selected = Array.from(request?.selectedText ?? '');
  if (!positiveId(attemptId) || !UUID.test(request?.requestId ?? '') || !positiveId(request?.partId) ||
      typeof request?.documentId !== 'string' || !request.documentId.trim() || Array.from(request.documentId).length > 128 ||
      selected.length < 2 || selected.length > 80 || selected.length > 0 && selected.some(char => !/[\p{L}\p{M}'’\-\s]/u.test(char)) ||
      selected.filter(token => /[\p{L}\p{M}]/u.test(token)).length === 0 ||
      selected.join('').trim().split(/\s+/u).length > 5 ||
      typeof request.contextText !== 'string' || Array.from(request.contextText).length > 1000 ||
      !request.contextText.toLocaleLowerCase().includes(request.selectedText.toLocaleLowerCase())) {
    throw new DictionaryLookupContractError();
  }
}

export function normalizeDictionaryLookupResponse(
  raw: unknown,
  request: DictionaryLookupRequest,
  attemptId: number,
): DictionaryLookupResponse {
  const envelope = raw as ApiResponse<unknown>;
  const value = record(envelope) && envelope.success === true ? envelope.data : null;
  if (!record(value)) throw new DictionaryLookupContractError();
  const allowed = new Set([
    'requestId', 'attemptId', 'partId', 'documentId', 'selectedText', 'sourceContext',
    'learningLanguage', 'meaningLanguage', 'meaningVi', 'phonetic', 'partOfSpeech', 'exampleEn', 'exampleVi',
  ]);
  if (Object.keys(value).some(key => !allowed.has(key)) || value.requestId !== request.requestId ||
      value.attemptId !== attemptId || value.partId !== request.partId || value.documentId !== request.documentId ||
      value.selectedText !== request.selectedText || value.learningLanguage !== 'en' || value.meaningLanguage !== 'vi' ||
      !text(value.sourceContext, 1000) || !text(value.meaningVi, 1000) ||
      !text(value.phonetic, 150, false) || !text(value.partOfSpeech, 50, false) ||
      !text(value.exampleEn, 1000) || !text(value.exampleVi, 1000) ||
      !plainText(value.sourceContext as string) || !plainText(value.meaningVi as string) ||
      !plainText(value.exampleEn as string) || !plainText(value.exampleVi as string) ||
      !(value.sourceContext as string).toLocaleLowerCase().includes(request.selectedText.toLocaleLowerCase())) {
    throw new DictionaryLookupContractError();
  }
  return {
    requestId: value.requestId as string, attemptId: value.attemptId as number, partId: value.partId as number,
    documentId: value.documentId as string, selectedText: value.selectedText as string,
    contextText: request.contextText, sourceContext: value.sourceContext as string,
    learningLanguage: 'en', meaningLanguage: 'vi', meaningVi: value.meaningVi as string,
    phonetic: value.phonetic as string | null, partOfSpeech: value.partOfSpeech as string | null,
    exampleEn: value.exampleEn as string, exampleVi: value.exampleVi as string,
  };
}
