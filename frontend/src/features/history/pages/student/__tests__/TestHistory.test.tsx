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
    t: (key: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
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
});
