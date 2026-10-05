import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExamReviewPage from '../ExamReviewPage';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as reviewHook from '../../hooks/useExamReview';
import '@testing-library/jest-dom';

vi.mock('../../hooks/useExamReview');

describe('ExamReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.spyOn(reviewHook, 'useExamReview').mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/attempts/1/review']}>
        <Routes>
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Đang tải dữ liệu/i)).toBeInTheDocument();
  });

  it('renders error state when API fails', () => {
    vi.spyOn(reviewHook, 'useExamReview').mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Network error'),
    });

    render(
      <MemoryRouter initialEntries={['/attempts/1/review']}>
        <Routes>
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Lỗi khi tải kết quả/i)).toBeInTheDocument();
  });

  it('renders questions, answers, and explanations when data loads', async () => {
    const mockData = {
      attemptId: 1,
      partId: 1,
      partResult: {},
      userAnswers: { '101': 1 },
      examData: {
        questions: [
          {
            id: 101,
            content: 'What is the capital of France?',
            explanation: 'Paris is the capital of France.',
            options: [
              { id: 1, content: 'Paris', isCorrect: true },
              { id: 2, content: 'London', isCorrect: false },
            ],
          },
        ],
      },
    };

    vi.spyOn(reviewHook, 'useExamReview').mockReturnValue({
      data: mockData as any,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/attempts/1/review']}>
        <Routes>
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris is the capital of France.')).toBeInTheDocument();
    expect(screen.getByText('Quay lại bảng điểm')).toBeInTheDocument();
  });

  it('renders Part navigation tabs and switches parts when clicked', async () => {
    const mockData = {
      attemptId: 1,
      partId: 1,
      partResult: {},
      userAnswers: {},
      examData: {
        questions: [{ id: 101, content: 'Q1' }],
      },
    };

    const hookSpy = vi.spyOn(reviewHook, 'useExamReview').mockReturnValue({
      data: mockData as any,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/attempts/1/review']}>
        <Routes>
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify part tabs exist
    const part2Tab = screen.getByRole('button', { name: /Part 2/i });
    expect(part2Tab).toBeInTheDocument();

    // Click Part 2 tab
    fireEvent.click(part2Tab);
    await waitFor(() => {
      expect(hookSpy).toHaveBeenCalledWith(1, 2);
    });
  });
});
