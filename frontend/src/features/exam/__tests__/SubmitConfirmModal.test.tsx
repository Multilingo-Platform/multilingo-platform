import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SubmitConfirmModal } from '../components/modals/SubmitConfirmModal';

describe('SubmitConfirmModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays uncompleted questions warning', () => {
    render(<SubmitConfirmModal total={40} answered={38} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Bạn còn 2 câu chưa làm/i)).toBeInTheDocument();
  });

  it('disables confirm button for 2 seconds to prevent accidental double submission', () => {
    const onConfirm = vi.fn();
    render(<SubmitConfirmModal total={40} answered={38} onConfirm={onConfirm} />);
    const confirmBtn = screen.getByRole('button', { name: /Nộp bài/i });
    expect(confirmBtn).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
