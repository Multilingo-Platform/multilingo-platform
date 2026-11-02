const SENTENCE_END = /(?<=[.!?])\s+|(?<=[。！？])(?![。！？])\s*/u;

export function compactFlashcardExample(value: string | null | undefined, word: string, maxCodePoints = 320): string {
  const normalized = value?.replace(/\s+/gu, ' ').trim() ?? '';
  if (!normalized || maxCodePoints <= 0) return '';
  const points = Array.from(normalized);
  if (points.length <= maxCodePoints) return normalized;

  const needle = word.trim().toLocaleLowerCase();
  const index = needle ? normalized.toLocaleLowerCase().indexOf(needle) : -1;
  if (index < 0) return `${points.slice(0, maxCodePoints - 1).join('')}…`;

  const before = Array.from(normalized.slice(0, index));
  const match = Array.from(normalized.slice(index, index + needle.length));
  const after = Array.from(normalized.slice(index + needle.length));
  if (match.length >= maxCodePoints) return `${match.slice(0, maxCodePoints - 1).join('')}…`;
  const innerLimit = Math.max(1, maxCodePoints - 2);
  const beforeLimit = Math.min(before.length, Math.floor(innerLimit / 2));
  const afterLimit = Math.min(after.length, innerLimit - beforeLimit);
  let start = Math.max(0, before.length - beforeLimit);
  let end = Math.min(after.length, afterLimit);
  let selected = [...(start > 0 ? ['…'] : []), ...before.slice(start), ...match, ...after.slice(0, end), ...(end < after.length ? ['…'] : [])];
  while (selected.length > maxCodePoints) {
    if (before.length - start > after.length - end) start++;
    else end--;
    selected = [...(start > 0 ? ['…'] : []), ...before.slice(start), ...match, ...after.slice(0, end), ...(end < after.length ? ['…'] : [])];
  }
  return selected.join('');
}

function sentenceContaining(value: string, word: string): string | null {
  const sentences = value.split(SENTENCE_END).map(sentence => sentence.trim()).filter(Boolean);
  const needle = word.toLocaleLowerCase();
  return sentences.find(sentence => sentence.toLocaleLowerCase().includes(needle)) ?? null;
}

export function selectFlashcardExample(word: string, aiExample?: string | null, sourceContext?: string | null): string {
  if (aiExample?.trim()) {
    const sentence = sentenceContaining(aiExample, word) ?? aiExample.trim();
    return compactFlashcardExample(sentence, word);
  }
  if (!sourceContext?.trim()) return '';
  const sentence = sentenceContaining(sourceContext, word) ?? sourceContext.trim();
  return compactFlashcardExample(sentence, word);
}
