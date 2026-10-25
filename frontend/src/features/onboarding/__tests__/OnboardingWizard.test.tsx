import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import OnboardingPage from '../pages/student/OnboardingPage';
import { onboardingApi } from '../api/onboardingApi';
import { alertUtil } from '../../../utils/alert';

vi.mock('../api/onboardingApi', () => ({
  onboardingApi: {
    getStatus: vi.fn(),
    submitOnboarding: vi.fn(),
  },
}));

vi.mock('../../../utils/alert', () => ({
  alertUtil: {
    toast: vi.fn(),
    popup: vi.fn(),
  },
}));

describe('OnboardingWizard UI & Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'fake-jwt-token');
  });

  it('redirects to /student/dashboard if user already completed onboarding', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue({
      code: 200,
      message: 'OK',
      data: {
        hasCompletedOnboarding: true,
        nativeLanguage: 'vi',
        targetLanguage: 'en',
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/student/dashboard" element={<div>Dashboard Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Screen')).toBeInTheDocument();
    });
  });

  it('runs through 4 steps and submits onboarding successfully for English target', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue({
      code: 200,
      message: 'OK',
      data: {
        hasCompletedOnboarding: false,
        nativeLanguage: 'vi',
        targetLanguage: 'en',
      },
    } as any);

    vi.mocked(onboardingApi.submitOnboarding).mockResolvedValue({
      code: 200,
      message: 'Thiết lập thành công',
      data: {
        userId: 1,
        hasCompletedOnboarding: true,
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/student/library" element={<div>Exam Library Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for status check
    await waitFor(() => {
      expect(screen.getByText('Ngôn ngữ của bạn')).toBeInTheDocument();
    });

    // Step 1: Default is Native: vi, Target: en
    expect(screen.getByText('Bước 1 / 4: Chọn Ngôn Ngữ')).toBeInTheDocument();

    // Click "Tiếp tục" -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục/i }));

    // Step 2: Mục tiêu chứng chỉ - targetLanguage is 'en', so English certs are visible and NLTV / IELTS General are not
    await waitFor(() => {
      expect(screen.getByText('Mục tiêu chứng chỉ')).toBeInTheDocument();
    });
    expect(screen.getByText('TOEIC L&R')).toBeInTheDocument();
    expect(screen.getByText('IELTS Academic')).toBeInTheDocument();
    expect(screen.queryByText('IELTS General')).not.toBeInTheDocument();
    expect(screen.queryByText('Năng Lực Tiếng Việt')).not.toBeInTheDocument();

    // Select TOEIC L&R
    fireEvent.click(screen.getByText('TOEIC L&R'));
    expect(screen.getByText('750 Điểm')).toBeInTheDocument();

    // Click "Tiếp tục" -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục/i }));

    // Step 3: Thói quen & Trình độ
    await waitFor(() => {
      expect(screen.getByText('Trình độ & Thói quen học tập')).toBeInTheDocument();
    });
    expect(screen.getByText('Bước 3 / 4: Thói Quen & Trình Độ')).toBeInTheDocument();

    // Select 45 minutes / day
    fireEvent.click(screen.getByText('45 phút / ngày'));

    // Click "Tiếp tục" -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục/i }));

    // Step 4: Lộ trình cá nhân
    await waitFor(() => {
      expect(screen.getByText('Lộ trình của bạn đã sẵn sàng!')).toBeInTheDocument();
    });
    expect(screen.getByText('Bước 4 / 4: Lộ Trình Cá Nhân')).toBeInTheDocument();
    expect(screen.getByText('TOEIC Listening & Reading')).toBeInTheDocument();
    expect(screen.getByText('45 phút / ngày')).toBeInTheDocument();

    // Click "Bắt đầu hành trình học"
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu hành trình học/i }));

    await waitFor(() => {
      expect(onboardingApi.submitOnboarding).toHaveBeenCalledTimes(1);
      expect(onboardingApi.submitOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeLanguage: 'vi',
          targetLanguage: 'en',
          targetCertificate: 'TOEIC_LR',
          targetScore: 750,
          dailyMinutes: 45,
          currentLevel: 'INTERMEDIATE',
        })
      );
      expect(alertUtil.toast).toHaveBeenCalledWith('Thiết lập mục tiêu học tập thành công!', 'success');
      expect(screen.getByText('Exam Library Screen')).toBeInTheDocument();
    });
  });

  it('filters certificates when target language is Vietnamese (NLTV only)', async () => {
    vi.mocked(onboardingApi.getStatus).mockResolvedValue({
      code: 200,
      message: 'OK',
      data: {
        hasCompletedOnboarding: false,
        nativeLanguage: 'vi',
        targetLanguage: 'en',
      },
    } as any);

    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Ngôn ngữ của bạn')).toBeInTheDocument();
    });

    // In target languages, select Tiếng Việt
    const allVietnameseOptions = screen.getAllByText('Tiếng Việt');
    // Target is the second one
    fireEvent.click(allVietnameseOptions[1]);

    // Click "Tiếp tục" -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục/i }));

    // Step 2: Only NLTV is visible, English certs are hidden
    await waitFor(() => {
      expect(screen.getByText('Năng Lực Tiếng Việt')).toBeInTheDocument();
    });
    expect(screen.queryByText('IELTS Academic')).not.toBeInTheDocument();
    expect(screen.queryByText('IELTS General')).not.toBeInTheDocument();
    expect(screen.queryByText('TOEIC L&R')).not.toBeInTheDocument();
    expect(screen.getAllByText('Bậc 4 (B2)').length).toBeGreaterThanOrEqual(1);
  });
});
