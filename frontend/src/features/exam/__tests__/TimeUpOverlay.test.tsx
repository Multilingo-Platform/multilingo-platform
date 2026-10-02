import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimeUpOverlay } from '../components/modals/TimeUpOverlay';

describe('TimeUpOverlay', () => {
  it('renders unclosable time up overlay and calls submit automatically', () => {
    const submitMock = vi.fn();
    render(<TimeUpOverlay isExpired={true} onSubmit={submitMock} />);
    expect(screen.getByText(/Thời gian làm bài đã hết/i)).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledWith('TIMEOUT_CLIENT');
  });

  it('does not render when isExpired is false', () => {
    const submitMock = vi.fn();
    render(<TimeUpOverlay isExpired={false} onSubmit={submitMock} />);
    expect(screen.queryByText(/Thời gian làm bài đã hết/i)).not.toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('renders retry button and message on network error', () => {
    const submitMock = vi.fn();
    const retryMock = vi.fn();
    render(
      <TimeUpOverlay
        isExpired={true}
        onSubmit={submitMock}
        onRetry={retryMock}
        error="Network error"
      />
    );
    expect(screen.getByText(/Kết nối không ổn định/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Thử lại ngay/i });
    fireEvent.click(retryBtn);
    expect(retryMock).toHaveBeenCalledTimes(1);
  });
});
