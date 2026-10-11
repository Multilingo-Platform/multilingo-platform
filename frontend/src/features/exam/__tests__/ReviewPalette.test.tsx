import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { ReviewPalette } from '../components/review/ReviewPalette';
import type { ReviewQuestionDto } from '../types/api.types';

describe('ReviewPalette (TV3-14 string IDs & filters)', () => {
  const sampleQuestions: ReviewQuestionDto[] = [
    { questionId: 'q_01', label: '1', verdict: 'CORRECT' },
    { questionId: 'q_02', label: '2', verdict: 'WRONG' },
    { questionId: 'q_03', label: '3', verdict: 'BLANK' },
    { questionId: 'q_04', label: '4', verdict: 'CORRECT' },
    { questionId: 'q_05', label: '5', verdict: 'PENDING' },
  ];

  it('renders question buttons with string question IDs and semantic colors', () => {
    render(<ReviewPalette questions={sampleQuestions} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    const btn1 = screen.getByRole('button', { name: /Câu 1/i });
    expect(btn1).toHaveClass('bg-[#16A34A]');

    const btn2 = screen.getByRole('button', { name: /Câu 2/i });
    expect(btn2).toHaveClass('bg-[#DC2626]');

    const btn3 = screen.getByRole('button', { name: /Câu 3/i });
    expect(btn3).toHaveClass('bg-gray-200');
  });

  it('displays accurate counts in legend', () => {
    render(<ReviewPalette questions={sampleQuestions} />);

    expect(screen.getByText(/2 Đúng/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Sai/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Chưa làm/i)).toBeInTheDocument();
  });

  it('calls onSelectQuestion with string questionId on click', () => {
    const handleSelect = vi.fn();
    render(<ReviewPalette questions={sampleQuestions} onSelectQuestion={handleSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Câu 2/i }));
    expect(handleSelect).toHaveBeenCalledWith('q_02');
  });

  it('filters questions when filter button is clicked', () => {
    const handleFilterChange = vi.fn();
    render(
      <ReviewPalette
        questions={sampleQuestions}
        activeFilter="WRONG"
        onFilterChange={handleFilterChange}
      />
    );

    const wrongFilterBtn = screen.getByRole('button', { name: /Chỉ xem câu sai/i });
    fireEvent.click(wrongFilterBtn);
    expect(handleFilterChange).toHaveBeenCalledWith('WRONG');
  });

  it('highlights the currently selected question with ring', () => {
    render(<ReviewPalette questions={sampleQuestions} selectedQuestionId="q_02" />);

    const btn2 = screen.getByRole('button', { name: /Câu 2/i });
    expect(btn2.className).toContain('ring');
  });

  it('renders "Chấm không thành công" and does NOT affirm "Đang chấm" when writing task is FAILED', () => {
    const summary = {
      writing: {
        status: 'FAILED',
        tasks: [
          {
            partId: 10,
            questionId: 'q_05',
            status: 'FAILED',
            score: null,
          },
        ],
      },
    } as any;

    render(
      <ReviewPalette
        questions={sampleQuestions}
        partId={10}
        resultSummary={summary}
      />
    );

    // Shows 1 Chấm không thành công
    expect(screen.getByText(/1 Chấm không thành công/i)).toBeInTheDocument();
    // NEVER affirms "Đang chấm" for FAILED task
    expect(screen.queryByText(/Đang chấm/i)).not.toBeInTheDocument();
  });

  it('distinguishes QUEUED and UNAVAILABLE writing tasks in legend', () => {
    const questions: ReviewQuestionDto[] = [
      { questionId: 'q_q', label: '1', verdict: 'PENDING', type: 'ESSAY' },
      { questionId: 'q_u', label: '2', verdict: 'PENDING', type: 'ESSAY' },
    ];

    const summary = {
      writing: {
        status: 'PENDING',
        tasks: [
          {
            partId: 20,
            questionId: 'q_q',
            status: 'QUEUED',
            score: null,
          },
          {
            partId: 20,
            questionId: 'q_u',
            status: 'UNAVAILABLE',
            score: null,
          },
        ],
      },
    } as any;

    render(
      <ReviewPalette
        questions={questions}
        partId={20}
        resultSummary={summary}
      />
    );

    expect(screen.getByText(/1 Đang chờ chấm/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Chưa có thông tin/i)).toBeInTheDocument();
    expect(screen.queryByText(/Đang chấm/i)).not.toBeInTheDocument();
  });

  it('renders neutral "Chờ kết quả" when resultSummary is not provided for PENDING questions', () => {
    render(<ReviewPalette questions={sampleQuestions} />);

    expect(screen.getByText(/1 Chờ kết quả/i)).toBeInTheDocument();
    expect(screen.queryByText(/Đang chấm/i)).not.toBeInTheDocument();
  });
});
