import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { alertUtil } from '../../../utils/alert';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const token = localStorage.getItem('token');

  const isUserAuthenticated = isAuthenticated || Boolean(token);

  if (!isUserAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role ? user.role.toUpperCase() : 'USER';
    const isAllowed = allowedRoles.some(r => r.toUpperCase() === userRole);

    if (!isAllowed) {
      alertUtil.toast('Bạn không có quyền truy cập trang này!', 'error');
      const fallbackRedirect = userRole === 'ADMIN' ? '/admin/dashboard' : '/student/dashboard';
      return <Navigate to={fallbackRedirect} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
