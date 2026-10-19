import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../../core/api/axiosClient';
import ExamResultPage from '../ExamResultPage';
import { useAttemptResult } from '../../hooks/useAttemptResult';
import { normalizeAttemptResult } from '../../api/resultContract';
import { attemptResultFixture } from '../../__tests__/fixtures/attemptResult';
import { validAiDoneTextOnlyWire } from '../../__tests__/fixtures/writingFeedback';

vi.mock('../../hooks/useAttemptResult', () => ({ useAttemptResult: vi.fn() }));
const hook = vi.mocked(useAttemptResult);
const reload = vi.fn(async () => {});
function state(): ReturnType<typeof useAttemptResult> {
  return { data: normalizeAttemptResult(attemptResultFixture(), 42), loading: false, refreshing: false,
    error: null, refreshError: null, reload };
}
function mount(id = '42') {
  return render(<MemoryRouter initialEntries={[`/attempts/${id}/result`]}><Routes>
    <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
    <Route path="/student/history" element={<h1>Lịch sử đích</h1>} />
    <Route path="/student/library" element={<h1>Thư viện đích</h1>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { vi.clearAllMocks(); hook.mockReturnValue(state()); });

describe('result page states', () => {
  it('renders backend attempt heading/metadata and no fake review action', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Kết quả thi thử #42' })).toBeInTheDocument();
    expect(screen.getByText('Toàn bộ bài thi')).toBeInTheDocument();
    expect(screen.getByText('1:01:01')).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý chấm Writing')).toBeInTheDocument();
    expect(screen.queryByText(/IELTS Collection/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /xem đáp án/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /xem đáp án/i })).not.toBeInTheDocument();
  });
  it('announces initial load and disables update', () => {
    hook.mockReturnValue({ ...state(), data: null, loading: true }); mount();
    expect(screen.getByRole('status')).toHaveTextContent(/đang tải/i);
    expect(screen.getByRole('button', { name: /cập nhật kết quả/i })).toBeDisabled();
  });
  it('parses invalid ID without coercion and provides an alert', () => {
    hook.mockReturnValue({ ...state(), data: null, error: { kind: 'invalid-id', message: 'Mã bài làm không hợp lệ.', retryable: false } });
    mount('42abc'); expect(hook).toHaveBeenCalledWith(null);
    expect(screen.getByRole('alert')).toHaveTextContent('Mã bài làm không hợp lệ.');
    expect(screen.queryByRole('button', { name: /cập nhật kết quả/i })).not.toBeInTheDocument();
  });
  it.each(['unauthorized', 'forbidden'] as const)('permission %s has no result/retry action', kind => {
    hook.mockReturnValue({ ...state(), data: null, error: { kind, message: 'Không có quyền xem.', retryable: false } }); mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Không có quyền xem.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cập nhật kết quả/i })).not.toBeInTheDocument();
  });
  it('retry is a focusable native button and calls reload explicitly', () => {
    hook.mockReturnValue({ ...state(), data: null, error: { kind: 'request', message: 'Không tải được kết quả.', retryable: true } }); mount();
    const retry = screen.getByRole('button', { name: /cập nhật kết quả/i });
    retry.focus(); expect(retry).toHaveFocus(); fireEvent.click(retry); expect(reload).toHaveBeenCalledOnce();
  });
  it('refresh keeps data with live busy status, then warns about old data', () => {
    hook.mockReturnValue({ ...state(), refreshing: true }); const view = mount();
    expect(screen.getByRole('status')).toHaveTextContent(/đang cập nhật/i);
    expect(screen.getByRole('button', { name: /cập nhật kết quả/i })).toBeDisabled();
    hook.mockReturnValue({ ...state(), refreshError: { kind: 'request', message: 'Chưa cập nhật được kết quả.', retryable: true } });
    view.rerender(<MemoryRouter><ExamResultPage /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent(/chưa cập nhật/i);
  });
  it('unavailable summary never renders overallScore or legacy statistics', () => {
    const data = normalizeAttemptResult({ ...attemptResultFixture(), summaryAvailable: false, resultSummary: null, overallScore: 987 }, 42);
    hook.mockReturnValue({ ...state(), data }); mount();
    expect(screen.getByText(/chưa có bản tổng hợp/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('987')).not.toBeInTheDocument();
    expect(screen.getByText('1:01:01')).toBeInTheDocument();
  });
  it('practice header and scope follow backend', () => {
    const data = normalizeAttemptResult({ ...attemptResultFixture(), testMode: 'PRACTICE', testScope: 'SINGLE_PART' }, 42);
    hook.mockReturnValue({ ...state(), data }); mount();
    expect(screen.getByRole('heading', { name: 'Kết quả luyện tập #42' })).toBeInTheDocument();
    expect(screen.getByText('Một phần thi')).toBeInTheDocument();
  });
  it.each([['Lịch sử làm bài', 'Lịch sử đích'], ['Tới trang đề thi', 'Thư viện đích']])('navigation %s is functional', (label, target) => {
    mount(); fireEvent.click(screen.getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { name: target })).toBeInTheDocument();
  });

  it('renders CTA "Xem bài làm và lời giải" linking to first part when reviewParts is non-empty', () => {
    const dataWithReviewParts = normalizeAttemptResult(
      {
        ...attemptResultFixture(),
        reviewParts: [
          { id: 10, label: 'Reading Passage 1' },
          { id: 20, label: 'Reading Passage 2' },
        ],
      },
      42
    );
    hook.mockReturnValue({ ...state(), data: dataWithReviewParts });
    mount();

    const reviewCta = screen.getByRole('link', { name: /Xem bài làm và lời giải/i });
    expect(reviewCta).toBeInTheDocument();
    expect(reviewCta).toHaveAttribute('href', '/attempts/42/review?partId=10');
  });

  it('does not render review CTA when reviewParts is empty', () => {
    const dataWithoutReviewParts = normalizeAttemptResult(
      {
        ...attemptResultFixture(),
        reviewParts: [],
      },
      42
    );
    hook.mockReturnValue({ ...state(), data: dataWithoutReviewParts });
    mount();

    expect(screen.queryByRole('link', { name: /Xem bài làm và lời giải/i })).not.toBeInTheDocument();
  });

  it('TC_ERP_01: passes data.attemptId to WritingResultSummary; "Cập nhật kết quả" button reloads attempt result without calling feedback hook', () => {
    mount();
    // Disclosure button for part 20 should be rendered because attemptId=42 is passed
    const disclosureBtn = screen.getByRole('button', { name: /Xem nhận xét AI/i });
    expect(disclosureBtn).toBeInTheDocument();
    expect(disclosureBtn).toHaveAttribute('aria-controls', 'writing-feedback-part-20');

    // Click "Cập nhật kết quả" button
    const updateResultBtn = screen.getByRole('button', { name: /Cập nhật kết quả/i });
    expect(updateResultBtn).toBeInTheDocument();
    fireEvent.click(updateResultBtn);
    expect(reload).toHaveBeenCalledOnce();
  });

  it('TC_ERP_02: navigating between attempts on the same route instance resets disclosure state and prevents GET for new attempt until clicked', async () => {
    const mockGet = vi.spyOn(axiosClient, 'get').mockImplementation(async (url: string, config?: any) => {
      const match = url.match(/\/attempts\/(\d+)\/writing-feedback/);
      const matchedAttemptId = match ? Number(match[1]) : 42;
      return {
        success: true,
        data: {
          ...validAiDoneTextOnlyWire,
          attemptId: matchedAttemptId,
          partId: config?.params?.partId ?? 20,
        },
      };
    });

    // 1. Initial attempt 42
    hook.mockReturnValue(state());
    const view = mount('42');

    // Open part 20 on attempt 42
    const btn42 = screen.getByRole('button', { name: /Xem nhận xét AI/i });
    await act(async () => {
      fireEvent.click(btn42);
    });
    expect(btn42).toHaveAttribute('aria-expanded', 'true');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      '/v1/attempts/42/writing-feedback',
      expect.objectContaining({ params: { partId: 20 } })
    );

    // 2. Navigate to attempt 43 (simulate route change with new data)
    hook.mockReturnValue({
      ...state(),
      data: normalizeAttemptResult(attemptResultFixture(43), 43),
    });

    await act(async () => {
      view.rerender(
        <MemoryRouter initialEntries={['/attempts/43/result']}>
          <Routes>
            <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    // Disclosure on attempt 43 MUST be closed, and no second GET dispatched
    const btn43 = screen.getByRole('button', { name: /Xem nhận xét AI/i });
    expect(btn43).toHaveAttribute('aria-expanded', 'false');
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Click to open on attempt 43
    await act(async () => {
      fireEvent.click(btn43);
    });
    expect(btn43).toHaveAttribute('aria-expanded', 'true');
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith(
      '/v1/attempts/43/writing-feedback',
      expect.objectContaining({ params: { partId: 20 } })
    );
  });
});
