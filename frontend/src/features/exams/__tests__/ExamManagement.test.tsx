import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import ExamManagement from '../pages/admin/ExamManagement';

vi.mock('../../../core/api/axiosClient', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}));

describe('ExamManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders consistent type labels for IELTS Reading Passage 1, 2, and 3', async () => {
    const mockExams = [
      {
        id: 1,
        code: 'IELTS-F36AB1',
        title: 'Cambridge Ielts 20 Test 1 - Reading Passage 1',
        type: 'IELTS_R1',
        isPublished: true,
        parts: 1,
        questions: 13,
        joins: 10,
        updatedAt: '2026-10-31T09:46:00',
      },
      {
        id: 2,
        code: 'IELTS-E341C8',
        title: 'Cambridge Ielts 20 Test 1 - Reading Passage 2',
        type: 'IELTS_R2',
        isPublished: true,
        parts: 1,
        questions: 13,
        joins: 8,
        updatedAt: '2026-10-31T09:46:00',
      },
      {
        id: 3,
        code: 'IELTS-5EC369',
        title: 'Cambridge Ielts 20 Test 1 - Reading Passage 3',
        type: 'IELTS_R3',
        isPublished: true,
        parts: 1,
        questions: 14,
        joins: 5,
        updatedAt: '2026-10-31T09:47:00',
      },
    ];

    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: mockExams,
    } as any);

    render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('IELTS-F36AB1')).toBeInTheDocument();
    });

    // Check all three badge labels are consistent
    expect(screen.getByText('IELTS Reading Passage 1')).toBeInTheDocument();
    expect(screen.getByText('IELTS Reading Passage 2')).toBeInTheDocument();
    expect(screen.getByText('IELTS Reading Passage 3')).toBeInTheDocument();

    // Verify it doesn't render raw truncated fallback names like "IELTS R2" or "IELTS R3"
    expect(screen.queryByText('IELTS R2')).not.toBeInTheDocument();
    expect(screen.queryByText('IELTS R3')).not.toBeInTheDocument();
  });

  it('paginates exams correctly and navigates between pages', async () => {
    // Generate 15 sample exams
    const mockExams = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      code: `EXAM-${String(i + 1).padStart(3, '0')}`,
      title: `Đề thi số ${i + 1}`,
      type: 'IELTS_ACADEMIC',
      isPublished: true,
      parts: 4,
      questions: 40,
      joins: i * 2,
      updatedAt: '2026-10-31T10:00:00',
    }));

    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: mockExams,
    } as any);

    render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('EXAM-001')).toBeInTheDocument();
    });

    // Page 1 should show items 1-10
    expect(screen.getByText('EXAM-010')).toBeInTheDocument();
    expect(screen.queryByText('EXAM-011')).not.toBeInTheDocument();

    // Summary info
    expect(screen.getByText(/Hiển thị/)).toBeInTheDocument();
    expect(screen.getByText(/1 - 10/)).toBeInTheDocument();
    expect(screen.getAllByText('15').length).toBeGreaterThan(0);

    // Navigate to Page 2
    const page2Button = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Button);

    // Page 2 should show items 11-15
    expect(screen.queryByText('EXAM-001')).not.toBeInTheDocument();
    expect(screen.getByText('EXAM-011')).toBeInTheDocument();
    expect(screen.getByText('EXAM-015')).toBeInTheDocument();
    expect(screen.getByText(/11 - 15/)).toBeInTheDocument();

    // Change page size to 20
    const selects = screen.getAllByRole('combobox');
    const sizeSelect = selects.find((s) => (s as HTMLSelectElement).value === '10');
    expect(sizeSelect).toBeDefined();
    if (sizeSelect) {
      fireEvent.change(sizeSelect, { target: { value: '20' } });
      // Now all 15 should be visible
      expect(screen.getByText('EXAM-001')).toBeInTheDocument();
      expect(screen.getByText('EXAM-015')).toBeInTheDocument();
    }
  });

  it('correctly filters Full TOEIC L&R exams with TOEIC_LR, TOEIC, and TOEIC_LISTENING_READING types', async () => {
    const mockExams = [
      {
        id: 1,
        code: 'TOEIC-ETS-01',
        title: 'ETS 2024 Test 1',
        type: 'TOEIC_LR',
        isPublished: true,
        parts: 7,
        questions: 200,
        joins: 45,
        updatedAt: '2026-10-31T10:00:00',
      },
      {
        id: 2,
        code: 'TOEIC-LEGACY-02',
        title: 'ETS 2023 Full Test',
        type: 'TOEIC',
        isPublished: true,
        parts: 7,
        questions: 200,
        joins: 30,
        updatedAt: '2026-10-31T10:00:00',
      },
      {
        id: 3,
        code: 'TOEIC-PART-01',
        title: 'TOEIC Part 1 Mini Test',
        type: 'TOEIC_P1',
        isPublished: true,
        parts: 1,
        questions: 6,
        joins: 12,
        updatedAt: '2026-10-31T10:00:00',
      },
      {
        id: 4,
        code: 'IELTS-ACAD-01',
        title: 'Cambridge IELTS 20 Test 1',
        type: 'IELTS_ACADEMIC',
        isPublished: true,
        parts: 4,
        questions: 40,
        joins: 100,
        updatedAt: '2026-10-31T10:00:00',
      },
    ];

    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: mockExams,
    } as any);

    render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TOEIC-ETS-01')).toBeInTheDocument();
    });

    // Initially all exams are displayed
    expect(screen.getByText('ETS 2024 Test 1')).toBeInTheDocument();
    expect(screen.getByText('ETS 2023 Full Test')).toBeInTheDocument();
    expect(screen.getByText('TOEIC Part 1 Mini Test')).toBeInTheDocument();
    expect(screen.getByText('Cambridge IELTS 20 Test 1')).toBeInTheDocument();

    // Select the "Full TOEIC L&R" option in type filter
    const selects = screen.getAllByRole('combobox');
    // First select is the typeFilter
    const typeSelect = selects[0];
    fireEvent.change(typeSelect, { target: { value: 'TOEIC_LR' } });

    // Should display both Full TOEIC L&R exams (TOEIC_LR and TOEIC)
    expect(screen.getByText('ETS 2024 Test 1')).toBeInTheDocument();
    expect(screen.getByText('ETS 2023 Full Test')).toBeInTheDocument();

    // Should NOT display single part or IELTS exams
    expect(screen.queryByText('TOEIC Part 1 Mini Test')).not.toBeInTheDocument();
    expect(screen.queryByText('Cambridge IELTS 20 Test 1')).not.toBeInTheDocument();

    // Summary should show 2 exams
    expect(screen.getByText(/1 - 2/)).toBeInTheDocument();
  });

  it('correctly filters TOEIC Writing exams including TOEIC_WRITING and TW parts', async () => {
    const mockExams = [
      {
        id: 1,
        code: 'TOEIC-WRIT-01',
        title: 'TOEIC Writing Practice 1',
        type: 'TOEIC_WRITING',
        isPublished: true,
        parts: 3,
        questions: 8,
        joins: 15,
        updatedAt: '2026-10-31T10:00:00',
      },
      {
        id: 2,
        code: 'TW-PART-01',
        title: 'TOEIC Writing Part 1 Essay',
        type: 'TW_P1',
        isPublished: true,
        parts: 1,
        questions: 5,
        joins: 10,
        updatedAt: '2026-10-31T10:00:00',
      },
      {
        id: 3,
        code: 'TOEIC-LR-01',
        title: 'ETS 2024 Test 1',
        type: 'TOEIC_LR',
        isPublished: true,
        parts: 7,
        questions: 200,
        joins: 50,
        updatedAt: '2026-10-31T10:00:00',
      },
    ];

    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: mockExams,
    } as any);

    render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TOEIC-WRIT-01')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[0];
    fireEvent.change(typeSelect, { target: { value: 'TOEIC_WRITING' } });

    // Should display both TOEIC Writing exams
    expect(screen.getByText('TOEIC Writing Practice 1')).toBeInTheDocument();
    expect(screen.getByText('TOEIC Writing Part 1 Essay')).toBeInTheDocument();

    // Badges should be formatted consistently
    expect(screen.getAllByText('TOEIC Writing').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TOEIC Writing Part 1')).toBeInTheDocument();

    // Should NOT display Full TOEIC L&R
    expect(screen.queryByText('ETS 2024 Test 1')).not.toBeInTheDocument();

    // Summary should show 2 exams
    expect(screen.getByText(/1 - 2/)).toBeInTheDocument();
  });

  it('correctly filters NLTV exams separating Full NLTV from single-skill exams and formats badges accurately', async () => {
    const mockExams = [
      {
        id: 1,
        code: 'NLTV-979AD3',
        title: 'Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu',
        type: 'NLTV',
        isPublished: true,
        parts: 9,
        questions: 107,
        joins: 2,
        updatedAt: '2026-10-21T00:30:00',
      },
      {
        id: 2,
        code: 'NLTV-02E230',
        title: 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Đọc',
        type: 'NLTV',
        isPublished: false,
        parts: 2,
        questions: 40,
        joins: 0,
        updatedAt: '2026-11-01T21:48:00',
      },
      {
        id: 3,
        code: 'NLTV-6F15F7',
        title: 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Nghe',
        type: 'NLTV',
        isPublished: false,
        parts: 4,
        questions: 55,
        joins: 0,
        updatedAt: '2026-11-01T21:50:00',
      },
      {
        id: 4,
        code: 'NLTV-B06E84',
        title: 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Viết',
        type: 'NLTV',
        isPublished: false,
        parts: 3,
        questions: 12,
        joins: 0,
        updatedAt: '2026-11-01T21:50:00',
      },
    ];

    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: mockExams,
    } as any);

    render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('NLTV-979AD3')).toBeInTheDocument();
    });

    // Check badges: Full NLTV vs individual skill badges
    expect(screen.getByText('Full NLTV (Năng Lực Tiếng Việt)')).toBeInTheDocument();
    expect(screen.getAllByText('NLTV Đọc').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('NLTV Nghe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('NLTV Viết').length).toBeGreaterThanOrEqual(1);

    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[0];

    // 1. Filter by "Full NLTV" (value: NLTV)
    fireEvent.change(typeSelect, { target: { value: 'NLTV' } });
    expect(screen.getByText('NLTV-979AD3')).toBeInTheDocument();
    expect(screen.queryByText('NLTV-02E230')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-6F15F7')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-B06E84')).not.toBeInTheDocument();

    // 2. Filter by "NLTV Đọc" (value: NLTV_READING)
    fireEvent.change(typeSelect, { target: { value: 'NLTV_READING' } });
    expect(screen.queryByText('NLTV-979AD3')).not.toBeInTheDocument();
    expect(screen.getByText('NLTV-02E230')).toBeInTheDocument();
    expect(screen.queryByText('NLTV-6F15F7')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-B06E84')).not.toBeInTheDocument();

    // 3. Filter by "NLTV Nghe" (value: NLTV_LISTENING)
    fireEvent.change(typeSelect, { target: { value: 'NLTV_LISTENING' } });
    expect(screen.queryByText('NLTV-979AD3')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-02E230')).not.toBeInTheDocument();
    expect(screen.getByText('NLTV-6F15F7')).toBeInTheDocument();
    expect(screen.queryByText('NLTV-B06E84')).not.toBeInTheDocument();

    // 4. Filter by "NLTV Viết" (value: NLTV_WRITING)
    fireEvent.change(typeSelect, { target: { value: 'NLTV_WRITING' } });
    expect(screen.queryByText('NLTV-979AD3')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-02E230')).not.toBeInTheDocument();
    expect(screen.queryByText('NLTV-6F15F7')).not.toBeInTheDocument();
    expect(screen.getByText('NLTV-B06E84')).toBeInTheDocument();

    // 5. Filter by "NLTV" (all NLTV exams, value: NLTV_ALL)
    fireEvent.change(typeSelect, { target: { value: 'NLTV_ALL' } });
    expect(screen.getByText('NLTV-979AD3')).toBeInTheDocument();
    expect(screen.getByText('NLTV-02E230')).toBeInTheDocument();
    expect(screen.getByText('NLTV-6F15F7')).toBeInTheDocument();
    expect(screen.getByText('NLTV-B06E84')).toBeInTheDocument();
  });

  it('renders exam table with fluid responsive layout without forcing global nowrap', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          code: 'TOEIC-C61F25',
          title: 'TOEIC Writing Test 1 - Part 1: Write a Sentence Based on a Picture with Very Long Detailed Description',
          type: 'TOEIC_WRITING',
          isPublished: true,
          parts: 1,
          questions: 5,
          joins: 0,
          updatedAt: '2026-11-05T14:20:00',
        },
      ],
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ExamManagement />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('TOEIC-C61F25')).toBeInTheDocument();
    });

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();
    // Global table should NOT force nowrap
    expect(table?.style.whiteSpace).not.toBe('nowrap');

    const titleCell = container.querySelector('td:nth-child(2)') as HTMLElement;
    expect(titleCell).toBeInTheDocument();
    expect(titleCell.style.whiteSpace).toBe('normal');
  });
});


