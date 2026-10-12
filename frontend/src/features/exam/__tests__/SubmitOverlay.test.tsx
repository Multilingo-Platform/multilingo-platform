import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubmitOverlay } from '../components/SubmitOverlay';

describe('SubmitOverlay feedback', () => {
  it('announces manual errors with a retry, not an expired label', () => {
    const retry = vi.fn();
    render(<SubmitOverlay visible isRetrying={false} error="Network offline" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Network offline');
    expect(screen.queryByText('Hết thời gian!')).not.toBeInTheDocument();
    const button = screen.getByRole('button', { name: /thử nộp lại/i });
    button.focus(); expect(button).toHaveFocus(); fireEvent.click(button); expect(retry).toHaveBeenCalledOnce();
  });
  it('shows busy status without a retry action', () => {
    render(<SubmitOverlay visible isRetrying onRetry={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang nộp bài');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
