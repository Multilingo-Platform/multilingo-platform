import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import ExamLibrary, { getExamScope } from '../pages/student/ExamLibrary';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../onboarding/api/onboardingApi', () => ({
  onboardingApi: {
    getStatus: vi.fn().mockResolvedValue({
      code: 200,
      data: { hasCompletedOnboarding: false, targetCertificate: null, targetLanguage: null }
    }),
  }
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('Exam Library Scope Filter', () => {
  describe('getExamScope classification utility', () => {
    describe('FULL_EXAM classification', () => {
      it('classifies full IELTS tests as FULL_EXAM', () => {
        expect(getExamScope('IELTS_ACADEMIC')).toBe('FULL_EXAM');
        expect(getExamScope('IELTS_GENERAL')).toBe('FULL_EXAM');
        expect(getExamScope('IELTS')).toBe('FULL_EXAM');
      });

      it('classifies full TOEIC L&R tests as FULL_EXAM', () => {
        expect(getExamScope('TOEIC_LR')).toBe('FULL_EXAM');
        expect(getExamScope('TOEIC')).toBe('FULL_EXAM');
        expect(getExamScope('TOEIC_LISTENING_READING')).toBe('FULL_EXAM');
      });

      it('classifies full 9-part NLTV tests as FULL_EXAM', () => {
        expect(getExamScope('NLTV', 'Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu', 9)).toBe('FULL_EXAM');
        expect(getExamScope('NLTV_B1_C1')).toBe('FULL_EXAM');
        expect(getExamScope('NLTV_A1_A2')).toBe('FULL_EXAM');
      });
    });

    describe('SINGLE_SKILL classification', () => {
      it('classifies single skill IELTS exams as SINGLE_SKILL', () => {
        expect(getExamScope('IELTS_LISTENING')).toBe('SINGLE_SKILL');
        expect(getExamScope('IELTS_READING')).toBe('SINGLE_SKILL');
        expect(getExamScope('IELTS_WRITING')).toBe('SINGLE_SKILL');
      });

      it('classifies single skill TOEIC exams as SINGLE_SKILL', () => {
        expect(getExamScope('TOEIC_LISTENING')).toBe('SINGLE_SKILL');
        expect(getExamScope('TOEIC_READING')).toBe('SINGLE_SKILL');
        expect(getExamScope('TOEIC_WRITING')).toBe('SINGLE_SKILL');
        expect(getExamScope('TW')).toBe('SINGLE_SKILL');
        expect(getExamScope('TOEIC_W')).toBe('SINGLE_SKILL');
      });

      it('classifies single skill NLTV exams as SINGLE_SKILL', () => {
        expect(getExamScope('NLTV_READING')).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV_LISTENING')).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV_WRITING')).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV_R')).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV_L')).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV_W')).toBe('SINGLE_SKILL');
        // Legacy exam stored as type="NLTV" but with 2 parts and reading title
        expect(getExamScope('NLTV', 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Đọc', 2)).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV', 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Nghe', 4)).toBe('SINGLE_SKILL');
        expect(getExamScope('NLTV', 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Viết', 3)).toBe('SINGLE_SKILL');
      });
    });

    describe('SINGLE_PART classification', () => {
      it('classifies single part IELTS exams as SINGLE_PART', () => {
        expect(getExamScope('IELTS_R1')).toBe('SINGLE_PART');
        expect(getExamScope('IELTS_R2')).toBe('SINGLE_PART');
        expect(getExamScope('IELTS_R3')).toBe('SINGLE_PART');
        expect(getExamScope('IELTS_L1')).toBe('SINGLE_PART');
        expect(getExamScope('IELTS_W1')).toBe('SINGLE_PART');
      });

      it('classifies single part TOEIC exams as SINGLE_PART', () => {
        expect(getExamScope('TOEIC_P1')).toBe('SINGLE_PART');
        expect(getExamScope('TOEIC_P5')).toBe('SINGLE_PART');
        expect(getExamScope('TW_P1')).toBe('SINGLE_PART');
        expect(getExamScope('TW_P2')).toBe('SINGLE_PART');
      });

      it('classifies single part NLTV exams as SINGLE_PART', () => {
        expect(getExamScope('NLTV_L1')).toBe('SINGLE_PART');
        expect(getExamScope('NLTV_R1')).toBe('SINGLE_PART');
        expect(getExamScope('NLTV_W1')).toBe('SINGLE_PART');
      });
    });
  });

  describe('UI Integration & Filtering', () => {
    const mockExams = [
      { id: 1, type: 'IELTS_ACADEMIC', title: 'Cambridge IELTS 18 Test 1', level: 'Academic', tags: ['Reading', 'Listening'], durationMinutes: 120, joins: 50 },
      { id: 2, type: 'IELTS_READING', title: 'IELTS Academic Reading Test 1', level: 'Academic', tags: ['Reading'], durationMinutes: 60, joins: 30 },
      { id: 3, type: 'IELTS_R1', title: 'Cambridge IELTS 18 Reading Passage 1', level: 'Academic', tags: ['Reading'], durationMinutes: 20, joins: 15 },
      { id: 4, type: 'TOEIC_LR', title: 'ETS TOEIC 2024 Test 1', level: 'General', tags: ['Listening', 'Reading'], durationMinutes: 120, joins: 40 },
      { id: 5, type: 'TOEIC_WRITING', title: 'TOEIC Writing Practice 1', level: 'General', tags: ['Writing'], durationMinutes: 60, joins: 20 },
      { id: 6, type: 'TOEIC_P5', title: 'TOEIC Part 5 Mini Test', level: 'General', tags: ['Reading'], durationMinutes: 15, joins: 10 },
      { id: 7, type: 'NLTV', title: 'Đề thi ĐGNL Tiếng Việt (NLTV) Mẫu', level: 'Đa bậc', tags: ['Đọc hiểu', 'Nghe hiểu', 'Viết'], durationMinutes: 180, joins: 12 },
      { id: 8, type: 'NLTV', title: 'Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Đọc', level: 'Đa bậc', tags: ['Đọc hiểu'], durationMinutes: 60, joins: 8 },
      { id: 9, type: 'NLTV_R1', title: 'NLTV Đọc - Phần 1', level: 'Đa bậc', tags: ['Đọc hiểu'], durationMinutes: 20, joins: 5 },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(axiosClient.get).mockResolvedValue({
        success: true,
        data: {
          items: mockExams,
          totalPages: 1,
          totalElements: mockExams.length,
        },
      } as any);
    });

    it('renders the Scope Filter row with all 4 chip options (TC_EXAM_SCOPE_01)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      expect(screen.getByText('Hình thức:')).toBeInTheDocument();
      expect(screen.getByText('Tất cả hình thức')).toBeInTheDocument();
      expect(screen.getByText('Làm Full đề')).toBeInTheDocument();
      expect(screen.getByText('1 Kỹ năng')).toBeInTheDocument();
      expect(screen.getByText('1 Phần (Part / Passage)')).toBeInTheDocument();
    });

    it('filters strictly by Full Exam when "Làm Full đề" chip is selected (TC_EXAM_SCOPE_02)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      fireEvent.click(screen.getByText('Làm Full đề'));

      // Full exams should be visible
      expect(screen.getByText('Cambridge IELTS 18 Test 1')).toBeInTheDocument();
      expect(screen.getByText('ETS TOEIC 2024 Test 1')).toBeInTheDocument();
      expect(screen.getByText('Đề thi ĐGNL Tiếng Việt (NLTV) Mẫu')).toBeInTheDocument();

      // Single skill and single part exams must be hidden
      expect(screen.queryByText('IELTS Academic Reading Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Cambridge IELTS 18 Reading Passage 1')).not.toBeInTheDocument();
      expect(screen.queryByText('TOEIC Writing Practice 1')).not.toBeInTheDocument();
      expect(screen.queryByText('TOEIC Part 5 Mini Test')).not.toBeInTheDocument();
      expect(screen.queryByText('Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Đọc')).not.toBeInTheDocument();
      expect(screen.queryByText('NLTV Đọc - Phần 1')).not.toBeInTheDocument();
    });

    it('filters strictly by Single Skill when "1 Kỹ năng" chip is selected (TC_EXAM_SCOPE_03 & TC_EXAM_SCOPE_07)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      fireEvent.click(screen.getByText('1 Kỹ năng'));

      // Single skill exams should be visible (including legacy NLTV skill exam)
      expect(screen.getByText('IELTS Academic Reading Test 1')).toBeInTheDocument();
      expect(screen.getByText('TOEIC Writing Practice 1')).toBeInTheDocument();
      expect(screen.getByText('Đề thi ĐGNL Tiếng Việt (NLTV) - Kỹ năng Đọc')).toBeInTheDocument();

      // Full exams and single part exams must be hidden
      expect(screen.queryByText('Cambridge IELTS 18 Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('ETS TOEIC 2024 Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Cambridge IELTS 18 Reading Passage 1')).not.toBeInTheDocument();
      expect(screen.queryByText('TOEIC Part 5 Mini Test')).not.toBeInTheDocument();
    });

    it('filters strictly by Single Part when "1 Phần (Part / Passage)" chip is selected (TC_EXAM_SCOPE_04)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      fireEvent.click(screen.getByText('1 Phần (Part / Passage)'));

      // Single part exams should be visible
      expect(screen.getByText('Cambridge IELTS 18 Reading Passage 1')).toBeInTheDocument();
      expect(screen.getByText('TOEIC Part 5 Mini Test')).toBeInTheDocument();
      expect(screen.getByText('NLTV Đọc - Phần 1')).toBeInTheDocument();

      // Full exams and skill exams must be hidden
      expect(screen.queryByText('Cambridge IELTS 18 Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('IELTS Academic Reading Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('ETS TOEIC 2024 Test 1')).not.toBeInTheDocument();
    });

    it('combines Scope filter with Skill filter smoothly (TC_EXAM_SCOPE_05)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      // Select 1 Phần
      fireEvent.click(screen.getByText('1 Phần (Part / Passage)'));
      // Select Đọc hiểu
      fireEvent.click(screen.getByRole('button', { name: /đọc hiểu/i }));

      // Reading parts should be visible
      await waitFor(() => {
        expect(screen.getByText('Cambridge IELTS 18 Reading Passage 1')).toBeInTheDocument();
      });
      expect(screen.getByText('TOEIC Part 5 Mini Test')).toBeInTheDocument();
      expect(screen.getByText('NLTV Đọc - Phần 1')).toBeInTheDocument();

      // Full reading exams or writing exams should not be visible
      expect(screen.queryByText('Cambridge IELTS 18 Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('IELTS Academic Reading Test 1')).not.toBeInTheDocument();
      expect(screen.queryByText('TOEIC Writing Practice 1')).not.toBeInTheDocument();
    });

    it('resets the scope filter when "Xóa bộ lọc" is clicked (TC_EXAM_SCOPE_08)', async () => {
      renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);

      await screen.findByText('Cambridge IELTS 18 Test 1');

      // Select 1 Kỹ năng
      fireEvent.click(screen.getByText('1 Kỹ năng'));
      expect(screen.queryByText('Cambridge IELTS 18 Test 1')).not.toBeInTheDocument();

      // Click "Xóa bộ lọc"
      const clearBtn = screen.getByRole('button', { name: /xóa bộ lọc/i });
      fireEvent.click(clearBtn);

      // All exams should be visible again
      await waitFor(() => {
        expect(screen.getByText('Cambridge IELTS 18 Test 1')).toBeInTheDocument();
      });
      expect(screen.getByText('IELTS Academic Reading Test 1')).toBeInTheDocument();
      expect(screen.getByText('Cambridge IELTS 18 Reading Passage 1')).toBeInTheDocument();
    });
  });
});
