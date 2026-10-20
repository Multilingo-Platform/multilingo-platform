import type { DictionaryLookupRequest } from '../types/api.types';
import type { SelectionState } from '../hooks/useTextSelection';

export class DictionarySelectionError extends Error {
  constructor() {
    super('Chọn một từ hoặc cụm từ ngắn trong đoạn đọc để tra.');
    this.name = 'DictionarySelectionError';
  }
}

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new DictionarySelectionError();
  return globalThis.crypto.randomUUID().toLowerCase();
}

function contextAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const left = Array.from(before).slice(-450).join('');
  const right = Array.from(after).slice(0, 450).join('');
  return `${left}${selected}${right}`.replace(/\s+/gu, ' ').trim().slice(0, 1000);
}

export function buildDictionaryLookupRequest(
  selection: SelectionState,
  partId: number,
  sourceText = selection.scopeText ?? '',
): DictionaryLookupRequest {
  const selectedText = selection.text;
  const selectedLength = Array.from(selectedText).length;
  const exactText = sourceText.slice(selection.start, selection.end);
  const wordCount = selectedText.trim().split(/\s+/u).filter(Boolean).length;
  if (!Number.isSafeInteger(partId) || partId < 1 || partId > 2147483647 || !selection.documentId ||
      selectedLength < 2 || selectedLength > 80 || wordCount > 5 || !/^[\p{L}\p{M}'’\-\s]+$/u.test(selectedText) ||
      exactText !== selectedText || !sourceText.trim()) throw new DictionarySelectionError();
  const contextText = contextAround(sourceText, selection.start, selection.end);
  if (Array.from(contextText).length > 1000 || !contextText.toLocaleLowerCase().includes(selectedText.toLocaleLowerCase())) {
    throw new DictionarySelectionError();
  }
  return {
    requestId: uuid(), partId, documentId: selection.documentId,
    selectedText, contextText,
  };
}
