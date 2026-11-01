import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScoreTrendChart } from '../ScoreTrendChart';
import type { ScoreTrendItem } from '../../types/history.types';

describe('ScoreTrendChart', () => {
  const sampleTrends: ScoreTrendItem[] = [
    {
      attemptId: 1,
      examTitle: 'IELTS Test 1',
      certType: 'IELTS',
      score: 6.5,
      maxScore: 9.0,
      percentage: 72.2,
      completedAt: '2026-10-20T10:00:00Z',
    },
    {
      attemptId: 2,
      examTitle: 'IELTS Test 2',
      certType: 'IELTS',
      score: 7.5,
      maxScore: 9.0,
      percentage: 83.3,
      completedAt: '2026-10-22T10:00:00Z',
    },
    {
      attemptId: 3,
      examTitle: 'TOEIC ETS 2024 Test 1',
      certType: 'TOEIC',
      score: 750,
      maxScore: 990,
      percentage: 75.8,
      completedAt: '2026-10-24T10:00:00Z',
    },
  ];

  it('renders empty message when no trends are provided', () => {
    render(<ScoreTrendChart trends={[]} loading={false} />);
    expect(screen.getByText('Chưa có dữ liệu tiến độ điểm số')).toBeInTheDocument();
  });

  it('renders filter chips when multiple exam types exist in trends', () => {
    render(<ScoreTrendChart trends={sampleTrends} loading={false} />);

    expect(screen.getByText('Tiến Độ Điểm Số Gần Đây')).toBeInTheDocument();
    // Filter chips for ALL, IELTS, and TOEIC
    expect(screen.getByText('Tất cả (3)')).toBeInTheDocument();
    expect(screen.getByText('IELTS (2)')).toBeInTheDocument();
    expect(screen.getByText('TOEIC (1)')).toBeInTheDocument();
    expect(screen.getByText('3 lần làm bài gần nhất')).toBeInTheDocument();
  });

  it('filters trends dynamically when user clicks a specific cert chip', () => {
    render(<ScoreTrendChart trends={sampleTrends} loading={false} />);

    const toeicChip = screen.getByText('TOEIC (1)');
    fireEvent.click(toeicChip);

    // Subtitle updates to 1 attempt
    expect(screen.getByText('1 lần làm bài gần nhất')).toBeInTheDocument();
  });

  it('hides filter chips when only one exam type exists in trends', () => {
    const singleTypeTrends: ScoreTrendItem[] = [
      {
        attemptId: 1,
        examTitle: 'IELTS Test 1',
        certType: 'IELTS',
        score: 6.5,
        maxScore: 9.0,
        percentage: 72.2,
        completedAt: '2026-10-20T10:00:00Z',
      },
    ];

    render(<ScoreTrendChart trends={singleTypeTrends} loading={false} />);

    expect(screen.queryByText(/Tất cả \(/)).not.toBeInTheDocument();
    expect(screen.getByText('1 lần làm bài gần nhất')).toBeInTheDocument();
  });
});
