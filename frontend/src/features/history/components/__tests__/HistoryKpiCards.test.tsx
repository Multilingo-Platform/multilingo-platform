import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HistoryKpiCards } from '../HistoryKpiCards';
import type { HistoryStatsResponse } from '../../types/history.types';

describe('HistoryKpiCards', () => {
  it('renders correctly with complete attempt status breakdown matching total attempts', () => {
    const mockStats: HistoryStatsResponse = {
      totalAttempts: 14,
      completedAttempts: 4,
      inProgressAttempts: 7,
      failedAttempts: 3,
      averageScore: 6.5,
      highestScore: 8.0,
      totalPracticeMinutes: 185,
      currentStreak: 3,
      targetAchievedCount: 2,
      recentScoreTrends: [],
    };

    render(<HistoryKpiCards stats={mockStats} loading={false} />);

    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('4 hoàn thành • 7 dở dang • 3 lỗi chấm')).toBeInTheDocument();
    expect(screen.getByText('3h 5m')).toBeInTheDocument();
    expect(screen.getByText('3 ngày')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
  });

  it('renders fallback when stats is null', () => {
    render(<HistoryKpiCards stats={null} loading={false} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lượt thi')).toBeInTheDocument();
    expect(screen.getByText('0 phút')).toBeInTheDocument();
    expect(screen.getByText('0 ngày')).toBeInTheDocument();
  });
});
