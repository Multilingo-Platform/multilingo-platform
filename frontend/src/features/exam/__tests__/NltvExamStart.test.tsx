import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamStartPage from '../pages/ExamStartPage';
import { createAttempt } from '../api/attemptApi';
import { getExamStructure } from '../api/examApi';

vi.mock('../api/attemptApi', () => ({ createAttempt: vi.fn() }));
vi.mock('../api/examApi', () => ({ getExamStructure: vi.fn() }));

describe('NLTV exam start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExamStructure).mockResolvedValue({
      id: 42, code: 'NLTV-SAMPLE-T1-V1', title: 'Đề thi NLTV mẫu', type: 'NLTV',
      examLanguage: 'vi', durationMinutes: 180,
      sections: [
        { id: 4201, skillType: 'LISTENING', title: 'Nghe', durationMinutes: 60, orderIndex: 1,
          parts: [{ id: 42011, partNumber: 1, title: 'Phần 1' }] },
        { id: 4202, skillType: 'READING', title: 'Đọc', durationMinutes: 60, orderIndex: 2,
          parts: [{ id: 42021, partNumber: 5, title: 'Phần 5' }] },
        { id: 4203, skillType: 'WRITING', title: 'Viết', durationMinutes: 60, orderIndex: 3,
          parts: [{ id: 42031, partNumber: 8, title: 'Bài 1' }, { id: 42032, partNumber: 9, title: 'Bài 2' }] },
      ],
    });
    vi.mocked(createAttempt).mockResolvedValue({ attempt_id: 401 } as any);
  });

  it('shows the backend structure and starts the full exam without inventing certificate-specific parts', async () => {
    render(<MemoryRouter initialEntries={['/student/exam/42']}>
      <Routes><Route path="/student/exam/:examId" element={<ExamStartPage />} /></Routes>
    </MemoryRouter>);

    expect(await screen.findByText('Ngôn ngữ: vi')).toBeInTheDocument();
    expect(screen.getByText('180 phút')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /toàn bộ đề/i }));
    fireEvent.click(screen.getByRole('button', { name: /practice/i }));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu làm bài/i }));

    expect(createAttempt).toHaveBeenCalledWith({ exam_id: 42, test_scope: 'FULL_EXAM',
      test_mode: 'PRACTICE', section_id: null, part_id: null });
  });
});
