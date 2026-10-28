import axiosClient from '../../../core/api/axiosClient';
import type { CreateDeckRequest, CreateFlashcardRequest, DeckSummary, Flashcard } from '../../vocab/types/vocab.types';
import type { DictionaryResult } from '../types/api.types';
import { canonicalizeLearningLanguage } from '../../../core/i18n/learningLanguages';

const FLASHCARD_TIMEOUT_MS = 15_000;
export class DictionaryFlashcardDuplicateError extends Error {
  constructor() { super('Từ đã có trong bộ thẻ này.'); this.name = 'DictionaryFlashcardDuplicateError'; }
}
export class DictionaryFlashcardSaveUncertainError extends Error {
  constructor() { super('Chưa xác nhận được việc lưu. Kiểm tra bộ thẻ trước khi thử lại.'); this.name = 'DictionaryFlashcardSaveUncertainError'; }
}
class DictionaryFlashcardContractError extends Error {
  constructor() { super('Dữ liệu bộ thẻ không hợp lệ.'); this.name = 'DictionaryFlashcardContractError'; }
}
function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}
function record(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function eligibleDeck(value: unknown, ownerId: number, targetLanguage: string, sourceLanguage: string): value is DeckSummary {
  return record(value) && positiveId(value.id) && value.userId === ownerId && value.isPublic === false &&
    canonicalizeLearningLanguage(value.targetLanguage) === targetLanguage &&
    canonicalizeLearningLanguage(value.sourceLanguage) === sourceLanguage && typeof value.name === 'string';
}
async function request<T>(execute: (signal: AbortSignal) => Promise<T>, uncertainOnTimeout = false): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(uncertainOnTimeout ? new DictionaryFlashcardSaveUncertainError() : new Error('Yêu cầu danh sách bộ thẻ quá thời gian.'));
    }, FLASHCARD_TIMEOUT_MS);
  });
  try { return await Promise.race([deadline, execute(controller.signal)]); }
  finally { clearTimeout(timer); }
}
function unwrap<T>(raw: unknown): T {
  if (!record(raw) || raw.success !== true || raw.data == null) throw new DictionaryFlashcardContractError();
  return raw.data as T;
}

export async function getDictionaryDecks(ownerId: number, targetLanguage: string, sourceLanguage: string): Promise<DeckSummary[]> {
  const target = canonicalizeLearningLanguage(targetLanguage);
  const source = canonicalizeLearningLanguage(sourceLanguage);
  if (!positiveId(ownerId) || !target || !source) throw new DictionaryFlashcardContractError();
  const raw = await request(signal => axiosClient.get<unknown, unknown>('/v1/vocab/decks', { signal, timeout: FLASHCARD_TIMEOUT_MS }));
  const data = unwrap<unknown>(raw);
  if (!Array.isArray(data) || data.some(item => !record(item) || !positiveId(item.id) ||
      !Number.isSafeInteger(item.userId) || typeof item.name !== 'string' || typeof item.targetLanguage !== 'string' ||
      typeof item.sourceLanguage !== 'string' || typeof item.isPublic !== 'boolean')) throw new DictionaryFlashcardContractError();
  return data.filter((item): item is DeckSummary => eligibleDeck(item, ownerId, target, source));
}

export async function createDictionaryDeck(ownerId: number, name: string, targetLanguage: string, sourceLanguage: string): Promise<DeckSummary> {
  const target = canonicalizeLearningLanguage(targetLanguage);
  const source = canonicalizeLearningLanguage(sourceLanguage);
  if (!positiveId(ownerId) || !target || !source || !name.trim() || Array.from(name).length > 100) throw new DictionaryFlashcardContractError();
  const body: CreateDeckRequest = { name: name.trim(), description: 'Từ vựng lưu từ bài đọc', targetLanguage: target, sourceLanguage: source, isPublic: false };
  const raw = await request(signal => axiosClient.post<unknown, unknown>('/v1/vocab/decks', body, { signal, timeout: FLASHCARD_TIMEOUT_MS }), true);
  const deck = unwrap<unknown>(raw);
  if (!eligibleDeck(deck, ownerId, target, source)) throw new DictionaryFlashcardContractError();
  return deck;
}

export async function addDictionaryFlashcard(deck: DeckSummary, ownerId: number, result: DictionaryResult): Promise<Flashcard> {
  const target = canonicalizeLearningLanguage(result.definition.learningLanguage);
  const source = canonicalizeLearningLanguage(result.definition.meaningLanguage);
  if (!target || !source || !eligibleDeck(deck, ownerId, target, source)) throw new DictionaryFlashcardContractError();
  const body: CreateFlashcardRequest = {
    customWord: result.selectedText, customMeaning: result.definition.meaning, exampleSentence: result.sourceContext,
    phonetic: result.definition.phonetic ?? undefined, pos: result.definition.partOfSpeech ?? undefined,
  };
  let raw: unknown;
  try {
    raw = await request(signal => axiosClient.post<unknown, unknown>(`/v1/vocab/decks/${deck.id}/cards`, body, { signal, timeout: FLASHCARD_TIMEOUT_MS }), true);
  } catch (error) {
    if ((error as any)?.response?.data?.code === 1210) throw new DictionaryFlashcardDuplicateError();
    throw error;
  }
  const card = unwrap<unknown>(raw);
  if (!record(card) || !positiveId(card.id) || card.deckId !== deck.id || card.customWord !== body.customWord ||
      card.customMeaning !== body.customMeaning || card.exampleSentence !== body.exampleSentence) throw new DictionaryFlashcardContractError();
  return card as Flashcard;
}
