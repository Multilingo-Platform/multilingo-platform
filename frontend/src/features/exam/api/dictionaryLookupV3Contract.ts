import type { DictionaryLookupV3Request, DictionaryLookupV3Response } from '../types/api.types';
import { normalizeDictionaryLookupV2Response, DictionaryLookupV2ContractError } from './dictionaryLookupV2Contract';
import { workspaceTextSourceKey } from '../utils/workspaceTextDocuments';
import { canonicalizeLearningLanguage } from '../../../core/i18n/learningLanguages';

export class DictionaryLookupV3ContractError extends DictionaryLookupV2ContractError {}
export function validateSource(source: unknown): asserts source is DictionaryLookupV3Request['source'] {
  if (!source || typeof source !== 'object') throw new DictionaryLookupV3ContractError();
  const s = source as Record<string, unknown>;
  const ids = s.kind === 'OPTION_TEXT' ? ['questionId', 'optionId'] : s.kind === 'QUESTION_TEXT' ? ['questionId']
    : s.kind === 'GROUP_CONTENT' || s.kind === 'GROUP_INSTRUCTION' ? ['groupId']
    : ['PART_TITLE', 'PART_CONTENT', 'PART_INSTRUCTION'].includes(String(s.kind)) ? [] : null;
  if (!ids || Object.keys(s).length !== ids.length + 1 || ids.some(id => typeof s[id] !== 'string' || !(s[id] as string).trim() || (s[id] as string).trim() !== s[id] || Array.from(s[id] as string).some(char => char.codePointAt(0)! < 32 || (char.codePointAt(0)! >= 127 && char.codePointAt(0)! <= 159)) || (s[id] as string).length > 128)
    || Object.keys(s).some(key => key !== 'kind' && !ids.includes(key))) throw new DictionaryLookupV3ContractError();
}
export function normalizeDictionaryLookupV3Response(raw: unknown, request: DictionaryLookupV3Request, attemptId: number, learningLanguage: string, nativeLanguage: string): DictionaryLookupV3Response {
  if (!canonicalizeLearningLanguage(nativeLanguage)) throw new DictionaryLookupV3ContractError();
  const envelope = raw as { success?: boolean; data?: Record<string, unknown> } | null;
  const value = envelope?.data;
  if (!value || value.policyVersion !== 'NATIVE_PROFILE_V1' || Object.keys(value).some(key => !['requestId','attemptId','partId','source','selectedText','sourceContext','policyVersion','definition'].includes(key))) throw new DictionaryLookupV3ContractError();
  validateSource(value.source);
  if (workspaceTextSourceKey(value.source) !== workspaceTextSourceKey(request.source)) throw new DictionaryLookupV3ContractError();
  const { source, policyVersion: _policy, ...rest } = value;
  const legacy = normalizeDictionaryLookupV2Response({ success: envelope?.success, data: { ...rest, documentId: 'v3' } },
    { ...request, documentId: 'v3', meaningLanguage: nativeLanguage }, attemptId, learningLanguage);
  const { documentId: _documentId, ...result } = legacy;
  return { ...result, source, policyVersion: 'NATIVE_PROFILE_V1' };
}
