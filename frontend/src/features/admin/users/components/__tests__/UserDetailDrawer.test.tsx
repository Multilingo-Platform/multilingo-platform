import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../../../api/adminApi';
import { UserDetailDrawer } from '../UserDetailDrawer';

vi.mock('../../../api/adminApi', () => ({
  adminApi: {
    getUserDetail: vi.fn(),
  },
}));

const mockedAdminApi = vi.mocked(adminApi);

const createMockUser = (totalLearningMinutes: number) => ({
  id: 2,
  email: 'giapit02012005@gmail.com',
  fullName: 'Nguyễn Hữu Giáp',
  role: 'STUDENT',
  subscriptionTier: 'FREE',
  isActive: true,
  createdAt: '2026-10-23T10:00:00Z',
  totalExamsAttempted: 1,
  averageExamScore: undefined,
  totalLearningMinutes,
  currentStreak: 1,
  totalXp: 30,
  recentLoginHistory: [],
});

const renderDrawer = (userId = 2) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailDrawer
        userId={userId}
        isOpen={true}
        onClose={vi.fn()}
        onToggleStatus={vi.fn()}
      />
    </QueryClientProvider>
  );
};

describe('UserDetailDrawer - Total Learning Time Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC_USER_DETAIL_HOURS_01: formats 7 minutes into 0.12 giờ and displays 7 phút', async () => {
    mockedAdminApi.getUserDetail.mockResolvedValue(createMockUser(7) as never);

    renderDrawer();

    expect(await screen.findByText('Tổng giờ học')).toBeInTheDocument();
    expect(screen.getByText('0.12 giờ')).toBeInTheDocument();
    expect(screen.getByText('7 phút')).toBeInTheDocument();
  });

  it('TC_USER_DETAIL_HOURS_02: formats 6 minutes into 0.10 giờ with exact 2 decimal places and displays 6 phút', async () => {
    mockedAdminApi.getUserDetail.mockResolvedValue(createMockUser(6) as never);

    renderDrawer();

    expect(await screen.findByText('Tổng giờ học')).toBeInTheDocument();
    expect(screen.getByText('0.10 giờ')).toBeInTheDocument();
    expect(screen.getByText('6 phút')).toBeInTheDocument();
  });

  it('TC_USER_DETAIL_HOURS_03: formats 0 minutes into 0.00 giờ and displays 0 phút', async () => {
    mockedAdminApi.getUserDetail.mockResolvedValue(createMockUser(0) as never);

    renderDrawer();

    expect(await screen.findByText('Tổng giờ học')).toBeInTheDocument();
    expect(screen.getByText('0.00 giờ')).toBeInTheDocument();
    expect(screen.getByText('0 phút')).toBeInTheDocument();
  });
});

