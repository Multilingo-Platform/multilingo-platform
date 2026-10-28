import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticeDictionaryPopover } from '../components/practice/PracticeDictionaryPopover';

const base = {
  word: '水', x: 150, y: 100, data: null, error: null, onClose: vi.fn(), onRetry: vi.fn(), onLookup: vi.fn(), ownerId: 21,
  learningLanguage: 'ja', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'ja'],
};

describe('PracticeDictionaryPopover', () => {
  it('RD07 native-only mode has no language selector or second lookup action', () => {
    render(<PracticeDictionaryPopover {...base} nativeOnly phase="loading" />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tra từ' })).toBeNull();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('opens idle with a meaning-language choice and only dispatches on explicit action', () => {
    render(<PracticeDictionaryPopover {...base} phase="idle" />);
    expect(screen.getByRole('dialog', { name: 'Tra từ AI: 水' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' })).toBeEnabled();
    expect(base.onLookup).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' }), { target: { value: 'ja' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ' }));
    expect(base.onLookup).toHaveBeenCalledExactlyOnceWith('ja');
  });

  it('renders the v2 definition as inert localized text and retries only after explicit click', () => {
    const props = { ...base, onRetry: vi.fn() };
    const { rerender } = render(<PracticeDictionaryPopover {...props} phase="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent(/đang tra nghĩa/i);
    rerender(<PracticeDictionaryPopover {...props} phase="ready" data={{
      requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', attemptId: 42, partId: 7, documentId: 'g1',
      selectedText: '水', sourceContext: '水は大切です。', definition: {
        schemaVersion: 2, learningLanguage: 'ja', meaningLanguage: 'vi', meaning: '<script>nước</script>',
        phonetic: null, partOfSpeech: null, example: '水は大切です。', exampleTranslation: 'Nước rất quan trọng.',
      },
    }} />);
    expect(screen.getByText('<script>nước</script>')).toBeInTheDocument();
    expect(screen.getAllByText('水は大切です。')[0]).toHaveAttribute('lang', 'ja');
    rerender(<PracticeDictionaryPopover {...props} phase="error" error={{ kind: 'request', message: 'Thử lại', retryAfterSeconds: null, retryable: true }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
});
