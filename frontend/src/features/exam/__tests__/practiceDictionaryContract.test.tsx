import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { usePracticeDictionary } from '../hooks/usePracticeDictionary';
import { DictionaryFlashcardForm } from '../components/practice/DictionaryFlashcardForm';
import { initialState } from '../store/answerSlice';
import type { WorkspaceResponse } from '../types/api.types';
import type { SelectionState } from '../hooks/useTextSelection';
import WorkspacePage from '../pages/WorkspacePage';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);
const deck = { id: 3, userId: 21, name: 'Reading words', targetLanguage: 'en', sourceLanguage: 'vi', isPublic: false,
  totalCards: 0, newCards: 0, learningCards: 0, masteredCards: 0, dueTodayCards: 0 };
const selection: SelectionState = {
  rect: new DOMRect(20, 30, 30, 10), text: 'elms', start: 4, end: 8, documentId: 'g1', contentHash: 'hash',
  contextRevision: 1, contextKey: '21:42:1', scopeId: 'g1', scopeText: 'The elms grow beside the river.',
};
const workspace: WorkspaceResponse = {
  attempt_id: 42, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: 'PRACTICE',
  startTime: '2026-10-20T07:00:00Z', serverTime: '2026-10-20T07:00:00Z', deadline: null,
  gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [], serverTimeOffset: 0,
  languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es'] },
  exam_snapshot: { exam_id: 1, code: 'READING', title: 'Reading', type: 'IELTS', examLanguage: 'en', sections: [{
    id: 2, skill_type: 'READING', title: 'Reading', duration_minutes: 60,
    parts: [{ id: 7, question_groups: [{ group_id: 'g1', instruction: null, context_html: 'The elms grow beside the river.', shared_audio: null, shared_media: null, questions: [] }], questions: [] }],
  }] },
};

function Harness() {
  const dictionary = usePracticeDictionary({ workspace, partId: 7, ownerId: 21, isLocked: () => false });
  return dictionary.data
    ? <><p>{dictionary.data.definition.meaning}</p><DictionaryFlashcardForm ownerId={21} result={dictionary.data} /></>
    : <><button type="button" onClick={() => void dictionary.lookup(selection)}>Tra từ</button><p role="status">{dictionary.phase}</p></>;
}

