import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GoalProgressTrackerCard } from '../GoalProgressTrackerCard';
import type { GoalProgress } from '../../types/dashboard.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('GoalProgressTrackerCard', () => {
  it('renders nothing if goalProgress is null or undefined', () => {
    const { container } = render(
      <MemoryRouter>
        <GoalProgressTrackerCard goalProgress={null} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders target certificate, score, average and progress percent', () => {
    const goal: GoalProgress = {
      targetCertificate: 'IELTS_ACADEMIC',
      targetScore: 7.0,
      recentAverageScore: 6.5,
      progressPercent: 93,
      recentExamCount: 5,
      recentScores: [
        { attemptId: 1, examTitle: 'Test 1', score: 6.0, maxScore: 9.0, percentage: 66.7, completedAt: null },
        { attemptId: 2, examTitle: 'Test 2', score: 6.5, maxScore: 9.0, percentage: 72.2, completedAt: null },
        { attemptId: 3, examTitle: 'Test 3', score: 6.5, maxScore: 9.0, percentage: 72.2, completedAt: null },
        { attemptId: 4, examTitle: 'Test 4', score: 7.0, maxScore: 9.0, percentage: 77.8, completedAt: null },
        { attemptId: 5, examTitle: 'Test 5', score: 6.5, maxScore: 9.0, percentage: 72.2, completedAt: null },
      ],
    };

    render(
      <MemoryRouter>
        <GoalProgressTrackerCard goalProgress={goal} />
      </MemoryRouter>
    );

    expect(screen.getByText('IELTS Academic')).toBeInTheDocument();
    expect(screen.getAllByText(/Band 7.0/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Band 6.5/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('93%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('(5/5 bài)')).toBeInTheDocument();
    expect(screen.getByText('Bài 1')).toBeInTheDocument();
    expect(screen.getByText('Bài 5')).toBeInTheDocument();
  });

  it('renders correctly when user has not completed any exams', () => {
    const goal: GoalProgress = {
      targetCertificate: 'TOEIC_LR',
      targetScore: 850,
      recentAverageScore: null,
      progressPercent: 0,
      recentExamCount: 0,
      recentScores: [],
    };

    render(
      <MemoryRouter>
        <GoalProgressTrackerCard goalProgress={goal} />
      </MemoryRouter>
    );

    expect(screen.getByText('TOEIC Listening & Reading')).toBeInTheDocument();
    expect(screen.getByText(/850 Điểm/i)).toBeInTheDocument();
    expect(screen.getByText(/Bạn chưa có bài thi nào hoàn thành/i)).toBeInTheDocument();
  });
});
