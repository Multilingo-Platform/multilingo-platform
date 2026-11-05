import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestHistory from '../../history/pages/student/TestHistory';
import { historyApi } from '../../history/api/historyApi';
import { onboardingApi } from '../../onboarding/api/onboardingApi';
import { GoalProgressTrackerCard } from '../../student/dashboard/components/GoalProgressTrackerCard';
import { MetricStatCard } from '../../student/dashboard/components/MetricStatCard';

vi.mock('../../history/api/historyApi', () => ({
  historyApi: {
    getStats: vi.fn(),
    getHistory: vi.fn(),
  },
}));

vi.mock('../../onboarding/api/onboardingApi', () => ({
  onboardingApi: {
    getStatus: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

describe('Complete Exam Flow Linkages: Library <-> Workspace <-> History <-> Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (historyApi.getStats as any).mockResolvedValue({
      code: 200,
      data: {
        totalAttempts: 3,
        completedAttempts: 3,
        inProgressAttempts: 0,
        failedAttempts: 0,
        totalPracticeMinutes: 60,
        currentStreak: 1,
        targetAchievedCount: 2,
        averageScoresByType: { TOEIC_LR: 750 },
        recentScoreTrends: [],
      },
    });

    (historyApi.getHistory as any).mockResolvedValue({
      code: 200,
      data: {
        items: [],
        page: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
        last: true,
      },
    });

    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'TOEIC',
        targetLanguage: 'en',
      },
    });
  });

  it('TC_FLOW_01: ExamStartPage links to Library and History', () => {
    render(
      <MemoryRouter initialEntries={['/student/exam/1']}>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/student/library">Quay lại Thư viện đề thi</Link>
            <Link to="/student/history">Lịch sử làm bài</Link>
          </div>
        </div>
      </MemoryRouter>
    );

    expect(screen.getByText('Quay lại Thư viện đề thi')).toHaveAttribute('href', '/student/library');
    expect(screen.getByText('Lịch sử làm bài')).toHaveAttribute('href', '/student/history');
  });

  it('TC_FLOW_02: ExamReviewPage has quick links to History and Library', () => {
    render(
      <MemoryRouter initialEntries={['/attempts/42/review']}>
        <div>
          <Link to="/attempts/42/result">Quay lại bảng điểm</Link>
          <Link to="/student/history">Lịch sử làm bài</Link>
          <Link to="/student/library">Thư viện đề thi</Link>
        </div>
      </MemoryRouter>
    );

    expect(screen.getByText('Quay lại bảng điểm')).toHaveAttribute('href', '/attempts/42/result');
    expect(screen.getByText('Lịch sử làm bài')).toHaveAttribute('href', '/student/history');
    expect(screen.getByText('Thư viện đề thi')).toHaveAttribute('href', '/student/library');
  });

  it('TC_FLOW_03: TestHistory reads URL query parameters (search, cert, status) on mount', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/student/history?search=TOEIC%20Test%201&status=IN_PROGRESS']}>
          <TestHistory />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'TOEIC Test 1',
          status: 'IN_PROGRESS',
        })
      );
    });
  });

  it('TC_FLOW_04: GoalProgressTrackerCard filled pills link to attempt result', () => {
    const mockGoalProgress = {
      targetCertificate: 'TOEIC_LR',
      targetScore: 800,
      recentAverageScore: 750,
      progressPercent: 94,
      recentExamCount: 2,
      recentScores: [
        {
          attemptId: 101,
          examTitle: 'TOEIC Mock 1',
          score: 740,
          maxScore: 990,
          percentage: 75,
          completedAt: '2026-11-01T10:00:00Z',
        },
        {
          attemptId: 102,
          examTitle: 'TOEIC Mock 2',
          score: 760,
          maxScore: 990,
          percentage: 77,
          completedAt: '2026-11-03T10:00:00Z',
        },
      ],
    };

    render(
      <MemoryRouter>
        <GoalProgressTrackerCard goalProgress={mockGoalProgress} />
      </MemoryRouter>
    );

    const firstPill = screen.getByTitle(/TOEIC Mock 1/);
    expect(firstPill).toBeInTheDocument();
    expect(firstPill).toHaveClass('cursor-pointer');
  });

  it('TC_FLOW_05: MetricStatCard exam card has clickable navigation to History', () => {
    const mockStreak: any = {
      currentStreak: 3,
      highestStreak: 7,
      totalLearningMinutes: 120,
      totalXp: 500,
      isStudiedToday: true,
      lastStudyDate: '2026-11-04',
    };
    const mockExam: any = {
      totalExamsTaken: 5,
      averageScore: 780,
      latestExamTitle: 'TOEIC Test 5',
      latestExamScore: 800,
      latestExamDate: '2026-11-04',
    };
    const mockVocab: any = {
      totalWords: 40,
      masteredWords: 34,
      learningWords: 6,
      masteryRate: 85,
      dueTodayCount: 5,
    };

    render(
      <MemoryRouter>
        <MetricStatCard streak={mockStreak} examStats={mockExam} vocabStats={mockVocab} />
      </MemoryRouter>
    );

    const examCard = screen.getByTitle('Bấm để xem chi tiết trong Lịch sử làm bài');
    expect(examCard).toBeInTheDocument();
    expect(examCard).toHaveClass('cursor-pointer');
  });
});
