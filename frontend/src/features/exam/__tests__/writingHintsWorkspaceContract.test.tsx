import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer, { setAttemptContext } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import axiosClient from '../../../core/api/axiosClient';
import type { WritingHintsRequest } from '../types/api.types';
import { createWritingHintsEnvelope, validWritingHintsEn, validWritingHintsFr, validWritingHintsVi } from './fixtures/writingHints';

// All feature code stays real: mock only the HTTP boundary and browser APIs.
vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);
const now = Date.parse('2026-10-13T12:00:00Z');
const questionId = 'writing-task-1';
const originalDraft = JSON.stringify({ 30: { [questionId]: 'Independent existing draft' } });

function workspace(attemptId = 42) {
  return { success: true, data: {
    attemptId, status: 'IN_PROGRESS', testScope: 'FULL_EXAM', testMode: 'PRACTICE',
    startTime: new Date(now - 60000).toISOString(), serverTime: new Date(Date.now()).toISOString(),
    deadline: null, gracePeriodSeconds: 15, lockedSections: [], version: 7,
    savedAnswers: [{ part_id: 30, answers: [{ question_id: questionId, answer: 'Server essay' }] }],
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'ko', 'zh', 'ja', 'fr', 'de', 'es'] },
    examSnapshot: { exam_id: 1, code: 'TV3-19', title: 'Writing integration', type: 'IELTS', examLanguage: 'en', sections: [{
      id: 3, skill_type: 'WRITING', title: 'Writing', duration_minutes: 60,
      parts: [30, 31].map((id, index) => ({ id, title: `Writing part ${index + 1}`, content: {
        part_title: `Writing part ${index + 1}`, question_groups: [{ group_id: `g-${id}`, questions: [{
          question_id: questionId, question_number: 1, type: 'ESSAY', question_text: 'Describe the renewable energy chart.',
        }] }],
      } })),
    }] },
  } };
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function hintsCalls() { return http.post.mock.calls.filter(([url]) => String(url).endsWith('/writing-hints')); }
function body(index = 0) { return hintsCalls()[index][1] as WritingHintsRequest; }
function signal(index = 0) { return hintsCalls()[index][2]!.signal as AbortSignal; }
function response(request: WritingHintsRequest, attemptId = 42, point = 'Localized hints marker') {
  const language = request.learningLanguage ?? 'en';
  const hintLanguage = request.hintLanguage ?? 'vi';
  const localizedFixture = hintLanguage === 'fr' ? validWritingHintsFr : hintLanguage === 'en' ? validWritingHintsEn : validWritingHintsVi;
  const data = { ...structuredClone(localizedFixture), ...request, attemptId,
    learningLanguage: language, hintLanguage };
  data.outline[0].points[0] = point;
  return { ...createWritingHintsEnvelope(data), data };
}
function mockSuccess() {
  http.post.mockImplementation((url, request) => {
    if (!String(url).endsWith('/writing-hints')) throw new Error('Unexpected HTTP endpoint');
    return Promise.resolve(response(request as WritingHintsRequest)) as never;
  });
}
function mount(strict = false) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  const content = <Provider store={store}><MemoryRouter initialEntries={['/attempts/42/workspace']}>
    <Link to="/attempts/42/workspace">Route A</Link><Link to="/attempts/43/workspace">Route B</Link>
    <Routes>
      <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<div data-testid="result">Result</div>} />
    </Routes>
  </MemoryRouter></Provider>;
  return { store, ...render(strict ? <StrictMode>{content}</StrictMode> : content) };
}
async function flush() { await act(async () => { await Promise.resolve(); }); }
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function open() { fireEvent.click(screen.getByRole('button', { name: 'Writing hints' })); }
async function generate() { fireEvent.click(screen.getByRole('button', { name: 'Tạo gợi ý' })); await flush(); }
async function regenerate() {
  fireEvent.click(screen.getByRole('button', { name: 'Tạo gợi ý mới' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo gợi ý mới' }));
  await flush();
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.resetAllMocks();
  localStorage.clear(); localStorage.setItem('exam_draft_42', originalDraft);
  window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
  http.get.mockImplementation((url) => Promise.resolve(workspace(String(url).includes('/43/') ? 43 : 42)) as never);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TV3-19-06 real Workspace Writing hints pipeline', () => {
  it('TC_19_01/02/17: GET -> explicit languages -> localized full content, allowlisted POST and unchanged Redux/draft', async () => {
    mockSuccess(); const view = mount(); await flush();
    const before = structuredClone(view.store.getState().answers);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    open();
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ học' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' }), { target: { value: 'vi' } });
    expect(http.post).not.toHaveBeenCalled();
    await generate();
    expect(http.get.mock.calls.map(([url]) => url)).toEqual(['/v1/attempts/42/workspace']);
    expect(http.post.mock.calls.map(([url]) => url)).toEqual(['/v1/attempts/42/writing-hints']);
    expect(body()).toEqual({ partId: 30, questionId, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i), learningLanguage: 'en', hintLanguage: 'vi' });
    expect(hintsCalls()[0][2]).toMatchObject({ timeout: 150000 });
    expect(screen.getByRole('region', { name: 'Writing hints' })).toHaveAttribute('lang', 'vi');
    expect(screen.getByText('Localized hints marker')).toBeInTheDocument();
    expect(screen.getByText(validWritingHintsVi.vocabulary[4].example)).toBeInTheDocument();
    expect(screen.getByText(validWritingHintsVi.limitations[0])).toBeInTheDocument();
    expect(view.store.getState().answers).toEqual(before);
    expect(localStorage.getItem('exam_draft_42')).toBe(originalDraft);
    expect(storageWrite).not.toHaveBeenCalled(); expect(http.put).not.toHaveBeenCalled();
  });

  it('TC_19_02/14: defaults omit languages; cancel sends nothing; confirmed regenerate creates a new UUID', async () => {
    mockSuccess(); mount(); await flush(); open(); await generate();
    const first = structuredClone(body());
    expect(Object.keys(first).sort()).toEqual(['learningLanguage', 'partId', 'questionId', 'requestId']);
    expect(screen.getByRole('region', { name: 'Writing hints' })).toHaveAttribute('lang', 'vi');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo gợi ý mới' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(hintsCalls()).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' }), { target: { value: 'fr' } });
    await regenerate();
    expect(body(1)).toMatchObject({ partId: 30, questionId, learningLanguage: 'en', hintLanguage: 'fr' });
    expect(body(1).requestId).not.toBe(first.requestId);
    expect(screen.getByRole('region', { name: 'Writing hints' })).toHaveAttribute('lang', 'fr');
  });

  it('TC_19_10: edits during hints wait survive response and continue normal autosave', async () => {
    const wait = deferred(); http.post.mockReturnValueOnce(wait.promise as never);
    const view = mount(); await flush(); open(); await generate();
    const editor = screen.getByRole('textbox'); expect(editor).toBeEnabled();
    fireEvent.change(editor, { target: { value: 'Latest essay tiếng Việt 😀' } });
    const dirty = structuredClone(view.store.getState().answers);
    await act(async () => { wait.resolve(response(body())); });
    expect(view.store.getState().answers).toEqual(dirty);
    expect(editor).toHaveValue('Latest essay tiếng Việt 😀');
    expect(localStorage.getItem('exam_draft_42')).toBe(originalDraft);
    http.put.mockResolvedValueOnce({ success: true, data: { version: 8 } } as never);
    await advance(15000);
    expect(http.put.mock.calls[0][1]).toEqual({ version: 7, answers: [{ part_id: 30, answers: [{ question_id: questionId, answer: 'Latest essay tiếng Việt 😀' }] }] });
    expect(view.store.getState().answers.version).toBe(8);
  });

  it('TC_19_07/18: 150s bounded timeout does not auto-retry; explicit retry replays identical body/UUID/generatedAt', async () => {
    const wait = deferred(); http.post.mockReturnValueOnce(wait.promise as never);
    mount(); await flush(); open(); await generate(); const first = structuredClone(body());
    await advance(149999); expect(screen.getByText(/Đang tạo gợi ý. Có thể/)).toBeInTheDocument();
    await advance(1); expect(signal().aborted).toBe(true);
    await advance(30000); expect(hintsCalls()).toHaveLength(1);
    const replay = response(first);
    http.post.mockResolvedValueOnce(replay as never);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await flush();
    expect(body(1)).toEqual(first);
    expect(screen.getByText('Localized hints marker')).toBeInTheDocument();
    expect(replay.data.generatedAt).toBe(validWritingHintsVi.generatedAt);
    await act(async () => { wait.resolve(response(first, 42, 'Stale timed-out marker')); });
    expect(screen.queryByText('Stale timed-out marker')).toBeNull();
    expect(http.put).not.toHaveBeenCalled(); expect(localStorage.getItem('exam_draft_42')).toBe(originalDraft);
  });

  it.each([[409, 1604], [429, 1606]])('TC_19_08/09: %s/%s countdown ends without automatic HTTP', async (status, code) => {
    http.post.mockRejectedValueOnce({ response: { status, data: { code }, headers: { 'retry-after': '2' } } });
    mount(); await flush(); open(); await generate();
    expect(screen.getByText(/Thử lại sau 2 giây/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled();
    await advance(3000); expect(hintsCalls()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
    http.post.mockResolvedValueOnce(response(body()) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await flush();
    expect(body(1)).toEqual(body());
  });

  it('TC_19_08: quota is a global block without fake remaining count, countdown or auto HTTP', async () => {
    http.post.mockRejectedValueOnce({ response: { status: 429, data: { code: 9999, message: 'PRIVATE_SENTINEL' } } });
    mount(); await flush(); open(); await generate();
    expect(screen.getByRole('alert')).toHaveTextContent('Hạn mức sử dụng gợi ý AI');
    expect(screen.queryByText(/PRIVATE_SENTINEL|Thử lại sau|còn.*lượt/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạo gợi ý mới' })).toBeDisabled();
    await advance(30000); expect(hintsCalls()).toHaveLength(1);
  });

  it('TC_19_11: same questionId across parts isolates hints and ignores canceled completion/finally', async () => {
    const old = deferred(); const current = deferred();
    http.post.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(current.promise as never);
    mount(); await flush(); open(); await generate(); const first = structuredClone(body());
    fireEvent.click(screen.getByRole('button', { name: /Writing part 2/ })); await flush();
    expect(signal().aborted).toBe(true); open(); await generate();
    expect(body(1).partId).toBe(31); expect(body(1).questionId).toBe(first.questionId);
    await act(async () => { old.resolve(response(first, 42, 'Old part marker')); });
    expect(screen.queryByText('Old part marker')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đang tạo gợi ý…' })).toBeDisabled();
    await act(async () => { current.resolve(response(body(1), 42, 'Second part marker')); });
    expect(screen.getByText('Second part marker')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Writing part 1/ })); await flush(); open();
    http.post.mockResolvedValueOnce(response(first, 42, 'Replayed first part') as never);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await flush();
    expect(body(2)).toEqual(first); expect(screen.queryByText('Second part marker')).toBeNull();
    expect(screen.getByText('Replayed first part')).toBeInTheDocument();
  });

  it.each(['route', 'hydrate'])('TC_19_11: %s A -> B -> A discards old response and creates a fresh operation', async (kind) => {
    const old = deferred(); http.post.mockReturnValueOnce(old.promise as never);
    const view = mount(); await flush(); open(); await generate(); const first = structuredClone(body());
    if (kind === 'route') {
      fireEvent.click(screen.getByRole('link', { name: 'Route B' })); await flush();
      expect(view.store.getState().answers.attemptId).toBe(43);
      fireEvent.click(screen.getByRole('link', { name: 'Route A' })); await flush();
    } else {
      act(() => { view.store.dispatch(setAttemptContext({ attemptId: 42, version: 9, savedAnswers: [] })); });
      act(() => { view.store.dispatch(setAttemptContext({ attemptId: 42, version: 10, savedAnswers: [] })); });
    }
    expect(signal().aborted).toBe(true);
    await act(async () => { old.resolve(response(first, 42, 'Old context marker')); });
    open(); mockSuccess(); await generate();
    expect(body(1).requestId).not.toBe(first.requestId);
    expect(screen.queryByText('Old context marker')).toBeNull();
    expect(screen.getByText('Localized hints marker')).toBeInTheDocument();
  });

  it('TC_19_13: submit cancels hints immediately, preserves finalAnswers, and does not wait for hints', async () => {
    const hintsWait = deferred(); const submitWait = deferred();
    http.post.mockImplementation((url) => (String(url).endsWith('/writing-hints') ? hintsWait.promise : submitWait.promise) as never);
    const view = mount(); await flush(); open(); await generate();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Final essay 😀' } });
    fireEvent.click(screen.getByRole('button', { name: /Nộp bài$/ }));
    await advance(2000);
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài ngay' })); await flush();
    expect(signal().aborted).toBe(true); expect(view.store.getState().answers.isLocked).toBe(true);
    const submitCall = http.post.mock.calls.find(([url]) => String(url).endsWith('/submit'))!;
    expect(submitCall[1]).toEqual({ reason: 'MANUAL', baseVersion: 7, feedbackLanguage: 'vi', finalAnswers: [{ part_id: 30, answers: [{ question_id: questionId, answer: 'Final essay 😀' }] }] });
    expect(submitCall[2]).toMatchObject({ timeout: 10000 });
    await act(async () => { hintsWait.resolve(response(body(), 42, 'Forbidden late hints')); });
    expect(screen.queryByText('Forbidden late hints')).toBeNull();
    await act(async () => { submitWait.reject({ response: { status: 503 } }); });
    expect(view.store.getState().answers.isLocked).toBe(false);
    expect(hintsCalls()).toHaveLength(1);
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } } as never);
    fireEvent.click(screen.getByRole('button', { name: /Thử nộp lại/ })); await flush();
    const submitCalls = http.post.mock.calls.filter(([url]) => String(url).endsWith('/submit'));
    expect(submitCalls).toHaveLength(2); expect(submitCalls[1][1]).toEqual(submitCall[1]);
    expect(screen.getByTestId('result')).toBeInTheDocument(); expect(hintsCalls()).toHaveLength(1);
  });

  it('TC_19_12: StrictMode/unmount aborts and consumes a late reject without auto dispatch', async () => {
    const wait = deferred(); http.post.mockReturnValueOnce(wait.promise as never);
    const view = mount(true); await flush();
    expect(hintsCalls()).toHaveLength(0); open(); await generate();
    expect(hintsCalls()).toHaveLength(1); view.unmount(); expect(signal().aborted).toBe(true);
    await act(async () => { wait.reject(new Error('Late network failure')); });
    await advance(150000); expect(hintsCalls()).toHaveLength(1);
  });

  it('TC_19_09/11: conflict reload uses authoritative GET, clears old hints and starts a fresh operation', async () => {
    mockSuccess(); const view = mount(); await flush(); open(); await generate();
    const first = structuredClone(body()); const oldRevision = view.store.getState().answers.contextRevision;
    http.post.mockRejectedValueOnce({ response: { status: 409, data: { code: 1605, message: 'PRIVATE_SENTINEL' } } });
    await regenerate();
    expect(screen.queryByText('Localized hints marker')).toBeNull();
    expect(screen.queryByTestId('result')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại trang' })); await flush();
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(view.store.getState().answers.contextRevision).toBeGreaterThan(oldRevision);
    expect(screen.queryByRole('alert')).toBeNull();
    open(); await generate(); expect(body(2).requestId).not.toBe(first.requestId);
    expect(localStorage.getItem('exam_draft_42')).toBe(originalDraft);
  });

  it('TC_19_04/15: malformed identity is rejected, text is inert, 403 clears prior authorized content', async () => {
    http.post.mockImplementationOnce((_url, request) => Promise.resolve(response({ ...(request as WritingHintsRequest), requestId: 'bad-id' })) as never);
    mount(); await flush(); open(); await generate();
    expect(screen.queryByText('Localized hints marker')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/không đúng cấu trúc/);
    const dangerous = '<script>window.SENTINEL = true</script><a href="javascript:evil()">unsafe</a>';
    http.post.mockResolvedValueOnce(response(body(), 42, dangerous) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await flush();
    expect(screen.getByText(dangerous)).toBeInTheDocument();
    expect(document.querySelector('script, a[href="javascript:evil()"]')).toBeNull();
    http.post.mockRejectedValueOnce({ response: { status: 403, data: { message: 'PRIVATE_SENTINEL' } } });
    await regenerate();
    expect(screen.queryByText(dangerous)).toBeNull(); expect(screen.queryByText('PRIVATE_SENTINEL')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/không có quyền/);
  });

  it.each(['MOCK_TEST', 'READING', 'locked'])('TC_19_05: persisted %s context never POSTs hints', async (kind) => {
    const fixture = workspace();
    if (kind === 'MOCK_TEST') { fixture.data.testMode = 'MOCK_TEST'; fixture.data.deadline = new Date(now + 3600000).toISOString() as never; }
    if (kind === 'READING') fixture.data.examSnapshot.sections[0].skill_type = 'READING';
    if (kind === 'locked') fixture.data.lockedSections = [3] as never;
    http.get.mockResolvedValue(fixture as never); mount(); await flush();
    if (kind === 'locked') { open(); expect(screen.getByRole('button', { name: 'Tạo gợi ý' })).toBeDisabled(); }
    else expect(screen.queryByRole('button', { name: 'Writing hints' })).toBeNull();
    await advance(160000); expect(hintsCalls()).toHaveLength(0);
  });
});
