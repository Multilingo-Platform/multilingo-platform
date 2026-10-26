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

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
const http = vi.mocked(axiosClient);
const rectDescriptor = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
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
async function open(mode: 'PRACTICE' | 'MOCK_TEST', shape: 'group' | 'part' = 'group') {
  const now = new Date().toISOString();
  const groups = [{ group_id: 'g1', ...(shape === 'group' ? { content_html: '<p>Before <b>chosen words</b> after.</p>' } : {}),
    questions: [{ question_id: 'q1', type: 'SINGLE_CHOICE', question_text: 'Choose.', options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }] }] }];
  http.get.mockResolvedValue({ success: true, data: {
    attempt_id: 42, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: mode,
    startTime: now, serverTime: now, deadline: mode === 'MOCK_TEST' ? new Date(Date.now() + 3600000).toISOString() : null,
    gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [],
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi'] },
    exam_snapshot: { exam_id: 1, code: 'READING', title: 'Reading', type: shape === 'group' ? 'TOEIC_LR' : 'IELTS_ACADEMIC', examLanguage: 'en', sections: [{
      id: 2, name: 'READING', durationMinutes: 60, parts: [{ id: 7, partNumber: 7, title: 'Reading passage',
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
  await screen.findByText('Choose.');
  const scope = page.container.querySelector('[data-highlight-scope]')! as HTMLElement;
  return { page, store, scope };
}

describe('automatic Reading highlights through WorkspacePage', () => {
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
    // The click belonging to the completed drag must not open delete immediately.
    fireEvent.click(mark!, { detail: 1 });
    expect(screen.queryByRole('button', { name: 'Xóa highlight' })).toBeNull();
    // A new click gesture can delete normally.
    pointer(mark!, 'pointerdown'); pointer(mark!, 'pointerup'); fireEvent.click(mark!, { detail: 1 });
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

  it('keeps touch selection manual until confirmation', async () => {
    const { scope } = await open('PRACTICE');
    const text = scope.querySelector('b')!.firstChild!;
    pointer(text, 'pointerdown', 'touch'); select(text, 0, 6); pointer(text, 'pointerup', 'touch');
    const button = await screen.findByRole('button', { name: 'Highlight' });
    expect(scope.querySelector('mark')).toBeNull();
    fireEvent.click(button);
    expect(scope.querySelector('mark')?.textContent).toBe('chosen');
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
