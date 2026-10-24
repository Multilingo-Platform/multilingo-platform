import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DictionaryFlashcardForm } from '../components/practice/DictionaryFlashcardForm';
import * as api from '../api/dictionaryFlashcardApi';
import type { DictionaryLookupV2Response } from '../types/api.types';

vi.mock('../api/dictionaryFlashcardApi', async importOriginal => ({
  ...await importOriginal<typeof import('../api/dictionaryFlashcardApi')>(),
  getDictionaryDecks: vi.fn(), createDictionaryDeck: vi.fn(), addDictionaryFlashcard: vi.fn(),
}));
const deck = { id: 3, userId: 21, name: 'My words', targetLanguage: 'en', sourceLanguage: 'vi', isPublic: false,
  totalCards: 2, newCards: 2, learningCards: 0, masteredCards: 0, dueTodayCards: 0 };
const definition: DictionaryLookupV2Response = {
  requestId: 'f98eb3d0-808c-4cc0-88d0-d8f94f1a7347', attemptId: 42, partId: 7, documentId: 'g1', selectedText: 'elms',
  sourceContext: 'The elms grow.', definition: { schemaVersion: 2, learningLanguage: 'en', meaningLanguage: 'vi', meaning: 'cây du',
    phonetic: '/elm/', partOfSpeech: 'noun', example: 'Elms grow.', exampleTranslation: 'Cây du mọc.' },
};

describe('DictionaryFlashcardForm', () => {
  it('clears previous input state immediately for a new language pair', async () => {
    vi.mocked(api.getDictionaryDecks).mockResolvedValueOnce([]).mockReturnValueOnce(new Promise(() => {}));
    const view = render(<DictionaryFlashcardForm ownerId={21} result={definition} />);
    await screen.findByText(/chưa có bộ thẻ en/i);
    fireEvent.click(screen.getByRole('button', { name: /tạo bộ thẻ/i }));
    fireEvent.change(screen.getByLabelText('Tên bộ thẻ mới'), { target: { value: 'Old language name' } });
    view.rerender(<DictionaryFlashcardForm ownerId={21} result={{ ...definition, requestId: 'new-request',
      definition: { ...definition.definition, learningLanguage: 'ja', meaningLanguage: 'fr' } }} />);
    expect(screen.queryByRole('option', { name: 'My words' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Old language name')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải bộ thẻ');
  });
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => cleanup());

  it('saves to an owned en/vi deck and reports success only after the API confirms', async () => {
    vi.mocked(api.getDictionaryDecks).mockResolvedValue([deck]);
    vi.mocked(api.addDictionaryFlashcard).mockResolvedValue({ id: 12 } as any);
    const onSaved = vi.fn();
    render(<DictionaryFlashcardForm ownerId={21} result={definition} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'My words' });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /lưu flashcard/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(api.addDictionaryFlashcard).toHaveBeenCalledWith(deck, 21, definition);
  });

  it('creates a private deck explicitly and retains the lookup result when save fails', async () => {
    vi.mocked(api.getDictionaryDecks).mockResolvedValue([]);
    vi.mocked(api.createDictionaryDeck).mockResolvedValue(deck);
    vi.mocked(api.addDictionaryFlashcard).mockRejectedValue(new api.DictionaryFlashcardDuplicateError());
    render(<DictionaryFlashcardForm ownerId={21} result={definition} onSaved={vi.fn()} />);
    await screen.findByText(/chưa có bộ thẻ en → vi/i);
    fireEvent.click(screen.getByRole('button', { name: /tạo bộ thẻ/i }));
    fireEvent.change(screen.getByLabelText('Tên bộ thẻ mới'), { target: { value: 'IELTS words' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo và lưu/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/đã có|không thể lưu/i);
    expect(screen.getByRole('region', { name: 'Lưu Flashcard' }).textContent).toContain('cây du');
    expect(api.createDictionaryDeck).toHaveBeenCalledWith(21, 'IELTS words', 'en', 'vi');
  });
});
