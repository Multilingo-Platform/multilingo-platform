import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../../../api/adminApi';
import TrackingAnalyticsPage from '../TrackingAnalyticsPage';

vi.mock('../../../api/adminApi', () => ({
  adminApi: {
    getUserTracking: vi.fn(),
    getExamTracking: vi.fn(),
    getUserExamTrackingDetail: vi.fn(),
    getExamTrackingDetail: vi.fn(),
  },
}));

const mockedAdminApi = vi.mocked(adminApi);

describe('TrackingAnalyticsPage - User & Exam Detail Drawers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student list and opens UserExamTrackingDrawer when a student row is clicked', async () => {
    mockedAdminApi.getUserTracking.mockResolvedValue({
      items: [
        {
          userId: 9,
          fullName: 'Khanh Son Nguyen',
          email: 'nkhanhson25112005@gmail.com',
          subscriptionTier: 'VIP',
          totalAttempts: 23,
          averageScore: 6.6,
          totalLearningMinutes: 2504,
          lastLoginIp: '183.81.122.13',
          lastLoginAt: '2026-11-05T15:47:00Z',
        },
      ],
      page: 0,
      size: 10,
      totalElements: 1,
      totalPages: 1,
      last: true,
    } as never);

    mockedAdminApi.getUserExamTrackingDetail.mockResolvedValue({
      userId: 9,
      fullName: 'Khanh Son Nguyen',
      email: 'nkhanhson25112005@gmail.com',
      subscriptionTier: 'VIP',
      totalExamsAttempted: 23,
      averageScore: 6.6,
      examSummaries: [
        {
          examId: 101,
          examCode: 'TOEIC-ETS-2024-T1-V2',
          examTitle: 'ETS 2024 Test 1',
          examType: 'TOEIC',
          attemptCount: 5,
          highestScore: 850,
          latestScore: 820,
          latestAttemptAt: '2026-11-05T15:00:00Z',
        },
      ],
      attempts: [
        {
          attemptId: 501,
          examId: 101,
          examCode: 'TOEIC-ETS-2024-T1-V2',
          examTitle: 'ETS 2024 Test 1',
          testMode: 'MOCK_TEST',
          status: 'COMPLETED',
          startTime: '2026-11-05T14:00:00Z',
          timeSpentSeconds: 3600,
          overallScore: 850,
          scoreUnit: 'Điểm',
        },
      ],
    } as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TrackingAnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify student is shown in table
    expect(await screen.findByText('Khanh Son Nguyen')).toBeInTheDocument();
    expect(screen.getByText('23 bài thi')).toBeInTheDocument();

    // Click on student row to open drawer
    fireEvent.click(screen.getByText('Khanh Son Nguyen'));

    // Verify UserExamTrackingDrawer opens
    expect(await screen.findByText('Chi Tiết Tiến Trình & Lịch Sử Bài Làm')).toBeInTheDocument();
    expect(await screen.findByText('ETS 2024 Test 1')).toBeInTheDocument();
    expect(screen.getByText('5 lượt làm')).toBeInTheDocument();
    expect(screen.getByText('850 đ')).toBeInTheDocument();
  });

  it('switches to exam tab and opens ExamAttemptsTrackingDrawer when an exam row is clicked', async () => {
    mockedAdminApi.getExamTracking.mockResolvedValue([
      {
        examId: 202,
        code: 'NLTV-AEAF2E',
        title: 'Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu',
        totalAttempts: 4,
        completedAttempts: 1,
        completionRate: 25.0,
        averageScore: 5.5,
      },
    ] as never);

    mockedAdminApi.getExamTrackingDetail.mockResolvedValue({
      examId: 202,
      code: 'NLTV-AEAF2E',
      title: 'Đề thi Đánh giá Năng lực Tiếng Việt (NLTV) Mẫu',
      type: 'NLTV',
      durationMinutes: 90,
      totalAttempts: 4,
      completedAttempts: 1,
      completionRate: 25.0,
      averageScore: 5.5,
      attempts: [
        {
          attemptId: 601,
          userId: 9,
          fullName: 'Khanh Son Nguyen',
          email: 'nkhanhson25112005@gmail.com',
          subscriptionTier: 'VIP',
          attemptNumber: 1,
          testMode: 'MOCK_TEST',
          status: 'COMPLETED',
          startTime: '2026-11-05T12:00:00Z',
          timeSpentSeconds: 4500,
          overallScore: 5.5,
          scoreUnit: 'Điểm',
        },
      ],
    } as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TrackingAnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Switch to Exam tab
    const examTabBtn = screen.getByText('Hiệu Quả & Lượt Thi Theo Đề');
    fireEvent.click(examTabBtn);

    // Verify exam is displayed in table
    expect(await screen.findByText('NLTV-AEAF2E')).toBeInTheDocument();
    expect(screen.getByText('4 lượt')).toBeInTheDocument();

    // Click on exam row to open drawer
    fireEvent.click(screen.getByText('NLTV-AEAF2E'));

    // Verify ExamAttemptsTrackingDrawer opens
    expect(await screen.findByText('Lần 1')).toBeInTheDocument();
    expect(screen.getByText('Đã nộp bài')).toBeInTheDocument();
    expect(screen.getByText('5.5 Điểm')).toBeInTheDocument();
  });
});

