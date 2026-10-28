import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import WorkspacePage from '../pages/WorkspacePage';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { attemptReviewFixture } from './fixtures/attemptReview';
import { lockAnswers, setAttemptContext } from '../store/answerSlice';
import { logout } from '../../auth/store/authSlice';
import * as practiceDictionary from '../hooks/usePracticeDictionary';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const http = vi.mocked(axiosClient);
const rectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

beforeEach(() => {
  vi.clearAllMocks(); http.post.mockReset(); localStorage.clear();
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect(30, 60, 80, 20) });
});
afterEach(() => {
  cleanup(); window.getSelection()?.removeAllRanges(); vi.useRealTimers();
  vi.restoreAllMocks();
  if (rectDescriptor) Object.defineProperty(Range.prototype, 'getBoundingClientRect', rectDescriptor);
  else Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
});

function pointer(target: Node, type: string, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, button: 0 });
  Object.defineProperties(event, { pointerType: { value: pointerType }, pointerId: { value: 1 }, isPrimary: { value: true } });
  fireEvent(target, event);
}
function select(node: Node, start: number, end: number) {
  const range = document.createRange(); range.setStart(node, start); range.setEnd(node, end);
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}
async function open(mode: 'PRACTICE' | 'MOCK_TEST', shape: 'group' | 'part' = 'group', skill = 'READING', questionOverrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const groups = [{ group_id: 'g1', ...(shape === 'group' ? { content_html: '<p>Before <b>chosen words</b> after.</p>' } : {}),
    questions: [{ question_id: 'q1', type: skill === 'WRITING' ? 'ESSAY' : 'SINGLE_CHOICE', question_text: 'Choose.', options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }], ...questionOverrides }] }];
  http.get.mockResolvedValue({ success: true, data: {
    attempt_id: 42, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: mode,
    startTime: now, serverTime: now, deadline: mode === 'MOCK_TEST' ? new Date(Date.now() + 3600000).toISOString() : null,
    gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [],
    dictionaryLanguage: { policyVersion: 'NATIVE_PROFILE_V1', available: true, nativeLanguage: 'vi' },
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi'] },
    exam_snapshot: { exam_id: 1, code: 'READING', title: 'Reading', type: shape === 'group' && skill === 'READING' ? 'TOEIC_LR' : 'IELTS_ACADEMIC', examLanguage: 'en', sections: [{
      id: 2, name: skill, durationMinutes: 60, parts: [{ id: 7, partNumber: 7, title: 'Reading passage',
        ...(shape === 'part' ? { content_html: '<p>Before <b>chosen words</b> after.</p>' } : {}), questionGroups: groups }],
    }] },
  } } as never);
  const store = createTestStore({ auth: { user: { id: '21' }, token: 'test-token', isAuthenticated: true } });
  const page = render(<Provider store={store}><MemoryRouter initialEntries={['/attempts/42']}>
    <Routes>
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<p>Confirmed result</p>} />
    </Routes>
  </MemoryRouter></Provider>);
  await screen.findAllByText(/^Choose\./);
  const scope = (shape === 'part' ? page.container.querySelector('[data-highlight-scope="part"]') : page.container.querySelector('[data-highlight-scope="g1"]'))! as HTMLElement;
  return { page, store, scope };
}