describe('Practice dictionary end-to-end frontend contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    http.get.mockResolvedValue({ success: true, data: [deck] } as never);
    http.post.mockImplementation(async (url, payload) => {
      if (String(url).endsWith('/dictionary-lookups')) {
        const request = payload as any;
        return { success: true, data: {
        requestId: request.requestId, attemptId: 42, partId: 7, documentId: 'g1', selectedText: 'elms',
        sourceContext: 'The elms grow beside the river.', definition: { schemaVersion: 2, learningLanguage: 'en', meaningLanguage: request.meaningLanguage ?? 'vi', meaning: 'cây du',
        phonetic: '/elm/', partOfSpeech: 'noun', example: 'The elms grow.', exampleTranslation: 'Cây du mọc.' },
        } } as never;
      }
      return { success: true, data: { id: 18, deckId: 3, customWord: 'elms', customMeaning: 'cây du', exampleSentence: 'The elms grow beside the river.' } } as never;
    });
  });

  it('looks up against the current passage, saves the returned definition, and leaves answer state untouched', async () => {
    const store = createTestStore({ answers: { ...initialState, attemptId: 42, version: 7, contextRevision: 1 } });
    render(<Provider store={store}><Harness /></Provider>);
    await act(async () => { screen.getByRole('button', { name: 'Tra từ' }).click(); });
    await screen.findByRole('option', { name: 'Reading words' });
    expect(screen.getByText('cây du')).toBeInTheDocument();
    await act(async () => { screen.getByRole('button', { name: /lưu flashcard/i }).click(); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/đã lưu/i));
    expect(http.post.mock.calls[0][0]).toBe('/v2/attempts/42/dictionary-lookups');
    expect(http.post.mock.calls[1][0]).toBe('/v1/vocab/decks/3/cards');
    expect(http.post.mock.calls[1][1]).toMatchObject({ customWord: 'elms', customMeaning: 'cây du', exampleSentence: 'The elms grow beside the river.' });
    expect(store.getState().answers).toMatchObject({ attemptId: 42, version: 7, isDirty: false });
  });

  it.each(['ready', 'unavailable'] as const)('uses the database snapshot from WorkspacePage and leaves loading when %s', async (outcome) => {
    // Real DB adapter DTO: SectionFixture.name and PartFixture.id/questionGroups.
    http.get.mockResolvedValueOnce({ success: true, data: {
      ...workspace,
      exam_snapshot: { ...workspace.exam_snapshot, type: 'TOEIC_LR', sections: [{
        id: 2, name: 'READING', durationMinutes: 75, parts: [{
          id: 7, partNumber: 7, title: 'Part 7', questionGroups: [{
            group_id: 'g1', content_html: '<p>The elms grow beside the river.</p>',
            questions: [{ question_id: 'q_147', question_number: 147, type: 'SINGLE_CHOICE', question_text: 'Choose.', options: [{ id: 'A', text: 'Trees' }] }],
          }],
        }],
      }] },
    } } as never);
    if (outcome === 'unavailable') {
      http.post.mockRejectedValueOnce({ response: { status: 503 } });
    } else {
      http.post.mockImplementationOnce(async (_url, payload) => ({ success: true, data: {
        requestId: (payload as any).requestId, attemptId: 42, partId: 7, documentId: 'g1', selectedText: 'elms',
        sourceContext: 'The elms grow beside the river.', definition: {
          schemaVersion: 2, learningLanguage: 'en', meaningLanguage: 'vi', meaning: 'cây du', phonetic: null,
          partOfSpeech: 'noun', example: 'The elms grow.', exampleTranslation: 'Cây du mọc.',
        },
      } }) as never);
    }
    const store = createTestStore({ auth: { user: { id: 21 }, token: 'test-token', isAuthenticated: true } });
    const page = render(<Provider store={store}><MemoryRouter initialEntries={['/attempts/42']}>
      <Routes><Route path="/attempts/:attemptId" element={<WorkspacePage />} /></Routes>
    </MemoryRouter></Provider>);
    await screen.findByText('The elms grow beside the river.');
    const passage = page.container.querySelector('[data-highlight-scope="g1"]')!;
    const text = passage.querySelector('p')!.firstChild!;
    const pointer = (type: string, target: Node) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0 });
      Object.defineProperties(event, { pointerType: { value: 'mouse' }, pointerId: { value: 1 }, isPrimary: { value: true } });
      fireEvent(target, event);
    };
    pointer('pointerdown', text);
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 8);
    Object.defineProperty(range, 'getBoundingClientRect', { value: () => new DOMRect(20, 30, 30, 10) });
    const browserSelection = window.getSelection()!;
    browserSelection.removeAllRanges();
    browserSelection.addRange(range);
    pointer('pointerup', text);
    expect(passage.querySelector('mark')?.textContent).toBe('elms');
    expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();
    expect(http.post).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Tra từ AI' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tra từ AI: elms' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tra từ' }));
    await waitFor(() => expect(dialog).toHaveTextContent(outcome === 'ready' ? 'cây du' : 'Tra từ AI hiện chưa khả dụng.'));
    expect(dialog).not.toHaveTextContent('Đang tra nghĩa');
    expect(http.post).toHaveBeenCalledWith('/v2/attempts/42/dictionary-lookups', expect.objectContaining({
      partId: 7, documentId: 'g1', selectedText: 'elms', contextText: 'The elms grow beside the river.',
    }), expect.any(Object));
    expect(store.getState().answers).toMatchObject({ version: 7, isDirty: false });
    browserSelection.removeAllRanges();
  });
});
