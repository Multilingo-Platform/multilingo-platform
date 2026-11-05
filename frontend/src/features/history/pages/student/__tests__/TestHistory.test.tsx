import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import TestHistory from '../TestHistory';
import { historyApi } from '../../../api/historyApi';
import { onboardingApi } from '../../../../onboarding/api/onboardingApi';

vi.mock('../../../api/historyApi', () => ({
  historyApi: {
    getStats: vi.fn(),
    getHistory: vi.fn(),
  },
}));

vi.mock('../../../../onboarding/api/onboardingApi', () => ({
  onboardingApi: {
    getStatus: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, optionsOrDefault?: any) => {
      if (typeof optionsOrDefault === 'string') return optionsOrDefault;
      if (optionsOrDefault && typeof optionsOrDefault.defaultValue === 'string') return optionsOrDefault.defaultValue;
      if (key === 'history.card.scale_toeic_skill') return 'TOEIC / 450';
      if (key === 'history.card.scale_toeic') return 'TOEIC / 990';
      if (key === 'history.card.scale_questions_with_max' && optionsOrDefault?.max) return `/ ${optionsOrDefault.max} câu`;
      return key;
    },
  }),
}));

describe('TestHistory Page - Certificate Filter Synchronization & Race-Condition Prevention', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    (historyApi.getStats as any).mockResolvedValue({
      code: 200,
      data: {
        totalAttempts: 5,
        completedAttempts: 5,
        inProgressAttempts: 0,
        failedAttempts: 0,
        totalPracticeMinutes: 100,
        currentStreak: 2,
        targetAchievedCount: 3,
        averageScoresByType: {
          TOEIC_LR: 800.0,
          TOEIC_WRITING: 160.0,
          IELTS: 7.0,
          NLTV: 8.5,
        },
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
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <TestHistory />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('TC_HIST_INIT_01: initializes with TOEIC target certificate and filters stats and history by targetCategory without race condition', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'TOEIC',
        targetLanguage: 'en',
      },
    });

    renderComponent();

    // Verify TOEIC L&R tab is rendered and active
    await waitFor(() => {
      const toeicTab = screen.getByRole('tab', { name: /TOEIC L&R/i });
      expect(toeicTab).toHaveClass('active');
    });

    // History and stats APIs should be called with cert: 'TOEIC_LR'
    await waitFor(() => {
      expect(historyApi.getStats).toHaveBeenCalledWith(
        expect.objectContaining({ cert: 'TOEIC_LR', targetLanguage: 'en' })
      );
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cert: 'TOEIC_LR', targetLanguage: 'en' })
      );
    });

    // It should NEVER have called historyApi.getHistory with cert: undefined
    const calls = (historyApi.getHistory as any).mock.calls;
    const unfilteredCalls = calls.filter((callArgs: any[]) => callArgs[0]?.cert === undefined);
    expect(unfilteredCalls.length).toBe(0);
  });

  it('TC_HIST_INIT_02: initializes with TOEIC_WRITING target and filters correctly', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'TOEIC_WRITING',
        targetLanguage: 'en',
      },
    });

    renderComponent();

    await waitFor(() => {
      const writingTab = screen.getByRole('tab', { name: /TOEIC Writing/i });
      expect(writingTab).toHaveClass('active');
    });

    await waitFor(() => {
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cert: 'TOEIC_WRITING' })
      );
    });
  });

  it('TC_HIST_INIT_03: initializes with NLTV target, shows Vietnamese tabs and filters by NLTV', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'NLTV',
        targetLanguage: 'vi',
      },
    });

    renderComponent();

    await waitFor(() => {
      const nltvTab = screen.getByRole('tab', { name: /NLTV/i });
      expect(nltvTab).toHaveClass('active');
    });

    await waitFor(() => {
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cert: 'NLTV', targetLanguage: 'vi' })
      );
    });
  });

  it('TC_HIST_INIT_04: defaults to ALL when user has no target certificate', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: null,
    });

    renderComponent();

    await waitFor(() => {
      const allTab = screen.getByRole('tab', { name: /Tất Cả Chứng Chỉ/i });
      expect(allTab).toHaveClass('active');
    });

    await waitFor(() => {
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cert: undefined })
      );
    });
  });

  it('TC_HIST_TAB_01: allows user to switch certificate tab and updates filters accordingly', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'TOEIC',
        targetLanguage: 'en',
      },
    });

    renderComponent();

    await waitFor(() => {
      const toeicTab = screen.getByRole('tab', { name: /TOEIC L&R/i });
      expect(toeicTab).toHaveClass('active');
    });

    // Switch to IELTS tab
    const ieltsTab = screen.getByRole('tab', { name: /IELTS/i });
    fireEvent.click(ieltsTab);

    await waitFor(() => {
      expect(ieltsTab).toHaveClass('active');
      expect(historyApi.getHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cert: 'IELTS' })
      );
    });
  });

  it('TC_HIST_SCORE_BADGE_01: renders clean score circle badges with concise scales for IELTS, TOEIC and NLTV', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'IELTS',
        targetLanguage: 'en',
      },
    });

    (historyApi.getHistory as any).mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            attemptId: 101,
            examId: 64,
            examCode: 'IELTS-ACB46F',
            examTitle: 'Cambridge Ielts 20 Test 2',
            examType: 'IELTS_ACADEMIC',
            examLanguage: 'en',
            scoreUnit: 'IELTS_BAND',
            overallScore: 7.5,
            maxScore: 9.0,
            testMode: 'MOCK_TEST',
            testScope: 'FULL_EXAM',
            status: 'COMPLETED',
            startedAt: '2026-11-05T07:09:18Z',
            completedAt: '2026-11-05T09:25:00Z',
            durationMinutes: 135,
            accuracyPercentage: 85.0,
            targetAchieved: true,
            passed: true,
          },
          {
            attemptId: 102,
            examId: 65,
            examCode: 'TOEIC-343ECA',
            examTitle: 'ETS 2024 Test 2',
            examType: 'TOEIC_LR',
            examLanguage: 'en',
            scoreUnit: 'TOEIC_SCALED',
            overallScore: 860,
            maxScore: 990,
            testMode: 'MOCK_TEST',
            testScope: 'FULL_EXAM',
            status: 'COMPLETED',
            startedAt: '2026-10-26T01:30:00Z',
            completedAt: '2026-10-26T03:28:00Z',
            durationMinutes: 118,
            accuracyPercentage: 86.5,
            targetAchieved: true,
            passed: true,
          },
          {
            attemptId: 103,
            examId: 51,
            examCode: 'NLTV-02E230',
            examTitle: 'ĐGNL Tiếng Việt - Đọc',
            examType: 'NLTV',
            examLanguage: 'vi',
            scoreUnit: 'RAW_OBJECTIVE',
            overallScore: 5.5,
            maxScore: 6.0,
            testMode: 'PRACTICE',
            testScope: 'SINGLE_SKILL',
            status: 'COMPLETED',
            startedAt: '2026-10-15T08:30:00Z',
            completedAt: '2026-10-15T09:20:00Z',
            durationMinutes: 50,
            accuracyPercentage: 91.6,
            targetAchieved: false,
            passed: true,
          },
        ],
        page: 0,
        size: 10,
        totalElements: 3,
        totalPages: 1,
        last: true,
      },
    });

    renderComponent();

    // Verify IELTS badge renders 7.5 and Band / 9.0
    await waitFor(() => {
      expect(screen.getByText('7.5')).toBeInTheDocument();
      expect(screen.getByText('Band / 9.0')).toBeInTheDocument();
    });

    // Verify TOEIC badge renders 860 with is-large class and TOEIC / 990
    expect(screen.getByText('860')).toBeInTheDocument();
    expect(screen.getByText('860')).toHaveClass('is-large');
    expect(screen.getByText('TOEIC / 990')).toBeInTheDocument();

    // Verify NLTV badge renders 5.5 and Bậc / 6
    expect(screen.getByText('5.5')).toBeInTheDocument();
    expect(screen.getByText('Bậc / 6')).toBeInTheDocument();
  });

  it('TC_HIST_SCORE_BADGE_02: TOEIC single skill renders TOEIC / 450 and part practice renders raw correct questions count', async () => {
    (onboardingApi.getStatus as any).mockResolvedValue({
      code: 200,
      data: {
        targetCertificate: 'ALL',
        targetLanguage: 'en',
      },
    });

    (historyApi.getHistory as any).mockResolvedValue({
      code: 200,
      data: {
        items: [
          {
            attemptId: 22,
            examId: 35,
            examCode: 'TOEIC-L01',
            examTitle: 'ETS 2024 Test 1 - Listening',
            examType: 'TOEIC_LISTENING',
            examLanguage: 'en',
            scoreUnit: 'TOEIC_SCALED',
            overallScore: 450,
            maxScore: 450.0,
            testMode: 'PRACTICE',
            testScope: 'SINGLE_SKILL',
            status: 'COMPLETED',
            startedAt: '2026-10-23T16:00:00Z',
            completedAt: '2026-10-23T16:44:00Z',
            durationMinutes: 44,
            accuracyPercentage: 100.0,
            targetAchieved: true,
            passed: true,
          },
          {
            attemptId: 34,
            examId: 41,
            examCode: 'TOEIC-P05',
            examTitle: 'ETS 2024 Test 1 Part 5',
            examType: 'TOEIC_READING',
            examLanguage: 'en',
            scoreUnit: 'RAW_OBJECTIVE',
            overallScore: 26,
            maxScore: 30.0,
            testMode: 'PRACTICE',
            testScope: 'SINGLE_PART',
            status: 'COMPLETED',
            startedAt: '2026-10-28T10:00:00Z',
            completedAt: '2026-10-28T10:20:00Z',
            durationMinutes: 20,
            accuracyPercentage: 86.7,
            targetAchieved: false,
            passed: true,
          },
        ],
        page: 0,
        size: 10,
        totalElements: 2,
        totalPages: 1,
        last: true,
      },
    });

    renderComponent();

    // Verify TOEIC Single Skill renders 450 with is-large class and TOEIC / 450
    await waitFor(() => {
      expect(screen.getByText('450')).toBeInTheDocument();
      expect(screen.getByText('450')).toHaveClass('is-large');
      expect(screen.getByText('TOEIC / 450')).toBeInTheDocument();
    });

    // Verify Part practice renders 26 and / 30 câu
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('/ 30 câu')).toBeInTheDocument();
  });
});
