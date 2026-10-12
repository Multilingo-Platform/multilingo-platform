import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ExamStartPage from '../ExamStartPage';
import * as examApiModule from '../../api/examApi';
import * as attemptApiModule from '../../api/attemptApi';
import type { LearnerExamStructure } from '../../types/api.types';

vi.mock('../../api/examApi', () => ({
  getExamStructure: vi.fn(),
}));

vi.mock('../../api/attemptApi', () => ({
  createAttempt: vi.fn(),
}));

const mockGetExamStructure = examApiModule.getExamStructure as any;
const mockCreateAttempt = attemptApiModule.createAttempt as any;

const sampleStructure: LearnerExamStructure = {
  id: 42,
  code: 'DYNAMIC-CODE-101',
  title: 'Dynamic Exam Title for Testing',
  type: 'TOEFL_MOCK',
  durationMinutes: 90,
  sections: [
    {
      id: 70,
      skillType: 'READING',
      title: 'Reading Skill Section',
      durationMinutes: 45,
      orderIndex: 1,
      parts: [
        { id: 701, partNumber: 1, title: 'Part 1 Reading' },
        { id: 702, partNumber: 2, title: 'Part 2 Reading' },
      ],
    },
    {
      id: 80,
      skillType: 'LISTENING',
      title: 'Listening Skill Section',
      durationMinutes: 45,
      orderIndex: 2,
      parts: [{ id: 801, partNumber: 1, title: 'Part 1 Listening' }],
    },
  ],
};

