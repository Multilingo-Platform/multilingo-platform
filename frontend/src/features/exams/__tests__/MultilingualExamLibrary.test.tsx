import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axiosClient from '../../../core/api/axiosClient';
import ExamLibrary from '../pages/student/ExamLibrary';

vi.mock('../../../core/api/axiosClient', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../onboarding/api/onboardingApi', () => ({
  onboardingApi: {
    getStatus: vi.fn().mockResolvedValue({
      code: 200,
      data: { hasCompletedOnboarding: true, targetCertificate: 'NLTV', targetLanguage: 'vi' }
    }),
  }
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('multilingual exam library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axiosClient.get).mockImplementation(async (url: string) => {
      if (url === '/v1/student/onboarding/status') {
        return {
          code: 200,
          success: true,
          data: {
            hasCompletedOnboarding: true,
            targetCertificate: 'NLTV',
            targetLanguage: 'vi',
          },
        } as any;
      }
      return {
        success: true,
        data: {
          items: [{ id: 9, type: 'NLTV', title: 'Đề thi NLTV Mẫu', level: 'Đa bậc', tags: [], durationMinutes: 180, joins: 0 }],
          totalPages: 1,
          totalElements: 1,
        },
      } as any;
    });
  });

  it('includes the official NLTV exam type when clicking the NLTV tab button', async () => {
    renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);
    await screen.findByText('Đề thi NLTV Mẫu');
    const nltvTab = screen.getByRole('tab', { name: /NLTV/i });
    fireEvent.click(nltvTab);

    await waitFor(() => expect(axiosClient.get).toHaveBeenLastCalledWith('/v1/student/exams',
      expect.objectContaining({ params: expect.objectContaining({ types: expect.stringContaining('NLTV') }) })));
  });

  it('filters recommended exams matching user onboarding target', async () => {
    renderWithProviders(<MemoryRouter><ExamLibrary /></MemoryRouter>);
    await screen.findByText('Đề thi NLTV Mẫu');

    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledWith('/v1/student/exams',
      expect.objectContaining({
        params: expect.objectContaining({
          types: expect.stringContaining('NLTV'),
          examLanguage: 'vi'
        })
      })));
  });
});
