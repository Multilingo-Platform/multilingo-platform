import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer, { setAnswer, toggleFlag } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import axiosClient from '../../../core/api/axiosClient';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);
const now = Date.parse('2026-10-10T12:00:00Z');
const exam = {
  exam_id: 1, code: 'TV3-08', title: 'Writing contract', type: 'IELTS', sections: [{
    id: 100, skill_type: 'WRITING', title: 'Writing', duration_minutes: 60, parts: [{
      id: 10, title: 'Writing Task 1', questions: [
        { id: 1, question_id: 'essay', question_number: 1, type: 'ESSAY', question_text: 'Describe the chart' },
      ],
    }],
  }],
};
function workspace(version = 7, essay = 'A', deadline = now + 3600000) {
  return { success: true, data: {
    attemptId: 42, status: 'IN_PROGRESS', testScope: 'SINGLE_PART', testMode: 'MOCK_TEST',
    startTime: new Date(now - 60000).toISOString(), serverTime: new Date(Date.now()).toISOString(),
    deadline: new Date(deadline).toISOString(), gracePeriodSeconds: 15, lockedSections: [],
    version, savedAnswers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: essay }] }], examSnapshot: structuredClone(exam),
  } };
}
function mount(strict = false) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  const content = <Provider store={store}><MemoryRouter initialEntries={['/attempts/42/workspace']}><Routes>
    <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
    <Route path="/attempts/:attemptId/result" element={<div data-testid="confirmed-result">Result</div>} />
  </Routes></MemoryRouter></Provider>;
  return { store, ...render(strict ? <StrictMode>{content}</StrictMode> : content) };
}
async function flush() { await act(async () => { await Promise.resolve(); }); }
async function submit() {
  fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));
  if (screen.getAllByRole('button', { name: /nộp bài/i })[1].hasAttribute('disabled')) {
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  }
  fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);
  await flush();
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); vi.resetAllMocks(); localStorage.clear();
  window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TV3-08 real frontend pipeline', () => {
  it('waits PUT v7/B, freezes edits, POSTs latest C/base8 once, and restores backend B on a fresh store', async () => {
    http.get.mockResolvedValueOnce(workspace() as never);
    let resolvePut!: (value: unknown) => void;
    let resolvePost!: (value: unknown) => void;
    http.put.mockReturnValueOnce(new Promise(r => { resolvePut = r; }) as never);
    http.post.mockReturnValueOnce(new Promise(r => { resolvePost = r; }) as never);
    const first = mount(); await flush();
    expect(screen.getByRole('textbox')).toHaveValue('A');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put).toHaveBeenCalledOnce();
    expect(http.put.mock.calls[0][1]).toEqual({ version: 7, answers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: 'B' }] }] });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  C tiếng Việt 😀  ' } });
    await submit();
    expect(http.post).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    act(() => {
      first.store.dispatch(setAnswer({ partId: 10, questionId: 'essay', value: 'background edit' }));
      first.store.dispatch(toggleFlag({ partId: 10, questionId: 'essay' }));
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not accepted' } });
    fireEvent.click(screen.getByTestId('flag-btn-essay'));
    expect(first.store.getState().answers.answers[10].essay).toBe('  C tiếng Việt 😀  ');
    expect(first.store.getState().answers.flags).toEqual({});
    await act(async () => { resolvePut({ success: true, data: { version: 8 } }); });
    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][1]).toEqual({ reason: 'MANUAL', baseVersion: 8, finalAnswers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: '  C tiếng Việt 😀  ' }] }] });
    await act(async () => { resolvePost({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } }); });
    expect(screen.getByTestId('confirmed-result')).toBeInTheDocument();
    expect(http.put).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 10: { essay: '  C tiếng Việt 😀  ' } });
    first.unmount();
    http.get.mockResolvedValueOnce(workspace(8, 'Backend B') as never);
    const second = mount(); await flush();
    expect(screen.getByRole('textbox')).toHaveValue('Backend B');
    expect(second.store.getState().answers.version).toBe(8);
    expect(second.store.getState().answers.isDirty).toBe(false);
    expect(screen.getByTestId('local-draft-notice')).toBeInTheDocument();
  });

  it('reloads backend after 1601, then autosaves with its new version', async () => {
    http.get.mockResolvedValueOnce(workspace() as never);
    http.put.mockRejectedValueOnce({ response: { status: 409, data: { code: 1601 } } });
    const view = mount(); await flush();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'local C' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(view.store.getState().answers.saveStatus).toBe('conflict');
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.get.mockResolvedValueOnce(workspace(20, 'server B') as never);
    fireEvent.click(screen.getByRole('button', { name: /tải lại bản mới nhất/i })); await flush();
    expect(screen.getByRole('textbox')).toHaveValue('server B');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'D' } });
    http.put.mockResolvedValueOnce({ success: true, data: { version: 21 } } as never);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put.mock.calls[1][1]).toEqual({ version: 20, answers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: 'D' }] }] });
    expect(view.store.getState().answers.version).toBe(21);
  });

  it('stops autosave on non-1601 HTTP 409, shows stopped reload badge rather than retry text, and resumes after reload', async () => {
    http.get.mockResolvedValueOnce(workspace() as never);
    http.put.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Section or attempt state conflict' } } });
    const view = mount(); await flush();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'local C' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put).toHaveBeenCalledOnce();
    expect(view.store.getState().answers.saveStatus).toBe('stopped');
    expect(screen.getByRole('alert')).toHaveTextContent(/không thể tự động lưu/i);
    expect(screen.queryByText(/đang thử lại/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tải lại bản mới nhất/i })).toBeInTheDocument();

    // Verify autosave is stopped (blocked) and does NOT retry PUT on next timer ticks
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(http.put).toHaveBeenCalledOnce();

    // Confirm reload preserves draft and performs authoritative reload
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    http.get.mockResolvedValueOnce(workspace(20, 'server authoritative B') as never);
    fireEvent.click(screen.getByRole('button', { name: /tải lại bản mới nhất/i }));
    await flush();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 10: { essay: 'local C' } });
    expect(screen.getByRole('textbox')).toHaveValue('server authoritative B');
    expect(view.store.getState().answers.version).toBe(20);

    // Editing after reload unblocks autosave with new version 20
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'D' } });
    http.put.mockResolvedValueOnce({ success: true, data: { version: 21 } } as never);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put).toHaveBeenCalledTimes(2);
    expect(http.put.mock.calls[1][1]).toEqual({ version: 20, answers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: 'D' }] }] });
    expect(view.store.getState().answers.version).toBe(21);
  });

  it('deferred PUT receives non-version 409 at deadline, proceeds with TIMEOUT_CLIENT POST containing final draft C, and does not retry PUT', async () => {
    // Workspace with deadline 20s in future
    http.get.mockResolvedValueOnce(workspace(7, 'A', now + 20000) as never);
    let rejectPut!: (error: unknown) => void;
    http.put.mockReturnValueOnce(new Promise((_, r) => { rejectPut = r; }) as never);
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } } as never);

    mount(); await flush();
    expect(screen.getByRole('textbox')).toHaveValue('A');

    // User edits 'B' before deadline, autosave interval triggers at 15s (still within deadline)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put).toHaveBeenCalledOnce();
    expect(http.put.mock.calls[0][1]).toEqual({ version: 7, answers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: 'B' }] }] });

    // User edits 'C' while PUT is deferred / in flight
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C' } });

    // Deadline arrives (advance 5001ms to now + 20001ms) -> triggers timeout submission
    // Pending PUT is rejected at deadline + 1ms with non-version 409 ATTEMPT_EXPIRED
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001);
      rejectPut({ response: { status: 409, data: { code: 409, message: 'ATTEMPT_EXPIRED' } } });
      await vi.advanceTimersByTimeAsync(100);
    });

    // Barrier allows submit to proceed: TIMEOUT_CLIENT POST is sent with final answers 'C' and baseVersion 7
    expect(http.post).toHaveBeenCalledOnce();
    expect(http.post.mock.calls[0][1]).toEqual({
      reason: 'TIMEOUT_CLIENT',
      baseVersion: 7,
      finalAnswers: [{ part_id: 10, answers: [{ question_id: 'essay', answer: 'C' }] }],
    });

    // No extra PUT retry was sent
    expect(http.put).toHaveBeenCalledOnce();

    // Draft C is preserved in localStorage
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 10: { essay: 'C' } });
  });

  it('deferred PUT receives version conflict 1601 at deadline, blocks TIMEOUT_CLIENT POST and enters conflict state', async () => {
    http.get.mockResolvedValueOnce(workspace(7, 'A', now + 20000) as never);
    let rejectPut!: (error: unknown) => void;
    http.put.mockReturnValueOnce(new Promise((_, r) => { rejectPut = r; }) as never);

    const view = mount(); await flush();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'B' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(http.put).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'C' } });

    // Reject PUT with version conflict 1601 at deadline
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5001);
      rejectPut({ response: { status: 409, data: { code: 1601 } } });
      await vi.advanceTimersByTimeAsync(100);
    });

    // Submission POST must be blocked due to version conflict!
    expect(http.post).not.toHaveBeenCalled();
    expect(view.store.getState().answers.saveStatus).toBe('conflict');
  });

  it('keeps timed-out answers read-only after network error, retries TIMEOUT_CLIENT, and requires a receipt for result', async () => {
    http.get.mockResolvedValueOnce(workspace(7, 'Essay', now + 2000) as never);
    http.post.mockRejectedValueOnce(new Error('offline'));
    const view = mount(); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /xem kết quả/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('offline');
    act(() => {
      view.store.dispatch(setAnswer({ partId: 10, questionId: 'essay', value: 'after deadline' }));
      view.store.dispatch(toggleFlag({ partId: 10, questionId: 'essay' }));
    });
    expect(view.store.getState().answers.answers[10].essay).toBe('Essay');
    expect(view.store.getState().answers.flags).toEqual({});
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'AI_GRADING', redirectUrl: '/attempts/42/result' } } as never);
    fireEvent.click(screen.getByRole('button', { name: /thử lại ngay/i })); await flush();
    expect(http.post.mock.calls.map(call => (call[1] as { reason: string }).reason)).toEqual(['TIMEOUT_CLIENT', 'TIMEOUT_CLIENT']);
    expect(http.put).not.toHaveBeenCalled();
    expect(view.store.getState().answers.version).toBe(7);
    expect(view.store.getState().answers).toMatchObject({ isLocked: true, answers: { 10: { essay: 'Essay' } } });
    fireEvent.click(screen.getByRole('button', { name: /xem kết quả/i }));
    expect(screen.getByTestId('confirmed-result')).toBeInTheDocument();
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });

  it('StrictMode replay sends one timeout POST and does not claim result from malformed response', async () => {
    http.get.mockResolvedValue(workspace(7, 'Essay', now - 1) as never);
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 43, status: 'COMPLETED', redirectUrl: '/attempts/43/result' } } as never);
    mount(true); await flush();
    expect(http.post).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent(/phản hồi/i);
    expect(screen.queryByRole('button', { name: /xem kết quả/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('exam_draft_42')).not.toBeNull();
  });
  it('does not navigate via the question palette while POST is pending', async () => {
    const response = workspace();
    response.data.examSnapshot.sections[0].parts.push({ id: 20, title: 'Writing Task 2', questions: [
      { id: 2, question_id: 'essay2', question_number: 2, type: 'ESSAY', question_text: 'Second task prompt' },
    ] });
    http.get.mockResolvedValueOnce(response as never);
    http.post.mockReturnValueOnce(new Promise(() => {}) as never);
    const view = mount(); await flush();
    expect(screen.getByRole('textbox')).toHaveValue('A');
    expect(screen.queryAllByText('Second task prompt')).toHaveLength(0);
    await submit();
    expect(http.post).toHaveBeenCalledOnce();
    const palette = screen.getByRole('navigation', { name: /phần 2/i });
    fireEvent.click(within(palette).getByRole('button'));
    expect(screen.queryAllByText('Second task prompt')).toHaveLength(0);
    expect(screen.getByRole('textbox')).toHaveValue('A');
    view.unmount(); await flush();
  });
  it('shows backup failure inside the timeout dialog, including after POST failure', async () => {
    http.get.mockResolvedValueOnce(workspace(7, 'Essay', now + 1000) as never);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    http.post.mockRejectedValueOnce(new Error('offline'));
    mount(); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(within(screen.getByRole('dialog')).getByText(/không thể lưu bản dự phòng/i)).toBeVisible();
  });

  it('does not treat HTTP 409 as a receipt and retains the final draft after a receipt without snapshot acknowledgment', async () => {
    http.get.mockResolvedValueOnce(workspace(7, 'local final', now - 20000) as never);
    http.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'ATTEMPT_EXPIRED' } } });
    mount(); await flush();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('confirmed-result')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xem kết quả/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 10: { essay: 'local final' } });
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'AI_GRADING', redirectUrl: '/attempts/42/result' } } as never);
    fireEvent.click(screen.getByRole('button', { name: /thử lại ngay/i })); await flush();
    expect(http.post.mock.calls.map(call => (call[1] as { reason: string }).reason)).toEqual(['TIMEOUT_CLIENT', 'TIMEOUT_CLIENT']);
    expect(screen.getByRole('button', { name: /xem kết quả/i })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('exam_draft_42')!)).toEqual({ 10: { essay: 'local final' } });
  });

  it('disables part switch buttons and next-section button when submission is locked or expired (R6)', async () => {
    const multiPartExam = {
      exam_id: 1, code: 'TV3-09-R6', title: 'Multi-part test', type: 'IELTS', sections: [
        {
          id: 100, skill_type: 'READING', title: 'Reading Sec 1', duration_minutes: 30, parts: [
            { id: 10, title: 'Part 1', questions: [{ id: 1, question_id: 'q1', type: 'SINGLE_CHOICE', question_text: 'Q1' }] },
          ],
        },
        {
          id: 200, skill_type: 'READING', title: 'Reading Sec 2', duration_minutes: 30, parts: [
            { id: 20, title: 'Part 2', questions: [{ id: 2, question_id: 'q2', type: 'SINGLE_CHOICE', question_text: 'Q2' }] },
          ],
        },
      ],
    };
    const multiPartWorkspace = {
      success: true,
      data: {
        attemptId: 42,
        status: 'IN_PROGRESS',
        testScope: 'FULL_EXAM',
        testMode: 'MOCK_TEST',
        startTime: new Date(now - 60000).toISOString(),
        serverTime: new Date(Date.now()).toISOString(),
        deadline: new Date(now + 1000).toISOString(),
        gracePeriodSeconds: 15,
        lockedSections: [],
        version: 1,
        savedAnswers: [],
        examSnapshot: multiPartExam,
      },
    };
    http.get.mockResolvedValueOnce(multiPartWorkspace as never);
    http.post.mockReturnValueOnce(new Promise(() => {}) as never);

    mount();
    await flush();

    const partButtons = screen.getAllByRole('button', { name: /Part \d/i });
    expect(partButtons.length).toBe(2);
    expect(partButtons[0]).not.toBeDisabled();

    // Advance timer past deadline to trigger time up & hard lock
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    // Part switch buttons in sidebar must be disabled (R6)
    partButtons.forEach(btn => {
      expect(btn).toBeDisabled();
    });

    const nextBtn = screen.queryByRole('button', { name: /chuyển sang phần tiếp theo/i });
    if (nextBtn) {
      expect(nextBtn).toBeDisabled();
    }
  });
});
