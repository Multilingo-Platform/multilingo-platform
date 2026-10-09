import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScopeModePicker from '../components/ScopeModePicker';
import type { LearnerExamStructureSection } from '../types/api.types';

const mockSections: LearnerExamStructureSection[] = [
  {
    id: 70,
    skillType: 'READING',
    title: 'Reading Section',
    durationMinutes: 60,
    orderIndex: 1,
    parts: [
      { id: 701, partNumber: 1, title: 'Reading Part 1' },
      { id: 709, partNumber: 2, title: null },
    ],
  },
  {
    id: 95,
    skillType: 'LISTENING',
    title: 'Listening Section',
    durationMinutes: 40,
    orderIndex: 2,
    parts: [
      { id: 951, partNumber: 1, title: 'Listening Part 1' },
    ],
  },
  {
    id: 99,
    skillType: 'WRITING',
    title: 'Writing Section',
    durationMinutes: 60,
    orderIndex: 3,
    parts: [],
  },
];

describe('ScopeModePicker', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => mockSubmit.mockReset());

  it('TC_TV305_PICKER_01: submits FULL_EXAM + MOCK_TEST with null IDs', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Toàn bộ đề'));
    fireEvent.click(screen.getByText('Mock Test'));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'FULL_EXAM',
      test_mode: 'MOCK_TEST',
      section_id: null,
      part_id: null,
    });
  });

  it('TC_TV305_PICKER_02: submits SINGLE_SKILL with real selected section ID', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Một kỹ năng'));
    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Section' }));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'SINGLE_SKILL',
      test_mode: 'PRACTICE',
      section_id: 70,
      part_id: null,
    });
  });

  it('TC_TV305_PICKER_03: submits SINGLE_PART with real containing section and part IDs', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Một phần'));
    fireEvent.click(screen.getByText('Mock Test'));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Part 1' }));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'SINGLE_PART',
      test_mode: 'MOCK_TEST',
      section_id: 70,
      part_id: 701,
    });
  });

  it('TC_TV305_PICKER_04: changing section clears previously selected part and filters options', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Một phần'));
    fireEvent.click(screen.getByText('Mock Test'));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Part 1' }));

    const submitBtn = screen.getByRole('button', { name: /bắt đầu/i });
    expect(submitBtn).not.toBeDisabled();

    // Change section to Listening
    fireEvent.click(screen.getByRole('button', { name: 'Listening Section' }));

    // Submit button should now be disabled because part is cleared
    expect(submitBtn).toBeDisabled();

    // Reading Part 1 should no longer be rendered
    expect(screen.queryByRole('button', { name: 'Reading Part 1' })).toBeNull();

    // Listening Part 1 should be available
    fireEvent.click(screen.getByRole('button', { name: 'Listening Part 1' }));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'SINGLE_PART',
      test_mode: 'MOCK_TEST',
      section_id: 95,
      part_id: 951,
    });
  });

  it('TC_TV305_PICKER_05: part with null title falls back to Part {partNumber}', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Một phần'));
    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByRole('button', { name: 'Reading Section' }));
    // Part with null title should render as "Part 2"
    const part2Btn = screen.getByRole('button', { name: 'Part 2' });
    fireEvent.click(part2Btn);
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'SINGLE_PART',
      test_mode: 'PRACTICE',
      section_id: 70,
      part_id: 709,
    });
  });

  it('TC_TV305_PICKER_06: empty section shows message and keeps submit disabled', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Một phần'));
    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByRole('button', { name: 'Writing Section' }));

    expect(screen.getByText(/chưa có phần thi nào/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('TC_TV305_A11Y_01: aria-pressed and aria-busy attributes are set correctly', () => {
    const { rerender } = render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );

    const form = screen.getByRole('form', { name: 'Thiết lập phiên thi' });
    expect(form).toHaveAttribute('aria-busy', 'false');

    const fullExamBtn = screen.getByRole('button', { name: /toàn bộ đề/i });
    expect(fullExamBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(fullExamBtn);
    expect(fullExamBtn).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={true}
        error={null}
      />
    );
    expect(form).toHaveAttribute('aria-busy', 'true');
  });

  it('button disabled when mode not selected', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText('Toàn bộ đề'));
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('shows error message when error prop is set', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={false}
        error="Không thể tạo phiên thi"
      />
    );
    expect(screen.getByText(/không thể tạo phiên thi/i)).toBeInTheDocument();
  });

  it('disables submit button when isLoading is true', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        onSubmit={mockSubmit}
        isLoading={true}
        error={null}
      />
    );
    const btn = screen.getByRole('button', { name: /đang tạo|bắt đầu/i });
    expect(btn).toBeDisabled();
  });

  it('automatically preselects scope and mode when initialScope and initialMode props are passed', () => {
    render(
      <ScopeModePicker
        examId={42}
        sections={mockSections}
        initialScope="FULL_EXAM"
        initialMode="PRACTICE"
        onSubmit={mockSubmit}
        isLoading={false}
        error={null}
      />
    );
    const submitBtn = screen.getByRole('button', { name: /bắt đầu làm bài/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 42,
      test_scope: 'FULL_EXAM',
      test_mode: 'PRACTICE',
      section_id: null,
      part_id: null,
    });
  });
});
