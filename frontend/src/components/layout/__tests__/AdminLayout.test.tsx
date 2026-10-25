import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import authReducer from '../../../features/auth/store/authSlice';
import AdminLayout from '../AdminLayout';
import { alertUtil } from '../../../utils/alert';
import { authApi } from '../../../features/auth/api/authApi';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock('../../../utils/alert', () => ({
  alertUtil: {
    confirm: vi.fn(),
    toast: vi.fn(),
  },
}));

vi.mock('../../../features/auth/api/authApi', () => ({
  authApi: {
    logout: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('AdminLayout', () => {
  let store: any;
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
      preloadedState: {
        auth: {
          user: {
            id: '1',
            email: 'admin@multilingo.com',
            fullName: 'Admin Test',
            role: 'ADMIN',
            phone: '0123456789',
            subscriptionTier: 'FREE',
            premiumExpiresAt: '',
          },
          token: 'mock-token',
          isAuthenticated: true,
        },
      },
    });
  });

  const renderComponent = () =>
    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/admin/dashboard']}>
            <AdminLayout />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );

  it('does NOT render logout button in the sidebar', () => {
    const { container } = renderComponent();
    const sidebar = container.querySelector('.admin-sidebar');
    expect(sidebar).toBeTruthy();
    expect(sidebar?.textContent).not.toContain('Đăng xuất');
  });

  it('renders avatar dropdown trigger in the header and opens menu on click', () => {
    renderComponent();

    // The dropdown menu shouldn't be open initially
    expect(screen.queryByText('Quản lý thông tin')).not.toBeInTheDocument();
    expect(screen.queryByText('Đổi mật khẩu')).not.toBeInTheDocument();

    // Find and click the avatar/profile trigger button
    const trigger = screen.getByRole('button', { name: /admin test/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    // After clicking, dropdown options should be visible
    expect(screen.getByText('Quản lý thông tin')).toBeInTheDocument();
    expect(screen.getByText('Đổi mật khẩu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /admin test/i });
    fireEvent.click(trigger);
    expect(screen.getByText('Quản lý thông tin')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Quản lý thông tin')).not.toBeInTheDocument();
  });

  it('navigates to settings general on clicking Quản lý thông tin', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /admin test/i });
    fireEvent.click(trigger);

    const profileOption = screen.getByText('Quản lý thông tin');
    fireEvent.click(profileOption);

    expect(mockedNavigate).toHaveBeenCalledWith('/student/settings?tab=general');
    expect(screen.queryByText('Quản lý thông tin')).not.toBeInTheDocument();
  });

  it('navigates to settings password on clicking Đổi mật khẩu', () => {
    renderComponent();

    const trigger = screen.getByRole('button', { name: /admin test/i });
    fireEvent.click(trigger);

    const passwordOption = screen.getByText('Đổi mật khẩu');
    fireEvent.click(passwordOption);

    expect(mockedNavigate).toHaveBeenCalledWith('/student/settings?tab=password');
    expect(screen.queryByText('Đổi mật khẩu')).not.toBeInTheDocument();
  });

  it('prompts confirmation and logs out on clicking Đăng xuất', async () => {
    vi.mocked(alertUtil.confirm).mockResolvedValue(true);
    renderComponent();

    const trigger = screen.getByRole('button', { name: /admin test/i });
    fireEvent.click(trigger);

    const logoutOption = screen.getByRole('button', { name: /đăng xuất/i });
    fireEvent.click(logoutOption);

    expect(alertUtil.confirm).toHaveBeenCalledWith(
      'Bạn có chắc chắn muốn đăng xuất?',
      'Đăng xuất',
      'Hủy'
    );
    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalled();
    });
  });

  it('toggles sidebar collapse state and persists to localStorage', () => {
    localStorage.clear();
    const { container } = renderComponent();
    const sidebar = container.querySelector('.admin-sidebar');
    expect(sidebar).toBeTruthy();
    expect(sidebar?.classList.contains('collapsed')).toBe(false);

    // Click collapse button
    const toggleBtn = screen.getByRole('button', { name: /thu gọn menu/i });
    fireEvent.click(toggleBtn);

    expect(sidebar?.classList.contains('collapsed')).toBe(true);
    expect(localStorage.getItem('admin_sidebar_collapsed')).toBe('true');

    // Click again to expand
    const expandBtn = screen.getByRole('button', { name: /mở rộng menu/i });
    fireEvent.click(expandBtn);

    expect(sidebar?.classList.contains('collapsed')).toBe(false);
    expect(localStorage.getItem('admin_sidebar_collapsed')).toBe('false');
  });
});
