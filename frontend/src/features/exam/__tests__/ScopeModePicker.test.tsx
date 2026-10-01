import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScopeModePicker from '../components/ScopeModePicker';

describe('ScopeModePicker', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => mockSubmit.mockReset());

  it('TC_WS_PICKER_01: submits FULL_EXAM + MOCK_TEST with null IDs', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    // Click scope card "Toàn bộ đề"
    fireEvent.click(screen.getByText('Toàn bộ đề'));
    // Click mode card "Mock Test"
    fireEvent.click(screen.getByText('Mock Test'));
    // Click submit button
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 1,
      test_scope: 'FULL_EXAM',
      test_mode: 'MOCK_TEST',
      section_id: null,
      part_id: null,
    });
  });

  it('TC_WS_PICKER_02: button disabled when mode not selected', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    // Select scope only
    fireEvent.click(screen.getByText('Toàn bộ đề'));
    // Submit button should be disabled (mode not selected)
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('TC_WS_PICKER_03: SINGLE_PART with missing part_id keeps button disabled', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    // Select SINGLE_PART scope
    fireEvent.click(screen.getByText('Một phần'));
    // Select mode
    fireEvent.click(screen.getByText('Practice'));
    // Select section — click the pill button with the exact label "📖 Reading"
    const readingPill = screen.getAllByRole('button').find(b => b.textContent?.trim() === '📖 Reading');
    expect(readingPill).toBeDefined();
    fireEvent.click(readingPill!);
    // Part not selected — button should remain disabled
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });



  it('shows error message when error prop is set', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error="Không thể tạo phiên thi" />);
    expect(screen.getByText(/không thể tạo phiên thi/i)).toBeInTheDocument();
  });

  it('disables submit button when isLoading is true', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={true} error={null} />);
    const btn = screen.getByRole('button', { name: /đang tạo|bắt đầu/i });
    expect(btn).toBeDisabled();
  });
});