describe('automatic Reading highlights through WorkspacePage', () => {
  it.each(['LISTENING','WRITING'])('RD07 looks up a public question source in %s', async skill => {
    const { page } = await open('PRACTICE', 'group', skill);
    const scope = page.container.querySelector('[data-source-kind="QUESTION_TEXT"]')!;
    pointer(scope.firstChild!, 'pointerdown'); select(scope.firstChild!, 0, 6); pointer(scope.firstChild!, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ AI' }));
    await waitFor(() => expect(http.post).toHaveBeenCalled());
    expect(http.post.mock.calls[0][1]).toMatchObject({ source: { kind: 'QUESTION_TEXT', questionId: 'q1' } });
  });

  it('RD07 completes one-click v3 lookup and saves its verified definition through the Flashcard API', async () => {
    const { scope } = await open('PRACTICE');
    http.get.mockResolvedValue({ success: true, data: [{ id: 3, userId: 21, name: 'Native deck', targetLanguage: 'en', sourceLanguage: 'vi', isPublic: false }] } as never);
    http.post.mockImplementation(async (url, body: any) => {
      if (String(url).includes('dictionary-lookups')) return { success: true, data: { requestId: body.requestId, attemptId: 42, partId: 7, source: body.source, selectedText: body.selectedText, sourceContext: body.contextText, policyVersion: 'NATIVE_PROFILE_V1', definition: { schemaVersion: 2, learningLanguage: 'en', meaningLanguage: 'vi', meaning: 'nghĩa thử nghiệm', phonetic: null, partOfSpeech: null, example: 'A chosen word.', exampleTranslation: 'Một từ được chọn.' } } } as never;
      return { success: true, data: { id: 12, deckId: 3, customWord: 'chosen', customMeaning: 'nghĩa thử nghiệm', exampleSentence: 'Before chosen words after.' } } as never;
    });
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ AI' }));
    await screen.findByRole('option', { name: 'Native deck' });
    fireEvent.click(screen.getByRole('button', { name: /Lưu Flashcard/i }));
    await screen.findByText('Đã lưu vào bộ thẻ.');
    expect(http.post.mock.calls.map(call => call[0])).toEqual(['/v3/attempts/42/dictionary-lookups', '/v1/vocab/decks/3/cards']);
    expect(http.post.mock.calls[1][1]).toMatchObject({ customWord: 'chosen', customMeaning: 'nghĩa thử nghiệm' });
  });
  it('RD07 sends a v3 request on the first lookup click without a language selector', async () => {
    const { scope } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ AI' }));
    await waitFor(() => expect(http.post).toHaveBeenCalled());
    expect(http.post.mock.calls[0][0]).toBe('/v3/attempts/42/dictionary-lookups');
    expect(http.post.mock.calls[0][1]).toMatchObject({ partId: 7, source: { kind: 'GROUP_CONTENT', groupId: 'g1' }, selectedText: 'chosen' });
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('meaningLanguage');
    expect(screen.queryByRole('combobox', { name: /ngôn ngữ/i })).toBeNull();
  });
  it('RD06 recolors and deletes only the frozen selected range in Mock without a lookup action', async () => {
    const lookupHook = vi.spyOn(practiceDictionary, 'usePracticeDictionary');
    const { scope, store } = await open('MOCK_TEST');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('chosen');
    const palette = screen.getByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' });
    expect(screen.queryByRole('button', { name: 'Tra từ AI' })).toBeNull();
    expect(palette).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xanh lá' }));
    expect(screen.getByRole('button', { name: 'Xanh lá' })).toHaveAttribute('aria-pressed', 'true');
    expect((Object.values(store.getState().answers.highlights) as Array<{items: Array<{color: string}>}>)[0].items[0].color).toBe('green');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa highlight' }));
    expect(scope.querySelector('mark')).toBeNull();
    expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
    expect(lookupHook).not.toHaveBeenCalled();
  });

  it('RD06 keeps the chosen color in the workspace and resets the action color on reload', async () => {
    const first = await open('MOCK_TEST');
    const text = first.scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Xanh lá' }));
    const after = first.scope.querySelector('p')!.lastChild!;
    pointer(after, 'pointerdown'); select(after, 1, 6); pointer(after, 'pointerup');
    expect(screen.getByRole('button', { name: 'Xanh lá' })).toHaveAttribute('aria-pressed', 'true');
    first.page.unmount();
    const second = await open('MOCK_TEST');
    expect(second.scope.querySelector('mark')?.textContent).toBe('chosen');
    const prompt = second.page.container.querySelector('[data-highlight-scope="QUESTION_TEXT:2:q1"]')!;
    pointer(prompt.firstChild!, 'pointerdown'); select(prompt.firstChild!, 0, 6); pointer(prompt.firstChild!, 'pointerup');
    expect(screen.getByRole('button', { name: 'Vàng' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('RD06 closes an open dictionary when a new selection replaces it', async () => {
    const { scope, page } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Tra từ AI' }));
    expect(screen.getByRole('dialog', { name: /Tra từ AI/ })).toBeInTheDocument();
    const prompt = page.container.querySelector('[data-highlight-scope="QUESTION_TEXT:2:q1"]')!;
    pointer(prompt.firstChild!, 'pointerdown'); select(prompt.firstChild!, 0, 6); pointer(prompt.firstChild!, 'pointerup');
    expect(screen.queryByRole('dialog', { name: /Tra từ AI/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Vàng' })).toBeInTheDocument();
  });

  it('RD06 shows the palette and lookup for an eligible Practice selection', async () => {
    const { page } = await open('PRACTICE');
    const scope = page.container.querySelector('[data-highlight-scope="QUESTION_TEXT:2:q1"]')!;
    const text = scope.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(screen.getByRole('button', { name: 'Tra từ AI' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Vàng' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('RD06 preserves outside colors when a selected subrange is recolored and deleted', async () => {
    const { scope, store } = await open('MOCK_TEST');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Xanh lá' }));
    const markText = scope.querySelector('mark')!.firstChild!;
    pointer(markText, 'pointerdown'); select(markText, 1, 4); pointer(markText, 'pointerup');
    fireEvent.click(screen.getByRole('button', { name: 'Xanh dương' }));
    const items = () => (Object.values(store.getState().answers.highlights) as Array<{items: Array<{text: string; color: string}>}>)[0].items;
    expect(items().map(item => [item.text, item.color])).toEqual([['c', 'green'], ['hos', 'blue'], ['en', 'green']]);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa highlight' }));
    expect(items().map(item => [item.text, item.color])).toEqual([['c', 'green'], ['en', 'green']]);
    expect(store.getState().answers).toMatchObject({ answers: {}, isDirty: false, pendingVersion: 0, version: 7 });
  });

  it('RD06 highlights a long selection but disables lookup with an explanation', async () => {
    const { page } = await open('PRACTICE', 'group', 'READING', { question_text: `Choose. ${'a'.repeat(90)}` });
    const scope = page.container.querySelector('[data-highlight-scope="QUESTION_TEXT:2:q1"]')!;
    const text = scope.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 98); pointer(text, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toHaveLength(98);
    expect(screen.getByRole('button', { name: 'Tra từ AI' })).toBeDisabled();
    expect(screen.getByText(/tối đa 80 ký tự/)).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('RD06 closes on outside pointer and Escape, while portal controls retain the snapshot and focus returns', async () => {
    const { scope } = await open('PRACTICE');
    const originalFocus = screen.getByRole('button', { name: 'VIE' });
    originalFocus.focus();
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    const color = screen.getByRole('button', { name: 'Vàng' });
    fireEvent.pointerDown(color);
    expect(color).toBeInTheDocument();
    fireEvent.scroll(color.closest('[role="toolbar"]')!);
    expect(color).toBeInTheDocument();
    color.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' })).toBeNull();
    expect(originalFocus).toHaveFocus();
    const markText = scope.querySelector('mark')!.firstChild!;
    pointer(markText, 'pointerdown'); select(markText, 0, 3); pointer(markText, 'pointerup');
    expect(screen.getByRole('button', { name: 'Vàng' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' })).toBeNull();
  });

  it.each(['scroll', 'resize', 'lock', 'rehydrate', 'account', 'submit'])('RD06 closes an open selection on %s', async (reason) => {
    const { scope, store } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(screen.getByRole('button', { name: 'Vàng' })).toBeInTheDocument();
    act(() => {
      if (reason === 'scroll') fireEvent.scroll(window);
      if (reason === 'resize') fireEvent.resize(window);
      if (reason === 'lock') store.dispatch(lockAnswers({ attemptId: 42, contextRevision: store.getState().answers.contextRevision }));
      if (reason === 'rehydrate') store.dispatch(setAttemptContext({ attemptId: 42, version: 8, savedAnswers: [] }));
      if (reason === 'account') store.dispatch(logout());
      if (reason === 'submit') fireEvent.click(screen.getByRole('button', { name: /Nộp bài/ }));
    });
    expect(screen.queryByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' })).toBeNull();
    expect(http.post).not.toHaveBeenCalled();
    if (reason === 'lock') {
      const mark = scope.querySelector('mark')!;
      pointer(mark, 'pointerdown'); pointer(mark, 'pointerup'); fireEvent.click(mark, { detail: 1 });
      expect(screen.queryByRole('toolbar', { name: 'Thao tác với đoạn văn đã chọn' })).toBeNull();
    }
  });
  it.each([
    ['TRUE_FALSE_NOT_GIVEN', null, 'PRACTICE'], ['TRUE_FALSE_NOT_GIVEN', [], 'PRACTICE'],
    ['YES_NO_NOT_GIVEN', null, 'PRACTICE'], ['YES_NO_NOT_GIVEN', [], 'PRACTICE'],
    ['TRUE_FALSE_NOT_GIVEN', null, 'MOCK_TEST'], ['TRUE_FALSE_NOT_GIVEN', [], 'MOCK_TEST'],
    ['YES_NO_NOT_GIVEN', null, 'MOCK_TEST'], ['YES_NO_NOT_GIVEN', [], 'MOCK_TEST'],
  ] as const)('RD05-R04 highlights %s tokens with options %j in %s without answering', async (type, options, mode) => {
    const tokens = type === 'TRUE_FALSE_NOT_GIVEN' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
    const overrides = { type, options };
    const first = await open(mode, 'group', 'READING', overrides);
    const before = first.store.getState().answers;
    for (const token of tokens) {
      const button = screen.getByRole('button', { name: token });
      const scope = button.querySelector('[data-source-kind="OPTION_TEXT"]')!;
      pointer(scope, 'pointerdown'); select(scope.firstChild!, 0, token.length); pointer(scope, 'pointerup');
      expect(scope.querySelector('mark')?.textContent).toBe(token);
      fireEvent.click(scope.querySelector('mark')!, { detail: 1 });
    }
    expect(first.store.getState().answers).toMatchObject({ answers: before.answers, isDirty: false, pendingVersion: before.pendingVersion, version: before.version });
    expect(http.put).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
    first.page.unmount();
    const second = await open(mode, 'group', 'READING', overrides);
    for (const token of tokens) expect(screen.getByRole('button', { name: token }).querySelector('mark')?.textContent).toBe(token);
    fireEvent.click(screen.getByRole('button', { name: tokens[0] }), { detail: 0 });
    expect(second.store.getState().answers.answers[7].q1).toBe(tokens[0]);
  });

  it.each([
    [{ id: 'A', text: 'Authored paragraph alpha' }, { id: 'B', text: 'Authored paragraph beta' }],
    null, [], ['A', 'B'], ['Paragraph C', 'Paragraph E'],
  ].map(options => ({ options })))('RD05-R05 highlights and restores the visible matching-information letter for options %j', async ({ options }) => {
    const overrides = { type: 'MATCHING_INFORMATION', options };
    const first = await open('MOCK_TEST', 'group', 'READING', overrides);
    const button = screen.getByRole('button', { name: 'A' });
    const scope = button.querySelector('[data-highlight-scope="OPTION_TEXT:2:q1:1:A"]')!;
    expect(scope).not.toBeNull();
    expect(scope.textContent).toBe('A');
    pointer(scope, 'pointerdown'); select(scope.firstChild!, 0, 1); pointer(scope, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('A');
    fireEvent.click(scope.querySelector('mark')!, { detail: 1 });
    expect(first.store.getState().answers).toMatchObject({ answers: {}, isDirty: false, pendingVersion: 0, version: 7 });
    expect(http.put).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
    first.page.unmount();
    const second = await open('MOCK_TEST', 'group', 'READING', overrides);
    expect(screen.getByRole('button', { name: 'A' }).querySelector('mark')?.textContent).toBe('A');
    fireEvent.click(screen.getByRole('button', { name: 'B' }), { detail: 0 });
    expect(second.store.getState().answers.answers[7].q1).toBe('B');
    fireEvent.click(screen.getByRole('button', { name: 'B' }), { detail: 1 });
    expect(second.store.getState().answers.answers[7].q1).toBe('');
  });

  it.each([['LISTENING', 'part', 'PART_CONTENT'], ['WRITING', 'group', 'GROUP_CONTENT:2:g1']] as const)('RD05-R02 renders committed %s content in its canonical source namespace', async (skill, shape, key) => {
    const { page, store } = await open('MOCK_TEST', shape, skill);
    const scope = page.container.querySelector(`[data-highlight-scope="${key}"]`)!;
    expect(scope).not.toBeNull();
    const text = scope.querySelector('p')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('Before');
    expect(store.getState().answers).toMatchObject({ answers: {}, pendingVersion: 0, isDirty: false });
  });

  it.each(['LISTENING', 'WRITING', 'READING'])('RD05-R02 commits %s question text through the real page without changing answers', async (skill) => {
    const { page, store } = await open('PRACTICE', 'group', skill);
    const scope = page.container.querySelector('[data-highlight-scope="QUESTION_TEXT:2:q1"]')!;
    expect(scope).not.toBeNull();
    const before = store.getState().answers;
    pointer(scope, 'pointerdown'); select(scope.firstChild!, 0, 6); pointer(scope, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('Choose');
    expect(store.getState().answers).toMatchObject({ answers: before.answers, pendingVersion: before.pendingVersion, isDirty: before.isDirty, version: before.version });
    expect(http.put).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
    // The same production root handles mark deletion for the new question source.
    const mark = scope.querySelector('mark')!;
    fireEvent.click(mark, { detail: 1 });
    pointer(mark, 'pointerdown'); pointer(mark, 'pointerup'); fireEvent.click(mark, { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Xóa highlight' }));
    expect(scope.querySelector('mark')).toBeNull();
  });

  it('RD05-R02 commits a Reading option drag, suppresses its trailing label click, restores it, and still accepts ordinary answers', async () => {
    const first = await open('MOCK_TEST');
    const scope = first.page.container.querySelector('[data-highlight-scope="OPTION_TEXT:2:q1:1:A"]')!;
    const before = first.store.getState().answers;
    pointer(scope, 'pointerdown'); select(scope.firstChild!, 0, 6); pointer(scope, 'pointerup');
    const mark = scope.querySelector('mark')!;
    expect(mark?.textContent).toBe('Option');
    fireEvent.click(mark, { detail: 1 });
    expect(first.store.getState().answers).toMatchObject({ answers: before.answers, pendingVersion: before.pendingVersion, isDirty: false });
    const passage = first.page.container.querySelector('[data-highlight-scope="g1"]')!;
    const passageText = passage.querySelector('b')!.firstChild!;
    pointer(passageText, 'pointerdown'); select(passageText, 0, 6); pointer(passageText, 'pointerup');
    expect(passage.querySelector('mark')?.textContent).toBe('chosen');
    first.page.unmount();
    const second = await open('MOCK_TEST');
    expect(second.page.container.querySelector('[data-highlight-scope="OPTION_TEXT:2:q1:1:A"] mark')?.textContent).toBe('Option');
    expect(second.page.container.querySelector('[data-highlight-scope="g1"] mark')?.textContent).toBe('chosen');
    fireEvent.click(screen.getByRole('radio', { name: /Option A/ }), { detail: 0 });
    expect(second.store.getState().answers.answers[7].q1).toBe('A');
    fireEvent.click(screen.getByText('Option B'), { detail: 1 });
    expect(second.store.getState().answers.answers[7].q1).toBe('B');
  });
  it.each(['PRACTICE', 'MOCK_TEST'] as const)('keeps the selection anchor through timer ticks and commits on release in %s', async (mode) => {
    const { page, store, scope } = await open(mode);
    const before = store.getState().answers;
    const text = scope.querySelector('b')!.firstChild!;
    vi.useFakeTimers();
    act(() => { pointer(text, 'pointerdown'); select(text, 7, 12); vi.advanceTimersByTime(5000); });
    expect(scope.querySelector('b')!.firstChild).toBe(text);
    expect(window.getSelection()!.toString()).toBe('words');
    expect(scope.querySelector('mark')).toBeNull();
    act(() => pointer(text, 'pointerup'));
    const mark = scope.querySelector('mark');
    expect(mark?.textContent).toBe('words');
    expect(scope.textContent).toMatch(/^Before chosen words after\./);
    const records = Object.values(store.getState().answers.highlights) as Array<{ items: unknown[] }>;
    expect(records).toHaveLength(1);
    expect(records[0].items).toMatchObject([{ start: 14, end: 19, text: 'words' }]);
    expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();
    expect(!!screen.queryByRole('button', { name: 'Tra từ AI' })).toBe(mode === 'PRACTICE');
    expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
    expect(store.getState().answers).toMatchObject({ isDirty: before.isDirty, version: before.version, pendingVersion: before.pendingVersion, answers: before.answers });
    // The trailing click must keep the selection palette, rather than open the cluster popup.
    fireEvent.click(mark!, { detail: 1 });
    expect(screen.getByRole('button', { name: 'Vàng' })).toBeInTheDocument();
    // A new click gesture can delete normally.
    pointer(mark!, 'pointerdown'); pointer(mark!, 'pointerup'); fireEvent.click(mark!, { detail: 1 });
    expect(screen.queryByRole('button', { name: 'Vàng' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa highlight' }));
    expect(scope.querySelector('mark')).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    const archive = JSON.parse(localStorage.getItem('exam_highlights_v1_21_42')!);
    expect(archive.documents).toEqual([]);
    vi.useRealTimers(); page.unmount();
  });

  it('also commits IELTS part-level passages and preserves the manual keyboard action', async () => {
    const { scope } = await open('PRACTICE', 'part');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('chosen');
    const after = scope.querySelector('p')!.lastChild!;
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true });
    select(after, 1, 6);
    fireEvent.mouseUp(scope);
    fireEvent.click(await screen.findByRole('button', { name: 'Highlight' }));
    await waitFor(() => expect(scope.querySelectorAll('mark')).toHaveLength(2));
  });

  it.each(['touch', 'pen'])('keeps %s selection manual until confirmation', async (pointerType) => {
    const { scope } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown', pointerType); select(text, 0, 6); pointer(text, 'pointerup', pointerType);
    const button = await screen.findByRole('button', { name: 'Highlight' });
    expect(scope.querySelector('mark')).toBeNull();
    fireEvent.click(button);
    expect(scope.querySelector('mark')?.textContent).toBe('chosen');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vàng' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Vàng' })).toHaveFocus();
  });

  it.each(['lock', 'rehydrate', 'account'])('does not commit a drag across %s changes', async (reason) => {
    const { store, scope } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6);
    act(() => {
      if (reason === 'lock') store.dispatch(lockAnswers({ attemptId: 42, contextRevision: store.getState().answers.contextRevision }));
      if (reason === 'rehydrate') store.dispatch(setAttemptContext({ attemptId: 42, version: 8, savedAnswers: [] }));
      if (reason === 'account') store.dispatch(logout());
    });
    pointer(text, 'pointerup');
    // A late compatibility mouseup/selectionchange must not re-label the old native
    // range as a new manual selection after authoritative hydration.
    fireEvent.mouseUp(scope);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(scope.querySelector('mark')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tra từ AI' })).toBeNull();
    expect(store.getState().answers.highlights).toEqual({});
    expect(http.post).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
    if (reason === 'rehydrate') {
      pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
      expect(scope.querySelector('mark')?.textContent).toBe('chosen');
    }
  });

  it('keeps automatic highlights usable in memory when device storage fails', async () => {
    const { scope } = await open('PRACTICE');
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown'); select(text, 0, 6); pointer(text, 'pointerup');
    expect(scope.querySelector('mark')?.textContent).toBe('chosen');
    expect(await screen.findByText('Không lưu được highlight trên thiết bị này.')).toBeInTheDocument();
    storage.mockRestore();
  });

  it('merges, restores in a fresh store, submits without annotations and reads the same marks in review', async () => {
    const first = await open('PRACTICE', 'part');
    let bold = first.scope.querySelector('b')!;
    pointer(bold, 'pointerdown'); select(bold.firstChild!, 0, 6); pointer(bold, 'pointerup');
    const originalId = first.scope.querySelector('mark')!.getAttribute('data-hl-id');
    bold = first.scope.querySelector('b')!;
    const range = document.createRange(); range.selectNodeContents(bold);
    pointer(bold, 'pointerdown');
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    pointer(bold, 'pointerup');
    expect(first.scope.querySelector('mark')?.textContent).toBe('chosen words');
    expect(first.scope.querySelector('mark')?.getAttribute('data-hl-id')).toBe(originalId);
    first.page.unmount(); // cleanup flushes the archive before debounce, as on route changes

    const second = await open('PRACTICE', 'part');
    expect(second.scope.querySelector('mark')?.textContent).toBe('chosen words');
    expect(second.store.getState().answers).toMatchObject({ version: 7, pendingVersion: 0, isDirty: false, answers: {} });
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } } as never);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    fireEvent.click(document.getElementById('btn-confirm-submit')!);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Confirmed result')).toBeInTheDocument();
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/v1/attempts/42/submit', { reason: 'MANUAL', baseVersion: 7, finalAnswers: [], feedbackLanguage: 'vi' }, expect.any(Object));
    expect(http.put).not.toHaveBeenCalled();
    second.page.unmount(); vi.useRealTimers();
    const saved = localStorage.getItem('exam_highlights_v1_21_42');
    const review = { ...attemptReviewFixture(42, 7), skill: 'READING', examData: { title: 'Reading passage', contentHtml: '<p>Before <b>chosen words</b> after.</p>' } };
    render(<Provider store={second.store}><PartReviewContent reviewData={review as any} ownerId="21" /></Provider>);
    expect(screen.getByTestId('review-reading-passage').querySelector('mark')?.textContent).toBe('chosen words');
    expect(screen.queryByRole('button', { name: /highlight/i })).toBeNull();
    expect(localStorage.getItem('exam_highlights_v1_21_42')).toBe(saved);
  });
});