const renderWithRoute = (initialEntry: string) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/exams/:examId/start" element={<ExamStartPage />} />
        <Route path="/student/exam/:examId" element={<ExamStartPage />} />
        <Route path="/attempts/:attemptId" element={<div data-testid="workspace-target">Workspace Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ExamStartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC_TV305_START_01: renders loading status with role=status and picker absent', async () => {
    mockGetExamStructure.mockReturnValue(new Promise(() => {})); // pending forever

    renderWithRoute('/exams/42/start');

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Thiết lập phiên thi' })).toBeNull();
  });

  it('TC_TV305_START_02: renders dynamic server metadata without Cambridge/IELTS hardcoding', async () => {
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);

    renderWithRoute('/exams/42/start');

    await waitFor(() => {
      expect(screen.getByText(/DYNAMIC-CODE-101/)).toBeInTheDocument();
    });

    expect(screen.getByText('Dynamic Exam Title for Testing')).toBeInTheDocument();
    expect(screen.getByText('TOEFL_MOCK')).toBeInTheDocument();
    expect(screen.getByText(/90 phút/)).toBeInTheDocument();

    // Verify sections and parts count rendered in structure summary
    expect(screen.getByText(/2 kỹ năng/i)).toBeInTheDocument();
    expect(screen.getByText(/3 part/i)).toBeInTheDocument();

    // Verify absence of hardcoded text
    expect(screen.queryByText(/IELTS-CAM19-01/i)).toBeNull();
    expect(screen.queryByText(/Cambridge 19/i)).toBeNull();
    expect(screen.queryByText(/40 câu hỏi/i)).toBeNull();
    expect(screen.queryByText(/Thí sinh/i)).toBeNull();
  });

  it('works identically on /student/exam/:examId route', async () => {
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);

    renderWithRoute('/student/exam/42');

    await waitFor(() => {
      expect(screen.getByText('Dynamic Exam Title for Testing')).toBeInTheDocument();
    });
    expect(mockGetExamStructure).toHaveBeenCalledWith(42);
  });

  it('TC_TV305_START_03: invalid route IDs do not trigger API requests and display alert', () => {
    const invalidIds = ['abc', '1abc', '0', '-1', '1.5', '2147483648', '999999999999999999999', '1e3', '0x10', '+1'];

    for (const invalidId of invalidIds) {
      mockGetExamStructure.mockClear();
      const { unmount } = renderWithRoute(`/exams/${invalidId}/start`);

      expect(mockGetExamStructure).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/ID không hợp lệ/i)).toBeInTheDocument();
      unmount();
    }
  });

  it('TC_TV305_START_04: fetch error renders alert and retry button can reload', async () => {
    mockGetExamStructure.mockRejectedValueOnce(new Error('Exam not found on server'));

    renderWithRoute('/exams/42/start');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Exam not found on server/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Thiết lập phiên thi' })).toBeNull();

    // Click retry with success
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));

    await waitFor(() => {
      expect(screen.getByText('Dynamic Exam Title for Testing')).toBeInTheDocument();
    });
    expect(mockGetExamStructure).toHaveBeenCalledTimes(2);
  });

  it('prevents retry race conditions from overwriting a newer route request via navigation', async () => {
    let reject42: any;
    let resolveRetry42: any;
    let resolve43: any;
    let callCount = 0;

    mockGetExamStructure.mockImplementation((id: number) => {
      if (id === 42) {
        callCount++;
        if (callCount === 1) return new Promise((_, rej) => { reject42 = rej; });
        return new Promise((r) => { resolveRetry42 = r; });
      }
      if (id === 43) {
        return new Promise((r) => { resolve43 = r; });
      }
      return Promise.reject(new Error('not found'));
    });

    render(
      <MemoryRouter initialEntries={['/exams/42/start']}>
        <Routes>
          <Route path="/exams/:examId/start" element={
            <>
              <Link to="/exams/43/start" data-testid="nav-link">Go to 43</Link>
              <ExamStartPage />
            </>
          } />
        </Routes>
      </MemoryRouter>
    );

    reject42(new Error('fail'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));

    // Navigate to 43 without unmounting
    fireEvent.click(screen.getByTestId('nav-link'));

    resolve43({ ...sampleStructure, id: 43, title: 'Exam 43 Title' });
    await waitFor(() => {
      expect(screen.getByText('Exam 43 Title')).toBeInTheDocument();
    });

    resolveRetry42({ ...sampleStructure, id: 42, title: 'Exam 42 Title' });

    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText('Exam 42 Title')).toBeNull();
  });

  it('TC_TV305_START_05: empty sections exam shows empty state and cannot start', async () => {
    const emptyStructure: LearnerExamStructure = {
      ...sampleStructure,
      sections: [],
    };
    mockGetExamStructure.mockResolvedValueOnce(emptyStructure);

    renderWithRoute('/exams/42/start');

    await waitFor(() => {
      expect(screen.getByText('Dynamic Exam Title for Testing')).toBeInTheDocument();
    });

    expect(screen.getByText(/chưa có phần thi nào/i)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Thiết lập phiên thi' })).toBeNull();
  });

  it('TC_TV305_START_06: retains form on createAttempt error and does not navigate', async () => {
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);
    mockCreateAttempt.mockRejectedValueOnce(new Error('User has active attempt'));

    renderWithRoute('/exams/42/start');

    await waitFor(() => {
      expect(screen.getByRole('form', { name: 'Thiết lập phiên thi' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Toàn bộ đề'));
    fireEvent.click(screen.getByText('Practice'));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));

    await waitFor(() => {
      expect(screen.getByText(/User has active attempt/i)).toBeInTheDocument();
    });

    // Still on the start page, not navigated
    expect(screen.queryByTestId('workspace-target')).toBeNull();
    // Form is still visible
    expect(screen.getByRole('form', { name: 'Thiết lập phiên thi' })).toBeInTheDocument();
  });

  it('navigates to /attempts/:attemptId on successful createAttempt', async () => {
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);
    mockCreateAttempt.mockResolvedValueOnce({ attempt_id: 108 });

    renderWithRoute('/exams/42/start');

    await waitFor(() => {
      expect(screen.getByRole('form', { name: 'Thiết lập phiên thi' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Toàn bộ đề'));
    fireEvent.click(screen.getByText('Mock Test'));
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));

    await waitFor(() => {
      expect(screen.getByTestId('workspace-target')).toBeInTheDocument();
    });
  });

  it('TC_TV305_START_07: ignores invalid query params and validates enums', async () => {
    mockGetExamStructure.mockResolvedValueOnce(sampleStructure);

    renderWithRoute('/exams/42/start?mode=HACKED_MODE&scope=HACKED_SCOPE');

    await waitFor(() => {
      expect(screen.getByRole('form', { name: 'Thiết lập phiên thi' })).toBeInTheDocument();
    });

    // Start button should be disabled because mode and scope are undefined (not preselected)
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });
});
