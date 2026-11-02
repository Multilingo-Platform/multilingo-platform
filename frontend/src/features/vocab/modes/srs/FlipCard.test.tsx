import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlipCard } from './FlipCard';

vi.mock('../../components/common/SpeakButton', () => ({ SpeakButton: () => <button type="button">Play</button> }));

describe('FlipCard', () => {
  it('shows only the legacy source sentence that contains the studied word', () => {
    const fullSentence = 'The previous sentence has unrelated context and a lot of extra information. Learn from this concise sentence. Another sentence follows.';
    render(<FlipCard card={{ id: 2, customWord: 'learn', customMeaning: 'học', fullSentence, reviewCount: 0, status: 'NEW' }}
      targetLanguage="en" isFlipped onFlip={vi.fn()} />);
    expect(screen.getByText('“Learn from this concise sentence.”')).toBeInTheDocument();
  });

  it('keeps a legacy long example inside the card and preserves the target word', () => {
    const fullSentence = `${'🌱 '.repeat(200)}elms${' tree'.repeat(100)}`;
    render(<FlipCard card={{ id: 1, customWord: 'elms', customMeaning: 'cây du', fullSentence, reviewCount: 0, status: 'NEW' }}
      targetLanguage="en" isFlipped onFlip={vi.fn()} />);
    const example = screen.getByText(/^“.*”$/);
    const renderedExample = example.textContent?.slice(1, -1) ?? '';
    expect(Array.from(renderedExample)).toHaveLength(320);
    expect(renderedExample).toContain('elms');
    expect(example.closest('.overflow-y-auto')).toBeInTheDocument();
  });
});
