import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PracticeDictionaryPopover } from '../components/practice/PracticeDictionaryPopover';

const base = {
  word: '水', x: 150, y: 100, data: null, error: null, onClose: vi.fn(), onRetry: vi.fn(), onLookup: vi.fn(), ownerId: 21,
  learningLanguage: 'ja', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'ja'],
};

describe('PracticeDictionaryPopover', () => {
  it('grows from loading to a result and expanded context without retaining the previous height cap', async () => {
    const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (!this.hasAttribute('data-dictionary-popover')) return new DOMRect();
      const naturalHeight = this.querySelector('details[open]') ? 900 : this.querySelector('details') ? 600 : 140;
      const cap = Number.parseFloat(this.style.maxHeight);
      return new DOMRect(0, 0, 360, Number.isFinite(cap) ? Math.min(naturalHeight, cap) : naturalHeight);
    });
    const oldHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    try {
      const { rerender } = render(<PracticeDictionaryPopover {...base} ownerId={null} nativeOnly phase="loading" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog.style.maxHeight).toBe('140px');
      rerender(<PracticeDictionaryPopover {...base} ownerId={null} nativeOnly phase="ready" data={{
        requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', attemptId: 42, partId: 7,
        source: { kind: 'QUESTION_TEXT', questionId: 'q1' }, policyVersion: 'NATIVE_PROFILE_V1',
        selectedText: '水', sourceContext: '水は大切です。', definition: {
          schemaVersion: 2, learningLanguage: 'ja', meaningLanguage: 'vi', meaning: 'nước',
          phonetic: null, partOfSpeech: null, example: '水は大切です。', exampleTranslation: 'Nước rất quan trọng.',
        },
      }} />);
      expect(dialog.style.maxHeight).toBe('600px');
      dialog.querySelector('details')!.open = true;
      await waitFor(() => expect(dialog.style.maxHeight).toBe('776px'));
    } finally {
      measure.mockRestore();
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: oldHeight });
    }
  });
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

  it('keeps the popup within the visible viewport and recomputes its height on resize', () => {
    const oldWidth = window.innerWidth;
    const oldHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    const { unmount } = render(<PracticeDictionaryPopover {...base} x={350} y={490} phase="idle" />);
    const dialog = screen.getByRole('dialog');
    expect(Number.parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(dialog.style.top) + Number.parseFloat(dialog.style.maxHeight)).toBeLessThanOrEqual(488);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 300 });
    fireEvent.resize(window);
    expect(dialog.style.maxHeight).toBe('276px');
    expect(Number.parseFloat(dialog.style.top)).toBe(12);

    unmount();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: oldWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: oldHeight });
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

  it('renders quota exhaustion error with warning icon and helpful limit guidance', () => {
    const props = { ...base, onRetry: vi.fn() };
    render(<PracticeDictionaryPopover {...props} phase="error" error={{
      kind: 'quota',
      message: 'Bạn đã dùng hết lượt tra từ hôm nay.',
      retryAfterSeconds: null,
      retryable: false,
    }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/bạn đã dùng hết lượt tra từ hôm nay/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/hạn mức tra từ ai trong ngày đã hết/i);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
    const ctaLink = screen.getByRole('link', { name: /nâng cấp premium/i });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '/student/premium');
  });
});
