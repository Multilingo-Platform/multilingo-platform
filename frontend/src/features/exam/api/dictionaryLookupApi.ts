import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse, DictionaryLookupRequest, DictionaryLookupResponse } from '../types/api.types';
import { normalizeDictionaryLookupResponse, validateDictionaryLookupRequest } from './dictionaryLookupContract';

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
