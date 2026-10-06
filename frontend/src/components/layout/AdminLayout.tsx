import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, ShieldAlert, Crown } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useMutation } from '@tanstack/react-query';
import { logout } from '../../features/auth/store/authSlice';
import { authApi } from '../../features/auth/api/authApi';
import { alertUtil } from '../../utils/alert';

const AdminLayout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      alertUtil.toast('Đăng xuất thành công', 'success');
    },
    onSettled: () => {
      dispatch(logout());
      navigate('/');
    }
  });

  const handleLogout = async () => {
    const isConfirmed = await alertUtil.confirm('Bạn có chắc chắn muốn đăng xuất?', 'Đăng xuất', 'Hủy');
    if (isConfirmed) {
      logoutMutation.mutate();
    }
  };

  return (
    <div className="layout-container" style={{ background: 'var(--bg-primary)' }}>
      {/* Admin Sidebar (Light Theme) */}
      <aside style={{ width: '260px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>Multilingo</h2>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Admin Portal</span>
        </div>
        
        <nav style={{ padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink to="/admin/dashboard" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Tổng quan
          </NavLink>
          <NavLink to="/admin/users" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Users size={20} /> Quản lý Người dùng
          </NavLink>
          <NavLink to="/admin/exams" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} /> Quản lý Đề thi
          </NavLink>
          <NavLink to="/admin/premium" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Crown size={20} /> Quản lý Gói Premium
          </NavLink>
          
          <div style={{ marginTop: '2rem', padding: '0 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Bảo mật</div>
          <NavLink to="/admin/audit" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <ShieldAlert size={20} /> Logs Hệ thống
          </NavLink>
          <NavLink to="/admin/settings" className={({isActive}) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={20} /> Cài đặt
          </NavLink>
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
          <button className="flex-center" style={{ width: '100%', gap: '0.75rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={handleLogout} disabled={logoutMutation.isPending}>
            <LogOut size={20} /> {logoutMutation.isPending ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: '70px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', padding: '0 2rem', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Trang quản trị hệ thống</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Admin (System)</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
          </div>
        </header>

        <main className="slide-up" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
