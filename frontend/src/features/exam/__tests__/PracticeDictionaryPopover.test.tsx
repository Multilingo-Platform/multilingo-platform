import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticeDictionaryPopover } from '../components/practice/PracticeDictionaryPopover';

describe('PracticeDictionaryPopover', () => {
  it('hides a cancelled lookup instead of showing a loading state without a request', () => {
    const props = { word: 'elms', x: 150, y: 100, data: null, error: null, onClose: vi.fn(), onRetry: vi.fn(), ownerId: 21 };
    const { rerender } = render(<PracticeDictionaryPopover {...props} phase="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<PracticeDictionaryPopover {...props} phase="idle" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('announces loading and shows AI result as text with manual retry on error', () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const props = { word: 'elms', x: 150, y: 100, data: null, onClose, onRetry, ownerId: 21 };
    const { rerender } = render(<PracticeDictionaryPopover {...props} phase="loading" error={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(/đang tra nghĩa/i);
    rerender(<PracticeDictionaryPopover {...props} phase="ready" error={null} data={{
      requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', attemptId: 42, partId: 7, documentId: 'g1',
      selectedText: 'elms', contextText: 'Elms grow.', sourceContext: 'Elms grow.', learningLanguage: 'en', meaningLanguage: 'vi',
      meaningVi: '<script>cây du</script>', phonetic: null, partOfSpeech: null, exampleEn: 'Elms grow.', exampleVi: 'Cây du mọc.',
    }} />);
    expect(screen.getByText('<script>cây du</script>')).toBeInTheDocument();
    expect(screen.queryByText('AI Vocab')).not.toBeInTheDocument();
    rerender(<PracticeDictionaryPopover {...props} phase="error" error={{ kind: 'request', message: 'Thử lại', retryAfterSeconds: null, retryable: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
