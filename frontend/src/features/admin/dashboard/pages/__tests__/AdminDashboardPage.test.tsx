import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../../../api/adminApi';
import AdminDashboardPage from '../AdminDashboardPage';

vi.mock('../../../api/adminApi', () => ({
  adminApi: {
    getDashboardStats: vi.fn(),
    getRevenueChart: vi.fn(),
  },
}));

const mockedAdminApi = vi.mocked(adminApi);

describe('AdminDashboardPage - Attempts Breakdown Tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminApi.getRevenueChart.mockResolvedValue({
      labels: ['01/11', '02/11'],
      data: [100000, 200000],
    } as never);
  });

  it('renders total valid attempts and displays friendly Vietnamese status breakdown in tooltip', async () => {
    mockedAdminApi.getDashboardStats.mockResolvedValue({
      dau: 10,
      mau: 50,
      totalUsers: 100,
      vipUsers: 20,
      vipConversionRate: 20.0,
      totalRevenue: 5000000,
      monthlyRevenue: 1500000,
      totalExamsAttempted: 12,
      attemptsByStatus: {
        COMPLETED: 8,
        IN_PROGRESS: 3,
        EXPIRED: 1,
      },
    } as never);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify main card content
    expect(await screen.findByText('Lượt Nộp Bài Thi & Luyện Tập')).toBeInTheDocument();
    const countElements = await screen.findAllByText('12');
    expect(countElements.length).toBeGreaterThanOrEqual(1);

    // Verify friendly Vietnamese status names inside the tooltip
    expect(screen.getByText('Chi tiết trạng thái bài làm')).toBeInTheDocument();
    expect(screen.getByText('Đề chưa xóa')).toBeInTheDocument();
    expect(screen.getByText('Đã hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Đang làm bài')).toBeInTheDocument();
    expect(screen.getByText('Quá hạn / Hết giờ')).toBeInTheDocument();
    expect(screen.getByText('AI đang chấm điểm')).toBeInTheDocument();

    // Verify count numbers
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
