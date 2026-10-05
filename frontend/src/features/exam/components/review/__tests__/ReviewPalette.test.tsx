import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewPalette } from '../ReviewPalette';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';

describe('ReviewPalette', () => {
  const questions = [
    { id: 101, content: 'Q1' },
    { id: 102, content: 'Q2' },
    { id: 103, content: 'Q3' },
  ];
  const isCorrectFlags = { '101': true, '102': false };
  const userAnswers = { '101': 1, '102': 2 }; // 103 is unanswered

  it('should render correct semantic colors for answered, incorrect, and blank', () => {
    render(
      <ReviewPalette
        questions={questions as any}
        isCorrectFlags={isCorrectFlags}
        userAnswers={userAnswers}
      />
    );

    const btn1 = screen.getByText('101');
    const btn2 = screen.getByText('102');
    const btn3 = screen.getByText('103');

    // 101: Correct -> Green
    expect(btn1).toHaveClass('bg-[#16A34A]');
    // 102: Incorrect -> Red
    expect(btn2).toHaveClass('bg-[#DC2626]');
    // 103: Blank -> Gray
    expect(btn3).toHaveClass('bg-gray-200');
  });

  it('triggers onSelectQuestion when a question button is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <ReviewPalette
        questions={questions as any}
        isCorrectFlags={isCorrectFlags}
        userAnswers={userAnswers}
        onSelectQuestion={handleSelect}
      />
    );

    fireEvent.click(screen.getByText('102'));
    expect(handleSelect).toHaveBeenCalledWith(102);
  });

  it('displays legend with correct counts', () => {
    render(
      <ReviewPalette
        questions={questions as any}
        isCorrectFlags={isCorrectFlags}
        userAnswers={userAnswers}
      />
    );

    expect(screen.getByText(/1 Đúng/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Sai/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Chưa làm/i)).toBeInTheDocument();
  });
});
