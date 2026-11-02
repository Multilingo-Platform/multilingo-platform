import { describe, expect, it } from 'vitest';
import { compactFlashcardExample, selectFlashcardExample } from '../flashcardExample';

describe('flashcard example selection', () => {
  it.each([
    ['水', '説明です。水は大切です。次の文です。', '水は大切です。'],
    ['学习', '你好！我们学习中文。再见！', '我们学习中文。'],
    ['水', '説明です！？水は大切です！次の文です。', '水は大切です！'],
  ])('selects only the sentence containing %s without requiring spaces after CJK punctuation', (word, context, expected) => {
    expect(selectFlashcardExample(word, null, context)).toBe(expected);
  });
  it('prefers the AI example and falls back to the source sentence containing the word', () => {
    expect(selectFlashcardExample('elms', 'Elms grow in the park.', 'Before. The elms grow here. After.')).toBe('Elms grow in the park.');
    expect(selectFlashcardExample('elms', '', 'Before. The elms grow here. After.')).toBe('The elms grow here.');
  });

  it('limits examples to 320 Unicode code points and keeps the selected word', () => {
    const value = `${'🌱 '.repeat(200)}elms${' tree'.repeat(100)}`;
    const result = compactFlashcardExample(value, 'elms');
    expect(Array.from(result)).toHaveLength(320);
    expect(result).toContain('elms');
  });

  it('still respects the cap when the selected text itself exceeds the example limit', () => {
    const longSelection = 'word'.repeat(90);
    const result = compactFlashcardExample(`before ${longSelection} after`, longSelection);
    expect(Array.from(result)).toHaveLength(320);
    expect(result.endsWith('…')).toBe(true);
  });
});
