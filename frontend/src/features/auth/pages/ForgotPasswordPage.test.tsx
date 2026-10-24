import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ForgotPasswordPage from './ForgotPasswordPage';
import { authApi } from '../api/authApi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/authApi', () => ({
  authApi: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('../../../utils/alert', () => ({
  alertUtil: {
    toast: vi.fn(),
    confirm: vi.fn(),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderForgotPasswordPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>LoginPageView</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ForgotPasswordPage Wizard Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 with email input and submit button', () => {
    renderForgotPasswordPage();

    expect(screen.getByPlaceholderText('john.doe@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: /auth\.send_otp_btn|gửi mã xác nhận|send/i })).toBeDefined();
  });

  it('submits email in Step 1 and advances to Step 2 on success', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ success: true, message: 'OK', data: null } as any);

    renderForgotPasswordPage();

    const emailInput = screen.getByPlaceholderText('john.doe@example.com');
    fireEvent.change(emailInput, { target: { value: 'student@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /auth\.send_otp_btn|gửi mã xác nhận|send/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: 'student@example.com' });
    });

    // Should now show Step 2 OTP input with ------ placeholder
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/auth\.otp_placeholder|------/i)).toBeDefined();
    });
  });

  it('submits OTP in Step 2, advances to Step 3, enters new password and redirects to login on success', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ success: true, message: 'OK', data: null } as any);
    vi.mocked(authApi.resetPassword).mockResolvedValue({ success: true, message: 'OK', data: null } as any);

    renderForgotPasswordPage();

    // Step 1: Submit email
    fireEvent.change(screen.getByPlaceholderText('john.doe@example.com'), { target: { value: 'student@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /auth\.send_otp_btn|gửi mã xác nhận|send/i }));

    // Step 2: Enter OTP and click continue
    const otpInput = await screen.findByPlaceholderText(/auth\.otp_placeholder|------/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });

    const continueBtn = screen.getByRole('button', { name: /auth\.continue_btn|tiếp tục|continue/i });
    fireEvent.click(continueBtn);

    // Step 3: Enter new passwords
    const passwordInputs = await screen.findAllByPlaceholderText('••••••••');
    expect(passwordInputs.length).toBe(2);

    fireEvent.change(passwordInputs[0], { target: { value: 'NewPassword123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'NewPassword123' } });

    const saveBtn = screen.getByRole('button', { name: /auth\.save_new_password_btn|lưu thay đổi|save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith({
        email: 'student@example.com',
        otp: '123456',
        newPassword: 'NewPassword123',
      });
    });

    await screen.findByText('LoginPageView');
  });
});
