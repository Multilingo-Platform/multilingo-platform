import { fireEvent, render, screen } from '@testing-library/react';
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
    const card = await screen.findByText('Lượt Nộp Bài Thi & Luyện Tập');
    expect(card).toBeInTheDocument();

    // Click card to open modal
    fireEvent.click(card);

    // Verify modal content
    expect(await screen.findByText('Thống Kê Chi Tiết Trạng Thái Lượt Làm Bài')).toBeInTheDocument();
    expect(screen.getByText('Chỉ tính đề thi còn tồn tại trên hệ thống')).toBeInTheDocument();
    expect(screen.getAllByText('Đã hoàn thành').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đang làm bài').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Quá hạn / Hết giờ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI đang chấm điểm').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chú Thích Ý Nghĩa Nghiệp Vụ Từng Trạng Thái')).toBeInTheDocument();
  });
});
