import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { ExamResultPage } from '../pages/ExamResultPage';
import WorkspacePage from '../pages/WorkspacePage';
import answerReducer from '../store/answerSlice';
import { attemptResultFixture, resultEnvelope } from './fixtures/attemptResult';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
const http = vi.mocked(axiosClient);
function deferred() {
  let resolve!: (value: unknown) => void;
  return { promise: new Promise(r => { resolve = r; }), resolve: (value: unknown) => resolve(value) };
}
function RouteControls() {
  const navigate = useNavigate();
  return <nav aria-label="Test route controls">{[42, 43].map(id => <button key={id} onClick={() => navigate(`/attempts/${id}/result`)}>Open {id}</button>)}</nav>;
}
function mount(strict = false) {
  const content = <MemoryRouter initialEntries={['/attempts/42/result']}><RouteControls /><Routes>
    <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
  </Routes></MemoryRouter>;
  return render(strict ? <StrictMode>{content}</StrictMode> : content);
}
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TV3-12 real result pipeline (only HTTP/browser mocked)', () => {
  it('direct URL consumes GET only, leaves conflicting draft untouched and never accesses result storage', async () => {
    localStorage.setItem('exam_draft_42', JSON.stringify({ 20: { essay: 'PRIVATE local C' } }));
    const getStorage = vi.spyOn(Storage.prototype, 'getItem');
    const setStorage = vi.spyOn(Storage.prototype, 'setItem');
    const removeStorage = vi.spyOn(Storage.prototype, 'removeItem');
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    mount(); await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });
    expect(screen.getAllByText('5,5')).toHaveLength(3);
    expect(screen.queryByText('PRIVATE local C')).not.toBeInTheDocument();
    expect(getStorage).not.toHaveBeenCalled(); expect(setStorage).not.toHaveBeenCalled(); expect(removeStorage).not.toHaveBeenCalled();
    getStorage.mockRestore();
    expect(localStorage.getItem('exam_draft_42')).toContain('PRIVATE local C');
    expect(http.get).toHaveBeenCalledOnce(); expect(http.get.mock.calls[0][0]).toBe('/v1/attempts/42/result');
    expect(http.put).not.toHaveBeenCalled(); expect(http.post).not.toHaveBeenCalled();
  });
  it('updates pending Writing only on a manual click, not a timer or focus event', async () => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    mount(); await screen.findByRole('heading', { name: 'Kết quả thi thử #42' });
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); window.dispatchEvent(new Event('focus')); });
    expect(http.get).toHaveBeenCalledOnce();
    const wire = attemptResultFixture(); wire.status = 'COMPLETED';
    wire.resultSummary.writing.status = 'UNAVAILABLE'; wire.resultSummary.writing.tasks[0].status = 'UNAVAILABLE';
    http.get.mockResolvedValueOnce(resultEnvelope(wire) as never);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /cập nhật kết quả/i })); });
    expect(screen.getByText('Bài làm đã hoàn tất')).toBeInTheDocument();
    expect(screen.getAllByText('Chưa có kết quả chấm Writing')).toHaveLength(2);
    expect(screen.getByText('Chưa có điểm')).toBeInTheDocument(); expect(http.get).toHaveBeenCalledTimes(2);
  });
  it('replaces old summary with unavailable data without falling back to stored overallScore', async () => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    mount(); await screen.findByRole('table', { name: 'Kết quả theo phần thi' });
    http.get.mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), summaryAvailable: false, resultSummary: null, overallScore: 987 }) as never);
    fireEvent.click(screen.getByRole('button', { name: /cập nhật kết quả/i }));
    await screen.findByText(/chưa có bản tổng hợp/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument(); expect(screen.queryByText('987')).not.toBeInTheDocument();
  });
  it.each(['forbidden', 'contract'] as const)('removes previous private result after refresh %s', async failure => {
    http.get.mockResolvedValueOnce(resultEnvelope() as never);
    mount(); await screen.findByRole('table', { name: 'Kết quả theo phần thi' });
    if (failure === 'forbidden') http.get.mockRejectedValueOnce({ response: { status: 403, data: { message: 'PRIVATE' } } });
    else http.get.mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), attemptId: 43 }) as never);
    fireEvent.click(screen.getByRole('button', { name: /cập nhật kết quả/i }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Bài viết tiếng Việt')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('PRIVATE');
  });
  it('A→B→A route changes ignore old completion while latest A is still loading', async () => {
    const oldA = deferred(); const b = deferred(); const newA = deferred();
    http.get.mockReturnValueOnce(oldA.promise as never).mockReturnValueOnce(b.promise as never).mockReturnValueOnce(newA.promise as never);
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Open 43' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open 42' }));
    await act(async () => { oldA.resolve(resultEnvelope()); b.resolve(resultEnvelope(attemptResultFixture(43))); });
    expect(screen.getByRole('status')).toHaveTextContent(/đang tải/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await act(async () => { newA.resolve(resultEnvelope({ ...attemptResultFixture(), testMode: 'PRACTICE' })); });
    expect(screen.getByRole('heading', { name: 'Kết quả luyện tập #42' })).toBeInTheDocument();
  });
  it('StrictMode replay aborts previous GET without stale UI or saving state', async () => {
    const old = deferred();
    http.get.mockReturnValueOnce(old.promise as never).mockResolvedValueOnce(resultEnvelope({ ...attemptResultFixture(), testMode: 'PRACTICE' }) as never);
    mount(true); await screen.findByRole('heading', { name: 'Kết quả luyện tập #42' });
    expect(http.get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => { old.resolve(resultEnvelope()); });
    expect(screen.getByRole('heading', { name: 'Kết quả luyện tập #42' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cập nhật kết quả/i })).not.toBeDisabled();
  });
  it('unavailable direct response ignores contradictory legacy fields', async () => {
    const { resultSummary: legacy, ...metadata } = attemptResultFixture();
    http.get.mockResolvedValueOnce(resultEnvelope({ ...metadata, summaryAvailable: false, resultSummary: null,
      totalScore: legacy.totalScore, correctCount: 999 }) as never);
    mount(); await screen.findByText(/chưa có bản tổng hợp/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
  it('preserves backend multi-skill/part order, IDs and independent statistics', async () => {
    const wire = attemptResultFixture();
    const listening = { rawScore: 1, correct: 1, incorrect: 0, unanswered: 0, total: 1, accuracy: 100 };
    Object.assign(wire.resultSummary.objective, { rawScore: 6.5, correct: 2, total: 4, accuracy: 50 });
    wire.resultSummary.objective.bySkill.unshift({ ...listening, skill: 'LISTENING' });
    wire.resultSummary.objective.byPart.unshift({ ...listening, partId: 80, skill: 'LISTENING', label: 'Phần nghe 80' });
    http.get.mockResolvedValueOnce(resultEnvelope(wire) as never);
    mount(); const table = await screen.findByRole('table', { name: 'Kết quả theo phần thi' });
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows[0]).toHaveTextContent('Phần nghe 80'); expect(rows[0]).toHaveTextContent('100,00%');
    expect(rows[1]).toHaveTextContent('Phần đọc tiếng Việt'); expect(rows[1]).toHaveTextContent('33,33%');
    expect(screen.getByText('6,5')).toBeInTheDocument(); expect(screen.getByText('2/4')).toBeInTheDocument();
  });
  it('Writing-only backend result has no objective score cards or tables', async () => {
    const wire = attemptResultFixture();
    wire.resultSummary.objective = { rawScore: 0, correct: 0, incorrect: 0, unanswered: 0, total: 0, accuracy: 0,
      scoreUnit: 'RAW_OBJECTIVE', bySkill: [], byPart: [] };
    wire.overallScore = 0; wire.timeSpentSeconds = 0;
    http.get.mockResolvedValueOnce(resultEnvelope(wire) as never);
    mount(); await screen.findByText(/Không có câu khách quan/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Điểm khách quan (raw)')).not.toBeInTheDocument();
    expect(screen.getByText('Bài viết tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('0:00:00')).toBeInTheDocument(); expect(screen.getByText('Chưa có điểm')).toBeInTheDocument();
  });
  it('confirmed real workspace submission navigates to result GET, not local answers or submit receipt', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T00:01:00Z'));
    window.scrollTo = vi.fn(); Element.prototype.scrollIntoView = vi.fn();
    const workspace = { success: true, data: {
      attemptId: 42, status: 'IN_PROGRESS', testScope: 'SINGLE_PART', testMode: 'MOCK_TEST',
      startTime: '2026-10-11T00:00:00Z', serverTime: '2026-10-11T00:01:00Z', deadline: '2026-10-11T01:00:00Z',
      gracePeriodSeconds: 15, lockedSections: [], version: 7,
      savedAnswers: [{ part_id: 20, answers: [{ question_id: 'essay', answer: 'Local essay C' }] }],
      examSnapshot: { exam_id: 1, code: 'TV3-12', title: 'Writing', type: 'IELTS', sections: [{
        id: 100, skill_type: 'WRITING', title: 'Writing', duration_minutes: 60, parts: [{ id: 20, title: 'Writing', questions: [{
          id: 1, question_id: 'essay', question_number: 1, type: 'ESSAY', question_text: 'Write a text',
        }] }],
      }] },
    } };
    http.get.mockResolvedValueOnce(workspace as never).mockResolvedValueOnce(resultEnvelope() as never);
    http.post.mockResolvedValueOnce({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } } as never);
    const store = configureStore({ reducer: { answers: answerReducer } });
    render(<Provider store={store}><MemoryRouter initialEntries={['/attempts/42']}><Routes>
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
    </Routes></MemoryRouter></Provider>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('textbox')).toHaveValue('Local essay C');
    fireEvent.click(screen.getByRole('button', { name: /^🚀?\s*nộp bài$/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    fireEvent.click(screen.getAllByRole('button', { name: /nộp bài/i })[1]);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { name: 'Kết quả thi thử #42' })).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument(); // Backend wordCount, not local essay word count.
    expect(screen.getByText('Đang xử lý chấm Writing')).toBeInTheDocument(); // GET, not submit COMPLETED.
    expect(http.get.mock.calls.map(call => call[0])).toEqual(['/v1/attempts/42/workspace', '/v1/attempts/42/result']);
    expect(http.post).toHaveBeenCalledOnce(); expect(http.put).not.toHaveBeenCalled();
    expect(localStorage.getItem('exam_draft_42')).toContain('Local essay C');
  });
});
