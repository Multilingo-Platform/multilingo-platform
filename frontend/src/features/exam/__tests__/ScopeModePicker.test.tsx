import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScopeModePicker from '../components/ScopeModePicker';

describe('ScopeModePicker', () => {
  const mockSubmit = vi.fn();

  it('TC_WS_PICKER_01: submits FULL_EXAM + MOCK_TEST with null IDs', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'FULL_EXAM' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'MOCK_TEST' } });
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
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'FULL_EXAM' } });
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('TC_WS_PICKER_03: SINGLE_PART with missing part_id keeps button disabled', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'SINGLE_PART' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'PRACTICE' } });
    fireEvent.change(screen.getByLabelText(/section/i), { target: { value: '1' } });
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('shows error message when error prop is set', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error="Không thể tạo phiên thi" />);
    expect(screen.getByText(/không thể tạo phiên thi/i)).toBeInTheDocument();
  });

  it('disables button when isLoading is true', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={true} error={null} />);
    // When loading, button text changes to "Đang tạo..." — query by type instead of name
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/đang tạo/i);
  });
});
