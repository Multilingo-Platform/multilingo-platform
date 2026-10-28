import { normalizeDictionaryLookupV3Response, validateSource, DictionaryLookupV3ContractError } from './dictionaryLookupV3Contract';
import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse, DictionaryLookupRequest, DictionaryLookupResponse, DictionaryLookupV2Request, DictionaryLookupV2Response } from '../types/api.types';
import { normalizeDictionaryLookupResponse, validateDictionaryLookupRequest } from './dictionaryLookupContract';
import { normalizeDictionaryLookupV2Response, validateDictionaryLookupV2Request } from './dictionaryLookupV2Contract';

export const DICTIONARY_LOOKUP_TIMEOUT_MS = 40_000;

async function bounded<T>(execute: (signal: AbortSignal) => Promise<T>, external?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortExternal: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    abortExternal = () => { controller.abort(); reject(new DOMException('Request aborted', 'AbortError')); };
    external?.addEventListener('abort', abortExternal, { once: true });
    if (external?.aborted) abortExternal();
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Tra từ quá thời gian. Vui lòng thử lại.'));
    }, DICTIONARY_LOOKUP_TIMEOUT_MS);
  });
  try {
    if (controller.signal.aborted) return await deadline;
    return await Promise.race([deadline, execute(controller.signal)]);
  } finally {
    clearTimeout(timer);
    if (abortExternal) external?.removeEventListener('abort', abortExternal);
  }
}

export async function lookupPracticeDictionary(
  attemptId: number,
  request: DictionaryLookupRequest,
  options?: { signal?: AbortSignal },
): Promise<DictionaryLookupResponse> {
  validateDictionaryLookupRequest(attemptId, request);
  const response = await bounded(signal => axiosClient.post<unknown, ApiResponse<unknown>>(
    `/v1/attempts/${attemptId}/dictionary-lookups`, request,
    { signal, timeout: DICTIONARY_LOOKUP_TIMEOUT_MS },
  ), options?.signal);
  return normalizeDictionaryLookupResponse(response, request, attemptId);
}

export async function lookupPracticeDictionaryV2(
  attemptId: number,
  request: DictionaryLookupV2Request,
  options: { signal?: AbortSignal; learningLanguage: string },
): Promise<DictionaryLookupV2Response> {
  validateDictionaryLookupV2Request(attemptId, request);
  const response = await bounded(signal => axiosClient.post<unknown, ApiResponse<unknown>>(
    `/v2/attempts/${attemptId}/dictionary-lookups`, request,
    { signal, timeout: DICTIONARY_LOOKUP_TIMEOUT_MS },
  ), options.signal);
  return normalizeDictionaryLookupV2Response(response, request, attemptId, options.learningLanguage);
}

export async function lookupPracticeDictionaryV3(attemptId: number, request: import('../types/api.types').DictionaryLookupV3Request,
  options: { signal?: AbortSignal; learningLanguage: string; nativeLanguage: string }) {
  validateSource(request.source);
  if (Object.keys(request).some(key => !['requestId','partId','source','selectedText','contextText'].includes(key))) throw new DictionaryLookupV3ContractError();
  validateDictionaryLookupV2Request(attemptId, { ...request, documentId: 'v3' });
  const response = await bounded(signal => axiosClient.post<unknown, ApiResponse<unknown>>(
    `/v3/attempts/${attemptId}/dictionary-lookups`, request, { signal, timeout: DICTIONARY_LOOKUP_TIMEOUT_MS }), options.signal);
  return normalizeDictionaryLookupV3Response(response, request, attemptId, options.learningLanguage, options.nativeLanguage);
}
