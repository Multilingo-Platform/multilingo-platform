import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '../../api/adminApi';
import QuotaSettingsPage from './QuotaSettingsPage';

vi.mock('../../api/adminApi', () => ({
  adminApi: { getAllQuotas: vi.fn(), updateQuota: vi.fn() },
}));
vi.mock('../../../../utils/alert', () => ({
  alertUtil: { toast: vi.fn(), popup: vi.fn(), confirm: vi.fn() },
}));

const mockedAdminApi = vi.mocked(adminApi);

describe('QuotaSettingsPage Writing controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminApi.getAllQuotas.mockResolvedValue([
      { feature: 'AI_WRITING_HINTS', tier: 'FREE', dailyLimit: 5 },
      { feature: 'AI_WRITING_HINTS', tier: 'VIP', dailyLimit: 20 },
      { feature: 'AI_WRITING_GRADING', tier: 'FREE', dailyLimit: 5 },
      { feature: 'AI_WRITING_GRADING', tier: 'VIP', dailyLimit: 20 },
    ] as never);
    mockedAdminApi.updateQuota.mockResolvedValue({ dailyLimit: 7 } as never);
  });

  it('shows independent hints/grading settings and saves the selected feature only', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><QuotaSettingsPage /></QueryClientProvider>);

    expect(await screen.findByText('Gợi ý Writing bằng AI')).toBeInTheDocument();
    expect(screen.getByText('AI chấm và nhận xét Writing')).toBeInTheDocument();
    expect(screen.queryByText(/WRITING_ASSISTANT/)).not.toBeInTheDocument();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '7' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Lưu' })[0]);

    await waitFor(() => expect(mockedAdminApi.updateQuota).toHaveBeenCalledWith({
      feature: 'AI_WRITING_HINTS', tier: 'FREE', dailyLimit: 7, resetCycle: 'DAILY',
    }));
    expect(screen.getAllByRole('spinbutton')[2]).toHaveValue(5);
  });
});
