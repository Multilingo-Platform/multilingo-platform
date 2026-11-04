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
    expect(screen.getByText('6.5 raw')).toBeInTheDocument();
  });

  it('formats average score appropriately according to active certificate', () => {
    const mockStats: HistoryStatsResponse = {
      totalAttempts: 10,
      completedAttempts: 10,
      inProgressAttempts: 0,
      averageScore: 7.2,
      highestScore: 8.5,
      totalPracticeMinutes: 120,
      currentStreak: 2,
      targetAchievedCount: 4,
      recentScoreTrends: [],
      averageScoresByType: {
        IELTS: 7.2,
        TOEIC: 750.0,
      },
    };

    const { rerender } = render(<HistoryKpiCards stats={mockStats} loading={false} activeCert="IELTS" />);
    expect(screen.getByText('Band 7.2')).toBeInTheDocument();
    expect(screen.getByText(/Thang 9.0/)).toBeInTheDocument();

    rerender(<HistoryKpiCards stats={mockStats} loading={false} activeCert="TOEIC" />);
    expect(screen.getByText('750 đ')).toBeInTheDocument();
    expect(screen.getByText(/Thang 990/)).toBeInTheDocument();
  });

  it('formats TOEIC_LR (990) and TOEIC_WRITING (200) separately with correct scales', () => {
    const mockStats: HistoryStatsResponse = {
      totalAttempts: 4,
      completedAttempts: 4,
      inProgressAttempts: 0,
      averageScore: null,
      highestScore: null,
      totalPracticeMinutes: 80,
      currentStreak: 1,
      targetAchievedCount: 1,
      recentScoreTrends: [],
      averageScoresByType: {
        TOEIC_LR: 820.0,
        TOEIC_WRITING: 165.0,
      },
    };

    const { rerender } = render(<HistoryKpiCards stats={mockStats} loading={false} activeCert="TOEIC_LR" />);
    expect(screen.getByText('820 đ')).toBeInTheDocument();
    expect(screen.getByText(/Thang 990/)).toBeInTheDocument();

    rerender(<HistoryKpiCards stats={mockStats} loading={false} activeCert="TOEIC_WRITING" />);
    expect(screen.getByText('165 / 200')).toBeInTheDocument();
    expect(screen.getByText(/Thang 200/)).toBeInTheDocument();

    rerender(<HistoryKpiCards stats={mockStats} loading={false} activeCert="ALL" />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('TOEIC L&R: 820đ • TOEIC Writing: 165/200')).toBeInTheDocument();
  });

  it('displays breakdown subtext when ALL is selected and multiple exam types exist', () => {
    const mockStats: HistoryStatsResponse = {
      totalAttempts: 12,
      completedAttempts: 12,
      inProgressAttempts: 0,
      averageScore: 7.2,
      highestScore: 8.5,
      totalPracticeMinutes: 150,
      currentStreak: 4,
      targetAchievedCount: 5,
      recentScoreTrends: [],
      averageScoresByType: {
        IELTS: 7.2,
        TOEIC: 750.0,
      },
    };

    render(<HistoryKpiCards stats={mockStats} loading={false} activeCert="ALL" />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('IELTS: Band 7.2 • TOEIC: 750đ')).toBeInTheDocument();
  });

  it('does not fall back to an average from another certificate scale', () => {
    const stats: HistoryStatsResponse = {
      totalAttempts: 2, completedAttempts: 2, inProgressAttempts: 0,
      averageScore: 800, highestScore: 850, totalPracticeMinutes: 30, currentStreak: 0,
      targetAchievedCount: 0, recentScoreTrends: [], averageScoresByType: { TOEIC: 800 },
    };
    render(<HistoryKpiCards stats={stats} loading={false} activeCert="IELTS" />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/chưa có điểm theo thang chứng chỉ này/i)).toBeInTheDocument();
  });

  it('renders fallback when stats is null', () => {
    render(<HistoryKpiCards stats={null} loading={false} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lượt thi')).toBeInTheDocument();
    expect(screen.getByText('0 phút')).toBeInTheDocument();
    expect(screen.getByText('0 ngày')).toBeInTheDocument();
  });
});
