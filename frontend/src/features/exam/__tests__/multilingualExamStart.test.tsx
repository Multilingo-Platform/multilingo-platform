import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamStartPage from '../pages/ExamStartPage';
import { createAttempt } from '../api/attemptApi';
import { getExamStructure } from '../api/examApi';

vi.mock('../api/attemptApi', () => ({ createAttempt: vi.fn() }));
vi.mock('../api/examApi', () => ({ getExamStructure: vi.fn() }));

describe('multilingual language-practice start page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getExamStructure).mockResolvedValue({
      id: 31, code: 'LANG-JA-1', title: '日本語 読解', type: 'LANGUAGE_PRACTICE',
      examLanguage: 'ja-JP', durationMinutes: 30,
      sections: [{ id: 301, skillType: 'READING', title: '読解', durationMinutes: 30, orderIndex: 1,
        parts: [{ id: 3011, partNumber: 1, title: '文章を読む' }] }],
    });
  });

  it('shows the snapshot language and uses backend-provided sections without inventing certificate parts', async () => {
    render(<MemoryRouter initialEntries={['/student/exam/31']}>
      <Routes><Route path="/student/exam/:examId" element={<ExamStartPage />} /></Routes>
    </MemoryRouter>);
    expect(await screen.findByText('Ngôn ngữ: ja-JP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /một phần/i }));
    fireEvent.click(screen.getByRole('button', { name: '読解' }));
    expect(screen.getByText('文章を読む')).toBeInTheDocument();
    expect(screen.queryByText(/IELTS|TOEIC|NLTV_P/i)).not.toBeInTheDocument();
  });
});
