import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExamReviewPage from '../ExamReviewPage';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as resultHook from '../../hooks/useAttemptResult';
import * as reviewHook from '../../hooks/useExamReview';
import { attemptReviewFixture } from '../../__tests__/fixtures/attemptReview';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../../auth/store/authSlice';
import answerReducer from '../../store/answerSlice';

vi.mock('../../hooks/useAttemptResult');
vi.mock('../../hooks/useExamReview', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useExamReview')>('../../hooks/useExamReview');
  return {
    ...actual,
    useExamReview: vi.fn(),
  };
});

describe('ExamReviewPage', () => {
  const mockReviewParts = [
    { id: 10, label: 'Reading Passage 1' },
    { id: 20, label: 'Reading Passage 2' },
    { id: 30, label: 'Writing Task 1' },
  ];

  const defaultResultData = {
    attemptId: 42,
    status: 'COMPLETED' as const,
    testScope: 'FULL_TEST' as const,
    testMode: 'MOCK_TEST' as const,
    startTime: '2026-10-11T07:00:00Z',
    endTime: '2026-10-11T08:00:00Z',
    timeSpentSeconds: 3600,
    overallScore: 8.0,
    summaryAvailable: true,
    resultSummary: null,
    reviewParts: mockReviewParts,
  };

  const defaultReviewData = attemptReviewFixture(42, 10);

  const mockResultHook = vi.mocked(resultHook.useAttemptResult);
  const mockReviewHook = vi.mocked(reviewHook.useExamReview);

  beforeEach(() => {
    vi.clearAllMocks();

    mockResultHook.mockReturnValue({
      data: defaultResultData as any,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: vi.fn(),
    });

    mockReviewHook.mockReturnValue({
      data: defaultReviewData as any,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: vi.fn(),
    });
  });

  function renderPage(initialEntry = '/attempts/42/review') {
    const store = configureStore({ reducer: { auth: authReducer, answers: answerReducer } });
    return render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
            <Route path="/attempts/:attemptId/result" element={<h1>Kết quả bài làm</h1>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );
  }

  it('renders loading state with role="status" while result is loading', () => {
    mockResultHook.mockReturnValue({
      data: null,
      loading: true,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: vi.fn(),
    });

    renderPage();

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent(/Đang tải thông tin bài làm/i);
  });

  it('renders loading state with role="status" while review is loading', () => {
    mockReviewHook.mockReturnValue({
      data: null,
      loading: true,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: vi.fn(),
    });

    renderPage();

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent(/Đang tải dữ liệu bài làm/i);
  });

  it('renders invalid attemptId alert when attemptId in URL is not a valid integer', () => {
    renderPage('/attempts/abc/review');

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/Mã bài làm không hợp lệ/i);
    expect(mockReviewHook).toHaveBeenCalledWith(null, null);
  });

  it('renders error state with role="alert" when result hook returns error', () => {
    mockResultHook.mockReturnValue({
      data: null,
      loading: false,
      refreshing: false,
      error: { kind: 'forbidden', message: 'Bạn không có quyền xem kết quả này', retryable: false },
      refreshError: null,
      reload: vi.fn(),
    });

    renderPage();

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/Bạn không có quyền xem kết quả này/i);
  });

  it('renders empty alert when reviewParts is empty', () => {
    mockResultHook.mockReturnValue({
      data: { ...defaultResultData, reviewParts: [] } as any,
      loading: false,
      refreshing: false,
      error: null,
      refreshError: null,
      reload: vi.fn(),
    });

    renderPage();

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/Không có phần thi để xem lại/i);
    expect(mockReviewHook).toHaveBeenCalledWith(42, null);
  });

  it('selects first part in reviewParts when partId query param is absent', () => {
    renderPage('/attempts/42/review');

    // Should call useExamReview with first part ID (10)
    expect(mockReviewHook).toHaveBeenCalledWith(42, 10);

    // Verify navigation tabs
    expect(screen.getByRole('button', { name: 'Reading Passage 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reading Passage 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Writing Task 1' })).toBeInTheDocument();
  });

  it('selects partId from query param when valid and present in reviewParts', () => {
    renderPage('/attempts/42/review?partId=20');

    expect(mockReviewHook).toHaveBeenCalledWith(42, 20);
  });

  it('renders selection error alert and does not call review API when query partId is not in reviewParts', () => {
    renderPage('/attempts/42/review?partId=999');

    expect(mockReviewHook).toHaveBeenCalledWith(42, null);
    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/Phần thi không hợp lệ/i);

    // Button to switch to first valid part
    const switchBtn = screen.getByRole('button', { name: /Chuyển đến Reading Passage 1/i });
    expect(switchBtn).toBeInTheDocument();
  });

  it.each(['', ' ', '-5', '010', '1e1', '10.0', '0xA', 'abc', '999'])(
    'renders selection error alert and does not call review API when query partId is "%s"',
    (rawPartId) => {
      renderPage(`/attempts/42/review?partId=${encodeURIComponent(rawPartId)}`);

      expect(mockReviewHook).toHaveBeenCalledWith(42, null);
      expect(screen.getByRole('alert')).toHaveTextContent(/Phần thi không hợp lệ/i);
    }
  );

  it('switches part tab and updates selection when a part tab button is clicked', () => {
    renderPage('/attempts/42/review?partId=10');

    const part2Tab = screen.getByRole('button', { name: 'Reading Passage 2' });
    fireEvent.click(part2Tab);

    // After clicking Part 2, hook should be called with partId 20
    expect(mockReviewHook).toHaveBeenCalledWith(42, 20);
  });

  it('renders review error with role="alert" and allows keyboard-accessible retry', () => {
    const reloadFn = vi.fn();
    mockReviewHook.mockReturnValue({
      data: null,
      loading: false,
      refreshing: false,
      error: new reviewHook.ExamReviewError('REQUEST_ERROR', 'Mạng bị gián đoạn'),
      refreshError: null,
      reload: reloadFn,
    });

    renderPage('/attempts/42/review?partId=10');

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(/Mạng bị gián đoạn/i);

    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();
    retryBtn.focus();
    expect(retryBtn).toHaveFocus();
    fireEvent.click(retryBtn);
    expect(reloadFn).toHaveBeenCalled();
  });

  it('renders back to result navigation link', () => {
    renderPage('/attempts/42/review?partId=10');

    const backLink = screen.getByRole('link', { name: /Quay lại bảng điểm/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/attempts/42/result');
  });
});
