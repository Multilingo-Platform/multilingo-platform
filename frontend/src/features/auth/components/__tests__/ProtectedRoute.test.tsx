import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../store/authSlice';
import ProtectedRoute from '../ProtectedRoute';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../utils/alert', () => ({
  alertUtil: {
    toast: vi.fn(),
    popup: vi.fn(),
    confirm: vi.fn()
  }
}));

const createMockStore = (authState: any) => {
  return configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: authState
    }
  });
};

describe('ProtectedRoute RBAC', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('Chưa đăng nhập -> Điều hướng sang /login', () => {
    const store = createMockStore({
      isAuthenticated: false,
      token: null,
      user: null
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Trang Đăng Nhập</div>} />
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Trang Đăng Nhập')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });

  it('Đã đăng nhập với role USER nhưng vào trang yêu cầu ADMIN -> Chuyển hướng sang /student/dashboard', () => {
    const store = createMockStore({
      isAuthenticated: true,
      token: 'fake-token',
      user: { id: '1', email: 'user@multilingo.com', role: 'USER' }
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route path="/student/dashboard" element={<div>Student Dashboard</div>} />
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Page')).not.toBeInTheDocument();
  });

  it('Đã đăng nhập với role ADMIN vào trang yêu cầu ADMIN -> Cho phép truy cập', () => {
    const store = createMockStore({
      isAuthenticated: true,
      token: 'admin-token',
      user: { id: '2', email: 'admin@multilingo.com', role: 'ADMIN' }
    });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/admin/dashboard']}>
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/dashboard" element={<div>Admin Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Admin Page')).toBeInTheDocument();
  });
});
